import assert from 'node:assert/strict'
import test from 'node:test'
import { crossesFinishLine, isLegalTrackSegment, isOnStartLine, isOnTrack } from '../src/game.ts'
import { RaceSession } from '../src/race-session.ts'
import { getRaceDirection, locateOnRoute, TRACKS } from '../src/tracks.ts'
import { oval } from './fixtures.ts'

test('track border points can be occupied without crossing the border', () => {
  assert.equal(isOnTrack({ x: 3, y: 11 }, oval), true)
  assert.equal(isLegalTrackSegment({ x: 4, y: 11 }, { x: 3, y: 11 }, oval), true)
  assert.equal(isLegalTrackSegment({ x: 4, y: 11 }, { x: 2, y: 11 }, oval), false)
})

test('a move crossing the infield boundary is illegal', () => {
  assert.equal(isLegalTrackSegment({ x: 8, y: 11 }, { x: 27, y: 11 }, oval), false)
})

test('finish detection requires a forward crossing on the finish line', () => {
  assert.equal(crossesFinishLine({ x: 5, y: 12 }, { x: 5, y: 10 }, oval), true)
  assert.equal(crossesFinishLine({ x: 5, y: 10 }, { x: 5, y: 12 }, oval), false)
  assert.equal(crossesFinishLine({ x: 2, y: 12 }, { x: 2, y: 10 }, oval), false)
})

test('race direction matches each real circuit', () => {
  const special: Record<string, string> = {
    imola: 'counterclockwise',
    interlagos: 'counterclockwise',
    suzuka: 'figure-eight',
  }
  for (const track of TRACKS) {
    assert.equal(getRaceDirection(track), special[track.id] ?? 'clockwise', track.name)
  }
})

test('every circuit fits the board and has a legal four-car start grid', () => {
  for (const track of TRACKS) {
    for (const { x, y } of [...track.outer, ...track.inner]) {
      assert.ok(x >= 0 && x <= 34 && y >= 0 && y <= 23, `${track.name} leaves the board at ${x}, ${y}`)
    }

    const { positions, direction } = track.startLine
    assert.equal(positions.length, 4, track.name)
    for (const { point } of positions) {
      const behind = { x: point.x - direction.x, y: point.y - direction.y }
      const ahead = { x: point.x + direction.x, y: point.y + direction.y }
      assert.equal(isOnTrack(point, track), true, track.name)
      assert.equal(isOnStartLine(point, track), true, track.name)
      assert.equal(crossesFinishLine(behind, ahead, track), true, track.name)
      assert.equal(crossesFinishLine(ahead, behind, track), false, track.name)
    }

    const session = new RaceSession(4, track)
    for (const { point } of positions) assert.equal(session.selectPoint(point), true, track.name)
    assert.equal(session.state.phase, 'racing')
    assert.equal(session.getCandidates().filter(({ kind }) => kind === 'move').length >= 3, true, track.name)
  }
})

test('track borders never cross themselves or each other', () => {
  const side = (a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)

  for (const track of TRACKS.filter(({ bridge }) => !bridge)) {
    const edges = [track.outer, track.inner].flatMap((polygon, ring) => polygon.map((start, index) => ({
      ring, index, count: polygon.length, start, end: polygon[(index + 1) % polygon.length],
    })))

    for (const first of edges) {
      for (const second of edges) {
        const gap = Math.abs(first.index - second.index)
        if (first.ring === second.ring && (gap <= 1 || gap === first.count - 1)) continue
        const crosses = side(first.start, first.end, second.start) * side(first.start, first.end, second.end) < 0
          && side(second.start, second.end, first.start) * side(second.start, second.end, first.end) < 0
        assert.equal(crosses, false, track.name)
      }
    }
  }
})

test('Suzuka keeps the bridge and the road beneath it separate', () => {
  const suzuka = TRACKS.find(({ id }) => id === 'suzuka')!
  const underpass = locateOnRoute(suzuka, { x: 11, y: 16 }).progress
  const bridge = locateOnRoute(suzuka, { x: 8, y: 15 }).progress
  assert.ok(Math.abs(bridge - underpass) > 30)

  // Both roads pass through the crossing itself.
  assert.equal(isLegalTrackSegment({ x: 11, y: 15 }, { x: 11, y: 11 }, suzuka, underpass), true)
  assert.equal(isLegalTrackSegment({ x: 9, y: 14 }, { x: 13, y: 12 }, suzuka, bridge), true)

  // But a car on one road cannot turn onto the other.
  assert.equal(isOnTrack({ x: 13, y: 12 }, suzuka, underpass), false)
  assert.equal(isLegalTrackSegment({ x: 11, y: 13 }, { x: 13, y: 12 }, suzuka, underpass), false)
  assert.equal(isOnTrack({ x: 11, y: 10 }, suzuka, bridge), false)
  assert.equal(isLegalTrackSegment({ x: 11, y: 13 }, { x: 11, y: 10 }, suzuka, bridge), false)
})
