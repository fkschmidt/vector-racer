import './game.css'
import { chooseComputerMove } from './computer-player.ts'
import { CLASSIC_DRIVERS, cleanDriverName, PLAYER_DRIVER, type Driver } from './game.ts'
import { GameView } from './game-view.ts'
import type { OnlineMessage } from './online-connection.ts'
import { decodeSignal } from './online-link.ts'
import { deliverReply, OnlineRace } from './online-race.ts'
import { RaceSession } from './race-session.ts'
import { getTrack, TRACKS, type Point, type Track } from './tracks.ts'
import { WorldCup } from './world-cup.ts'

const root = document.querySelector<HTMLDivElement>('#app')
if (!root) throw new Error('App root is missing')

const view = new GameView(root)
const session = new RaceSession(2, TRACKS[0])
const worldCup = new WorldCup()
let replayMode = false
let replayIndex = 0
let replayTimer: number | null = null
let computerThinking = false
let computerTimer: number | null = null
const online = new OnlineRace({
  onChange: render,
  onConnected: handleOnlineConnected,
  onMessage: handleOnlineMessage,
})
// Both players count races and selections the same way, so a message that is out of step can be told apart.
let onlineRaceNumber = 0
let onlineTurn = 0
let replyRejected = false
let relayNotice: 'relayed' | 'relay-failed' | null = null
const NAME_STORAGE_KEY = 'vector-racer-name'
let playerName = cleanDriverName(readStoredName())
let opponentName = ''
let computerDriver: Driver = CLASSIC_DRIVERS[1]

