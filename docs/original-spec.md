# Полная исходная концепция (архив)

> Этот файл — архив первоначальной детальной проработки. Рабочие документы — в остальных файлах `docs/`. Детали здесь могут устареть; при расхождении верить рабочим докам.

## Logic Thread — короткая формулировка

Logic Thread — это ежедневная Reddit-native deductive puzzle game. Игрок решает логическую сетку по clues, как в Einstein/Zebra puzzle, но игра встроена в Reddit: комьюнити предлагает темы, персонажей и предметы для следующих дел, делится deduction cards в комментариях и каждый день формирует новое расследование.

Главный loop: Solve today's case → share your deduction → vote/build tomorrow's case → return tomorrow to see what the community created.

## 1. Продуктовая идея

Каждый день в сабреддите появляется интерактивный пост: **Case #12: The Cursed Pizza Incident**.

Категории:
- suspects: John, Mira, Paul, Lana, ModBot;
- flairs: Red, Blue, Green, Yellow, Purple;
- objects: pizza, keyboard, spoon, badge, scroll;
- times: 09:00, 12:00, 15:00, 18:00, 21:00;
- locations/threads: Gaming, Cooking, AITA, Science, Community.

Игрок получает набор логических условий (The cursed pizza was not in Gaming; The user with the yellow flair posted before Mira; John was not online at 15:00; The purple flair posted after ModBot) и должен восстановить единственное правильное соответствие — заполнить таблицу suspect × (flair, time, object, location).

## 2. Главный продуктовый hook

Логическая игра — ядро; победная часть — community loop. После решения игрок может:
- увидеть результат: solved time, mistakes, hints used, streak, faster than X% detectives;
- создать deduction card («Clue 2 + Clue 5 prove Mira could not have yellow flair») и отправить в комментарии;
- проголосовать за тему следующего дела (Space Station Drama, Haunted Subreddit, Cooking Disaster, Medieval Mod Trial);
- предложить персонажа (BananaWizard, Captain Frog, PizzaMage, The Silent Lurker);
- вернуться завтра: победившая тема, топ персонажей, новый puzzle из вчерашних community inputs.

Формула: **Reddit creates the mystery. You solve the grid. The community shapes tomorrow's case.**

## 3. Почему Reddit

Reddit добавляет: daily post as shared arena; comments as deduction board; community-submitted suspects/items/themes; voting; top contributors; recurring inside jokes; public solved/deduction sharing. Reddit — часть игрового цикла, а не контейнер.

## 4. Целевой пользователь

Любители Wordle/Sudoku/Nonograms/logic grid puzzles; Reddit-пользователи, обсуждающие решения; puzzle/mystery сабреддиты; casual игроки (3–7 минут в день). Первый puzzle решаем за 3–5 минут.

## 5. UX-направление

Не «газетный лист», а компактное игровое поле: dark game board, compact HUD, large central puzzle area, bottom controls. Стиль: dark navy/charcoal, orange accent, green correct, red impossible, purple/blue/yellow flair-категории, rounded panels, minimal clutter.

## 6. Основные экраны

**Экран 1. Main Gameplay** — header (subreddit/app, title), HUD (Case title, Timer, Mistakes, Clue x/12), слева active clue panel c [Prev][Next][All], справа большой grid, снизу Restart | Clues | Undo | Hint | Check, футер «Tomorrow's vote unlocks after solving».

**Экран 2. Focused Deduction Mode** — активная дедукция («Mira cannot have yellow flair»), связанные clues соединены нитями как detective board, в grid подсвечены строка Mira / колонка Yellow / ячейка, кнопка Apply Deduction.

**Экран 3. Result / Community** — Case Solved! (время, ошибки, streak, faster than 72%), final deductions, top deduction card (upvotes), poll на завтрашнюю тему (с процентами), submit a suspect (chips), кнопки Share Deduction / Vote for Tomorrow.

## 7. Core mechanics

- CellState = unknown | no | yes; клик циклит unknown → no → yes; long tap — сразу yes; undo всегда.
- Auto-elimination: yes ⇒ авто-`no` по строке и колонке. Включён по умолчанию (mobile UX).
- Check: всё верно → solved; неверный yes → +1 mistake, «something is inconsistent» (без деталей); incomplete → «Not enough deductions yet».
- Hints, 3 уровня: подсветить clue → подсветить row/column → поставить forced deduction. MVP: уровень 1.
- Deduction Cards: выбрать/сгенерировать карточку, отправить комментом (если API позволяет) или copy/share.

## 8. Puzzle structure

MVP: 5 suspects, 4 категории по 5 значений. Grid UI показывает пары Suspects × Category (вкладками), не классическую мега-grid. Основная сущность — suspect.

## 9–12. Генерация задач

Риск: уникальность решения. Пайплайн: скрытое решение → пул валидных clues → выбор подмножества → solver → solutionCount === 1 → оценка сложности → добавить clue / пересобрать.

Solver: backtracking category-by-category с pruning, остановка после 2 решений.

```ts
function countSolutions(puzzle: Puzzle, limit = 2): number {
  let count = 0;
  function backtrack(partial: PartialAssignment) {
    if (count >= limit) return;
    if (isComplete(partial)) {
      if (allCluesSatisfied(partial, puzzle.clues)) count += 1;
      return;
    }
    for (const next of generateNextAssignments(partial)) {
      if (canStillSatisfyClues(next, puzzle.clues)) backtrack(next);
    }
  }
  backtrack({});
  return count;
}
```

Clue templates: not_equal; equal (редко); before/after (ordered категории); same_owner; not_same_owner; either/or (не MVP); relative position; category exclusion.

