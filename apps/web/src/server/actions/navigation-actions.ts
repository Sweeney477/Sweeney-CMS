'use server';

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/server/db";

const NAVIGATION_PATH = "/admin/navigation";

const linkTypeSchema = z.enum(["INTERNAL", "EXTERNAL"]).default("EXTERNAL");
const booleanStringSchema = z
  .union([z.literal("true"), z.literal("false")])
  .optional()
  .transform((value) => value === "true");

const navItemContentSchema = z
  .object({
    label: z.string().min(1),
    linkType: linkTypeSchema,
    pageId: z.preprocess(
      (value) => {
        if (typeof value !== "string") {
          return null;
        }
        const trimmed = value.trim();
        return trimmed ? trimmed : null;
      },
      z.string().cuid().nullable(),
    ),
    url: z
      .string()
      .optional()
      .transform((value) => value?.trim() || null),
    openInNew: booleanStringSchema,
  })
  .refine(
    (data) => (data.linkType === "INTERNAL" ? Boolean(data.pageId) : true),
    {
      message: "Select a page to link to.",
      path: ["pageId"],
    },
  )
  .refine(
    (data) => (data.linkType === "EXTERNAL" ? Boolean(data.url) : true),
    {
      message: "Enter a URL for the navigation item.",
      path: ["url"],
    },
  );

const createNavItemSchema = navItemContentSchema.extend({
  menuId: z.string().cuid(),
  parentId: z.preprocess(
    (value) => {
      if (typeof value !== "string") {
        return null;
      }
      const trimmed = value.trim();
      return trimmed ? trimmed : null;
    },
    z.string().cuid().nullable(),
  ),
});

const updateNavItemSchema = navItemContentSchema.extend({
  itemId: z.string().cuid(),
});

const deleteNavItemSchema = z.object({
  itemId: z.string().cuid(),
});

const reorderTreeSchema = z.object({
  menuId: z.string().cuid(),
  tree: z.string().transform((value, ctx): NavigationTreePayload[] => {
    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Invalid tree payload.",
        });
        return [];
      }
      return parsed as NavigationTreePayload[];
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid tree payload.",
      });
      return [];
    }
  }),
});

type NavigationTreePayload = {
  id: string;
  children?: NavigationTreePayload[];
};

type ActionResult =
  | { success: true }
  | { success: false; error: string; issues?: Record<string, string[]> };

export async function createNavigationItemAction(
  formData: FormData,
): Promise<ActionResult> {
  const raw = Object.fromEntries(formData);
  const parsed = createNavItemSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      issues: parsed.error.flatten().fieldErrors,
    };
  }

  const { menuId, parentId, ...content } = parsed.data;
  const menu = await prisma.navigationMenu.findUnique({
    where: { id: menuId },
    select: { id: true, siteId: true },
  });

  if (!menu) {
    return { success: false, error: "Menu not found." };
  }

  if (parentId) {
    const parent = await prisma.navigationItem.findFirst({
      where: { id: parentId, menuId },
    });

    if (!parent) {
      return {
        success: false,
        error: "Parent navigation item could not be found.",
      };
    }
  }

  const target = await resolveLinkTarget(content, menu.siteId);
  if ("error" in target) {
    return target;
  }

  const siblingCount = await prisma.navigationItem.count({
    where: { menuId, parentId },
  });

  await prisma.navigationItem.create({
    data: {
      menuId,
      parentId,
      label: content.label,
      openInNew: content.openInNew,
      sortOrder: siblingCount,
      pageId: target.pageId,
      url: target.url,
    },
  });

  revalidatePath(NAVIGATION_PATH);
  return { success: true };
}

