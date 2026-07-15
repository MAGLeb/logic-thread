// Logic Thread - webview client. UI ported from prototype/index.html; data & verification from the server.
// No solution on the client: "solved" = all 12 cells deduced and every clue green (unique solution ⇒
// that equals the correct answer); the server confirms and records the result.

import type { Clue } from "../shared/types.js";
import { FLAIR_TOKENS, TIME_TOKENS, THEME_BY_ID, rankFor, type Theme } from "../shared/themes.js";
import { renderClue, valueLabel } from "../shared/render.js";
import {
  freshGrid, effectiveValue, effectiveCount, clueStatus,
  type GridState, type PuzzleCtx, type Cell,
} from "../shared/status.js";

// ───────────────────────── helpers ─────────────────────────
const $ = (id: string) => document.getElementById(id)!;
const pad = (n: number) => String(n).padStart(2, "0");
const fmtTime = (s: number) => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
const IS_COARSE = matchMedia("(pointer: coarse)").matches;
const MQ_NARROW = matchMedia("(max-width: 639px)");
const ordinal = (n: number) => {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return n + "st";
  if (m10 === 2 && m100 !== 12) return n + "nd";
  if (m10 === 3 && m100 !== 13) return n + "rd";
  return n + "th";
};

// unified notice banner above the board (hints + info + ok + errors)
let noticeTimer: number | null = null;
function notice(text: string, kind: "hint" | "info" | "ok" | "err", persist = false, ms = 4000) {
  const el = $("notice");
  el.className = "notice show k-" + kind;
  const tag = $("notice-tag");
  tag.textContent = kind === "hint" ? "💡 HINT" : "";
  tag.style.display = kind === "hint" ? "" : "none";
  $("notice-text").textContent = text;
  el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  if (noticeTimer) clearTimeout(noticeTimer);
  if (!persist) noticeTimer = window.setTimeout(hideNotice, ms);
}
function hideNotice() { $("notice").classList.remove("show"); }

// floating toast - used only while the result overlay is open (it sits above the modal)
let floatTimer: number | null = null;
function floatToast(msg: string, kind: "err" | "info" | "ok", ms: number) {
  const t = $("toast");
  t.textContent = msg;
  t.className = "toast show" + (kind === "info" ? " info" : kind === "ok" ? " ok" : "");
  if (floatTimer) clearTimeout(floatTimer);
  floatTimer = window.setTimeout(() => t.classList.remove("show"), ms);
}

// in-game messages go to the notice banner; over the results overlay, use the floating toast
function toast(msg: string, kind: "err" | "info" | "ok" = "err", ms = 2400) {
  if (document.body.classList.contains("modal-open")) floatToast(msg, kind, ms);
  else notice(msg, kind, false, Math.max(ms, 3500));
}

// text+bold composer without innerHTML interpolation (XSS-safe: names come from Reddit)
function setRich(el: HTMLElement, parts: (string | [string])[]) {
  el.textContent = "";
  for (const p of parts) {
    if (Array.isArray(p)) { const b = document.createElement("b"); b.textContent = p[0]; el.appendChild(b); }
    else el.appendChild(document.createTextNode(p));
  }
}

function addLongPress(el: HTMLElement, fn: () => void) {
  let timer: number | null = null, fired = false;
  el.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse") return;
    fired = false;
    timer = window.setTimeout(() => { timer = null; fired = true; fn(); }, 450);
  });
  const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };
  el.addEventListener("pointerup", cancel);
  el.addEventListener("pointercancel", cancel);
  el.addEventListener("pointerleave", cancel);
  el.addEventListener("click", (e) => { if (fired) { fired = false; e.stopImmediatePropagation(); e.preventDefault(); } }, true);
}

function updateGridFade() {
  const w = $("grid-wrap");
  const overflow = w.scrollWidth - w.clientWidth > 4;
  const atEnd = w.scrollLeft + w.clientWidth >= w.scrollWidth - 4;
  w.classList.toggle("fade-r", overflow && !atEnd);
}
function updateClueFade() {
  const l = $("clue-list");
  const overflow = l.scrollHeight - l.clientHeight > 4;
  const atEnd = l.scrollTop + l.clientHeight >= l.scrollHeight - 4;
  l.classList.toggle("fade-b", overflow && !atEnd);
}

// ───────────────────────── types & state ─────────────────────────
interface Epilogue { who: string; timeSec: number; solvers: number; tier: string; pct: number }
interface VoteTally { Harder: number; Same: number; Softer: number }
interface Results {
  timeSec: number; hints: number; solveOrder: number; total: number; betterPct: number;
  hasHistogram: boolean; histogram: { counts: number[]; youIdx: number } | null;
  streak: number; rank: number; voteTally: VoteTally;
  you: string; leaderboard: { name: string; timeSec: number }[];
}
interface DailyResp {
  puzzle: {
    idx: number; caseNumber: number; themeId: string; tier: string; title: string; legend: string;
    suspects: string[]; objectTokens: string[]; clues: Clue[]; day: string;
  };
  attempt: { grid: GridState | null; hints: number; solved: boolean; elapsedSec: number; vote: string | null };
  meta: {
    solversTotal: number; streak: number; showcase: boolean; epilogue: Epilogue | null;
    vote: { choice: string | null; tally: VoteTally; leader: { tier: string; pct: number; total: number } };
    showTutorial: boolean; onboarding?: { done: number; total: number; active: boolean }; nextOpensInMin: number; nextCaseNumber: number;
  };
}

