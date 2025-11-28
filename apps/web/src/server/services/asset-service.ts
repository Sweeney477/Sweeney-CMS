import "server-only";

import type { AssetType } from "@prisma/client";
import { Prisma } from "@prisma/client";
import OpenAI from "openai";

import { env } from "@/env";
import { prisma } from "@/server/db";
import {
  DEFAULT_TRANSFORM_PRESETS,
  type PersistFileOptions,
  type PersistedAsset,
  persistFile,
  generateTransforms,
  getAbsolutePath,
} from "@/server/services/asset-storage";
import type { AssetDTO } from "@/types/assets";

const assetWithRelations = Prisma.validator<Prisma.AssetDefaultArgs>()({
  include: {
    folder: true,
    tags: {
      include: {
        tag: true,
      },
    },
    transforms: true,
  },
});

export type AssetWithRelations = Prisma.AssetGetPayload<
  typeof assetWithRelations
>;

const openaiClient = env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: env.OPENAI_API_KEY })
  : null;

type ListAssetsParams = {
  siteId: string;
  folderId?: string | null;
  tagIds?: string[];
  search?: string;
  cursor?: string;
  limit?: number;
  types?: AssetType[];
};

type PaginatedResult<T> = {
  items: T[];
  nextCursor?: string;
};

function normalizeJson(value: Prisma.JsonValue | null): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function mapAssetToDTO(asset: AssetWithRelations): AssetDTO {
  return {
    id: asset.id,
    siteId: asset.siteId,
    folderId: asset.folderId,
    label: asset.label,
    fileName: asset.fileName,
    mimeType: asset.mimeType,
    fileSize: asset.fileSize,
    url: asset.url,
    cdnUrl: asset.cdnUrl,
    type: asset.type,
    width: asset.width,
    height: asset.height,
    metadata: normalizeJson(asset.metadata),
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
    altText: asset.altText,
    altTextSource: asset.altTextSource,
    transforms: asset.transforms.map((transform) => ({
      id: transform.id,
      assetId: transform.assetId,
      kind: transform.kind,
      format: transform.format,
      width: transform.width,
      height: transform.height,
      quality: transform.quality,
      status: transform.status,
      storageKey: transform.storageKey,
      url: transform.url ?? "",
      checksum: transform.checksum,
      meta: normalizeJson(transform.meta),
      createdAt: transform.createdAt.toISOString(),
    })),
    tags: asset.tags.map((tag) => ({
      tagId: tag.tagId,
      tag: {
        id: tag.tag.id,
        siteId: tag.tag.siteId,
        name: tag.tag.name,
        slug: tag.tag.slug,
        color: tag.tag.color,
        description: tag.tag.description,
      },
    })),
    folder: asset.folder
      ? {
          id: asset.folder.id,
          siteId: asset.folder.siteId,
          name: asset.folder.name,
          slug: asset.folder.slug,
          path: asset.folder.path,
          parentId: asset.folder.parentId,
        }
      : null,
  };
}

export async function listAssets(
  params: ListAssetsParams,
): Promise<PaginatedResult<AssetWithRelations>> {
  const limit = Math.min(Math.max(params.limit ?? 24, 1), 100);
  const where: Prisma.AssetWhereInput = {
    siteId: params.siteId,
  };

  if (params.folderId) {
    where.folderId = params.folderId;
  }
  if (params.search) {
    where.OR = [
      { label: { contains: params.search, mode: "insensitive" } },
      { fileName: { contains: params.search, mode: "insensitive" } },
    ];
  }
  if (params.tagIds?.length) {
    where.tags = {
      some: {
        tagId: {
          in: params.tagIds,
        },
      },
    };
  }
  if (params.types?.length) {
    where.type = { in: params.types };
  }

  const items = await prisma.asset.findMany({
    where,
    take: limit + 1,
    skip: params.cursor ? 1 : 0,
    cursor: params.cursor ? { id: params.cursor } : undefined,
    orderBy: [
      { createdAt: "desc" },
      { id: "desc" },
    ],
    include: assetWithRelations.include,
  });

  const hasNextPage = items.length > limit;
  const trimmed = hasNextPage ? items.slice(0, -1) : items;
  return {
    items: trimmed,
    nextCursor: hasNextPage ? trimmed[trimmed.length - 1]?.id : undefined,
  };
}

