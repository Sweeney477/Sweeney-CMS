-- CreateEnum
CREATE TYPE "PublicationAction" AS ENUM ('PUBLISH', 'UNPUBLISH', 'SCHEDULE', 'UNSCHEDULE', 'AUTO_PUBLISH');

-- CreateEnum
CREATE TYPE "PublicationSource" AS ENUM ('MANUAL', 'SCHEDULER', 'SYSTEM');

-- AlterTable
ALTER TABLE "Revision" ADD COLUMN     "scheduledTimezone" TEXT;

-- AlterTable
ALTER TABLE "SiteDomain" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "RevisionPreviewToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "createdById" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RevisionPreviewToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicationLog" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "revisionId" TEXT,
    "actorId" TEXT,
    "action" "PublicationAction" NOT NULL,
    "source" "PublicationSource" NOT NULL DEFAULT 'MANUAL',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RevisionPreviewToken_token_key" ON "RevisionPreviewToken"("token");

-- CreateIndex
CREATE INDEX "RevisionPreviewToken_revisionId_revoked_expiresAt_idx" ON "RevisionPreviewToken"("revisionId", "revoked", "expiresAt");

-- CreateIndex
CREATE INDEX "RevisionPreviewToken_siteId_createdAt_idx" ON "RevisionPreviewToken"("siteId", "createdAt");

-- CreateIndex
CREATE INDEX "PublicationLog_pageId_occurredAt_idx" ON "PublicationLog"("pageId", "occurredAt");

-- CreateIndex
CREATE INDEX "PublicationLog_siteId_occurredAt_idx" ON "PublicationLog"("siteId", "occurredAt");

-- AddForeignKey
ALTER TABLE "RevisionPreviewToken" ADD CONSTRAINT "RevisionPreviewToken_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "Revision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevisionPreviewToken" ADD CONSTRAINT "RevisionPreviewToken_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevisionPreviewToken" ADD CONSTRAINT "RevisionPreviewToken_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevisionPreviewToken" ADD CONSTRAINT "RevisionPreviewToken_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicationLog" ADD CONSTRAINT "PublicationLog_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicationLog" ADD CONSTRAINT "PublicationLog_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicationLog" ADD CONSTRAINT "PublicationLog_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "Revision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicationLog" ADD CONSTRAINT "PublicationLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
