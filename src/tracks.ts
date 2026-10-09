import { buildTrack, type TrackBlueprint } from './track-builder.ts'

export type Point = { x: number; y: number }

export type Track = {
  id: string
  name: string
  outer: Point[]
  inner: Point[]
  directionPath: Point[]
  halfWidth: number
  startLine: {
    start: Point
    end: Point
    direction: Point
    positions: Array<{ point: Point; direction: Point }>
  }
  // A stretch that passes over another part of the track instead of joining it.
  bridge?: { path: Point[]; edges: Point[][] }
}

export const BOARD = { width: 34, height: 23 }

const redBullRing: TrackBlueprint = {
  id: 'red-bull-ring',
  name: 'RED BULL RING',
  waypoints: [
    [3.5, 17], [3.5, 15], [3.5, 13], [3.5, 11], [3.5, 9],
    [3.8, 7], [5, 5.4], [7, 4.6], [12, 4], [18, 3.4], [24, 2.9], [28, 2.6],
    [30.5, 2.6], [31.8, 4], [31, 5.8], [28.5, 6.8], [24, 8], [20, 9], [16.5, 9.4], [13, 9.4],
    [10.5, 9.6], [8.4, 10.4], [7.5, 12], [8.3, 13.8], [10.2, 14.5], [13, 14.4], [16, 14],
    [18.5, 14.2], [20.3, 15.4], [20.6, 17.4], [19.2, 19], [17, 19.7],
    [13, 19.8], [9, 19.8], [6.5, 19.8], [4.6, 19.2],
  ],
  startLine: { start: { x: 2, y: 13 }, end: { x: 5, y: 13 }, direction: { x: 0, y: -1 } },
}

const monza: TrackBlueprint = {
  id: 'monza',
  name: 'MONZA',
  waypoints: [
    [22, 19.5], [20, 19.5], [18, 19.5], [16, 19.5], [14, 19.5], [11, 19.5], [8.5, 19.5],
    [7.2, 19.2], [6, 17.8], [4.6, 17.2], [3, 15.8], [2.4, 13.5], [3, 11], [4.5, 9],
    [5.5, 7.6], [5.6, 6], [6.8, 4.8], [8.3, 3.3], [10.5, 2.6], [12.8, 3], [14.3, 4.5],
    [15, 6.5], [15.8, 8.5], [16.3, 10.2], [18, 11], [19.6, 12.2], [21.5, 12.6],
    [25, 12.6], [28, 12.8], [30.6, 13.8], [31.9, 16], [30.8, 18.5], [28.5, 19.5], [25, 19.5],
  ],
  startLine: { start: { x: 18, y: 18 }, end: { x: 18, y: 21 }, direction: { x: -1, y: 0 } },
}

const interlagos: TrackBlueprint = {
  id: 'interlagos',
  name: 'INTERLAGOS',
  waypoints: [
    [30.5, 16], [30.5, 14], [30.5, 12], [30.5, 10], [30.5, 8],
    [30.3, 6.2], [29.2, 4.6], [27.4, 4.4], [25.8, 3.4], [23.5, 2.7],
    [19, 2.6], [14, 2.6], [9, 2.7], [6.2, 3], [4, 3.8], [2.7, 5.6], [3, 7.6], [4.8, 8.6],
    [7.5, 8.6], [11, 8], [15, 7.4], [19, 7], [22, 7], [24.2, 7.8], [25.2, 9.6], [24.4, 11.4], [22.2, 12],
    [19, 11.8], [16, 11.6], [13.6, 11.8], [12.2, 13], [12, 15], [10.8, 16.4], [8.6, 16.2], [6.4, 16],
    [4.4, 16.2], [3, 17.4], [3.2, 19.4], [5, 20.4], [7.5, 20.6],
    [12, 20.6], [18, 20.6], [24, 20.4], [27.6, 19.6], [29.8, 18],
  ],
  startLine: { start: { x: 29, y: 12 }, end: { x: 32, y: 12 }, direction: { x: 0, y: -1 } },
}

