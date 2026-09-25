#!/bin/sh
# Container start: apply migrations, load the sample data (idempotent), then serve the API.
set -e

if [ -z "$JWT_SECRET" ]; then
  # Never ship a signing key in the repository. A random one per start is fine for a local
  # demo; sessions simply end when the container restarts.
  JWT_SECRET=$(node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))")
  export JWT_SECRET
  echo "JWT_SECRET not set: generated a random key for this run."
fi

./node_modules/.bin/prisma migrate deploy --config prisma7.config.ts

if [ "${SEED_ON_START:-true}" = "true" ]; then
  # Uses the same CSV importer as real spreadsheet imports. Re-running keeps existing
  # records, passwords, quiz dates and attempts.
  node dist/data/cli.js seed
fi

exec node dist/main.js
