// Deducto - Devvit Web server (source of truth).
// /api/* - webview; /internal/* - menu & cron (daily post creation).
// The case solution and the timer live only on the server (anti-cheat); the client gets no solution.

import { createServer, getServerPort, context, reddit, redis } from "@devvit/web/server";
import express from "express";
import type { Clue, Solution } from "../shared/types.js";
import { effectiveValue, effectiveCount, type GridState, type PuzzleCtx } from "../shared/status.js";
import { FLAIR_TOKENS, TIME_TOKENS, THEME_BY_ID } from "../shared/themes.js";
import bankData from "./bank.json";

interface BankEntry {
  themeId: string;
  tier: "green" | "yellow" | "red";
  suspects: string[];
  objectTokens: string[];
  clues: Clue[];
  solution: Solution;
  score?: number; // offline difficulty score (build-bank.ts)
  bin?: number;   // quantile difficulty bin (0..N-1) - the daily ramp reads this
}
const BANK = bankData as unknown as BankEntry[];
const CAT_IDS = ["flair", "time", "object"];

type VoteChoice = "Harder" | "Same" | "Softer";
const VOTE_CHOICES: VoteChoice[] = ["Harder", "Same", "Softer"];
const TIER_OF: Record<VoteChoice, string> = { Harder: "HARD", Same: "SAME", Softer: "SOFT" };

// solve-time histogram bins (shared shape with the client)
const TIME_BINS = [120, 180, 240, 300, 420, 600, 900, Infinity];
const HIST_MIN = 50; // prod rule: distribution/percentile only at N ≥ 50

// ───────────────────────── vote → difficulty ladder (honest) ─────────────────────────
// A 12-agent + solver measurement showed the score bins DON'T map to felt difficulty inside 🟡
// (weak_stuck / grid-rounds / human deduction-steps all flat across the yellow bins - fewer clues
// ≠ harder). With a fixed 4×3 board and no 🔴 in the bank there are only TWO honest steps:
//   L0 = 🟢 green (solvable on the board) · L1 = 🟡 yellow (needs cross-referencing).
// So the vote-ramp moves the real 🟢↔🟡. BACKLOG: add 🔴 cases → a genuine 3rd step + lift the cap
// under a strong majority. (score/bin stay in bank.json for that future work + case variety.)
const MIN_LEVEL = 0;
const DEFAULT_LEVEL = 1;    // daily default is 🟡
const VOTE_MIN_TOTAL = 5;   // significance gate (prod). Drop to 1 for solo playtest.
const VOTE_MIN_LEAD = 0.10; // leader must beat the runner-up by ≥10 points

function buildLevelBuckets(): number[][] {
  const green: number[] = [], yellow: number[] = [];
  BANK.forEach((e, i) => { (e.tier === "green" ? green : yellow).push(i); });
  return [green.length ? green : yellow, yellow.length ? yellow : green];
}
const LEVEL_BUCKETS = buildLevelBuckets();
const MAX_LEVEL = LEVEL_BUCKETS.length - 1; // = 1 (🟢/🟡) until 🔴 is added
const LEVEL_LABELS = ["warm-up", "daily deduction"];

// Fixed judge/demo case, decoupled from the vote ramp. Green (weak-forced → solvable on the board,
// no cross-referencing, no guessing) so it's ~3 min, but NOT trivial: the opening needs combining
// clues 1+2+5 to pin coat↔time, then a before-chain. Interesting but easy - verified by hand.
const SHOWCASE_IDX = 72; // The Cursed Pizza, green, 10 clues, time-backbone John→Paul→Omar→Mira

