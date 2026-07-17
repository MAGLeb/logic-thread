// Offline difficulty-score for a fixed-4×3 case. Computed at bank-build time and stored in bank.json
// (runtime only reads the bin). Axis knobs (per docs/04 + design brief; NO transitivity depth):
//   * tier (from engine.classify: 🟢 weak-forced easiest, 🟡 grid-not-weak harder) - coarse offset
//   * clue count / minimality: fewer load-bearing clues = harder
//   * relational share (before / nsame) vs direct pins (same / ne): more relational = harder
//   * "hook" opener (a same-clue anchoring a value to a TIME, e.g. coffee@18:00): present = easier start
import type { Clue } from "../src/shared/types.js";

export interface ScorableEntry { tier: string; clues: Clue[] }

export function difficultyScore(e: ScorableEntry): number {
  const n = e.clues.length;
  const relational = e.clues.filter((c) => c.k === "before" || c.k === "nsame").length;
  const relRatio = n ? relational / n : 0;
  const hooks = e.clues.filter((c) => c.k === "same" && (c.a[0] === "time" || c.b[0] === "time")).length;
  const tierBase = e.tier === "green" ? 0 : 55; // 🟡 sits well above 🟢
  const s = tierBase + (12 - n) * 3 + relRatio * 45 - hooks * 5;
  return Math.round(s);
}

// ── run directly to inspect the spread over the current bank (the "check FIRST" step) ──
async function main() {
  const bank = (await import("../src/server/bank.json", { with: { type: "json" } })).default as unknown as ScorableEntry[];
  const rows = bank.map((e) => ({ tier: e.tier, n: e.clues.length, score: difficultyScore(e) }));
  const green = rows.filter((r) => r.tier === "green").map((r) => r.score);
  const yellow = rows.filter((r) => r.tier === "yellow").map((r) => r.score);
  const stat = (a: number[]) => a.length ? `min=${Math.min(...a)} max=${Math.max(...a)} mean=${(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1)} span=${Math.max(...a) - Math.min(...a)}` : "-";
  console.log(`GREEN (${green.length}): ${stat(green)}`);
  console.log(`YELLOW (${yellow.length}): ${stat(yellow)}`);

  // text histogram of yellow scores (5-pt buckets) - does 🟡 spread or clump?
  const lo = Math.min(...yellow);
  const W = 4;
  const bins: Record<number, number> = {};
  for (const s of yellow) { const b = Math.floor((s - lo) / W); bins[b] = (bins[b] ?? 0) + 1; }
  console.log("\nYELLOW score histogram (bucket width " + W + "):");
  const maxB = Math.max(...Object.keys(bins).map(Number));
  for (let b = 0; b <= maxB; b++) {
    const c = bins[b] ?? 0;
    console.log(`  ${String(lo + b * W).padStart(3)}-${String(lo + b * W + W - 1).padStart(3)}: ${"█".repeat(c)} ${c}`);
  }

  // proposed 4 equal-count (quantile) bins across ALL cases → resolution for the daily ramp
  const sorted = rows.map((r) => r.score).sort((a, b) => a - b);
  const NB = 4;
  const cuts = Array.from({ length: NB - 1 }, (_, i) => sorted[Math.floor(((i + 1) / NB) * sorted.length)]);
  console.log(`\nProposed ${NB} quantile bins, cut points: ${cuts.join(", ")}`);
  const binOf = (s: number) => cuts.filter((c) => s >= c).length;
  const binCounts = new Array(NB).fill(0);
  for (const r of rows) binCounts[binOf(r.score)]++;
  console.log("bin sizes:", binCounts.join(" / "), "(want roughly balanced)");
}

// tsx runs this file directly; skip when imported by build-bank
if (import.meta.url === `file://${process.argv[1]}`) main();
