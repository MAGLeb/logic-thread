// Deducto - shared types (client + server).
// The clue shape matches the difficulty engine 1:1 (parity-tested against a Python reference solver).

export type CatId = string; // "flair" | "time" | "object" (+ в проде "location")
export type Cats = Record<CatId, string[]>;
export type Solution = Record<string, Record<CatId, string>>; // suspect -> cat -> value

// Ссылка в улике: ["s", suspectName] либо [catId, value].
export type Ref = [string, string];

export type Clue =
  | { k: "ne"; s: string; cat: CatId; v: string }        // подозреваемый != значение
  | { k: "same"; a: Ref; b: Ref }                         // a,b = [catId, value] - один владелец
  | { k: "nsame"; a: Ref; b: Ref }                        // разные владельцы
  | { k: "before"; a: Ref; b: Ref };                      // time(a) < time(b)

// Каноничный ключ улики - для дедупликации и сравнения по значению (аналог repr() в Python).
export function clueKey(c: Clue): string {
  switch (c.k) {
    case "ne": return `ne|${c.s}|${c.cat}|${c.v}`;
    case "same": return `same|${c.a[0]}|${c.a[1]}|${c.b[0]}|${c.b[1]}`;
    case "nsame": return `nsame|${c.a[0]}|${c.a[1]}|${c.b[0]}|${c.b[1]}`;
    case "before": return `before|${c.a[0]}|${c.a[1]}|${c.b[0]}|${c.b[1]}`;
  }
}
