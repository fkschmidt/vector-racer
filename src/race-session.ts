import {
  crossesFinishLine,
  createRacers,
  getCandidates,
  hasLeftStartAfterMove,
  type Candidate,
  type Racer,
} from './game.ts'
import { locateOnRoute, TRACKS, type Point, type Track } from './tracks.ts'

export type RacePhase = 'setup' | 'racing' | 'finished'
export type RaceEvent = { round: number; text: string }

export type RaceState = {
  track: Track
  phase: RacePhase
  racers: Racer[]
  setupIndex: number
  chosenStartPositions: Point[]
  currentIndex: number
  round: number
  winnerId: number | null
  events: RaceEvent[]
}

export type ReplayFrame = {
  racers: Racer[]
  currentIndex: number
  round: number
  winnerId: number | null
  events: RaceEvent[]
}

function samePoint(first: Point, second: Point): boolean {
  return first.x === second.x && first.y === second.y
}

function cloneRacer(racer: Racer): Racer {
  return {
    ...racer,
    position: { ...racer.position },
    velocity: { ...racer.velocity },
    trail: racer.trail.map(({ from, to }) => ({ from: { ...from }, to: { ...to } })),
  }
}

export class RaceSession {
  private current: RaceState
  private frames: ReplayFrame[] = []

  constructor(count = 2, track: Track = TRACKS[0]) {
    this.current = this.createState(count, track)
  }

  get state(): RaceState {
    return this.current
  }

  get replayFrames(): readonly ReplayFrame[] {
    return this.frames
  }

  startNewRace(count: number, track: Track): void {
    this.current = this.createState(count, track)
    this.frames = []
  }

  getCandidates(): Candidate[] {
    if (this.current.phase === 'setup') return this.getStartingCandidates()
    if (this.current.phase !== 'racing') return []

    const racer = this.current.racers[this.current.currentIndex]
    return getCandidates(
      racer,
      this.current.racers.filter((other) => other.id !== racer.id),
      this.current.track,
    )
  }

  selectPoint(point: Point): boolean {
    if (this.current.phase === 'setup') return this.chooseStartingPosition(point)
    if (this.current.phase === 'racing') return this.chooseMove(point)
    return false
  }

  private createState(count: number, track: Track): RaceState {
    return {
      track,
      phase: 'setup',
      racers: createRacers(count, track),
      setupIndex: 0,
      chosenStartPositions: [],
      currentIndex: 0,
      round: 1,
      winnerId: null,
      events: [{ round: 1, text: 'Choose a distinct starting point for each driver.' }],
    }
  }

  private getStartingCandidates(): Candidate[] {
    return this.current.track.startLine.positions.map(({ point }) => {
      return {
        point,
        kind: this.current.chosenStartPositions.some((chosen) => samePoint(chosen, point)) ? 'blocked' : 'move',
      }
    })
  }

  private chooseStartingPosition(point: Point): boolean {
    const candidate = this.getStartingCandidates().find((option) => samePoint(option.point, point))
    if (!candidate || candidate.kind !== 'move') return false

    const state = this.current
    const racer = state.racers[state.setupIndex]
    const startingPosition = state.track.startLine.positions.find((slot) => samePoint(slot.point, point))
    if (!startingPosition) return false
    racer.position = { ...point }
    racer.velocity = { ...startingPosition.direction }
    racer.progress = locateOnRoute(state.track, point).progress
    racer.trail = [{
      from: { x: point.x - racer.velocity.x, y: point.y - racer.velocity.y },
      to: { ...point },
    }]
    state.chosenStartPositions.push({ ...point })
    this.addEvent(`${racer.name} claims grid point ${point.x}, ${point.y}.`)
    state.setupIndex += 1

    if (state.setupIndex === state.racers.length) {
      state.phase = 'racing'
      state.currentIndex = 0
      this.addEvent('Grid set. The race begins.')
      this.frames = [this.captureFrame()]
    }

    return true
  }

  private chooseMove(point: Point): boolean {
    const state = this.current
    const candidate = this.getCandidates().find((option) => samePoint(option.point, point))
    if (!candidate || candidate.kind === 'blocked') return false

    const racer = state.racers[state.currentIndex]
    if (candidate.kind === 'crash') {
      racer.velocity = { x: 0, y: 0 }
      racer.penaltyTurns = 2
      racer.recoveryMove = true
      this.addEvent(`${racer.name} leaves the track. Speed reset; two turns lost.`)
      this.advancePlayer()
      return true
    }

    const previous = { ...racer.position }
    const destination = { ...candidate.point }
    racer.trail.push({ from: previous, to: destination })
    racer.position = destination
    racer.velocity = { x: destination.x - previous.x, y: destination.y - previous.y }
    racer.recoveryMove = false
    racer.progress = locateOnRoute(state.track, destination, racer.progress).progress

    const finished = racer.hasLeftStart && crossesFinishLine(previous, destination, state.track)
    racer.hasLeftStart = hasLeftStartAfterMove(racer.hasLeftStart, previous, destination, state.track)

    if (finished) {
      state.phase = 'finished'
      state.winnerId = racer.id
      this.addEvent(`${racer.name} crosses the finish line.`)
      this.appendReplayFrame()
      return true
    }

    this.addEvent(`${racer.name} moves to ${destination.x}, ${destination.y}.`)
    this.advancePlayer()
    return true
  }

  private advancePlayer(): void {
    const state = this.current
    state.currentIndex = (state.currentIndex + 1) % state.racers.length
    if (state.currentIndex === 0) state.round += 1

    let skipped = 0
    while (state.racers[state.currentIndex].penaltyTurns > 0 && skipped < 20) {
      const racer = state.racers[state.currentIndex]
      racer.penaltyTurns -= 1
      this.addEvent(`${racer.name} misses a turn (${racer.penaltyTurns} penalty turns left).`)
      this.appendReplayFrame()
      state.currentIndex = (state.currentIndex + 1) % state.racers.length
      if (state.currentIndex === 0) state.round += 1
      skipped += 1
    }
    this.appendReplayFrame()
  }

  private addEvent(text: string): void {
    this.current.events.unshift({ round: this.current.round, text })
    this.current.events = this.current.events.slice(0, 5)
  }

  private captureFrame(): ReplayFrame {
    const { racers, currentIndex, round, winnerId, events } = this.current
    return {
      racers: racers.map(cloneRacer),
      currentIndex,
      round,
      winnerId,
      events: events.map((event) => ({ ...event })),
    }
  }

  private appendReplayFrame(): void {
    this.frames.push(this.captureFrame())
  }
}
