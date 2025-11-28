-- Extend PageStatus enum for review and scheduling states
ALTER TYPE "PageStatus" ADD VALUE IF NOT EXISTS 'REVIEW';
ALTER TYPE "PageStatus" ADD VALUE IF NOT EXISTS 'SCHEDULED';

-- Add metadata columns to revisions for review + scheduling
ALTER TABLE "Revision"
  ADD COLUMN "reviewedById" TEXT,
  ADD COLUMN "scheduledById" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3);

-- Add block-level settings storage
ALTER TABLE "ContentBlock"
  ADD COLUMN "settings" JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Wire up new revision relations
ALTER TABLE "Revision"
  ADD CONSTRAINT "Revision_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Revision_scheduledById_fkey"
    FOREIGN KEY ("scheduledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;



