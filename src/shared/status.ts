// Живой статус улик и «эффективный ответ» - порт логики из prototype/index.html.
// Всё считается ТОЛЬКО от отметок игрока (0=unknown,1=вычеркнуто,2=подтверждено),
// а не от скрытого решения - честная обратная связь без спойлеров.

import type { Clue, Ref } from "./types.js";

export type Cell = 0 | 1 | 2;
export type GridState = Record<string, Record<string, Record<string, Cell>>>; // cat -> suspect -> value -> Cell

export interface PuzzleCtx {
  suspects: string[];
  catIds: string[];                 // порядок категорий, напр. ["flair","time","object"]
  cats: Record<string, string[]>;   // catId -> значения
  timeValues: string[];             // упорядоченные значения времени
}

export function freshGrid(ctx: PuzzleCtx): GridState {
  const grid: GridState = {};
  for (const c of ctx.catIds) {
    grid[c] = {};
    for (const s of ctx.suspects) {
      grid[c][s] = {};
      for (const v of ctx.cats[c]) grid[c][s][v] = 0;
    }
  }
  return grid;
}

// Кандидаты ячейки: подтверждённый (2) - единственный; иначе все невычеркнутые (0).
export function candSet(ctx: PuzzleCtx, g: GridState, c: string, s: string): string[] {
  const vals = ctx.cats[c];
  const yes = vals.find((v) => g[c][s][v] === 2);
  if (yes) return [yes];
  return vals.filter((v) => g[c][s][v] === 0);
}

// Эффективный ответ ячейки: единственный оставшийся кандидат (или null).
export function effectiveValue(ctx: PuzzleCtx, g: GridState, c: string, s: string): string | null {
  const cand = candSet(ctx, g, c, s);
  return cand.length === 1 ? cand[0] : null;
}

export function effectiveCount(ctx: PuzzleCtx, g: GridState): number {
  let n = 0;
  for (const c of ctx.catIds) for (const s of ctx.suspects) if (effectiveValue(ctx, g, c, s)) n++;
  return n;
}

// Возможные владельцы значения (учитывая подтверждённое → единственный владелец).
export function possibleOwners(ctx: PuzzleCtx, g: GridState, cat: string, v: string): string[] {
  const confirmed = ctx.suspects.find((s) => g[cat][s][v] === 2);
  if (confirmed) return [confirmed];
  return ctx.suspects.filter((s) => candSet(ctx, g, cat, s).includes(v));
}

export function detOwner(ctx: PuzzleCtx, g: GridState, cat: string, v: string): string | null {
  const yesOwner = ctx.suspects.find((s) => g[cat][s][v] === 2);
  if (yesOwner) return yesOwner;
  const owners = possibleOwners(ctx, g, cat, v);
  return owners.length === 1 ? owners[0] : null;
}

function timesOfRef(ctx: PuzzleCtx, g: GridState, ref: Ref): number[] {
  const idx = (t: string) => ctx.timeValues.indexOf(t);
  if (ref[0] === "s") return candSet(ctx, g, "time", ref[1]).map(idx);
  const out = new Set<number>();
  for (const s of possibleOwners(ctx, g, ref[0], ref[1]))
    for (const t of candSet(ctx, g, "time", s)) out.add(idx(t));
  return [...out];
}

export type ClueStat = "ok" | "bad" | "open";

export function clueStatus(ctx: PuzzleCtx, g: GridState, clue: Clue): ClueStat {
  switch (clue.k) {
    case "ne": {
      const cand = candSet(ctx, g, clue.cat, clue.s);
      if (!cand.includes(clue.v)) return "ok";
      if (cand.length === 1) return "bad";
      return "open";
    }
    case "same": {
      const A = possibleOwners(ctx, g, clue.a[0], clue.a[1]);
      const B = possibleOwners(ctx, g, clue.b[0], clue.b[1]);
      if (!A.some((s) => B.includes(s))) return "bad";
      const oa = detOwner(ctx, g, clue.a[0], clue.a[1]);
      const ob = detOwner(ctx, g, clue.b[0], clue.b[1]);
      return oa && oa === ob ? "ok" : "open";
    }
    case "nsame": {
      const A = possibleOwners(ctx, g, clue.a[0], clue.a[1]);
      const B = possibleOwners(ctx, g, clue.b[0], clue.b[1]);
      if (!A.some((s) => B.includes(s))) return "ok"; // не могут быть одним владельцем
      const oa = detOwner(ctx, g, clue.a[0], clue.a[1]);
      const ob = detOwner(ctx, g, clue.b[0], clue.b[1]);
      return oa && oa === ob ? "bad" : "open";
    }
    case "before": {
      const TA = timesOfRef(ctx, g, clue.a);
      const TB = timesOfRef(ctx, g, clue.b);
      if (!TA.length || !TB.length) return "bad";
      if (Math.max(...TA) < Math.min(...TB)) return "ok";
      if (Math.min(...TA) >= Math.max(...TB)) return "bad";
      return "open";
    }
  }
}
