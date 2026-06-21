-- Document RAG: Document / DocumentChunk / DocumentMapLink
-- Mirrors 20260424_vector_db. Raw SQL because Prisma cannot express enums-as-types here
-- in tandem with the GENERATED tsvector column, HNSW/GIN indexes, partial-unique-WHERE,
-- or a guaranteed DESC sort hint.

-- pgvector extension (idempotent; already enabled by 20260424_vector_db)
CREATE EXTENSION IF NOT EXISTS vector;

-- ─── Enums ──────────────────────────────────────────────────────
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'QUEUED', 'PROCESSING', 'READY', 'FAILED');
CREATE TYPE "DocumentSource" AS ENUM ('UPLOAD', 'URL', 'PASTE');
CREATE TYPE "DocumentMapLinkType" AS ENUM ('GENERATED', 'ATTACHED');

-- ─── Document ───────────────────────────────────────────────────
CREATE TABLE "Document" (
    "id"           TEXT NOT NULL,
    "userId"       TEXT NOT NULL,
    "filename"     TEXT NOT NULL,
    "title"        TEXT,
    "mimeType"     TEXT NOT NULL,
    "byteSize"     INTEGER NOT NULL,
    "sha256"       CHAR(64) NOT NULL,
    "r2Key"        TEXT NOT NULL,
    "status"       "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "source"       "DocumentSource" NOT NULL DEFAULT 'UPLOAD',
    "pageCount"    INTEGER,
    "chunkCount"   INTEGER NOT NULL DEFAULT 0,
    "piiDetected"  BOOLEAN NOT NULL DEFAULT false,
    "errorMessage" TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    "deletedAt"    TIMESTAMP(3),

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- ─── DocumentChunk ──────────────────────────────────────────────
CREATE TABLE "DocumentChunk" (
    "id"           TEXT NOT NULL,
    "documentId"   TEXT NOT NULL,
    "userId"       TEXT NOT NULL,
    "chunkIndex"   INTEGER NOT NULL,
    "text"         TEXT NOT NULL,
    "tokenCount"   INTEGER NOT NULL,
    "page"         INTEGER,
    "embedding"    vector(256),
    "modelVersion" TEXT NOT NULL DEFAULT 'nomic-embed-text-v1.5',
    "dimensions"   INTEGER NOT NULL DEFAULT 256,

    CONSTRAINT "DocumentChunk_pkey" PRIMARY KEY ("id")
);

-- GENERATED tsvector column (declarative, never out of sync, never INSERTed into —
-- Postgres rejects writes to generated columns, so bulk inserts must omit "fts").
ALTER TABLE "DocumentChunk"
    ADD COLUMN "fts" tsvector
    GENERATED ALWAYS AS (to_tsvector('english', "text")) STORED;

-- ─── DocumentMapLink ────────────────────────────────────────────
CREATE TABLE "DocumentMapLink" (
    "id"         TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "mapId"      TEXT NOT NULL,
    "linkType"   "DocumentMapLinkType" NOT NULL,
    "userId"     TEXT NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentMapLink_pkey" PRIMARY KEY ("id")
);

-- ─── Document indexes ───────────────────────────────────────────
CREATE INDEX "Document_userId_idx" ON "Document"("userId");
CREATE INDEX "Document_userId_updatedAt_idx" ON "Document"("userId", "updatedAt");
CREATE INDEX "Document_userId_sha256_idx" ON "Document"("userId", "sha256");
CREATE UNIQUE INDEX "Document_r2Key_key" ON "Document"("r2Key");

-- Guaranteed DESC sort hint for list queries (Prisma sort: Desc may not emit
-- the direction on PG7; declared explicitly here so ordering is index-backed).
CREATE INDEX "Document_userId_createdAt_desc_idx"
    ON "Document"("userId", "createdAt" DESC);

-- Per-user dedup partial unique (Prisma @@unique cannot express WHERE).
-- Keyed (userId, sha256) — never sha256 alone — so user B can upload the same
-- file as user A, and re-upload is allowed after a soft-delete.
CREATE UNIQUE INDEX "Document_userId_sha256_active_key"
    ON "Document"("userId", "sha256") WHERE "deletedAt" IS NULL;

-- ─── DocumentChunk indexes ──────────────────────────────────────
CREATE UNIQUE INDEX "DocumentChunk_documentId_chunkIndex_key"
    ON "DocumentChunk"("documentId", "chunkIndex");
CREATE INDEX "DocumentChunk_documentId_idx" ON "DocumentChunk"("documentId");
CREATE INDEX "DocumentChunk_userId_idx" ON "DocumentChunk"("userId");

-- Larger maintenance memory so HNSW build doesn't page when rebuilt on a populated table.
SET maintenance_work_mem = '256MB';

-- HNSW for cosine ANN — same params as NodeEmbedding_hnsw_idx (shared plan shape).
CREATE INDEX "DocumentChunk_hnsw_idx" ON "DocumentChunk"
    USING hnsw ("embedding" vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- GIN for the full-text leg.
CREATE INDEX "DocumentChunk_fts_gin_idx" ON "DocumentChunk" USING gin ("fts");

-- ─── DocumentMapLink indexes ────────────────────────────────────
CREATE UNIQUE INDEX "DocumentMapLink_documentId_mapId_linkType_key"
    ON "DocumentMapLink"("documentId", "mapId", "linkType");
CREATE INDEX "DocumentMapLink_mapId_idx" ON "DocumentMapLink"("mapId");
CREATE INDEX "DocumentMapLink_documentId_idx" ON "DocumentMapLink"("documentId");

-- ─── Foreign keys (cascade delete) ──────────────────────────────
ALTER TABLE "Document"
    ADD CONSTRAINT "Document_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DocumentChunk"
    ADD CONSTRAINT "DocumentChunk_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "Document"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DocumentMapLink"
    ADD CONSTRAINT "DocumentMapLink_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "Document"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DocumentMapLink"
    ADD CONSTRAINT "DocumentMapLink_mapId_fkey"
    FOREIGN KEY ("mapId") REFERENCES "Map"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
