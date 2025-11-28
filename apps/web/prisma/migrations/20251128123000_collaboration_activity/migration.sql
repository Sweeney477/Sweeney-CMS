-- CreateEnum
CREATE TYPE "RevisionReviewDecision" AS ENUM ('APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "BlockCommentStatus" AS ENUM ('OPEN', 'RESOLVED');

-- AlterEnum
BEGIN;
CREATE TYPE "ActivityKind_new" AS ENUM ('REVISION_SUBMITTED', 'REVISION_APPROVED', 'REVISION_REJECTED', 'REVISION_RETURNED', 'REVISION_SCHEDULED', 'REVISION_UNSCHEDULED', 'BLOCK_COMMENT_CREATED', 'BLOCK_COMMENT_REPLIED', 'BLOCK_COMMENT_RESOLVED', 'BLOCK_COMMENT_REOPENED', 'PUBLICATION_EVENT');
ALTER TABLE "ActivityEvent" ALTER COLUMN "kind" TYPE "ActivityKind_new" USING ("kind"::text::"ActivityKind_new");
ALTER TYPE "ActivityKind" RENAME TO "ActivityKind_old";
ALTER TYPE "ActivityKind_new" RENAME TO "ActivityKind";
DROP TYPE "ActivityKind_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "ActivityEvent" DROP CONSTRAINT "ActivityEvent_pageId_fkey";

-- DropForeignKey
ALTER TABLE "BlockComment" DROP CONSTRAINT "BlockComment_authorId_fkey";

-- DropForeignKey
ALTER TABLE "BlockCommentThread" DROP CONSTRAINT "BlockCommentThread_createdById_fkey";

-- DropForeignKey
ALTER TABLE "BlockCommentThread" DROP CONSTRAINT "BlockCommentThread_revisionId_fkey";

-- DropForeignKey
ALTER TABLE "ReviewEvent" DROP CONSTRAINT "ReviewEvent_actorId_fkey";

-- DropForeignKey
ALTER TABLE "ReviewEvent" DROP CONSTRAINT "ReviewEvent_pageId_fkey";

-- DropForeignKey
ALTER TABLE "ReviewEvent" DROP CONSTRAINT "ReviewEvent_revisionId_fkey";

-- DropForeignKey
ALTER TABLE "ReviewEvent" DROP CONSTRAINT "ReviewEvent_siteId_fkey";

-- DropIndex
DROP INDEX "ContentBlock_revisionId_referenceKey_key";

-- AlterTable
ALTER TABLE "ActivityEvent" ALTER COLUMN "pageId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "BlockComment" ALTER COLUMN "authorId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "BlockCommentThread" ADD COLUMN "blockAnchor" TEXT;
UPDATE "BlockCommentThread" SET "blockAnchor" = "blockReferenceKey"::text;
ALTER TABLE "BlockCommentThread" ALTER COLUMN "blockAnchor" SET NOT NULL;
ALTER TABLE "BlockCommentThread" DROP COLUMN "blockReferenceKey";
ALTER TABLE "BlockCommentThread" ALTER COLUMN "revisionId" DROP NOT NULL;
ALTER TABLE "BlockCommentThread" ALTER COLUMN "createdById" DROP NOT NULL;
ALTER TABLE "BlockCommentThread" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "BlockCommentThread"
  ALTER COLUMN "status" TYPE "BlockCommentStatus" USING ("status"::text::"BlockCommentStatus");
ALTER TABLE "BlockCommentThread" ALTER COLUMN "status" SET DEFAULT 'OPEN';

-- AlterTable
ALTER TABLE "ContentBlock" ADD COLUMN "anchor" TEXT;
UPDATE "ContentBlock" SET "anchor" = COALESCE("referenceKey"::text, gen_random_uuid()::text);
ALTER TABLE "ContentBlock" ALTER COLUMN "anchor" SET NOT NULL;
ALTER TABLE "ContentBlock" ALTER COLUMN "anchor" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "ContentBlock" DROP COLUMN "referenceKey";

-- CreateTable
CREATE TABLE "RevisionReview" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "decision" "RevisionReviewDecision" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevisionReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RevisionReview_pageId_createdAt_idx" ON "RevisionReview"("pageId", "createdAt");

-- CreateIndex
CREATE INDEX "RevisionReview_revisionId_createdAt_idx" ON "RevisionReview"("revisionId", "createdAt");

-- CreateIndex
CREATE INDEX "RevisionReview_siteId_createdAt_idx" ON "RevisionReview"("siteId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityEvent_revisionId_occurredAt_idx" ON "ActivityEvent"("revisionId", "occurredAt");

-- CreateIndex
CREATE INDEX "BlockCommentThread_pageId_blockAnchor_idx" ON "BlockCommentThread"("pageId", "blockAnchor");

-- CreateIndex
CREATE INDEX "BlockCommentThread_pageId_revisionId_status_idx" ON "BlockCommentThread"("pageId", "revisionId", "status");

-- CreateIndex
CREATE INDEX "ContentBlock_pageId_anchor_idx" ON "ContentBlock"("pageId", "anchor");

-- CreateIndex
CREATE UNIQUE INDEX "ContentBlock_revisionId_anchor_key" ON "ContentBlock"("revisionId", "anchor");

-- Seed existing review decisions into the new table before dropping legacy data
INSERT INTO "RevisionReview" ("id", "siteId", "pageId", "revisionId", "reviewerId", "decision", "comment", "createdAt")
SELECT
  "id",
  "siteId",
  "pageId",
  "revisionId",
  "actorId",
  CASE
    WHEN "type" = 'APPROVED' THEN 'APPROVED'::"RevisionReviewDecision"
    WHEN "type" = 'REJECTED' THEN 'REJECTED'::"RevisionReviewDecision"
  END,
  "note",
  "createdAt"
FROM "ReviewEvent"
WHERE "type" IN ('APPROVED', 'REJECTED');

-- Drop legacy review artifacts
DROP TABLE "ReviewEvent";
DROP TYPE "CommentStatus";
DROP TYPE "ReviewEventType";

-- AddForeignKey
ALTER TABLE "RevisionReview" ADD CONSTRAINT "RevisionReview_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevisionReview" ADD CONSTRAINT "RevisionReview_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevisionReview" ADD CONSTRAINT "RevisionReview_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "Revision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevisionReview" ADD CONSTRAINT "RevisionReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockCommentThread" ADD CONSTRAINT "BlockCommentThread_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "Revision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockCommentThread" ADD CONSTRAINT "BlockCommentThread_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockComment" ADD CONSTRAINT "BlockComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE SET NULL ON UPDATE CASCADE;

