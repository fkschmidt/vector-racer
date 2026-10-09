import { OnlineConnection, type OnlineMessage } from './online-connection.ts'
import { decodeSignal, encodeSignal, type OnlineSignal } from './online-link.ts'

export type OnlineRole = 'host' | 'guest'

export type OnlineStage =
  | 'idle'
  | 'preparing'
  // Host: the invite link is ready and the reply is awaited.
  | 'invite'
  // Guest: the reply link is ready and the host has yet to open it.
  | 'reply'
  | 'connecting'
  | 'connected'
  | 'lost'
  | 'failed'

export type OnlineRaceEvents = {
  onChange(): void
  onConnected(): void
  onMessage(message: OnlineMessage): void
}

// A reply link usually opens in a new tab. That tab passes it to the tab holding the invite over this channel.
const RELAY_CHANNEL = 'vector-racer-online'
const RELAY_TIMEOUT = 1500

async function linkFor(signal: OnlineSignal): Promise<string> {
  const url = new URL(window.location.href)
  url.hash = await encodeSignal(signal)
  return url.toString()
}

/** Hands a reply link to the tab that created the invite. Resolves to false if no open tab takes it. */
export function deliverReply(text: string, id: string): Promise<boolean> {
  return new Promise((resolve) => {
    const channel = new BroadcastChannel(RELAY_CHANNEL)
    const finish = (delivered: boolean): void => {
      window.clearTimeout(timer)
      channel.close()
      resolve(delivered)
    }
    const timer = window.setTimeout(() => finish(false), RELAY_TIMEOUT)
    channel.addEventListener('message', ({ data }) => {
      if (data?.type === 'accepted' && data.id === id) finish(true)
    })
    channel.postMessage({ type: 'reply', text })
  })
}

/** Sets up and holds the connection for a two-player race: the host is driver 1, the guest driver 2. */
export class OnlineRace {
  private readonly events: OnlineRaceEvents
  private readonly relay = new BroadcastChannel(RELAY_CHANNEL)
  private connection: OnlineConnection | null = null
  private id = ''
  private currentRole: OnlineRole = 'host'
  private currentStage: OnlineStage = 'idle'
  private currentLink: string | null = null

  constructor(events: OnlineRaceEvents) {
    this.events = events
    this.relay.addEventListener('message', ({ data }) => {
      if (data?.type === 'reply' && typeof data.text === 'string') void this.acceptRelayedReply(data.text)
    })
  }

  get role(): OnlineRole {
    return this.currentRole
  }

  get stage(): OnlineStage {
    return this.currentStage
  }

  /** The link this player has to send: the invite for the host, the reply for the guest. */
  get link(): string | null {
    return this.currentLink
  }

  async host(): Promise<void> {
    const connection = this.open('host')
    this.id = Math.random().toString(36).slice(2, 10)
    try {
      const link = await linkFor({ kind: 'join', id: this.id, sdp: await connection.createOffer() })
      if (this.connection === connection) this.showLink(link, 'invite')
    } catch {
      if (this.connection === connection) this.end('failed')
    }
  }

  async join(invite: OnlineSignal): Promise<void> {
    const connection = this.open('guest')
    this.id = invite.id
    try {
      const link = await linkFor({ kind: 'answer', id: invite.id, sdp: await connection.acceptOffer(invite.sdp) })
      if (this.connection === connection) this.showLink(link, 'reply')
    } catch {
      if (this.connection === connection) this.end('failed')
    }
  }

  /** Takes the guest's reply link. Returns false if the text is not the reply to the invite open here. */
  async acceptReply(text: string): Promise<boolean> {
    const reply = await decodeSignal(text)
    const connection = this.connection
    if (!connection || this.currentRole !== 'host' || this.currentStage !== 'invite') return false
    if (reply?.kind !== 'answer' || reply.id !== this.id) return false

    this.setStage('connecting')
    try {
      await connection.acceptAnswer(reply.sdp)
    } catch {
      if (this.connection === connection) this.end('failed')
    }
    return true
  }

  send(message: OnlineMessage): void {
    this.connection?.send(message)
  }

  /** Ends the race because the two players no longer agree on its state. */
  fail(): void {
    this.end('lost')
  }

  leave(): void {
    this.connection?.close()
    this.connection = null
    this.currentLink = null
    this.currentStage = 'idle'
  }

  private open(role: OnlineRole): OnlineConnection {
    this.leave()
    const connection: OnlineConnection = new OnlineConnection({
      onOpen: () => {
        if (this.connection !== connection) return
        this.currentLink = null
        this.setStage('connected')
        this.events.onConnected()
      },
      onMessage: (message) => {
        if (this.connection === connection) this.events.onMessage(message)
      },
      onClose: () => {
        if (this.connection === connection) this.end(this.currentStage === 'connected' ? 'lost' : 'failed')
      },
    })
    this.connection = connection
    this.currentRole = role
    this.setStage('preparing')
    return connection
  }

  private showLink(link: string, stage: OnlineStage): void {
    this.currentLink = link
    this.setStage(stage)
  }

  private end(stage: OnlineStage): void {
    this.leave()
    this.setStage(stage)
  }

  private setStage(stage: OnlineStage): void {
    this.currentStage = stage
    this.events.onChange()
  }

  private async acceptRelayedReply(text: string): Promise<void> {
    const id = this.id
    if (await this.acceptReply(text)) this.relay.postMessage({ type: 'accepted', id })
  }
}
