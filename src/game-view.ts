import { BOARD, TRACKS, getRaceDirection, type Point } from './tracks.ts'
import type { Candidate, Racer } from './game.ts'
import type { OnlineRole, OnlineStage } from './online-race.ts'
import type { RacePhase, RaceState, ReplayFrame } from './race-session.ts'
import type { WorldCupStage } from './world-cup.ts'

export type ReplayDisplay = { frame: ReplayFrame; index: number; total: number } | null
export type ChampionshipDisplay = {
  stage: Exclude<WorldCupStage, 'racing'>
  raceNumber: number
  totalRaces: number
  currentTrack: string
  nextTrack: string | null
} | null

// 'relayed' and 'relay-failed' report on a reply link opened in a tab that is not running the race it belongs to.
export type OnlineDisplay = {
  stage: OnlineStage | 'relayed' | 'relay-failed'
  role: OnlineRole
  link: string | null
  replyRejected: boolean
} | null

export type ViewActions = {
  onSelectPoint(point: Point): void
  onNewRace(): void
  onOpenReplay(): void
  onCloseReplay(): void
  onStepReplay(delta: number): void
  onToggleReplay(): void
  onSeekReplay(index: number): void
  onChampionshipAction(): void
  onSubmitReply(text: string): void
}

const BOARD_EDGE_INSET = .3
const COPIED_NOTICE_TIME = 1600
const NARROW_SCREEN = '(max-width: 680px)'
// Zoomed in, the board shows this many grid units around the points that matter, and never fewer than the minimum.
const ZOOM_MARGIN = 2.5
const ZOOM_MIN_SIZE = 12
const ZOOM_EDGE_OVERHANG = .5
const ZOOM_TIME = 260

type ViewBox = { x: number; y: number; width: number; height: number }
const WHOLE_BOARD: ViewBox = { x: 0, y: 0, width: BOARD.width, height: BOARD.height }

export class GameView {
  private readonly board: SVGSVGElement
  private readonly modeSelect: HTMLSelectElement
  private readonly modeLabel: HTMLSpanElement
  private readonly sessionStatus: HTMLSpanElement
  private readonly trackSelect: HTMLSelectElement
  private readonly trackField: HTMLDivElement
  private readonly playerCountField: HTMLDivElement
  private readonly playerCountSelect: HTMLSelectElement
  private readonly trackName: HTMLSpanElement
  private readonly directionIndicator: HTMLSpanElement
  private readonly directionIcon: HTMLSpanElement
  private readonly directionLabel: HTMLSpanElement
  private readonly roundLabel: HTMLSpanElement
  private readonly turnLabel: HTMLSpanElement
  private readonly activeDriver: HTMLDivElement
  private readonly turnPrompt: HTMLParagraphElement
  private readonly turnBanner: HTMLDivElement
  private readonly turnBannerLabel: HTMLSpanElement
  private readonly turnBannerName: HTMLElement
  private readonly turnBannerCaption: HTMLSpanElement
  private readonly championshipPanel: HTMLDivElement
  private readonly championshipSummary: HTMLParagraphElement
  private readonly championshipButton: HTMLButtonElement
  private readonly onlinePanel: HTMLDivElement
  private readonly onlineSummary: HTMLParagraphElement
  private readonly onlineLinkRow: HTMLDivElement
  private readonly onlineLink: HTMLInputElement
  private readonly onlineCopy: HTMLButtonElement
  private readonly onlineReplyHint: HTMLParagraphElement
  private readonly onlineReplyForm: HTMLFormElement
  private readonly onlineReply: HTMLInputElement
  private readonly onlineError: HTMLParagraphElement
  private readonly driverList: HTMLDivElement
  private readonly eventFeed: HTMLOListElement
  private readonly feedCount: HTMLSpanElement
  private readonly crashLegend: HTMLSpanElement
  private readonly zoomToggle: HTMLButtonElement
  private readonly replayControls: HTMLDivElement
  private readonly replayOpen: HTMLButtonElement
  private readonly replayPrevious: HTMLButtonElement
  private readonly replayToggle: HTMLButtonElement
  private readonly replayNext: HTMLButtonElement
  private readonly replayExit: HTMLButtonElement
  private readonly replayRange: HTMLInputElement
  private readonly replayCount: HTMLOutputElement
  private readonly newRaceButton: HTMLButtonElement
  private actions: ViewActions | null = null
  private copiedTimer: number | null = null
  // Phones start zoomed in, because the whole circuit leaves the move markers too small to tap.
  private zoomed = window.matchMedia(NARROW_SCREEN).matches
  private focusPoints: Point[] | null = null
  private viewBox = WHOLE_BOARD
  private zoomFrame: number | null = null

