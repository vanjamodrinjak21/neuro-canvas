#!/bin/sh
set -e

echo "Running database migrations..."

# Attempt normal migration deploy
if npx prisma migrate deploy 2>&1; then
  echo "Migrations applied successfully."
else
  echo "Migration failed — attempting to baseline existing database..."
  # Mark the init migration as already applied (creates _prisma_migrations table)
  npx prisma migrate resolve --applied 0_init
  # Now deploy remaining incremental migrations
  npx prisma migrate deploy
  echo "Baseline applied and migrations deployed successfully."
fi

echo "Starting application..."
exec node .output/server/index.mjs
