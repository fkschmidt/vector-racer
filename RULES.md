# Vector Racer Rules

This file is the complete specification of the game. An implementation that follows it should behave the same as this one. For an introduction aimed at players, see [README.md](README.md).

## 1. Board and coordinates

- The board is a grid 34 units wide and 23 units high.
- A position is a grid intersection: a point `(x, y)` where both are whole numbers. `x` grows to the right and `y` grows downward.
- Cars only ever stand on grid intersections. Track borders may pass between intersections.
- A vector `(dx, dy)` is a difference between two positions. A car's speed is the length of its current vector.

## 2. Tracks

A track consists of:

- **An outer border and an inner border.** Each is a closed polygon. The road is the area inside the outer border and outside the inner border. Points exactly on either border are part of the road.
- **A racing route.** A closed line that runs along the middle of the road in the direction of travel. It defines which way round the lap goes and is used to measure progress (section 8).
- **A start/finish line.** A straight segment across the road that lies on a grid row or column, with a direction vector of length 1 that points in the direction of travel.
- **A start grid.** The grid intersections on the start/finish line. Every track has exactly four.

### How the built-in tracks are made

Each built-in track is defined by a list of waypoints along the middle of the road, in race order.

1. A smooth closed curve is drawn through the waypoints (a Catmull-Rom spline, four samples per waypoint). This is the racing route.
2. The two borders are the racing route shifted 1.5 units to either side, so the road is 3 units wide everywhere.
3. Where shifting folds a border over itself on the inside of a tight corner, the fold is cut off at the point where it crosses.
4. The border that encloses the larger area is the outer border.

The stretch around the start/finish line is laid out as an exactly straight run centred on a half-unit coordinate, so both borders fall on whole-number grid lines and the line holds four grid intersections.

### Tracks with a bridge

A track may cross over itself. The stretch that passes on top is the bridge.

- The bridge and the road beneath it are separate roads that happen to overlap on the board.
- A car belongs to whichever road its lap progress places it on (section 8). It cannot move from one to the other at the crossing.
- On such a track, a point is on the road if it lies within 1.5 units of the racing route, counting only the part of the route within 15 units of lap distance from the car's current progress.
- A move on such a track is legal if every point along it meets that test.

### The circuits

The game ships with eleven circuits, in this order. All run clockwise unless noted.

1. Red Bull Ring
2. Monza
3. Interlagos (counterclockwise)
4. Imola (counterclockwise)
5. Hockenheim
6. Silverstone
7. Hungaroring
8. Spa-Francorchamps
9. Montreal
10. Monaco
11. Suzuka (figure eight, with a bridge)

## 3. Players

- A race has two, three or four players.
- Players are numbered from 1 and take turns in that order for the whole race.

## 4. Setting up the grid

1. In player order, each player picks one of the four start grid points. A point already taken cannot be picked again.
2. Each car starts on its point with a vector equal to the start line's direction: one unit, pointing in the direction of travel.
3. When every player has picked, the race begins with player 1.

## 5. Taking a turn

1. **Find the projected position.** Add the car's current vector to its current position.
2. **List the nine choices.** These are the projected position and the eight grid intersections around it. In other words, each component of the vector may change by -1, 0 or +1.
3. **Classify each choice:**
   - **Blocked** if another car stands on it, or if it is the car's own current position. A blocked choice cannot be picked.
   - **Legal** if the move to it stays on the road (section 6).
   - **Crash** otherwise.
4. **Pick one choice** that is not blocked.
   - If it is legal, the car moves there. Its new vector is the new position minus the old position.
   - If it is a crash, section 7 applies.
5. If no choice is legal, the player must pick a crash.

Cars do not block each other's paths. A car may pass through another car's position during a move; it only may not end its move there.

## 6. Staying on the road

A move from one position to another is legal when all of the following hold:

- Both positions are on the road. Points exactly on a border count as on the road.
- The straight line between them never leaves the road.

This means a move may end on a border, run along a border, or graze a corner of a border. It may not pass through a border to the other side, even if it ends back on the road.

## 7. Crashing

When a player picks a crash choice:

1. The car does not move.
2. Its vector becomes zero.
3. It misses its next two turns.
4. On its first turn after that, it makes a **recovery move**: the choices are the eight grid intersections around its current position, classified as in section 5. The chosen move becomes its new vector, so it restarts at a speed of one unit (or about 1.4 on a diagonal).

A recovery move can itself be a crash, which starts the penalty again.

## 8. Lap progress

Each car tracks how far it has driven along the racing route, measured as distance along the route from the route's first point.

- At the start, progress is the distance to the point on the route closest to the car.
- After each move, the car is matched to the closest point on the route, counting only the part of the route within 15 units of lap distance from its previous progress. That point's distance becomes its new progress.
- Progress keeps counting upward across the finish line; it does not wrap back to zero.

Progress has two uses: it decides which road a car is on at a bridge (section 2), and it tells the computer player which way is forward (section 11).

## 9. Winning

A car completes the lap when both of these are true:

- **It is eligible.** A car becomes eligible once it ends a move strictly ahead of the start/finish line, that is, on the side the direction vector points to. It loses eligibility whenever a move touches or crosses the line while travelling backward, including when it starts on the line and moves backward off it.
- **It crosses the line forward.** The move starts strictly behind the line, ends on or ahead of it, travels forward, and passes through the line segment itself.

