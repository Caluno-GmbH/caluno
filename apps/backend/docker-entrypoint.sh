#!/bin/sh
set -e

echo "Running database migrations…"
bun run db:migrate

echo "Seeding permissions…"
bun run db:seed

echo "Loading fixtures…"
bun run db:fixtures:demo

echo "Starting backend…"
exec bun run start:prod
