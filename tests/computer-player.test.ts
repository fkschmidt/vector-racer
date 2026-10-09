import assert from 'node:assert/strict'
import test from 'node:test'
import { chooseComputerMove } from '../src/computer-player.ts'
import type { Candidate, Racer } from '../src/game.ts'
import { RaceSession } from '../src/race-session.ts'
import { locateOnRoute, TRACKS } from '../src/tracks.ts'
import { oval } from './fixtures.ts'

const racer: Racer = {
  id: 2,
  name: 'PINE',
  color: '#176f68',
  position: { x: 5, y: 5 },
  velocity: { x: 1, y: 0 },
  trail: [],
  progress: locateOnRoute(oval, { x: 5, y: 5 }).progress,
  hasLeftStart: true,
  penaltyTurns: 0,
  recoveryMove: false,
}

test('computer favors a legal move that maintains its heading', () => {
  const candidates: Candidate[] = [
    { point: { x: 5, y: 4 }, kind: 'move' },
    { point: { x: 6, y: 5 }, kind: 'move' },
    { point: { x: 6, y: 4 }, kind: 'crash' },
  ]

  assert.deepEqual(chooseComputerMove(racer, candidates, [], oval)?.point, { x: 6, y: 5 })
})

test('computer follows the course even when its current heading points backward', () => {
  const backwardHeadingRacer = {
    ...racer,
    position: { x: 15, y: 3 },
    progress: locateOnRoute(oval, { x: 15, y: 3 }).progress,
    velocity: { x: -1, y: 0 },
  }
  const candidates: Candidate[] = [
    { point: { x: 16, y: 3 }, kind: 'move' },
    { point: { x: 14, y: 3 }, kind: 'move' },
  ]

  assert.deepEqual(
    chooseComputerMove(backwardHeadingRacer, candidates, [], oval)?.point,
    { x: 16, y: 3 },
  )
})

test('computer takes an available finish-line win immediately', () => {
  const racerNearFinish = {
    ...racer,
    position: { x: 5, y: 12 },
    progress: locateOnRoute(oval, { x: 5, y: 12 }).progress,
    velocity: { x: 0, y: -1 },
    hasLeftStart: true,
  }
  const candidates: Candidate[] = [
    { point: { x: 6, y: 12 }, kind: 'move' },
    { point: { x: 5, y: 10 }, kind: 'move' },
  ]

  assert.deepEqual(chooseComputerMove(racerNearFinish, candidates, [], oval)?.point, { x: 5, y: 10 })
})

test('computer crashes only when no legal moves are available', () => {
  const candidates: Candidate[] = [
    { point: { x: 5, y: 4 }, kind: 'blocked' },
    { point: { x: 6, y: 4 }, kind: 'crash' },
  ]

  assert.deepEqual(chooseComputerMove(racer, candidates, [], oval), candidates[1])
  assert.equal(chooseComputerMove(racer, [candidates[0]], [], oval), null)
})

function driveComputerLap(track: (typeof TRACKS)[number], turnLimit: number) {
  const session = new RaceSession(2, track)
  const [first, second] = track.startLine.positions
  session.selectPoint(first.point)
  session.selectPoint(second.point)
  const computer = session.state.racers[1]
  const startProgress = computer.progress
  let crashes = 0

  for (let turn = 0; turn < turnLimit && session.state.phase === 'racing'; turn += 1) {
    const state = session.state
    const racer = state.racers[state.currentIndex]
    const candidates = session.getCandidates()
    const candidate = racer.id === 1
      ? candidates.find(({ kind }) => kind === 'crash') ?? candidates.find(({ kind }) => kind === 'move')
      : chooseComputerMove(racer, candidates, state.racers.filter((other) => other.id !== racer.id), track)

    assert.ok(candidate)
    if (racer.id === 2 && candidate.kind === 'crash') crashes += 1
    assert.equal(session.selectPoint(candidate.point), true)
  }

  return { session, crashes, distance: session.state.racers[1].progress - startProgress }
}

function lapLength(track: (typeof TRACKS)[number]): number {
  return track.directionPath.reduce((length, point, index, path) => {
    const next = path[(index + 1) % path.length]
    return length + Math.hypot(next.x - point.x, next.y - point.y)
  }, 0)
}

test('computer follows the oval to the finish without crashing', () => {
  const { session, crashes } = driveComputerLap(oval, 60)
  assert.equal(session.state.phase, 'finished')
  assert.equal(session.state.winnerId, 2)
  assert.equal(crashes, 0)
})

for (const track of TRACKS) {
  test(`computer drives a full forward lap of ${track.name} without crashing`, () => {
    const { session, crashes, distance } = driveComputerLap(track, 400)
    assert.equal(session.state.phase, 'finished')
    assert.equal(session.state.winnerId, 2)
    assert.equal(crashes, 0)
    assert.ok(distance > lapLength(track) * .95, `drove ${distance} of ${lapLength(track)}`)
  })
}