function readStoredName(): string {
  try {
    return window.localStorage.getItem(NAME_STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

// The name belongs to the person at this device: driver 1 against the computer, their own seat online.
function applyDrivers(): void {
  if (view.isOnlineMode) {
    const seat = online.role === 'host' ? 0 : 1
    session.setDriver(seat, { ...CLASSIC_DRIVERS[seat], name: playerName || CLASSIC_DRIVERS[seat].name })
    session.setDriver(1 - seat, { ...CLASSIC_DRIVERS[1 - seat], name: opponentName || CLASSIC_DRIVERS[1 - seat].name })
  } else if (view.isComputerMode) {
    session.setDriver(0, { ...PLAYER_DRIVER, name: playerName || PLAYER_DRIVER.name })
    session.setDriver(1, computerDriver)
  }
}

function changePlayerName(name: string): void {
  playerName = cleanDriverName(name)
  view.showPlayerName(playerName)
  try {
    window.localStorage.setItem(NAME_STORAGE_KEY, playerName)
  } catch {
    // Without storage the name still holds until the page is closed.
  }
  applyDrivers()
  online.send({ type: 'name', name: playerName })
  render()
}

function stopReplay(): void {
  if (replayTimer !== null) window.clearInterval(replayTimer)
  replayTimer = null
}

function render(): void {
  const frame = replayMode ? session.replayFrames[replayIndex] : null
  const replay = replayMode && frame
    ? { frame, index: replayIndex, total: session.replayFrames.length }
    : null
  const championship = !replayMode && view.isChampionshipMode && worldCup.stage !== 'racing'
    ? {
      stage: worldCup.stage,
      raceNumber: worldCup.raceNumber,
      totalRaces: worldCup.totalRaces,
      currentTrack: worldCup.currentTrack.name,
      nextTrack: worldCup.nextTrack?.name ?? null,
    }
    : null
  const onlineDisplay = view.isOnlineMode
    ? { stage: online.stage, role: online.role, link: online.link, replyRejected }
    : relayNotice ? { stage: relayNotice, role: online.role, link: null, replyRejected: false } : null

  view.render(
    session.state,
    session.getCandidates(),
    replay,
    session.replayFrames.length,
    replayTimer !== null,
    view.isComputerMode ? 2 : null,
    computerThinking,
    championship,
    onlineDisplay,
  )
}

function stopComputerTurn(): void {
  if (computerTimer !== null) window.clearTimeout(computerTimer)
  computerTimer = null
  computerThinking = false
}

function computerHasTurn(): boolean {
  const state = session.state
  return view.isComputerMode && (
    (state.phase === 'setup' && state.setupIndex === 1)
    || (state.phase === 'racing' && state.currentIndex === 1)
  )
}

function recordWorldCupResult(): void {
  if (view.isChampionshipMode && worldCup.stage === 'racing' && session.state.phase === 'finished') {
    worldCup.recordResult(session.state.winnerId === 1)
  }
}

function scheduleComputerTurn(): void {
  if (!computerHasTurn() || replayMode || computerThinking) return

  computerThinking = true
  render()
  computerTimer = window.setTimeout(() => {
    computerTimer = null
    const state = session.state
    if (state.phase === 'setup') {
      const humanPosition = state.racers[0].position
      const startOptions = session.getCandidates().filter((candidate) => candidate.kind === 'move')
      const startChoice = startOptions.reduce<Point | null>((best, candidate) => {
        if (!best) return candidate.point
        const distance = Math.hypot(candidate.point.x - humanPosition.x, candidate.point.y - humanPosition.y)
        const bestDistance = Math.hypot(best.x - humanPosition.x, best.y - humanPosition.y)
        return distance > bestDistance ? candidate.point : best
      }, null)
      if (startChoice) session.selectPoint(startChoice)
    } else if (state.phase === 'racing' && state.currentIndex === 1) {
      const racer = state.racers[state.currentIndex]
      const otherRacers = state.racers.filter((other) => other.id !== racer.id)
      const candidate = chooseComputerMove(racer, session.getCandidates(), otherRacers, state.track)
      if (candidate) session.selectPoint(candidate.point)
    }
    recordWorldCupResult()
    computerThinking = false
    render()
    scheduleComputerTurn()
  }, 550)
}

function startRace(track: Track, playerCount: number): void {
  stopReplay()
  replayMode = false
  replayIndex = 0
  stopComputerTurn()
  view.setTrackId(track.id)
  session.startNewRace(playerCount, track)
  // The computer drives as a different classic driver, picked by chance, in every race.
  computerDriver = CLASSIC_DRIVERS[Math.floor(Math.random() * CLASSIC_DRIVERS.length)]
  applyDrivers()
  render()
}

function hasOnlineTurn(): boolean {
  const state = session.state
  const seat = online.role === 'host' ? 0 : 1
  return online.stage === 'connected' && (
    (state.phase === 'setup' && state.setupIndex === seat)
    || (state.phase === 'racing' && state.currentIndex === seat)
  )
}

function startConnectedRace(track: Track, raceNumber: number): void {
  onlineRaceNumber = raceNumber
  onlineTurn = 0
  startRace(track, 2)
}

function startOnlineRace(): void {
  // The host starts every race; the guest follows.
  if (online.role === 'guest' && ['preparing', 'reply', 'connected'].includes(online.stage)) return
  const track = getTrack(view.trackId)
  if (online.role === 'host' && online.stage === 'connected') {
    startConnectedRace(track, onlineRaceNumber + 1)
    online.send({ type: 'new-race', race: onlineRaceNumber, trackId: track.id })
    return
  }
  startRace(track, 2)
  // An invite that is already out stays valid: the circuit is only sent once the guest has connected.
  if (online.role === 'host' && ['preparing', 'invite', 'connecting'].includes(online.stage)) return
  replyRejected = false
  opponentName = ''
  void online.host()
}

function handleOnlineConnected(): void {
  online.send({ type: 'name', name: playerName })
  if (online.role === 'host') startOnlineRace()
}

function handleOnlineMessage(message: OnlineMessage): void {
  if (message.type === 'name') {
    opponentName = message.name
    applyDrivers()
    render()
    return
  }
  if (message.type === 'new-race') {
    const track = TRACKS.find(({ id }) => id === message.trackId)
    if (online.role === 'guest' && track) startConnectedRace(track, message.race)
    return
  }
  // A move for an abandoned race can still be on its way when the host starts the next one.
  if (message.race !== onlineRaceNumber) return
  if (message.turn !== onlineTurn || hasOnlineTurn() || !session.selectPoint(message.point)) {
    online.fail()
    return
  }
  onlineTurn += 1
  render()
}

async function submitReply(text: string): Promise<void> {
  replyRejected = !(await online.acceptReply(text))
  render()
}

// Invite and reply links arrive in the address bar, either on load or pasted into an open tab.
async function handleLinkSignal(): Promise<void> {
  const text = window.location.hash
  const signal = await decodeSignal(text)
  if (!signal) return
  window.history.replaceState(null, '', window.location.pathname + window.location.search)

  if (signal.kind === 'join') {
    relayNotice = null
    opponentName = ''
    view.showOnlineMode()
    void online.join(signal)
    startRace(getTrack(view.trackId), 2)
    return
  }
  if (await online.acceptReply(text)) return
  relayNotice = await deliverReply(text, signal.id) ? 'relayed' : 'relay-failed'
  render()
}

function startNewRace(): void {
  relayNotice = null
  if (view.isOnlineMode) {
    startOnlineRace()
    return
  }
  online.leave()
  if (view.isChampionshipMode) {
    worldCup.restart()
    startRace(worldCup.currentTrack, 2)
    return
  }
  startRace(getTrack(view.trackId), view.isComputerMode ? 2 : view.playerCount)
}

function handleChampionshipAction(): void {
  if (!view.isChampionshipMode) return
  if (worldCup.stage === 'champion') {
    startNewRace()
    return
  }
  worldCup.continue()
  startRace(worldCup.currentTrack, 2)
}

function openReplay(): void {
  if (session.replayFrames.length < 2 || replayMode) return
  replayMode = true
  replayIndex = 0
  render()
}

function closeReplay(): void {
  if (!replayMode) return
  stopReplay()
  replayMode = false
  render()
}

function showReplayFrame(index: number): void {
  replayIndex = Math.max(0, Math.min(index, session.replayFrames.length - 1))
  render()
}

function toggleReplay(): void {
  if (!replayMode) return
  if (replayTimer !== null) {
    stopReplay()
    render()
    return
  }
  if (replayIndex >= session.replayFrames.length - 1) replayIndex = 0
  replayTimer = window.setInterval(() => {
    if (replayIndex >= session.replayFrames.length - 1) {
      stopReplay()
      render()
      return
    }
    replayIndex += 1
    if (replayIndex >= session.replayFrames.length - 1) stopReplay()
    render()
  }, 850)
  render()
}

view.bind({
  onSelectPoint(point) {
    if (view.isOnlineMode && !hasOnlineTurn()) return
    if (!replayMode && !computerThinking && session.selectPoint(point)) {
      if (view.isOnlineMode) {
        online.send({ type: 'move', race: onlineRaceNumber, turn: onlineTurn, point })
        onlineTurn += 1
      }
      recordWorldCupResult()
      render()
      scheduleComputerTurn()
    }
  },
  onNewRace: startNewRace,
  onOpenReplay: openReplay,
  onCloseReplay: closeReplay,
  onStepReplay(delta) {
    if (!replayMode) return
    stopReplay()
    showReplayFrame(replayIndex + delta)
  },
  onToggleReplay: toggleReplay,
  onSeekReplay(index) {
    if (!replayMode) return
    stopReplay()
    showReplayFrame(index)
  },
  onChampionshipAction: handleChampionshipAction,
  onSubmitReply(text) {
    void submitReply(text)
  },
  onChangeName: changePlayerName,
})
view.showPlayerName(playerName)

window.addEventListener('hashchange', () => void handleLinkSignal())
// Closing the tab ends the connection at once, so the other player is not left waiting.
window.addEventListener('pagehide', () => online.leave())

render()
void handleLinkSignal()
