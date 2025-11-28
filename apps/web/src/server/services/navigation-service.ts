import "server-only";

import { prisma } from "@/server/db";

export type NavigationTreeItem = {
  id: string;
  label: string;
  url: string;
  openInNew: boolean;
  type: "INTERNAL" | "EXTERNAL";
  pageId: string | null;
  pageTitle: string | null;
  pagePath: string | null;
  parentId: string | null;
  sortOrder: number;
  children: NavigationTreeItem[];
};

export async function getNavigationMenu(options: {
  siteId: string;
  placement?: "PRIMARY" | "SECONDARY" | "FOOTER" | "CUSTOM";
}) {
  const menu = await prisma.navigationMenu.findFirst({
    where: {
      siteId: options.siteId,
      placement: options.placement ?? "PRIMARY",
    },
    include: {
      items: {
        orderBy: { sortOrder: "asc" },
        include: {
          page: {
            select: {
              id: true,
              title: true,
              path: true,
            },
          },
        },
      },
    },
  });

  if (!menu) {
    return null;
  }

  const itemsByParent = new Map<string | null, NavigationTreeItem[]>();

  for (const item of menu.items) {
    const page = item.page;
    const pagePath = page?.path ?? null;
    const node: NavigationTreeItem = {
      id: item.id,
      label: item.label,
      url: pagePath ?? item.url,
      openInNew: item.openInNew,
      type: page ? "INTERNAL" : "EXTERNAL",
      pageId: page?.id ?? null,
      pageTitle: page?.title ?? null,
      pagePath,
      parentId: item.parentId ?? null,
      sortOrder: item.sortOrder,
      children: [],
    };

    const parentKey = item.parentId ?? null;
    const siblings = itemsByParent.get(parentKey) ?? [];
    siblings.push(node);
    itemsByParent.set(parentKey, siblings);
  }

  for (const [parentId, siblings] of itemsByParent.entries()) {
    if (!parentId) {
      continue;
    }

    const parent = menu.items.find((item) => item.id === parentId);
    if (!parent) {
      continue;
    }

    const parentNode = findNode(parent.id, itemsByParent.get(null) ?? []);
    if (parentNode) {
      parentNode.children = siblings;
    }
  }

  return {
    id: menu.id,
    name: menu.name,
    placement: menu.placement,
    items: itemsByParent.get(null) ?? [],
  };
}

function findNode(id: string, nodes: NavigationTreeItem[]): NavigationTreeItem | null {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }

    const child = findNode(id, node.children);
    if (child) {
      return child;
    }
  }

  return null;
}


