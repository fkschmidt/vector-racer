import type { Track } from '../src/tracks.ts'

const outer = [
  { x: 3, y: 11 }, { x: 4, y: 7 }, { x: 7, y: 4 }, { x: 11, y: 2 },
  { x: 17, y: 1 }, { x: 23, y: 2 }, { x: 28, y: 4 }, { x: 31, y: 7 },
  { x: 32, y: 11 }, { x: 31, y: 15 }, { x: 28, y: 18 }, { x: 23, y: 20 },
  { x: 17, y: 21 }, { x: 11, y: 20 }, { x: 7, y: 18 }, { x: 4, y: 15 },
]

const inner = [
  { x: 9, y: 11 }, { x: 10, y: 9 }, { x: 12, y: 7 }, { x: 15, y: 6 },
  { x: 19, y: 6 }, { x: 22, y: 7 }, { x: 25, y: 9 }, { x: 26, y: 11 },
  { x: 25, y: 13 }, { x: 22, y: 15 }, { x: 19, y: 16 }, { x: 15, y: 16 },
  { x: 12, y: 15 }, { x: 10, y: 13 },
]

// A plain clockwise oval, used to test the rules independently of the real circuits.
export const oval: Track = {
  id: 'oval',
  name: 'TEST OVAL',
  outer,
  inner,
  directionPath: outer,
  halfWidth: 3,
  startLine: {
    start: { x: 3, y: 11 },
    end: { x: 9, y: 11 },
    direction: { x: 0, y: -1 },
    positions: [
      { point: { x: 3, y: 11 }, direction: { x: 1, y: -1 } },
      { point: { x: 4, y: 11 }, direction: { x: 0, y: -1 } },
      { point: { x: 5, y: 11 }, direction: { x: 0, y: -1 } },
      { point: { x: 6, y: 11 }, direction: { x: 0, y: -1 } },
      { point: { x: 7, y: 11 }, direction: { x: 0, y: -1 } },
      { point: { x: 8, y: 11 }, direction: { x: 0, y: -1 } },
      { point: { x: 9, y: 11 }, direction: { x: -1, y: -1 } },
    ],
  },
}
