# Points System v2 — Implementation Algorithm

This document is the complete specification for updating the health competition points system. Use it to make all necessary changes to the existing platform.

---

## Summary of Changes from Current System

The current system (v1) has an 81-pt daily cap across Workout (20), Movement (25), Sleep (10), and Nutrition (26). The key problems being fixed:

1. **Exercise dominates at 55.6% of daily points** → reduce to 50%
2. **Step tiers stack additively** (10K steps = 10+7+5 = 22 pts) → make mutually exclusive (highest tier only)
3. **Sleep is underweighted** at 10 pts (12.3%) → increase to 16 pts (20%)
4. **Workout and Movement can double-dip** from a single session → enforce strict separation
5. **Water is overweighted** at 10 pts for an easy habit → reduce to 8 pts
6. **Calorie tracking is OFF** → turn ON by default
7. **Goal crush recurring bonus is too aggressive** at 200 pts/30 days → reduce to 100 pts
8. **Workout duration has no age adjustment** → apply 85% threshold for 35+
9. **Goal crush has no multi-category requirement** → require 3 of 4 categories

---

## New Daily Cap: 80 pts

```
OLD: daily_cap = 81
NEW: daily_cap = 80
```

---

## Category 1: Workout (max 20 pts) — UPDATED

No structural changes. Add age-adjusted thresholds for workout duration.

```
UNCHANGED:
  - workout_done = true           → 10 pts
  - workout_duration >= 45 min    → +5 pts
  - workout_duration >= 60 min    → +5 pts
  - Category cap: 20 pts

NEW — Age-adjusted thresholds for 35+:
  - 45 min threshold → 38 min (85%)
  - 60 min threshold → 51 min (85%)
```

### Pseudocode

```
function scoreWorkout(log, age_bracket):
    if log.workout_done != true:
        return 0

    mult = getAgeMultiplier(age_bracket)
    pts = 10

    if log.workout_duration >= (60 * mult):
        pts += 10       // both 45+ and 60+ bonuses
    elif log.workout_duration >= (45 * mult):
        pts += 5        // only 45+ bonus

    return min(pts, 20)
```

---

## Category 2: Movement (max 20 pts) — UPDATED

Two changes: (a) reduce category cap from 25 → 20, (b) step tiers become mutually exclusive.

```
CHANGED:
  - Category cap: 25 → 20
  - Step tiers: additive → mutually exclusive (highest only)

UNCHANGED:
  - cardio_done = true            → 8 pts
  - cardio_duration >= 30 min     → +4 pts
  - steps >= 10,000               → 8 pts   (was +10)
  - steps >= 7,500                → 6 pts   (was +7)
  - steps >= 5,000                → 4 pts   (was +5)

Age thresholds for 35+ (UNCHANGED):
  - 30 min cardio → 25.5 min
  - 10,000 steps  → 8,500
  - 7,500 steps   → 6,375
  - 5,000 steps   → 4,250
```

### Pseudocode

```
function scoreMovement(log, age_bracket):
    mult = getAgeMultiplier(age_bracket)
    pts = 0

    // Cardio sub-score
    if log.cardio_done == true:
        pts += 8
        if log.cardio_duration >= (30 * mult):
            pts += 4

    // Step sub-score — MUTUALLY EXCLUSIVE, pick highest tier
    step_pts = 0
    if log.steps >= (10000 * mult):
        step_pts = 8
    elif log.steps >= (7500 * mult):
        step_pts = 6
    elif log.steps >= (5000 * mult):
        step_pts = 4

    pts += step_pts

    return min(pts, 20)
```

### Migration Note

The old code likely sums all step tiers. Find the step scoring logic and replace additive logic with an if/elif chain that assigns only the highest matching tier.

---

## Category 3: Sleep (max 16 pts) — UPDATED

Increase max from 10 → 16. Add a third tier.

```
CHANGED:
  - Optimal (7-9 hrs): 10 → 16 pts
  - Good (6-7 hrs):     5 → 8 pts

NEW:
  - Adequate (5-6 hrs): 3 pts  (new tier, did not exist in v1)

Category cap: 10 → 16
```

### Pseudocode

```
function scoreSleep(log):
    h = log.sleep_hours

    if h >= 7 and h <= 9:
        return 16
    elif h >= 6 and h < 7:
        return 8
    elif h >= 5 and h < 6:
        return 3
    else:
        return 0
```

