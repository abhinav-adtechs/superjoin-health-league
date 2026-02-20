# Office Health Tracker — Product Requirements Document

> **Version:** 3.0
> **Last Updated:** 2026-02-19
> **Status:** Ready for Development
> **Team Size:** 5–15 users
> **Primary Interface:** Slack Bot
> **Stack Recommendation:** Next.js + PostgreSQL + Slack Bolt SDK

---

## 1. Product Overview

A daily health tracking system for a small office team. Users log health metrics through a Slack bot, earn points for healthy actions, and compete on a normalized leaderboard. The system rewards real health behaviors — not form-filling — and makes the leaderboard transparent so people learn what actually works.

### Core Principles

1. **Points for actions, not logging.** Zero points for the act of submitting an entry.
2. **Every field is optional.** Users can skip any field on any day. No forced completions.
3. **30-second daily commitment.** The Slack bot's conversational flow keeps entries fast.
4. **Transparency over mystery.** The leaderboard shows *what* winners do, not just *that* they won.
5. **Privacy by default.** Weight, BMI, and personal trends are never shown publicly.

---

## 2. Data Models

### 2.1 User Profile

Created once during onboarding. All fields required at setup.

```
User {
  id              UUID        PRIMARY KEY
  slack_user_id   String      UNIQUE, NOT NULL
  display_name    String      NOT NULL
  age             Integer     NOT NULL
  gender          Enum        [male, female, other]
  height_cm       Float       NOT NULL
  starting_weight Float       NOT NULL (kg)
  current_weight  Float       NULLABLE (updated via weekly log)
  bmi             Float       COMPUTED (current_weight / (height_cm/100)^2)
  fitness_goal    Enum        [lose_weight, gain_muscle, stay_active, general_wellness]
  age_bracket     Enum        COMPUTED [under_25, 25_to_35, over_35]
  timezone        String      DEFAULT 'Asia/Kolkata'
  reminder_time   String      DEFAULT '20:00'
  joined_at       Timestamp   NOT NULL
  is_active       Boolean     DEFAULT true
}
```

**Age Brackets** (used for threshold adjustments):

| Bracket | Step Thresholds | Cardio Thresholds | Other |
|---|---|---|---|
| Under 25 | Standard | Standard | Standard |
| 25–35 | Standard | Standard | Standard |
| Over 35 | 85% of standard | 85% of standard | Standard |

*Example: 10,000 step target → 8,500 for over_35 bracket.*

### 2.2 Daily Entry

One record per user per day. **Every field is nullable** — users can log as much or as little as they want.

```
DailyEntry {
  id                  UUID        PRIMARY KEY
  user_id             UUID        FK → User
  date                Date        NOT NULL
  created_at          Timestamp   NOT NULL
  updated_at          Timestamp   NOT NULL

  // Exercise
  workout_done        Boolean     NULLABLE
  workout_duration    Integer     NULLABLE (minutes)
  workout_type        Enum        NULLABLE [push, pull, legs, full_body, bodyweight, other]
  cardio_done         Boolean     NULLABLE
  cardio_duration     Integer     NULLABLE (minutes)
  cardio_type         Enum        NULLABLE [running, cycling, swimming, sports, walking, dance, other]
  steps               Integer     NULLABLE

  // Nutrition
  water_liters        Float       NULLABLE
  home_cooked_meals   Integer     NULLABLE (0–3)
  protein_meal        Boolean     NULLABLE
  protein_qty         Integer     NULLABLE (grams, approximate)
  junk_food           Boolean     NULLABLE
  alcohol             Enum        NULLABLE [zero, one_to_two, three_plus]

  // Sleep
  sleep_hours         Float       NULLABLE
  sleep_quality       Integer     NULLABLE (1–5)

  // Computed
  daily_points        Integer     COMPUTED
}

UNIQUE CONSTRAINT (user_id, date)
```

