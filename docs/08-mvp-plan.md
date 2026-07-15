# MVP scope и план

## Must-have

- Один daily puzzle, grid 5×5;
- один борд: строки — suspects, колонки — категории (Flair / Time / Object);
- clues navigation, cell states (unknown/X/✓), auto-elimination;
- check solution, timer, mistakes, hints counter;
- result screen, streak;
- README + demo post.

## Should-have

Basic leaderboard, streak, seeded demo data.

## Could-have

Полный автоматический генератор, difficulty levels, multiple subreddits, advanced clue types, animation/polish, comment posting integration.

## Стратегия хакатона

**Vertical slice**: solve today → результат (время / серия / перцентиль) → обсуждение в комментах → вернуться завтра. Судья должен увидеть полный product loop, даже если generator template-based.

## Demo

В demo post: main gameplay, solved screen со статами и серией, обсуждение в нативных комментах поста. Seeded demo data — честно указать в README:
> Demo includes seeded demo data to demonstrate the full daily loop before organic usage.

## Главные риски и решения

| Риск | Решение |
|---|---|
| Генератор съест время | templates + solver validation, не open-ended генерация |
| UI станет слишком текстовым | compact dark board, one active clue, big grid |
| Игра выглядит как обычная головоломка | Reddit-ритуал: ежедневность, серия, тред-обсуждение |
| Puzzle слишком сложный | первый — medium-light, 5 suspects, 8–10 clues, hints |
| Судья не поймёт loop за минуту | прямо в UI и README: «One clever case a day.» |

## Текущий план работ (не хакатонный график)

1. ✅ Документация по файлам
2. ⏳ Тестовая партия (понять механику)
3. Дизайн: одна страница на localhost со всеми экранами
4. Фиксация решений в документации
5. Реализация