export async function listAssetFolders(siteId: string) {
  return prisma.assetFolder.findMany({
    where: { siteId },
    orderBy: [{ path: "asc" }],
  });
}

export async function listAssetTags(siteId: string) {
  return prisma.assetTag.findMany({
    where: { siteId },
    orderBy: [{ name: "asc" }],
  });
}

type CreateFolderInput = {
  siteId: string;
  name: string;
  parentId?: string | null;
};

export async function createFolder({
  siteId,
  name,
  parentId,
}: CreateFolderInput) {
  const parent = parentId
    ? await prisma.assetFolder.findFirst({
        where: { id: parentId, siteId },
      })
    : null;

  if (parentId && !parent) {
    throw new Error("Parent folder not found for this site.");
  }

  const slug = slugify(name);
  const basePath =
    parent?.path && parent.path !== "/"
      ? `${parent.path}/${slug}`
      : `/${slug}`;

  const existingCount = await prisma.assetFolder.count({
    where: {
      siteId,
      path: basePath,
    },
  });

  const pathWithIndex =
    existingCount === 0 ? basePath : `${basePath}-${existingCount + 1}`;

  return prisma.assetFolder.create({
    data: {
      siteId,
      name,
      slug,
      path: pathWithIndex,
      parentId: parent?.id,
    },
  });
}

type CreateTagInput = {
  siteId: string;
  name: string;
  color?: string;
  description?: string;
};

export async function createTag(input: CreateTagInput) {
  const slug = slugify(input.name);
  return prisma.assetTag.upsert({
    where: { siteId_slug: { siteId: input.siteId, slug } },
    update: {
      name: input.name,
      color: input.color,
      description: input.description,
    },
    create: {
      siteId: input.siteId,
      name: input.name,
      slug,
      color: input.color,
      description: input.description,
    },
  });
}

export type PersistedUploadInput = PersistFileOptions & {
  folderId?: string | null;
  siteId: string;
  label?: string;
  tagIds?: string[];
  altTextPrompt?: string;
  requestedByUserId?: string;
};

export async function createAssetFromUpload(
  input: PersistedUploadInput,
): Promise<AssetWithRelations> {
  let folderPath: string | undefined;
  if (input.folderId) {
    const folder = await prisma.assetFolder.findFirst({
      where: { id: input.folderId, siteId: input.siteId },
      select: { id: true, path: true },
    });
    if (!folder) {
      throw new Error("Folder not found or does not belong to this site.");
    }
    folderPath = folder.path;
  }

  const storedAsset = await persistFile({
    ...input,
    folderHint: folderPath,
  });
  const generatedTransforms = await generateTransforms(storedAsset);

  const asset = await prisma.$transaction(async (tx) => {
    const created = await tx.asset.create({
      data: {
        siteId: input.siteId,
        folderId: input.folderId,
        label: input.label ?? storedAsset.fileName,
        fileName: storedAsset.fileName,
        mimeType: storedAsset.mimeType,
        fileSize: storedAsset.fileSize,
        url: storedAsset.relativeUrl,
        storageKey: storedAsset.storageKey,
        checksum: storedAsset.checksum,
        type: detectAssetType(storedAsset.mimeType),
        width: storedAsset.width,
        height: storedAsset.height,
        transformStatus: generatedTransforms.length ? "COMPLETED" : "IDLE",
        cdnUrl: storedAsset.cdnUrl,
        metadata: {
          storageKey: storedAsset.storageKey,
          originalName: input.originalName,
        },
        altTextPrompt: input.altTextPrompt,
      },
      include: assetWithRelations.include,
    });

    if (input.tagIds?.length) {
      await tx.assetTagOnAsset.createMany({
        data: input.tagIds.map((tagId) => ({
          assetId: created.id,
          tagId,
          assignedById: input.requestedByUserId ?? undefined,
        })),
        skipDuplicates: true,
      });
    }

    if (generatedTransforms.length) {
      await tx.assetTransform.createMany({
        data: generatedTransforms.map((transform) => ({
          assetId: created.id,
          kind: resolveTransformKind(transform.preset.name),
          format: transform.format,
          width: transform.width,
          height: transform.height,
          quality: transform.preset.quality,
          status: "READY",
          storageKey: transform.storageKey,
          url: transform.relativeUrl,
          checksum: transform.checksum,
          meta: {
            preset: transform.preset,
          },
        })),
      });
    }

    return tx.asset.findUniqueOrThrow({
      where: { id: created.id },
      include: assetWithRelations.include,
    });
  });

  return asset;
}