**Validation Rules:**
- `date` must be today or yesterday (no backfilling beyond 1 day)
- `workout_duration` must be > 0 if provided
- `cardio_duration` must be > 0 if provided
- `steps` must be ≥ 0
- `water_liters` must be ≥ 0 and ≤ 10
- `home_cooked_meals` must be 0–3
- `protein_qty` must be ≥ 0 and ≤ 500 (grams, sanity cap)
- `sleep_hours` must be ≥ 0 and ≤ 24
- `sleep_quality` must be 1–5
- If `workout_done` is false, `workout_duration` and `workout_type` must be null
- If `cardio_done` is false, `cardio_duration` and `cardio_type` must be null

### 2.3 Weekly Weigh-In

Separate table for weight tracking. One entry per user per week.

```
WeeklyWeighIn {
  id          UUID        PRIMARY KEY
  user_id     UUID        FK → User
  week_start  Date        NOT NULL (Monday of that week)
  weight_kg   Float       NOT NULL
  bmi         Float       COMPUTED
  created_at  Timestamp   NOT NULL
}

UNIQUE CONSTRAINT (user_id, week_start)
```

### 2.4 Streaks

```
Streak {
  id              UUID        PRIMARY KEY
  user_id         UUID        FK → User
  start_date      Date        NOT NULL
  end_date        Date        NULLABLE (null = still active)
  length_days     Integer     COMPUTED
  is_active       Boolean     COMPUTED (end_date IS NULL)
  bonus_awarded   Integer     DEFAULT 0 (cumulative bonus points from this streak)
}
```

A streak is **active** if the user logged at least one field yesterday or today. A streak **breaks** when a full calendar day passes with no entry.

---

## 3. Points Engine

### 3.1 Scoring Rules

Points are awarded **only for healthy actions**. Skipped/null fields score 0 — no penalty for not logging a field, no reward for logging it empty.

#### Workout Points

| Condition | Points |
|---|---|
| `workout_done` = true | +10 |
| `workout_duration` ≥ 45 | +5 |
| `workout_duration` ≥ 60 | +5 (cumulative with above, so +10 total bonus) |

*Max workout points per day: 20*

#### Cardio Points

| Condition | Points |
|---|---|
| `cardio_done` = true | +10 |
| `cardio_duration` ≥ 30 (or ≥ 25 for over_35) | +5 |

*Max cardio points per day: 15*

#### Sleep Points

| Condition | Points |
|---|---|
| `sleep_hours` between 7.0 and 9.0 | +10 |
| `sleep_hours` between 6.0 and 6.9 | +5 |
| `sleep_quality` ≥ 4 | +5 |

*Max sleep points per day: 15*

#### Nutrition Points

| Condition | Points |
|---|---|
| `water_liters` ≥ 3.0 | +10 |
| `water_liters` ≥ 2.0 and < 3.0 | +5 |
| `home_cooked_meals` ≥ 2 | +5 |
| `protein_meal` = true | +5 |
| `protein_qty` ≥ 100g (if provided) | +3 bonus |
| `junk_food` = false | +5 |
| `alcohol` = zero | +5 |

*Max nutrition points per day: 33*

#### Step Points

| Condition | Points | Over 35 Bracket |
|---|---|---|
| `steps` ≥ 10,000 | +15 | ≥ 8,500 |
| `steps` ≥ 7,500 | +10 | ≥ 6,375 |
| `steps` ≥ 5,000 | +5 | ≥ 4,250 |

*Max step points per day: 15*

#### Weekly Weigh-In

| Condition | Points |
|---|---|
| Logged weight this week | +10 |

### 3.2 Daily Point Range

| Day Type | Approx. Points |
|---|---|
| Nothing logged | 0 |
| Minimal (slept well, drank water) | 15–25 |
| Decent (good sleep + nutrition + some walking) | 35–50 |
| Strong (workout + cardio + nutrition + sleep + steps) | 80–98 |
| **Maximum possible** | **~98** (daily) + 10 (weekly weigh-in) |

### 3.3 Streak Bonuses

Awarded when the streak milestone is reached. Points are added to the day the milestone is hit.

| Milestone | Bonus Points |
|---|---|
| 7 consecutive days | +25 |
| 14 consecutive days | +50 |
| 21 consecutive days | +75 |
| 30 consecutive days | +150 |
| Every subsequent 30 days | +150 |

**Streak definition:** At least one non-null field logged on a calendar day. Skipping an entire day breaks the streak.

### 3.4 Penalties

