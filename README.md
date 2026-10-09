# Vector Racer

A browser version of the classic pencil-and-paper racing game, played on eleven Formula 1 circuits.

**Play it here: https://fkschmidt.github.io/vector-racer/**

You don't steer the car directly. Each turn your car carries on with the speed and direction it already has, and you may nudge that by one grid square. Go too fast into a corner and you won't be able to slow down in time.

## How to play

1. **Pick a start position.** Each driver chooses one of the four points on the start/finish line.
2. **Make your move.** The game shows where your car will end up if you change nothing, plus the eight points around it. Pick one:
   - the middle point keeps your speed and direction,
   - the others speed you up, slow you down or turn you, by one square in each direction.
3. **Stay on the road.** You may touch the edge of the track or run along it, but not go through it.
4. **Finish the lap.** The first driver to drive a full lap and cross the start/finish line wins.

### Crashing

If you pick a point that takes you off the road, you crash: your car stays where it is, you miss your next two turns, and then you restart from a standstill. Sometimes every option is a crash. Then you have to take one, and you should have braked earlier.

### Good to know

- Two cars can't end a turn on the same point, but they can drive through each other.
- Backing over the start line and driving forward again does not count as a lap.
- Suzuka crosses over itself on a bridge. You can't turn from the bridge onto the road below, or the other way round.

The exact rules, written precisely enough to rebuild the game from, are in [RULES.md](RULES.md).

## Game modes

Choose the mode in the menu above the board. Switching mode starts a new race.

- **Local** – two to four people take turns on one device. You pick the circuit and how many drivers.
- **VS CPU** – you against the computer on a circuit of your choice. You pick your start position first, then the computer picks its own.
- **Online** – two people race each other live from two different computers. See [Playing online](#playing-online).
- **Championship** – beat the computer on all eleven circuits in order, starting at the Red Bull Ring and ending at Suzuka. A win unlocks the next circuit; a loss means you race the same one again, as often as you need. Progress isn't saved, so reloading the page or pressing "New race" starts the championship over.

Every race can be replayed move by move, during the race or when it's over.

### Playing online

The two browsers talk to each other directly. To find each other they need one link in each direction, which you send by any messenger or mail:

1. **You** choose the mode **Online**. The game shows an invite link. Send it to your friend and keep the tab open.
2. **Your friend** opens the invite link. Their game shows a reply link, which they send back to you. They keep their tab open too.
3. **You** open the reply link in the same browser, or paste it into the field under your invite link. The race starts.

The player who created the invite is driver 1, chooses the circuit and starts each new race. No further links are needed for the rest of the session.

Good to know:

- Reloading or closing the tab ends the connection, and the race with it. Press "New race" to create a new invite.
- A reply link stays usable for about a quarter of an hour.
- Some company and mobile networks block direct connections between browsers. If the game reports that the browsers could not reach each other, try a different network.
- Tested in Chrome. Other current browsers should work but have not been tried.

## Circuits

| # | Circuit | Direction |
|---|---------|-----------|
| 1 | Red Bull Ring | clockwise |
| 2 | Monza | clockwise |
| 3 | Interlagos | counterclockwise |
| 4 | Imola | counterclockwise |
| 5 | Hockenheim | clockwise |
| 6 | Silverstone | clockwise |
| 7 | Hungaroring | clockwise |
| 8 | Spa-Francorchamps | clockwise |
| 9 | Montreal | clockwise |
| 10 | Monaco | clockwise |
| 11 | Suzuka | figure eight |

The layouts follow the real corner sequences but are stylised to fit a 34 × 23 grid, so they are recognisable rather than to scale.

## How it was built

The game was written by an AI coding assistant (Claude Code), not by hand. A person described what they wanted in plain language, looked at the result, and said what was wrong; the assistant wrote and changed the code.

This was deliberately the naive way of building it. There was no design document, no architecture plan and no choice of technology up front. The assistant was given two things only:

- a description of the game, and
- one requirement: it has to run from GitHub with no other servers.

That requirement is why the whole game runs in the browser. There is no backend, no database and no accounts; the build is a handful of static files, served by GitHub Pages. It is also why championship progress is not saved anywhere.

It also shaped online play. With no server to introduce the two browsers, the players pass an invite link and a reply link between them, and the moves then travel directly from browser to browser. One outside service is involved: when a link is created, the browser asks a public address-lookup server (a STUN server run by Google) for its own internet address. No account is needed and no race data passes through it.

How it went from there:

- **It started from the rules.** The first input was [RULES.md](RULES.md): a description of the pencil-and-paper game. The assistant turned that into a working game.
- **Circuits came from the AI's memory.** The assistant laid out each circuit from what it knows about the real corner sequences, without maps or measurements, which is why they are stylised rather than exact. An earlier attempt to build tracks from images was discarded.
- **Problems were reported the way a player would notice them.** For example: "the borders cross each other", "the computer just drove backwards and finished", "I can't select a move that lands outside the board". Each led to a fix, and usually to a test so it stays fixed.
- **The rules file grew with the game.** Whenever the game learned something new, such as Suzuka's bridge or the rule against reversing over the finish line, it was written back into RULES.md. That file now describes the game precisely enough that an AI could rebuild it from the file alone.
- **Tests stand in for playing every race.** The test suite has the computer drive a full lap of every circuit without crashing, and checks that no circuit's borders cross and that every start grid is legal.

No game engine or framework is used: it is plain TypeScript drawing an SVG board, built with Vite.

## Running it

You need [Node.js](https://nodejs.org) 22.18 or newer.

```sh
npm install
npm run dev      # start the game locally and open the address it prints
npm test         # run the test suite
npm run build    # create a production build in dist/
```

## Publishing on GitHub Pages

The game is published at https://fkschmidt.github.io/vector-racer/ from the repository at https://github.com/fkschmidt/vector-racer.

A workflow in the repository tests, builds and publishes the game every time `main` is pushed, so the live site always matches `main`. It can also be run by hand from the repository's **Actions** tab ("Deploy to GitHub Pages").

To publish a copy of your own, fork the repository, open **Settings → Pages**, set **Source** to **GitHub Actions**, and push to `main`. The build uses relative paths, so it works under any repository name.

## Project layout

| Path | What it holds |
|------|---------------|
| `src/tracks.ts` | The circuits, each as a short list of waypoints, and lap-progress measurement |
| `src/track-builder.ts` | Turns waypoints into a road with borders |
| `src/game.ts` | The rules: legal moves, crashes, finish line |
| `src/race-session.ts` | One race: turn order, penalties, replay |
| `src/computer-player.ts` | The computer opponent |
| `src/world-cup.ts` | Championship progression |
| `src/online-link.ts` | Packing connection details into invite and reply links |
| `src/online-connection.ts` | The direct browser-to-browser connection and the messages sent over it |
| `src/online-race.ts` | Setting up an online race: invite, reply, connection state |
| `src/game-view.ts`, `src/app.ts`, `src/game.css` | The interface |
| `tests/` | Automated tests, including a full computer-driven lap of every circuit |

To reshape a circuit, edit its waypoints in `src/tracks.ts`. The borders, start grid and tests follow from them.