const CAT_IDS = ["flair", "time", "object"];
const CAT_LABEL: Record<string, string> = { flair: "Coat", time: "Time", object: "Item" };

let PZ: DailyResp["puzzle"];
let META: DailyResp["meta"];
let theme: Theme;
let ctx: PuzzleCtx;
let clues: Clue[] = [];
let grid: GridState;
let history: { cat: string; s: string; v: string; from: Cell; to: Cell }[][] = [];
let hints = 0;
let hintClueId: number | null = null;
let seconds = 0;
let solved = false;
let finalizing = false;
let lastResults: Results | null = null;
let diffVote: string | null = null;
let practiceMode = false;            // opt-in warm-up lane; isolated from the daily
const rowsDone = new Set<string>();
let clueFirstOk: Record<number, number> = {};
interface HintFact { cat: string; suspect: string; value: string }
let revealedHints: HintFact[] = []; // every cell revealed so far (server-backed) - reviewable log
let hintIdx = 0;                    // which hint the pager currently shows

// solve-time histogram bins (labels match server thresholds)
const BIN_LABELS = ["<2", "2-3", "3-4", "4-5", "5-7", "7-10", "10-15", "15+"];
const BIN_MAX = [120, 180, 240, 300, 420, 600, 900, Infinity]; // seconds upper bound per bin
// synthetic distribution shown ONLY on the judge/showcase post, clearly labelled as a sample
const DEMO_COUNTS = [940, 2610, 4780, 5930, 5210, 3390, 1930, 1120];
// synthetic top-3, same purpose: the judge/showcase post has ~0 real solvers → show a labelled sample board
const DEMO_LB = [
  { name: "u/quillfox", timeSec: 158 },
  { name: "u/mimi_deduces", timeSec: 191 },
  { name: "u/harbor_light", timeSec: 242 },
];

// ───────────────────────── API ─────────────────────────
async function api(path: string, body?: unknown): Promise<any> {
  const res = await fetch(path, body === undefined
    ? {}
    : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}
let saveTimer: number | null = null;
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => { api(practiceMode ? "/api/practice/state" : "/api/state", practiceMode ? { grid } : { grid, seconds }).catch(() => {}); }, 600);
}

// ───────────────────────── moves ─────────────────────────
function applyMove(cat: string, s: string, v: string, target: Cell) {
  const from = grid[cat][s][v];
  if (from === target) return;
  history.push([{ cat, s, v, from, to: target }]);
  grid[cat][s][v] = target;
  renderGrid(); renderHUD(); renderClues();
  trackClueProgress();
  scheduleSave();
  maybeFinalize();
}

function undo() {
  if (solved) return;
  const move = history.pop();
  if (!move) { toast("Nothing to undo", "info"); return; }
  for (let i = move.length - 1; i >= 0; i--) grid[move[i].cat][move[i].s][move[i].v] = move[i].from;
  for (const id in clueFirstOk) if (clueFirstOk[id] > history.length) delete clueFirstOk[Number(id)];
  renderGrid(); renderHUD(); renderClues();
  scheduleSave();
}

// trail data: when each clue first turned "satisfied"
function trackClueProgress() {
  clues.forEach((c, i) => {
    if (!(i in clueFirstOk) && clueStatus(ctx, grid, c) === "ok") clueFirstOk[i] = history.length;
  });
}

function allCluesOk(): boolean { return clues.every((c) => clueStatus(ctx, grid, c) === "ok"); }

async function maybeFinalize() {
  if (solved || finalizing) return;
  if (effectiveCount(ctx, grid) !== ctx.suspects.length * CAT_IDS.length) return;
  if (!allCluesOk()) return;
  finalizing = true;
  try {
    if (practiceMode) {
      const r = await api("/api/practice/check", { grid });
      if (r.status === "solved") { solved = true; if (timerInt) clearInterval(timerInt); onPracticeSolved(r); }
    } else {
      const r = await api("/api/check", { grid, seconds });
      if (r.status === "solved") {
        solved = true;
        lastResults = r.results;
        diffVote = null; // fresh solve - allow a vote
        if (timerInt) clearInterval(timerInt);
        $("btn-hint").setAttribute("hidden", "");
        $("btn-results").removeAttribute("hidden");
        setTimeout(() => showResult(), 700);
      }
    }
  } catch { /* network - let them keep playing */ }
  finalizing = false;
}

function updateHintBtn() {
  const t = $("btn-hint").querySelector(".btxt");
  if (t) t.textContent = hints > 0 ? ` Hints (${hints})` : " Hint";
}

