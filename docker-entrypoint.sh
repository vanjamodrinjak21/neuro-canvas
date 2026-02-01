#!/bin/sh

echo "Running database migrations..."
npx prisma db push --skip-generate --accept-data-loss || echo "Migration skipped (may already be synced)"

echo "Starting application..."
exec node .output/server/index.mjs
