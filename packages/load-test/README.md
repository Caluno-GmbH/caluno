# @repo/load-test

k6 load tests for Caluno. They answer "how many concurrent users can this environment serve within our latency budget?" by replaying the GraphQL calls the frontend makes, with realistic pauses between actions.

## How it works

- **Seed** (`apps/backend/src/database/load-test-fixtures.ts`, `bun run seed`): synthetic orgs (`loadtest-oNN`), each with 3 units, volunteers, a coordinator per unit, weekly shifts with history, events, past time entries, an "Urgent Call-out" shift tomorrow and a "Check-in Desk" shift today. Every account gets a database session whose token is derived from the backend's `BETTER_AUTH_SECRET`, so k6 never calls sign-in (Better Auth allows 3 sign-ins per 10 s per IP). The `load-test` environment runs the seed on every boot.
- **Data** (`bun run data`): writes `.data/load-test.json` (accounts, units, signed session cookies) from `BETTER_AUTH_SECRET` alone. It needs no database, so CI can produce it for an environment whose database is private. Account and unit ids are deterministic, and k6's `setup()` finds each unit's shift instances through the API.
- **Operations** (`scripts/extract-operations.ts`): copies every GraphQL document from `@repo/data` codegen into `.data/operations.json`, so k6 sends the same queries the app sends. Every profile script runs this step first.
- **Journeys** (`src/scenarios/`): each virtual user (VU) keeps one account and pauses 5–15 s between actions, so one VU ≈ one active person.

| Journey     | Share | What it does                                                                               |
| ----------- | ----- | ------------------------------------------------------------------------------------------ |
| volunteer   | 65%   | Home → discover → shift detail → join (10%, half cancel again) → my shifts → profile (30%) |
| coordinator | 20%   | Backoffice overview → weekly shifts → shift roster → volunteers → timesheets → events      |
| kiosk       | 5%    | Check-in desk: scan code, check a volunteer in and out of today's desk shift               |
| visitor     | 10%   | Anonymous public org page                                                                  |
| callOut     | spike | Volunteers race for their unit's 10-spot call-out shift right after the email goes out     |

A page load replays that page's SSR calls (`get-session`, terms status, then the page's queries in parallel). With `WEB_URL` set, it requests the real Next.js page instead, so the frontend container is tested too.

## Profiles

| Profile  | Shape                                                                                               | Question it answers                         |
| -------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `smoke`  | 1 iteration per journey                                                                             | Do the scripts, seed and sessions work?     |
| `load`   | Ramp to `TARGET_USERS` (200) over 5 min, hold `LOAD_HOLD` (20 min locally, 10 min in CI)            | Do we meet the budget at the expected peak? |
| `stress` | 50 → 100 → 200 → … → `STRESS_MAX_USERS` (1600), 5 min per step; stops at the first sustained breach | Where does it break?                        |
| `spike`  | Background at 25% of `TARGET_USERS`, plus `SPIKE_USERS` (300) call-out joins within 30 s            | Does an email wave hurt everyone else?      |
| `soak`   | `TARGET_USERS` for `SOAK_DURATION` (2h)                                                             | Leaks, pool exhaustion, slow degradation    |

Pass criteria (any breach fails the run): `http_req_failed` < 1%, p95 under 500 ms for reads, 1 s for writes, 300 ms for auth/REST and 1.5 s for SSR pages; GraphQL errors < 1%; checks > 99%; zero 429 responses. **The capacity answer is the last stress step that completed.**

## Running locally

```bash
brew install k6                         # or use Docker, see below
bun run db:up && bun run db:migrate && bun run db:seed
APP_ENV=load-test bun run --cwd packages/load-test seed   # LOAD_TEST_ORGS / LOAD_TEST_VOLUNTEERS_PER_UNIT to resize
bun run --cwd packages/load-test data   # reads BETTER_AUTH_SECRET from apps/backend/.env
bun run --cwd apps/backend start        # in another terminal
bun run --cwd packages/load-test smoke
```

Each run writes an HTML report to `results/<profile>.html`.

Without a local k6:

```bash
cd packages/load-test && bun run operations
docker run --rm -v "$PWD:/lt" -w /lt -e PROFILE=smoke \
  -e API_URL=http://host.docker.internal:8080 grafana/k6 run src/test.ts
```

Local numbers only tell you whether the scripts work. Your laptop is not the deployment.

## Before every promotion to production (CI)

`load-test` is a separate environment sized like production (`packages/infra/terraform.tfvars`: backend 1–4 × 1 vCPU / 1 GB, frontend 1–3, `DB-GP-XS`), so its numbers carry over. It idles at zero containers; only its database and Mailpit keep running.

When a `release → production` pull request is opened or updated, `.github/workflows/cd-load-test.yml`:

