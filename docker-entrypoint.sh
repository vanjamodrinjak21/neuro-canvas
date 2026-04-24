#!/bin/sh

echo "Running database migrations..."

# Run migrations and capture output
MIGRATE_OUTPUT=$(npx prisma migrate deploy 2>&1)
MIGRATE_EXIT=$?

echo "$MIGRATE_OUTPUT"

if [ $MIGRATE_EXIT -eq 0 ]; then
  echo "Migrations applied successfully."
else
  echo "Migration deploy exited with code $MIGRATE_EXIT"

  # Check if the failure is due to missing _prisma_migrations table (fresh DB)
  if echo "$MIGRATE_OUTPUT" | grep -q "P3005\|P3009\|does not exist"; then
    echo "Attempting to baseline existing database..."
    npx prisma migrate resolve --applied 0_init 2>&1 || true
    npx prisma migrate deploy 2>&1
    echo "Baseline applied and migrations deployed."
  else
    echo "Migration error — check logs above. Starting server anyway..."
  fi
fi

echo "Starting application..."
exec node .output/server/index.mjs