// Shift the level by the previous day's vote (raw majority with a significance gate).
function levelFromVote(level: number, tally: Record<VoteChoice, number>): number {
  const total = tally.Harder + tally.Same + tally.Softer;
  if (total < VOTE_MIN_TOTAL) return level;
  const sorted = VOTE_CHOICES.slice().sort((a, b) => tally[b] - tally[a]);
  if ((tally[sorted[0]] - tally[sorted[1]]) / total < VOTE_MIN_LEAD) return level; // no clear winner
  if (sorted[0] === "Harder") return Math.min(MAX_LEVEL, level + 1);
  if (sorted[0] === "Softer") return Math.max(MIN_LEVEL, level - 1);
  return level; // "Same"
}

// ── Onboarding: warm-up practice lane (own keys, isolated from the daily) ──
const ONBOARD_N = 1;                                     // exactly one warm-up before the real daily
const WARMUP_IDX = 78;                                   // very easy green (over-clued, score -2): just teach the mechanic
function warmupIdx(_k: number): number { return WARMUP_IDX; }
const onbKey = (userId: string) => `onb:${userId}`;      // # warm-ups completed (0..N)
const pAttKey = (userId: string, k: number) => `pract:${userId}:${k}`; // practice attempt (own grid)

// ───────────────────────── helpers ─────────────────────────
function ctxFor(entry: BankEntry): PuzzleCtx {
  return {
    suspects: entry.suspects,
    catIds: CAT_IDS,
    cats: { flair: [...FLAIR_TOKENS], time: [...TIME_TOKENS], object: entry.objectTokens },
    timeValues: [...TIME_TOKENS],
  };
}

type PostMeta = { idx?: number; date?: string; n?: number | null; level?: number; showcase?: boolean; epilogue?: EpilogueData | null };
type EpilogueData = { who: string; timeSec: number; solvers: number; tier: string; pct: number };

function postMeta(): PostMeta { return (context.postData as PostMeta | undefined) ?? {}; }

function bankIndexForPost(): number {
  const idx = postMeta().idx;
  if (typeof idx === "number") return ((idx % BANK.length) + BANK.length) % BANK.length;
  const day = Math.floor(Date.now() / 86_400_000);
  return day % BANK.length;
}
function caseNumber(): number { return postMeta().n ?? bankIndexForPost() + 1; }

function todayStr(): string { return postMeta().date ?? new Date().toISOString().slice(0, 10); }
function prevDay(d: string): string {
  return new Date(Date.parse(d + "T00:00:00Z") - 86_400_000).toISOString().slice(0, 10);
}
function minutesToUtcMidnight(): number {
  const now = Date.now();
  const next = new Date(now); next.setUTCHours(24, 0, 0, 0);
  return Math.max(0, Math.round((next.getTime() - now) / 60000));
}

const attKey = (postId: string, userId: string) => `att:${postId}:${userId}`;
const lbKey = (postId: string) => `lb:${postId}`;
const voteKey = (postId: string) => `vote:${postId}`;
const solvedCountKey = (postId: string) => `solvedCount:${postId}`;
const streakKey = (userId: string) => `streak:${userId}`;

function gradeGrid(entry: BankEntry, grid: GridState): "incomplete" | "wrong" | "solved" {
  const ctx = ctxFor(entry);
  if (effectiveCount(ctx, grid) !== ctx.suspects.length * CAT_IDS.length) return "incomplete";
  for (const c of ctx.catIds)
    for (const s of ctx.suspects)
      if (entry.solution[s][c] !== effectiveValue(ctx, grid, c, s)) return "wrong";
  return "solved";
}

function publicPuzzle(entry: BankEntry, idx: number) {
  const theme = THEME_BY_ID[entry.themeId];
  return {
    idx, caseNumber: caseNumber(), themeId: entry.themeId, tier: entry.tier,
    level: postMeta().level ?? DEFAULT_LEVEL,
    title: theme?.title ?? "Case", legend: theme?.legend ?? "",
    suspects: entry.suspects, objectTokens: entry.objectTokens, clues: entry.clues,
    day: todayStr(),
  };
}

