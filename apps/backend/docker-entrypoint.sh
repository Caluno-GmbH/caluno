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

# The production-sized load-test environment (packages/load-test). Terms are
# published before the seed because the seed accepts the latest published
# version on every account; the app's own auto-publish runs only after boot.
if [ "${APP_ENV}" = "load-test" ]; then
  echo "Publishing terms…"
  bun run terms:publish
  echo "Loading load-test fixtures…"
  bun run db:fixtures:load-test
fi

echo "Starting backend…"
exec bun run start:prod
