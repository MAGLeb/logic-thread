# Launch content (EN) — pinned comment, post templates, flair ladder

Готовые тексты для Devvit-слоя. Всё на английском; править здесь, порт копирует as-is.

## Pinned bot comment (под каждым daily-постом)

> **How this works:** every clue is true — cross out what they rule out, and the case closes itself when all 12 answers are deduced. New case daily at 00:00 UTC.
>
> **Thread rules:** hints and clue-talk are welcome in the open. Full solutions go under spoiler tags: `>!like this!<`. Post your **trail** (the 📋 Copy button) — one verdict, many roads; compare paths, not answers.

Правила = 2 строки (норма стратегии). Reply-фича «follow-up от имени игрока» (`runAs:'USER'`) отвечает именно на этот коммент.

## Post title template (cron)

```
Case #{n}: {case_title} — {tier_label} (community vote {pct}%)
```

- Day 1 (нет вчерашнего голоса): `Case #1: The Cursed Pizza — daily deduction`
- Далее: `Case #14: The Vanished Violin — HARD (community voted 62%)`

## Epilogue line (в шапке игры, из Redis)

```
🥇 Yesterday: {top_user} in {top_time} · {solvers} detectives closed the case · voted {tier} ({pct}%)
```

Первый день — строка скрыта (нет «вчера»).

## Honest-stats rules (де-слоп)

- `solvers < 50` → вместо перцентиля и гистограммы: `🕵️ You're the {ordinal} detective today`.
- `solvers ≥ 50` → `🏆 faster than {pct}% of detectives` + гистограмма (zRank/zCard).
- Никаких «world best» и посеянных чисел. Streak и flair — только реальные значения игрока.

## Flair ladder (setUserFlair)

| Streak | Flair |
|---|---|
| 1+ | 🔎 Detective · 🔥 {n} |
| 3+ | 🕵️ Inspector · 🔥 {n} |
| 7+ | 🎩 Chief Inspector · 🔥 {n} |
| 14+ | 🧠 Mastermind · 🔥 {n} |
| 30+ | 🏛 Legend of the Yard · 🔥 {n} |

Первые два повышения — в первые 3 дня (стратегия: ранние награды). Сломанная серия → флаир остаётся, счётчик 🔥 сбрасывается ремонтом «остывшего дела» (TIER 2, после MVP).

## Trail format (share-артефакт)

```
🧵 Case #{n} · ⏱ {mm:ss} · path {②→①→④→③} · 💡 {hints} [ · clue #{k} untouched]
```

Кружки = порядок, в котором игрок закрыл подозреваемых (позиция в списке), — путь без спойлера решения. «Untouched» — улики, выполнившиеся только последним ходом (не понадобились на пути).

## Difficulty verdict (vote → cron)

- Голосуют только решившие: `🔥 Harder / ⚖️ Same / 🌿 Softer`.
- Победивший тир определяет структуру улик завтрашнего кейса из банка (🟢/🟡; red-тир не на запуске).
- Конверт на экране результата: `✉️ CASE #{n+1} [SEALED] · Difficulty: {TIER} leads — {pct}% of {total} votes · Opens in {hh}h {mm}m`.
