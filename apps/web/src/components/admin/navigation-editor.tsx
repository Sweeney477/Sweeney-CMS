"use client";

import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { NavigationPlacement } from "@prisma/client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  createNavigationItemAction,
  deleteNavigationItemAction,
  reorderNavigationItemsAction,
  updateNavigationItemAction,
} from "@/server/actions/navigation-actions";
import type { NavigationTreeItem } from "@/server/services/navigation-service";

type PageOption = {
  id: string;
  title: string;
  path: string;
};

type Props = {
  menuId: string;
  items: NavigationTreeItem[];
  pages: PageOption[];
  placement: NavigationPlacement;
};

type FlattenedNavItem = {
  id: string;
  depth: number;
  parentId: string | null;
  item: NavigationTreeItem;
};

type StatusMessage =
  | { type: "success" | "error"; message: string }
  | null;

type NavigationTreePayload = {
  id: string;
  children?: NavigationTreePayload[];
};

const indentationWidth = 28;

export function NavigationEditor({ menuId, items, pages, placement }: Props) {
  const router = useRouter();
  const [tree, setTree] = useState<NavigationTreeItem[]>(items);
  const [structureDirty, setStructureDirty] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusMessage>(null);
  const [createLinkType, setCreateLinkType] = useState<"INTERNAL" | "EXTERNAL">(
    "EXTERNAL",
  );
  const [editLinkType, setEditLinkType] = useState<"INTERNAL" | "EXTERNAL">(
    "EXTERNAL",
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [offsetLeft, setOffsetLeft] = useState(0);

  const [isCreating, startCreate] = useTransition();
  const [isUpdating, startUpdate] = useTransition();
  const [isDeleting, startDelete] = useTransition();
  const [isSavingStructure, startSaveStructure] = useTransition();
  const [, startSync] = useTransition();

  useEffect(() => {
    startSync(() => {
      setTree(items);
      setStructureDirty(false);
      if (selectedItemId && !findItemById(items, selectedItemId)) {
        setSelectedItemId(null);
      }
    });
  }, [items, selectedItemId, startSync]);

  const flattenedItems = useMemo(
    () => flattenTree(tree),
    [tree],
  );

  const selectedItem = useMemo(
    () => flattenedItems.find((entry) => entry.id === selectedItemId)?.item,
    [flattenedItems, selectedItemId],
  );

  useEffect(() => {
    if (selectedItem) {
      startSync(() => {
        setEditLinkType(selectedItem.type);
      });
    }
  }, [selectedItem, startSync]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );

  const parentOptions = useMemo(
    () =>
      flattenedItems.map((entry) => ({
        id: entry.id,
        label: `${"— ".repeat(entry.depth)}${entry.item.label}`,
      })),
    [flattenedItems],
  );

  const placementLabel =
    placement.charAt(0) + placement.slice(1).toLowerCase();

  const activeItem = activeId
    ? flattenedItems.find((entry) => entry.id === activeId)
    : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragMove(event: DragMoveEvent) {
    setOffsetLeft(event.delta.x);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      resetDragState();
      return;
    }

    const projection = getProjection(
      flattenedItems,
      active.id as string,
      over.id as string,
      offsetLeft,
      indentationWidth,
    );

    if (!projection) {
      resetDragState();
      return;
    }

    const activeIndex = flattenedItems.findIndex(
      (entry) => entry.id === active.id,
    );
    const overIndex = flattenedItems.findIndex(
      (entry) => entry.id === over.id,
    );

    if (activeIndex === -1 || overIndex === -1) {
      resetDragState();
      return;
    }

    const reordered = arrayMove(flattenedItems, activeIndex, overIndex).map(
      (entry) => {
        if (entry.id === active.id) {
          return {
            ...entry,
            depth: projection.depth,
            parentId: projection.parentId,
          };
        }
        return entry;
      },
    );

    setTree(buildTree(reordered));
    setStructureDirty(true);
    resetDragState();
  }

  function handleDragCancel() {
    resetDragState();
  }

  function resetDragState() {
    setActiveId(null);
    setOffsetLeft(0);
  }

  function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("menuId", menuId);
    formData.set("linkType", createLinkType);

    startCreate(async () => {
      const result = await createNavigationItemAction(formData);
      if (!result.success) {
        setStatus({ type: "error", message: result.error });
        return;
      }
      form.reset();
      setCreateLinkType("EXTERNAL");
      setStatus({ type: "success", message: "Navigation item added." });
      router.refresh();
    });
  }

  function handleUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedItem) {
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("itemId", selectedItem.id);
    formData.set("linkType", editLinkType);

    startUpdate(async () => {
      const result = await updateNavigationItemAction(formData);
      if (!result.success) {
        setStatus({ type: "error", message: result.error });
        return;
      }
      setStatus({ type: "success", message: "Navigation item updated." });
      router.refresh();
    });
  }

  function handleDelete() {
    if (!selectedItem) {
      return;
    }
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        "Delete this navigation item and all nested links? This cannot be undone.",
      )
    ) {
      return;
    }
    const formData = new FormData();
    formData.set("itemId", selectedItem.id);

    startDelete(async () => {
      const result = await deleteNavigationItemAction(formData);
      if (!result.success) {
        setStatus({ type: "error", message: result.error });
        return;
      }
      setSelectedItemId(null);
      setStatus({ type: "success", message: "Navigation item deleted." });
      router.refresh();
    });
  }

  function handleSaveStructure() {
    if (!structureDirty) {
      return;
    }
    const payload = JSON.stringify(serializeTree(tree));
    const formData = new FormData();
    formData.set("menuId", menuId);
    formData.set("tree", payload);

    startSaveStructure(async () => {
      const result = await reorderNavigationItemsAction(formData);
      if (!result.success) {
        setStatus({ type: "error", message: result.error });
        return;
      }
      setStructureDirty(false);
      setStatus({ type: "success", message: "Menu order saved." });
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Navigation</h2>
          <p className="text-sm text-slate-500">
            Drag items to reorder or nest them. Save to persist the tree.
          </p>
        </div>
        <Badge variant="outline">{placementLabel} menu</Badge>
      </div>

      {status && (
        <div
          className={cn(
            "rounded-md border px-4 py-2 text-sm",
            status.type === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700",
          )}
        >
          {status.message}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <Card>
          <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Menu items</CardTitle>
              <p className="text-sm text-slate-500">
                Nest items by dragging them underneath another entry.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {structureDirty && (
                <span className="text-xs font-semibold uppercase text-amber-600">
                  Unsaved changes
                </span>
              )}
              <Button
                variant="secondary"
                size="sm"
                disabled={!structureDirty || isSavingStructure}
                isLoading={isSavingStructure}
                onClick={handleSaveStructure}
              >
                Save order
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <DndContext
              sensors={sensors}
              onDragStart={handleDragStart}
              onDragMove={handleDragMove}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
            >
              <SortableContext items={flattenedItems.map((entry) => entry.id)}>
                <ul className="space-y-2">
                  {flattenedItems.length > 0 ? (
                    flattenedItems.map((entry) => (
                      <NavigationTreeRow
                        key={entry.id}
                        entry={entry}
                        indentationWidth={indentationWidth}
                        isSelected={selectedItemId === entry.id}
                        onSelect={setSelectedItemId}
                      />
                    ))
                  ) : (
                    <li className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                      No navigation items yet. Add links using the form on the right.
                    </li>
                  )}
                </ul>
              </SortableContext>
              <DragOverlay>
                {activeItem ? (
                  <TreeDragPreview
                    entry={activeItem}
                    indentationWidth={indentationWidth}
                  />
                ) : null}
              </DragOverlay>
            </DndContext>
          </CardContent>
        </Card>

        <div className="space-y-6">
    <Card>
      <CardHeader>
              <CardTitle>Add link</CardTitle>
      </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleCreate}>
                <div className="space-y-2">
                  <Label htmlFor="createLabel">Label</Label>
                  <Input
                    id="createLabel"
                    name="label"
                    placeholder="Contact"
                    required
                    disabled={isCreating}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="createParent">Nest under</Label>
                  <Select
                    id="createParent"
                    name="parentId"
                    defaultValue=""
                    disabled={isCreating || parentOptions.length === 0}
                  >
                    <option value="">Top level</option>
                    {parentOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="createLinkType">Link type</Label>
                  <Select
                    id="createLinkType"
                    value={createLinkType}
                    disabled={isCreating}
                    onChange={(event) =>
                      setCreateLinkType(event.target.value as "INTERNAL" | "EXTERNAL")
                    }
                  >
                    <option value="EXTERNAL">External URL</option>
                    <option value="INTERNAL">Internal page</option>
                  </Select>
                </div>
                {createLinkType === "INTERNAL" ? (
                  <div className="space-y-2">
                    <Label htmlFor="createPage">Page</Label>
                    <Select
                      id="createPage"
                      name="pageId"
                      defaultValue=""
                      required
                      disabled={isCreating || !pages.length}
                    >
                      <option value="" disabled>
                        {pages.length ? "Select a page" : "No pages available"}
                      </option>
                      {pages.map((page) => (
                        <option key={page.id} value={page.id}>
                          {page.title} ({page.path})
                        </option>
                      ))}
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="createUrl">URL</Label>
                    <Input
                      id="createUrl"
                      name="url"
                      placeholder="/contact"
                      disabled={isCreating}
                      required
                    />
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <input
                    id="createOpenInNew"
                    name="openInNew"
                    type="checkbox"
                    value="true"
                    disabled={isCreating}
                    className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900/30"
                  />
                  <Label htmlFor="createOpenInNew">Open in new tab</Label>
                </div>
                <Button type="submit" isLoading={isCreating} disabled={isCreating}>
                  Add navigation item
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-col gap-3">
              <div>
                <CardTitle>Edit selected link</CardTitle>
                <p className="text-sm text-slate-500">
                  Click an item in the list to edit its details.
                </p>
              </div>
              {selectedItem && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="self-start"
                  onClick={() => setSelectedItemId(null)}
                >
                  Clear selection
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {selectedItem ? (
                <form
                  key={selectedItem.id}
                  className="space-y-4"
                  onSubmit={handleUpdate}
                >
          <div className="space-y-2">
                    <Label htmlFor="editLabel">Label</Label>
                    <Input
                      id="editLabel"
                      name="label"
                      defaultValue={selectedItem.label}
                      required
                      disabled={isUpdating}
                    />
          </div>
          <div className="space-y-2">
                    <Label htmlFor="editLinkType">Link type</Label>
                    <Select
                      id="editLinkType"
                      value={editLinkType}
                      disabled={isUpdating}
                      onChange={(event) =>
                        setEditLinkType(event.target.value as "INTERNAL" | "EXTERNAL")
                      }
                    >
                      <option value="EXTERNAL">External URL</option>
                      <option value="INTERNAL">Internal page</option>
                    </Select>
                  </div>
                  {editLinkType === "INTERNAL" ? (
                    <div className="space-y-2">
                      <Label htmlFor="editPage">Page</Label>
                      <Select
                        id="editPage"
                        name="pageId"
                        defaultValue={selectedItem.pageId ?? ""}
                        required
                        disabled={isUpdating || !pages.length}
                      >
                        <option value="" disabled>
                          {pages.length ? "Select a page" : "No pages available"}
                        </option>
                        {pages.map((page) => (
                          <option key={page.id} value={page.id}>
                            {page.title} ({page.path})
                          </option>
                        ))}
                      </Select>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="editUrl">URL</Label>
                      <Input
                        id="editUrl"
                        name="url"
                        defaultValue={
                          selectedItem.type === "EXTERNAL"
                            ? selectedItem.url
                            : ""
                        }
                        placeholder="https://"
                        required
                        disabled={isUpdating}
                      />
          </div>
                  )}
          <div className="flex items-center gap-2 text-sm">
            <input
                      id="editOpenInNew"
              name="openInNew"
              type="checkbox"
              value="true"
                      defaultChecked={selectedItem.openInNew}
                      disabled={isUpdating}
              className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900/30"
            />
                    <Label htmlFor="editOpenInNew">Open in new tab</Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      type="submit"
                      variant="secondary"
                      isLoading={isUpdating}
                      disabled={isUpdating}
                    >
                      Save changes
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={handleDelete}
                      disabled={isDeleting}
                      isLoading={isDeleting}
                    >
                      Delete
                    </Button>
          </div>
        </form>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                  Select a navigation item to edit its details.
                </div>
              )}
      </CardContent>
    </Card>
        </div>
      </div>
    </div>
  );
}

type NavigationTreeRowProps = {
  entry: FlattenedNavItem;
  indentationWidth: number;
  isSelected: boolean;
  onSelect: (id: string) => void;
};

function NavigationTreeRow({
  entry,
  indentationWidth,
  isSelected,
  onSelect,
}: NavigationTreeRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: entry.id,
    });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleClick = () => {
    onSelect(entry.id);
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      onClick={handleClick}
      className={cn(
        "flex items-center justify-between rounded-lg border bg-white px-3 py-2 shadow-sm transition",
        isSelected && "border-slate-900 ring-1 ring-slate-900/30",
        isDragging && "opacity-75",
      )}
    >
      <div
        className="min-w-0 flex-1 space-y-1"
        style={{ paddingLeft: entry.depth * indentationWidth }}
      >
        <p className="truncate text-sm font-medium text-slate-900">
          {entry.item.label}
        </p>
        <p className="truncate text-xs text-slate-500">
          {entry.item.type === "INTERNAL"
            ? entry.item.pageTitle ?? entry.item.pagePath ?? "Internal page"
            : entry.item.url}
        </p>
      </div>
      <div className="ml-3 flex items-center gap-2">
        <Badge variant="outline" className="text-xs">
          {entry.item.type === "INTERNAL" ? "Internal" : "External"}
        </Badge>
        <button
          type="button"
          className="cursor-grab rounded-md border border-dashed border-transparent px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-400 transition hover:border-slate-200 hover:bg-slate-50 hover:text-slate-600"
          {...attributes}
          {...listeners}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          Drag
        </button>
      </div>
    </li>
  );
}

function TreeDragPreview({
  entry,
  indentationWidth,
}: {
  entry: FlattenedNavItem;
  indentationWidth: number;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 shadow-lg">
      <div
        className="min-w-0 flex-1 space-y-1"
        style={{ paddingLeft: entry.depth * indentationWidth }}
      >
        <p className="truncate text-sm font-medium text-slate-900">
          {entry.item.label}
        </p>
        <p className="truncate text-xs text-slate-500">
          {entry.item.type === "INTERNAL"
            ? entry.item.pageTitle ?? entry.item.pagePath ?? "Internal page"
            : entry.item.url}
        </p>
      </div>
      <Badge variant="outline" className="text-xs">
        {entry.item.type === "INTERNAL" ? "Internal" : "External"}
      </Badge>
    </div>
  );
}

function flattenTree(
  items: NavigationTreeItem[],
  depth = 0,
  parentId: string | null = null,
): FlattenedNavItem[] {
  return items.flatMap((item) => {
    const current: FlattenedNavItem = {
      id: item.id,
      depth,
      parentId,
      item,
    };
    if (!item.children.length) {
      return [current];
    }
    return [current, ...flattenTree(item.children, depth + 1, item.id)];
  });
}

function buildTree(flattened: FlattenedNavItem[]): NavigationTreeItem[] {
  const lookup = new Map<string, NavigationTreeItem>();
  const roots: NavigationTreeItem[] = [];

  flattened.forEach((entry) => {
    const clone: NavigationTreeItem = {
      ...entry.item,
      parentId: entry.parentId,
      children: [],
    };
    lookup.set(clone.id, clone);
    if (!entry.parentId) {
      roots.push(clone);
    } else {
      const parent = lookup.get(entry.parentId);
      if (parent) {
        parent.children.push(clone);
      }
    }
  });

  return roots;
}

function findItemById(
  items: NavigationTreeItem[],
  id: string,
): NavigationTreeItem | null {
  for (const item of items) {
    if (item.id === id) {
      return item;
    }
    const child = findItemById(item.children, id);
    if (child) {
      return child;
    }
  }
  return null;
}

function getProjection(
  items: FlattenedNavItem[],
  activeId: string,
  overId: string,
  dragOffset: number,
  indentation: number,
) {
  const activeIndex = items.findIndex((item) => item.id === activeId);
  const overIndex = items.findIndex((item) => item.id === overId);

  if (activeIndex === -1 || overIndex === -1) {
    return null;
  }

  const activeItem = items[activeIndex];
  const sorted = arrayMove(items, activeIndex, overIndex);
  const previousItem = sorted[overIndex - 1];
  const nextItem = sorted[overIndex + 1];
  const dragDepth = Math.round(dragOffset / indentation);
  const projectedDepth = activeItem.depth + dragDepth;
  const maxDepth = previousItem ? previousItem.depth + 1 : 0;
  const minDepth = nextItem ? nextItem.depth : 0;
  const depth = Math.max(0, Math.min(projectedDepth, maxDepth));
  const constrainedDepth = Math.max(minDepth, depth);

  let parentId: string | null = null;
  if (constrainedDepth === 0) {
    parentId = null;
  } else {
    for (let index = overIndex - 1; index >= 0; index -= 1) {
      const item = sorted[index];
      if (item.depth < constrainedDepth) {
        parentId = item.id;
        break;
      }
    }
  }

  return { depth: constrainedDepth, parentId };
}

function serializeTree(
  nodes: NavigationTreeItem[],
): NavigationTreePayload[] {
  return nodes.map((node) => ({
    id: node.id,
    children: node.children.length ? serializeTree(node.children) : [],
  }));
}
