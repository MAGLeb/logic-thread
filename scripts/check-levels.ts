// Verify the vote→difficulty ramp against the real bank (mirrors server/index.ts; server can't run
// under tsx: it imports @devvit). Buckets = cases grouped by their offline difficulty bin.
import bank from "../src/server/bank.json";
const BANK = bank as unknown as { tier: string; bin?: number; score?: number; clues: unknown[] }[];

// buildLevelBuckets (same as server)
const maxBin = Math.max(0, ...BANK.map((e) => e.bin ?? 0));
const buckets: number[][] = Array.from({ length: maxBin + 1 }, () => []);
BANK.forEach((e, i) => buckets[e.bin ?? 0].push(i));
const MAX_LEVEL = buckets.length - 1;

console.log(`bins: ${buckets.map((b, i) => `L${i}=${b.length}`).join(" · ")} (MAX_LEVEL=${MAX_LEVEL})`);
for (let b = 0; b <= maxBin; b++) {
  const scores = buckets[b].map((i) => BANK[i].score ?? 0);
  const clues = buckets[b].map((i) => BANK[i].clues.length);
  const avg = (a: number[]) => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1);
  console.log(`  L${b}: score ${Math.min(...scores)}-${Math.max(...scores)} (avg ${avg(scores)}) · avg clues ${avg(clues)}`);
}

const VOTE_CHOICES = ["Harder", "Same", "Softer"] as const;
type T = Record<string, number>;
function levelFromVote(level: number, t: T): number {
  const total = t.Harder + t.Same + t.Softer;
  if (total < 1) return level;
  const s = VOTE_CHOICES.slice().sort((a, b) => t[b] - t[a]);
  if ((t[s[0]] - t[s[1]]) / total < 0.10) return level;
  if (s[0] === "Harder") return Math.min(MAX_LEVEL, level + 1);
  if (s[0] === "Softer") return Math.max(0, level - 1);
  return level;
}

// simulate a week: community keeps voting Harder, then a Softer day, then a tie
console.log("\nramp simulation (start L1):");
let level = 1;
const votes: [string, T][] = [
  ["Harder 4/1/1", { Harder: 4, Same: 1, Softer: 1 }],
  ["Harder 5/0/1", { Harder: 5, Same: 0, Softer: 1 }],
  ["Harder 6/1/0", { Harder: 6, Same: 1, Softer: 0 }],   // should cap at L3
  ["Harder 9/0/0", { Harder: 9, Same: 0, Softer: 0 }],   // stays at cap
  ["Softer 1/1/7", { Harder: 1, Same: 1, Softer: 7 }],
  ["Same 2/6/2", { Harder: 2, Same: 6, Softer: 2 }],
  ["tie 3/3/1 (7)", { Harder: 3, Same: 3, Softer: 1 }],  // weak lead → hold
];
for (const [label, t] of votes) {
  const next = levelFromVote(level, t);
  console.log(`  ${label.padEnd(16)} L${level} → L${next}  (${LEVEL_ARROW(level, next)})`);
  level = next;
}
function LEVEL_ARROW(a: number, b: number) { return b > a ? "harder ▲" : b < a ? "softer ▼" : "hold ="; }
