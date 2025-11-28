-- CreateEnum
CREATE TYPE "ReviewEventType" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED');

-- CreateEnum
CREATE TYPE "CommentStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ActivityKind" AS ENUM ('PAGE_CREATED', 'REVISION_SUBMITTED', 'REVISION_APPROVED', 'REVISION_CHANGES_REQUESTED', 'REVISION_PUBLISHED', 'REVISION_SCHEDULED', 'REVISION_UNSCHEDULED', 'COMMENT_ADDED', 'COMMENT_RESOLVED', 'COMMENT_REOPENED');

-- AlterTable
ALTER TABLE "ContentBlock" ADD COLUMN     "referenceKey" UUID NOT NULL DEFAULT gen_random_uuid();

-- CreateTable
CREATE TABLE "ReviewEvent" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" "ReviewEventType" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockCommentThread" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "blockReferenceKey" UUID NOT NULL,
    "status" "CommentStatus" NOT NULL DEFAULT 'OPEN',
    "createdById" TEXT NOT NULL,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlockCommentThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockComment" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlockComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityEvent" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "revisionId" TEXT,
    "actorId" TEXT,
    "kind" "ActivityKind" NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "commentThreadId" TEXT,
    "commentId" TEXT,

    CONSTRAINT "ActivityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReviewEvent_pageId_createdAt_idx" ON "ReviewEvent"("pageId", "createdAt");

-- CreateIndex
CREATE INDEX "ReviewEvent_revisionId_createdAt_idx" ON "ReviewEvent"("revisionId", "createdAt");

-- CreateIndex
CREATE INDEX "ReviewEvent_siteId_createdAt_idx" ON "ReviewEvent"("siteId", "createdAt");

-- CreateIndex
CREATE INDEX "BlockCommentThread_pageId_blockReferenceKey_idx" ON "BlockCommentThread"("pageId", "blockReferenceKey");

-- CreateIndex
CREATE INDEX "BlockCommentThread_pageId_revisionId_status_idx" ON "BlockCommentThread"("pageId", "revisionId", "status");

-- CreateIndex
CREATE INDEX "BlockCommentThread_siteId_createdAt_idx" ON "BlockCommentThread"("siteId", "createdAt");

-- CreateIndex
CREATE INDEX "BlockComment_threadId_createdAt_idx" ON "BlockComment"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityEvent_pageId_occurredAt_idx" ON "ActivityEvent"("pageId", "occurredAt");

-- CreateIndex
CREATE INDEX "ActivityEvent_siteId_occurredAt_idx" ON "ActivityEvent"("siteId", "occurredAt");

-- CreateIndex
CREATE INDEX "ActivityEvent_revisionId_occurredAt_idx" ON "ActivityEvent"("revisionId", "occurredAt");

-- CreateIndex
CREATE INDEX "ContentBlock_pageId_revisionId_idx" ON "ContentBlock"("pageId", "revisionId");

-- CreateIndex
CREATE INDEX "ContentBlock_pageId_referenceKey_idx" ON "ContentBlock"("pageId", "referenceKey");

-- CreateIndex
CREATE UNIQUE INDEX "ContentBlock_revisionId_referenceKey_key" ON "ContentBlock"("revisionId", "referenceKey");

-- AddForeignKey
ALTER TABLE "ReviewEvent" ADD CONSTRAINT "ReviewEvent_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewEvent" ADD CONSTRAINT "ReviewEvent_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewEvent" ADD CONSTRAINT "ReviewEvent_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "Revision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewEvent" ADD CONSTRAINT "ReviewEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockCommentThread" ADD CONSTRAINT "BlockCommentThread_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockCommentThread" ADD CONSTRAINT "BlockCommentThread_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockCommentThread" ADD CONSTRAINT "BlockCommentThread_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "Revision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockCommentThread" ADD CONSTRAINT "BlockCommentThread_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockCommentThread" ADD CONSTRAINT "BlockCommentThread_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockComment" ADD CONSTRAINT "BlockComment_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "BlockCommentThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockComment" ADD CONSTRAINT "BlockComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "Revision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_commentThreadId_fkey" FOREIGN KEY ("commentThreadId") REFERENCES "BlockCommentThread"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "BlockComment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

