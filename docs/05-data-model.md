# Модель данных

Deducto - ежедневная дедуктивная головоломка на Reddit (Devvit Web). Здесь описан реальный формат данных: типы из `src/shared/types.ts` и `src/shared/status.ts`, форма записи банка (`src/server/index.ts`) и раскладка Redis. Решение и таймер живут ТОЛЬКО на сервере - клиент решения не получает (анти-чит).

Сетка: 4 подозреваемых x 3 категории. Внутренние id категорий: `flair` (Coat), `time` (Time), `object` (Item).

## Общие типы (`src/shared/types.ts`)

Клиент и сервер делят один модуль. Форма улики 1:1 совпадает с движком сложности (проверена паритетом против Python-солвера).

```ts
type CatId = string;                                   // "flair" | "time" | "object"
type Cats = Record<CatId, string[]>;                   // catId -> значения
type Solution = Record<string, Record<CatId, string>>; // suspect -> cat -> value

// Ссылка в улике: ["s", suspectName] либо [catId, value].
type Ref = [string, string];

// Улика - размеченное объединение по полю k (kind).
type Clue =
  | { k: "ne";     s: string; cat: CatId; v: string } // подозреваемый != значение
  | { k: "same";   a: Ref; b: Ref }                   // a,b - один владелец
  | { k: "nsame";  a: Ref; b: Ref }                   // разные владельцы
  | { k: "before"; a: Ref; b: Ref };                  // time(a) < time(b)

// Каноничный ключ улики (дедуп и сравнение по значению, аналог repr()).
function clueKey(c: Clue): string;
```

Ровно четыре вида улик: `ne`, `same`, `nsame`, `before`. Никаких `equal` / `after` / `location`.

## Состояние поля (`src/shared/status.ts`)

Отметки игрока считаются независимо от скрытого решения - честная обратная связь без спойлеров.

```ts
type Cell = 0 | 1 | 2;   // 0 = чисто (unknown), 1 = вычеркнуто, 2 = подтверждено
type GridState = Record<string, Record<string, Record<string, Cell>>>; // cat -> suspect -> value -> Cell

interface PuzzleCtx {
  suspects: string[];
  catIds: string[];               // порядок категорий, ["flair","time","object"]
  cats: Record<string, string[]>; // catId -> значения
  timeValues: string[];           // упорядоченные значения времени (для before)
}
```

Поле - двухпозиционный тумблер: тап переключает ячейку 0 <-> 1 (вычеркнуть значение / очистить). Состояние 2 (подтверждено) движок поддерживает, но текущий board-UI его не выставляет: «эффективный ответ» ячейки выводится из вычерков (единственный невычеркнутый кандидат). Дело закрывается автоматически, когда все 12 ячеек детерминированы и каждая улика зелёная. Кнопки «Проверить решение» и понятия «ошибки» нет.

## Запись банка (`src/server/index.ts`, `bank.json`)

```ts
interface BankEntry {
  themeId: string;
  tier: "green" | "yellow" | "red"; // в проде только green/yellow; red - бэклог
  suspects: string[];
  objectTokens: string[];           // значения категории object
  clues: Clue[];
  solution: Solution;               // серверный секрет, клиенту не уходит
  score?: number;                   // офлайновый скор сложности (build-bank.ts)
  bin?: number;                     // квантильный бин сложности
}
```

Честные две ступени сложности: green (L0, разминка / решается на поле) и yellow (L1, ежедневная, нужна перекрёстная сверка). Красной/хардкорной ступени в проде нет.

Клиенту уходит публичная форма (без `solution`):

```ts
{
  idx, caseNumber, themeId, tier, level,
  title, legend,
  suspects, objectTokens, clues,
  day,               // YYYY-MM-DD
}
```

## Персистентность (Redis)

Прогресс и статистика лежат в Redis, а не в общих типах. Ключи:

- `att:{postId}:{userId}` - хэш попытки: `startedAt`, `grid` (JSON GridState), `activeSec`, `timeSec`, `hints`, `hinted`, `solved`, `solvedAt`, `solveOrder`, `vote`.
- `lb:{postId}` - sorted set лидерборда: member = username, score = время решения (сек).
- `vote:{postId}` - хэш голосов сложности: `Harder` / `Same` / `Softer`.
- `solvedCount:{postId}` - счётчик, задаёт порядок финиша (`solveOrder`).
- `streak:{userId}` - хэш серии: `current`, `best`, `lastDate`.
- `tut:{userId}` - флаг «туториал показан».
- `lt:level`, `lt:lastPostId`, `lt:bucketCursor:{level}`, `bank:cursor` - состояние ежедневного рампа сложности.
- `onb:{userId}`, `pract:{userId}:{k}` - изолированная разминочная дорожка (без лидерборда / голоса / серии).