const imola: TrackBlueprint = {
  id: 'imola',
  name: 'IMOLA',
  waypoints: [
    [25, 5.5], [23, 5.5], [21, 5.5], [19, 5.5], [17, 5.5],
    [15, 5.6], [13.4, 6.6], [11.8, 6.2], [10.2, 7], [8.4, 7], [7, 7.8], [5.6, 7.6],
    [3.8, 8.2], [2.6, 9.8], [3.2, 11.8], [5.2, 12.6], [7.6, 13], [9.6, 14.2],
    [11.2, 15.4], [13.2, 16], [15.2, 15.4], [17, 15], [18.6, 16], [19.4, 17.8],
    [20.6, 19.4], [22.6, 19.8], [24.6, 19.2], [26, 18.4], [27.6, 18.8], [29, 17.8],
    [30.8, 16.4], [31.8, 14.2], [31.6, 11.6], [31, 9], [29.6, 6.8], [27.4, 5.6],
  ],
  startLine: { start: { x: 21, y: 4 }, end: { x: 21, y: 7 }, direction: { x: -1, y: 0 } },
}

const hockenheim: TrackBlueprint = {
  id: 'hockenheim',
  name: 'HOCKENHEIM',
  waypoints: [
    [3.5, 18], [3.5, 16], [3.5, 14], [3.5, 12], [3.5, 10],
    [4.2, 8], [5.8, 6.2], [7.8, 4.3],
    [9.6, 2.9], [11.4, 2.4], [12.8, 3.4], [12.9, 5.2], [13.4, 6.8],
    [15, 7.8], [18, 8.2], [21.5, 7.4], [24.5, 5.6], [27, 3.6],
    [30, 2.7], [31.9, 4.6], [30, 6.5],
    [27.8, 7.6], [26.3, 9.8], [24.5, 11.6], [21.5, 12],
    [19.4, 12.3], [18.7, 13.8], [19, 15.5],
    [17.7, 17.5], [16.5, 19.3], [15, 20.2], [13.6, 19.3],
    [12.8, 17.3], [11.9, 15.2], [11.4, 13.5], [9.7, 12.4], [8, 13.4], [7.6, 15], [7.6, 17], [7.6, 18.8],
    [7, 20.2], [5.55, 20.8], [4.1, 20.2], [3.5, 19],
  ],
  startLine: { start: { x: 2, y: 14 }, end: { x: 5, y: 14 }, direction: { x: 0, y: -1 } },
}

const silverstone: TrackBlueprint = {
  id: 'silverstone',
  name: 'SILVERSTONE',
  waypoints: [
    [23, 19.5], [21, 19.5], [19, 19.5], [17, 19.5], [15, 19.5],
    [13, 19.1], [11.6, 17.6], [11.2, 15.8], [11.8, 14], [13.4, 13.2], [15.2, 13.3],
    [16.8, 12.6], [17.2, 10.8], [16, 9.4], [14, 9], [11.5, 9.2], [9, 9.6], [7.6, 10.2],
    [6.6, 11.4], [6.2, 13], [5.4, 14.6], [4, 15.3], [2.7, 14.6], [2.2, 13], [2.3, 11],
    [2.8, 9], [3.8, 7], [5.2, 5], [6.8, 3.4], [8.6, 2.6], [11, 2.6], [14, 2.8],
    [16.5, 2.4], [18.5, 3.4], [20.5, 2.8], [22.5, 4], [24.3, 4],
    [27, 5.5], [29.5, 8], [31, 11], [31.8, 13.5], [31, 15.8], [29, 16.6],
    [26.8, 16.5], [25.3, 17.2], [24.6, 18.6],
  ],
  startLine: { start: { x: 19, y: 18 }, end: { x: 19, y: 21 }, direction: { x: -1, y: 0 } },
}

