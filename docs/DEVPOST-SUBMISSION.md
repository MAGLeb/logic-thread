# Devpost submission copy — Logic Thread

Paste‑ready English text for the Devpost form. Fill the `<…>` placeholders before submitting.
Deadline: **2026‑07‑15, 18:00 PT.**

---

## Tagline (one line)

Logic Thread — a subreddit's daily detective ritual: the community sets each day's difficulty, you solve the case, and the thread is where everyone argues the logic.

> Positioning rule: lead with the **community ritual**, not "daily logic puzzle." A solo‑quiz framing reads as trivia in a 3‑minute judge pass; the community‑difficulty loop is the differentiator.

---

## Devpost form — field-by-field (copy each into its field)

- **Project name** (≤60): `Logic Thread — daily deduction`
- **Elevator pitch** (≤140, 126 chars): `A daily detective case, native to Reddit — the community sets the difficulty, you solve the grid, the thread argues the logic.`
- **About the project**: paste the **Project Story** block below.
- **Built with** (tags): `Devvit` · `Reddit Developer Platform` · `Devvit Web` · `TypeScript` · `Express` · `Redis` · `Vite` · `Node.js` · `HTML` · `CSS`
- **"Try it out" links**: `https://developers.reddit.com/apps/deducto-puzzle` · `https://www.reddit.com/r/deducto_puzzle/comments/1uxil53/deducto_try_a_case_the_cursed_pizza/` · `https://github.com/MAGLeb/logic-thread`
- **Image gallery**: board screenshot (3:2 ratio) + the result screen if you have one
- **Video demo link**: optional, <60s, public YouTube/Vimeo
- **Sponsor / Special Prizes**: check **Feedback Awards** *only if* you submit the feedback survey; leave **Devvit Helper** unchecked unless you helped others in the Devvit Discord. (Retention / User-Contributions sub-prizes are auto-considered — nothing to tick.)
- **Reddit username**: `ma9leb`
- **developers.reddit.com app page**: `https://developers.reddit.com/apps/deducto-puzzle`
- **Link to test post**: `https://www.reddit.com/r/deducto_puzzle/comments/1uxil53/deducto_try_a_case_the_cursed_pizza/` — must be r/deducto_puzzle, **Public at submission time** (see Internal notes → Visibility plan)
- **Nominate a most helpful user**: skip
- **Did you use Phaser?**: **No**

## Project Story — paste into "About the project" (Markdown)

```markdown
## Inspiration
Reddit threads are already full of people reasoning out loud — "it can't be X because Y." Logic Thread turns that instinct into a daily game: one provable case a day, where the comment thread becomes the place detectives argue the logic.

## What it does
Every day, one post is a fresh case — a 4×3 logic grid (4 suspects × Coat / Time / Item) with a single provable solution. You rule out the impossible; each clue lights up green when it's consistent, red when contradicted. When all 12 cells are deduced and every clue is green, the case auto-closes — no guessing. Hints reveal one correct fact. Solving shows your time, daily streak, rank, and a shareable "trail" to drop in the thread. The community then votes each day's difficulty (Harder / Same / Softer), which shapes tomorrow's case.

## How we built it
Reddit's Developer Platform (Devvit Web) with an Express server. The difficulty engine is a deterministic TypeScript port of a Python reference solver, parity-tested bit-for-bit — no AI. The solution and the timer live only on the server (Redis), so scores can't be cheated. A bank of 120 pre-generated, uniqueness-verified cases; a scheduler auto-posts one every day.

## Challenges we ran into
- Guaranteeing every generated case has exactly one solution (brute-force uniqueness) while keeping generation fast enough to build a 120-case bank.
- Making a logic grid feel fair and native inside a Reddit post at both desktop and mobile widths.
- Keeping it trustworthy: the client never receives the answer, yet still gives instant green/red clue feedback.

## What we learned
A bit-exact parity test between a Python solver and its TypeScript port; the Devvit Web client/server model; and designing a daily retention loop (streaks, leaderboard, community difficulty vote) that is native to a subreddit rather than bolted on.

## What's next
Player-authored cases, a hardcore (🔴) difficulty tier, and richer community stats.
```

---

## Inspiration / What it is

Reddit threads are already full of people reasoning out loud. Logic Thread turns that into a daily game: every day one post is a fresh **case** — a 4‑suspect × 3‑category logic grid (think Einstein / Zebra puzzle) with a single provable solution — and the comment thread becomes where detectives compare and defend their reasoning.

## What it does / How to play

- Each daily post opens an interactive grid: 4 suspects × 3 categories (Coat / Time / Item), plus a list of clues.
- You rule values **out** cell by cell. Each clue lights up 🟢 when it's consistent with your board, 🔴 when you've contradicted it.
- The solution is **unique** — when all 12 cells are deduced and every clue is green, the case **auto‑closes**. No guessing, no "submit."
- **💡 Hint** reveals one correct, not‑yet‑deduced fact (counted).
- Solving shows your **time**, **daily streak 🔥**, **rank/percentile**, a solve‑time **histogram** vs other detectives, and a shareable **trail** to paste into the thread. Tomorrow's case is sealed with a countdown.

## Why it keeps people coming back (category: Best Experience That Will Keep People Coming Back)

- **One fresh case every day**, auto‑posted by a scheduler (`cron 0 12 * * *`).
- **Per‑user streaks** and named ranks that grow the more days you return.
- A **leaderboard** (fastest solves) per case.
- A **Harder / Same / Softer** community difficulty vote that shapes the next day's case — the community tunes its own daily ritual.
- A copy‑to‑thread **trail** so solvers compare reasoning in the comments.

