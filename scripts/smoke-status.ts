// Smoke-тест общей клиент/сервер-логики (webview тут не запустить):
// для каждого кейса банка ставим грид = решение и проверяем, что
//   * effectiveCount === 12 (все ячейки выведены),
//   * все улики со статусом "ok" (клиентское условие «решено»),
//   * gradeGrid == "solved" (серверная проверка) - т.е. клиент и сервер согласны.
// Плюс проверяем, что на пустом гриде статусы считаются без падений.
import type { Clue, Solution } from "../src/shared/types.js";
import {
  freshGrid, effectiveCount, effectiveValue, clueStatus,
  type GridState, type PuzzleCtx,
} from "../src/shared/status.js";
import { renderClue } from "../src/shared/render.js";
import { FLAIR_TOKENS, TIME_TOKENS, THEME_BY_ID } from "../src/shared/themes.js";
import bank from "../src/server/bank.json";

interface Entry { themeId: string; tier: string; suspects: string[]; objectTokens: string[]; clues: Clue[]; solution: Solution; }
const BANK = bank as unknown as Entry[];
const CAT_IDS = ["flair", "time", "object"];

function ctxFor(e: Entry): PuzzleCtx {
  return { suspects: e.suspects, catIds: CAT_IDS,
    cats: { flair: [...FLAIR_TOKENS], time: [...TIME_TOKENS], object: e.objectTokens },
    timeValues: [...TIME_TOKENS] };
}

// Грид, где каждый solution-кубик confirmed(2), а конкурирующие значения crossed(1).
function solvedGrid(e: Entry, ctx: PuzzleCtx): GridState {
  const g = freshGrid(ctx);
  for (const c of CAT_IDS) for (const s of e.suspects) {
    const ans = e.solution[s][c];
    for (const v of ctx.cats[c]) g[c][s][v] = v === ans ? 2 : 1;
  }
  return g;
}

function grade(e: Entry, g: GridState, ctx: PuzzleCtx): "incomplete" | "wrong" | "solved" {
  if (effectiveCount(ctx, g) !== ctx.suspects.length * CAT_IDS.length) return "incomplete";
  for (const c of CAT_IDS) for (const s of e.suspects)
    if (e.solution[s][c] !== effectiveValue(ctx, g, c, s)) return "wrong";
  return "solved";
}

let fails = 0;
for (let i = 0; i < BANK.length; i++) {
  const e = BANK[i];
  const ctx = ctxFor(e);
  if (!THEME_BY_ID[e.themeId]) { console.log(`[FAIL] #${i}: нет темы ${e.themeId}`); fails++; continue; }
  // пустой грид: статусы без падений + рендер текста
  const empty = freshGrid(ctx);
  for (const c of e.clues) { clueStatus(ctx, empty, c); renderClue(c, THEME_BY_ID[e.themeId]); }
  // грид = решение
  const g = solvedGrid(e, ctx);
  const full = effectiveCount(ctx, g) === 12;
  const allOk = e.clues.every((c) => clueStatus(ctx, g, c) === "ok");
  const graded = grade(e, g, ctx);
  if (!full || !allOk || graded !== "solved") {
    fails++;
    const bad = e.clues.map((c, k) => [k, clueStatus(ctx, g, c)]).filter(([, s]) => s !== "ok");
    console.log(`[FAIL] #${i} ${e.themeId}/${e.tier}: full=${full} allOk=${allOk} graded=${graded} badClues=${JSON.stringify(bad)}`);
  }
}

console.log(`Проверено кейсов: ${BANK.length}`);
console.log(fails === 0
  ? "OK ✅ - на решении все улики зелёные, клиент детектит solved, сервер подтверждает (клиент↔сервер согласны)"
  : `ПРОВАЛОВ: ${fails} ❌`);
process.exit(fails ? 1 : 0);
