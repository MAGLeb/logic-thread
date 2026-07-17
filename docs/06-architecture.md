# Architecture (Devvit Web)

Deducto is a daily deduction puzzle shipped as a single Reddit interactive post.
The whole thing is one Devvit Web app: a webview client plus an Express server that
is the source of truth. There is no external backend and no database beyond Redis.

## Stack

- `@devvit/web` 0.13.7 (Devvit Web interactive post + `createServer` / `getServerPort`).
- Client: vanilla TypeScript, no framework. `src/client/main.ts` + `src/client/index.html`,
  bundled with Vite into `dist/client`.
- Server: Express 5 (`express` 5.1.0) mounted on the Devvit server, built with Vite into
  `dist/server/index.cjs`.
- Storage: Devvit Redis (`redis` from `@devvit/web/server`) and Reddit API (`reddit`), scope `user`.
- Shared TypeScript in `src/shared/` is imported by both client and server (types, live clue
  status, themes, clue rendering).

## Repo / build layout

```
src/client/     index.html + main.ts        -> dist/client   (the post webview)
src/server/     index.ts  + engine.ts        -> dist/server   (Express app)
src/server/     bank.json                     120 prebuilt cases (imported by the server)
src/shared/     types.ts status.ts themes.ts render.ts   (client + server)
scripts/        build-bank.ts, difficulty.ts, ...        (offline tooling)
devvit.json     Devvit config (post/server dirs, permissions, mod menu)
```

`npm run build` runs `build:bank` (regenerates `bank.json`), then `build:client`, then
`build:server`. `devvit.json` points the post at `dist/client/index.html` (entry `default`,
height `tall`) and the server at `dist/server/index.cjs`.

## Client (`src/client/main.ts`)

Rendering and input only. It fetches the case from the server, keeps the local grid state,
runs a display timer, and posts moves back. It never receives the solution.

- Board: 4 suspects x 3 categories (flair = Coat, time = Time, object = Item) = 12 cells.
  Each cell shows chips for its candidate values.
- Cell interaction is a two-state toggle per chip: unknown (0) <-> crossed out (1). Ruling a
  value out narrows the cell; when a single candidate survives, that survivor is the deduced
  answer (`effectiveValue` in `shared/status.ts`). `status.ts` also models a third "confirmed"
  state (2), but the shipped daily board only uses the 0/1 toggle.
- Live feedback is computed purely from the player's own marks, never from a hidden solution:
  `clueStatus()` grades each clue green (ok) / red (violated) / gray (open); `effectiveValue`
  fills the answer column.
- Auto-close: `maybeFinalize()` fires as soon as all 12 cells have an effective value and every
  clue is green. There is NO "Check solution" button and no "mistakes" counter. On auto-close it
  POSTs `/api/check`; the server confirms and returns the result overlay.
- Other UI: hint log (paged, server-backed), undo, board reset (two-tap confirm), a server-tracked
  first-visit tutorial, and an opt-in single warm-up practice case that lives on its own endpoints.
- Persistence: the grid and active seconds are debounced to `/api/state`; the timer only counts
  while the tab is visible and the case is unsolved.

## Server (`src/server/index.ts`, source of truth)

Express router mounted via `createServer(app)` / `server.listen(getServerPort())`.
It owns the solution, the clock, the leaderboard, the vote tally, and streaks.

- Serves the case for the current post (`postData.idx` selects the bank entry; falls back to a
  day-based index in dev), stripped of the solution.
- Grades submissions server-side (`gradeGrid`): a grid is "solved" only when all 12 cells are
  determined and every cell matches the stored solution. Because every bank case has a unique
  solution, "all cells deduced + all clues green" on the client is equivalent to correct, which
  the server re-verifies.
- Records solve time, finishing order, hints, leaderboard (sorted set), streak, and the
  next-day difficulty vote.

## HTTP endpoint map

Webview API (`/api/*`):

| Method | Path | Purpose |
| --- | --- | --- |
| GET  | `/api/daily`          | Case (no solution) + the user's attempt + meta (solvers, streak, vote tally, tutorial flag, next-open countdown). |
| POST | `/api/state`          | Persist grid and active seconds (monotonic; only advances). |
| POST | `/api/hint`           | Reveal the next undetermined cell (or `reveal:false` to just re-read the hint log). Counts only new reveals. |
| POST | `/api/vote`           | Record a Harder / Same / Softer vote for tomorrow's difficulty (must have solved; one vote per user). |
| POST | `/api/check`          | Grade the grid; on solve, write time/order/leaderboard/streak and return the results payload. |
| GET  | `/api/practice`       | Serve the warm-up practice case (isolated lane). |
| POST | `/api/practice/state` | Persist the practice grid. |
| POST | `/api/practice/check` | Grade the practice grid; on solve, advance the per-user warm-up counter. |

