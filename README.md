<p align="center">
  <img src="assets/banner.png" alt="Deducto - daily deduction" width="880">
</p>

# Deducto - a daily deduction game for Reddit

**One post a day. One logic grid. One provable answer.** Rule out the impossible, watch every clue turn 🟢, close the case - then defend your reasoning in the comments and come back tomorrow for the next one.

**▶ Play the live demo: [Deducto - The Cursed Pizza](https://www.reddit.com/r/deducto_puzzle/comments/1uxil53/deducto_try_a_case_the_cursed_pizza/)** in [r/deducto_puzzle](https://www.reddit.com/r/deducto_puzzle/)

Built on the **Reddit Developer Platform** - Devvit Web, `@devvit/web@0.13.7`. A submission for Reddit's *Games with a Hook* hackathon.

---

## The daily loop

Every day one post becomes a fresh **case**: a 4-suspect × 3-category logic grid (Coat / Time / Item) with a single, provable solution. Tap a cell to rule a value **out** for a suspect; each clue lights 🟢 when your board is consistent with it, 🔴 when it's contradicted. The solution is **unique** - the moment all 12 cells are deduced and every clue is green, the case **auto-closes**. No "submit" button, no guessing. A tidy 3-5 minute habit.

## The hook - why detectives come back

- 🗓️ **A new case every day** - published by a moderator from the menu (an optional daily scheduler ships in the code).
- 🔥 **Streaks & ranks** - solve daily to climb 🔎 Detective → 🕵️ Inspector → 🎩 Chief Inspector → 🧠 Mastermind → 🏛 Legend of the Yard.
- 🏆 **Per-case leaderboard** - the day's three fastest detectives, plus your own rank and time.
- 🗳️ **Community difficulty vote** - after solving, everyone votes **Harder / Same / Softer**; the majority sets tomorrow's case.
- 💬 **Native discussion** - one shared case a day means detectives compare and defend their deductions right in the comments.
- 💡 **Hints, honestly counted** - stuck players can reveal one true fact; every hint is recorded, so the board stays fair.
- 🌱 **Opt-in warm-up** - first-timers can try one throwaway easy case to learn the mechanic, then jump into today's.

The whole loop lives inside a single Reddit post - nothing ever leaves the platform.

## Add it to your community (moderators)

1. On the app page, click **Add to community** and choose your subreddit.
2. Publish a case: subreddit menu (⋯) → **"Deducto: publish a case"** (or **"publish showcase"** for a fixed sample case).
3. The game is fully server-authoritative; see **App permissions** on this page for exactly what it touches.

## Under the hood

- **Server-authoritative & cheat-resistant.** The solution and the timer live only on the server (Redis); the webview receives the grid **without** the answer. Because every case has a unique solution, "all clues green + board full" provably equals the correct answer - there is no client-side check to spoof.
- **Deterministic engine, no AI.** The difficulty engine is a 1:1 TypeScript port of a Python reference solver, **parity-tested** clue-for-clue. Cases are generated and verified offline into a bank of **120** hand-checked puzzles.
- **Native Devvit Web.** `express` + `createServer`; `/api/*` serves the webview, `/internal/*` handles the moderator menu.

<details>
<summary><strong>Server endpoints</strong></summary>

- `GET  /api/daily` - today's case (no solution) + saved progress + server timer.
- `POST /api/state` - grid autosave + active play-time.
- `POST /api/hint` - reveal one correct, not-yet-deduced fact (server-counted).
- `POST /api/vote` - cast the Harder / Same / Softer vote that sets tomorrow's difficulty.
- `POST /api/check` - validate the solution → time, streak, rank + today's leaderboard.
- `GET  /api/practice`, `POST /api/practice/state|check` - the opt-in warm-up case for first-time players.
- `POST /internal/menu/create-post` - moderator menu: publish today's case.
- `POST /internal/menu/create-showcase` - moderator menu: publish the fixed demo/showcase post.
</details>

<details>
<summary><strong>For developers - run, verify, extend</strong></summary>

Devvit requires **Node ≥ 22** (`nvm install 22 && nvm use 22`).

```bash
cd deducto
npm install
npm run login            # devvit login
# put a test subreddit in devvit.json → "dev": { "subreddit": "..." }
npm run dev              # build client + server (watch) + devvit playtest
```
In the playtest subreddit: menu (⋯) → **"Deducto: publish a case"** → the game post opens.

**Verified before every deploy:**
- ✅ `npm test` - engine parity vs Python (clue anchors 🟡/🟢/🔴 and the generator match 1:1).
- ✅ `npm run build:bank` - 120/120 cases, each unique and the right tier.
- ✅ `npx tsx scripts/smoke-status.ts` - on the solution every clue is green and client & server agree.
- ✅ `npm run type-check` - clean.

**Structure:** `src/shared` (clue types, themes, clue→English render, live status) · `src/server` (`engine.ts`, `index.ts`, `bank.json`) · `src/client` (`index.html`, `main.ts`).

**New themes / bank:** add a pack to `src/shared/themes.ts` (4 names, 4 items, legend), then `npm run build:bank` (deterministic). The 🔴 tier is intentionally excluded - an order of magnitude costlier to generate, and reserved for a future "hardcore" mode.
</details>

## What's Next

- **🏆 Deeper leaderboards** - weekly and all-time boards next to today's top-3, a longest-streak ranking, head-to-head "same case, who's faster" challenges, and a cross-community global board.
- **✍️ Player-created cases** - let members design and submit their own grids; the engine auto-verifies a single provable solution before a case can go live.
- **🔴 Hardcore difficulty** - a new tier that demands full cross-referencing (currently excluded from the bank), for detectives who crack the daily too fast.
- **📊 Richer community stats** - per-case "hardest deduction" breakdowns, solve-time trends, and difficulty-vote history.
- **🗓️ Seasons** - monthly resets with a hall of fame, keeping the leaderboard fresh for regulars.

## Hackathon

Submission for **Reddit - Games with a Hook**.

- **Live demo post:** [Deducto - The Cursed Pizza](https://www.reddit.com/r/deducto_puzzle/comments/1uxil53/deducto_try_a_case_the_cursed_pizza/)
- **App listing:** developers.reddit.com/apps/deducto-puzzle