// the hints log - shows ONE hint at a time (pager ‹ ›) so it stays small and doesn't cover the board;
// review is free, "Reveal another" unlocks a new cell
function showHints() {
  const el = $("notice");
  el.className = "notice show k-hint";
  $("notice-tag").style.display = "none"; // custom compact header instead
  const box = $("notice-text");
  box.innerHTML = "";
  const n = revealedHints.length;
  const total = ctx.suspects.length * CAT_IDS.length;
  hintIdx = Math.max(0, Math.min(hintIdx, Math.max(0, n - 1)));

  // header row: count + pager ‹ ›
  const head = document.createElement("div");
  head.className = "hint-head";
  const count = document.createElement("span");
  count.className = "hint-count";
  count.textContent = n ? `💡 HINT ${hintIdx + 1}/${n}` : "💡 HINTS";
  head.appendChild(count);
  if (n > 1) {
    const pager = document.createElement("span");
    pager.className = "hint-pager";
    const prev = document.createElement("button");
    prev.textContent = "‹"; prev.disabled = hintIdx === 0; prev.title = "Previous hint";
    prev.addEventListener("click", () => { hintIdx--; showHints(); });
    const next = document.createElement("button");
    next.textContent = "›"; next.disabled = hintIdx === n - 1; next.title = "Next hint";
    next.addEventListener("click", () => { hintIdx++; showHints(); });
    pager.append(prev, next);
    head.appendChild(pager);
  }
  box.appendChild(head);

  // body row: hint text (left) + reveal button (right)
  const body = document.createElement("div");
  body.className = "hint-body";
  const line = document.createElement("span");
  line.className = "hint-line";
  if (n === 0) { line.style.opacity = ".8"; line.textContent = "No hints yet - reveal a cell."; }
  else {
    const h = revealedHints[hintIdx];
    const vl = valueLabel(h.cat, h.value, theme);
    line.textContent = `${circ(h.suspect)} ${h.suspect} · ${CAT_LABEL[h.cat]} ${vl.emoji} ${vl.label}`;
  }
  body.appendChild(line);
  const btn = document.createElement("button");
  btn.className = "hint-reveal";
  if (n >= total) { btn.textContent = "All revealed"; btn.disabled = true; }
  else { btn.textContent = n ? "🔓 Reveal" : "🔓 Reveal a cell"; btn.addEventListener("click", takeHint); }
  body.appendChild(btn);
  box.appendChild(body);

  if (noticeTimer) clearTimeout(noticeTimer); // stays until dismissed
}

async function fetchHints(reveal: boolean) {
  const r = await api("/api/hint", { grid, reveal });
  hints = r.hints ?? hints;
  if (Array.isArray(r.revealed)) revealedHints = r.revealed as HintFact[];
  updateHintBtn();
  return r;
}

// 💡 button - open the log to review taken hints (free, unlocks nothing); opens on the latest one
async function viewHints() {
  if (solved) return;
  try { await fetchHints(false); hintIdx = revealedHints.length - 1; showHints(); }
  catch { toast("Hints unavailable", "info"); }
}

// "Reveal another cell" inside the log - deliberately unlock one more, then jump to it
async function takeHint() {
  if (solved) return;
  try {
    const r = await fetchHints(true);
    if (!r.hint && revealedHints.length === 0) { toast("No hint right now - every cell is filled.", "info"); return; }
    hintIdx = revealedHints.length - 1;
    showHints();
  } catch { toast("Hint unavailable", "info"); }
}

// ───────────────────────── rendering ─────────────────────────
function renderHUD() {
  $("hud-time").textContent = fmtTime(seconds);
  $("hud-prog").textContent = effectiveCount(ctx, grid) + "/" + ctx.suspects.length * CAT_IDS.length;
}

function setStreakHud(n: number) {
  const el = $("hud-streak");
  if (n > 0) { $("hud-streak-n").textContent = String(n); el.removeAttribute("hidden"); }
  else el.setAttribute("hidden", "");
}

function renderEpilogue() {
  const y = META?.epilogue;
  if (!y) { $("epilogue").textContent = ""; return; }
  const parts: (string | [string])[] = MQ_NARROW.matches
    ? ["🥇 ", [y.who], ` ${fmtTime(y.timeSec)} · ${y.solvers} solved · voted ${y.tier} ${y.pct}%`]
    : ["🥇 Yesterday: ", [y.who], " in ", [fmtTime(y.timeSec)], ` · ${y.solvers} detectives closed the case · voted ${y.tier} (${y.pct}%)`];
  setRich($("epilogue"), parts);
}

function renderClues() {
  if (MQ_NARROW.matches) renderClueSlider();
  else renderClueList();
}

function renderClueList() {
  const list = $("clue-list");
  list.innerHTML = "";
  clues.forEach((c, i) => {
    const stat = clueStatus(ctx, grid, c);
    const div = document.createElement("div");
    div.className = "clue-item"
      + (hintClueId === i ? " hint-target" : "")
      + (stat === "ok" ? " st-ok" : stat === "bad" ? " st-bad" : "");
    const num = document.createElement("span");
    num.className = "num";
    num.textContent = stat === "ok" ? "✓" : stat === "bad" ? "!" : String(i + 1);
    const txt = document.createElement("span");
    txt.className = "txt"; txt.textContent = renderClue(c, theme);
    div.append(num, txt);
    list.appendChild(div);
  });
  updateClueFade();
}

