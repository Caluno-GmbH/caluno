#!/usr/bin/env bash
# Deterministic security checks. Read-only on the repo; results in out/.
# Usage: bash scripts/audit.sh [surface|tenant|sast|deps|secrets|iac|all]   (default: all)
# A missing tool is skipped with an install hint, never silently passed.
# Scanners exit non-zero when they find something, so their exit code is
# ignored; a step only passes when it wrote a fresh, non-empty report.
set -uo pipefail

PKG="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(cd "$PKG/../.." && pwd)"
OUT="$PKG/out"
mkdir -p "$OUT"
STEP="${1:-all}"
FAILED=()

say() { printf '\n\033[1;34m==>\033[0m %s\n' "$*"; }
have() { command -v "$1" >/dev/null 2>&1; }
skip() { printf '  \033[33mSKIP\033[0m %s not installed (%s)\n' "$1" "$2"; FAILED+=("$1:missing"); }

# Fails the step when the tool crashed without writing its report. Reports are
# removed before each run, so a stale file from an earlier run cannot pass.
require_output() {
  local tool="$1" file="$2"
  if [ ! -s "$file" ]; then
    printf '  \033[31mFAIL\033[0m %s wrote no report (%s)\n' "$tool" "${file#"$ROOT"/}"
    FAILED+=("$tool:no-output")
  fi
}

# KICS needs its query library. Homebrew installs it outside the default
# ./assets/queries path, so look in the usual places. KICS_QUERIES overrides.
kics_queries() {
  local bin candidates=()
  [ -n "${KICS_QUERIES:-}" ] && candidates+=("$KICS_QUERIES")
  bin="$(readlink -f "$(command -v kics)")"
  candidates+=(
    "$(dirname "$bin")/../share/kics/assets/queries"
    "$(dirname "$bin")/assets/queries"
  )
  have brew && candidates+=("$(brew --prefix kics 2>/dev/null)/share/kics/assets/queries")
  candidates+=(/usr/share/kics/assets/queries /usr/local/share/kics/assets/queries)
  local dir
  for dir in "${candidates[@]}"; do
    [ -d "$dir" ] && { (cd "$dir" && pwd); return 0; }
  done
  return 1
}

run_surface() {
  say "surface: endpoint inventory + tenant-context invariant"
  rm -f "$OUT/surface.json"
  (cd "$PKG" && bun src/enumerate-surface.ts > "$OUT/surface.json")
  require_output surface "$OUT/surface.json"
}

run_tenant() {
  say "tenant: id-only queries on tenant tables (invariant B)"
  rm -f "$OUT/tenant-queries.json"
  (cd "$PKG" && bun src/check-tenant-queries.ts > "$OUT/tenant-queries.json")
  require_output tenant-queries "$OUT/tenant-queries.json"
}

run_sast() {
  say "sast: semgrep (registry packs + vendored rules)"
  if ! have semgrep; then skip semgrep "brew install semgrep | pipx install semgrep"; return; fi
  local configs=()
  while read -r p; do [ -n "$p" ] && configs+=(--config "$p"); done < "$PKG/rules/semgrep-packs.txt"
  rm -f "$OUT/semgrep.sarif"
  semgrep scan --metrics=off --quiet --sarif -o "$OUT/semgrep.sarif" \
    "${configs[@]}" --config "$PKG/rules/semgrep-local.yml" \
    "$ROOT/apps" "$ROOT/packages/data" "$ROOT/packages/ui" || true
  require_output semgrep "$OUT/semgrep.sarif"
}

run_deps() {
  say "deps: osv-scanner on bun.lock"
  if ! have osv-scanner; then skip osv-scanner "brew install osv-scanner"; return; fi
  rm -f "$OUT/osv.json"
  osv-scanner scan source --format json --output "$OUT/osv.json" --lockfile "$ROOT/bun.lock" || true
  require_output osv-scanner "$OUT/osv.json"
}

run_secrets() {
  say "secrets: gitleaks on full history with the repo's .gitleaks.toml"
  if ! have gitleaks; then skip gitleaks "brew install gitleaks"; return; fi
  rm -f "$OUT/gitleaks.json"
  gitleaks git "$ROOT" --config "$ROOT/.gitleaks.toml" --redact --no-banner \
    --report-format json --report-path "$OUT/gitleaks.json" || true
  require_output gitleaks "$OUT/gitleaks.json"
}

run_iac() {
  say "iac: KICS with the repo's kics.config + trivy on packages/infra"
  local infra="$ROOT/packages/infra"
  if [ ! -d "$infra" ] || [ -z "$(ls -A "$infra" 2>/dev/null)" ]; then
    printf '  \033[33mSKIP\033[0m packages/infra is empty: run git submodule update --init\n'
    FAILED+=("infra:submodule-missing"); return
  fi
  # Only packages/infra holds IaC; scanning the repo root walks node_modules
  # and takes far longer for no extra coverage.
  rm -f "$OUT/kics.json"
  if have kics; then
    local queries
    if queries="$(kics_queries)"; then
      kics scan --config "$ROOT/kics.config" -p "$infra" -q "$queries" -o "$OUT" \
        --output-name kics --report-formats json --no-progress --ci >/dev/null || true
      require_output kics "$OUT/kics.json"
    else
      printf '  \033[31mFAIL\033[0m kics query library not found; set KICS_QUERIES=<path>/assets/queries\n'
      FAILED+=("kics:queries-missing")
    fi
  elif have docker; then
    docker run --rm -v "$ROOT:/repo" -v "$OUT:/out" checkmarx/kics:latest \
      scan --config /repo/kics.config -p /repo/packages/infra -o /out \
      --output-name kics --report-formats json --no-progress --ci >/dev/null || true
    require_output kics "$OUT/kics.json"
  else
    skip kics "brew install kics, or install docker"
  fi
  if have trivy; then
    rm -f "$OUT/trivy-iac.json"
    trivy config --quiet --format json --output "$OUT/trivy-iac.json" "$infra" || true
    require_output trivy "$OUT/trivy-iac.json"
  else
    skip trivy "brew install trivy"
  fi
}

case "$STEP" in
  surface) run_surface ;;
  tenant) run_tenant ;;
  sast) run_sast ;;
  deps) run_deps ;;
  secrets) run_secrets ;;
  iac) run_iac ;;
  all) run_surface; run_tenant; run_sast; run_deps; run_secrets; run_iac ;;
  *) echo "Unknown step: $STEP"; exit 2 ;;
esac

say "results in packages/security/out/"
if [ ${#FAILED[@]} -gt 0 ]; then
  printf '  not run: %s\n' "${FAILED[*]}"
  printf '  A skipped or failed step is NOT a pass. Fix it and rerun.\n'
  exit 3
fi
