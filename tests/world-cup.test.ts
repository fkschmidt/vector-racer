import assert from 'node:assert/strict'
import test from 'node:test'
import { WorldCup } from '../src/world-cup.ts'
import { TRACKS } from '../src/tracks.ts'

test('a loss retries the current track without advancing', () => {
  const cup = new WorldCup()
  cup.recordResult(false)

  assert.equal(cup.stage, 'retry')
  assert.equal(cup.currentTrack.id, TRACKS[0].id)
  cup.continue()
  assert.equal(cup.stage, 'racing')
  assert.equal(cup.raceNumber, 1)
})

test('wins unlock tracks in order and the final win crowns a champion', () => {
  const cup = new WorldCup()
  assert.equal(cup.totalRaces, TRACKS.length)

  for (let index = 0; index < TRACKS.length - 1; index += 1) {
    cup.recordResult(true)
    assert.equal(cup.stage, 'advance')
    assert.equal(cup.nextTrack?.id, TRACKS[index + 1].id)
    cup.continue()
    assert.equal(cup.currentTrack.id, TRACKS[index + 1].id)
  }

  cup.recordResult(true)
  assert.equal(cup.stage, 'champion')
  assert.equal(cup.nextTrack, null)
})