  constructor(root: HTMLDivElement) {
    const trackOptions = TRACKS.map((track) => `<option value="${track.id}">${track.name}</option>`).join('')

    root.innerHTML = `
      <header class="topbar">
        <a class="brand" href="#" aria-label="Vector Racer home">
          <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
          <span>VECTOR<span class="brand-light">RACER</span></span>
        </a>
        <div class="topbar-status"><span class="live-dot"></span> <span id="session-status">LOCAL SESSION</span></div>
      </header>
      <main class="page-shell">
        <section class="intro-row">
          <div><p class="eyebrow">PAPER GRID / CIRCUIT 01</p><h1>Make your <em>move.</em></h1></div>
          <div class="race-setup">
            <div class="setup-field mode-field"><label for="game-mode">MODE</label><select id="game-mode" aria-label="Game mode"><option value="local">LOCAL</option><option value="cpu">VS CPU</option><option value="championship">CHAMPIONSHIP</option><option value="online">ONLINE</option></select></div>
            <div class="setup-field track-field"><label for="track-select">MAP</label><select id="track-select" aria-label="Choose race map">${trackOptions}</select></div>
            <div class="setup-field player-field"><label for="player-count">DRIVERS</label><select id="player-count" aria-label="Number of drivers"><option value="2" selected>02</option><option value="3">03</option><option value="4">04</option></select></div>
            <button id="new-race" class="new-race" type="button"><span aria-hidden="true">↻</span> New race</button>
            <button id="replay-open" class="replay-open" type="button" disabled>Replay</button>
          </div>
        </section>
        <div class="race-layout">
          <section class="board-column" aria-label="Race track">
            <div class="board-heading">
              <span><i class="signal"></i> <span id="track-name">${TRACKS[0].name}</span></span>
              <span class="board-coordinates">
                <span id="direction-indicator" class="direction-indicator"><span id="direction-icon" class="direction-icon" aria-hidden="true">↻</span><span id="direction-label">CLOCKWISE</span></span>
                <span>GRID 34 × 23</span>
              </span>
            </div>
            <div id="turn-banner" class="turn-banner" aria-live="polite">
              <span class="turn-banner-swatch"></span>
              <div class="turn-banner-copy"><span id="turn-banner-label">STARTING GRID</span><strong id="turn-banner-name"></strong></div>
              <span id="turn-banner-caption" class="turn-banner-caption"></span>
            </div>
            <div id="championship-panel" class="championship-panel" hidden>
              <p id="championship-summary"></p>
              <button id="championship-action" class="new-race" type="button"></button>
            </div>
            <div id="online-panel" class="online-panel" hidden>
              <p id="online-summary"></p>
              <div id="online-link-row" class="online-row">
                <input id="online-link" type="text" readonly aria-label="Link to send" />
                <button id="online-copy" class="new-race" type="button">Copy link</button>
              </div>
              <p id="online-reply-hint">Your friend sends a reply link back. Open it in this browser, or paste it here.</p>
              <form id="online-reply-form" class="online-row">
                <input id="online-reply" type="text" placeholder="Paste the reply link" aria-label="Reply link" autocomplete="off" />
                <button class="replay-open" type="submit">Connect</button>
              </form>
              <p id="online-error" class="online-error" role="alert">That is not the reply to this invite.</p>
            </div>
            <div class="board-frame">
              <svg id="race-board" viewBox="0 0 ${BOARD.width} ${BOARD.height}" role="img" aria-label="Grid race track. Select a destination marker to move."></svg>
            </div>
            <div class="board-legend">
              <span><i class="legend-dot legend-legal"></i> LEGAL MOVE</span>
              <span id="crash-legend"><i class="legend-dot legend-crash"></i> CRASH / 2-TURN PENALTY</span>
              <button id="zoom-toggle" class="zoom-toggle" type="button"></button>
            </div>
            <div id="replay-controls" class="replay-controls" hidden>
              <span class="replay-label">RACE REPLAY</span>
              <button id="replay-exit" class="replay-icon" type="button" aria-label="Exit replay" title="Exit replay">×</button>
              <button id="replay-previous" class="replay-icon" type="button" aria-label="Previous replay frame" title="Previous frame">‹</button>
              <button id="replay-toggle" class="replay-icon replay-play" type="button" aria-label="Play replay" title="Play replay">▶</button>
              <button id="replay-next" class="replay-icon" type="button" aria-label="Next replay frame" title="Next frame">›</button>
              <input id="replay-range" type="range" min="0" max="0" value="0" aria-label="Replay position" />
              <output id="replay-count">01 / 01</output>
            </div>
          </section>
          <aside class="race-sidebar" aria-label="Race controls and standings">
            <section class="turn-status" aria-live="polite">
              <div class="turn-status-top"><span id="round-label">GRID SETUP</span><span id="turn-label"></span></div>
              <div id="active-driver" class="active-driver"></div><p id="turn-prompt" class="turn-prompt"></p>
            </section>
            <section class="driver-section">
              <div class="section-heading"><span>GRID ORDER</span><span>VECTOR / SPEED</span></div>
              <div id="driver-list" class="driver-list"></div>
            </section>
            <section class="race-feed">
              <div class="section-heading"><span>RACE NOTES</span><span id="feed-count">01</span></div>
              <ol id="event-feed" class="event-feed"></ol>
            </section>
            <details class="rules-drawer">
              <summary>Race rules <span aria-hidden="true">+</span></summary>
              <div class="rules-copy">
                <p>Continue your current arrow, then adjust each grid direction by up to one point. Choose a highlighted destination.</p>
                <p>A move ending outside the track or crossing a boundary causes a crash: stay put, reset speed to one, and miss two turns. The recovery move is one adjacent legal grid point.</p>
                <p>Routes may cross, but racers cannot finish on the same point. Cross the start line clockwise to win.</p>
              </div>
            </details>
            <div class="sidebar-footer"><span>PASS THE DEVICE</span><span id="mode-label">LOCAL MULTIPLAYER</span></div>
          </aside>
        </div>
        <footer class="page-footer"><span>VECTOR RACER / 001</span><span>BUILT FOR THE LONG WAY AROUND</span></footer>
      </main>
    `

    this.board = root.querySelector<SVGSVGElement>('#race-board')!
    this.modeSelect = root.querySelector<HTMLSelectElement>('#game-mode')!
    this.modeLabel = root.querySelector<HTMLSpanElement>('#mode-label')!
    this.sessionStatus = root.querySelector<HTMLSpanElement>('#session-status')!
    this.trackSelect = root.querySelector<HTMLSelectElement>('#track-select')!
    this.trackField = root.querySelector<HTMLDivElement>('.track-field')!
    this.playerCountField = root.querySelector<HTMLDivElement>('.player-field')!
    this.playerCountSelect = root.querySelector<HTMLSelectElement>('#player-count')!
    this.trackName = root.querySelector<HTMLSpanElement>('#track-name')!
    this.directionIndicator = root.querySelector<HTMLSpanElement>('#direction-indicator')!
    this.directionIcon = root.querySelector<HTMLSpanElement>('#direction-icon')!
    this.directionLabel = root.querySelector<HTMLSpanElement>('#direction-label')!
    this.roundLabel = root.querySelector<HTMLSpanElement>('#round-label')!
    this.turnLabel = root.querySelector<HTMLSpanElement>('#turn-label')!
    this.activeDriver = root.querySelector<HTMLDivElement>('#active-driver')!
    this.turnPrompt = root.querySelector<HTMLParagraphElement>('#turn-prompt')!
    this.turnBanner = root.querySelector<HTMLDivElement>('#turn-banner')!
    this.turnBannerLabel = root.querySelector<HTMLSpanElement>('#turn-banner-label')!
    this.turnBannerName = root.querySelector<HTMLElement>('#turn-banner-name')!
    this.turnBannerCaption = root.querySelector<HTMLSpanElement>('#turn-banner-caption')!
    this.championshipPanel = root.querySelector<HTMLDivElement>('#championship-panel')!
    this.championshipSummary = root.querySelector<HTMLParagraphElement>('#championship-summary')!
    this.championshipButton = root.querySelector<HTMLButtonElement>('#championship-action')!
    this.onlinePanel = root.querySelector<HTMLDivElement>('#online-panel')!
    this.onlineSummary = root.querySelector<HTMLParagraphElement>('#online-summary')!
    this.onlineLinkRow = root.querySelector<HTMLDivElement>('#online-link-row')!
    this.onlineLink = root.querySelector<HTMLInputElement>('#online-link')!
    this.onlineCopy = root.querySelector<HTMLButtonElement>('#online-copy')!
    this.onlineReplyHint = root.querySelector<HTMLParagraphElement>('#online-reply-hint')!
    this.onlineReplyForm = root.querySelector<HTMLFormElement>('#online-reply-form')!
    this.onlineReply = root.querySelector<HTMLInputElement>('#online-reply')!
    this.onlineError = root.querySelector<HTMLParagraphElement>('#online-error')!
    this.driverList = root.querySelector<HTMLDivElement>('#driver-list')!
    this.eventFeed = root.querySelector<HTMLOListElement>('#event-feed')!
    this.feedCount = root.querySelector<HTMLSpanElement>('#feed-count')!
    this.crashLegend = root.querySelector<HTMLSpanElement>('#crash-legend')!
    this.zoomToggle = root.querySelector<HTMLButtonElement>('#zoom-toggle')!
    this.replayControls = root.querySelector<HTMLDivElement>('#replay-controls')!
    this.replayOpen = root.querySelector<HTMLButtonElement>('#replay-open')!
    this.replayPrevious = root.querySelector<HTMLButtonElement>('#replay-previous')!
    this.replayToggle = root.querySelector<HTMLButtonElement>('#replay-toggle')!
    this.replayNext = root.querySelector<HTMLButtonElement>('#replay-next')!
    this.replayExit = root.querySelector<HTMLButtonElement>('#replay-exit')!
    this.replayRange = root.querySelector<HTMLInputElement>('#replay-range')!
    this.replayCount = root.querySelector<HTMLOutputElement>('#replay-count')!
    this.newRaceButton = root.querySelector<HTMLButtonElement>('#new-race')!
  }

