import { locateOnRoute, TRACKS, type Point, type Track } from './tracks.ts'

export type { Point, Track }

export type Racer = {
  id: number
  name: string
  color: string
  position: Point
  velocity: Point
  trail: Array<{ from: Point; to: Point }>
  // Distance driven along the racing route; keeps counting across laps.
  progress: number
  hasLeftStart: boolean
  penaltyTurns: number
  recoveryMove: boolean
}

export type Candidate = {
  point: Point
  kind: 'move' | 'crash' | 'blocked'
}

const BRIDGE_TRACK_STEP = .1
const BORDER_CHECK_STEP = .25
const DRIVER_COLORS = ['#d5533d', '#176f68', '#df9b18', '#4d69a7']
const DRIVER_NAMES = ['CORAL', 'PINE', 'CITRON', 'INK']

export function createRacers(count: number, track: Track = TRACKS[0]): Racer[] {
  return Array.from({ length: count }, (_, index) => {
    const startingPosition = track.startLine.positions[index % track.startLine.positions.length]
    const position = { ...startingPosition.point }
    const velocity = { ...startingPosition.direction }
    return {
      id: index + 1,
      name: DRIVER_NAMES[index],
      color: DRIVER_COLORS[index],
      position,
      velocity,
      trail: [{ from: { x: position.x - velocity.x, y: position.y - velocity.y }, to: { ...position } }],
      progress: locateOnRoute(track, position).progress,
      hasLeftStart: false,
      penaltyTurns: 0,
      recoveryMove: false,
    }
  })
}

export function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]
    const b = polygon[j]
    const crossesY = (a.y > point.y) !== (b.y > point.y)
    if (crossesY && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside
    }
  }
  return inside
}

function cross(a: Point, b: Point, c: Point): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
}

function pointOnSegment(point: Point, start: Point, end: Point): boolean {
  const epsilon = 1e-8
  return Math.abs(cross(start, end, point)) < epsilon
    && point.x >= Math.min(start.x, end.x) - epsilon
    && point.x <= Math.max(start.x, end.x) + epsilon
    && point.y >= Math.min(start.y, end.y) - epsilon
    && point.y <= Math.max(start.y, end.y) + epsilon
}

function segmentsIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
  const abC = cross(a, b, c)
  const abD = cross(a, b, d)
  const cdA = cross(c, d, a)
  const cdB = cross(c, d, b)
  const epsilon = 1e-8

  if (Math.abs(abC) < epsilon && pointOnSegment(c, a, b)) return true
  if (Math.abs(abD) < epsilon && pointOnSegment(d, a, b)) return true
  if (Math.abs(cdA) < epsilon && pointOnSegment(a, c, d)) return true
  if (Math.abs(cdB) < epsilon && pointOnSegment(b, c, d)) return true
  return (abC > 0) !== (abD > 0) && (cdA > 0) !== (cdB > 0)
}

function crossesThrough(a: Point, b: Point, c: Point, d: Point): boolean {
  const epsilon = 1e-8
  const abC = cross(a, b, c)
  const abD = cross(a, b, d)
  const cdA = cross(c, d, a)
  const cdB = cross(c, d, b)
  if ([abC, abD, cdA, cdB].some((side) => Math.abs(side) < epsilon)) return false
  return (abC > 0) !== (abD > 0) && (cdA > 0) !== (cdB > 0)
}

function touchesBoundary(point: Point, polygon: Point[]): boolean {
  return polygon.some((edgeStart, index) => pointOnSegment(
    point,
    edgeStart,
    polygon[(index + 1) % polygon.length],
  ))
}

// Tracks with a bridge overlap themselves, so only the stretch of road around the racer counts.
function isOnNearbyRoad(point: Point, track: Track, progress?: number): boolean {
  return locateOnRoute(track, point, progress).distance <= track.halfWidth + 1e-6
}

export function isOnTrack(point: Point, track: Track = TRACKS[0], progress?: number): boolean {
  if (track.bridge) return isOnNearbyRoad(point, track, progress)

  const onOuterBoundary = touchesBoundary(point, track.outer)
  const onInnerBoundary = touchesBoundary(point, track.inner)
  const withinOuterBoundary = onOuterBoundary || pointInPolygon(point, track.outer)
  const outsideInnerBoundary = onInnerBoundary || !pointInPolygon(point, track.inner)
  return withinOuterBoundary && outsideInnerBoundary
}

