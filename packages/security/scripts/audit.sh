#!/usr/bin/env bash
# Deterministic security checks. Read-only on the repo; results in out/.
# Usage: bash scripts/audit.sh [surface|sast|deps|secrets|iac|all]   (default: all)
# A missing tool is skipped with an install hint, never silently passed.
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

run_surface() {
  say "surface: endpoint inventory + tenant-context invariant"
  (cd "$PKG" && bun src/enumerate-surface.ts > "$OUT/surface.json")
}

run_sast() {
  say "sast: semgrep (registry packs + vendored rules)"
  if ! have semgrep; then skip semgrep "brew install semgrep | pipx install semgrep"; return; fi
  local configs=()
  while read -r p; do [ -n "$p" ] && configs+=(--config "$p"); done < "$PKG/rules/semgrep-packs.txt"
  semgrep scan --metrics=off --quiet --sarif -o "$OUT/semgrep.sarif" \
    "${configs[@]}" --config "$PKG/rules/semgrep-local.yml" \
    "$ROOT/apps" "$ROOT/packages/data" "$ROOT/packages/ui" || true
}

run_deps() {
  say "deps: osv-scanner on bun.lock"
  if ! have osv-scanner; then skip osv-scanner "brew install osv-scanner"; return; fi
  osv-scanner scan source --format json --output "$OUT/osv.json" --lockfile "$ROOT/bun.lock" || true
}

run_secrets() {
  say "secrets: gitleaks on full history with the repo's .gitleaks.toml"
  if ! have gitleaks; then skip gitleaks "brew install gitleaks"; return; fi
  gitleaks git "$ROOT" --config "$ROOT/.gitleaks.toml" --redact --no-banner \
    --report-format json --report-path "$OUT/gitleaks.json" || true
}

run_iac() {
  say "iac: KICS with the repo's kics.config + trivy on packages/infra"
  if [ ! -d "$ROOT/packages/infra" ] || [ -z "$(ls -A "$ROOT/packages/infra" 2>/dev/null)" ]; then
    printf '  \033[33mSKIP\033[0m packages/infra is empty: run git submodule update --init\n'
    FAILED+=("infra:submodule-missing"); return
  fi
  if have kics; then
    kics scan --config "$ROOT/kics.config" -p "$ROOT" -o "$OUT" --output-name kics --report-formats json || true
  elif have docker; then
    docker run --rm -v "$ROOT:/repo" -v "$OUT:/out" checkmarx/kics:latest \
      scan --config /repo/kics.config -p /repo -o /out --output-name kics --report-formats json || true
  else
    skip kics "brew install kics, or install docker"
  fi
  if have trivy; then
    trivy config --quiet --format json --output "$OUT/trivy-iac.json" "$ROOT/packages/infra" || true
  else
    skip trivy "brew install trivy"
  fi
}

case "$STEP" in
  surface) run_surface ;;
  sast) run_sast ;;
  deps) run_deps ;;
  secrets) run_secrets ;;
  iac) run_iac ;;
  all) run_surface; run_sast; run_deps; run_secrets; run_iac ;;
  *) echo "Unknown step: $STEP"; exit 2 ;;
esac

say "results in packages/security/out/"
if [ ${#FAILED[@]} -gt 0 ]; then
  printf '  not run: %s\n' "${FAILED[*]}"
  printf '  A skipped step is NOT a pass. Install the tool and rerun.\n'
  exit 3
fi
