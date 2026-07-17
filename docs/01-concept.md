# Концепция

## Что это

Deducto - ежедневная Reddit-native deductive puzzle game. Каждый день в сабреддите появляется интерактивный пост с новым «делом» (case). Игрок восстанавливает единственное правильное соответствие между сущностями по набору логических условий.

## Что делает игрок

Пример дела: **The Cursed Pizza**

Сетка: 4 подозреваемых x 3 категории (Coat / Time / Item).
- suspects: John, Mira, Paul, Omar
- coats (Coat): Red, Blue, Green, Purple
- times (Time): 09:00, 12:00, 15:00, 18:00
- items (Item): Pizza, Keyboard, Spoon, Scroll

Игрок читает clues («The pizza was carried by the purple coat.», «Omar was seen before John.», «John wasn't seen at 18:00.»…) и заполняет логическую сетку 4x3: каждому suspect - свой coat, time, item. Ячейка переключается в два состояния (вычеркнуть значение / сброс). Дело закрывается само, когда все 12 клеток выведены и все улики зелёные - нет кнопки «Check» и нет счётчика ошибок.

## Главный hook

Сама головоломка - ядро. Победная часть - то, что происходит после решения:

1. **Результат**: время, hints, streak, «faster than X% detectives».
2. **Deduction**: игрок защищает ход мысли («Clue 4 + Clue 7 prove John's coat is purple») в комментариях - это обсуждение решения, а не отдельная механика.
3. **Вернуться завтра** - за новым делом и ради серии.

## Почему Reddit

Reddit - не контейнер, а арена игрового цикла:
- daily post как shared arena;
- комментарии как deduction board - доска дедукций и споров о решении;
- recurring inside jokes сабреддита;
- top contributors по серии и скорости.

## Аудитория

- Любители Wordle, Sudoku, Nonograms, logic grid puzzles.
- Reddit-пользователи, любящие обсуждать решения.
- Сабреддиты с puzzle/games/logic/mystery культурой.
- Casual игроки: 3-7 минут умственного напряжения в день.

Первый puzzle должен решаться за 3-5 минут - не хардкор.

## Core promise

> Every day, one clever case.
> Solve it, argue your logic in the thread, keep your streak.
