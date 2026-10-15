# Color Clash Cubes

A colorful pass-and-play web game for 2–4 players. **Invented by Gabriela Rubio (2025).**

**Play:** https://springlandscapequote-prog.github.io/color-clash-cubes/

Roll the number die and the color cube, collect `#` pieces, snap 6 of a color into a **safe cube 🔒**, or **steal** loose pieces from another player. Most cubes wins.

* Full kid-friendly rules: [RULES.md](RULES.md)
* How the rules were tested and tuned (simulator, numbers): [sim/RESULTS.md](sim/RESULTS.md)

## What changed and why
Gabriela's original game (`sim/original-rules.txt`) is the base: roll number die + color cube, take that many pieces, 6 of a color = a safe cube, steal when a color runs out, most cubes wins. Simulating thousands of games found five real problems, and each fix is the lightest one that worked:

| Problem in the original (sim) | Light fix | Result |
|---|---|---|
| 41–49% of rolls do nothing late in the game (the color is finished or empty) | If the cube lands on a color that is all built, it **rolls again** | dead rolls 0% |
| Almost no decisions (7–24% of turns): you just do what the dice say | You may **take OR steal any time** (not only when the pool is short) and pick who to steal from | real choice on 47–69% of turns |
| Games can **never end** if players decline to steal (72–89% of games with "hoard" players, 3–4p); original "no legal moves" end never triggers | **Must act** if you can, plus a **LAST LAP** (when the last piece leaves the pool, everyone else gets one more turn) | 0 never-ending games; 29/35/41 turns total for 2/3/4 players (was 50/73/118, with a tail to 185) |
| Ties for the win in 21–33% of games | Tie-breakers: **most colors**, then **most loose pieces**, then **built the last cube** | ties 0–2% |
| Leader at half-time wins 74–77% (cubes are safe, so leads stick) | **Underdog re-roll** 🔄: if someone has more safe cubes than you, re-roll once per turn | leader wins 58% |

Gabriela's core is untouched: one number die, one color cube, 72 pieces, 6 = a cube, safe cubes can't be stolen, most cubes wins.

### Assumptions where the original was ambiguous
* One number die + one color cube per turn (the component list also mentions 2 dice and 2 cubes; the extra pair is not used).
* If you take more pieces than you need, the extras stay loose in your pile.
* A steal takes from **one** other player per turn, as many as the die says (or all they have), never from safe cubes.
* If the pool has fewer pieces than the die says, you take what's left and may steal the remainder from one player.
* The starting player is picked at random (the first seat has a small natural edge).

## Run it locally
It is plain HTML/CSS/JS with no build step and no outside files: open `index.html`, or `python3 -m http.server`.
Add `?seed=123` for a repeatable dice sequence, `?fast=1` for quick animations, `?nosw=1` to skip the offline cache.

## Code map
| File | What |
|---|---|
| `js/game.js` | **Pure game rules** (no DOM). Used by both the app and the simulator. |
| `js/app.js` | The touch UI: screens, dice, stack animation, steal flow, scoreboard. |
| `css/style.css` | Styles (old-Safari friendly: no `inset`, `:has`, `??`, `?.`; `100vh` then `100dvh`; safe-area insets; reduced-motion respected). |
| `sim/` | Simulator, bots, results (`RESULTS.md`, `sweep-results.txt`). `node sim/test-engine.js` runs the rule checks. |
| `test/` | Playwright scripts that play full games in the real UI (touch and mouse). |
| `sw.js` | Tiny offline cache (network first). |

Names you type stay on the device (localStorage). Nothing is sent anywhere.