---

## Category 4: Nutrition (max 24 pts) — UPDATED

Reduce water and protein point values. Enable calorie tracking by default.

```
CHANGED — Hydration:
  - 3+ litres:   10 → 8 pts
  - 2-3 litres:   5 → 4 pts

CHANGED — Protein:
  - Goal hit:      8 → 6 pts
  - Partial:       4 → 3 pts

CHANGED — Calorie Alignment:
  - Status: OFF → ON (enabled by default)
  - Full alignment:    8 → 6 pts
  - Partial alignment: 4 → 3 pts

Category cap: 26 → 24
```

### Calorie Alignment Logic

```
function checkCalorieAlignment(log, profile):
    if profile.calorie_goal == null or profile.fitness_goal_direction == null:
        return "none"

    goal = profile.calorie_goal
    actual = log.calories_logged
    direction = profile.fitness_goal_direction
    margin = goal * 0.125     // 12.5% for partial

    if direction == "cutting":
        if actual <= goal:                return "full"
        elif actual <= goal + margin:     return "partial"

    elif direction == "bulking":
        if actual >= goal:                return "full"
        elif actual >= goal - margin:     return "partial"

    elif direction == "maintenance":
        if abs(actual - goal) <= goal * 0.05:     return "full"
        elif abs(actual - goal) <= margin:         return "partial"

    return "none"
```

### Full Nutrition Pseudocode

```
function scoreNutrition(log, profile):
    pts = 0

    // Hydration
    if log.water_liters >= 3:
        pts += 8
    elif log.water_liters >= 2:
        pts += 4

    // Protein
    if profile.goal_protein_g_day != null:
        if log.protein_qty >= profile.goal_protein_g_day:
            pts += 6
        elif log.protein_qty > 0:
            pts += 3

    // Calorie alignment
    alignment = checkCalorieAlignment(log, profile)
    if alignment == "full":
        pts += 6
    elif alignment == "partial":
        pts += 3

    return min(pts, 24)
```

---

## Age Multiplier Function

Currently the platform only supports two tiers (under 35 and 35+). Keep this as-is unless expanding.

```
function getAgeMultiplier(age_bracket):
    switch age_bracket:
        "under_35": return 1.00
        "35_44":    return 0.85
        "45_54":    return 0.75
        "55_64":    return 0.65
        "65_plus":  return 0.55
        default:    return 1.00

// If keeping the simple 2-tier system:
function getAgeMultiplier(age_bracket):
    if age_bracket == "35_plus":
        return 0.85
    else:
        return 1.00
```

**What it applies to:** Step thresholds, cardio duration thresholds, workout duration thresholds.

**What it does NOT apply to:** Sleep hours, water litres, protein grams, calorie goals, streaks.

---

## Daily Score Calculation — Master Function

```
function calculateDailyScore(log, profile):

    mult = getAgeMultiplier(profile.age_bracket)

    workout_pts   = scoreWorkout(log, profile.age_bracket)
    movement_pts  = scoreMovement(log, profile.age_bracket)
    sleep_pts     = scoreSleep(log)
    nutrition_pts = scoreNutrition(log, profile)

    // Apply category caps (redundant if functions already cap, but safe)
    workout_pts   = min(workout_pts, 20)
    movement_pts  = min(movement_pts, 20)
    sleep_pts     = min(sleep_pts, 16)
    nutrition_pts = min(nutrition_pts, 24)

    // Sum and apply daily cap
    daily_total = workout_pts + movement_pts + sleep_pts + nutrition_pts
    daily_capped = min(daily_total, 80)

    // Streak bonuses stack on top (uncapped)
    streak_bonus = calculateStreakBonuses(log, profile)

    return daily_capped + streak_bonus
```

---

## Streak & Milestone Bonuses — UPDATED

### Log Streak — NO CHANGES

```
7 consecutive log days   → +10 pts
14 consecutive log days  → +20 pts
30 consecutive log days  → +40 pts
60 consecutive log days  → +75 pts
90 consecutive log days  → +100 pts
Every 30 days after 90   → +50 pts
```

### Weekly Goals — NO CHANGES