async function voteTally(postId: string): Promise<Record<VoteChoice, number>> {
  const h = await redis.hGetAll(voteKey(postId));
  return { Harder: Number(h.Harder ?? 0), Same: Number(h.Same ?? 0), Softer: Number(h.Softer ?? 0) };
}
function voteLeader(t: Record<VoteChoice, number>): { tier: string; pct: number; total: number } {
  const total = t.Harder + t.Same + t.Softer;
  if (total === 0) return { tier: "SAME", pct: 0, total: 0 };
  const top = VOTE_CHOICES.reduce((a, b) => (t[b] > t[a] ? b : a), "Same" as VoteChoice);
  return { tier: TIER_OF[top], pct: Math.round((t[top] / total) * 100), total };
}

// ───────────────────────── app ─────────────────────────
const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

const router = express.Router();

router.get("/api/daily", async (_req, res) => {
  const idx = bankIndexForPost();
  const entry = BANK[idx];
  const postId = context.postId ?? "dev";
  const userId = context.userId;

  let attempt = { grid: null as GridState | null, hints: 0, solved: false, elapsedSec: 0, vote: null as string | null };
  let showTutorial = false; // guests (no userId) never get it; set true below only for a logged-in first-timer

  if (userId) {
    const key = attKey(postId, userId);
    const h = await redis.hGetAll(key);
    if (!h.startedAt) await redis.hSet(key, { startedAt: String(Date.now()) });
    else {
      const solvedFlag = h.solved === "1";
      attempt = {
        grid: h.grid ? (JSON.parse(h.grid) as GridState) : null,
        hints: Number(h.hints ?? 0),
        solved: solvedFlag,
        elapsedSec: solvedFlag ? Number(h.timeSec ?? 0) : Number(h.activeSec ?? 0),
        vote: h.vote ?? null,
      };
    }
    const seenTut = await redis.get(`tut:${userId}`);
    showTutorial = !seenTut;
    if (!seenTut) await redis.set(`tut:${userId}`, "1");
  }

  const solvers = await redis.zCard(lbKey(postId));
  const tally = await voteTally(postId);
  const streak = userId ? Number((await redis.hGetAll(streakKey(userId))).current ?? 0) : 0;

  res.json({
    puzzle: publicPuzzle(entry, idx),
    attempt,
    meta: {
      solversTotal: solvers,
      streak,
      showcase: postMeta().showcase ?? false,
      epilogue: postMeta().epilogue ?? null,
      vote: { choice: attempt.vote, tally, leader: voteLeader(tally) },
      showTutorial,
      nextOpensInMin: minutesToUtcMidnight(),
      nextCaseNumber: caseNumber() + 1,
    },
  });
});

router.post("/api/state", async (req, res) => {
  const userId = context.userId;
  const postId = context.postId ?? "dev";
  if (!userId) { res.json({ ok: false }); return; }
  const key = attKey(postId, userId);
  const grid = (req.body?.grid ?? null) as GridState | null;
  if (grid) await redis.hSet(key, { grid: JSON.stringify(grid) });
  const seconds = Number(req.body?.seconds);            // active play-time (client-owned, monotonic)
  if (Number.isFinite(seconds) && seconds >= 0) {
    const prev = Number((await redis.hGetAll(key)).activeSec ?? 0);
    if (seconds > prev) await redis.hSet(key, { activeSec: String(Math.round(seconds)) });
  }
  res.json({ ok: true });
});

