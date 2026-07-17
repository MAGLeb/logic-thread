# Gameplay and mechanics (Deducto)

## Logic grid

The core entity is a **suspect**. All other categories are matched against suspects. The player solves everything on a single board (rows - suspects, columns - categories: Flair, Time, Object), without tabs. The grid is fixed: 4 suspects x 3 categories = 12 cells. We do NOT show the huge classic grid with all sub-tables - too heavy for the Reddit UI.

## Cell states

```
type Cell = 0 | 1 | 2   // 0 = unknown, 1 = crossed out, 2 = confirmed
```

On the board, tap toggles only 0 <-> 1 (normal <-> crossed out); the engine supports state 2, but the UI never sets it - the "confirmed" answer surfaces on its own as the only remaining candidate. The main board view is "single board": rows - suspects, columns - categories, with candidate chips inside each cell (validated on the prototype, it beat tabs).

## Interaction: pure toggle (no confirmation)

The main principle is that **nothing happens by itself** on the board. Every change is made by the player; no cascades, no auto-crossing-out, no auto-confirmations (playtests 2-3: any automation, even local, blurs the understanding of what is happening).

In the "single board", a chip has only two states - normal and crossed out:

- tap on a candidate - cross out / restore (pure toggle: tapped = activated / deactivated);
- there is no separate "confirm". When a single non-crossed-out candidate remains in a cell, it is the answer (it stands out on its own against the dimmed crossed-out ones) - but it stays a regular toggle chip: tapping it simply crosses it back out;
- undo reverts exactly one move (one cell).

Crossing out is the only action. The n/12 counter counts the single remaining (non-crossed-out) candidate in each cell as an answer - **"I crossed everything out" = "I solved it"** (playtests 1 and 4). All options are always visible, nothing collapses: while solving, it is important to see the crossed-out options too (playtest 4).

## Live clue status

Clues in the list are highlighted based on the player's current marks:

- 🟢 satisfied (ok);
- 🔴 violated (marks contradict the clue - check your moves);
- gray - not yet clear (open).

The status is computed from the player's marks, not from the hidden solution - honest feedback without spoilers. Hovering over / selecting a clue does NOT highlight or outline the board cells (playtest 3: this was confusing) - clues and the board are visually independent.

## Auto-closing the case (no "Check" button, no mistakes)

There is no separate "Check case" button, and there is no concept of a "mistake" either. The case closes on its own as soon as both conditions are met simultaneously:

1. **all 12 cells are deduced** - exactly one non-crossed-out candidate remains in each of the 4x3 cells (effectiveCount == suspects x categories);
2. **every clue is green** - clueStatus for all clues equals `ok`.

As soon as both conditions align, the client itself submits the grid to the server (`/api/check`), the server checks it against the hidden solution (anti-cheat: the solution and the timer live ONLY on the server, the client never receives them) and returns `solved` -> result screen. Since the case has a single solution, "all cells deduced + all clues green" = the correct answer; you cannot lose or "get a mistake". An incomplete or contradictory grid simply does not trigger the close - the player keeps solving.

## Hints (3 levels, the first is enough for the MVP)

1. Highlight a useful clue and the related entities.
2. Highlight the relevant row/column.
3. Place one forced deduction.

## Discussing the solution in the comments

There is no separate in-game card mechanic. After solving, the player explains their line of reasoning organically in the comments on the daily post - and there they argue and cross-check the chain with other detectives:

> 🧠 Clue 2 + Clue 5 prove: Mira could not have had a yellow flair.

The comments are a board for deductions and debates about the solution, living natively in the Reddit thread.

## Game states

1. **Not started** - case title, the grid and the first clue right away (no separate Start screen).
2. **In progress** - timer, hints, active clue, grid, controls.
3. **Solved** - both auto-close conditions have aligned, the server confirmed -> transition to the result screen.
4. **Post-solve** - result (time / streak / percentile), discussion in the comments, countdown to the new case, leaderboard.

While solving, do NOT show: leaderboard, long lists. All of that is a reward after solving.
