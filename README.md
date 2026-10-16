# Caluno Monorepo

A Turborepo-based monorepo for the Caluno platform.

## What's inside?

This monorepo includes the following packages/apps:

### Apps and Packages

- `frontend`: a [Next.js](https://nextjs.org/) app for the web interface
- `backend`: a [NestJS](https://nestjs.com/) GraphQL API server with PostgreSQL
- `@repo/ui`: a React component library using shadcn/ui
- `@repo/typescript-config`: shared `tsconfig.json` configurations

## Prerequisites

- [Bun](https://bun.sh/) (v1.3.5 or higher)
- [Docker](https://www.docker.com/) and Docker Compose
- [Node.js](https://nodejs.org/) (v18 or higher)

## Getting Started

1. **Clone the repository**
2. **Set up environment variables**

   ```bash
   # Copy root environment file (for Docker)
   cp .env.example .env

   # Copy backend environment file
   cp apps/backend/.env.example apps/backend/.env

   # Copy frontend environment file
   cp apps/frontend/.env.example apps/frontend/.env
   ```

   Update the `.env` files with your configuration. The defaults should work for local development.

3. **Install dependencies**

   ```bash
   bun install
   ```

4. **Start the development environment**

   **First time or a clean slate** — wipe the local database, migrate, seed permissions, load the demo fixtures, then start dev:

   ```bash
   bun bootstrap
   ```

   **Day-to-day** — keep your existing database and start services:

   ```bash
   bun dev
   ```

   Both commands will:
   - Start the PostgreSQL database in Docker
   - Wait for the database to be ready
   - Start all applications in parallel (backend and frontend)

   `bun bootstrap` additionally resets the Postgres volume, runs migrations, seeds permissions, and loads the demo fixture dataset (see below).

   The services will be available at:
   - Backend API: http://localhost:8080
   - Frontend: http://localhost:3000

### Demo fixtures

After `bun bootstrap`, the database contains the **Altonaer Lesepaten** demo organization (slug `demo-altonaer-lesepaten`) — three sub-units (Nord/Süd/West) with realistic sample volunteers, recurring shifts, events, time entries, and requirement forms. All fixture accounts use password `abcd1234` (override with `DEMO_FIXTURE_PASSWORD`).

| Account | Role / status |
|---|---|
| `demo+owner@caluno.org` | Owner |
| `demo+supervisor@caluno.org` | Supervisor |
| `demo@caluno.org` | Member (demo account — use this one) |
| `demo+member01@` … `demo+member29@caluno.org` | Member |
| `demo+pending01@`, `demo+pending02@caluno.org` | Pending membership request |
| `demo+rejected01@caluno.org` | Rejected membership request |

The **Testing** seed — weekly Community Support / Food Distribution / Event Assistance shifts, a requirement form, and the stable IDs and Overlap Test shifts the Testing suite asserts on — is **e2e-only**. It is not loaded by `bun bootstrap` or by any deployed environment; load it with `bun run --cwd apps/backend db:fixtures:e2e`.

The demo dataset is also seeded on **every deploy**: the backend entrypoint runs `bun run db:fixtures:demo` on boot, in staging **and production**. That is safe against a live, populated database:

- **Non-destructive** — no `DROP`, `TRUNCATE` or `DELETE`; every write is an upsert scoped to the fixture organization and its own accounts.
- **Verify-or-abort, before any write** — the seed first checks every identity it is about to claim (each account's pinned id *and* address, plus the org id and slug). Fixture rows get deterministic ids, so ownership is proven by id rather than by name. If anything is held by a row the fixtures did not create, it aborts listing all clashes and writes **nothing at all**. Accounts an older run seeded with random ids are reported as clashes and need removing once.

`bun bootstrap` only runs against local databases (`DB_HOST` must be `localhost`, `127.0.0.1`, or `postgres`).

## Available Scripts

### Development

- `bun bootstrap` - Reset local DB, migrate, seed, load the demo fixtures, then start all services
- `bun dev` - Start all services (database + apps) without resetting data
- `bun run db:up` - Start the PostgreSQL database
- `bun run db:down` - Stop the PostgreSQL database

### Database Management

The backend uses Drizzle ORM for database management.

From the repo root:

- `bun run db:migrate` - Run pending migrations
- `bun run db:seed` - Seed permissions (idempotent; also used by tests)
- `bun run db:bootstrap` - Reset local DB, migrate, seed, and load the demo fixtures (no dev servers)

From `apps/backend`:

- `bun run db:generate` - Generate migrations from schema changes
- `bun run db:migrate` - Run pending migrations
- `bun run db:studio` - Open Drizzle Studio (database GUI)
- `bun run db:fixtures:demo` - Load the demo dataset (the app's data)
- `bun run db:fixtures:e2e` - Load the e2e-only Testing seed

### Building

- `bun run build` - Build all apps and packages
- `bun run check-types` - Type-check all TypeScript code

### Linting & Formatting

- `bun run lint` - Lint all code with Biome
- `bun run format` - Format and fix all code with Biome

### Secret leak prevention

Commits are scanned for leaked credentials before they reach CI.

1. **Install git hooks** (once per clone):

   ```bash
   bun run setup:hooks
   ```

   The pre-commit hook runs gitleaks on staged files, then formats with Biome.

   **gitleaks** (optional, faster than Docker) — if not on `PATH`, the hook uses Docker automatically:

   ```bash
   # macOS
   brew install gitleaks

   # Linux (pick your arch from https://github.com/gitleaks/gitleaks/releases — v8.24.2)
   curl -sSfL "https://github.com/gitleaks/gitleaks/releases/download/v8.24.2/gitleaks_8.24.2_linux_x64.tar.gz" \
     | tar -xz && sudo install gitleaks /usr/local/bin/
   # arm64: .../gitleaks_8.24.2_linux_arm64.tar.gz
   ```

2. **Test locally**:

   ```bash
   # Scan staged changes (same as pre-commit)
   bash .githooks/pre-commit-secrets.sh

   # Scan the whole repo
   gitleaks detect --source . --config .gitleaks.toml --redact
   ```

3. **CI**: MRs targeting `main`/`production` run GitLab `secret_detection`; `secret_detection_gate` blocks merge on findings still present in the branch tip (add as a required pipeline check). CI allowlists live in `.gitleaks.toml` for local pre-commit; GitLab ruleset customization (`.gitlab/secret-detection-ruleset.toml`) requires **Ultimate** — we rely on the gate instead.

Placeholder values in `.env.example` are allowlisted in `.gitleaks.toml`. Never commit real `.env` files — they are gitignored (only `.env.example` is tracked).

### Scaleway deployment

The root `scaleway.sh` script helps you build and push Docker images for:

- `apps/frontend`
- `apps/backend`

It uses the Scaleway Container Registry configuration from the root `.env` (or your shell environment):

- `REGISTRY_URL` - Scaleway registry URL (e.g. `rg.nl-ams.scw.cloud`)
- `SCW_CR_NAMESPACE` - Scaleway Container Registry namespace (e.g. `caluno`)
- `IMAGE_TAG` - Image tag to use (e.g. `staging` or a commit SHA)

You must be logged in to the Scaleway registry first:

```bash
docker login "$REGISTRY_URL"
```

Common usage:

```bash
# Build and push both images
./scaleway.sh

# Build images only
./scaleway.sh --build

# Push existing images only
./scaleway.sh --push
```

This script requires Docker with Buildx enabled (see the **Prerequisites** section).

## Project Structure

```
caluno/
├── apps/
│   ├── frontend/  # Next.js frontend
│   └── backend/              # NestJS GraphQL API
├── packages/
│   ├── ui/                   # Shared React components
│   └── typescript-config/    # Shared TypeScript configs
├── docker-compose.yml        # PostgreSQL database setup
└── turbo.json               # Turborepo configuration
```

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui
- **Backend**: NestJS, GraphQL, Apollo Server, Drizzle ORM
- **Database**: PostgreSQL 17
- **Tooling**: Turborepo, Bun, Biome, Docker

## Environment Variables

Environment variables are scoped per project:

### Root `.env` (Docker configuration)
- `POSTGRES_USER` - PostgreSQL username (default: postgres)
- `POSTGRES_PASSWORD` - PostgreSQL password (default: postgres)
- `POSTGRES_DB` - PostgreSQL database name (default: caluno)
- `POSTGRES_PORT` - PostgreSQL port (default: 5432)

### `apps/backend/.env` (Backend configuration)
- `PORT` - Backend server port (default: 8080)
- `DATABASE_URL` - PostgreSQL connection string
- `BETTER_AUTH_SECRET` - Secret key for authentication
- `BETTER_AUTH_URL` - Backend URL for auth
- `WEB_URL` - Frontend URL
- `COOKIE_DOMAIN` - (Optional) Root domain for cross-subdomain cookies when frontend and API use different subdomains (e.g. `caluno.org` for `app.caluno.org` + `api.caluno.org`)

## Troubleshooting

### Database connection issues

If you encounter database connection errors:

1. Ensure Docker is running
2. Check if PostgreSQL is healthy: `docker compose ps`
3. Restart the database: `bun run db:down && bun run db:up`
4. For a full local reset with sample data: `bun bootstrap`

### Port conflicts

If ports 3000, 8080, or 5432 are already in use:

1. Update the ports in `.env`
2. Update `docker-compose.yml` for PostgreSQL port
3. Restart the services
