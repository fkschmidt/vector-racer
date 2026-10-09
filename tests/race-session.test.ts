import assert from 'node:assert/strict'
import test from 'node:test'
import { RaceSession } from '../src/race-session.ts'
import { oval } from './fixtures.ts'

test('players choose distinct start points before the first turn', () => {
  const session = new RaceSession(2, oval)
  assert.equal(session.state.phase, 'setup')
  assert.equal(session.replayFrames.length, 0)
  assert.equal(session.getCandidates().length, 7)

  assert.equal(session.selectPoint({ x: 3, y: 11 }), true)
  assert.equal(session.state.phase, 'setup')
  assert.equal(session.state.setupIndex, 1)
  assert.equal(session.getCandidates().some(({ point, kind }) => point.x === 3 && kind === 'move'), false)
  assert.equal(session.selectPoint({ x: 3, y: 11 }), false)

  assert.equal(session.selectPoint({ x: 9, y: 11 }), true)
  assert.equal(session.state.phase, 'racing')
  assert.equal(session.state.currentIndex, 0)
  assert.deepEqual(session.state.racers.map(({ position }) => position.x), [3, 9])
  assert.equal(session.replayFrames.length, 1)
})

test('crashes keep the racer in place, reset speed, and apply two missed turns', () => {
  const session = new RaceSession(2, oval)
  session.selectPoint({ x: 4, y: 11 })
  session.selectPoint({ x: 8, y: 11 })
  const racer = session.state.racers[0]
  const start = { ...racer.position }
  const crash = session.getCandidates().find(({ kind }) => kind === 'crash')
  assert.ok(crash)

  assert.equal(session.selectPoint(crash.point), true)
  assert.deepEqual(racer.position, start)
  assert.deepEqual(racer.velocity, { x: 0, y: 0 })
  assert.equal(racer.penaltyTurns, 2)
  assert.equal(racer.recoveryMove, true)
  assert.equal(session.state.currentIndex, 1)

  const legalMove = session.getCandidates().find(({ kind }) => kind === 'move')
  assert.ok(legalMove)
  assert.equal(session.selectPoint(legalMove.point), true)
  assert.equal(racer.penaltyTurns, 1)
})

test('both racers can recover after crashing on consecutive turns', () => {
  const session = new RaceSession(2, oval)
  session.selectPoint({ x: 3, y: 11 })
  session.selectPoint({ x: 4, y: 11 })

  for (let crashCount = 0; crashCount < 2; crashCount += 1) {
    const crash = session.getCandidates().find(({ kind }) => kind === 'crash')
    assert.ok(crash)
    assert.equal(session.selectPoint(crash.point), true)
  }

  assert.deepEqual(session.state.racers.map(({ penaltyTurns }) => penaltyTurns), [0, 0])
  assert.equal(session.getCandidates().some(({ kind }) => kind === 'move'), true)
})

test('replay frames preserve the initial grid after later moves', () => {
  const session = new RaceSession(2, oval)
  session.selectPoint({ x: 4, y: 11 })
  session.selectPoint({ x: 8, y: 11 })
  const initialPosition = { ...session.state.racers[0].position }
  const move = session.getCandidates().find(({ kind }) => kind === 'move')
  assert.ok(move)
  session.selectPoint(move.point)

  assert.deepEqual(session.replayFrames[0].racers[0].position, initialPosition)
  assert.equal(session.replayFrames.length, 2)
})


test('reversing over the start line and back does not count as a lap', () => {
  const session = new RaceSession(2, oval)
  session.selectPoint({ x: 5, y: 11 })
  session.selectPoint({ x: 8, y: 11 })

  const route = [{ x: 5, y: 10 }, { x: 6, y: 10 }, { x: 6, y: 11 }, { x: 6, y: 12 }, { x: 5, y: 12 }, { x: 5, y: 11 }, { x: 5, y: 10 }]
  for (const point of route) {
    while (session.state.racers[session.state.currentIndex].id === 2) {
      const candidates = session.getCandidates()
      const candidate = candidates.find(({ kind }) => kind === 'crash') ?? candidates.find(({ kind }) => kind === 'move')
      assert.ok(candidate)
      session.selectPoint(candidate.point)
    }
    assert.equal(session.selectPoint(point), true)
    assert.equal(session.state.phase, 'racing')
  }

  assert.equal(session.state.winnerId, null)
  assert.equal(session.state.racers[0].hasLeftStart, true)
})
