# Модель данных (эскиз)

Детали будут меняться — здесь только каркас.

```ts
type CellState = "unknown" | "no" | "yes";

type Entity = {
  id: string;
  label: string;
  icon?: string;
};

type Category = {
  id: "flair" | "time" | "object" | "location";
  label: string;
  values: Entity[];
  ordered?: boolean; // для before/after clues
};

type Clue = {
  id: string;
  text: string;
  type: "not_equal" | "equal" | "same_owner" | "not_same_owner" | "before" | "after";
  refs: EntityRef[];
};

type Puzzle = {
  id: string;
  date: string;
  title: string;
  theme: string;
  suspects: Entity[];
  categories: Category[];
  solution: Solution;   // скрытое, хранится на сервере
  clues: Clue[];
  difficulty: "easy" | "medium" | "hard";
};

type UserAttempt = {
  userId: string;
  puzzleId: string;
  grid: Record<string, CellState>;
  startedAt: number;    // server-authoritative
  solvedAt?: number;
  mistakes: number;
  hintsUsed: number;
  solved: boolean;
};

type UserStats = {
  userId: string;
  currentStreak: number;
  bestStreak: number;
  lastSolvedDate?: string;
  totalSolved: number;
};
```
