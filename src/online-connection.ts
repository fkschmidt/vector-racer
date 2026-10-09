import { cleanDriverName } from './game.ts'
import type { Point } from './tracks.ts'

export type OnlineMessage =
  // Sent by the host to start a race. Later messages name the race they belong to.
  | { type: 'new-race'; race: number; trackId: string }
  // One selected point: a start position or a move. `turn` counts the selections in this race.
  | { type: 'move'; race: number; turn: number; point: Point }
  // The sender's driver name. Empty means they have not chosen one.
  | { type: 'name'; name: string }

export type ConnectionEvents = {
  onOpen(): void
  onMessage(message: OnlineMessage): void
  /** The connection ended or could not be made. Not called after `close()`. */
  onClose(): void
}

// A public address-lookup server. It tells each browser its own internet address; no race data passes through it.
const ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }]
const GATHERING_TIMEOUT = 4000
const CONNECT_TIMEOUT = 30000
const OFFER_REFRESH_INTERVAL = 10000
const OFFER_REFRESH_LIMIT = 90

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

/** Reads a message from the other player. Anything malformed is rejected. */
export function parseOnlineMessage(data: unknown): OnlineMessage | null {
  if (typeof data !== 'string') return null
  let message: unknown
  try {
    message = JSON.parse(data)
  } catch {
    return null
  }
  if (typeof message !== 'object' || message === null) return null

  const { type, race, trackId, turn, point, name } = message as Record<string, unknown>
  if (type === 'name') return typeof name === 'string' ? { type, name: cleanDriverName(name) } : null
  if (!isCount(race)) return null
  if (type === 'new-race') {
    return typeof trackId === 'string' ? { type, race, trackId } : null
  }
  if (type === 'move' && isCount(turn) && typeof point === 'object' && point !== null) {
    const { x, y } = point as Record<string, unknown>
    if (Number.isInteger(x) && Number.isInteger(y)) return { type, race, turn, point: { x: x as number, y: y as number } }
  }
  return null
}

/** A direct link between two browsers. One side creates an offer, the other answers it. */
export class OnlineConnection {
  private readonly peer = new RTCPeerConnection({ iceServers: ICE_SERVERS })
  private readonly events: ConnectionEvents
  private channel: RTCDataChannel | null = null
  private connectTimer: number | null = null
  private refreshTimer: number | null = null
  private opened = false
  private closed = false

  constructor(events: ConnectionEvents) {
    this.events = events
    this.peer.addEventListener('connectionstatechange', () => {
      if (this.opened && this.peer.connectionState === 'failed') this.fail()
    })
  }

  async createOffer(): Promise<string> {
    this.useChannel(this.peer.createDataChannel('race'))
    await this.peer.setLocalDescription()
    return this.completeLocalDescription()
  }

  async acceptOffer(sdp: string): Promise<string> {
    this.peer.addEventListener('datachannel', ({ channel }) => this.useChannel(channel))
    await this.peer.setRemoteDescription({ type: 'offer', sdp })
    await this.peer.setLocalDescription()
    const answer = await this.completeLocalDescription()
    this.keepOfferAlive(sdp)
    return answer
  }

  async acceptAnswer(sdp: string): Promise<void> {
    await this.peer.setRemoteDescription({ type: 'answer', sdp })
    if (!this.opened && !this.closed) this.connectTimer = window.setTimeout(() => this.fail(), CONNECT_TIMEOUT)
  }

  send(message: OnlineMessage): void {
    if (this.channel?.readyState === 'open') this.channel.send(JSON.stringify(message))
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    this.stopTimers()
    this.channel?.close()
    this.peer.close()
  }

  private fail(): void {
    if (this.closed) return
    this.close()
    this.events.onClose()
  }

  private stopTimers(): void {
    if (this.connectTimer !== null) window.clearTimeout(this.connectTimer)
    if (this.refreshTimer !== null) window.clearInterval(this.refreshTimer)
    this.connectTimer = null
    this.refreshTimer = null
  }

  private useChannel(channel: RTCDataChannel): void {
    this.channel = channel
    channel.addEventListener('open', () => {
      if (this.closed) return
      this.opened = true
      this.stopTimers()
      this.events.onOpen()
    })
    channel.addEventListener('message', ({ data }) => {
      const message = parseOnlineMessage(data)
      if (message && !this.closed) this.events.onMessage(message)
    })
    channel.addEventListener('close', () => this.fail())
  }

  // The link has to carry every address the browser can be reached at, so wait until they are all known.
  private async completeLocalDescription(): Promise<string> {
    if (this.peer.iceGatheringState !== 'complete') {
      await new Promise<void>((resolve) => {
        const timer = window.setTimeout(resolve, GATHERING_TIMEOUT)
        this.peer.addEventListener('icegatheringstatechange', () => {
          if (this.peer.iceGatheringState !== 'complete') return
          window.clearTimeout(timer)
          resolve()
        })
      })
    }
    const sdp = this.peer.localDescription?.sdp
    if (!sdp) throw new Error('No connection details available')
    return sdp
  }

  // The host may take minutes to open the reply link, but a browser stops trying the offered addresses
  // after about fifteen seconds. Handing them over again makes it try again, which also keeps this side's
  // router open for the host. A browser ignores an address it has seen, so each round is relabelled.
  private keepOfferAlive(sdp: string): void {
    const sdpMid = /^a=mid:(.+)$/m.exec(sdp)?.[1].trim() ?? '0'
    const addresses = sdp.split(/\r?\n/)
      .filter((line) => line.startsWith('a=candidate:'))
      .map((line) => line.slice(line.indexOf(' ')))
    let round = 0
    this.refreshTimer = window.setInterval(() => {
      round += 1
      addresses.forEach((address, index) => {
        this.peer.addIceCandidate({ candidate: `candidate:${round}${index}${address}`, sdpMid }).catch(() => {})
      })
      if (round === OFFER_REFRESH_LIMIT) this.stopTimers()
    }, OFFER_REFRESH_INTERVAL)
  }
}