## How it's built

Reddit Developer Platform — **Devvit Web** (`@devvit/web@0.13.7`) + Express server. The difficulty engine is a deterministic TypeScript port of a Python reference solver, **parity‑tested** (no AI/LLM anywhere). The case solution and timer live only on the server (Redis) — the client never receives the answer, so scores are trustworthy. Bank of **120** pre‑generated, uniqueness‑verified cases. Mobile‑ and desktop‑ready webview.

## Built for this hackathon

Newly created during the submission period (built July 2026, after the June 17 start) — engine, Devvit port, server, webview and case bank were all made for *Games with a Hook*.

## Testing instructions (for judges)

1. Open the demo post: **https://www.reddit.com/r/deducto_puzzle/comments/1uxil53/deducto_try_a_case_the_cursed_pizza/** (public subreddit **r/deducto_puzzle**, kept live through judging).
2. The game runs inside the post — no login needed to play. Rule cells out; clues turn green; solve to see time / streak / rank / histogram.
3. Optional: solving unlocks the shareable trail, the difficulty vote, and tomorrow's sealed case.

App listing: **developers.reddit.com/apps/deducto-puzzle**

---

## Image gallery — captions & order (up to 15, 3:2; first image = hero)

1. **Mid-solve board** (131) — `The daily case: rule out the impossible across 4 suspects × Coat/Time/Item. Clues turn green when they hold, red when contradicted.`
2. **Case closed / result** (134) — `Solve to reveal your time, streak, rank and a spoiler-free trail to share — plus tomorrow's case, its difficulty set by the community.`
3. **Onboarding** (71) — `First-timers get a 3-step coached intro on a real case — no rules wall.`
4. **Hint** (90) — `Stuck? A hint reveals one correct, not-yet-deduced fact — counted, so speed still matters.`

Notes:
- 4 screens are enough. Optional +1: a phone-width shot to show responsive play.
- ⚠️ Use only **English-titled** posts for screenshots. The result shot with the Russian post title («Дело о выброшенном кофе») must be retaken from an English case (e.g. Case #10 "The Jettisoned Coffee") or have its title bar cropped.

## Demo post title & pinned header (trivia inoculation)

Frame each case as community‑authored difficulty, not a solo quiz — this is the causality a 3‑minute judge must see up front.

- **Post title:** e.g. `Case #<N>: the community voted this one HARD 🔴 — can you close it?`
- **Pinned first comment:** one line on the daily ritual + the Harder/Same/Softer vote that set today's difficulty, then invite detectives to drop their solve **trail** and argue the logic.

## App listing description (paste in the developer portal)

> The listing at `developers.reddit.com/apps/deducto-puzzle` is edited manually in the developer portal (not from `devvit.json`). Replace the old text with this:

**Logic Thread — a daily detective case for your community**

Logic Thread turns a subreddit into a daily deduction game. Every day, one post is a fresh case: a 4×3 logic grid with a single, provable solution. Members rule out the impossible, watch each clue turn green, and close the case — then compare and defend their reasoning in the comments.

- 🗓️ One new case daily (auto‑posted)
- 🔥 Personal solving streaks and ranks
- 🏆 Per‑case leaderboard by solve time
- 🗳️ The community votes each day's difficulty (Harder / Same / Softer)
- 🧵 A shareable solve "trail" to argue the logic in the thread

No player setup — the game runs right inside the post. Add it to your community and a daily case appears automatically.

## Links to fill on the form
- App listing URL: `https://developers.reddit.com/apps/deducto-puzzle`
- Demo subreddit: `r/deducto_puzzle` (public at submission, <200 members, live through 2026‑07‑27)
- Demo post permalink: `https://www.reddit.com/r/deducto_puzzle/comments/1uxil53/deducto_try_a_case_the_cursed_pizza/`
- Demo video (optional, <60s, public on YouTube/Vimeo): `<…>`
- Public repo: `https://github.com/MAGLeb/logic-thread`

## Internal notes — DO NOT put on the form
- **Do not** claim the *Best Use of Phaser* track — the app does not use Phaser.
- **Do not** claim *Best Use of User Contributions* — there is no player‑authored content (case authoring is moderator‑only).
- The most defensible sub‑track is **Best Use of Retention Mechanics** (daily cron, streaks, leaderboard, difficulty vote). Realistic ceiling: Honorable Mention / Retention.
- Country of residence everywhere = **Serbia** (never Russia). Payout to a non‑Russian account.
- **Subreddit history:** the original public demo sub `r/LogicThreadDaily` was **banned under Reddit Rule 2** (content manipulation / spam). Replacement is **`r/deducto_puzzle`**. The ban was behavioral, not about the app or the name — the deployed app `deducto-puzzle` and the private dev sub `logic_thread_dail_dev` were untouched.
- **Visibility plan:** keep `r/deducto_puzzle` **private during build** (ban-safe — private subs aren't hit by public-feed anti-spam), then **flip it to Public shortly before submitting** the Devpost link and keep it live + <200 members through judging (2026‑07‑27). Do **not** re-trigger the ban: no alt-account voting/testing, add real rules + a description, let the daily cron post gently. A private sub cannot host a judge-visible post — you can't pre-approve anonymous judges, so private-with-invite is not a viable substitute for Public.
