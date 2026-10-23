#!/bin/sh
set -e

echo "Running database migrations…"
bun run db:migrate

echo "Seeding permissions…"
bun run db:seed

echo "Loading fixtures…"
if ! bun run db:fixtures:demo; then
  echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
  echo "WARNING: demo fixtures failed — continuing startup without them."
  echo "The demo dataset may be incomplete or stale; see the error above."
  echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
fi

# Staging and release also load the e2e Testing seed so Playwright keeps
# today-relative overlap fixtures (and demo+testing_* accounts) fresh on every
# deploy. Production stays demo-only — never ship the Testing org there.
case "${APP_ENV}" in
staging|release)
  echo "Loading e2e fixtures…"
  bun run db:fixtures:e2e
  ;;
esac

echo "Re-rendering countersigned PDFs…"
bun run scripts/rerender-signer-names.ts --apply || echo "Re-rendering countersigned PDFs failed"

echo "Starting backend…"
exec bun run start:prod