// mobile: show clues one at a time - only the actionable ones (🔴 violated + ⚪ open), red surfaced
// first; 🟢 satisfied clues drop out of the slider but are counted in the tally.
let clueSliderIdx = 0;
function renderClueSlider() {
  const root = $("clue-slider");
  root.innerHTML = "";
  const statuses = clues.map((c) => clueStatus(ctx, grid, c));
  const ok = statuses.filter((s) => s === "ok").length;
  const bad = statuses.filter((s) => s === "bad").length;
  const open = statuses.filter((s) => s === "open").length;
  const act = clues.map((c, i) => ({ i, c, s: statuses[i] }))
    .filter((x) => x.s !== "ok")
    .sort((a, b) => (a.s === b.s ? a.i - b.i : a.s === "bad" ? -1 : 1));
  if (bad > 0 && act[clueSliderIdx]?.s !== "bad") clueSliderIdx = 0; // jump to a fresh red error
  clueSliderIdx = Math.max(0, Math.min(clueSliderIdx, Math.max(0, act.length - 1)));

  const head = document.createElement("div"); head.className = "cs-head";
  const title = document.createElement("span"); title.className = "cs-title"; title.textContent = "Clues";
  const stats = document.createElement("span"); stats.className = "cs-stats";
  stats.textContent = `🟢 ${ok} · 🔴 ${bad} · ⚪ ${open}`;
  head.append(title, stats);
  if (act.length > 1) {
    const pager = document.createElement("span"); pager.className = "cs-pager";
    const prev = document.createElement("button");
    prev.textContent = "‹"; prev.disabled = clueSliderIdx === 0; prev.title = "Previous clue";
    prev.addEventListener("click", () => { clueSliderIdx--; renderClueSlider(); });
    const pos = document.createElement("span"); pos.className = "cs-pos";
    pos.textContent = `${clueSliderIdx + 1}/${act.length}`;
    const next = document.createElement("button");
    next.textContent = "›"; next.disabled = clueSliderIdx === act.length - 1; next.title = "Next clue";
    next.addEventListener("click", () => { clueSliderIdx++; renderClueSlider(); });
    pager.append(prev, pos, next);
    head.appendChild(pager);
  }
  root.appendChild(head);

  const line = document.createElement("div"); line.className = "cs-clue";
  if (act.length === 0) {
    line.classList.add("cs-done");
    line.textContent = "✓ All clues satisfied";
  } else {
    const cur = act[clueSliderIdx];
    line.classList.add(cur.s === "bad" ? "st-bad" : "st-open");
    const num = document.createElement("span"); num.className = "num";
    num.textContent = cur.s === "bad" ? "!" : String(cur.i + 1);
    const txt = document.createElement("span"); txt.className = "txt";
    txt.textContent = renderClue(cur.c, theme);
    line.append(num, txt);
  }
  root.appendChild(line);
}

function chipLabel(cat: string, v: string): string {
  if (cat === "flair") return v[0];
  if (cat === "time") return v.slice(0, 2);
  return valueLabel(cat, v, theme).emoji;
}
function flMini(v: string): string { return `<span class="fl-mini fl-${v}">${v[0]}</span>`; }
// circled suspect number ①-④ - used in the grid AND the trail
function circ(s: string): string { return String.fromCodePoint(0x2460 + ctx.suspects.indexOf(s)); }

function buildChip(c: string, s: string, v: string, isAnswer: boolean): HTMLElement {
  const st = grid[c][s][v];
  const chip = document.createElement("span");
  chip.className = "chip-m"
    + (c === "flair" ? ` fl fl-${v}` : "")
    + (st === 1 ? " crossed" : "")
    + ((st === 2 || isAnswer) ? " confirmed" : "");
  chip.innerHTML = `<span class="g">${chipLabel(c, v)}</span>`;
  const vl = valueLabel(c, v, theme);
  const name = c === "flair" ? `${vl.label} coat` : vl.label;
  const verb = IS_COARSE ? "tap" : "click";
  chip.title = st === 1 ? `${name} - crossed out (${verb} to restore)` : `${name} (${verb} to cross out)`;
  chip.addEventListener("click", () => { if (!solved) applyMove(c, s, v, st === 0 ? 1 : 0); });
  chip.addEventListener("contextmenu", (e) => e.preventDefault());
  addLongPress(chip, () => toast(`${name}${st === 1 ? " - crossed out" : ""}`, "info"));
  return chip;
}
function buildBcell(c: string, s: string, rowDone: boolean): HTMLElement {
  const cell = document.createElement("div");
  cell.className = "bcell" + (rowDone ? " solved" : "");
  const ans = effectiveValue(ctx, grid, c, s); // sole survivor = the deduced answer
  for (const v of ctx.cats[c]) cell.appendChild(buildChip(c, s, v, v === ans));
  return cell;
}
function rowJustSolved(s: string, rowDone: boolean): boolean {
  if (rowDone && !rowsDone.has(s)) { rowsDone.add(s); return true; }
  if (!rowDone) rowsDone.delete(s);
  return false;
}

function renderBoardWide() {
  const table = $("grid") as HTMLTableElement;
  table.innerHTML = "";
  const trh = document.createElement("tr");
  const corner = document.createElement("th"); corner.className = "corner"; trh.appendChild(corner);
  for (const c of CAT_IDS) { const th = document.createElement("th"); th.className = "colh"; th.textContent = CAT_LABEL[c]; trh.appendChild(th); }
  table.appendChild(trh);
  for (const s of ctx.suspects) {
    const rowDone = CAT_IDS.every((c) => effectiveValue(ctx, grid, c, s));
    const tr = document.createElement("tr");
    if (rowJustSolved(s, rowDone)) tr.className = "just-solved";
    const th = document.createElement("th"); th.className = "rowh";
    th.innerHTML = `${circ(s)} ${s}` + (rowDone ? ` <span class="done-mark">✓</span>` : "");
    tr.appendChild(th);
    for (const c of CAT_IDS) { const td = document.createElement("td"); td.appendChild(buildBcell(c, s, rowDone)); tr.appendChild(td); }
    table.appendChild(tr);
  }
}
function renderBoardNarrow() {
  const root = $("gridn");
  root.innerHTML = "";
  const cols = document.createElement("div"); cols.className = "gridn-cols";
  for (const c of CAT_IDS) { const sp = document.createElement("span"); sp.textContent = CAT_LABEL[c]; cols.appendChild(sp); }
  root.appendChild(cols);
  for (const s of ctx.suspects) {
    const rowDone = CAT_IDS.every((c) => effectiveValue(ctx, grid, c, s));
    const row = document.createElement("div"); row.className = "nrow" + (rowJustSolved(s, rowDone) ? " just-solved" : "");
    const name = document.createElement("div"); name.className = "nname";
    name.innerHTML = `${circ(s)} ${s}` + (rowDone ? ` <span class="done-mark">✓</span>` : "");
    const cells = document.createElement("div"); cells.className = "ncells";
    for (const c of CAT_IDS) cells.appendChild(buildBcell(c, s, rowDone));
    row.append(name, cells); root.appendChild(row);
  }
}
function renderGrid() {
  const narrow = MQ_NARROW.matches;
  ($("grid") as HTMLElement).style.display = narrow ? "none" : "";
  ($("gridn") as HTMLElement).style.display = narrow ? "block" : "none";
  if (narrow) { ($("grid") as HTMLElement).innerHTML = ""; renderBoardNarrow(); }
  else { ($("gridn") as HTMLElement).innerHTML = ""; renderBoardWide(); }
  updateGridFade();
}
function renderAll() { renderHUD(); renderClues(); renderGrid(); renderEpilogue(); }

