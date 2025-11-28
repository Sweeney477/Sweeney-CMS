'use server';

import { z } from "zod";

import { auth } from "@/server/auth";
import {
  createFolder,
  createTag,
  generateAltTextForAsset,
  listAssetFolders,
  listAssetTags,
  listAssets,
  regenerateTransforms,
  updateAssetAltText,
} from "@/server/services/asset-service";

type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string; issues?: Record<string, string[]> };

const listSchema = z.object({
  siteId: z.string().cuid(),
  folderId: z.string().cuid().optional(),
  tagIds: z.array(z.string().cuid()).optional(),
  search: z.string().optional(),
  cursor: z.string().cuid().optional(),
  limit: z.number().min(1).max(100).optional(),
});

export async function listAssetsAction(
  input: z.infer<typeof listSchema>,
): Promise<ActionResult<Awaited<ReturnType<typeof listAssets>>>> {
  await requireAuth();
  const parsed = listSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Invalid request",
      issues: parsed.error.flatten().fieldErrors,
    };
  }

  const payload = await listAssets(parsed.data);
  return { success: true, data: payload };
}

const folderSchema = z.object({
  siteId: z.string().cuid(),
  name: z.string().min(1),
  parentId: z.string().cuid().optional(),
});

export async function createFolderAction(
  input: z.infer<typeof folderSchema>,
): Promise<ActionResult> {
  await requireAuth();
  const parsed = folderSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Invalid folder payload",
      issues: parsed.error.flatten().fieldErrors,
    };
  }

  await createFolder(parsed.data);
  return { success: true };
}

export async function listFoldersAction(siteId: string) {
  await requireAuth();
  return listAssetFolders(siteId);
}

const tagSchema = z.object({
  siteId: z.string().cuid(),
  name: z.string().min(1),
  color: z
    .string()
    .regex(/^#?[0-9a-fA-F]{6}$/)
    .optional(),
  description: z.string().max(120).optional(),
});

export async function createTagAction(
  input: z.infer<typeof tagSchema>,
): Promise<ActionResult> {
  await requireAuth();
  const parsed = tagSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Invalid tag payload",
      issues: parsed.error.flatten().fieldErrors,
    };
  }

  await createTag(parsed.data);
  return { success: true };
}

export async function listTagsAction(siteId: string) {
  await requireAuth();
  return listAssetTags(siteId);
}

const altTextSchema = z.object({
  assetId: z.string().cuid(),
  prompt: z.string().min(8).max(400).optional(),
});

export async function generateAltTextAction(
  input: z.infer<typeof altTextSchema>,
): Promise<ActionResult<{ altText: string }>> {
  await requireAuth();
  const parsed = altTextSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Invalid prompt",
      issues: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const result = await generateAltTextForAsset(
      parsed.data.assetId,
      parsed.data.prompt,
    );
    return { success: true, data: { altText: result.altText } };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to generate alt text at this time.",
    };
  }
}

const manualAltTextSchema = z.object({
  assetId: z.string().cuid(),
  altText: z.string().max(280),
});

export async function saveAltTextAction(
  input: z.infer<typeof manualAltTextSchema>,
): Promise<ActionResult> {
  await requireAuth();
  const parsed = manualAltTextSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Invalid alt text",
      issues: parsed.error.flatten().fieldErrors,
    };
  }

  await updateAssetAltText(parsed.data.assetId, parsed.data.altText);
  return { success: true };
}

const transformSchema = z.object({
  assetId: z.string().cuid(),
});

export async function regenerateTransformsAction(
  input: z.infer<typeof transformSchema>,
): Promise<ActionResult> {
  await requireAuth();
  const parsed = transformSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Invalid asset id",
      issues: parsed.error.flatten().fieldErrors,
    };
  }

  await regenerateTransforms({ assetId: parsed.data.assetId });
  return { success: true };
}

async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("You must be signed in to manage assets.");
  }
}