Intentionally light. The goal is a gentle nudge, not punishment.

| Condition | Points |
|---|---|
| Full day missed (zero entries) | **-2** |
| Breaking an active streak ≥ 14 days | **-5** |

Penalties apply once per missed day. They don't compound (missing 3 days = -6, not -6 plus streak penalty three times).

### 3.5 Points Calculation (Pseudocode)

```python
def calculate_daily_points(entry: DailyEntry, user: User) -> int:
    points = 0
    bracket = user.age_bracket
    adj = 0.85 if bracket == "over_35" else 1.0

    # Workout
    if entry.workout_done:
        points += 10
        if entry.workout_duration and entry.workout_duration >= 45:
            points += 5
        if entry.workout_duration and entry.workout_duration >= 60:
            points += 5

    # Cardio
    if entry.cardio_done:
        points += 10
        threshold = 30 * adj
        if entry.cardio_duration and entry.cardio_duration >= threshold:
            points += 5

    # Sleep
    if entry.sleep_hours is not None:
        if 7.0 <= entry.sleep_hours <= 9.0:
            points += 10
        elif 6.0 <= entry.sleep_hours < 7.0:
            points += 5
    if entry.sleep_quality is not None and entry.sleep_quality >= 4:
        points += 5

    # Nutrition
    if entry.water_liters is not None:
        if entry.water_liters >= 3.0:
            points += 10
        elif entry.water_liters >= 2.0:
            points += 5
    if entry.home_cooked_meals is not None and entry.home_cooked_meals >= 2:
        points += 5
    if entry.protein_meal:
        points += 5
        if entry.protein_qty is not None and entry.protein_qty >= 100:
            points += 3
    if entry.junk_food is False:  # explicitly logged No
        points += 5
    if entry.alcohol == "zero":
        points += 5

    # Steps
    if entry.steps is not None:
        step_thresholds = [
            (10000 * adj, 15),
            (7500 * adj, 10),
            (5000 * adj, 5),
        ]
        for threshold, pts in step_thresholds:
            if entry.steps >= threshold:
                points += pts
                break

    return points
```

---

## 4. Ranking System

### 4.1 Normalized Score

```
normalized_score = total_points / days_since_joining
```

Where `days_since_joining` = number of calendar days since `user.joined_at` (minimum 1).

This is the **primary ranking metric** for the all-time leaderboard. It ensures newcomers can compete immediately.

### 4.2 Leaderboard Views

| View | Metric | Reset |
|---|---|---|
| **This Week** | Sum of points Mon–Sun | Every Monday |
| **This Month** | Sum of points in calendar month | 1st of each month |
| **All-Time** | `normalized_score` (points per day) | Never |

### 4.3 Leaderboard Response Schema

```json
{
  "view": "weekly",
  "period": "2026-02-17 to 2026-02-23",
  "rankings": [
    {
      "rank": 1,
      "user": {
        "display_name": "Priya",
        "streak_days": 22,
        "days_active": 45
      },
      "score": {
        "total_points": 412,
        "normalized_score": 68.7,
        "breakdown": {
          "exercise": 140,
          "nutrition": 145,
          "sleep": 82,
          "steps": 45
        },
        "breakdown_pct": {
          "exercise": "34%",
          "nutrition": "35%",
          "sleep": "20%",
          "steps": "11%"
        }
      },
      "insights": {
        "strongest_category": "nutrition",
        "improvement_vs_last_week": "+12%",
        "improvement_detail": "Water intake up from 2.1L to 3.2L avg"
      }
    }
  ],
  "category_leaders": {
    "exercise": { "display_name": "Ravi", "points": 155 },
    "sleep": { "display_name": "Arjun", "points": 95 },
    "nutrition": { "display_name": "Priya", "points": 145 },
    "steps": { "display_name": "Sneha", "points": 90 },
    "streak": { "display_name": "Vinayak", "days": 30 }
  },
  "team_stats": {
    "avg_sleep_hours": 7.2,
    "avg_water_liters": 2.8,
    "pct_workout_days": 62,
    "avg_steps": 7840
  }
}
```

### 4.4 Weekly "What's Working" Digest

Auto-generated every Monday at 9 AM. Posted to `#health-tracker` channel.

