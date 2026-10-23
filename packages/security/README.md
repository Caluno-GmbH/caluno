# @repo/security

Read-only security checks for the monorepo. It lists every backend endpoint, runs the external scanners, and checks that an audit reviewed every endpoint. Nothing here changes source code. Results go to `out/`, which is gitignored and never committed.

For the tenant model, the invariants and how to run an AI audit, see [AGENTS.md](./AGENTS.md) and the `security-audit` skill.

## What you need

| Tool | Used by | Install (macOS / Linux with Homebrew) | Other ways | Tested with |
|---|---|---|---|---|
| [bun](https://bun.sh) | `audit:surface`, `audit:coverage` | already required by the repo | | 1.3.5 |
| [semgrep](https://semgrep.dev) | `audit:sast` | `brew install semgrep` | `pipx install semgrep` | 1.181.0 |
| [osv-scanner](https://github.com/google/osv-scanner) | `audit:deps` | `brew install osv-scanner` | `go install github.com/google/osv-scanner/v2/cmd/osv-scanner@latest` | 2.7.0 |
| [gitleaks](https://github.com/gitleaks/gitleaks) | `audit:secrets` | `brew install gitleaks` | release binaries on GitHub | 8.30.1 |
| [KICS](https://kics.io) | `audit:iac` | `brew install kics` | Docker: used automatically when `kics` is missing and `docker` is installed (`checkmarx/kics`) | 2.2.0 |
| [trivy](https://trivy.dev) | `audit:iac` | `brew install trivy` | release binaries on GitHub | 0.76.0 |

One-liner:

```bash
brew install semgrep osv-scanner gitleaks kics trivy
```

Also needed:
- **The `packages/infra` submodule** for `audit:iac`: `git submodule update --init packages/infra`. Without it the IaC step is skipped (exit 3).
- **Network access** the first time: semgrep downloads its registry rule packs (`rules/semgrep-packs.txt`), osv-scanner queries osv.dev, and trivy downloads its checks.

### KICS query library
KICS needs its query library (`assets/queries`). The Homebrew install keeps it under `$(brew --prefix kics)/share/kics/assets/queries`, which `scripts/audit.sh` finds on its own. If KICS lives somewhere else, point the script at it:

```bash
KICS_QUERIES=/path/to/kics/assets/queries bun run audit:iac
```

## Run it

From the repo root:

```bash
bun run security:audit
```

Or a single step from `packages/security`:

| Command | What it does | Output |
|---|---|---|
| `bun run audit` | All steps below | `out/` |
| `bun run audit:surface` | Lists every resolver/controller endpoint (AST) with tenant-context flags | `out/surface.json` |
| `bun run audit:sast` | semgrep registry packs + vendored rules on `apps/`, `packages/data`, `packages/ui` | `out/semgrep.sarif` |
| `bun run audit:deps` | osv-scanner on `bun.lock` | `out/osv.json` |
| `bun run audit:secrets` | gitleaks on the full git history with the root `.gitleaks.toml` | `out/gitleaks.json` |
| `bun run audit:iac` | KICS (root `kics.config`) + trivy on `packages/infra` | `out/kics.json`, `out/trivy-iac.json` |
| `bun run audit:coverage` | Compares `out/surface.json` with an audit's `out/manifest.jsonl` | prints the coverage line |

### Exit codes
- `0`: every step ran and wrote a fresh report. Findings do **not** fail the run; read the reports.
- `3`: a tool is missing, or a tool ran but wrote no report (e.g. KICS without its query library). A skipped step is not a pass: install or fix the tool and run again.
- `2`: unknown step name.

## After a run
- `out/surface.json` is the input for the `security-audit` skill. Endpoints flagged `UNVERIFIED-TENANT-CONTEXT`, `ANONYMOUS` and `AUTHENTICATED-NO-PERMISSION` are reviewed first.
- The audit writes `out/manifest.jsonl` (one line per endpoint) and `out/report.md`. `audit:coverage` must report 100%.
- Keep finished runs outside `out/` (the next run overwrites it), for example in the gitignored `analysis/` folder.
