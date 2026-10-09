import type { Point, Track } from './tracks.ts'

export type TrackBlueprint = {
  id: string
  name: string
  // Centerline waypoints in race order; a smooth curve is drawn through them.
  waypoints: Array<[number, number]>
  startLine: { start: Point; end: Point; direction: Point }
  // Waypoint index range of the stretch that passes over the rest of the track.
  bridge?: { from: number; to: number }
}

export const TRACK_HALF_WIDTH = 1.5
const SAMPLES_PER_WAYPOINT = 4
const MITER_LIMIT = 1.6
const MAX_FOLD_EDGES = SAMPLES_PER_WAYPOINT * 4

function splinePoint(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const blend = (a: number, b: number, c: number, d: number) => .5 * (
    2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t
  )
  return { x: blend(p0.x, p1.x, p2.x, p3.x), y: blend(p0.y, p1.y, p2.y, p3.y) }
}

function smoothClosedPath(waypoints: Point[]): Point[] {
  const count = waypoints.length
  return waypoints.flatMap((point, index) => {
    const before = waypoints[(index + count - 1) % count]
    const next = waypoints[(index + 1) % count]
    const afterNext = waypoints[(index + 2) % count]
    return Array.from({ length: SAMPLES_PER_WAYPOINT }, (_, sample) => (
      sample === 0 ? point : splinePoint(before, point, next, afterNext, sample / SAMPLES_PER_WAYPOINT)
    ))
  })
}

function sideNormal(from: Point, to: Point): Point {
  const length = Math.hypot(to.x - from.x, to.y - from.y)
  return { x: -(to.y - from.y) / length, y: (to.x - from.x) / length }
}

// Positive distances shift to the right of the direction of travel.
function offsetPath(path: Point[], distance: number, closed: boolean): Point[] {
  const count = path.length
  return path.map((point, index) => {
    const hasBefore = closed || index > 0
    const hasAfter = closed || index < count - 1
    const before = path[(index + count - 1) % count]
    const after = path[(index + 1) % count]
    const first = hasBefore ? sideNormal(before, point) : sideNormal(point, after)
    const second = hasAfter ? sideNormal(point, after) : first
    const miterLength = Math.hypot(first.x + second.x, first.y + second.y)
    const miter = { x: (first.x + second.x) / miterLength, y: (first.y + second.y) / miterLength }
    const stretch = Math.min(1 / (miter.x * first.x + miter.y * first.y), MITER_LIMIT)
    return { x: point.x + miter.x * distance * stretch, y: point.y + miter.y * distance * stretch }
  })
}

// Offsetting the inside of a tight corner folds the border over itself; cut those folds off.
function removeFolds(polygon: Point[]): Point[] {
  const result = polygon.slice()
  for (let pass = 0; pass < polygon.length; pass += 1) {
    const count = result.length
    let folded = false

    search: for (let index = 0; index < count; index += 1) {
      for (let span = 2; span < MAX_FOLD_EDGES; span += 1) {
        const other = (index + span) % count
        const a = result[index]
        const b = result[(index + 1) % count]
        const c = result[other]
        const d = result[(other + 1) % count]
        const denominator = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x)
        if (Math.abs(denominator) < 1e-9) continue
        const t = ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / denominator
        const u = ((c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x)) / denominator
        if (t <= 0 || t >= 1 || u <= 0 || u >= 1) continue

        const crossing = { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) }
        const foldIndexes = Array.from({ length: span }, (_, step) => (index + 1 + step) % count)
        const insertAt = foldIndexes[0] - foldIndexes.filter((foldIndex) => foldIndex < foldIndexes[0]).length
        for (const foldIndex of foldIndexes.sort((first, second) => second - first)) result.splice(foldIndex, 1)
        result.splice(insertAt, 0, crossing)
        folded = true
        break search
      }
    }

    if (!folded) break
  }
  return result
}

function gridPointsBetween(start: Point, end: Point): Point[] {
  const steps = Math.max(Math.abs(end.x - start.x), Math.abs(end.y - start.y))
  return Array.from({ length: steps + 1 }, (_, step) => ({
    x: start.x + ((end.x - start.x) * step) / steps,
    y: start.y + ((end.y - start.y) * step) / steps,
  }))
}

function enclosedArea(polygon: Point[]): number {
  return Math.abs(polygon.reduce((area, point, index) => {
    const next = polygon[(index + 1) % polygon.length]
    return area + point.x * next.y - next.x * point.y
  }, 0))
}

export function buildTrack(blueprint: TrackBlueprint): Track {
  const waypoints = blueprint.waypoints.map(([x, y]) => ({ x, y }))
  const directionPath = smoothClosedPath(waypoints)
  const { start, end, direction } = blueprint.startLine
  // Which side of the road faces the infield depends on the direction of travel.
  const borders = [-TRACK_HALF_WIDTH, TRACK_HALF_WIDTH]
    .map((distance) => removeFolds(offsetPath(directionPath, distance, true)))
    .sort((first, second) => enclosedArea(second) - enclosedArea(first))
  const track: Track = {
    id: blueprint.id,
    name: blueprint.name,
    outer: borders[0],
    inner: borders[1],
    directionPath,
    halfWidth: TRACK_HALF_WIDTH,
    startLine: {
      start,
      end,
      direction,
      positions: gridPointsBetween(start, end).map((point) => ({ point, direction })),
    },
  }

  if (blueprint.bridge) {
    const path = directionPath.slice(
      blueprint.bridge.from * SAMPLES_PER_WAYPOINT,
      blueprint.bridge.to * SAMPLES_PER_WAYPOINT + 1,
    )
    track.bridge = {
      path,
      edges: [offsetPath(path, -TRACK_HALF_WIDTH, false), offsetPath(path, TRACK_HALF_WIDTH, false)],
    }
  }

  return track
}
