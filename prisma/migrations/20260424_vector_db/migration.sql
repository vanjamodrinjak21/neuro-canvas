-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create NodeEmbedding table
CREATE TABLE "NodeEmbedding" (
    "id"           TEXT NOT NULL,
    "mapId"        TEXT NOT NULL,
    "nodeId"       TEXT NOT NULL,
    "embedding"    vector(256),
    "contentHash"  TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL DEFAULT 'nomic-embed-text-v1.5',
    "dimensions"   INTEGER NOT NULL DEFAULT 256,
    "sourceText"   TEXT NOT NULL,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NodeEmbedding_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: one embedding per node per map
CREATE UNIQUE INDEX "NodeEmbedding_mapId_nodeId_key" ON "NodeEmbedding"("mapId", "nodeId");

-- Map lookup index
CREATE INDEX "NodeEmbedding_mapId_idx" ON "NodeEmbedding"("mapId");

-- HNSW index for approximate nearest neighbor search (cosine distance)
CREATE INDEX "NodeEmbedding_hnsw_idx" ON "NodeEmbedding"
    USING hnsw ("embedding" vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- Foreign key with cascade delete
ALTER TABLE "NodeEmbedding"
    ADD CONSTRAINT "NodeEmbedding_mapId_fkey"
    FOREIGN KEY ("mapId") REFERENCES "Map"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
