# Caluno

A multi-tenant project for managing volunteers and shifts in organizations.

## Monorepo structure

Mono-repo powered by TurboRepo.

```
├── apps                    # Entrypoints, each exposes an app or service
│   ├── backend             # Backend graphQL api service - NestJS, Postgres
│   └── frontend            # Main web app - NextJS (includes the backoffice at /admin/[orgUId])
└── packages                # Shared code imported by the apps and services
    ├── data                # Shared data library - graphQL queries and mutations
    ├── infra               # Terraform config for deploying the services and apps
    ├── lifespan            # Contract lifespan string parser (@repo/lifespan), shared by backend and frontend
    ├── observability       # Shared Sentry config builders (@repo/observability) consumed by both apps
    ├── security            # Security audit tooling (@repo/security): endpoint inventory, tenant invariants, scanners
    ├── typescript-config   # Shared typescript config
    └── ui                  # Shared react components and styles - shadcn, tailwind, storybook
```
Primary flow of data: frontend → @repo/data → backend → database. There is no separate backoffice app — the backoffice lives in the frontend under `(dashboard)/[orgUId]` (`/admin` routes).

## OSS / Enterprise Edition (EE)

Caluno is one private monorepo that produces two editions. Agents must keep the boundary intact on every change.

| Edition        | What it is                                                                      | How it exists                                                                    |
| -------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **OSS (core)** | The open-source product (volunteer/shift management without proprietary extras) | Filtered tree from this repo via `scripts/ee-oss-mirror`                         |
| **EE**         | Proprietary features on top of core (e.g. personal notes)                       | Only under directories named `ee` or `ee-*`; present in private/hosted checkouts |

**Standing invariant:** after every directory named `ee` or `ee-*` is removed (plus the static denylist in `scripts/ee-oss-mirror/denylist`), the remaining tree must still install, typecheck, build, migrate, and boot. Core must never hard-depend on an EE module.

Detection is presence-based: `hasEeEdition()` / `loadEeModules()` look for `src/ee`. Set `CALUNO_EDITION=oss` to force OSS mode from a private checkout. Mirror tooling: `bun run oss:copy <target-dir>`.

### Where code goes

| Kind                        | Location                                                             | Notes                                                                                                   |
| --------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| EE backend feature          | `apps/backend/src/ee/<feature>/`                                     | Aggregated by `ee.module.ts`; loaded only via `loadEeModules()`                                         |
| EE DB schemas / migrations  | `apps/backend/src/ee/**/schemas/`, `apps/backend/src/ee/migrations/` | Separate Drizzle stream (`db:generate:ee`, ledger `__drizzle_migrations_ee`) — never in `src/database/` |
| EE frontend UI              | `apps/frontend/src/ee/`                                              | Single manifest `src/ee/index.ts` (`eeExtensions`: nav + slots)                                         |
| EE i18n copy                | `apps/frontend/messages/ee/{en,de}.json`                             | Never in shared `messages/{en,de}.json` (those ship to OSS)                                             |
| EE data client              | `packages/data/src/ee/`                                              | Consumed as `@repo/data/ee` — only from EE UI (`apps/frontend/src/ee/**`)                               |
| Edition bridges (OSS-safe)  | `apps/*/src/edition/`                                                | `hasEeEdition`, `EeSlot` / `EePage`, `loadEeModules` — these stay in the OSS tree                       |
| Also private (not EE-named) | `scripts/ee-oss-mirror/denylist`                                     | Paths stripped from the public mirror (e.g. `packages/infra`)                                           |

Thin App Router stubs that only render `<EePage />` / `<EeSlot />` may live in OSS route trees — they 404 or render nothing when EE is absent. Put no EE business logic in those stubs.

### Agent rules (non-negotiable)

1. **New EE work** → implement under an `ee` (or `ee-*`) directory in the relevant package; register in the EE module/manifest; wire OSS call sites only through edition bridges (`<EeSlot />`, `<EePage />`, `loadEeModules()`).
2. **Never** statically import `@/ee`, `../ee/…`, or `@repo/data/ee` from non-EE / non-edition code — that breaks the OSS build. Load EE only through the edition helpers (dynamic / optional).
3. **Never** put EE tables, GraphQL types, migrations, or user-facing copy in core paths — the mirror would publish them or the OSS build would fail.
4. **Core features stay outside `ee/`** — do not park ordinary product work under `ee` because it is unfinished or "hosted-only" without a real EE boundary.
5. **Boundary check before finishing:** "If every `ee` folder disappeared, would this still compile and behave as core?" If no → fix the placement or the import.

Package-specific mechanics live in the child AGENTS files (frontend i18n/slots, backend migration commands, `@repo/data` EE export) — do not restate them here.

## Root Commands

Use `bun` - never npm or yarn.

- `bun run dev` - Starts backend, frontend and storybook dev servers
- `bun run lint` - Lints all packages
- `bun run format` - Formats all packages
- `bun run check-types` - Checks for type errors in all packages
- `bun run db:migrate` - Migrates database schema
- `bun run db:up` / `bun run db:down` - Start/stop local Postgres
- `bun run codegen` - Regenerate GraphQL types (schema + *.graphql)
- `bun run security:audit` - Deterministic security checks into `packages/security/out/` (see packages/security/AGENTS.md)
- `bun run terms:publish` - Publish terms versions against the local dev DB (deployed envs auto-publish on boot; never run against production — no prod DB credentials exist locally; see apps/backend/AGENTS.md for the file-naming rule)

## Local fixtures

- Local fixtures are the **Altonaer Lesepaten** demo dataset (`bun bootstrap`; every deployed environment seeds it on boot, including production). Members are `demo+member01@caluno.org` … `demo+member29@caluno.org` and the demo login is `demo@caluno.org`. Fixtures skip already-existing rows, so users seeded before your session keep their original password.
- The **Testing** seed (`apps/backend/src/database/fixtures.ts`) is for e2e (`bun run --cwd apps/backend db:fixtures:e2e`; also loaded by staging/release entrypoints when `APP_ENV` is `staging` or `release`) and uses `demo+testing_*@caluno.org`. See apps/backend/AGENTS.md.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
