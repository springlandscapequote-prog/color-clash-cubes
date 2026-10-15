# Simulation results

Everything below is produced by the code in this folder, using **`js/game.js`, the same module the app runs**, so the simulator tests the exact rules the app uses.

* `node sim/test-engine.js` – 9,000 random games under both rule sets; checks the 72 pieces are always conserved, steals/takes never exceed what exists, and every game ends.
* `node sim/report.js original|final 6000` – the baseline-vs-final table (6,000 games for each condition).
* `node sim/sweep.js 3000 "" 2,3,4` – every candidate tweak on its own and in combination (`sweep-results.txt`).
* Bots (`bots.js`): **random**, **greedy** (most pieces / finish cubes), **aggro** (steal-first), **hoard** (never steals unless it finishes a cube), **smart** (1-ply heuristic that values cubes, safe-from-stealing piles, and hurting leaders). "Smart mirror" = all seats play *smart*, which is what the headline numbers use.

## How the original rules were interpreted (assumptions)
1. Each turn = **one** number die + **one** color cube (the "How to play" text). The spare second die/cube in the component list is unused in the baseline (it becomes an option, tested below).
2. Take exactly the number rolled. If the pool has fewer of that color, take what's left and **may** steal the rest from **one** other player's *unsafe* pile (the example in the PDF). If the pool has none, a steal is the only move, and it's optional.
3. Surplus pieces beyond 6 stay loose (e.g. 5 loose + roll 4 → one cube, 3 loose). Piles can never hold 6+.
4. Safe cubes can never be stolen; only loose pieces.
5. "Game ends when no legal moves remain or all cubes are completed": literally, a legal move (taking from the pool, or stealing from someone) exists until every piece is in a cube, so in practice the game only ends at 12 cubes. The sim stops anything that is still going after 400 turns (a "never-ending" game).
6. The original has no tie-break, so a tie is a tie.
7. A turn where the rolled color has nothing to take/steal (or the player declines a steal) is a "dead roll" and the turn passes.

## Baseline vs final (smart players, 6,000 games per cell)
| Measure | 2p orig | 2p final | 3p orig | 3p final | 4p orig | 4p final |
|---|---|---|---|---|---|---|
| Turns per player (avg) | 24.8 | **14.6** | 24.5 | **11.8** | 29.5 | **10.3** |
| Total turns in a game (avg, 10th-90th pct) | 50 (35-67) | **29 (24-35)** | 73 (47-106) | **35 (27-44)** | 118 (64-185) | **41 (30-53)** |
| Dead rolls (color had nothing to take) % | 41 | **0** | 45 | **0** | 49 | **0** |
| Roll not fully used (pool/steal short) % | 8 | **14** | 11 | **16** | 13 | **19** |
| Turns with a real choice % | 7 | **47** | 16 | **60** | 24 | **69** |
| Ties for the win % | 33 | **0** | 21 | **2** | 27 | **2** |
| Win rate by seat (1st..last, %) | 54/46 | **52/48** | 38/33/29 | **36/33/31** | 30/26/23/21 | **28/26/25/22** |
| Leader at half-time goes on to win % | 76 | **59** | 74 | **58** | 77 | **58** |
| Winner was 2+ cubes behind at 70% % | 9 | **9** | 5 | **5** | 4 | **4** |
| Games that never end (all players "hoard") % | 0 | **0** | 72 | **0** | 89 | **0** |
| Steals per game | 8 | **11** | 19 | **19** | 36 | **26** |
| Smart player vs 100% random players: smart wins % | 73 (fair = 50) | **81 (fair = 50)** | 70 (fair = 33) | **68 (fair = 33)** | 65 (fair = 25) | **60 (fair = 25)** |