router.post("/api/hint", async (req, res) => {
  const entry = BANK[bankIndexForPost()];
  const postId = context.postId ?? "dev";
  const userId = context.userId;
  const grid = (req.body?.grid ?? {}) as GridState;
  const doReveal = req.body?.reveal !== false; // reveal:false ⇒ just view the log, don't unlock a new cell
  const ctx = ctxFor(entry);
  const key = userId ? attKey(postId, userId) : "";

  // count only NEW reveals - repeated presses on the same board must not inflate the counter
  const hintedSet = new Set<string>();
  let hints = 0;
  if (userId) {
    const h = await redis.hGetAll(key);
    hints = Number(h.hints ?? 0);
    if (h.hinted) for (const k of h.hinted.split(",")) hintedSet.add(k);
  }

  // reveal the first still-undetermined cell the player hasn't been shown yet
  let pick: { cat: string; suspect: string; value: string } | null = null;
  if (doReveal) {
    outer: for (const s of ctx.suspects)
      for (const c of ctx.catIds) {
        const cellKey = `${c}|${s}`;
        if (!effectiveValue(ctx, grid, c, s) && !hintedSet.has(cellKey)) {
          pick = { cat: c, suspect: s, value: entry.solution[s][c] };
          hintedSet.add(cellKey);
          break outer;
        }
      }
    if (userId && pick) {
      hints += 1;
      await redis.hSet(key, { hints: String(hints), hinted: [...hintedSet].join(",") });
    }
  }
  // full log of everything revealed so far (survives reload - the player can review past hints)
  const revealed = [...hintedSet].map((k) => {
    const [cat, s] = k.split("|");
    return { cat, suspect: s, value: entry.solution[s]?.[cat] ?? "" };
  }).filter((r) => r.value);
  res.json({ hint: pick, hints, revealed });
});

router.post("/api/vote", async (req, res) => {
  const postId = context.postId ?? "dev";
  const userId = context.userId;
  const choice = req.body?.choice as VoteChoice | undefined;
  if (!choice || !VOTE_CHOICES.includes(choice)) { res.json({ ok: false, tally: await voteTally(postId) }); return; }
  if (userId) {
    const key = attKey(postId, userId);
    const h = await redis.hGetAll(key);
    if (h.solved !== "1") { res.json({ ok: false, error: "solve first", tally: await voteTally(postId) }); return; }
    if (!h.vote) { // one vote per player; play-again doesn't reset
      await redis.hSet(key, { vote: choice });
      await redis.hIncrBy(voteKey(postId), choice, 1);
    }
  }
  const tally = await voteTally(postId);
  res.json({ ok: true, tally, leader: voteLeader(tally) });
});

router.post("/api/check", async (req, res) => {
  const entry = BANK[bankIndexForPost()];
  const postId = context.postId ?? "dev";
  const userId = context.userId;
  const grid = (req.body?.grid ?? {}) as GridState;

  const verdict = gradeGrid(entry, grid);
  if (verdict === "incomplete") { res.json({ status: "incomplete" }); return; }
  if (verdict === "wrong") { res.json({ status: "wrong" }); return; }

  if (!userId) {
    res.json({ status: "solved", results: guestResults() });
    return;
  }

  const key = attKey(postId, userId);
  const h = await redis.hGetAll(key);
  if (h.solved === "1") {
    res.json({ status: "solved", results: await buildResults(postId, userId, Number(h.timeSec ?? 0), Number(h.hints ?? 0), Number(h.solveOrder ?? 0)) });
    return;
  }
  const startedAt = Number(h.startedAt ?? Date.now());
  const wall = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
  const reported = Math.max(Number(req.body?.seconds) || 0, Number(h.activeSec ?? 0));
  const timeSec = Math.min(Math.max(1, Math.round(reported)), wall); // active play-time, clamped ≤ wall-clock (anti-cheat upper bound)
  const hints = Number(h.hints ?? 0);
  const solveOrder = await redis.incrBy(solvedCountKey(postId), 1); // finishing position (temporal)
  await redis.hSet(key, { solved: "1", solvedAt: String(Date.now()), timeSec: String(timeSec), solveOrder: String(solveOrder) });

  const uname = (await reddit.getCurrentUsername()) ?? userId;
  await redis.zAdd(lbKey(postId), { member: uname, score: timeSec });
  await updateStreak(userId);

  res.json({ status: "solved", results: await buildResults(postId, userId, timeSec, hints, solveOrder) });
});