Internal endpoints (`/internal/*`, called by the mod menu / cron):

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/internal/menu/create-post`     | Mod menu: publish the next daily case (applies the vote ramp, rotates the bank). |
| POST | `/internal/menu/create-showcase` | Mod menu: publish the fixed judge/demo case, decoupled from the ramp. |
| POST | `/internal/cron/daily-post`      | Cron handler for daily posting. Present but NOT wired: `devvit.json` has no scheduler block. |

The two mod-menu items are declared in `devvit.json` (moderator, subreddit location). The daily
scheduler is intentionally not registered: Reddit automod kept banning the auto-posted thread, so
daily posts are created manually via the mod menu. Re-adding a `cron "0 12 * * *" ->
/internal/cron/daily-post` block re-enables auto-posting with no code change.

## Redis key schema

Per post / per user attempt:

- `att:{postId}:{userId}` - hash: `startedAt`, `grid`, `activeSec`, `hints`, `hinted`,
  `solved`, `solvedAt`, `timeSec`, `solveOrder`, `vote`.
- `lb:{postId}` - sorted set (leaderboard), member = username, score = solve time in seconds.
- `vote:{postId}` - hash of Harder / Same / Softer counts.
- `solvedCount:{postId}` - counter used to assign finishing order.
- `streak:{userId}` - hash: `current`, `best`, `lastDate`.
- `tut:{userId}` - marks the first-visit tutorial as seen.

Global daily-series state:

- `lt:level` - current difficulty level (0 or 1).
- `lt:lastPostId` - previous daily post id (for the epilogue and the vote ramp).
- `lt:bucketCursor:{level}` - rotation cursor within a level's case bucket.
- `bank:cursor` - monotonic case number for post titles.

Practice / onboarding lane (isolated from the daily; no leaderboard/vote/streak):

- `onb:{userId}` - number of warm-ups completed.
- `pract:{userId}:{k}` - practice attempt grid for warm-up index `k`.

## Anti-cheat

Server-authoritative by construction:

- The solution never leaves the server. `/api/daily` returns suspects, tokens, and clues only.
- "Solved" is derived, not asserted by the client: the client can only reach the solved state by
  actually deducing all 12 cells with every clue green; the server re-grades against the stored
  solution before recording anything.
- The timer is server-bounded. The client reports active play seconds, but `/api/check` clamps the
  recorded time to `[1, wall-clock since startedAt]`, so a client cannot claim an impossibly fast
  solve.

## Difficulty engine + case bank

`src/server/engine.ts` is a deterministic TypeScript port of a Python reference solver
(parity-checked by `engine.test.ts`):

- Seeded RNG (mulberry32) with an `xmur3` string seed of the form `subredditId:date:themeId`, so
  generation is reproducible.
- Clue shapes (see `src/shared/types.ts`): `ne` (suspect is not a value), `same` / `nsame` (two
  attributes share / do not share an owner), `before` (one time precedes another).
- `classify()` tiers a case using two solver models: green = solvable by the weak model (per-suspect
  domains, i.e. deducible directly on the board), yellow = needs the grid model (pairwise +
  transitivity, i.e. cross-referencing), red = not even grid-solvable.
- `generate()` builds a case of a requested tier: seeded solution -> pool of true clues -> minimize
  to a unique-solution set.

`scripts/build-bank.ts` runs offline (`npm run build:bank`, default 120 cases) and writes
`src/server/bank.json`. Every entry is verified for its tier and for a unique solution. The build
tiers every 6th case green and the rest yellow; red is deliberately not generated for the daily bank
(its generation is far more expensive). Each entry also carries an offline difficulty `score` and
quantile `bin`, kept for future work and case variety. The server imports `bank.json` directly, so
runtime never generates puzzles.

## Difficulty ladder + vote ramp

The shipped ladder is an honest two levels; there is no red/hardcore tier in production.

- L0 = green (warm-up, solvable on the board) and L1 = yellow (daily, needs cross-referencing).
  A 12-agent + solver measurement showed the score bins do not map to felt difficulty inside
  yellow, so the vote moves the real green <-> yellow step only. Red is backlog: adding red cases
  would give a genuine third step and let the cap rise.
- The daily default level is L1 (yellow). `createDailyPost()` shifts the global `lt:level` by the
  previous post's community vote, then picks a case from that level's bucket, rotating within it.
- Vote ramp constants (`src/server/index.ts`): `MIN_LEVEL = 0`, `MAX_LEVEL = 1`,
  `DEFAULT_LEVEL = 1`, `VOTE_MIN_TOTAL = 5` (significance gate), `VOTE_MIN_LEAD = 0.10` (the leading
  choice must beat the runner-up by at least 10 points). Below the gate or without a clear leader,
  the level is unchanged.
- The showcase (judge/demo) post is fixed to a known green case and is fully decoupled from the ramp:
  it does not bump the bank cursor, is not linked into the daily chain, and its votes are never read.
