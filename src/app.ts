import './game.css'
import { chooseComputerMove } from './computer-player.ts'
import { GameView } from './game-view.ts'
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

  view.render(
    session.state,
    session.getCandidates(),
    replay,
    session.replayFrames.length,
    replayTimer !== null,
    view.isComputerMode ? 2 : null,
    computerThinking,
    championship,
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
  render()
}

function startNewRace(): void {
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
    if (!replayMode && !computerThinking && session.selectPoint(point)) {
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
})

render()
