// Self-test of the TS engine - parity with engine/test_engine.py:
//   * anchors Case #0 (🟡), Case #1 (🟢), fork-case (🔴) classify as expected;
//   * the green/yellow generator produces a case of the requested tier with a unique solution.
// Run: npx tsx src/server/engine.test.ts
import type { Cats, Clue } from "../shared/types.js";
import {
  Puzzle, classify, generate, GREEN, YELLOW, RED,
  DEFAULT_SUS, DEFAULT_CATS, RNG,
} from "./engine.js";

const FL = ["Red", "Blue", "Green", "Purple"];
const TM = ["09:00", "12:00", "15:00", "18:00"];

// ── canonical cases as regression anchors (same as in Python) ──
const CASE0 = new Puzzle( // 🟡: needs cross-referencing logic, but no guessing
  ["John", "Mira", "Paul", "ModBot"],
  { flair: FL, time: TM, object: ["Pizza", "Keyboard", "Spoon", "Scroll"] } as Cats,
  [
    { k: "same", a: ["object", "Pizza"], b: ["time", "18:00"] },
    { k: "ne", s: "John", cat: "object", v: "Pizza" },
    { k: "before", a: ["flair", "Red"], b: ["s", "John"] },
    { k: "ne", s: "John", cat: "time", v: "15:00" },
    { k: "same", a: ["flair", "Green"], b: ["time", "12:00"] },
    { k: "same", a: ["flair", "Blue"], b: ["object", "Spoon"] },
    { k: "before", a: ["s", "ModBot"], b: ["s", "Mira"] },
    { k: "ne", s: "Paul", cat: "flair", v: "Purple" },
    { k: "before", a: ["object", "Scroll"], b: ["object", "Keyboard"] },
    { k: "ne", s: "ModBot", cat: "object", v: "Scroll" },
  ] as Clue[],
);

const CASE1 = new Puzzle( // 🟢: solvable on a simple board
  ["Nova", "Vega", "Cosmo", "ModBot"],
  { flair: FL, time: TM, object: ["Coffee", "Headphones", "Flashlight", "Sock"] } as Cats,
  [
    { k: "same", a: ["object", "Coffee"], b: ["time", "18:00"] },
    { k: "before", a: ["s", "Nova"], b: ["object", "Coffee"] },
    { k: "before", a: ["s", "Vega"], b: ["object", "Headphones"] },
    { k: "before", a: ["s", "ModBot"], b: ["object", "Headphones"] },
    { k: "ne", s: "Vega", cat: "time", v: "12:00" },
    { k: "same", a: ["flair", "Green"], b: ["object", "Sock"] },
    { k: "ne", s: "ModBot", cat: "flair", v: "Green" },
    { k: "same", a: ["flair", "Purple"], b: ["object", "Flashlight"] },
    { k: "ne", s: "Cosmo", cat: "flair", v: "Blue" },
  ] as Clue[],
);

const RED_CASE = new Puzzle( // 🔴: unique, but requires one guess (fork on Nova.time)
  ["Nova", "Vega", "Cosmo", "ModBot"],
  { flair: FL, time: TM, object: ["Coffee", "Headphones", "Flashlight", "Sock"] } as Cats,
  [
    { k: "same", a: ["flair", "Blue"], b: ["object", "Headphones"] },
    { k: "ne", s: "Vega", cat: "object", v: "Coffee" },
    { k: "ne", s: "ModBot", cat: "flair", v: "Green" },
    { k: "nsame", a: ["flair", "Purple"], b: ["time", "18:00"] },
    { k: "before", a: ["s", "Nova"], b: ["object", "Coffee"] },
    { k: "before", a: ["flair", "Green"], b: ["flair", "Blue"] },
    { k: "before", a: ["flair", "Green"], b: ["object", "Flashlight"] },
    { k: "before", a: ["flair", "Purple"], b: ["s", "Nova"] },
    { k: "before", a: ["s", "ModBot"], b: ["s", "Cosmo"] },
  ] as Clue[],
);

function main(): number {
  let fails = 0;

  console.log("- anchors -");
  const anchors: [string, Puzzle, string][] = [
    ["Case #0", CASE0, YELLOW],
    ["Case #1", CASE1, GREEN],
    ["fork-case", RED_CASE, RED],
  ];
  for (const [name, pz, want] of anchors) {
    const info = classify(pz);
    const ok = info.tier === want;
    if (!ok) fails++;
    console.log(
      `[${ok ? "OK" : "FAIL"}] ${name}: ${info.tier} (expected ${want}) ` +
      `| solutions=${info.solutions} weak=${info.weak_forced} grid=${info.grid_forced}`,
    );
  }

  console.log("- generator -");
  const rng = new RNG(2024);
  const N = 3;
  for (const [tier, want] of [["green", GREEN], ["yellow", YELLOW]] as [string, string][]) {
    let got = 0;
    for (let i = 0; i < N; i++) {
      const res = generate(tier, rng, DEFAULT_SUS, DEFAULT_CATS, 40);
      if (!res) { console.log(`[FAIL] generate(${tier}): not built`); fails++; continue; }
      const [sol, clues] = res;
      const info = classify(new Puzzle(DEFAULT_SUS, DEFAULT_CATS, clues, sol));
      if (info.tier === want && info.solutions === 1) got++;
      else { console.log(`[FAIL] generate(${tier}) → ${JSON.stringify(info)}`); fails++; }
    }
    console.log(`[${got === N ? "OK" : "FAIL"}] generate(${tier}): ${got}/${N} correct`);
  }

  console.log("\nRESULT:", fails === 0 ? "ALL PASSED ✅" : `FAILURES: ${fails} ❌`);
  return fails;
}

process.exit(main() ? 1 : 0);
