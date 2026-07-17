# Data model

Deducto is a daily deductive puzzle on Reddit (Devvit Web). This describes the real data format: types from `src/shared/types.ts` and `src/shared/status.ts`, the bank record shape (`src/server/index.ts`), and the Redis layout. The solution and timer live ONLY on the server - the client never receives the solution (anti-cheat).

Grid: 4 suspects x 3 categories. Internal category ids: `flair` (Coat), `time` (Time), `object` (Item).

## Shared types (`src/shared/types.ts`)

Client and server share one module. The clue shape matches the difficulty engine 1:1 (verified for parity against the Python solver).

```ts
type CatId = string;                                   // "flair" | "time" | "object"
type Cats = Record<CatId, string[]>;                   // catId -> values
type Solution = Record<string, Record<CatId, string>>; // suspect -> cat -> value

// Reference in a clue: ["s", suspectName] or [catId, value].
type Ref = [string, string];

// Clue - discriminated union on the k (kind) field.
type Clue =
  | { k: "ne";     s: string; cat: CatId; v: string } // suspect != value
  | { k: "same";   a: Ref; b: Ref }                   // a,b - same owner
  | { k: "nsame";  a: Ref; b: Ref }                   // different owners
  | { k: "before"; a: Ref; b: Ref };                  // time(a) < time(b)

// Canonical clue key (dedup and compare by value, analog of repr()).
function clueKey(c: Clue): string;
```

Exactly four clue kinds: `ne`, `same`, `nsame`, `before`. No `equal` / `after` / `location`.

## Grid state (`src/shared/status.ts`)

The player's marks are computed independently of the hidden solution - honest feedback without spoilers.

```ts
type Cell = 0 | 1 | 2;   // 0 = clear (unknown), 1 = crossed out, 2 = confirmed
type GridState = Record<string, Record<string, Record<string, Cell>>>; // cat -> suspect -> value -> Cell

interface PuzzleCtx {
  suspects: string[];
  catIds: string[];               // category order, ["flair","time","object"]
  cats: Record<string, string[]>; // catId -> values
  timeValues: string[];           // ordered time values (for before)
}
```

The grid is a two-state toggle: a tap switches a cell 0 <-> 1 (cross out value / clear). State 2 (confirmed) is supported by the engine, but the current board UI does not set it: the cell's "effective answer" is derived from the crossouts (the single non-crossed-out candidate). The case closes automatically when all 12 cells are determined and every clue is green. There is no "Check solution" button and no concept of an "error".

## Bank record (`src/server/index.ts`, `bank.json`)

```ts
interface BankEntry {
  themeId: string;
  tier: "green" | "yellow" | "red"; // in prod only green/yellow; red - backlog
  suspects: string[];
  objectTokens: string[];           // values of the object category
  clues: Clue[];
  solution: Solution;               // server secret, never sent to the client
  score?: number;                   // offline difficulty score (build-bank.ts)
  bin?: number;                     // difficulty quantile bin
}
```

Two honest difficulty steps: green (L0, warm-up / solvable on the grid) and yellow (L1, the daily, requires cross-checking). There is no red/hardcore step in prod.

The client receives the public shape (without `solution`):

```ts
{
  idx, caseNumber, themeId, tier, level,
  title, legend,
  suspects, objectTokens, clues,
  day,               // YYYY-MM-DD
}
```

## Persistence (Redis)

Progress and stats live in Redis, not in the shared types. Keys:

- `att:{postId}:{userId}` - attempt hash: `startedAt`, `grid` (JSON GridState), `activeSec`, `timeSec`, `hints`, `hinted`, `solved`, `solvedAt`, `solveOrder`, `vote`.
- `lb:{postId}` - leaderboard sorted set: member = username, score = solve time (sec).
- `vote:{postId}` - difficulty vote hash: `Harder` / `Same` / `Softer`.
- `solvedCount:{postId}` - counter, sets the finish order (`solveOrder`).
- `streak:{userId}` - streak hash: `current`, `best`, `lastDate`.
- `tut:{userId}` - "tutorial shown" flag.
- `lt:level`, `lt:lastPostId`, `lt:bucketCursor:{level}`, `bank:cursor` - state of the daily difficulty ramp.
- `onb:{userId}`, `pract:{userId}:{k}` - isolated warm-up track (no leaderboard / vote / streak).