```
Some weekly goals met (partial)  → +20 pts
All weekly goals met (full)      → +50 pts
```

### Goal Crush — UPDATED

```
CHANGED:
  - 30-day streak:             200 → 150 pts
  - Recurring (every 30 after 30): 200 → 100 pts

UNCHANGED:
  - 3-day streak   → +15 pts
  - 7-day streak   → +50 pts
  - 14-day streak  → +100 pts

NEW — Goal Crush Definition:
  A day is "crushed" when BOTH conditions are met:
    1. daily_capped_score >= 56  (70% of 80)
    2. categories_with_points >= 3  (out of 4 total categories)
```

### Goal Crush Evaluation Pseudocode

```
function evaluateGoalCrush(workout_pts, movement_pts, sleep_pts, nutrition_pts, daily_capped):

    categories_hit = 0
    if workout_pts > 0:   categories_hit += 1
    if movement_pts > 0:  categories_hit += 1
    if sleep_pts > 0:     categories_hit += 1
    if nutrition_pts > 0: categories_hit += 1

    return daily_capped >= 56 and categories_hit >= 3
```

### Streak State Machine

```
// Log Streak
on_day_end(user):
    if user logged ANY data today:
        user.consecutive_log_days += 1
        checkLogMilestones(user)
    else:
        user.consecutive_log_days = 0

// Goal Crush Streak
on_day_end(user):
    if evaluateGoalCrush(user.today_scores, user.today_daily_capped):
        user.consecutive_goal_crush_days += 1
        checkCrushMilestones(user)
    else:
        user.consecutive_goal_crush_days = 0
```

Milestone bonuses fire ONCE at each threshold. Reaching day 14 awards only the 14-day bonus (100 pts), not the sum of all prior milestones. But across the full streak, a user who reaches day 14 will have received 15 (day 3) + 50 (day 7) + 100 (day 14) = 165 total from three separate triggers.

---

## Anti-Gaming: Workout vs Movement Separation

This is a new enforcement rule. A single exercise session must be logged as EITHER Workout OR Movement (cardio), never both.

### Classification Guide

```
Movement (cardio): running, cycling, swimming, walking, dancing, hiking
Workout:           weight training, calisthenics, yoga, pilates, sports (basketball, tennis, etc.)
Mixed (e.g., CrossFit): participant chooses ONE at log time
```

### Two Sessions in One Day

Allowed. A morning run (→ Movement) and evening gym (→ Workout) are two separate sessions. Both score independently. But a single session cannot be split across both categories.

### Walking + Steps

A 30-min walk CAN be logged as a cardio session, and the steps from that walk also count toward step tiers. This is fine because steps and cardio are both sub-categories within Movement, and the category cap (20) prevents overflow.

---

## Edge Cases to Handle

### Retroactive Logging
Allow within 48 hours. After 48 hours, the day counts as unlogged (streak breaks).

### Sleep Attribution
Sleep is attributed to the day the user wakes up. Bed at 11 PM Tuesday, wake 6 AM Wednesday = 7 hours on Wednesday.

### Late Joiners
Streaks start from join date. Show both "total points" and "points per active day" on leaderboards.

### Calorie Tracking Disabled
If a competition opts out of calorie tracking, set the nutrition category cap to 18 (8 water + 6 protein + 4 partial = 18 max). Adjust the daily cap to 74 accordingly, OR redistribute 6 pts to other nutrition sub-fields.

---

## Migration Checklist

Use this as a task list when implementing:

- [ ] Update daily cap constant: `81 → 80`
- [ ] Update sleep scoring: add 5-6 hr tier (3 pts), change 7-9 hr to 16 pts, change 6-7 hr to 8 pts
- [ ] Update sleep category cap: `10 → 16`
- [ ] Update movement category cap: `25 → 20`
- [ ] Change step scoring from additive to mutually exclusive (if/elif, highest tier only)
- [ ] Update step point values: `10/7/5 → 8/6/4`
- [ ] Update cardio base points: `10 → 8`
- [ ] Update cardio duration bonus: `5 → 4`
- [ ] Update water points: `10/5 → 8/4`
- [ ] Update protein points: `8/4 → 6/3`
- [ ] Enable calorie alignment scoring (was OFF, now ON by default)
- [ ] Set calorie alignment points: `8/4 → 6/3`
- [ ] Update nutrition category cap: `26 → 24`
- [ ] Add age-adjusted thresholds for workout duration (45 min → 38 min, 60 min → 51 min for 35+)
- [ ] Update 30-day goal crush milestone: `200 → 150 pts`
- [ ] Update recurring goal crush bonus: `200 → 100 pts per 30 days`
- [ ] Add goal crush definition: `daily_score >= 56 AND categories_with_points >= 3`
- [ ] Add workout/movement session classification enforcement (single session = one category)
- [ ] Update any UI displaying point values, category caps, or daily cap
- [ ] Update any leaderboard calculations to use new cap
- [ ] Run validation: verify category caps sum to daily cap (20+20+16+24 = 80 ✓)