How to read it:
* **Dead rolls** (41–49% → 0%): in the original, once a color is all built (or its pool is empty and nobody is worth robbing) the color cube is useless. Late in the game about every second turn does nothing. That's the biggest "not fun" issue.
* **Real choice** (7–24% → 47–69%): the original has almost no decisions (take what the dice say, maybe decline a steal). The final has "take or steal, and from whom" every turn.
* **Ties** (21–33% → 0–2%): 12 cubes split between 2–4 players ties constantly; the tie-breakers fix that.
* **Never-ending games** (72–89% of games with "hoard" players at 3–4 players): if everyone keeps declining to steal, nobody ever finishes the last cubes. The *must act* + *last lap* rules remove that (0% in the 9,000-game engine test with mixed bots, and 0 of 90,000 same-strategy games).
* **Game length**: the original takes 50/73/118 turns on average (2/3/4 players) with a long tail up to 185. The final takes 29/35/41 turns, p90 = 35/44/53. At ~15–20 s per turn that's roughly 8–10 min (2p), 10–12 min (3p), 12–15 min (4p). The brief asked for 15–30 turns *each*; the final is 10–15 each, which is the better fit for an 8-year-old's attention span, and the dead turns are gone.
* **Runaway leader**: the player ahead at half-time wins 74–77% of the original games and 58–59% of the final ones. The underdog re-roll is what moved this. Without it, the number stays at 66–68% (see sweep).
* **Seat fairness**: still a small first-player edge (3p: 36/33/31, 4p: 28/26/25/22; the original had 38/33/29 and 30/26/23/21). This is inherent to "most cubes when the game stops mid-round", so the app picks the starting player **at random**.
* **Luck vs. skill**: a *smart* player beats purely random players 81% / 68% / 60% of the time in 2/3/4-player games (fair share would be 50 / 33 / 25%), so decisions matter, but luck still decides a lot (important for a children's game: the better planner does not always win).
* **Roll not fully used** went *up* (8–13% → 14–19%), because stealing gives only what the victim holds. It's a feature of stealing, not a bug.
* **Comeback** (winner was 2+ cubes behind at 70% of the game) is a rare 4–9% in both versions. Cubes are safe, so a big lead is real. The underdog re-roll and the last lap are the comeback tools. A bigger comeback mechanic (e.g. forced rubber-banding) was not tested, because it would punish good play too much.

## Which tweaks were tried (3 players, 3,000 games each; see `sweep-results.txt` for 2 and 4 players)
| Tweak | Verdict |
|---|---|
| Must act (can't decline to steal) | **Kept.** Removes endless-stall games; on its own no other effect. |
| Re-roll the color cube if the color is finished | **Kept.** Dead rolls 44% → 0%; game 24 → 14 turns/player. |
| Take **or** steal any time (not only when the pool is short) | **Kept.** Real decisions: 17% → 34% of turns alone, 60%+ combined. This is the "Clash". |
| Tie-break: colors → loose pieces → last cube | **Kept.** Ties 21% → 2%. |
| Underdog re-roll (behind in cubes → re-roll once) | **Kept.** Runaway: leader wins 67% → 57%. |
| Last lap when the pool is empty | **Kept.** Guarantees an ending, 4p games 14 → 10 turns each. |
| Roll 2 dice + 2 cubes and use one pair | Rejected as too fast (8.5 turns each, 97% of turns are "choose") and too skill-heavy (smart wins 91% vs random). It's still a good "advanced" idea for later. |
| Mix any number with any color | Same, even faster. |
| Everyone gets 1 re-roll every turn | Rejected: skill 83%, shorter, no extra fun. The underdog-only version keeps comebacks without taking luck away from everybody. |
| May take fewer than the die | Rejected: smart wins 92% vs random; too much "optimizing" for a kids' game. |
| Roll again after an exact cube | Rejected: increases runaway (leader wins 79%), more variance but not fairer. |
| Steal cap 3/4 | Rejected: makes games longer (35 turns/player at cap 3) without improving anything else. |
| No steals in the first round | Tried, no seat-fairness benefit. |
| First-player handicap (extra re-rolls for later seats) | Tried, ±1% effect. Not worth the extra rule; random starter instead. |