export function isOnStartLine(point: Point, track: Track = TRACKS[0]): boolean {
  return pointOnSegment(point, track.startLine.start, track.startLine.end)
}

export function isLegalTrackSegment(
  from: Point,
  to: Point,
  track: Track = TRACKS[0],
  progress?: number,
): boolean {
  if (track.bridge) {
    const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / BRIDGE_TRACK_STEP))
    for (let step = 0; step <= steps; step += 1) {
      const point = { x: from.x + ((to.x - from.x) * step) / steps, y: from.y + ((to.y - from.y) * step) / steps }
      if (!isOnNearbyRoad(point, track, progress)) return false
    }
    return true
  }

  if (!isOnTrack(from, track) || !isOnTrack(to, track)) return false

  for (const polygon of [track.outer, track.inner]) {
    for (let i = 0; i < polygon.length; i += 1) {
      if (crossesThrough(from, to, polygon[i], polygon[(i + 1) % polygon.length])) return false
    }
  }

  // A move may run along a border or graze a corner, as long as it never leaves the road.
  const steps = Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / BORDER_CHECK_STEP)
  for (let step = 1; step < steps; step += 1) {
    const point = { x: from.x + ((to.x - from.x) * step) / steps, y: from.y + ((to.y - from.y) * step) / steps }
    if (!isOnTrack(point, track)) return false
  }

  return true
}

export function crossesFinishLine(from: Point, to: Point, track: Track = TRACKS[0]): boolean {
  const { start, end, direction } = track.startLine
  const move = { x: to.x - from.x, y: to.y - from.y }
  const forwardDot = move.x * direction.x + move.y * direction.y
  const directionSide = cross(start, end, { x: start.x + direction.x, y: start.y + direction.y })
  const fromSide = cross(start, end, from)
  const toSide = cross(start, end, to)

  if (forwardDot <= 0 || directionSide === 0) return false
  if (directionSide < 0 ? fromSide <= 0 || toSide > 0 : fromSide >= 0 || toSide < 0) return false
  return segmentsIntersect(from, to, start, end)
}

export function hasLeftStartAfterMove(
  hasLeftStart: boolean,
  from: Point,
  to: Point,
  track: Track = TRACKS[0],
): boolean {
  const { start, end, direction } = track.startLine
  const forwardDot = (to.x - from.x) * direction.x + (to.y - from.y) * direction.y
  if (forwardDot < 0 && segmentsIntersect(from, to, start, end)) return false

  const directionSide = cross(start, end, { x: start.x + direction.x, y: start.y + direction.y })
  const aheadOfLine = cross(start, end, to) * directionSide > 0
  return hasLeftStart || aheadOfLine
}

export function getCandidates(racer: Racer, otherRacers: Racer[], track: Track = TRACKS[0]): Candidate[] {
  const offsets = racer.recoveryMove
    ? Array.from({ length: 9 }, (_, index) => ({ x: index % 3 - 1, y: Math.floor(index / 3) - 1 }))
      .filter((offset) => offset.x !== 0 || offset.y !== 0)
    : Array.from({ length: 9 }, (_, index) => ({ x: index % 3 - 1, y: Math.floor(index / 3) - 1 }))

  const projected = racer.recoveryMove
    ? racer.position
    : { x: racer.position.x + racer.velocity.x, y: racer.position.y + racer.velocity.y }

  return offsets.map((offset) => {
    const point = { x: projected.x + offset.x, y: projected.y + offset.y }
    const occupied = otherRacers.some((other) => other.position.x === point.x && other.position.y === point.y)
    const unchanged = point.x === racer.position.x && point.y === racer.position.y

    if (occupied || unchanged) return { point, kind: 'blocked' }
    if (!isLegalTrackSegment(racer.position, point, track, racer.progress)) return { point, kind: 'crash' }
    return { point, kind: 'move' }
  })
}
