# Deducto - docs

Design and engineering notes for **Deducto**, a daily deduction puzzle for Reddit built on Devvit Web. Start with the code (`../src`) and `../README.md`; these docs add the "why" and the deeper specs.

| Doc | What it is |
| --- | --- |
| [01-concept.md](01-concept.md) | The game concept - what Deducto is and the core idea. |
| [02-gameplay.md](02-gameplay.md) | Gameplay mechanics - how a case is solved (toggle-elimination, live clue status, auto-close). |
| [03-screens.md](03-screens.md) | Screen / UI spec (board, clues, result screen). |
| [04-puzzle-engine.md](04-puzzle-engine.md) | The deterministic difficulty engine and tier model. |
| [05-data-model.md](05-data-model.md) | Type shapes and the Redis data model. |
| [06-architecture.md](06-architecture.md) | System architecture - Devvit Web, Express server, endpoints, anti-cheat, engine + bank. |
| [09-design-decisions.md](09-design-decisions.md) | The decision / playtest journal - the source of truth for how things should work and why. |
| [10-design-spec.md](10-design-spec.md) | The design-token system (colors, type, spacing, radii). Design source of truth. |

The gaps in the numbering (07, 08, 11, 12) are removed hackathon-era planning docs (community-loop, MVP plan, hackathon brief/strategy, launch copy, the Devpost draft) - they described features that were cut or were one-off submission material, so they were deleted after the hackathon was submitted.

## Two caveats when reading these docs

1. **Brand.** The game was originally called *Logic Thread*; it is now **Deducto** (Devvit app slug `deducto-puzzle`). Any lingering "Logic Thread" in older notes is historical.
2. **Cut features.** Two things described in the earliest notes were removed and are NOT in the shipped game: the copy-to-thread **"trail"** share, and the 3-block **community loop** (post-solve vote / deduction / UGC screens). A lightweight per-day **difficulty vote** and a **top-3 leaderboard** did ship. Daily posting works from the moderator menu; the daily **scheduler is present in code but not wired** (paused pending subreddit whitelisting), so cases are posted manually for now.
