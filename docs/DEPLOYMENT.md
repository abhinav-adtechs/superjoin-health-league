# Deployment

A production setup needs a Supabase project and a Next.js host (the reference deployment uses Vercel). Everything else — Slack, Fitbit, Gemini, push, iOS — is optional and switches on when its environment variables are present.

## Contents

1. [Supabase](#1-supabase)
2. [Users and PINs](#2-users-and-pins)
3. [Food catalog](#3-food-catalog)
4. [Vercel](#4-vercel)
5. [Scheduled jobs](#5-scheduled-jobs)
6. [Optional integrations](#6-optional-integrations)
7. [iOS app](#7-ios-app)
8. [Verify](#8-verify)

## 1. Supabase

1. Create a project at [supabase.com](https://supabase.com/dashboard) and enable the **Email** provider under _Authentication → Providers_.
2. In the **SQL Editor**, run [`supabase/schema.sql`](../supabase/schema.sql). It creates the enums, `profiles`, `daily_entries`, `weekly_weigh_ins`, `streaks`, RLS policies, indexes and triggers. [`supabase/verify_schema.sql`](../supabase/verify_schema.sql) checks the result.
3. Run each file in [`supabase/migrations/`](../supabase/migrations) in filename (date) order. They add PIN login (`profile_auth`), goals, connected accounts, notifications, scoring rules, goal-crush tracking, food and water logging, and hot-path indexes.

> [!WARNING]
> `20260331_dummy_goals_in_db.sql` fills empty goal columns with deterministic demo values. It is meant for demo and development data — skip it on a production database.

> [!NOTE]
> The SQL files are written for the Supabase SQL editor; the repo does not ship a Supabase CLI config yet. `npm run run-pin-migration` and `node scripts/run-food-migration.js` apply individual migrations over a direct Postgres connection (`HEALTH_LEAGUE_POSTGRES_URL_NON_POOLING`).

Copy the project URL, anon key and service-role key from _Settings → API_.

## 2. Users and PINs

The scripts read credentials from the environment or from `.env.local` / `scripts/.env.local` (see [`scripts/config.js`](../scripts/config.js)).

```bash
# Admin: email/password account + profile. The admin email is set in scripts/create-admin.js.
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ADMIN_PASSWORD=... npm run create-admin

# Members: edit the roster array in scripts/create-users.js first, then:
npm run create-users        # creates auth users + profiles and prints each user's 6-digit PIN
```

PINs are stored as bcrypt hashes and must be changed after 60 days. More detail, including a SQL-only path, is in [`scripts/README-admin-setup.md`](../scripts/README-admin-setup.md).

For a demo league, `npm run seed-dummy-data` creates entries for the last `SEED_DAYS` days (default 90) and `npm run cleanup-dummy-data` removes them.

## 3. Food catalog

The food logger searches the `food_catalog` table. Load the bundled 493-item catalog with:

```bash
node scripts/import-food-catalog.js food-catalog.csv
```

The importer upserts by `slug`, so it is safe to re-run after editing the CSV. [`data/food-catalog-template.csv`](../data/food-catalog-template.csv) shows the column format with a few sample rows (and is the default when no path is given).

## 4. Vercel

1. Import the repository in Vercel. `vercel.json` pins the Next.js framework preset and `npm run build`; `.npmrc` sets `legacy-peer-deps=true` so the HealthKit plugin's Capacitor 4 peer range does not block the install.
2. Add environment variables — at minimum `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`, plus `NEXT_PUBLIC_APP_URL` set to the production URL. The full list is in the [README](../README.md#-configuration).
3. Deploy. Vercel Web Analytics is already wired into `app/layout.tsx`; enable it in the Vercel dashboard if you want it.

> [!TIP]
> If your Supabase integration injects prefixed variables, the app also reads `NEXT_PUBLIC_HEALTH_LEAGUE_SUPABASE_URL`, `NEXT_PUBLIC_HEALTH_LEAGUE_SUPABASE_ANON_KEY` and `HEALTH_LEAGUE_SUPABASE_SERVICE_ROLE_KEY`.

## 5. Scheduled jobs

| Endpoint                    | How to schedule                                                                                                                                          |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/cron/health-digest`   | Already in `vercel.json` (`30 6 * * *`, i.e. 12:00 IST). Needs `SLACK_WEBHOOK_URL`.                                                                      |
| `/api/cron/daily-reminders` | Not in `vercel.json`. Call it every 5 minutes from any scheduler; it sends reminders to users whose reminder time falls in the current ±2-minute window. |

Set `CRON_SECRET` (for example `openssl rand -hex 32`). When it is set, both endpoints require `Authorization: Bearer <CRON_SECRET>`; Vercel Cron sends that header automatically when the variable exists in the project.

## 6. Optional integrations

**Slack**

1. Create a Slack app. Add an **Incoming Webhook** for the channel that should receive entry posts and the daily digest → `SLACK_WEBHOOK_URL`.
2. For reminder DMs, add a bot token with `chat:write`, `users:read`, `users:read.email` and `im:write` → `SLACK_BOT_TOKEN`.
3. Members opt in from _Settings → Notifications_; their Slack user is looked up by email.

**Fitbit**

1. Register an app at [dev.fitbit.com](https://dev.fitbit.com/apps) with OAuth 2.0.
2. Set its redirect URL to `https://<your-app>/api/integrations/fitbit/callback` and use the same value for `FITBIT_REDIRECT_URI`.
3. Set `FITBIT_CLIENT_ID` and `FITBIT_CLIENT_SECRET`. Members connect from _Settings → Connected Apps_.

**Gemini food parsing** — set `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`; the default is `gemini-2.5-flash-lite`, with built-in fallbacks). Without it, catalog search still works; only "Generate using AI" returns an error.

**Push notifications** — set `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` from a Firebase service account. The server side and the `/api/notifications/push/subscribe` endpoint are in place, but the iOS project does not include a native push plugin yet, so devices will not register tokens until one is added.

## 7. iOS app

The iOS app is a Capacitor 7 shell that loads your deployed URL, plus the HealthKit plugin. Full instructions — CocoaPods, signing, HealthKit capability — are in [`ios/README.md`](../ios/README.md). In short:

```bash
# point the WebView at your deployment (or http://localhost:3003 with CAPACITOR_CLEARTEXT=true)
export NEXT_PUBLIC_APP_URL=https://your-app.example.com
npm run cap:sync     # next build + npx cap sync ios
npm run ios          # open in Xcode, pick a device, run
```

HealthKit only works on a physical device with an Apple Developer account; the entitlements are in `ios/App/App/App.entitlements`.

## 8. Verify

- `GET /api/health` returns `ok: true` once Supabase variables are set and reachable.
- Sign in with a member PIN, log a workout and check that the dashboard and `/api/leaderboard?view=weekly` show the points.
- Trigger the digest locally with `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3003/api/cron/health-digest`; in development you can add `?date=YYYY-MM-DD` to replay a specific day.
