// Офлайн-сборка банка ежедневных пазлов → src/server/bank.json.
// Детерминированно (seed из строки), каждый кейс верифицируется classify() на тир и уникальность.
// Запуск: npx tsx scripts/build-bank.ts [N]
import { writeFileSync } from "node:fs";
import type { Clue, Solution } from "../src/shared/types.js";
import {
  Puzzle, classify, generate, GREEN, YELLOW, RED, RNG, seedFromString,
} from "../src/server/engine.js";
import { FLAIR_TOKENS, TIME_TOKENS, THEMES } from "../src/shared/themes.js";
import { renderClue } from "../src/shared/render.js";
import { difficultyScore } from "./difficulty.js";

interface BankEntry {
  themeId: string;
  tier: "green" | "yellow" | "red";
  suspects: string[];
  objectTokens: string[];
  clues: Clue[];
  solution: Solution;
  score?: number; // offline difficulty score (higher = harder) - drives the daily ramp
  bin?: number;   // quantile bin of the score (0..NBINS-1); runtime reads this, not the score
}

const TIER_TAG: Record<string, string> = { green: GREEN, yellow: YELLOW, red: RED };
const N = Number(process.argv[2] ?? 120);

function tierFor(i: number): "green" | "yellow" | "red" {
  // дефолт для daily - 🟡; 🟢 как разминка каждый 6-й.
  // 🔴 намеренно НЕ кладём в банк: его генерация на порядок дороже (brute-force на каждом
  // шаге минимизации) - держим для отдельного «хардкор»-режима, не для ежедневной сборки.
  return i % 6 === 0 ? "green" : "yellow";
}

const bank: BankEntry[] = [];
let fails = 0;
const dist: Record<string, number> = { green: 0, yellow: 0, red: 0 };

for (let i = 0; i < N; i++) {
  const theme = THEMES[i % THEMES.length];
  const tier = tierFor(i);
  const objectTokens = Object.keys(theme.objects);
  const cats = { flair: [...FLAIR_TOKENS], time: [...TIME_TOKENS], object: objectTokens };

  let entry: BankEntry | null = null;
  for (let attempt = 0; attempt < 24 && !entry; attempt++) {
    const rng = new RNG(seedFromString(`logic-thread:v1:${i}:${attempt}`));
    const res = generate(tier, rng, theme.suspects, cats, tier === "red" ? 30 : 60);
    if (!res) continue;
    const [solution, clues] = res;
    const info = classify(new Puzzle(theme.suspects, cats, clues, solution));
    if (info.tier !== TIER_TAG[tier] || info.solutions !== 1) continue;
    // sanity: рендер всех улик не должен падать (все токены есть в теме)
    for (const c of clues) renderClue(c, theme);
    entry = { themeId: theme.id, tier, suspects: theme.suspects, objectTokens, clues, solution };
  }

  if (!entry) { console.log(`[FAIL] i=${i} theme=${theme.id} tier=${tier}: не собрал`); fails++; continue; }
  bank.push(entry);
  dist[tier]++;
}

// difficulty score + quantile bin (offline; the runtime reads only the bin for the daily ramp)
const NBINS = 4;
for (const e of bank) e.score = difficultyScore(e);
const sortedScores = bank.map((e) => e.score!).sort((a, b) => a - b);
const cuts = Array.from({ length: NBINS - 1 }, (_, i) => sortedScores[Math.floor(((i + 1) / NBINS) * sortedScores.length)]);
const binOf = (s: number) => cuts.filter((c) => s >= c).length;
for (const e of bank) e.bin = binOf(e.score!);
const binDist = new Array(NBINS).fill(0);
for (const e of bank) binDist[e.bin!]++;

const outUrl = new URL("../src/server/bank.json", import.meta.url);
writeFileSync(outUrl, JSON.stringify(bank, null, 0) + "\n");

const avgClues = (bank.reduce((a, b) => a + b.clues.length, 0) / bank.length).toFixed(1);
console.log(`Собрано ${bank.length}/${N} кейсов → src/server/bank.json`);
console.log(`Тиры: 🟢 ${dist.green} · 🟡 ${dist.yellow} · 🔴 ${dist.red} · среднее улик: ${avgClues}`);
console.log(`Difficulty bins (cuts ${cuts.join("/")}): ${binDist.map((c, i) => `L${i}=${c}`).join(" · ")}`);
console.log(fails === 0 ? "Все кейсы прошли верификацию ✅" : `ПРОВАЛОВ: ${fails} ❌`);

// Показать пример (первый кейс) для глазной проверки текста улик
const first = bank[0];
if (first) {
  const theme = THEMES.find((t) => t.id === first.themeId)!;
  console.log(`\nПример - ${theme.title} (${first.tier}):`);
  first.clues.forEach((c, k) => console.log(`  ${k + 1}. ${renderClue(c, theme)}`));
}

process.exit(fails ? 1 : 0);