// ───────────────────────── result overlay ─────────────────────────

// mini leaderboard: top-3 fastest of the day + your own line if you're outside the top-3.
// On the showcase/demo post real solvers ≈ 0 → show a clearly-labelled SAMPLE board (like DEMO_COUNTS).
function renderMiniLeaderboard(r: Results, demo = false) {
  const box = $("r-lb");
  box.innerHTML = "";
  const medals = ["🥇", "🥈", "🥉"];
  const lb = demo ? DEMO_LB : (r.leaderboard ?? []);

  if (demo) {
    const cap = document.createElement("div");
    cap.className = "lb-cap";
    cap.textContent = "Sample board (demo) · real times fill in as detectives solve";
    box.appendChild(cap);
  } else if (!lb.length) {
    const p = document.createElement("div");
    p.className = "lb-empty";
    p.textContent = "You're first to crack it - top of the board!";
    box.appendChild(p);
    return;
  }

  let meShown = false;
  lb.forEach((row, i) => {
    const isYou = !demo && row.name === r.you;
    if (isYou) meShown = true;
    const el = document.createElement("div");
    el.className = "lb-row" + (isYou ? " you" : "");
    const rank = document.createElement("span"); rank.className = "lb-rank"; rank.textContent = medals[i] ?? String(i + 1);
    const name = document.createElement("span"); name.className = "lb-name"; name.textContent = isYou ? "you" : row.name;
    const time = document.createElement("span"); time.className = "lb-time"; time.textContent = fmtTime(row.timeSec);
    el.append(rank, name, time);
    box.appendChild(el);
  });

  if (demo || !meShown) { // demo: always show your run; daily: only when you're outside the top-3
    const me = document.createElement("div");
    me.className = "lb-me";
    const lbl = document.createElement("span");
    if (demo) {
      lbl.textContent = "You · this run";
    } else {
      const b = document.createElement("b"); b.textContent = `#${r.rank}`;
      lbl.append(document.createTextNode("You · "), b, document.createTextNode(` of ${r.total}`));
    }
    const time = document.createElement("span"); time.className = "lb-time"; time.textContent = fmtTime(r.timeSec);
    me.append(lbl, time);
    box.appendChild(me);
  }
}

function renderHistogram(counts: number[], youIdx: number, better: number, caption?: string) {
  const total = counts.reduce((a, b) => a + b, 0);
  const maxC = Math.max(...counts, 1);
  const maxIdx = counts.indexOf(maxC);
  $("r-histcap").textContent = caption ?? `Faster than ${better}% of ${total.toLocaleString("en-US")} detectives`;
  const hist = $("r-hist"), histx = $("r-histx");
  hist.innerHTML = ""; histx.innerHTML = "";
  counts.forEach((c, i) => {
    const bin = document.createElement("div");
    bin.className = "bin" + (i === youIdx ? " you" : "");
    bin.title = `${BIN_LABELS[i]} min · ${c.toLocaleString("en-US")} detectives`;
    const cnt = document.createElement("span"); cnt.className = "cnt";
    cnt.textContent = i === youIdx ? (i === maxIdx ? `you · ${maxC.toLocaleString("en-US")}` : "you") : (i === maxIdx ? maxC.toLocaleString("en-US") : "");
    const bar = document.createElement("span"); bar.className = "bar";
    bar.style.height = Math.max(3, Math.round((c / maxC) * 48)) + "px";
    bin.append(cnt, bar); hist.appendChild(bin);
    const lbl = document.createElement("span"); lbl.className = "lbl" + (i === youIdx ? " you" : "");
    lbl.textContent = BIN_LABELS[i]; histx.appendChild(lbl);
  });
}

function renderVoteBar(tally: VoteTally, total: number, leaderKey: keyof VoteTally) {
  const segs: [keyof VoteTally, string, string, string][] = [
    ["Harder", "harder", "🔥", "Harder"],
    ["Same", "same", "⚖️", "Same"],
    ["Softer", "softer", "🌿", "Softer"],
  ];
  const track = segs.map(([k, cls]) => {
    const pct = total ? (tally[k] / total) * 100 : 33.34;
    const inside = total && pct >= 16 ? `${Math.round(pct)}%` : "";
    return `<span class="vb-seg ${cls}${total ? "" : " empty"}" style="width:${pct}%" title="${k}: ${tally[k]} of ${total}">${inside}</span>`;
  }).join("");
  const legend = total
    ? segs.map(([k, , emoji, label]) =>
        `<span class="vb-l${k === leaderKey ? " win" : ""}">${emoji} ${label} <b>${Math.round((tally[k] / total) * 100)}%</b></span>`).join("")
    : `<span class="vb-l">Be the first to steer tomorrow's case</span>`;
  $("r-votebar").innerHTML = `<div class="vb-track">${track}</div><div class="vb-legend">${legend}</div>`;
}

