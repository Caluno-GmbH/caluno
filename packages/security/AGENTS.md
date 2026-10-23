# Security audit tooling

Deterministic security checks for the monorepo, plus the inputs an AI audit
needs to prove its coverage. Tools produce evidence and coverage; agents only
triage and reason about authorization logic. Nothing here modifies source.

## Commands
Run from `packages/security` (or `bun run security:audit` from the root).
- `bun run audit` - All steps below; results in `out/` (gitignored). Exit 3 if a tool was missing or wrote no report: a skipped or failed step is not a pass.
- `bun run audit:surface` - Every resolver/controller endpoint via AST -> `out/surface.json`, with the tenant-context flags
- `bun run audit:tenant` - Invariant B rule: id-only queries on tenant tables -> `out/tenant-queries.json`
- `bun run audit:sast` - Semgrep: registry packs (`rules/semgrep-packs.txt`) + vendored rules (`rules/semgrep-local.yml`)
- `bun run audit:deps` - osv-scanner on `bun.lock`
- `bun run audit:secrets` - gitleaks on the full git history, using the root `.gitleaks.toml`
- `bun run audit:iac` - KICS with the root `kics.config` + trivy, both on `packages/infra` only (needs the submodule). KICS query library is found automatically; override with `KICS_QUERIES=<dir>`
- `bun run audit:coverage` - Compares `out/surface.json` with an agent's `out/manifest.jsonl`
- `bun run test` - Unit tests of the AST rules
- `bun run check-types`

## Project Structure
```
src/
├── config.ts             # Calibration: paths, decorators, tenant context. Update when conventions change
├── tenant-context.ts     # Shared AST predicates: decorator names, "handler reads the client tenant"
├── enumerate-surface.ts  # Endpoint inventory + invariant A
├── tenant-queries.ts     # Invariant B rule (pure, unit-tested in tenant-queries.spec.ts)
├── check-tenant-queries.ts  # Invariant B CLI -> out/tenant-queries.json
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
- **B, tenant-scoped queries**: every Drizzle read/write on a tenant table must be constrained to the caller's unit, not only by `id`. Tenant tables are those with an `organizationUnitId`/`organizationId` column plus the tenant root (`organizations`). `audit:tenant` writes `out/tenant-queries.json`. It is a report, not a gate: findings do not fail the run.

### What `audit:tenant` flags
- `db.query.<table>.findFirst|findMany({ where: { id } })`, also written `where: eq(t.id, v)` or `where: (t, { eq }) => eq(t.id, v)`
- `.where(eq(<table>.id, v))` on select, update and delete

Not flagged: a `where` that also has a tenant column, a tenant relation, `AND`/`OR`/`RAW` or a spread; and an id read from a loaded row (a field of a local variable, or of a parameter typed `*Entity`), which follows a stored reference rather than client input.

Each finding lists `reachedFrom` (the resolver/controller handlers that call the enclosing method, one level up) and `readsTenantContext` (one of them reads the header unit). `readsTenantContext: false` on a handler-reached finding usually means the handler never compares anything with the tenant: start there.

### Closing a finding
Pass the loaded resource to a `TenantScopeService` helper (`apps/backend/src/organization/tenant-scope.service.ts`) before returning or writing it:
- `assertResourceInScope(headerUnitId, resource.organizationUnitId)`: the resource's unit is the header unit or a descendant of it.
- `assertAnyUnitInScope(headerUnitId, unitIds)`: at least one of the units is.
- `assertUserInScope(headerUnitId, userId)`: the user has a membership in scope (e.g. a volunteer).
- `assertOrganizationInScope(headerUnitId, resource.organizationId)`: for resources scoped to an organization (e.g. roles).

All throw NotFound, so a foreign id looks like a missing one. The call closes the finding when its arguments reference the variable holding the query result, either in the same function or in every caller of the enclosing method (the service loads, the resolver checks). A helper call about a different resource closes nothing. When the id provably cannot cross tenants (e.g. it comes from the caller's own session), exempt the statement instead: `// tenant-scope-ok: <reason>`.

### Limits
- Callers are matched by method name, one level up. A name shared by unrelated classes (`update`) lists extra handlers in `reachedFrom` and makes closing harder, never easier.
- Tables scoped only through a parent (shift -> event -> unit) are not detected.
- A `where` that filters on a tenant column with a client-supplied value (`organizationId: input.organizationId`) passes. The rule checks that a tenant filter exists, not where its value comes from.

The `security-audit` skill still reviews what these limits leave out.

## Flags in `out/surface.json`
- `UNVERIFIED-TENANT-CONTEXT` - Highest priority. Confirm the service does not trust the unit id, or add `@Permissions`.
- `ANONYMOUS` - `@AllowAnonymous`/`@OptionalAuth`. Every object loaded by id must be safe to show to anyone.
- `AUTHENTICATED-NO-PERMISSION` - Any logged-in user can call it. Fine for "my own data" endpoints scoped by `session.user.id`; a bug otherwise.
- `CLASS-LEVEL-PERMISSIONS-IGNORED` - Move the decorator to each method.

## Patterns
- Adding a check: prefer an AST/semgrep rule that covers every call site over a prompt instruction. Agents sample; rules don't.
- Changing a guard, decorator or the tenant header: update `src/config.ts` in the same PR.
- Running an AI audit: see skill `.agents/skills/security-audit`.