**Generation logic:**

1. **#1 this week** — Highest weekly points. Include: workout frequency, water avg, junk-free days, sleep avg. Highlight their strongest edge vs. team average.
2. **Biggest mover** — Largest rank improvement week-over-week. Include: what changed in their metrics.
3. **Team trend** — One stat that improved most across the whole team.
4. **Category champions** — One-liner per category leader.

---

## 5. Slack Bot Specification

### 5.1 Tech Stack

- **Slack Bolt SDK** (Node.js or Python)
- **Slash commands** + **Block Kit interactive messages** for buttons/dropdowns
- **Slack Events API** for DM conversations

### 5.2 Slash Commands

| Command | Description | Response Type |
|---|---|---|
| `/ht-log` | Start daily logging flow | Ephemeral → interactive DM |
| `/ht-score` | Your points: today, this week, this month | Ephemeral |
| `/ht-leaderboard` | Current rankings (default: this week) | Ephemeral |
| `/ht-leaderboard month` | Monthly rankings | Ephemeral |
| `/ht-leaderboard alltime` | All-time normalized rankings | Ephemeral |
| `/ht-streak` | Your streak info and history | Ephemeral |
| `/ht-me` | Personal dashboard: trends, averages, BMI | Ephemeral |
| `/ht-whats-working` | Latest weekly digest | Ephemeral |
| `/ht-setup` | Onboarding: create profile | Interactive DM |

*Prefix `ht-` to avoid conflicts with other workspace bots.*

### 5.3 Conversational Logging Flow

The `/ht-log` command triggers an **interactive Block Kit message** in the user's DM. The flow uses Slack's `actions` and `views` to walk through screens.

#### Screen 1: Movement

```
┌─────────────────────────────────────────┐
│  How did you move today?                │
│                                         │
│  🏋️ Workout?    [Yes] [No] [Skip]      │
│  🏃 Cardio?     [Yes] [No] [Skip]      │
│  👟 Steps:      [____] or [Skip]        │
└─────────────────────────────────────────┘
```

If Workout = Yes → expand:
```
│  Type: [Push ▾]  Duration: [__] min     │
```

If Cardio = Yes → expand:
```
│  Type: [Running ▾]  Duration: [__] min  │
```

**[Skip] on any field → stores null. No penalty, no points.**

#### Screen 2: Fuel & Recovery

```
┌─────────────────────────────────────────┐
│  How did you fuel and recover?          │
│                                         │
│  💧 Water:          [__] L  or [Skip]   │
│  🍳 Home-cooked:    [0] [1] [2] [3]    │
│  🥩 Protein meal?   [Yes] [No] [Skip]  │
│     └ Approx grams: [__] or [Skip]     │
│  🍔 Junk food?      [Yes] [No] [Skip]  │
│  🍺 Alcohol:        [0] [1-2] [3+]     │
│                                         │
│  😴 Sleep hours:    [__] or [Skip]      │
│  😴 Sleep quality:  [1] [2] [3] [4] [5]│
└─────────────────────────────────────────┘
```

If Protein meal = Yes → show optional grams field.
If Protein meal = No or Skip → hide grams field.

#### Screen 3: Confirmation

```
┌─────────────────────────────────────────┐
│  ✅ All logged!                         │
│                                         │
│  Today's score:     68 points           │
│  Streak:            13 days 🔥          │
│  Rank:              #3 (↑1)            │
│                                         │
│  Strongest: Exercise + Nutrition        │
│  Tip: Hit 3L water to crack #2 👀      │
│                                         │
│  [View Full Leaderboard]                │
└─────────────────────────────────────────┘
```

### 5.4 Daily Reminders

**Cron job:** Runs every minute, checks users whose `reminder_time` matches current time in their timezone.

**First reminder** (at configured time, default 8 PM):
> Hey {name} — time for your daily check-in! Tap the button to log.
> [Log Now]
> Your streak: {n} days 🔥

**Nudge** (2 hours after first, if no entry for today):
> Quick reminder — don't break your {n}-day streak! Tap below to log in 30 seconds.
> [Log Now]

**No third reminder.** Two is enough. Respect people's evenings.

