---
name: security-audit
description: Defensive security review of this repo with provable coverage - tenant isolation, authorization, injection, secrets, dependencies, IaC. Use when asked for a security audit or review, a pentest-style check of the codebase, or to verify a change against the tenant model.
metadata:
  type: workflow
---

# Security audit

Read `packages/security/AGENTS.md` first: it defines the tenant model and invariants this review checks.

## Rules
- Read-only. Never edit source during an audit; report only.
- Evidence or silence: every finding cites `path:line` and quotes the minimal code. No `path:line`, no finding.
- Tag each finding `CONFIRMED` (full code path read), `NEEDS-RUNTIME` (needs a running instance with two organization units to prove; say exactly how) or `UNCERTAIN` (say what context is missing).
- Never claim "reviewed everything". Coverage is what the manifest proves.

## Steps
1. `bun run --cwd packages/security audit`. If it exits 3, list the skipped tools in the report; do not treat them as clean.
2. Read `packages/security/out/surface.json` and `out/tenant-queries.json` (id-only queries on tenant tables; start with findings whose `reachedFrom` is non-empty and `readsTenantContext` is false; closing rules and limits in AGENTS.md). Order the work: `UNVERIFIED-TENANT-CONTEXT`, then `ANONYMOUS`, then `AUTHENTICATED-NO-PERMISSION`, then the rest.
3. Review in batches of one module (`apps/backend/src/<domain>`). For each endpoint follow the call into the service and check:
   - Invariant A: a handler using the client tenant has `@Permissions`.
   - Invariant B: every Drizzle `db.query.<table>.findFirst/findMany` and `update/delete/insert/select` on a table with `organizationUnitId`/`organizationId` is constrained to the caller's unit. Loading by `id` alone and comparing later counts only if the comparison happens before any data is returned or written.
   - Sub-units: when a permission is granted on a parent unit, check whether it intentionally covers children (`parentId`), and that a child-unit permission never reaches the parent or siblings.
   - Multi-org members: a user in units A and B, acting with header A, must not read or write B's rows, including through shared documents and form submission shares.
   - Anonymous endpoints: nothing loaded by id may leak data of a non-public unit.
4. Triage `out/semgrep.sarif`, `osv.json`, `gitleaks.json`, `kics*.json`, `trivy-iac.json`: confirm or dismiss each item with the reason.
5. Write `packages/security/out/manifest.jsonl`: one line per id in `surface.json`, `{"id": "...", "status": "REVIEWED-CLEAN|FINDING|SKIPPED", "note": "..."}`. SKIPPED with a reason is honest; a false REVIEWED-CLEAN is not.
6. `bun run --cwd packages/security audit:coverage`. Report the coverage line as is.

## Output
`packages/security/out/report.md`:
1. Findings ranked Critical to Low: title, severity, tag, `path:line`, why it is exploitable, how to prove it, minimal fix direction.
2. Coverage result from step 6 and the list of skipped tools.
3. Runtime verification checklist for every `NEEDS-RUNTIME` item, written as tests against a local instance (`bun run dev`, demo fixtures) with two organization units.
