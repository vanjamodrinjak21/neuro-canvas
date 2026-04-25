-- Realtime collab Phase 1: Y.Doc backbone + tiered share links

-- ─── Map: Y.Doc binary + version ──────────────────────────────────────
ALTER TABLE "Map"
  ADD COLUMN "ydoc"        BYTEA,
  ADD COLUMN "ydocVersion" INTEGER NOT NULL DEFAULT 0;

-- ─── MapVersion: snapshot Y.Doc + author at each checkpoint ──────────
ALTER TABLE "MapVersion"
  ADD COLUMN "ydocBinary" BYTEA,
  ADD COLUMN "authorId"   TEXT;

-- ─── ShareRole enum + MapShare tier columns ──────────────────────────
CREATE TYPE "ShareRole" AS ENUM ('VIEWER', 'EDITOR');

ALTER TABLE "MapShare"
  ADD COLUMN "role"       "ShareRole" NOT NULL DEFAULT 'VIEWER',
  ADD COLUMN "label"      TEXT,
  ADD COLUMN "revokedAt"  TIMESTAMP(3),
  ADD COLUMN "lastUsedAt" TIMESTAMP(3);

-- Add the FK from MapShare -> Map that was previously implicit (no relation defined)
ALTER TABLE "MapShare"
  ADD CONSTRAINT "MapShare_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "Map"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── CollabSession: audit trail for who joined which map ─────────────
CREATE TABLE "CollabSession" (
  "id"       TEXT NOT NULL,
  "mapId"    TEXT NOT NULL,
  "userId"   TEXT NOT NULL,
  "shareId"  TEXT,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leftAt"   TIMESTAMP(3),

  CONSTRAINT "CollabSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CollabSession_mapId_idx"  ON "CollabSession"("mapId");
CREATE INDEX "CollabSession_userId_idx" ON "CollabSession"("userId");
