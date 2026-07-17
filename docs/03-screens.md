# Screens and visual style

## Core principle

Not a "newspaper sheet" with a long page of text, but a **compact game board inside a Reddit post**: dark game board, compact HUD, large central puzzle area, bottom controls. The reference is an embedded-game format ~720-900 px wide, ~500-650 px tall, without scrolling (or with minimal scrolling).

## Style

The full token system (colors with verified WCAG contrasts, type scale, spacing, radii) is in [10-design-spec.md](10-design-spec.md). In brief:

- Dark navy surfaces - elevation ladder "higher = lighter" (`#0b101e → #131a2e → #1a2340 → #1f2846`);
- Orange `#ff8c42` - **only** primary CTA, progress, and brand echo (not Reddit orange #FF4500 - to stand apart from the system UI);
- Green - confirmed; saturated Red - only errors/violations (routine crossing-out uses a muted red-soft);
- Yellow - exclusively hints;
- Flairs - Okabe-Ito palette (CVD-safe) + **letter R/B/G/P in the chip**: state is never conveyed by color alone;
- Text - 3 steps (`--text/--text-2/--muted`), fonts - 8 steps of the scale, spacing - 4pt grid;
- Rounded panels, minimal clutter; tap targets ≥44px, honest horizontal scrolling of the board (sticky names + edge-fade) instead of squeezing elements.

## Screen 1. Main Gameplay

The board is "one board" (rows - suspects, columns - categories, candidate chips in the cells), without tabs. The tabbed variant was tested on the prototype and rejected: deduction chains jump between categories, and the state cannot be seen as a whole.

The clue panel shows the live status of each clue (🟢 satisfied / 🔴 violated / gray - unclear) - updated after every move. Hovering over a clue does NOT highlight the board - clues and the grid are visually independent.

```
┌────────────────────────────────────────────┐
│ Deducto                                    │
├────────────────────────────────────────────┤
│ Case #12: The Cursed Pizza Incident   🟡   │
│ 🔥 3 | ✔ 5/12 | ⏱️ 04:31                    │
├──────────────────────┬─────────────────────┤
│ Clue list             │ Logic Grid          │
│ (live status 🟢🔴,     │ (takes up the       │
│  board not highlighted)│  larger part of the │
│                        │  screen)            │
├────────────────────────────────────────────┤
│ ↺ ↩ ? ▷  ·  💡 Hint  ·  🏆 Results          │
└────────────────────────────────────────────┘
```

HUD (right side of the casebar): 🔥 streak, ✔ progress N/12, ⏱️ time. There is no error counter - in a two-state board there is no such thing as "wrong" moves: the case simply will not close until the layout becomes the single correct one. The difficulty badge sits next to the title: 🟢 warm-up (L0) or 🟡 daily (L1); there is no red/hardcore level in production (backlog).

Controls (left to right): ↺ Restart, ↩ Undo, ? Help, ▷ Warm-up (practicing the mechanic on an easy case), 💡 Hint. The 🏆 Results button appears only after the case auto-closes. There is no "Check solution" button: the case closes itself once all 12 cells are deduced and all clues are green. The solution and the timer live only on the server (anti-cheat) - the client never receives the solution.

## Screen 2. Focused Deduction Mode (not implemented)

There is no separate focus mode in the prototype: the board is a pure toggle of cell states, and deduction is done directly on the shared board (hovering over a clue does not highlight the board). Kept in the spec as a possible extension; the current prototype does not show it.

## Screen 3. Result

The case closes automatically, and a light result card (modal) rises over the dark board:

- **Case closed!** - card title;
- hero: final time and the line "faster than X% of detectives" (once statistics have accumulated) or "You're the Nth detective today" while there are still few solvers;
- stat line: 💡 number of hints, 🔥 streak (days in a row), 🔍 detective-rank with a countdown to the next rank;
- histogram of solve-time distribution, your bin marked "You" - appears once enough solvers have accumulated; on a demo/showcase post a labeled sample histogram is shown instead;
- **Today's fastest** - a mini leaderboard of the top-3 fastest for the day; if you are outside the top-3, a separate line with your result is added below;
- **Full solution** - a collapsed final table (Suspect / Coat / Time / Item), expands on tap;
- **Tomorrow's case - you decide** (only on daily posts; hidden on demo/showcase): a vote for the difficulty of the next case - 🔥 Harder / ⚖️ Same / 🌿 Softer - and a vote-bar with the vote shares; below it, the sealed envelope of the next case (CASE #N · SEALED) and a timer "Opens in Xh Ym";
- a **Play this case again** button.

Discussion of the line of reasoning happens in the native comment feed under the post. There is no separate share button or "trail" summary on the screen - removed on purpose.
