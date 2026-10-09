import { crossesFinishLine, getCandidates, type Candidate, type Racer } from './game.ts'
import { locateOnRoute, type Point, type Track } from './tracks.ts'

function afterMove(racer: Racer, point: Point, track: Track): Racer {
  return {
    ...racer,
    progress: locateOnRoute(track, point, racer.progress).progress,
    position: point,
    velocity: { x: point.x - racer.position.x, y: point.y - racer.position.y },
    recoveryMove: false,
  }
}

function countSafeRunways(racer: Racer, candidate: Candidate, otherRacers: Racer[], track: Track): number {
  const nextRacer = afterMove(racer, candidate.point, track)
  const followups = getCandidates(nextRacer, otherRacers, track).filter(({ kind }) => kind === 'move')
  let safeRunways = 0

  for (const followup of followups) {
    const nextNextRacer = afterMove(nextRacer, followup.point, track)
    const exits = getCandidates(nextNextRacer, otherRacers, track).filter(({ kind }) => kind === 'move')
    if (exits.length > 0) safeRunways += 1
  }

  return safeRunways
}

function countSafeFollowups(racer: Racer, candidate: Candidate, otherRacers: Racer[], track: Track): number {
  const nextRacer = afterMove(racer, candidate.point, track)
  return getCandidates(nextRacer, otherRacers, track).filter(({ kind }) => kind === 'move').length
}

function scoreMove(
  racer: Racer,
  candidate: Candidate,
  safeFollowups: number,
  safeRunways: number,
  track: Track,
): number {
  const velocity = {
    x: candidate.point.x - racer.position.x,
    y: candidate.point.y - racer.position.y,
  }
  const speed = Math.hypot(velocity.x, velocity.y)
  const previousSpeed = Math.hypot(racer.velocity.x, racer.velocity.y)
  const alignment = previousSpeed === 0 || speed === 0
    ? 0
    : (velocity.x * racer.velocity.x + velocity.y * racer.velocity.y) / (speed * previousSpeed)
  const distanceGain = locateOnRoute(track, candidate.point, racer.progress).progress - racer.progress
  const flexibilityBonus = Math.min(safeFollowups, 5) * .55
  const deadEndPenalty = safeFollowups === 0 ? 8 : safeFollowups === 1 ? 1 : 0
  const overspeedPenalty = Math.max(0, speed - 3) * Math.max(0, 4 - safeFollowups) * .8
  const runwayBonus = Math.min(safeRunways, 4) * .6
  const runwayPenalty = safeRunways === 0 ? 10 : safeRunways === 1 ? 1.5 : 0

  return distanceGain * 4 + alignment * .2 + flexibilityBonus + runwayBonus
    - deadEndPenalty - overspeedPenalty - runwayPenalty
}

export function chooseComputerMove(
  racer: Racer,
  candidates: Candidate[],
  otherRacers: Racer[],
  track: Track,
): Candidate | null {
  const legalMoves = candidates.filter(({ kind }) => kind === 'move')
  const winningMove = racer.hasLeftStart && legalMoves.find(({ point }) => crossesFinishLine(racer.position, point, track))
  if (winningMove) return winningMove

  if (legalMoves.length > 0) {
    const ratedMoves = legalMoves.map((candidate) => ({
      candidate,
      safeFollowups: countSafeFollowups(racer, candidate, otherRacers, track),
      safeRunways: countSafeRunways(racer, candidate, otherRacers, track),
    }))
    const movesWithRunway = ratedMoves.filter(({ safeRunways }) => safeRunways > 0)
    const bestRunwayCount = Math.max(...ratedMoves.map(({ safeRunways }) => safeRunways))
    const runwayThreshold = Math.max(1, Math.ceil(bestRunwayCount * .65))
    const flexibleMoves = movesWithRunway.filter(({ safeRunways }) => safeRunways >= runwayThreshold)
    const choices = flexibleMoves.length > 0
      ? flexibleMoves
      : movesWithRunway.length > 0
        ? movesWithRunway
        : ratedMoves.filter(({ safeFollowups }) => safeFollowups > 0).length > 0
          ? ratedMoves.filter(({ safeFollowups }) => safeFollowups > 0)
          : ratedMoves

    return choices.reduce((best, choice) => (
      scoreMove(racer, choice.candidate, choice.safeFollowups, choice.safeRunways, track)
        > scoreMove(racer, best.candidate, best.safeFollowups, best.safeRunways, track)
        ? choice
        : best
    )).candidate
  }

  return candidates.find(({ kind }) => kind === 'crash') ?? null
}
