import { TRACKS, type Track } from './tracks.ts'

export type WorldCupStage = 'racing' | 'retry' | 'advance' | 'champion'

export class WorldCup {
  private trackIndex = 0
  private currentStage: WorldCupStage = 'racing'

  get stage(): WorldCupStage {
    return this.currentStage
  }

  get raceNumber(): number {
    return this.trackIndex + 1
  }

  get totalRaces(): number {
    return TRACKS.length
  }

  get currentTrack(): Track {
    return TRACKS[this.trackIndex]
  }

  get nextTrack(): Track | null {
    return TRACKS[this.trackIndex + 1] ?? null
  }

  recordResult(humanWon: boolean): void {
    if (this.currentStage !== 'racing') return
    if (!humanWon) {
      this.currentStage = 'retry'
      return
    }
    this.currentStage = this.trackIndex === TRACKS.length - 1 ? 'champion' : 'advance'
  }

  continue(): void {
    if (this.currentStage === 'advance') this.trackIndex += 1
    if (this.currentStage === 'advance' || this.currentStage === 'retry') {
      this.currentStage = 'racing'
    }
  }

  restart(): void {
    this.trackIndex = 0
    this.currentStage = 'racing'
  }
}
