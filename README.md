# Office Health Tracker

Daily health tracking for your office team. Log in 30 seconds, earn points for healthy actions, compete on a normalized leaderboard. Every field optional; points for health, not logging.

## Features

- **Dashboard** — Today’s points, streak, weekly rank
- **Log Today** — Optional daily log: workout, cardio, steps, water, nutrition, sleep (today or yesterday only)
- **Leaderboard** — This week, this month, or all-time (normalized score)
- **My Stats** — Private profile, weight history, daily points trend; weekly weigh-in for +10 pts

## Tech stack

- **Next.js 14** (App Router) — Vercel-ready
- **Supabase** — Auth (email/password) + PostgreSQL (profiles, daily_entries, weekly_weigh_ins, streaks)
- **Tailwind CSS** — UI

## Database setup (Supabase)

1. In the [Supabase Dashboard](https://supabase.com/dashboard), open your project → **SQL Editor**.
2. Run the schema file: copy and execute the contents of **`supabase/schema.sql`**.
3. Enable **Email** auth (and optionally confirm email) under **Authentication → Providers**.

This creates:

- **Enums** — gender, fitness_goal, age_bracket, workout_type, cardio_type, alcohol
- **profiles** — linked to `auth.users`; required at signup (display_name, age, gender, height_cm, starting_weight, fitness_goal)
- **daily_entries** — one per user per day; all health fields nullable; `daily_points` computed by app
- **weekly_weigh_ins** — one per user per week
- **streaks** — for consecutive logging days
- **RLS** — users can read/write only their own data; authenticated users can read all profiles (for leaderboard)

## Run locally

**Prerequisites:** Node.js 18+

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env.local` and set:
   - `NEXT_PUBLIC_SUPABASE_URL` — your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — your Supabase anon key
3. Run the app:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3003](http://localhost:3003).

## iOS app (Capacitor)

The same codebase runs as a web app and as an iOS app via [Capacitor](https://capacitorjs.com/). The iOS app is a native shell that loads your **deployed** Next.js app in a WebView (so API routes and auth work with no extra config).

**Prerequisites:** Xcode, Node 18+

1. **Deploy the web app** (e.g. Vercel) so you have a public URL. (Production app: [https://superjoin-health-league.vercel.app](https://superjoin-health-league.vercel.app/).)
2. **Capacitor is already pointed at that URL** in `capacitor.config.ts`. To use a different URL (e.g. local dev), set:
   - Local dev: `CAPACITOR_SERVER_URL=http://localhost:3003` and `CAPACITOR_CLEARTEXT=true`
3. **Add iOS and sync** (first time only):
   ```bash
   npm run cap:init   # adds ios project
   npx cap sync ios   # copies web assets and config
   ```
4. **Open in Xcode and run**:
   ```bash
   npm run ios
   ```
   In Xcode: select a simulator or device, configure signing, and run. The app will load your deployed (or local) URL.

**Scripts**

- `npm run cap:sync` — build Next.js and sync to iOS (`npm run build && npx cap sync ios`)
- `npm run ios` — open the iOS project in Xcode

**Auth and storage**  
Supabase auth and cookies work in the WebView when the app loads from your server URL. No code changes needed. Optional: for a future fully bundled build you could add a small storage abstraction and use Capacitor Preferences on native.

## Deploy on Vercel

1. Push the repo to GitHub and import the project in [Vercel](https://vercel.com).
2. Add environment variables in the Vercel project:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Deploy. The app uses the Next.js framework preset; no extra config needed.

## Product spec

See **`prd.md`** for the full product requirements (points engine, validation, leaderboard logic, optional Slack bot, etc.).
