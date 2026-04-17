-- Reset all data (one-time migration)
-- Truncates all tables in dependency order to start fresh.
-- This migration runs once and is tracked by Prisma — it will NOT re-run on future deploys.

TRUNCATE TABLE
  "MapVersion",
  "MapShare",
  "SyncState",
  "Map",
  "Credential",
  "Template",
  "Session",
  "Account",
  "VerificationToken",
  "User"
CASCADE;