---

## Verification After Deployment

Run these sanity checks:

```
Test 1 — Category caps sum to daily cap:
  20 + 20 + 16 + 24 = 80 ✓

Test 2 — Cannot goal crush with exercise only:
  max(Workout) + max(Movement) = 40 < 56 ✓

Test 3 — Step tiers are exclusive:
  User with 12,000 steps should get 8 pts, NOT 8+6+4 = 18 ✓

Test 4 — Age multiplier on workout duration:
  38-year-old with 40 min workout → 40 >= (45*0.85=38.25) → gets +5 bonus ✓
  28-year-old with 40 min workout → 40 < 45 → no bonus ✓

Test 5 — Sleep 5.5 hours earns partial:
  5.5 >= 5 and 5.5 < 6 → 3 pts ✓

Test 6 — Calorie alignment works:
  Cutting, goal=2000, actual=1950 → "full" (under budget) → 6 pts ✓
  Cutting, goal=2000, actual=2200 → 2200 > 2000+250(12.5%) → "none" → 0 pts ✓

Test 7 — Goal crush multi-category check:
  Workout=20, Movement=20, Sleep=16, Nutrition=0 → 56 pts, but 3 categories → PASS ✓
  Workout=20, Movement=20, Sleep=0, Nutrition=0 → 40 pts, 2 categories → FAIL ✓
```

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────┐
│              DAILY POINTS (cap: 80)                 │
├──────────────┬──────────┬───────────────────────────┤
│ WORKOUT (20) │ Base     │ workout_done → 10 pts     │
│              │ 45+ min  │ +5 pts (35+: 38 min)      │
│              │ 60+ min  │ +5 pts (35+: 51 min)      │
├──────────────┼──────────┼───────────────────────────┤
│ MOVEMENT(20) │ Cardio   │ cardio_done → 8 pts       │
│              │ 30+ min  │ +4 pts (35+: 25.5 min)    │
│              │ 10K step │ 8 pts (35+: 8,500)        │
│              │ 7.5K     │ 6 pts (35+: 6,375)        │
│              │ 5K       │ 4 pts (35+: 4,250)        │
│              │          │ ↑ HIGHEST TIER ONLY        │
├──────────────┼──────────┼───────────────────────────┤
│ SLEEP (16)   │ 7-9 hrs  │ 16 pts                    │
│              │ 6-7 hrs  │ 8 pts                     │
│              │ 5-6 hrs  │ 3 pts                     │
├──────────────┼──────────┼───────────────────────────┤
│ NUTRITION(24)│ Water 3L │ 8 pts                     │
│              │ Water 2L │ 4 pts                     │
│              │ Protein✓ │ 6 pts (partial: 3)        │
│              │ Calorie✓ │ 6 pts (partial: 3)        │
└──────────────┴──────────┴───────────────────────────┘

┌─────────────────────────────────────────────────────┐
│          STREAKS (on top of daily cap)               │
├──────────────┬──────────────────────────────────────┤
│ LOG STREAK   │ 7d:10  14d:20  30d:40  60d:75       │
│              │ 90d:100  every 30d after: 50         │
├──────────────┼──────────────────────────────────────┤
│ WEEKLY GOALS │ Partial: 20  Full: 50                │
├──────────────┼──────────────────────────────────────┤
│ GOAL CRUSH   │ 3d:15  7d:50  14d:100  30d:150      │
│ (≥56 pts +   │ every 30d after: 100                 │
│  3+ cats)    │                                      │
└──────────────┴──────────────────────────────────────┘
```