Генератор: community inputs (темы/персонажи с votes) → generateSolution (seeded shuffle, seed = subredditId + date + themeId) → clue pool → greedy select (random clue, проверить что уменьшает число решений, до unique) → difficulty estimate (easy 6–8, medium 8–10, hard 10–12 clues).

## 13. Data model

Puzzle { id, date, subredditId, title, theme, suspects, categories, solution, clues, difficulty, createdAt }; Entity { id, label, icon?, color?, submittedBy? }; Category { id, label, values, ordered? }; Clue { id, text, type, refs, params }; UserAttempt { userId, puzzleId, grid, startedAt, solvedAt?, mistakes, hintsUsed, solved, streakAfterSolve? }; CommunityVote { userId, date, pollId, optionId, createdAt }; CommunitySubmission { id, userId, date, type, text, normalizedText, votes, status, createdAt }.

## 14. Devvit / Reddit architecture

Devvit Web, React + TypeScript, Vite, CSS modules/Tailwind, server-side Devvit handlers, Devvit storage.

Client: UI, локальный grid state, actions на backend, timer display, tabs, active clue, check/hint/apply deduction.
Server: daily puzzle создание/хранение, attempts, валидация solution, leaderboard/stats, votes/submissions, tomorrow seed.

API: getDailyPuzzle, getUserAttempt, saveGridState, checkSolution, useHint, submitVote, submitCommunityItem, getResults, generateDeductionCard.

## 15. Состояния игры

Not started (сразу grid, без Start) → In progress (timer/mistakes/hints/clue/grid/controls) → Wrong check («Something does not fit the case») → Solved → Post-solve community (vote, submit, share, leaderboard, top cards). Во время решения не показывать poll/submit/leaderboard/длинные списки.

## 16. UI specification

Ширина ~720–900 px, высота ~500–650 px, один game panel, dark background, минимальный scrolling. Layout: header → top HUD → left clue panel → right grid → bottom controls → tiny community footer.

## 17. MVP scope

Must: daily puzzle, 5×5 grid, 3 вкладки (Flair/Time/Object), clues navigation, cell states, auto-elimination, check, timer, mistakes, hints counter, result screen, vote, submit suspect, README+demo. Should: deduction cards, leaderboard, streak, top submissions, seeded demo. Could: полный генератор, difficulty, multi-subreddit, advanced clues, polish, comment integration.

## 18. Хакатон

Vertical slice: solve → result → vote → submit → tomorrow preview. Генератор можно упростить: 10 puzzle templates + community substitution + solver uniqueness check + fallback prepared puzzle.

## 19. Daily система

Дата UTC (MVP). Seed `subredditId:puzzleDate:winningThemeId` — воспроизводимость и дебаг. Solution сохранять всё равно.

## 20. Community loop

Poll (1 user = 1 vote). Submit: max 24 chars, no URLs/slurs/personal data/explicit, normalize, reject duplicates. Победители: топ тема, топ N accepted suspects/objects, fallback. Credit в шапке: «Theme chosen by 1,842 detectives. Featuring BananaWizard by u/example.»

## 21. Leaderboard

MVP: solved / time / mistakes / hints. Ranking: solved → fewer hints → fewer mistakes → faster. Display: «Solved in 04:31 · 0 mistakes · 0 hints · Faster than 72%».

## 22. Streak

lastSolvedDate = yesterday → +1; = today → ничего; иначе → 1. UserStats { currentStreak, bestStreak, lastSolvedDate, totalSolved }.

## 23. Moderation

Length limit, banned words, no links/emails/phones, no u/realperson, trim повторов, lowercase dedup. Fallback defaults: BananaWizard, Captain Frog, PizzaMage, The Silent Lurker, ModBot, The Archivist.

## 24. Anti-cheat

Server-authoritative: timer start, solvedAt, checkSolution, hints/mistakes, leaderboard по server times. Client timer — display only.

## 25. README structure

Продающий README: what it is, how to play (5 шагов), why Reddit (comments as deduction cards, votes, submissions, inside jokes), retention loop, tech (Devvit Web, React, TS, backtracking solver).

## 26. Demo strategy

Показать весь loop: gameplay, focused deduction, solved, vote, submission chips, tomorrow preview. Seeded demo data — честно указать в README.

## 27. Implementation plan (10 дней, хакатонный)

1: Devvit setup, shell, dark layout, static screen. 2: grid component, cell cycle, tabs, local state. 3: data model, static puzzle JSON, clue navigation, highlights. 4: check, mistakes, timer, auto-elimination, undo. 5: solver, template-based generator, uniqueness. 6: server storage, attempts, daily loading, streak. 7: result screen, poll, submit suspect. 8: deduction cards, share flow, leaderboard/stats. 9: polish, анимации, error states, responsiveness. 10: README, demo post, assets, видео.

## 28. Риски

1. Генератор съест время → templates + solver validation. 2. UI слишком текстовый → compact dark board. 3. Community layer приклеен → contribution влияет на tomorrow case. 4. Слишком сложно → medium-light, 5 suspects, 8–10 clues, hints. 5. Судья не поймёт за минуту → «Solve today. Shape tomorrow.» в UI и README.

## 29. Финальная версия

Название: Logic Thread. Tagline: Daily deduction. Solve today's case. Shape tomorrow's mystery.

Pitch: ежедневная Reddit-native deduction game; решил grid → deduction cards в комментариях → голос за завтрашнюю тему → submit suspects/objects → сабреддит коллективно создаёт mystery.

Core promise: Every day you get one clever case. Every solve helps build tomorrow's stranger case.

## 30. Вердикт

Это daily puzzle + deduction game + Reddit ritual + UGC loop + retention mechanic + judge-friendly demo. Оценка 8.5/10. Главное — не делать всё: очень гладкий основной экран (тёмное компактное поле, минимум текста, максимум playable space), community mechanics — после решения как награда.
