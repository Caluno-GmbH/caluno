# Security audit tooling

Deterministic security checks for the monorepo, plus the inputs an AI audit
needs to prove its coverage. Tools produce evidence and coverage; agents only
triage and reason about authorization logic. Nothing here modifies source.

## Commands
Run from `packages/security` (or `bun run security:audit` from the root).
- `bun run audit` - All steps below; results in `out/` (gitignored). Exit 3 if a tool was missing or wrote no report: a skipped or failed step is not a pass.
- `bun run audit:surface` - Every resolver/controller endpoint via AST -> `out/surface.json`, with the tenant-context flags
- `bun run audit:sast` - Semgrep: registry packs (`rules/semgrep-packs.txt`) + vendored rules (`rules/semgrep-local.yml`)
- `bun run audit:deps` - osv-scanner on `bun.lock`
- `bun run audit:secrets` - gitleaks on the full git history, using the root `.gitleaks.toml`
- `bun run audit:iac` - KICS with the root `kics.config` + trivy, both on `packages/infra` only (needs the submodule). KICS query library is found automatically; override with `KICS_QUERIES=<dir>`
- `bun run audit:coverage` - Compares `out/surface.json` with an agent's `out/manifest.jsonl`
- `bun run check-types`

## Project Structure
```
src/
├── config.ts             # Calibration: paths, decorators, tenant context. Update when conventions change
├── enumerate-surface.ts  # Endpoint inventory + invariant A
└── coverage-diff.ts      # Surface vs agent manifest -> coverage %, missing and invented ids
rules/                    # Semgrep packs list + vendored rules
scripts/audit.sh          # Orchestrator for the external tools
out/                      # Generated reports, never committed
```

## Tenant model these checks rely on
Verified in code; if any of this changes, update `src/config.ts` and this section.
- The active tenant is chosen by the client: header `x-organization-unit-id`, copied into the GraphQL context (`apps/backend/src/app.module.ts`) and read by `PermissionGuard` for REST.
- `PermissionGuard` checks membership and permissions only when the handler has `@Permissions(...)`. Without it the guard returns `true` and `organizationUnitId` is unverified input.
- The guard reads metadata from the handler only: a class-level `@Permissions` is ignored.
- `fieldResolverEnhancers: ['guards']` is on, so guards also run on `@ResolveField`.

## Invariants
- **A, tenant context verified**: a handler that reads `context.organizationUnitId` or the header must have `@Permissions`. Checked on 100% of endpoints by `audit:surface` (flag `UNVERIFIED-TENANT-CONTEXT`).
- **B, tenant-scoped queries**: every Drizzle read/write on a table with `organizationUnitId`/`organizationId` must be constrained to the caller's unit, not only by `id`. Not automated yet: reviewed per endpoint by the `security-audit` skill.

## Flags in `out/surface.json`
- `UNVERIFIED-TENANT-CONTEXT` - Highest priority. Confirm the service does not trust the unit id, or add `@Permissions`.
- `ANONYMOUS` - `@AllowAnonymous`/`@OptionalAuth`. Every object loaded by id must be safe to show to anyone.
- `AUTHENTICATED-NO-PERMISSION` - Any logged-in user can call it. Fine for "my own data" endpoints scoped by `session.user.id`; a bug otherwise.
- `CLASS-LEVEL-PERMISSIONS-IGNORED` - Move the decorator to each method.

## Patterns
- Adding a check: prefer an AST/semgrep rule that covers every call site over a prompt instruction. Agents sample; rules don't.
- Changing a guard, decorator or the tenant header: update `src/config.ts` in the same PR.
- Running an AI audit: see skill `.agents/skills/security-audit`.