const hungaroring: TrackBlueprint = {
  id: 'hungaroring',
  name: 'HUNGARORING',
  waypoints: [
    [20, 19.5], [18, 19.5], [16, 19.5], [14, 19.5], [12, 19.5], [9, 19.5], [6, 19.5],
    [4, 19], [2.6, 17.4], [3.2, 15.6], [5.2, 15], [8, 15.2], [10, 15.4],
    [11.8, 14.8], [12.4, 13], [11.4, 11.4], [9.4, 11], [7.2, 10.6], [5.8, 9.4], [5.4, 7.6], [6.2, 5.8],
    [7.6, 4], [9.6, 2.8], [12, 2.6], [14.5, 2.8], [16.2, 3.8], [18, 4.2], [20, 4.2],
    [21.8, 3.4], [23.6, 3], [25.2, 4], [27, 5.4], [28.6, 6], [30.2, 7.4], [30.6, 9.4],
    [30, 11.4], [28, 12], [25.8, 12.2], [24.4, 13.6], [24.8, 15.4], [26.6, 16],
    [29, 15.8], [31, 16.6], [31.6, 18.2], [30.4, 19.4], [28, 19.6], [24, 19.5],
  ],
  startLine: { start: { x: 16, y: 18 }, end: { x: 16, y: 21 }, direction: { x: -1, y: 0 } },
}

const spa: TrackBlueprint = {
  id: 'spa',
  name: 'SPA-FRANCORCHAMPS',
  waypoints: [
    [12.2, 8.5], [11, 8.5], [10, 8.5], [9, 8.5], [8, 8.5], [7, 8.5], [5.5, 8.5],
    [4, 8.3], [2.6, 7], [2.8, 5.2], [4.5, 4.4], [7, 4.4],
    [9, 4.5], [10.6, 3.5], [12.2, 4.1], [13.8, 3.3], [16, 3], [20, 2.8], [24, 2.8],
    [25.8, 3.1], [27.2, 4.3], [28.8, 4.2], [30.5, 5], [31.5, 6.8], [31.6, 9], [30.6, 10.9],
    [28.5, 11.6], [26.5, 11.4], [24.8, 12.2], [24.2, 13.8], [24.6, 15.6], [26, 16.6], [28, 16.6],
    [29.5, 17], [30.8, 17.6], [32, 19.2], [31.4, 20.4], [30, 20.8], [27.5, 20.8],
    [24, 20.6], [20, 19.8], [16.5, 18], [14.5, 15.5], [14.1, 13.4], [15.2, 11.6], [15, 9.6], [13.6, 8.6],
  ],
  startLine: { start: { x: 9, y: 7 }, end: { x: 9, y: 10 }, direction: { x: -1, y: 0 } },
}

const montreal: TrackBlueprint = {
  id: 'montreal',
  name: 'MONTREAL',
  waypoints: [
    [13, 16.5], [12, 16.5], [11, 16.5], [10, 16.5], [9, 16.5], [8, 16.5],
    [6.4, 17], [5.2, 18.2], [3.8, 18.6], [2.6, 17.4], [2.4, 15.4], [3.4, 13.6], [5.4, 12.6],
    [7.6, 12], [9.4, 12.6], [11.2, 12.2], [13.5, 11], [16, 10.4], [18, 10.6], [19.6, 9.4], [21.6, 9.2],
    [24.5, 9.6], [26, 10.4], [27.4, 11.6], [29, 11.4], [30.6, 12], [32, 13.4], [32, 15.8], [30.6, 17.6],
    [28, 18], [24, 18.2], [20, 18.2], [17.4, 18], [15.8, 17.4], [14.6, 16.7],
  ],
  startLine: { start: { x: 11, y: 15 }, end: { x: 11, y: 18 }, direction: { x: -1, y: 0 } },
}

const monaco: TrackBlueprint = {
  id: 'monaco',
  name: 'MONACO',
  waypoints: [
    [3.5, 15], [3.5, 13], [3.5, 11], [3.5, 9], [3.5, 7],
    [4, 5], [5.4, 3.6], [7.5, 3], [11, 2.8], [15, 2.8], [18, 3],
    [20.5, 2.6], [22.6, 2.4], [24.4, 3.2], [26.5, 3.6], [29, 4], [31, 5.2], [31.4, 7],
    [30.4, 8.6], [28.4, 9], [26.4, 9], [25, 10.6], [26, 12.6], [28.2, 13.2],
    [30.4, 13.4], [31.6, 14.8], [31.4, 16.6], [29.8, 17.6], [27.4, 17.6],
    [24, 17.2], [20.5, 16.4], [17.5, 15.6], [15.6, 15.6], [14.2, 16.8], [12.4, 17],
    [10, 17.2], [8.4, 17.8], [7.6, 19.2], [6.8, 20.4], [5.4, 20.8], [4.1, 20], [3.5, 18.4], [3.5, 16.8],
  ],
  startLine: { start: { x: 2, y: 11 }, end: { x: 5, y: 11 }, direction: { x: 0, y: -1 } },
}

