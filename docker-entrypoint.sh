#!/bin/sh

echo "=== NeuroCanvas Deploy ==="

# ── Step 1: Run migrations on the (new pgvector) database ──
echo "Running database migrations..."

MIGRATE_OUTPUT=$(npx prisma migrate deploy 2>&1)
MIGRATE_EXIT=$?

echo "$MIGRATE_OUTPUT"

if [ $MIGRATE_EXIT -eq 0 ]; then
  echo "Migrations applied successfully."
else
  echo "Migration deploy exited with code $MIGRATE_EXIT"

  if echo "$MIGRATE_OUTPUT" | grep -q "P3005\|P3009\|does not exist"; then
    echo "Attempting to baseline existing database..."
    npx prisma migrate resolve --applied 0_init 2>&1 || true
    npx prisma migrate deploy 2>&1
    echo "Baseline applied and migrations deployed."
  else
    echo "Migration error — check logs above. Starting server anyway..."
  fi
fi

# ── Step 2: One-time data migration from old DB (if OLD_DATABASE_URL is set) ──
if [ -n "$OLD_DATABASE_URL" ]; then
  echo ""
  echo "OLD_DATABASE_URL detected — running one-time data migration..."
  node -e "
  const { PrismaPg } = require('@prisma/adapter-pg');
  const { PrismaClient } = require('./server/generated/prisma');

  async function migrate() {
    const oldAdapter = new PrismaPg(process.env.OLD_DATABASE_URL);
    const oldDb = new PrismaClient({ adapter: oldAdapter });
    const newAdapter = new PrismaPg(process.env.DATABASE_URL);
    const newDb = new PrismaClient({ adapter: newAdapter });

    const tables = [
      ['User', 'user'],
      ['Account', 'account'],
      ['Session', 'session'],
      ['VerificationToken', 'verificationToken'],
      ['Map', 'map'],
      ['MapVersion', 'mapVersion'],
      ['SyncState', 'syncState'],
      ['MapShare', 'mapShare'],
      ['Credential', 'credential'],
      ['Template', 'template'],
    ];

    for (const [name, model] of tables) {
      try {
        const rows = await oldDb[model].findMany();
        let migrated = 0;
        for (const row of rows) {
          try {
            await newDb[model].create({ data: row });
            migrated++;
          } catch (e) {
            if (e.code !== 'P2002') console.error('  ' + name + ' insert error:', e.message.slice(0, 80));
          }
        }
        console.log(name + ': ' + migrated + '/' + rows.length + ' rows migrated');
      } catch (e) {
        console.log('Skip ' + name + ': ' + e.message.slice(0, 80));
      }
    }

    await oldDb.\$disconnect();
    await newDb.\$disconnect();
    console.log('Data migration complete!');
  }

  migrate().catch(e => { console.error('Data migration failed:', e.message); });
  " 2>&1 || echo "Data migration failed (non-fatal) — continuing..."
  echo ""
fi

# ── Step 3: Start server ──
echo "Starting application..."
exec node .output/server/index.mjs
