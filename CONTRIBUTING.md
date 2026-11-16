# Contributing to Office Health League

Thanks for helping out! This guide covers local setup, the conventions this repo follows, and what a good pull request looks like.

By participating you agree to follow the [Code of Conduct](https://github.com/abhinav-adtechs/.github/blob/main/CODE_OF_CONDUCT.md). Please report security issues privately as described in the [security policy](https://github.com/abhinav-adtechs/.github/blob/main/SECURITY.md) — not in public issues.

## Development setup

**Requirements:** Node.js 20+ (CI runs Node 22) and npm. A Supabase project is needed to sign in and log data, but not to build.

```bash
git clone https://github.com/abhinav-adtechs/superjoin-health-league.git
cd superjoin-health-league
npm ci                          # .npmrc enables legacy-peer-deps
cp .env.example .env.local      # add your Supabase URL, anon key and service-role key
npm run dev                     # http://localhost:3003
```

Database setup (schema, migrations, users, PINs) is in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md). For a populated leaderboard, run `npm run seed-dummy-data` against a **development** project.

### Useful scripts

| Command                                                  | Purpose                                                                 |
| -------------------------------------------------------- | ----------------------------------------------------------------------- |
| `npm run dev`                                            | Dev server on port 3003                                                 |
| `npm run build`                                          | Production build, including the TypeScript check — this is what CI runs |
| `npm run seed-dummy-data` / `npm run cleanup-dummy-data` | Demo data on/off                                                        |
| `npm run recalculate-points`                             | Recompute stored `daily_points` after a scoring change                  |
| `npm run cap:sync` / `npm run ios`                       | Sync and open the iOS project                                           |

> [!NOTE]
> `npm run lint` is not usable yet — Next.js prompts to create an ESLint config. Committing that config is an open roadmap item and a good first contribution.

## Where things live

- UI shell and tabs: `app/page.tsx`, `components/`
- API: `app/api/**/route.ts`
- Scoring: `lib/points.ts` (see [`docs/SCORING.md`](docs/SCORING.md))
- Database: `supabase/schema.sql` + `supabase/migrations/`

[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) has the full map.

## Making changes

### Scoring changes

Points are visible to every user, so scoring changes need extra care:

1. Change the logic in `lib/points.ts` only — routes and the leaderboard import from there.
2. Update user-facing copy in `lib/scoring-copy.ts` and `components/PointSystemPanel.tsx`, and add a migration that syncs the `scoring_rules` documentation table.
3. Update [`docs/SCORING.md`](docs/SCORING.md).
4. If stored points change, provide or update a backfill script in `scripts/` (see `migrate-to-v3-scoring.js`), dry run by default.

### Database changes

- Add a new file in `supabase/migrations/` named `YYYYMMDD_short_description.sql`. Never edit a migration that has already shipped.
- Prefer idempotent SQL (`IF NOT EXISTS`, `ON CONFLICT`) and keep RLS enabled on new tables.
- Mention in the PR description if the migration must run before the code deploys.

### Secrets and personal data

Never commit `.env*` files, keys, tokens, real user names, emails or health data. Use `.env.example` for new variables (with placeholder values) and document them in the README configuration table.

## Branches and commits

- Branch from `main` using a prefix: `feat/…`, `fix/…`, `docs/…`, `chore/…`, `refactor/…`, `test/…`.
- Write commits in [Conventional Commits](https://www.conventionalcommits.org/) style, as most recent history does:

  ```text
  feat(dashboard): add week-at-a-glance goal grid
  fix(api): deploy food and water log routes blocked by gitignore
  docs: explain v3 calorie margins
  ```

- Keep commits focused; squash fix-ups before requesting review.

## Filing issues

- **Bugs:** what you did, what you expected, what happened, and whether it was the web or iOS app. Screenshots help for UI issues.
- **Features:** the problem first, then the proposed change. Scoring proposals should include a worked example.
- Search [existing issues](https://github.com/abhinav-adtechs/superjoin-health-league/issues) first.

## Pull request checklist

- [ ] `npm run build` passes locally
- [ ] The change is scoped to one concern and the PR description explains _why_
- [ ] New environment variables are added to `.env.example` and the README
- [ ] Database changes ship as a new dated migration
- [ ] Scoring changes update `lib/points.ts`, UI copy, `docs/SCORING.md` and a backfill path
- [ ] UI changes include before/after screenshots (mobile and desktop where relevant)
- [ ] No secrets, personal data or `.env*` files in the diff