function renderVote() {
  const box = $("r-vote");
  box.innerHTML = "";
  const tally: VoteTally = { ...META.vote.tally };
  if (diffVote && !META.vote.choice) tally[diffVote as keyof VoteTally]++;
  const total = tally.Harder + tally.Same + tally.Softer;
  const entries = Object.entries(tally) as [keyof VoteTally, number][];
  const leader = entries.sort((a, b) => b[1] - a[1])[0];

  const myVote = diffVote ?? META.vote.choice;
  if (!myVote) {
    for (const [key, label] of [["Harder", "🔥 Harder"], ["Same", "⚖️ Same"], ["Softer", "🌿 Softer"]] as [string, string][]) {
      const b = document.createElement("button");
      b.className = "btn secondary"; b.textContent = label;
      b.title = "Solvers set tomorrow's difficulty";
      b.addEventListener("click", async () => {
        diffVote = key;
        renderVote();
        try { const r = await api("/api/vote", { choice: key }); if (r.tally) META.vote.tally = r.tally; toast("Vote counted - tomorrow's case comes from that tier", "ok"); }
        catch { toast("Couldn't record vote", "info"); }
      });
      box.appendChild(b);
    }
  } else {
    const line = document.createElement("div");
    line.className = "vote-done"; line.style.flex = "1";
    setRich(line, ["You voted ", [myVote], ` · ${total} ${total === 1 ? "vote" : "votes"} so far`]);
    box.appendChild(line);
  }
  renderVoteBar(tally, total, leader[0]);
  $("r-envtop").innerHTML = `✉️ CASE #${META.nextCaseNumber} <span class="env-seal">SEALED</span>`;
  const m = META.nextOpensInMin;
  $("r-next").textContent = `Opens in ${Math.floor(m / 60)}h ${pad(m % 60)}m`;
}