function guestResults() {
  return {
    timeSec: 0, solveOrder: 1, total: 1, betterPct: 50, hasHistogram: false,
    histogram: null, streak: 1, rank: 1, voteTally: { Harder: 0, Same: 0, Softer: 0 },
  };
}

async function updateStreak(userId: string): Promise<number> {
  const key = streakKey(userId);
  const h = await redis.hGetAll(key);
  const today = todayStr();
  if (h.lastDate === today) return Number(h.current ?? 1);
  const cur = h.lastDate === prevDay(today) ? Number(h.current ?? 0) + 1 : 1;
  const best = Math.max(cur, Number(h.best ?? 0));
  await redis.hSet(key, { current: String(cur), best: String(best), lastDate: today });
  return cur;
}

async function buildResults(postId: string, userId: string, timeSec: number, hints: number, solveOrder: number) {
  const lb = lbKey(postId);
  const total = await redis.zCard(lb);
  const uname = (await reddit.getCurrentUsername()) ?? userId;
  const rank = (await redis.zRank(lb, uname)) ?? 0; // 0 = fastest
  const betterPct = total > 1 ? Math.round((100 * (total - 1 - rank)) / (total - 1)) : 50;
  const streak = Number((await redis.hGetAll(streakKey(userId))).current ?? 1);

  let hasHistogram = false;
  let histogram: { counts: number[]; youIdx: number } | null = null;
  if (total >= HIST_MIN) {
    const all = await redis.zRange(lb, 0, -1, { by: "rank" });
    const counts = new Array(TIME_BINS.length).fill(0);
    for (const m of all) {
      const bi = TIME_BINS.findIndex((mx) => m.score < mx);
      counts[bi >= 0 ? bi : TIME_BINS.length - 1]++;
    }
    const yi = TIME_BINS.findIndex((mx) => timeSec < mx);
    hasHistogram = true;
    histogram = { counts, youIdx: yi >= 0 ? yi : TIME_BINS.length - 1 };
  }

  const top3 = await redis.zRange(lb, 0, 2, { by: "rank" }); // fastest 3 (ascending time)

  return {
    timeSec, hints, solveOrder, total, betterPct, hasHistogram, histogram,
    streak, rank: rank + 1, voteTally: await voteTally(postId),
    you: uname,
    leaderboard: top3.map((m) => ({ name: m.member, timeSec: m.score })),
  };
}

// ───────────────────────── /internal: daily post creation ─────────────────────────
async function summarize(prevPostId: string): Promise<EpilogueData | null> {
  const solvers = await redis.zCard(lbKey(prevPostId));
  if (solvers === 0) return null;
  const top = await redis.zRange(lbKey(prevPostId), 0, 0, { by: "rank" });
  const tally = await voteTally(prevPostId);
  const { tier, pct } = voteLeader(tally);
  return { who: top[0]?.member ?? "someone", timeSec: top[0]?.score ?? 0, solvers, tier, pct };
}

async function createDailyPost() {
  const prevPostId = await redis.get("lt:lastPostId");
  const epilogue = prevPostId ? await summarize(prevPostId) : null;

  // vote → difficulty: shift the global series level by the previous post's community vote
  let level = Number((await redis.get("lt:level")) ?? DEFAULT_LEVEL);
  if (!Number.isFinite(level)) level = DEFAULT_LEVEL;
  if (prevPostId) level = levelFromVote(level, await voteTally(prevPostId));
  level = Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, level));
  await redis.set("lt:level", String(level));

  // pick a case from the level's bucket, rotating within it to avoid repeats
  const bucket = LEVEL_BUCKETS[level] ?? LEVEL_BUCKETS[DEFAULT_LEVEL];
  const bcur = await redis.incrBy(`lt:bucketCursor:${level}`, 1);
  const idx = bucket[(bcur - 1) % bucket.length];

  const n = await redis.incrBy("bank:cursor", 1); // monotonic case number
  const date = new Date().toISOString().slice(0, 10);
  const entry = BANK[idx];
  const theme = THEME_BY_ID[entry.themeId];
  const tierLabel = LEVEL_LABELS[level] ?? "daily deduction";

  const post = await reddit.submitCustomPost({
    subredditName: context.subredditName,
    title: `Case #${n}: ${theme?.title ?? "New Case"} - ${tierLabel}`,
    entry: "default",
    postData: { idx, date, n, level, epilogue },
  });
  await redis.set("lt:lastPostId", post.id);
  return post;
}