export async function updateNavigationItemAction(
  formData: FormData,
): Promise<ActionResult> {
  const raw = Object.fromEntries(formData);
  const parsed = updateNavItemSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      issues: parsed.error.flatten().fieldErrors,
    };
  }

  const { itemId, ...content } = parsed.data;
  const existing = await prisma.navigationItem.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      menuId: true,
      menu: {
        select: {
          siteId: true,
        },
      },
    },
  });

  if (!existing) {
    return { success: false, error: "Navigation item not found." };
  }

  const target = await resolveLinkTarget(content, existing.menu.siteId);
  if ("error" in target) {
    return target;
  }

  await prisma.navigationItem.update({
    where: { id: itemId },
    data: {
      label: content.label,
      openInNew: content.openInNew,
      url: target.url,
      pageId: target.pageId,
    },
  });

  revalidatePath(NAVIGATION_PATH);
  return { success: true };
}

export async function deleteNavigationItemAction(
  formData: FormData,
): Promise<ActionResult> {
  const raw = Object.fromEntries(formData);
  const parsed = deleteNavItemSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      issues: parsed.error.flatten().fieldErrors,
    };
  }

  const { itemId } = parsed.data;
  const existing = await prisma.navigationItem.findUnique({
    where: { id: itemId },
    select: { id: true },
  });

  if (!existing) {
    return { success: false, error: "Navigation item not found." };
  }

  await prisma.navigationItem.delete({
    where: { id: itemId },
  });

  revalidatePath(NAVIGATION_PATH);
  return { success: true };
}

export async function reorderNavigationItemsAction(
  formData: FormData,
): Promise<ActionResult> {
  const raw = Object.fromEntries(formData);
  const parsed = reorderTreeSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      issues: parsed.error.flatten().fieldErrors,
    };
  }

  const { menuId, tree } = parsed.data;
  const menu = await prisma.navigationMenu.findUnique({
    where: { id: menuId },
    select: { id: true },
  });

  if (!menu) {
    return { success: false, error: "Menu not found." };
  }

  const existingItems = await prisma.navigationItem.findMany({
    where: { menuId },
    select: { id: true },
  });
  const existingIds = new Set(existingItems.map((item) => item.id));

  const updates = flattenTreePayload(tree);

  if (existingIds.size !== updates.length) {
    return {
      success: false,
      error:
        "Tree update mismatch. Refresh the page to ensure you have the latest menu.",
    };
  }

  for (const update of updates) {
    if (!existingIds.has(update.id)) {
      return {
        success: false,
        error: "One or more navigation items are invalid for this menu.",
      };
    }
  }

  if (!updates.length && existingIds.size) {
    // All items were removed manually without deleting in the UI.
    return {
      success: false,
      error: "Cannot remove items via ordering. Delete them instead.",
    };
  }

  await prisma.$transaction(
    updates.map(({ id, parentId, sortOrder }) =>
      prisma.navigationItem.update({
        where: { id },
        data: {
          parentId,
          sortOrder,
        },
      }),
    ),
  );

  revalidatePath(NAVIGATION_PATH);
  return { success: true };
}

type LinkTargetResult =
  | { pageId: string | null; url: string }
  | { success: false; error: string };

async function resolveLinkTarget(
  content: z.infer<typeof navItemContentSchema>,
  siteId: string,
): Promise<LinkTargetResult> {
  if (content.linkType === "INTERNAL") {
    if (!content.pageId) {
      return { success: false, error: "Select a page to link to." };
    }

    const page = await prisma.page.findFirst({
      where: {
        id: content.pageId,
        siteId,
      },
      select: { id: true, path: true },
    });

    if (!page) {
      return {
        success: false,
        error: "The selected page no longer exists for this site.",
      };
    }

    return {
      pageId: page.id,
      url: page.path,
    };
  }

  if (!content.url) {
    return { success: false, error: "Enter a target URL." };
  }

  return {
    pageId: null,
    url: content.url,
  };
}

type TreeUpdate = {
  id: string;
  parentId: string | null;
  sortOrder: number;
};

function flattenTreePayload(tree: NavigationTreePayload[]): TreeUpdate[] {
  const updates: TreeUpdate[] = [];

  function walk(nodes: NavigationTreePayload[], parentId: string | null) {
    nodes.forEach((node, index) => {
      updates.push({
        id: node.id,
        parentId,
        sortOrder: index,
      });
      if (node.children?.length) {
        walk(node.children, node.id);
      }
    });
  }

  walk(tree, null);
  return updates;
}