function showResult() {
  const r = lastResults;
  if (!r) return;
  setStreakHud(r.streak);
  const demo = META.showcase;                       // judge/demo post → labelled SAMPLE histogram
  const atScale = demo || r.hasHistogram;
  const counts = demo ? DEMO_COUNTS : (r.histogram?.counts ?? []);
  const youIdx = demo ? Math.max(0, BIN_MAX.findIndex((mx) => r.timeSec < mx)) : (r.histogram?.youIdx ?? 0);
  const better = demo ? 0 : (r.hasHistogram ? r.betterPct : 0);

  $("r-hero").innerHTML =
    `<div class="time">${fmtTime(r.timeSec)}</div>
     <div class="pct">${demo ? "🎬 Demo case - sample stats below" : atScale ? `🏆 faster than ${better}% of detectives` : `🕵️ You're the ${ordinal(r.solveOrder)} detective today`}</div>`;

  const rk = rankFor(r.streak);
  const nx = rk.nextLabel ? ` <span class="nx">${rk.nextIn}d → ${rk.nextLabel}</span>` : "";
  const rankTitle = rk.nextLabel ? `${rk.nextIn} ${rk.nextIn === 1 ? "day" : "days"} to ${rk.nextLabel}` : "Top rank reached";
  $("r-stats").innerHTML =
    `<span class="stat" title="Hints used"><span class="ic">💡</span><b>${r.hints}</b> ${r.hints === 1 ? "hint" : "hints"}</span>` +
    `<span class="stat" title="Daily streak"><span class="ic">🔥</span><b>${r.streak}</b> day${r.streak === 1 ? "" : "s"}</span>` +
    `<span class="stat" title="${rankTitle}"><span class="ic">🔍</span><b>${rk.label}</b>${nx}</span>`;

  $("r-histblock").style.display = atScale ? "" : "none";
  if (atScale) renderHistogram(counts, youIdx, better, demo ? "Sample distribution (demo) · real percentile unlocks at 50 solvers" : undefined);

  renderMiniLeaderboard(r, demo);

  const tbl = $("r-table") as HTMLTableElement;
  tbl.innerHTML = "<tr><th>Suspect</th><th>Coat</th><th>Time</th><th>Item</th></tr>";
  for (const s of ctx.suspects) {
    const f = effectiveValue(ctx, grid, "flair", s)!, t = effectiveValue(ctx, grid, "time", s)!, o = effectiveValue(ctx, grid, "object", s)!;
    const ol = valueLabel("object", o, theme);
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${s}</td><td>${flMini(f)} ${valueLabel("flair", f, theme).label}</td><td>${t}</td><td>${ol.emoji} ${ol.label}</td>`;
    tbl.appendChild(tr);
  }

  // showcase (judge/demo) posts are decoupled from the daily ramp → no difficulty vote
  if (META.showcase) $("r-tomorrow").style.display = "none";
  else { $("r-tomorrow").style.display = ""; renderVote(); }

  $("overlay").classList.add("show");
  document.body.classList.add("modal-open");
  spawnConfetti();
}

let confettiShown = false;
function spawnConfetti() {
  if (confettiShown) return; confettiShown = true;
  const host = document.querySelector(".result")!;
  const box = document.createElement("div"); box.className = "confetti";
  const colors = ["#D55E00", "#56B4E9", "#009E73", "#CC79A7", "#ff8c42"];
  for (let i = 0; i < 14; i++) {
    const p = document.createElement("i");
    p.style.left = ((i * 23 + 7) % 96) + "%";
    p.style.background = colors[i % colors.length];
    p.style.animationDelay = (i * 55) + "ms";
    p.style.transform = `rotate(${(i * 47) % 90}deg)`;
    box.appendChild(p);
  }
  host.appendChild(box);
  setTimeout(() => box.remove(), 2600);
}
function hideOverlay() { $("overlay").classList.remove("show"); document.body.classList.remove("modal-open"); }

// ───────────────────────── onboarding: 3 coach marks ─────────────────────────
const TUT_STEPS = [
  { sel: ".clue-panel", text: "Every clue is true. Your job: cross out whatever they rule out." },
  { sel: ".bcell", text: `${IS_COARSE ? "Tap" : "Click"} a chip to cross it out - same again to bring it back.` },
  { sel: ".chip-prog", text: "One chip left in a cell - that's the answer. Deduce all 12 and the case closes itself." },
];
let tutStep = -1;
function coachShow(i: number) {
  const step = TUT_STEPS[i];
  const el = document.querySelector(step.sel) as HTMLElement | null;
  if (!el) { coachEnd(); return; }
  tutStep = i;
  const rect = el.getBoundingClientRect();
  const ring = $("coach-ring");
  ring.style.left = (rect.left - 6) + "px"; ring.style.top = (rect.top - 6) + "px";
  ring.style.width = (rect.width + 12) + "px"; ring.style.height = (rect.height + 12) + "px";
  $("coach-step").textContent = `${i + 1} / ${TUT_STEPS.length}`;
  $("coach-text").textContent = step.text;
  $("coach-next").textContent = i === TUT_STEPS.length - 1 ? "Got it" : "Next";
  const tip = $("coach-tip"); tip.style.visibility = "hidden";
  $("coach").classList.add("show");
  requestAnimationFrame(() => {
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    const x = Math.min(Math.max(8, rect.left), window.innerWidth - tw - 8);
    let y = rect.bottom + 14;
    if (y + th > window.innerHeight - 8) y = Math.max(8, rect.top - th - 14);
    tip.style.left = x + "px"; tip.style.top = y + "px"; tip.style.visibility = "visible";
  });
}
function coachEnd() {
  $("coach").classList.remove("show"); tutStep = -1;
  startTimer(); // "seen" is tracked server-side (tut:{userId}, set on first /api/daily) - no localStorage
}
function startTutorial() { seconds = 0; if (timerInt) clearInterval(timerInt); coachShow(0); }

// ───────────────────────── timer / init ─────────────────────────
let timerInt: number | null = null;
function saveSeconds() { if (!practiceMode) api("/api/state", { seconds }).catch(() => {}); } // persist active time (not practice)
function startTimer() {
  if (timerInt) clearInterval(timerInt);
  timerInt = window.setInterval(() => {
    if (solved || document.visibilityState !== "visible") return; // active time only: pause on solve / hidden tab
    seconds++;
    $("hud-time").textContent = fmtTime(seconds);
    if (seconds % 10 === 0) saveSeconds();
  }, 1000);
}

function helpText(): string {
  const verb = IS_COARSE ? "Tap" : "Click";
  return `${verb} a chip to cross it out, ${verb.toLowerCase()} again to bring it back. One chip left in a cell - that's the answer. Clue status: 🟢 satisfied · 🔴 violated · gray - undecided.`;
}

// reset uses two-tap confirm (confirm() is blocked inside the sandboxed webview)
let resetArm = false, resetTimer: number | null = null;
function restart() {
  if (solved) return;
  if (!resetArm) {
    resetArm = true;
    toast("Tap ↺ again to clear the board", "info");
    if (resetTimer) clearTimeout(resetTimer);
    resetTimer = window.setTimeout(() => { resetArm = false; }, 2500);
    return;
  }
  resetArm = false; if (resetTimer) clearTimeout(resetTimer);
  clearBoard();
  toast("Board cleared", "ok");
}

// "Play this case again" from the results overlay - unconditional replay (the solve is already recorded server-side)
function playAgain() {
  solved = false; confettiShown = false; seconds = 0;
  clearBoard();
  $("btn-hint").removeAttribute("hidden"); // results button stays to reopen the recorded result
  hideOverlay();
  startTimer();
}

function clearBoard() {
  grid = freshGrid(ctx); history = []; hintClueId = null; rowsDone.clear(); clueFirstOk = {};
  hideNotice();
  renderAll(); scheduleSave();
}

function wire() {
  $("btn-restart").addEventListener("click", restart);
  $("btn-undo").addEventListener("click", undo);
  $("notice-x").addEventListener("click", hideNotice);
  $("btn-help").addEventListener("click", () => toast(helpText(), "info", 6000));
  $("btn-warmup").addEventListener("click", () => { if (practiceMode) location.reload(); else enterPractice(); });
  document.addEventListener("visibilitychange", () => { if (document.hidden) saveSeconds(); }); // flush active time when hidden
  $("btn-hint").addEventListener("click", viewHints);
  $("btn-results").addEventListener("click", () => { if (lastResults) showResult(); });
  $("btn-again").addEventListener("click", playAgain);
  $("btn-close").addEventListener("click", hideOverlay);
  $("overlay").addEventListener("click", (e) => { if (e.target === e.currentTarget) hideOverlay(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && $("overlay").classList.contains("show")) hideOverlay(); });
  $("grid-wrap").addEventListener("scroll", updateGridFade, { passive: true });
  $("clue-list").addEventListener("scroll", updateClueFade, { passive: true });
  window.addEventListener("resize", () => { updateGridFade(); updateClueFade(); if (tutStep >= 0) coachShow(tutStep); });
  MQ_NARROW.addEventListener("change", () => { renderGrid(); renderClues(); renderEpilogue(); });
  $("coach-next").addEventListener("click", () => { if (tutStep >= TUT_STEPS.length - 1) coachEnd(); else coachShow(tutStep + 1); });
  $("coach-skip").addEventListener("click", coachEnd);
}

// a saved grid must cover every cat/suspect/value of the current case, else it's stale
function gridMatchesCtx(g: GridState | null, c: PuzzleCtx): boolean {
  if (!g) return false;
  for (const cat of c.catIds) {
    if (!g[cat]) return false;
    for (const s of c.suspects) {
      if (!g[cat][s]) return false;
      for (const v of c.cats[cat]) if (!(v in g[cat][s])) return false;
    }
  }
  return true;
}

// ───────────────────────── onboarding: warm-up practice lane ─────────────────────────
function applyPuzzleData(pz: DailyResp["puzzle"], savedGrid: GridState | null) {
  PZ = pz;
  theme = THEME_BY_ID[pz.themeId];
  clues = pz.clues;
  ctx = {
    suspects: pz.suspects, catIds: CAT_IDS,
    cats: { flair: [...FLAIR_TOKENS], time: [...TIME_TOKENS], object: pz.objectTokens },
    timeValues: [...TIME_TOKENS],
  };
  grid = gridMatchesCtx(savedGrid, ctx) && savedGrid ? savedGrid : freshGrid(ctx);
  hints = 0; solved = false; seconds = 0; history = []; rowsDone.clear(); clueFirstOk = {};
  renderAll(); updateHintBtn();
}

// Opt-in warm-up: one easy practice case to "get the mechanic", then back to today's case.
async function enterPractice() {
  if (practiceMode || solved) return;
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; api("/api/state", { grid }).catch(() => {}); } // flush daily grid
  let pr: any;
  try { pr = await api("/api/practice"); } catch { return; }
  practiceMode = true;
  applyPuzzleData(pr.puzzle, pr.grid ?? null);
  $("case-no").textContent = "WARM-UP";
  $("tier-badge").textContent = "🟢"; $("tier-badge").title = "Warm-up (practice)";
  $("epilogue").textContent = "";
  $("btn-hint").setAttribute("hidden", "");   // hints target the daily case, not practice
  $("btn-warmup").title = "← Back to today's case";
  notice("Warm-up - a throwaway easy case. Tap the ▷ button again to go back to today's case.", "info", true);
  startTimer();
}

