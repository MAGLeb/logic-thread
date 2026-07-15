// Dump one bank case: rendered clues + solution + a consistency check (does the solution satisfy every clue?).
// Usage: npx tsx scripts/dump-case.ts <bankIndex>
import type { Clue, Solution } from "../src/shared/types.js";
import { Puzzle, classify } from "../src/server/engine.js";
import { FLAIR_TOKENS, TIME_TOKENS, THEME_BY_ID } from "../src/shared/themes.js";
import { renderClue, valueLabel } from "../src/shared/render.js";
import bank from "../src/server/bank.json";

interface Entry { themeId: string; tier: string; suspects: string[]; objectTokens: string[]; clues: Clue[]; solution: Solution; }
const BANK = bank as unknown as Entry[];
const idx = Number(process.argv[2] ?? 1);
const e = BANK[idx];
const theme = THEME_BY_ID[e.themeId];
const cats = { flair: [...FLAIR_TOKENS], time: [...TIME_TOKENS], object: e.objectTokens };

console.log(`Case bank[${idx}] - ${theme.title} (${e.tier})`);
console.log(`Suspects: ${e.suspects.join(", ")}\n`);

console.log("CLUES:");
e.clues.forEach((c, i) => console.log(`  ${i + 1}. ${renderClue(c, theme)}`));

console.log("\nSOLUTION:");
for (const s of e.suspects) {
  const f = valueLabel("flair", e.solution[s].flair, theme);
  const o = valueLabel("object", e.solution[s].object, theme);
  console.log(`  ${s}: ${f.emoji} ${f.label} coat · ${e.solution[s].time} · ${o.emoji} ${o.label}`);
}

// consistency: solution must satisfy every clue, and be the unique solution
const pz = new Puzzle(e.suspects, cats, e.clues, e.solution);
const info = classify(pz);
console.log(`\nCHECK: tier=${info.tier} solutions=${info.solutions} (must be exactly 1 and match the shown solution)`);
