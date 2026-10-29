# caluno-e2e

End-to-end tests for Caluno, using [Playwright](https://playwright.dev) with a
Page Object Model. Runs against the deployed staging app.

## Structure

```
e2e/
├── pages/                 # Page objects (one class per screen)
│   ├── AuthPage.ts        # shared base: base URL, email/password fields
│   ├── LoginPage.ts
│   ├── SignupPage.ts
│   ├── VerifyEmailPage.ts
│   ├── org/OrgPage.ts
│   └── shifts/ShiftsPage.ts
├── fixtures/
│   └── shift.ts           # reusable shift specs for the creation suite
├── utils/
│   ├── auth.ts            # signUpVerifyAndLogin helper
│   ├── mailbox.ts         # Mailpit client: reads verification codes
│   └── test-data.ts       # password + unique email generator
├── tests/
│   ├── flow.e2e.ts        # the end-to-end journey (smoke)
│   └── features/          # focused suites (auth, org, shifts)
└── playwright.config.ts
```


## Fixture data

Most specs here are **not** self-contained: `admin-redirect`, `my-shifts`, the
two public-detail specs, `terms`, `documents-flow` and `setup-gating` log in as
seeded accounts. That seed is e2e-only and is _not_ loaded by `bun bootstrap` or
by deployed environments. Load it yourself (after migrate + seed):

```bash
bun run --cwd apps/backend db:fixtures:e2e
```

It uses `demo+testing_*@caluno.org` accounts (password `abcd1234`) in the
"Testing" org.

## Running

From this directory (`e2e`):

```bash
bun run test                        # run the suite again staging
bun run test:headed                 # run the suite again staging showing a browser
bun run test:local                  # run the suite again localhost
bun run test:local:headed           # run the suite again localhost showing a browser
bun run test --reporter=html        # run + generate HTML report
bun playwright show-report          # open the last HTML report
```

You can append a test file to only run the tests in that file.

Browsers install once with `bun playwright install chromium`.
Target another environment with `E2E_BASE_URL=https://... bun playwright test`
(defaults to staging).

### Email verification

Staging sends all mail to a shared [Mailpit](https://mailpit.axllent.org) sink
(a catch-all SMTP server with a REST API). The suite reads the verification code
from it via `utils/mailbox.ts` — signup uses a unique `@example.com` recipient
per run and polls Mailpit for the matching message.

The mailbox is behind basic auth. Defaults target staging; override with env vars:

```bash
MAILBOX_URL=https://staging.mailbox.caluno.org \
MAILBOX_USER=mailpit \
MAILBOX_PASSWORD=... \
bun playwright test
```

Prefer supplying `MAILBOX_PASSWORD` via a CI secret rather than relying on the
committed default.

## CI against deployed environments

- **Staging nightly** — `.github/workflows/e2e-staging-nightly.yml` (cron
  `0 0 * * *` UTC ≈ 02:00 CEST, plus `workflow_dispatch`).
- **Release post-deploy** — `cd-release.yml` runs the same suite via
  `reusable-e2e.yml` after a successful Terraform apply.

Both pin `E2E_BASE_URL` / `E2E_API_URL` / Mailpit and upload the Playwright
report on failure. Staging/release deploys load the Testing e2e seed
automatically (backend entrypoint when `APP_ENV` is `staging` or `release`
runs `db:fixtures:e2e` after the demo seed), so `demo+testing_*@caluno.org`
accounts and today-relative overlap fixtures stay fresh without a manual
step. Password defaults to `abcd1234` (override with `FIXTURE_PASSWORD`).

Repo secrets: `MAILBOX_PASSWORD` (staging Mailpit), `RELEASE_MAILBOX_PASSWORD`
(release Mailpit). Specs that require a local DB (e.g. the terms acceptance
gate) stay skipped via `IS_LOCAL`.

## Conventions

- **Specs use the `*.e2e.ts` suffix** so the repo's `bun test` runner ignores
  them (Playwright and Bun otherwise share `*.spec.ts` / `*.test.ts`).
- **Selectors** are role- and label-based, captured from the live app — not guessed.
- **Waits** are locator- and URL-driven (`waitForURL`, `waitFor`); no
  `networkidle` and no fixed sleeps.
- **Person names must not contain digits.** The signup requirement-form name
  fields reject anything but letters, marks, apostrophe, hyphen and space
  (`NAME_RE` in `apps/frontend/src/domain/requirement-form/components/field-renderer.tsx`).
  Write numbers as words: `E Two E`, matching the Testing seed's
  `Testing Member One` style (see `apps/backend/src/database/fixtures.ts`).
- Each run **provisions data on staging** (one user, org, and shift).
- `test-results/` and `playwright-report/` are git-ignored.
```
```
