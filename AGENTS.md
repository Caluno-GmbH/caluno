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