const suzuka: TrackBlueprint = {
  id: 'suzuka',
  name: 'SUZUKA',
  waypoints: [
    [20, 5.5], [22, 5.5], [24, 5.5], [26, 5.5], [28, 5.5],
    [30, 5.8], [31.6, 7.2], [32, 9.4], [31, 11.4], [29, 12.2],
    [27, 12.2], [25.4, 13.4], [23.6, 13], [22, 14.2], [20.2, 13.8],
    [18.4, 14.6], [16.8, 16.4], [15.6, 18.4], [14.4, 19.8], [12.6, 19.8], [11.4, 18.4], [11, 16.4],
    [11, 14.5], [11, 13], [11, 11.5], [10.8, 9.5], [10, 7.6], [8.8, 5.4], [7.4, 3.6],
    [5.6, 2.9], [3.9, 3.8], [3.4, 5.6], [4.4, 7.2], [4.8, 9.2], [4, 11.2], [2.8, 13], [2.6, 15.2],
    [3.8, 17], [5.6, 16.6], [8, 14.6], [11, 13], [14.2, 11.2], [15.8, 9.6], [16.2, 7.6], [16.8, 6.4], [18, 5.6],
  ],
  startLine: { start: { x: 24, y: 4 }, end: { x: 24, y: 7 }, direction: { x: 1, y: 0 } },
  bridge: { from: 39, to: 41 },
}

export const TRACKS: Track[] = [
  redBullRing, monza, interlagos, imola, hockenheim, silverstone,
  hungaroring, spa, montreal, monaco, suzuka,
].map(buildTrack)

export function getTrack(id: string): Track {
  return TRACKS.find((track) => track.id === id) ?? TRACKS[0]
}

export function getRaceDirection(track: Track): 'clockwise' | 'counterclockwise' | 'figure-eight' {
  if (track.bridge) return 'figure-eight'
  const signedArea = track.directionPath.reduce((area, point, index, points) => {
    const next = points[(index + 1) % points.length]
    return area + point.x * next.y - next.x * point.y
  }, 0)
  return signedArea > 0 ? 'clockwise' : 'counterclockwise'
}

// How far along the lap a racer can be from its last known progress and still be matched to the route.
const PROGRESS_WINDOW = 15

const routeCache = new WeakMap<Track, { offsets: number[]; lapLength: number }>()

function measureRoute(track: Track): { offsets: number[]; lapLength: number } {
  let route = routeCache.get(track)
  if (!route) {
    const offsets: number[] = []
    let lapLength = 0
    track.directionPath.forEach((start, index, path) => {
      const end = path[(index + 1) % path.length]
      offsets.push(lapLength)
      lapLength += Math.hypot(end.x - start.x, end.y - start.y)
    })
    route = { offsets, lapLength }
    routeCache.set(track, route)
  }
  return route
}

// Finds the closest spot on the racing route. With `near`, only the stretch around that
// progress is considered and the returned progress keeps counting past the lap length.
export function locateOnRoute(track: Track, point: Point, near?: number): { progress: number; distance: number } {
  const { offsets, lapLength } = measureRoute(track)
  const path = track.directionPath
  let closest = Number.POSITIVE_INFINITY
  let progress = near ?? 0

  for (let index = 0; index < path.length; index += 1) {
    const start = path[index]
    const end = path[(index + 1) % path.length]
    const dx = end.x - start.x
    const dy = end.y - start.y
    const lengthSquared = dx * dx + dy * dy
    const along = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared))
    let candidate = offsets[index] + along * Math.sqrt(lengthSquared)

    if (near !== undefined) {
      const ahead = (((candidate - near) % lapLength) + lapLength * 1.5) % lapLength - lapLength / 2
      if (Math.abs(ahead) > PROGRESS_WINDOW) continue
      candidate = near + ahead
    }

    const distance = Math.hypot(point.x - start.x - along * dx, point.y - start.y - along * dy)
    if (distance < closest) {
      closest = distance
      progress = candidate
    }
  }

  return { progress, distance: closest }
}