  get playerCount(): number {
    return Number(this.playerCountSelect.value)
  }

  get isComputerMode(): boolean {
    return this.modeSelect.value === 'cpu' || this.isChampionshipMode
  }

  get isOnlineMode(): boolean {
    return this.modeSelect.value === 'online'
  }

  showOnlineMode(): void {
    this.modeSelect.value = 'online'
  }

  get isChampionshipMode(): boolean {
    return this.modeSelect.value === 'championship'
  }

  get trackId(): string {
    return this.trackSelect.value
  }

  setTrackId(trackId: string): void {
    this.trackSelect.value = trackId
  }

  bind(actions: ViewActions): void {
    this.actions = actions
    this.board.addEventListener('click', this.handleBoardClick)
    this.board.addEventListener('keydown', this.handleBoardKeyDown)
    this.modeSelect.addEventListener('change', actions.onNewRace)
    this.newRaceButton.addEventListener('click', actions.onNewRace)
    this.playerCountSelect.addEventListener('change', actions.onNewRace)
    this.trackSelect.addEventListener('change', actions.onNewRace)
    this.replayOpen.addEventListener('click', actions.onOpenReplay)
    this.replayExit.addEventListener('click', actions.onCloseReplay)
    this.replayPrevious.addEventListener('click', () => actions.onStepReplay(-1))
    this.replayNext.addEventListener('click', () => actions.onStepReplay(1))
    this.replayToggle.addEventListener('click', actions.onToggleReplay)
    this.replayRange.addEventListener('input', () => actions.onSeekReplay(Number(this.replayRange.value)))
    this.championshipButton.addEventListener('click', actions.onChampionshipAction)
    this.zoomToggle.addEventListener('click', () => {
      this.zoomed = !this.zoomed
      this.updateZoom(true)
    })
    window.addEventListener('resize', () => this.updateZoom(false))
    this.onlineCopy.addEventListener('click', this.copyOnlineLink)
    this.onlineLink.addEventListener('focus', () => this.onlineLink.select())
    this.onlineReplyForm.addEventListener('submit', (event) => {
      event.preventDefault()
      if (this.onlineReply.value.trim()) actions.onSubmitReply(this.onlineReply.value)
    })
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') actions.onCloseReplay()
    })
  }

  render(
    state: RaceState,
    candidates: Candidate[],
    replay: ReplayDisplay,
    replayFrameCount: number,
    replayPlaying: boolean,
    computerPlayerId: number | null = null,
    computerThinking = false,
    championship: ChampionshipDisplay = null,
    online: OnlineDisplay = null,
  ): void {
    const frame = replay?.frame
    const racers = frame?.racers ?? state.racers
    const currentIndex = frame?.currentIndex ?? state.currentIndex
    const round = frame?.round ?? state.round
    const winnerId = frame ? frame.winnerId : state.winnerId
    const events = frame?.events ?? state.events
    const winner = winnerId === null ? null : racers.find((racer) => racer.id === winnerId) ?? null
    const phase: RacePhase = replay ? winner ? 'finished' : 'racing' : state.phase
    const setupRacer = state.racers[state.setupIndex]
    const racer = phase === 'setup' ? setupRacer : racers[currentIndex]
    const isComputerTurn = racer.id === computerPlayerId
    const onlineRace = this.isOnlineMode ? online : null
    const localRacerId = onlineRace ? onlineRace.role === 'host' ? 1 : 2 : null
    const onlineConnected = onlineRace?.stage === 'connected'
    // In an online race the board only takes input on this player's own turn.
    const awaitingOpponent = onlineRace !== null && (!onlineConnected || racer.id !== localRacerId)

    this.trackName.textContent = state.track.name
    const raceDirection = getRaceDirection(state.track)
    const directionName = { clockwise: 'CLOCKWISE', counterclockwise: 'COUNTERCLOCKWISE', 'figure-eight': 'FIGURE EIGHT' }[raceDirection]
    this.modeLabel.textContent = this.isChampionshipMode
      ? 'WORLD CUP'
      : this.isComputerMode ? 'VS COMPUTER' : this.isOnlineMode ? 'ONLINE RACE' : 'LOCAL MULTIPLAYER'
    this.trackField.hidden = this.isChampionshipMode
    this.directionIcon.textContent = { clockwise: '↻', counterclockwise: '↺', 'figure-eight': '∞' }[raceDirection]
    this.directionLabel.textContent = directionName
    this.directionIndicator.setAttribute('aria-label', `Race direction: ${directionName.toLowerCase()}`)
    this.board.setAttribute('aria-label', `${state.track.name}. Select a destination marker to move.`)
    this.roundLabel.textContent = phase === 'setup' ? 'GRID SETUP' : `ROUND ${this.formatNumber(round)}`
    this.turnLabel.textContent = phase === 'setup'
      ? `DRIVER ${this.formatNumber(state.setupIndex + 1)} OF ${this.formatNumber(state.racers.length)}`
      : `DRIVER ${this.formatNumber(racer.id)} OF ${this.formatNumber(racers.length)}`
    this.turnBanner.style.setProperty('--driver-color', (winner ?? racer).color)

    if (computerThinking && phase === 'setup') {
      this.turnBannerLabel.textContent = 'CPU SETUP'
      this.turnBannerName.textContent = `${racer.name} PICKS A START`
      this.turnBannerCaption.textContent = 'Choosing an open point'
      this.activeDriver.innerHTML = `<span class="active-swatch" style="--driver-color:${racer.color}"></span><div><span class="active-kicker">COMPUTER OPPONENT</span><strong>PICKING START</strong></div>`
      this.turnPrompt.textContent = 'The CPU is setting its grid position.'
    } else if (computerThinking && isComputerTurn) {
      this.turnBannerLabel.textContent = 'CPU TURN'
      this.turnBannerName.textContent = `${racer.name} THINKING`
      this.turnBannerCaption.textContent = 'Choosing a legal move'
      this.activeDriver.innerHTML = `<span class="active-swatch" style="--driver-color:${racer.color}"></span><div><span class="active-kicker">COMPUTER OPPONENT</span><strong>THINKING</strong></div>`
      this.turnPrompt.textContent = 'The CPU is choosing its next move.'
    } else if (phase === 'setup') {
      this.turnBannerLabel.textContent = 'STARTING GRID'
      this.turnBannerName.textContent = `${racer.name} PICK A POSITION`
      this.turnBannerCaption.textContent = `${this.formatNumber(state.setupIndex + 1)} OF ${this.formatNumber(state.racers.length)} · CHOOSE AN OPEN POINT`
      this.activeDriver.innerHTML = `<span class="active-swatch" style="--driver-color:${racer.color}"></span><div><span class="active-kicker">STARTING GRID / DRIVER ${this.formatNumber(state.setupIndex + 1)}</span><strong>CHOOSE A POSITION</strong></div>`
      this.turnPrompt.textContent = `${state.chosenStartPositions.length} of ${state.racers.length} positions selected. Each driver needs a different point.`
    } else if (replay) {
      this.turnBannerLabel.textContent = 'RACE REPLAY'
      this.turnBannerName.textContent = winner ? `${winner.name} WINS` : racer.name
      this.turnBannerCaption.textContent = `FRAME ${this.formatNumber(replay.index + 1)} OF ${this.formatNumber(replay.total)}`
      this.setActiveDriver(racer, winner, round, phase)
      this.turnPrompt.textContent = `REPLAY FRAME ${this.formatNumber(replay.index + 1)} OF ${this.formatNumber(replay.total)}`
    } else if (winner) {
      this.turnBannerLabel.textContent = 'CHECKERED FLAG'
      this.turnBannerName.textContent = `${winner.name} WINS`
      this.turnBannerCaption.textContent = `Race complete on round ${this.formatNumber(round)}`
      this.setActiveDriver(racer, winner, round, phase)
      this.turnPrompt.textContent = `Finished on round ${this.formatNumber(round)}.`
    } else {
      this.turnBannerLabel.textContent = `DRIVER ${this.formatNumber(racer.id)} / ${this.formatNumber(racers.length)}`
      this.turnBannerName.textContent = `${racer.name} TO MOVE`
      this.turnBannerCaption.textContent = racer.recoveryMove ? 'Recovery move · 1 grid point' : 'Choose a destination on the grid'
      this.setActiveDriver(racer, null, round, phase)
      this.turnPrompt.textContent = racer.recoveryMove ? 'Choose one adjacent legal grid point.' : 'Choose a landing point around your projected position.'
    }

    this.championshipPanel.hidden = championship === null || replay !== null
    if (championship && !replay) {
      const status = championship.stage === 'advance'
        ? 'TRACK WON'
        : championship.stage === 'retry'
          ? 'CPU WINS'
          : 'WORLD CUP CHAMPION'
      this.turnBannerLabel.textContent = `WORLD CUP · RACE ${this.formatNumber(championship.raceNumber)} OF ${this.formatNumber(championship.totalRaces)}`
      this.turnBannerName.textContent = status
      this.turnBannerCaption.textContent = championship.stage === 'advance'
        ? `NEXT: ${championship.nextTrack ?? ''}`
        : championship.currentTrack
      this.championshipSummary.textContent = championship.stage === 'advance'
        ? `${championship.currentTrack} cleared. The next circuit is unlocked.`
        : championship.stage === 'retry'
          ? `Race ${this.formatNumber(championship.raceNumber)} is not cleared yet.`
          : `All ${championship.totalRaces} circuits conquered.`
      this.championshipButton.textContent = championship.stage === 'advance'
        ? 'NEXT TRACK'
        : championship.stage === 'retry' ? 'RETRY RACE' : 'NEW WORLD CUP'
      this.championshipButton.disabled = computerThinking
    }

    if (onlineRace && !replay) this.describeOnlineTurn(onlineRace.stage, racer, winner, phase, localRacerId)
    this.renderOnlinePanel(online, replay !== null)

    this.crashLegend.hidden = phase === 'setup'
    this.feedCount.textContent = this.formatNumber(events.length)
    this.eventFeed.innerHTML = events.map((event) => `<li><span>R${this.formatNumber(event.round)}</span><p>${event.text}</p></li>`).join('')
    this.renderDrivers(state, racers, currentIndex, phase, computerPlayerId, onlineConnected ? localRacerId : null)
    this.renderBoard(state, racers, phase, computerThinking || awaitingOpponent ? [] : candidates, replay !== null)
    this.updateReplayControls(state, replay, replayFrameCount, replayPlaying, computerThinking)

    // The zoomed board follows the person at this device: their own car against the computer or online,
    // and whoever is to move when the device is shared.
    const viewerId = computerPlayerId !== null ? 1 : onlineConnected ? localRacerId : racer.id
    const viewer = racers.find(({ id }) => id === viewerId) ?? racer
    const overview = replay !== null || phase === 'finished' || (onlineRace !== null && !onlineConnected)
    this.focusPoints = overview ? null : phase === 'setup'
      ? state.track.startLine.positions.map(({ point }) => point)
      : this.pointsAhead(viewer)
    this.updateZoom(true)

    // The host chooses the circuit and starts each race, so the guest's controls stay locked while a race is on.
    if (onlineRace?.role === 'guest' && ['preparing', 'reply', 'connected'].includes(onlineRace.stage)) {
      this.trackSelect.disabled = true
      this.newRaceButton.disabled = true
    }
  }

  private describeOnlineTurn(
    stage: NonNullable<OnlineDisplay>['stage'],
    racer: Racer,
    winner: Racer | null,
    phase: RacePhase,
    localRacerId: number | null,
  ): void {
    const swatch = `<span class="active-swatch" style="--driver-color:${racer.color}"></span>`
    if (stage !== 'connected') {
      const offline = stage === 'lost' || stage === 'failed'
      const status = stage === 'lost' ? 'CONNECTION LOST' : stage === 'failed' ? 'NO CONNECTION' : 'WAITING FOR OPPONENT'
      this.turnBannerLabel.textContent = 'ONLINE RACE'
      this.turnBannerName.textContent = status
      this.turnBannerCaption.textContent = offline ? 'Race stopped' : 'Not connected yet'
      this.activeDriver.innerHTML = `${swatch}<div><span class="active-kicker">ONLINE RACE</span><strong>${status}</strong></div>`
      this.turnPrompt.textContent = offline ? 'The race cannot continue.' : 'The race starts once both browsers are connected.'
      return
    }
    if (winner) {
      const result = winner.id === localRacerId ? 'YOU WIN' : 'YOU LOSE'
      this.turnBannerLabel.textContent = `CHECKERED FLAG · ${result}`
      return
    }
    if (racer.id === localRacerId) {
      this.turnBannerLabel.textContent = `YOUR TURN · ${this.turnBannerLabel.textContent}`
      return
    }
    this.turnBannerLabel.textContent = 'OPPONENT\'S TURN'
    this.turnBannerName.textContent = phase === 'setup' ? `${racer.name} PICKS A START` : `${racer.name} TO MOVE`
    this.turnBannerCaption.textContent = 'Waiting for their move'
    this.activeDriver.innerHTML = `${swatch}<div><span class="active-kicker">ONLINE OPPONENT</span><strong>WAITING</strong></div>`
    this.turnPrompt.textContent = 'Your opponent is choosing.'
  }

  private renderOnlinePanel(online: OnlineDisplay, replaying: boolean): void {
    const stage = online?.stage ?? 'idle'
    this.sessionStatus.textContent = !this.isOnlineMode
      ? 'LOCAL SESSION'
      : stage === 'connected' ? 'ONLINE · CONNECTED' : stage === 'lost' || stage === 'failed' ? 'ONLINE · OFFLINE' : 'ONLINE · WAITING'

    const summary = online === null ? '' : {
      idle: '',
      preparing: online.role === 'host' ? 'Preparing your invite link…' : 'Joining the race…',
      invite: 'Send this invite link to your friend, and keep this tab open.',
      reply: 'Send this reply link back to your friend, and keep this tab open. The race starts as soon as they open it.',
      connecting: 'Reply received. Connecting…',
      connected: '',
      lost: 'The connection to your opponent was lost. Press "New race" to create a new invite.',
      failed: 'The two browsers could not reach each other. Some networks block direct connections. Press "New race" to try again with a new invite.',
      relayed: 'Reply delivered. The race is in your other tab, so you can close this one.',
      'relay-failed': 'This is a reply link, but the race it belongs to is not open in this browser. Open it in the browser where you created the invite, or copy the link and paste it there.',
    }[stage]

    this.onlinePanel.hidden = summary === '' || replaying
    this.onlineSummary.textContent = summary
    const link = online?.link ?? null
    this.onlineLinkRow.hidden = link === null
    if (this.onlineLink.value !== (link ?? '')) {
      this.onlineLink.value = link ?? ''
      this.showCopied(false)
    }
    this.onlineReplyHint.hidden = stage !== 'invite'
    this.onlineReplyForm.hidden = stage !== 'invite'
    if (stage !== 'invite') this.onlineReply.value = ''
    this.onlineError.hidden = stage !== 'invite' || !online?.replyRejected
  }

  private copyOnlineLink = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(this.onlineLink.value)
      this.showCopied(true)
    } catch {
      // Without clipboard access the link is selected, ready to be copied by hand.
      this.onlineLink.select()
    }
  }

  private showCopied(copied: boolean): void {
    if (this.copiedTimer !== null) window.clearTimeout(this.copiedTimer)
    this.copiedTimer = copied ? window.setTimeout(() => this.showCopied(false), COPIED_NOTICE_TIME) : null
    this.onlineCopy.textContent = copied ? 'Copied' : 'Copy link'
  }

  private handleBoardClick = (event: MouseEvent): void => {
    const target = event.target instanceof Element ? event.target.closest<SVGGElement>('.move-choice') : null
    if (!target || !this.actions) return
    this.actions.onSelectPoint({ x: Number(target.dataset.x), y: Number(target.dataset.y) })
  }

  private handleBoardKeyDown = (event: KeyboardEvent): void => {
    if (!(event.target instanceof SVGGElement) || !event.target.matches('.move-choice')) return
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    this.actions?.onSelectPoint({ x: Number(event.target.dataset.x), y: Number(event.target.dataset.y) })
  }

  private formatNumber(value: number): string {
    return String(value).padStart(2, '0')
  }

  private formatSpeed(racer: Racer): string {
    if (racer.recoveryMove || racer.penaltyTurns > 0) return '1.0'
    return Math.hypot(racer.velocity.x, racer.velocity.y).toFixed(1)
  }

  private setActiveDriver(racer: Racer, winner: Racer | null, round: number, phase: RacePhase): void {
    if (winner) {
      this.activeDriver.innerHTML = `<span class="active-swatch" style="--driver-color:${winner.color}"></span><div><span class="active-kicker">CHECKERED FLAG</span><strong>${winner.name} WINS</strong></div>`
    } else {
      this.activeDriver.innerHTML = `<span class="active-swatch" style="--driver-color:${racer.color}"></span><div><span class="active-kicker">DRIVER ${this.formatNumber(racer.id)} / ${racer.name}</span><strong>${racer.recoveryMove ? 'RECOVERY LAP' : 'YOUR TURN'}</strong></div>`
    }
    if (phase === 'finished') this.turnPrompt.textContent = `Finished on round ${this.formatNumber(round)}.`
  }

  private renderDrivers(
    state: RaceState,
    racers: Racer[],
    currentIndex: number,
    phase: RacePhase,
    computerPlayerId: number | null,
    localRacerId: number | null,
  ): void {
    this.driverList.innerHTML = racers.map((racer, index) => {
      const isCurrent = phase === 'setup' ? index === state.setupIndex : index === currentIndex && phase !== 'finished'
      const vector = racer.recoveryMove || racer.penaltyTurns > 0
        ? 'RECOVERY'
        : `${racer.velocity.x >= 0 ? '+' : ''}${racer.velocity.x} / ${racer.velocity.y >= 0 ? '+' : ''}${racer.velocity.y}`
      const status = phase === 'setup'
        ? `<span class="driver-state ${isCurrent ? 'active-state' : ''}">${index < state.setupIndex ? 'POSITION SET' : isCurrent ? 'PICK START' : 'WAITING'}</span>`
        : racer.penaltyTurns > 0
          ? `<span class="driver-state penalty-state">PENALTY ${racer.penaltyTurns}</span>`
          : isCurrent
            ? '<span class="driver-state active-state">MOVING NOW</span>'
            : `<span class="driver-state">${racer.trail.length - 1} MOVES</span>`

      const displayName = racer.id === computerPlayerId
        ? `${racer.name} · CPU`
        : racer.id === localRacerId ? `${racer.name} · YOU` : racer.name
      return `<div class="driver-row ${isCurrent ? 'driver-current' : ''}" style="--driver-color:${racer.color}">
        <span class="driver-marker">${this.formatNumber(racer.id)}</span><span class="driver-name">${displayName}${status}</span>
        <span class="driver-speed"><span>${vector}</span><b>${this.formatSpeed(racer)}</b></span></div>`
    }).join('')
  }

  private renderBoard(state: RaceState, racers: Racer[], phase: RacePhase, candidates: Candidate[], replaying: boolean): void {
    const track = state.track
    const visibleRacers = phase === 'setup' ? racers.slice(0, state.setupIndex) : racers
    const outerPath = this.pathForPolygon(track.outer)
    const innerPath = this.pathForPolygon(track.inner)
    const { start, end } = track.startLine
    const verticalStartLine = Math.abs(end.y - start.y) > Math.abs(end.x - start.x)
    const startLabelX = (start.x + end.x) / 2 + (verticalStartLine ? .9 : 0)
    const startLabelY = (start.y + end.y) / 2 - (verticalStartLine ? 0 : .55)
    const startLabelTransform = verticalStartLine
      ? `transform="rotate(90 ${startLabelX} ${startLabelY})"`
      : ''
    const gridLines = [
      ...Array.from({ length: BOARD.width + 1 }, (_, x) => `<line class="grid-line" x1="${x}" y1="0" x2="${x}" y2="${BOARD.height}" />`),
      ...Array.from({ length: BOARD.height + 1 }, (_, yValue) => `<line class="grid-line" x1="0" y1="${yValue}" x2="${BOARD.width}" y2="${yValue}" />`),
    ].join('')
    const startChoices = phase === 'setup'
      ? this.drawCandidates(candidates, true)
      : replaying ? '' : this.drawCandidates(candidates, false)

    const edges = `<path class="track-edge" d="${outerPath}" /><path class="track-edge track-edge-inner" d="${innerPath}" />`
    const grid = `<g class="grid-lines">${gridLines}</g>`
    const trackMarkup = track.bridge
      ? `<path class="track-road" d="${this.pathForPolygon(track.directionPath)}" stroke-width="${track.halfWidth * 2}" />
        ${edges}
        <path class="track-road track-bridge" d="${this.pathForLine(track.bridge.path)}" stroke-width="${track.halfWidth * 2}" />
        ${track.bridge.edges.map((edge) => `<path class="track-edge track-bridge-edge" d="${this.pathForLine(edge)}" />`).join('')}
        ${grid}`
      : `<path class="track-surface" d="${outerPath} ${innerPath}" fill-rule="evenodd" />
        <path class="infield" d="${innerPath}" />
        ${grid}
        ${edges}`

    this.board.innerHTML = `
      <rect class="board-ground" x="0" y="0" width="${BOARD.width}" height="${BOARD.height}" />
      ${trackMarkup}
      <g class="start-finish"><line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" /><text x="${startLabelX}" y="${startLabelY}" ${startLabelTransform}>START / FINISH</text></g>
      <g class="race-trails">${visibleRacers.map((racer) => this.drawRacer(racer)).join('')}</g>
      <g class="move-choices">${startChoices}</g>
    `
  }

  // The car, the nine points it can choose between, and where it would be a move later at this speed.
  private pointsAhead({ position, velocity }: Racer): Point[] {
    const projected = { x: position.x + velocity.x, y: position.y + velocity.y }
    return [
      position,
      { x: projected.x - 1, y: projected.y - 1 },
      { x: projected.x + 1, y: projected.y + 1 },
      { x: projected.x + velocity.x, y: projected.y + velocity.y },
    ]
  }

  private zoomBox(points: Point[]): ViewBox {
    const narrow = window.matchMedia(NARROW_SCREEN).matches
    // A phone held upright gets a square view, which shows as much road ahead of a car driving up or down as sideways.
    const aspect = narrow ? 1 : BOARD.width / BOARD.height
    const xs = points.map(({ x }) => Math.max(0, Math.min(BOARD.width, x)))
    const ys = points.map(({ y }) => Math.max(0, Math.min(BOARD.height, y)))
    const [left, right, top, bottom] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
    const height = Math.min(
      BOARD.height,
      Math.max(ZOOM_MIN_SIZE, bottom - top + ZOOM_MARGIN * 2, (right - left + ZOOM_MARGIN * 2) / aspect),
    )
    const width = height * aspect
    if (width >= BOARD.width) return WHOLE_BOARD
    // Markers on the outermost grid lines need a little room beyond the board to stay tappable.
    const place = (centre: number, size: number, limit: number): number => {
      return Math.max(-ZOOM_EDGE_OVERHANG, Math.min(limit + ZOOM_EDGE_OVERHANG - size, centre - size / 2))
    }
    return { x: place((left + right) / 2, width, BOARD.width), y: place((top + bottom) / 2, height, BOARD.height), width, height }
  }

  private updateZoom(animate: boolean): void {
    const target = this.zoomed && this.focusPoints ? this.zoomBox(this.focusPoints) : WHOLE_BOARD
    this.zoomToggle.textContent = this.zoomed ? 'Show whole track' : 'Zoom to car'
    this.zoomToggle.setAttribute('aria-pressed', String(this.zoomed))
    this.zoomToggle.disabled = this.focusPoints === null
    this.board.classList.toggle('board-zoomed', target !== WHOLE_BOARD)

    if (this.zoomFrame !== null) window.cancelAnimationFrame(this.zoomFrame)
    this.zoomFrame = null
    const from = this.viewBox
    const sameShape = Math.abs(from.width / from.height - target.width / target.height) < .001
    if (!animate || !sameShape || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.showViewBox(target)
      return
    }

    const started = performance.now()
    const step = (now: number): void => {
      const progress = Math.min(1, (now - started) / ZOOM_TIME)
      const eased = 1 - (1 - progress) ** 3
      const between = (start: number, end: number): number => start + (end - start) * eased
      this.showViewBox({
        x: between(from.x, target.x),
        y: between(from.y, target.y),
        width: between(from.width, target.width),
        height: between(from.height, target.height),
      })
      this.zoomFrame = progress < 1 ? window.requestAnimationFrame(step) : null
    }
    this.zoomFrame = window.requestAnimationFrame(step)
  }

  private showViewBox(box: ViewBox): void {
    this.viewBox = box
    this.board.setAttribute('viewBox', `${box.x} ${box.y} ${box.width} ${box.height}`)
    this.board.style.aspectRatio = String(box.width / box.height)
  }

  private pathForLine(points: Point[]): string {
    return points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`).join(' ')
  }

  private pathForPolygon(points: Point[]): string {
    return `${this.pathForLine(points)} Z`
  }

  private drawRacer(racer: Racer): string {
    const markerId = `arrow-${racer.id}`
    const marker = `<marker id="${markerId}" markerWidth=".55" markerHeight=".55" refX=".48" refY=".275" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0 L.55 .275 L0 .55 Z" fill="${racer.color}" /></marker>`
    const lines = racer.trail.map(({ from, to }, index) => `<line class="trail-line ${index === racer.trail.length - 1 ? 'trail-current' : ''}" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" stroke="${racer.color}" marker-end="url(#${markerId})" />`).join('')
    return `<defs>${marker}</defs>${lines}<g class="racer-token" transform="translate(${racer.position.x} ${racer.position.y})"><circle r=".38" fill="${racer.color}" /><text y=".11">${racer.id}</text></g>`
  }

  private drawCandidates(candidates: Candidate[], setup: boolean): string {
    // Choices beyond the board are drawn at its edge so they can still be picked.
    const shown = new Set<string>()
    return candidates.filter(({ kind }) => kind !== 'blocked').map(({ point, kind }) => {
      const x = Math.max(BOARD_EDGE_INSET, Math.min(BOARD.width - BOARD_EDGE_INSET, point.x))
      const y = Math.max(BOARD_EDGE_INSET, Math.min(BOARD.height - BOARD_EDGE_INSET, point.y))
      if (shown.has(`${x},${y}`)) return ''
      shown.add(`${x},${y}`)
      const marker = kind === 'crash'
        ? `<circle class="choice-dot" cx="${x}" cy="${y}" r=".14" />`
        : `<path class="choice-plus" d="M${x - .22} ${y}h.44 M${x} ${y - .22}v.44" />`
      const label = setup ? 'Choose starting position' : kind === 'crash' ? 'Crash and take penalty' : 'Move'
      return `<g class="move-choice ${kind === 'crash' ? 'move-crash' : 'move-legal'}" data-x="${point.x}" data-y="${point.y}" tabindex="0" role="button" aria-label="${label} to ${point.x}, ${point.y}"><circle class="choice-hit" cx="${x}" cy="${y}" r=".58" />${marker}</g>`
    }).join('')
  }

  private updateReplayControls(
    state: RaceState,
    replay: ReplayDisplay,
    replayFrameCount: number,
    replayPlaying: boolean,
    computerThinking: boolean,
  ): void {
    const replaying = replay !== null
    this.replayOpen.disabled = replayFrameCount < 2 || replaying || state.phase === 'setup' || computerThinking
    this.replayControls.hidden = !replaying
    this.modeSelect.disabled = replaying || computerThinking
    this.trackSelect.disabled = replaying
    this.trackField.hidden = this.isChampionshipMode
    this.playerCountSelect.disabled = replaying || this.isComputerMode || this.isOnlineMode
    this.playerCountField.hidden = this.isComputerMode || this.isOnlineMode
    this.newRaceButton.disabled = replaying
    this.replayRange.max = String(Math.max(0, replayFrameCount - 1))
    this.replayRange.value = String(replay?.index ?? 0)
    this.replayCount.value = `${this.formatNumber((replay?.index ?? 0) + 1)} / ${this.formatNumber(replayFrameCount || 1)}`
    this.replayPrevious.disabled = !replaying || replay.index <= 0
    this.replayNext.disabled = !replaying || replay.index >= replay.total - 1
    this.replayToggle.textContent = replayPlaying ? 'Ⅱ' : '▶'
    this.replayToggle.setAttribute('aria-label', replayPlaying ? 'Pause replay' : 'Play replay')
    this.replayToggle.title = replayPlaying ? 'Pause replay' : 'Play replay'
  }
}
