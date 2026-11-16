# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/). Versions before 1.0.0 were tagged retroactively at milestone commits.

## [1.0.0] — 2026-11-16

Scoring v3, food and water logging, and a redesigned dashboard. This release also adds the project documentation.

### Added

- Food logging backed by a 493-item catalog with portion presets, a cart/composer flow and natural-language parsing via Gemini; calories and protein roll up into the daily entry (`ded0b44`).
- Dedicated water log with quick-add buttons and per-log delete (`ded0b44`, `fe45bbf`).
- Week-at-a-glance goal grid on the dashboard's _This week_ card, with goal icons and logged values per day (`93cb1da`, `d323b64`).
- Compact month-league card in the desktop sidebar (`d323b64`).
- Bedtime/wake dual-pin sleep picker with weekday labels, replacing the hours slider (`7f16225`, `1f32d1b`).
- Hot-path database indexes for dashboard, leaderboard and history queries (`4d44c97`).
- README rewrite, `docs/` (architecture, scoring, deployment), MIT license, contributing guide, this changelog and a GitHub Actions build workflow.

### Changed

- **Scoring v3:** effort-based duration gradients for workout and cardio, goal-relative steps, a five-tier sleep curve, mode-aware nutrition, and daily caps of 75 or 90; streak bonuses are applied in leaderboards. Includes a backfill script (`a516d65`).
- Goal wizard, stats hints and leaderboard FAQ copy aligned with v3 (`db22600`).
- Dashboard reordered week-first (`d323b64`).
- Sharper 2–3 px corner radius across the UI (`ded0b44`).
- Mobile shell docks the bottom navigation so only the main pane scrolls; the new-entry menu became a bottom sheet (`4d44c97`).

### Fixed

- Food and water API routes were excluded by a bare `logs` pattern in `.gitignore` and returned 404 in production (`fe45bbf`).
- Food cart feedback, week-grid labels and safer API response parsing (`a034b85`).
- Log tab point badges now match the v3 tiers and show sleep points (`41b3e9d`).

## [0.3.0] — 2026-04-14

Personal goals, a rebuilt app shell, scoring v2 and the daily Slack digest.

### Added

- Goal setup wizard with workout types, step, sleep, water, protein and calorie targets (`6b14c78`, `ba4a41e`, `2d98b66`).
- Fitness-goal theming across dashboard, stats, leaderboard and the Point System panel (`aac1bd5`).
- Leaderboard top ladder and per-row stats (`0137451`).
- Movement log sections that follow the user's workout goal types (`e1f13a2`).
- `points_delta` returned on entry save, with clearer success messages (`85a62ce`).
- Clearing a single activity from a day via `PATCH /api/entries` (`c072ee4`).
- Vercel Web Analytics (#3).
- Loading screen and app-shell layout with theme tokens (`63d548c`, `3767747`).
- Optional `Authorization: Bearer` sessions for cookie-less API clients (`145f599`).
- **Scoring v2:** 80-point daily cap, rebalanced tiers, age-adjusted workout thresholds and calorie windows, with a backfill script; the spec is in `points-system-v2-algorithm.md` (`5a40c7f`).
- Daily Slack health digest via Vercel Cron, scheduled for 12:00 IST (`af3c50f`, `e3b945e`).

### Changed

- Water, protein, calories, steps and home-cooked meals now accumulate across multiple logs in a day (`6df9995`).
- Backdated logging window reduced from 7 to 4 days (`68baaa0`).
- Dashboard log actions streamlined (`dd7fbaf`).

### Fixed

- Mobile layout for the header, league card and leaderboard (`48c7e24`).
- New-entry menu rendered in a portal; NaN-safe goal math on the dashboard (`5615218`).

## [0.2.0] — 2026-03-06

Integrations, notifications and the Point System panel.

### Added

- Fitbit and Apple Health integrations with a Connected Apps screen (`7e85422`).
- Notification preferences, Slack channel posts and DMs, push scaffolding, configurable scoring rules, goal-crush streaks and a Settings tab (`2b3c8e4`).
- Point System panel with rules and FAQ, also reachable from the <kbd>Ctrl</kbd>+<kbd>/</kbd> command palette (`b9bdb74`).
- HealthKit entitlements and iOS project configuration (`87553e3`, `02bca4a`).
- Support for `HEALTH_LEAGUE_`-prefixed Supabase environment variables (`dd833be`).

### Changed

- Workout history calendar redesigned with week, month and 6-month views, plus a weekly rank trajectory (`eb512f3`).
- App URL now comes from environment variables instead of a linked Vercel project (`fe1aefd`).

### Fixed

- Workout entries are logged independently, require a duration, and history uses local dates (`f4e5906`).
- `.npmrc` with `legacy-peer-deps` so Vercel installs succeed alongside the HealthKit plugin (`c5b84e8`).

### Security

- Removed hard-coded passwords and plaintext secrets from scripts and SQL files (`70387eb`).

## [0.1.0] — 2026-02-20

First release of the Next.js app.

### Added

- Next.js 14 App Router app with Supabase Auth and Postgres: daily entries, weekly weigh-ins, streaks and a leaderboard (`d5dc6fe`).
- PIN login with bcrypt-hashed 6-digit PINs, PIN change flow and admin email/password login (`d5dc6fe`).
- Supabase schema, RLS policies and the first migrations; admin and user setup scripts (`d5dc6fe`).
- Capacitor iOS shell that loads the deployed web app (`d5dc6fe`).
- Profile goals, entry UI components (date carousel, workout body grid, meal slots, sliders, steps stepper), demo data scripts and a leaderboard projection endpoint (`af40ca2`).

### Notes

- The repository was created from [fifa-league-tracker](https://github.com/abhinav-adtechs/fifa-league-tracker) and shares its first nine commits (5–9 Feb 2026). It was rebranded on 19 Feb 2026 (`94dfe8f`) before the Next.js rebuild.

[1.0.0]: https://github.com/abhinav-adtechs/superjoin-health-league/compare/v0.3.0...v1.0.0
[0.3.0]: https://github.com/abhinav-adtechs/superjoin-health-league/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/abhinav-adtechs/superjoin-health-league/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/abhinav-adtechs/superjoin-health-league/commits/v0.1.0