type TransformRequest = {
  assetId: string;
  presets?: typeof DEFAULT_TRANSFORM_PRESETS;
};

export async function regenerateTransforms({
  assetId,
  presets = DEFAULT_TRANSFORM_PRESETS,
}: TransformRequest) {
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
  });

  if (!asset) {
    throw new Error("Asset not found.");
  }

  const source: PersistedAsset = {
    storageKey: asset.storageKey,
    relativeUrl: asset.url,
    cdnUrl: asset.cdnUrl ?? asset.url,
    absolutePath: getAbsolutePath(asset.storageKey),
    fileName: asset.fileName,
    mimeType: asset.mimeType,
    fileSize: asset.fileSize,
    width: asset.width ?? undefined,
    height: asset.height ?? undefined,
    checksum: asset.checksum,
  };

  const transforms = await generateTransforms(source, presets);
  await prisma.$transaction(async (tx) => {
    await tx.assetTransform.deleteMany({
      where: { assetId },
    });
    if (transforms.length) {
      await tx.assetTransform.createMany({
        data: transforms.map((transform) => ({
          assetId,
          kind: resolveTransformKind(transform.preset.name),
          format: transform.format,
          width: transform.width,
          height: transform.height,
          quality: transform.preset.quality,
          status: "READY",
          storageKey: transform.storageKey,
          url: transform.relativeUrl,
          checksum: transform.checksum,
          meta: {
            preset: transform.preset,
          },
        })),
      });
    }
    await tx.asset.update({
      where: { id: assetId },
      data: {
        transformStatus: transforms.length ? "COMPLETED" : "FAILED",
      },
    });
  });

  return transforms;
}

type AltTextResult = {
  altText: string;
  source: "ai" | "manual" | "fallback";
};

export async function generateAltTextForAsset(
  assetId: string,
  prompt = "Generate a short, descriptive alt-text for this image. Keep it under 20 words and avoid starting with 'Image of'.",
): Promise<AltTextResult> {
  if (!openaiClient) {
    throw new Error("OpenAI API key is not configured.");
  }

  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
  });

  if (!asset || !asset.mimeType.startsWith("image/")) {
    throw new Error("Alt text generation is only supported for images.");
  }

  const filePath = getAbsolutePath(asset.storageKey);
  const base64 = await readFileAsBase64(filePath);

  const response = await openaiClient.responses.create({
    model: "gpt-4o-mini",
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: prompt },
          {
            type: "input_image",
            image_url: `data:${asset.mimeType};base64,${base64}`,
            detail: "auto",
          },
        ],
      },
    ],
  });

  const altText = response.output_text?.[0]?.trim();
  if (!altText) {
    throw new Error("Failed to generate alt text for this asset.");
  }

  await prisma.asset.update({
    where: { id: assetId },
    data: {
      altText,
      altTextPrompt: prompt,
      altTextSource: "ai",
      altTextGeneratedAt: new Date(),
    },
  });

  return { altText, source: "ai" };
}

export async function updateAssetAltText(assetId: string, altText: string) {
  return prisma.asset.update({
    where: { id: assetId },
    data: {
      altText,
      altTextSource: "manual",
      altTextGeneratedAt: new Date(),
    },
  });
}

function detectAssetType(mimeType: string): AssetType {
  if (mimeType.startsWith("image/")) return "IMAGE";
  if (mimeType.startsWith("video/")) return "VIDEO";
  if (mimeType.startsWith("audio/")) return "AUDIO";
  if (
    mimeType === "application/pdf" ||
    mimeType.includes("word") ||
    mimeType.includes("excel") ||
    mimeType.includes("text")
  ) {
    return "DOCUMENT";
  }
  return "OTHER";
}

function resolveTransformKind(presetName: string) {
  if (presetName.toLowerCase().includes("thumb")) {
    return "THUMBNAIL";
  }
  if (presetName.toLowerCase().includes("webp")) {
    return "WEBP";
  }
  return "RESIZE";
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

async function readFileAsBase64(filePath: string) {
  const fs = await import("node:fs/promises");
  const buffer = await fs.readFile(filePath);
  return buffer.toString("base64");
}