### 5.5 Public Channel Notifications

Channel: `#health-tracker`

| Event | When | Message |
|---|---|---|
| Weekly digest | Monday 9 AM | Full "What's Working" digest + leaderboard |
| Streak milestone | Real-time | "🔥 {name} just hit a {n}-day streak!" |
| New personal best | Real-time | "{name} just set a personal best daily score: {n} points" |
| Team stat of the week | Monday 9 AM | "Team averaged {n}L water this week — up from {prev}L" |

**Never posted:** Weights, BMI, individual nutrition details, or any potentially embarrassing data.

---

## 6. API Endpoints

For the web dashboard (optional, secondary to Slack).

### 6.1 Auth

```
POST   /api/auth/slack          # OAuth with Slack, returns JWT
```

### 6.2 Users

```
GET    /api/users/me             # Current user profile + stats
PUT    /api/users/me             # Update profile fields
GET    /api/users/me/trends      # Personal trend data (7d, 30d, 90d)
```

### 6.3 Entries

```
POST   /api/entries              # Create/update today's or yesterday's entry
GET    /api/entries?date=YYYY-MM-DD  # Get entry for a specific date
GET    /api/entries/history?from=&to= # Range query
```

### 6.4 Leaderboard

```
GET    /api/leaderboard?view=weekly|monthly|alltime
GET    /api/leaderboard/digest   # Latest "What's Working" digest
GET    /api/leaderboard/categories  # Category champions
```

### 6.5 Streaks

```
GET    /api/streaks/me           # Current + historical streaks
```

### 6.6 Weight

```
POST   /api/weight               # Log this week's weight
GET    /api/weight/history        # Weight + BMI over time
```

---

## 7. Anti-Gaming Measures

| Rule | Implementation |
|---|---|
| Daily point cap (~98) | Hard cap in `calculate_daily_points` |
| Reasonable ceilings | Workout beyond 60 min = same points as 60 min |
| No backfilling | `date` field only accepts today or yesterday. Reject older dates at API level. |
| Normalized ranking | Points per day prevents early-adopter dominance |
| Honest zeros | `workout_done = false` scores 0. No points for negative answers except `junk_food = false` and `alcohol = zero` which reward restraint. |
| Optional buddy system | Phase 2: pair users, each can view the other's logs. Social accountability. |

---

## 8. What NOT to Track

| Metric | Reason |
|---|---|
| Exact calories | Tedious, inaccurate without equipment, can trigger unhealthy patterns |
| Macros | Same as calories, worse |
| Heart rate / HRV | Requires wearables — add when mobile integrations land |
| Mental health scores | Too personal for a team leaderboard |
| Body fat % | Requires equipment, self-estimates are meaningless |
| Medical conditions | Privacy violation |
| Supplements | Too granular, no clear health signal |
| Meditation | Unverifiable, easy to game |
| Meal photos / food items | Too much effort, invites judgment |

---

## 9. Future Integrations (Post-MVP)

| Integration | What It Automates | Priority |
|---|---|---|
| Apple Health / Google Fit | Steps, sleep auto-import | P1 |
| Strava / Nike Run Club | Cardio auto-import | P2 |
| Fitbit / Garmin / Whoop | Sleep quality, HRV, heart rate | P2 |
| Web Dashboard | Visual trends, richer leaderboard views | P2 |
| MyFitnessPal | Detailed nutrition | P3 |
| WhatsApp bot | Alternative to Slack | P3 |

---

## 10. Summary

| Category | Fields | Required? | Points Range |
|---|---|---|---|
| Workout | done, duration, type | All optional | 0–20 |
| Cardio | done, duration, type | All optional | 0–15 |
| Steps | count | Optional | 0–15 |
| Water | liters | Optional | 0–10 |
| Nutrition | home-cooked, protein (+ grams), junk, alcohol | All optional | 0–23 |
| Sleep | hours, quality | All optional | 0–15 |
| Weight | kg (weekly) | Optional | 0–10 |

**Max daily: ~98 pts. Streak bonuses: +25 to +150. Penalties: -2 (missed day), -5 (broken 14+ day streak).**

**Every field optional. Slack-first. 30 seconds daily. Points for health, not logging.**