Eligibility is checked before the move is applied, so a car cannot become eligible and win with the same move.

The first car to complete the lap wins and the race ends immediately. There are no ties: later players in the same round do not get a turn.

## 10. Rounds and turn order

- A round is one pass through all players in order. The round counter goes up each time play returns to player 1.
- A player who is serving a crash penalty is skipped, and each skip uses up one of their missed turns.

## 11. Game modes

The player chooses a mode, a circuit and a number of drivers before the race. Changing any of them, or pressing "New race", abandons the current race and starts a new one in the grid setup phase. The game opens in local mode with two drivers on the first circuit.

### Local

- Two, three or four people share one device and take turns.
- The players choose the circuit and the number of drivers.
- Every driver is controlled by a person, including when picking start positions.

### Versus computer

- Exactly two drivers: a person is player 1 and the computer is player 2. The number of drivers cannot be changed.
- The person chooses the circuit.
- The person picks a start position first, then the computer picks its own.
- While the computer is deciding, the person cannot make a move, and the mode and replay controls are locked. The computer takes about half a second per decision so its moves can be followed.
- If the computer is serving a crash penalty, its turns are skipped as for any other player and the person moves again.

### Online

Two people race each other from two devices. The browsers are connected directly to each other (a WebRTC data channel); no server relays the race.

- Exactly two drivers. The player who creates the race, the host, is player 1. The player who joins, the guest, is player 2. The number of drivers cannot be changed.
- **Connecting** takes one link in each direction, which the players send to each other by any means:
  1. Choosing the online mode makes the host's game create an invite link and show it.
  2. Opening the invite link puts the guest's game in online mode and makes it create a reply link and show it.
  3. The host opens the reply link in the same browser, or pastes it into a field shown with the invite. A reply link opened in a new tab is handed to the tab that holds the invite, and the new tab says so. A reply that does not belong to the open invite is refused.
- Each link carries the connection details of the browser that made it, in the part of the address after `#`. To learn its own internet address, a browser asks a public address-lookup (STUN) server while making a link.
- Until the browsers are connected, the board takes no input.
- When the connection is made, the host's game starts a race on the circuit the host has selected and tells the guest's game to start the same one.
- The host chooses the circuit and starts each new race. Changing the circuit before the guest has connected keeps the invite valid. While joining or connected, the guest's circuit and "New race" controls are locked.
- A player can only select a point, including a start position, on their own turn. The selection is applied on their own board and sent to the other, which applies the same selection. Both boards therefore always show the same race.
- Each selection is sent with the number of the race and its position in the sequence of selections. A selection for a race that has since been replaced is ignored. One that is out of sequence, made out of turn or not legal ends the connection.
- If the connection ends, the race stops where it is and cannot be resumed. Pressing "New race" creates a new invite. Closing or reloading the page ends the connection. Leaving the online mode does too.
- Each player can open the replay on their own; it does not affect the other player. Moves that arrive during a replay are still applied.

### Championship

A series of races against the computer, one per circuit, in the order listed in section 2. Each race follows the versus-computer rules, except that the circuit cannot be chosen.

- The championship starts on the first circuit.
- **If the person wins a race** that is not the last, the next circuit is unlocked. The game shows that the circuit is cleared and offers "Next track", which starts the race on the next circuit.
- **If the computer wins**, the circuit is not cleared. The game offers "Retry race", which starts the same circuit again. There is no limit on retries.
- **If the person wins the last circuit**, they are the champion. The game offers "New world cup", which starts again from the first circuit.
- Between races the game shows the race number out of the total, for example "Race 03 of 11".
- Pressing "New race", or switching to the championship mode from another mode, restarts the championship from the first circuit. Progress is not saved: reloading the page also restarts it.

### The computer player

- **Start grid.** It picks the free start point farthest from the human player's.
- **Winning move.** If it is eligible and a legal choice completes the lap, it takes that.
- **Otherwise** it rates every legal choice:
  - *Follow-ups:* how many legal choices it would have on the next turn.
  - *Runways:* how many of those follow-ups still leave at least one legal choice on the turn after.
- It first narrows the choices: it keeps those with at least 65% of the best runway count (minimum one). If none has a runway, it keeps those with at least one follow-up. If there are none of those either, it keeps all legal choices.
- From the remaining choices it picks the highest score:
  - `4 × progress gained`
  - `+ 0.2 × alignment` (cosine of the angle between the new and old vector; 0 if either is zero)
  - `+ 0.55 × follow-ups` (counted up to 5)
  - `+ 0.6 × runways` (counted up to 4)
  - `− 8` if there are no follow-ups, `− 1` if there is exactly one
  - `− 10` if there are no runways, `− 1.5` if there is exactly one
  - `− 0.8 × (speed − 3) × (4 − follow-ups)`, applied only when both factors are positive
- If it has no legal choice, it takes a crash.

## 12. Display

These are not rules of play, but an implementation needs them to be usable:

- Legal choices and crash choices are shown differently. Blocked choices are not shown.
- A choice that falls outside the board is drawn at the nearest point on the board's edge so it can still be picked. Choices that land on the same edge spot are shown as one.
- Each car's full route is drawn as a chain of arrows, one per move.
- A finished or ongoing race can be replayed step by step. Every move and every missed turn is one step.
