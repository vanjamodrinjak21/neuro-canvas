-- Comments / Annotations primitive (collab follow-up)
-- 1) Extend ShareRole enum with COMMENTER (between VIEWER and EDITOR semantically)
-- 2) New Comment + CommentMention tables anchored to map (and optionally to a node)

-- ─── ShareRole: add COMMENTER ──────────────────────────────────────
ALTER TYPE "ShareRole" ADD VALUE IF NOT EXISTS 'COMMENTER';

-- ─── Comment: thread-grouped messages anchored to a map / node / point ─
CREATE TABLE "Comment" (
  "id"           TEXT NOT NULL,
  "mapId"        TEXT NOT NULL,
  "threadId"     TEXT NOT NULL,
  "authorId"     TEXT NOT NULL,
  "authorName"   TEXT NOT NULL,
  "authorColor"  TEXT NOT NULL,
  "body"         TEXT NOT NULL,
  "anchorNodeId" TEXT,
  "anchorX"      DOUBLE PRECISION,
  "anchorY"      DOUBLE PRECISION,
  "resolvedAt"   TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Comment_mapId_idx"        ON "Comment"("mapId");
CREATE INDEX "Comment_threadId_idx"     ON "Comment"("threadId");
CREATE INDEX "Comment_anchorNodeId_idx" ON "Comment"("anchorNodeId");

ALTER TABLE "Comment"
  ADD CONSTRAINT "Comment_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "Map"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── CommentMention: per-mention notification record ────────────────
CREATE TABLE "CommentMention" (
  "id"              TEXT NOT NULL,
  "commentId"       TEXT NOT NULL,
  "mentionedUserId" TEXT NOT NULL,
  "notifiedAt"      TIMESTAMP(3),

  CONSTRAINT "CommentMention_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommentMention_commentId_mentionedUserId_key"
  ON "CommentMention"("commentId", "mentionedUserId");

ALTER TABLE "CommentMention"
  ADD CONSTRAINT "CommentMention_commentId_fkey"
  FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
