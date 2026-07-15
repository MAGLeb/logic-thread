# Архитектура (Devvit)

## Stack

- Devvit Web;
- React + TypeScript + Vite;
- CSS modules / Tailwind;
- server-side Devvit handlers + Reddit/Devvit storage.

## Client

- Рендерит UI, локальный grid state, timer (display only);
- борд, active clue highlight, check/hint;
- отправляет actions на backend.

## Server (source of truth)

- Создаёт daily puzzle, если его нет;
- хранит canonical puzzle, user attempts;
- валидирует solution, считает stats/leaderboard;
- server: daily puzzle, attempts, валидация, leaderboard/streak.

## API (примерный набор)

```
getDailyPuzzle(subredditId, date)
getUserAttempt(puzzleId, userId)
saveGridState(puzzleId, grid)
checkSolution(puzzleId, grid)
useHint(puzzleId)
getResults(puzzleId)
```

## Daily puzzle

- Дата: UTC для MVP;
- seed: `subredditId:date:themeId`.

## Anti-cheat (базово, не критично для хакатона)

Server-authoritative: timer start при первом open, solvedAt, checkSolution, hints/mistakes — всё на сервере. Client timer только для отображения.
