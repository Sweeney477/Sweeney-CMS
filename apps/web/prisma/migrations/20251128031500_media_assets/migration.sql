-- CreateEnum
CREATE TYPE "AssetProcessingStatus" AS ENUM ('IDLE', 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "AssetTransformStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "AssetTransformKind" AS ENUM ('ORIGINAL', 'RESIZE', 'WEBP', 'THUMBNAIL', 'CUSTOM');

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "altTextGeneratedAt" TIMESTAMP(3),
ADD COLUMN     "altTextPrompt" TEXT,
ADD COLUMN     "altTextSource" TEXT,
ADD COLUMN     "cdnUrl" TEXT,
ADD COLUMN     "checksum" TEXT NOT NULL,
ADD COLUMN     "fileName" TEXT NOT NULL,
ADD COLUMN     "fileSize" INTEGER NOT NULL,
ADD COLUMN     "folderId" TEXT,
ADD COLUMN     "mimeType" TEXT NOT NULL,
ADD COLUMN     "storageKey" TEXT NOT NULL,
ADD COLUMN     "transformStatus" "AssetProcessingStatus" NOT NULL DEFAULT 'IDLE';

-- CreateTable
CREATE TABLE "AssetFolder" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetTag" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "color" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetTagOnAsset" (
    "assetId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "assignedById" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetTagOnAsset_pkey" PRIMARY KEY ("assetId","tagId")
);

-- CreateTable
CREATE TABLE "AssetTransform" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "kind" "AssetTransformKind" NOT NULL DEFAULT 'RESIZE',
    "format" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "quality" INTEGER,
    "status" "AssetTransformStatus" NOT NULL DEFAULT 'PENDING',
    "storageKey" TEXT NOT NULL,
    "url" TEXT,
    "checksum" TEXT,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetTransform_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssetFolder_siteId_parentId_idx" ON "AssetFolder"("siteId", "parentId");

-- CreateIndex
CREATE INDEX "AssetFolder_siteId_slug_idx" ON "AssetFolder"("siteId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "AssetFolder_siteId_path_key" ON "AssetFolder"("siteId", "path");

-- CreateIndex
CREATE INDEX "AssetTag_siteId_name_idx" ON "AssetTag"("siteId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "AssetTag_siteId_slug_key" ON "AssetTag"("siteId", "slug");

-- CreateIndex
CREATE INDEX "AssetTagOnAsset_tagId_assetId_idx" ON "AssetTagOnAsset"("tagId", "assetId");

-- CreateIndex
CREATE INDEX "AssetTransform_assetId_kind_width_height_idx" ON "AssetTransform"("assetId", "kind", "width", "height");

-- CreateIndex
CREATE UNIQUE INDEX "AssetTransform_assetId_storageKey_key" ON "AssetTransform"("assetId", "storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_storageKey_key" ON "Asset"("storageKey");

-- CreateIndex
CREATE INDEX "Asset_siteId_folderId_createdAt_idx" ON "Asset"("siteId", "folderId", "createdAt");

-- CreateIndex
CREATE INDEX "Asset_siteId_label_idx" ON "Asset"("siteId", "label");

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "AssetFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetFolder" ADD CONSTRAINT "AssetFolder_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetFolder" ADD CONSTRAINT "AssetFolder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "AssetFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetTag" ADD CONSTRAINT "AssetTag_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetTagOnAsset" ADD CONSTRAINT "AssetTagOnAsset_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetTagOnAsset" ADD CONSTRAINT "AssetTagOnAsset_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "AssetTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetTagOnAsset" ADD CONSTRAINT "AssetTagOnAsset_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetTransform" ADD CONSTRAINT "AssetTransform_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

