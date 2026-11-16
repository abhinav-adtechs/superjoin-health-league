# Scoring engine (v3)

This is a readable specification of the points engine as implemented in [`lib/points.ts`](../lib/points.ts) — the single source of truth used by every server route that writes or ranks entries. If this document and the code ever disagree, the code wins; please open an issue.

> [!NOTE]
> v3 shipped on 21 May 2026 ([`a516d65`](https://github.com/abhinav-adtechs/superjoin-health-league/commit/a516d65a2f77dd6a3f798f532acfdc40d38b88c9)). The previous v2 rules and the reasoning behind them are preserved in [`points-system-v2-algorithm.md`](../points-system-v2-algorithm.md). Stored entries can be rescored with [`scripts/migrate-to-v3-scoring.js`](../scripts/migrate-to-v3-scoring.js) (dry run by default; `--apply` writes).

## Contents

- [Design goals](#design-goals)
- [Age adjustment](#age-adjustment)
- [Workout](#workout-max-25)
- [Movement](#movement-max-20)
- [Sleep](#sleep-max-15)
- [Nutrition](#nutrition-max-15-or-30)
- [Daily total and cap](#daily-total-and-cap)
- [Goal-crush days](#goal-crush-days)
- [Bonuses](#bonuses)
- [Leaderboard scores](#leaderboard-scores)
- [Worked example](#worked-example)

## Design goals

1. **Reward effort, not ticking boxes.** Duration and volume map to gradients, so 60 minutes earns more than 15 — but 15 still counts.
2. **Balance categories.** No single category can carry a day; a "goal-crush" day needs at least three of four categories.
3. **Be fair across ages and goals.** Duration and step thresholds relax by 15% for the over-35 bracket, and nutrition only scores what a user chose to track.
4. **Points for health, not for logging.** Every field is optional; an empty field scores zero, never a penalty.

## Age adjustment

Users are bucketed by age (`under_25`, `25_to_35`, `over_35`). Only `over_35` changes thresholds:

$$
a = \begin{cases} 0.85 & \text{age bracket} = \text{over 35} \\ 1.0 & \text{otherwise} \end{cases}
\qquad
T(x) = \operatorname{round}(a \cdot x)
$$

$T$ applies to workout and cardio minutes and to fixed step thresholds. It does **not** apply to sleep, water, protein or calories.

| Nominal threshold | 15 min | 30 min | 45 min | 60 min | 2,500 | 5,000 | 7,500 | 10,000 steps |
| ----------------- | ------ | ------ | ------ | ------ | ----- | ----- | ----- | ------------ |
| Over 35           | 13     | 26     | 38     | 51     | 2,125 | 4,250 | 6,375 | 8,500        |

## Workout (max 25)

Strength / gym sessions. With duration $d$ in minutes and `workout_done` set:

$$
W(d) = \begin{cases}
25 & d \ge T(60) \\
20 & d \ge T(45) \\
15 & d \ge T(30) \\
11 & d \ge T(15) \\
5 & \text{otherwise}
\end{cases}
$$

$W = 0$ when no workout is logged.

## Movement (max 20)

Movement combines cardio and steps, capped together at 20.

**Cardio** (duration $c$, when `cardio_done` is set):

$$
C(c) = \begin{cases}
20 & c \ge T(60) \\
16 & c \ge T(45) \\
12 & c \ge T(30) \\
8 & c \ge T(15) \\
4 & \text{otherwise}
\end{cases}
$$

**Steps** ($s$). If the user has a daily step goal $g$, points scale with progress $p = s / g$; otherwise fixed thresholds apply:

$$
S = \begin{cases}
20 & p \ge 1 \\
15 & p \ge 0.75 \\
10 & p \ge 0.5 \\
5 & p \ge 0.25 \\
0 & \text{otherwise}
\end{cases}
\qquad\text{or, without a goal}\qquad
S = \begin{cases}
20 & s \ge T(10000) \\
15 & s \ge T(7500) \\
10 & s \ge T(5000) \\
5 & s \ge T(2500) \\
0 & \text{otherwise}
\end{cases}
$$

$$
M = \min(C + S,\ 20)
$$

## Sleep (max 15)

Hours slept $h$. The sweet spot is 8–9 hours; oversleeping scores slightly less:

$$
Z(h) = \begin{cases}
15 & 8 \le h < 9 \\
13 & h \ge 9 \\
12 & 7 \le h < 8 \\
7 & 6 \le h < 7 \\
3 & 5 \le h < 6 \\
0 & h < 5
\end{cases}
$$

## Nutrition (max 15 or 30)

What counts depends on the user's `food_tracking_mode`:

| Mode                     | Components                                | Category max |
| ------------------------ | ----------------------------------------- | ------------ |
| _(not set)_ — water only | water (15)                                | 15           |
| `calories_only`          | water (15) + calories (15)                | 30           |
| `protein_only`           | water (15) + protein (15)                 | 30           |
| `both`                   | water (10) + protein (10) + calories (10) | 30           |

**Water** — litres $w$:

| $w \ge$      | 3.0 | 2.5 | 2.0 | 1.5 | 1.0 |
| ------------ | --- | --- | --- | --- | --- |
| max-15 scale | 15  | 12  | 9   | 6   | 3   |
| max-10 scale | 10  | 8   | 6   | 4   | 2   |

**Protein** — grams $q$ against the daily goal $G$ (progress $q/G$). Any positive intake below 25% still earns a token point or two:

| $q/G \ge$    | 1.0 | 0.75 | 0.5 | 0.25 | > 0 |
| ------------ | --- | ---- | --- | ---- | --- |
| max-15 scale | 15  | 11   | 7   | 4    | 2   |
| max-10 scale | 10  | 7    | 5   | 3    | 1   |

Without a protein goal the same points apply at fixed thresholds of 120 / 90 / 60 / 30 / 1 g.

**Calories** — intake $k$ against the daily target $K$, scored by the tightest margin $m$ that the intake satisfies. The acceptable side depends on the fitness goal:

$$
\text{lose weight: } K(1-m) \le k \le K
\qquad
\text{gain weight / muscle: } K \le k \le K(1+m)
\qquad
\text{otherwise: } |k - K| \le mK
$$

| Margin $m$   | 2%  | 5%  | 10% | 15% | outside |
| ------------ | --- | --- | --- | --- | ------- |
| max-15 scale | 15  | 12  | 8   | 4   | 0       |
| max-10 scale | 10  | 8   | 5   | 3   | 0       |

Calories score zero if no target or no intake is recorded. Nutrition is then:

$$
N = \min(\text{water} + \text{protein} + \text{calories},\ N_{\max}), \qquad N_{\max} \in \{15, 30\}
$$

## Daily total and cap

$$
P = \min\big(W + M + Z + N,\ \text{cap}\big), \qquad
\text{cap} = \begin{cases} 75 & \text{water-only tracking} \\ 90 & \text{calories, protein or both} \end{cases}
$$

The category maxima sum exactly to the cap ($25 + 20 + 15 + 15 = 75$ and $25 + 20 + 15 + 30 = 90$), so the cap is a safety net rather than a penalty. Bonuses below stack **on top** of the cap.

## Goal-crush days

A day is a goal-crush day when both conditions hold:

$$
P \ge \left\lfloor 0.7 \cdot \text{cap} \right\rfloor \quad (52 \text{ or } 63)
\qquad\text{and}\qquad
\#\{\text{active categories}\} \ge 3
$$

A category is active when: a workout is logged (workout); cardio is logged or steps > 0 (movement); sleep ≥ 5 h (sleep); or any water, protein or calories are logged (nutrition). Because workout + movement max out at 45, exercise alone can never crush a day.

## Bonuses

Bonuses are added when the leaderboard is computed (see `app/api/leaderboard/route.ts`); they are not stored in `daily_points`.

**Logging streak** — consecutive days with an entry. The bonus is the value of the highest milestone reached:

| Days  | 7   | 14  | 30  | 60  | 90  | every +30 after 90 |
| ----- | --- | --- | --- | --- | --- | ------------------ |
| Bonus | 10  | 20  | 40  | 75  | 100 | +50                |

**Goal-crush streak** — consecutive goal-crush days:

| Days  | 3   | 7   | 14  | 30  | every +30 after 30 |
| ----- | --- | --- | --- | --- | ------------------ |
| Bonus | 15  | 50  | 100 | 150 | +100               |

**Weekly goal bonus** (weekly view only) — based on the user's weekly workout-days and workout-minutes goals, counting both strength and cardio sessions: **+50** if every set goal is met, **+20** if some are.

## Leaderboard scores

| View     | Score                                                                                                      |
| -------- | ---------------------------------------------------------------------------------------------------------- |
| Weekly   | $\sum P_{\text{day}}$ + weekly goal bonus + streak bonuses                                                 |
| Monthly  | $\sum P_{\text{day}}$ + streak bonuses                                                                     |
| All-time | $\dfrac{\sum P_{\text{day}} + \text{streak bonuses}}{\max(1,\ \text{days since joining})}$, rounded to 0.1 |

Normalizing all-time by days since joining means someone who joined last week can still top the table.

## Worked example

A 30-year-old (no age adjustment) tracks **both** protein and calories with goals of 120 g protein, 2,200 kcal (stay active) and 8,000 steps. Their day:

| Activity        | Value      | Rule                          | Points |
| --------------- | ---------- | ----------------------------- | ------ |
| Strength        | 50 min     | $\ge 45$                      | **20** |
| Steps           | 6,500      | $6500 / 8000 = 0.81 \ge 0.75$ | 15     |
| Cardio          | —          |                               | 0      |
| Movement        |            | $\min(0 + 15, 20)$            | **15** |
| Sleep           | 7.5 h      | $7 \le h < 8$                 | **12** |
| Water           | 2.6 L      | $\ge 2.5$ (max-10 scale)      | 8      |
| Protein         | 95 g       | $95/120 = 0.79 \ge 0.75$      | 7      |
| Calories        | 2,150 kcal | within 5% of 2,200            | 8      |
| Nutrition       |            | $\min(8 + 7 + 8, 30)$         | **23** |
| **Daily total** |            | $\min(20 + 15 + 12 + 23, 90)$ | **70** |

$70 \ge \lfloor 0.7 \cdot 90 \rfloor = 63$ with all four categories active, so this is a goal-crush day.

The same 50-minute session for someone over 35 also scores 20; a 40-minute session would score 20 for them ($40 \ge T(45) = 38$) but 15 for a 30-year-old.