function onPracticeSolved(_r: any) {
  notice("Nice - that's the mechanic! Back to today's case…", "ok", true);
  setTimeout(() => location.reload(), 1300);   // reload restores the daily (server-saved grid)
}

async function init() {
  wire();
  let data: DailyResp;
  try { data = await api("/api/daily"); }
  catch {
    $("case-title").textContent = "Failed to load";
    $("clue-list").innerHTML = `<div class="loading">Couldn't load the case. Refresh the post.</div>`;
    return;
  }
  PZ = data.puzzle; META = data.meta;
  theme = THEME_BY_ID[PZ.themeId];
  clues = PZ.clues;
  ctx = {
    suspects: PZ.suspects, catIds: CAT_IDS,
    cats: { flair: [...FLAIR_TOKENS], time: [...TIME_TOKENS], object: PZ.objectTokens },
    timeValues: [...TIME_TOKENS],
  };
  // guard: a saved grid from a different puzzle shape (e.g. bank/rename change) is discarded
  const savedOk = gridMatchesCtx(data.attempt.grid, ctx);
  grid = savedOk ? data.attempt.grid! : freshGrid(ctx);
  hints = data.attempt.hints ?? 0;
  solved = savedOk ? (data.attempt.solved ?? false) : false;
  seconds = savedOk ? (data.attempt.elapsedSec ?? 0) : 0;
  diffVote = data.attempt.vote ?? null;

  const tierEmoji = PZ.tier === "green" ? "🟢" : PZ.tier === "red" ? "🔴" : "🟡";
  $("case-no").textContent = META.showcase ? "🧵 TRY A CASE" : `🧵 CASE #${PZ.caseNumber}`;
  $("case-title").textContent = PZ.title;
  $("tier-badge").textContent = tierEmoji;
  $("tier-badge").title = `Difficulty: ${PZ.tier}`;

  renderAll();
  setStreakHud(META.streak ?? 0);
  updateHintBtn();
  if (solved) trackClueProgress();

  if (solved) {
    $("btn-hint").setAttribute("hidden", "");
    $("btn-results").removeAttribute("hidden");
    api("/api/check", { grid }).then((r) => { if (r.status === "solved") lastResults = r.results; }).catch(() => {});
    startTimer();
  } else {
    // first-visit tutorial: server-tracked (META.showTutorial - per logged-in user, once; false for guests).
    // ?tut=1 forces it (judges/testing), ?tut=0 suppresses. No localStorage (unreliable in the webview).
    const tutParam = new URLSearchParams(location.search).get("tut");
    if (tutParam === "1" || (tutParam !== "0" && META.showTutorial)) startTutorial();
    else startTimer();
  }
}

init();
