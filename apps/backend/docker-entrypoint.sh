#!/bin/sh
set -e

echo "Running database migrations…"
bun run db:migrate

echo "Seeding permissions…"
bun run db:seed

echo "Loading fixtures…"
bun run db:fixtures:demo

# Staging and release also load the e2e Testing seed so Playwright keeps
# today-relative overlap fixtures (and demo+testing_* accounts) fresh on every
# deploy. Production stays demo-only — never ship the Testing org there.
case "${APP_ENV}" in
staging|release)
  echo "Loading e2e fixtures…"
  bun run db:fixtures:e2e
  ;;
esac

echo "Starting backend…"
exec bun run start:prod