// Fixed judge/demo case, decoupled from the vote ramp: no bank-cursor bump (doesn't move the daily
// rotation) and NOT linked into the daily chain (lt:lastPostId), so its votes are never read by
// createDailyPost. Always shows SHOWCASE_IDX regardless of the current ramp level.
async function createShowcasePost() {
  const idx = SHOWCASE_IDX;
  const date = new Date().toISOString().slice(0, 10);
  const entry = BANK[idx];
  const theme = THEME_BY_ID[entry.themeId];
  return reddit.submitCustomPost({
    subredditName: context.subredditName,
    title: `Deducto - try a case: ${theme?.title ?? "a case"}`,
    entry: "default",
    postData: { idx, date, n: null, epilogue: null, showcase: true },
  });
}

router.post("/internal/menu/create-post", async (_req, res) => {
  const post = await createDailyPost();
  res.json({ navigateTo: post.url, showToast: "Case published!" });
});

router.post("/internal/menu/create-showcase", async (_req, res) => {
  const post = await createShowcasePost();
  res.json({ navigateTo: post.url, showToast: "Showcase published!" });
});

// NOTE: the daily-post scheduler is intentionally NOT wired in devvit.json right now.
// Reddit automod kept banning the auto-posted daily thread, so auto-posting is paused until
// the subreddit is whitelisted. This handler is kept so that re-adding the scheduler block
// (cron "0 12 * * *" -> /internal/cron/daily-post) instantly re-enables daily posting.
router.post("/internal/cron/daily-post", async (_req, res) => {
  await createDailyPost();
  res.json({ status: "ok" });
});

// ── practice / onboarding: warm-up lane, isolated from the daily (no lb/vote/streak) ──
// Opt-in warm-up: serve a green case (rotates via the per-user counter). Repeatable, on-demand.
router.get("/api/practice", async (_req, res) => {
  const userId = context.userId;
  const seen = userId ? Number((await redis.get(onbKey(userId))) ?? 0) : 0;
  const idx = warmupIdx(seen);
  let grid: GridState | null = null;
  if (userId) {
    const h = await redis.hGetAll(pAttKey(userId, seen));
    if (!h.startedAt) await redis.hSet(pAttKey(userId, seen), { startedAt: String(Date.now()) });
    else if (h.grid) grid = JSON.parse(h.grid) as GridState;
  }
  res.json({ puzzle: publicPuzzle(BANK[idx], idx), grid });
});

router.post("/api/practice/state", async (req, res) => {
  const userId = context.userId;
  if (!userId) { res.json({ ok: false }); return; }
  const done = Number((await redis.get(onbKey(userId))) ?? 0);
  const grid = (req.body?.grid ?? null) as GridState | null;
  if (grid) await redis.hSet(pAttKey(userId, done), { grid: JSON.stringify(grid) });
  res.json({ ok: true });
});

router.post("/api/practice/check", async (req, res) => {
  const userId = context.userId;
  const done = userId ? Number((await redis.get(onbKey(userId))) ?? 0) : 0;
  const idx = warmupIdx(done);
  const verdict = gradeGrid(BANK[idx], (req.body?.grid ?? {}) as GridState);
  if (verdict !== "solved") { res.json({ status: verdict }); return; }
  if (userId) await redis.incrBy(onbKey(userId), 1); // rotate to the next warm-up case
  res.json({ status: "solved" });
});

app.use(router);

const server = createServer(app);
server.on("error", (err) => console.error(`server error; ${err.stack}`));
server.listen(getServerPort());