1. Deploys the pull request's merge commit to `load-test`, with the minimum container count raised to production's (1). On boot the backend publishes terms and seeds the dataset (`docker-entrypoint.sh`, load-test only).
2. Reads `caluno-load-test-better-auth-secret` from Scaleway Secret Manager and runs `bun run data` to derive the cookies.
3. Runs the `load` profile at 200 users with a 10 min hold (about 17 min), with `WEB_URL` set so SSR pages are rendered too. The HTML report is uploaded as the `k6-report-load-test-*` artifact and the result is posted to Slack.
4. Applies the idle minimum (0) again, keeping the image tag recorded in the Terraform state. This also runs when the deploy fails, and a nightly run (03:00 UTC) does the same in case a cancelled run never got there. **Load test passed** fails if scaling down fails, so a stuck environment doesn't go unnoticed.

**Load test passed** is the required check on `production`, so a release that breaches a threshold can't be merged until someone has looked at the report. Pushes to `release` while a run is in progress queue up; only the latest one runs afterwards. Manual and nightly runs share that queue, because they apply to the same Terraform state. If one of them replaces a queued pull request run, re-run the pull request's check. Pull requests into `production` from any branch other than `release` (hotfixes) skip it.

Expect about 40 minutes from push to result: image builds, the apply, the ramp and the hold.

GitHub-hosted runners aren't in `fr-par`. Their round trip is included in every request's duration, so compare runs with each other rather than reading the absolute p95 as production latency. A self-hosted runner in `fr-par` removes that noise.

## Other runs

Never run against production: it serves real users. The seed only runs with `APP_ENV=load-test`, so pointing it at any other database takes a deliberate step.

- **Stress, spike and soak:** run **CD · Load test** manually (Actions → Run workflow) on the `release` branch and pick the profile. Nobody else uses `load-test`, so any time works. Manual runs report as **Load test (profile, manual)**, so they never satisfy the required check.
- **Other environments** aren't supported: the seed plants accounts there for good, and staging and release run e2e on the same data.
- **Watch while it runs:** container instance count and CPU, Postgres CPU and connections (each backend instance opens up to `DB_POOL_MAX`=25), and backend logs.

Seeded sessions last 30 days and are extended every time the seed runs. Each run also re-anchors the call-out and check-in shifts to tomorrow and today.

## Environment variables

| Variable                                     | Default                    | Purpose                                                         |
| -------------------------------------------- | -------------------------- | --------------------------------------------------------------- |
| `API_URL`                                    | `http://localhost:8080`    | Backend base URL                                                |
| `WEB_URL`                                    | unset                      | Frontend base URL; when set, page loads render real SSR pages   |
| `TARGET_USERS`                               | `200`                      | Peak concurrent users (load, soak, spike background)            |
| `STRESS_MAX_USERS`                           | `1600`                     | Last stress step                                                |
| `SPIKE_USERS`                                | `300`                      | Call-out wave size                                              |
| `LOAD_HOLD`                                  | `20m`                      | Load profile hold time                                          |
| `SOAK_DURATION`                              | `2h`                       | Soak hold time                                                  |
| `THINK_TIME`                                 | `5-15` (`0.5-1` for smoke) | Seconds between actions                                         |
| `SESSION_COOKIE_NAME`                        | derived from `API_URL`     | `__Secure-better-auth.session_token` over https                 |
| `DATA_FILE`                                  | `.data/load-test.json`     | Absolute path to another data file                              |
| `DEBUG`                                      | unset                      | Log GraphQL error messages                                      |
| `LOAD_TEST_ORGS` (seed, data)                | `10`                       | Organizations; seed and data must agree                         |
| `LOAD_TEST_VOLUNTEERS_PER_UNIT` (seed, data) | `50`                       | Volunteers per unit (3 units per org); seed and data must agree |
| `LOAD_TEST_OUT` (data)                       | `.data/load-test.json`     | Where to write the data file                                    |

## Known limits

- Anyone holding load-test's `BETTER_AUTH_SECRET` can derive the load-test accounts' sessions. They only exist where the seed ran, which takes `APP_ENV=load-test`. Their password is random unless `LOAD_TEST_PASSWORD` is set.
- Coordinator journeys are read-only. Roster edits and approvals would reshape the dataset between runs.
- k6 sends every request from one IP. Better Auth's in-memory rate limiter is per IP and per backend instance, so a `rate_limited` count above zero is a finding, not noise (see "Rate limiting behind the proxy" below).

### Rate limiting behind the proxy

Better Auth keys its rate limits on `x-forwarded-for` and only trusts that header when it holds exactly one address, unless `advanced.ipAddress.trustedProxies` is configured. If Scaleway's proxy chain sends more than one address, every client falls back to one shared bucket per path ("Rate limiting could not determine a client IP" in the backend logs). Separately, SSR calls `/api/auth/get-session` from the frontend container, so all page renders share the frontend's IP. In either case, `get-session` is capped at 100 requests per 10 s per backend instance across all users. Check `rate_limited` and the backend logs during the first deployed run.
