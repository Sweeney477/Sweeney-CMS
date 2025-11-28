"use client";

import { ChevronRight, Folder, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AssetFolderDTO } from "@/types/assets";

type FolderTreeProps = {
  folders: AssetFolderDTO[];
  selectedFolderId: string | null;
  onSelect: (folderId: string | null) => void;
  onCreateFolder?: (parentId: string | null) => Promise<void>;
};

type FolderNode = AssetFolderDTO & { children: FolderNode[] };

export function FolderTree({
  folders,
  selectedFolderId,
  onSelect,
  onCreateFolder,
}: FolderTreeProps) {
  const tree = useMemo(() => buildTree(folders), [folders]);
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(tree.map((node) => node.id)),
  );

  function toggle(id: string) {
    const next = new Set(expanded);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpanded(next);
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">Folders</h3>
        {onCreateFolder && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void onCreateFolder?.(null);
            }}
            className="h-7 gap-1 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            New
          </Button>
        )}
      </div>
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-slate-600 hover:bg-slate-100",
          selectedFolderId === null && "bg-slate-900 text-white hover:bg-slate-900",
        )}
      >
        <Folder className="h-4 w-4" />
        All assets
      </button>
      <ul className="mt-3 space-y-1">
        {tree.map((node) => (
          <FolderItem
            key={node.id}
            node={node}
            depth={0}
            expanded={expanded}
            onToggle={toggle}
            selectedFolderId={selectedFolderId}
            onSelect={onSelect}
            onCreateFolder={onCreateFolder}
          />
        ))}
      </ul>
    </div>
  );
}

type FolderItemProps = {
  node: FolderNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  selectedFolderId: string | null;
  onSelect: (folderId: string) => void;
  onCreateFolder?: (parentId: string) => Promise<void>;
};

function FolderItem({
  node,
  depth,
  expanded,
  onToggle,
  selectedFolderId,
  onSelect,
  onCreateFolder,
}: FolderItemProps) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expanded.has(node.id);

  return (
    <li>
      <div
        className={cn(
          "group flex items-center gap-1 rounded-md px-2 py-1.5 text-slate-600 hover:bg-slate-100",
          selectedFolderId === node.id &&
            "bg-slate-900 text-white hover:bg-slate-900",
        )}
        style={{ marginLeft: depth * 12 }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggle(node.id)}
            className="rounded p-0.5 text-slate-500 hover:bg-slate-200"
          >
            <ChevronRight
              className={cn(
                "h-4 w-4 transition",
                isExpanded && "rotate-90",
                selectedFolderId === node.id && "text-white",
              )}
            />
          </button>
        ) : (
          <span className="w-4" />
        )}
        <button
          type="button"
          onClick={() => onSelect(node.id)}
          className="flex flex-1 items-center gap-2 text-left"
        >
          <Folder className="h-4 w-4" />
          <span className="truncate">{node.name}</span>
        </button>
        {onCreateFolder && (
          <button
            type="button"
            onClick={() => {
              void onCreateFolder?.(node.id);
            }}
            className="opacity-0 transition group-hover:opacity-100"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>
      {hasChildren && isExpanded && (
        <ul className="space-y-1">
          {node.children.map((child) => (
            <FolderItem
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              selectedFolderId={selectedFolderId}
              onSelect={onSelect}
              onCreateFolder={onCreateFolder}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function buildTree(folders: AssetFolderDTO[]) {
  const map = new Map<string, FolderNode>();
  folders.forEach((folder) => {
    map.set(folder.id, { ...folder, children: [] });
  });

  const roots: FolderNode[] = [];
  folders.forEach((folder) => {
    const node = map.get(folder.id)!;
    if (folder.parentId && map.has(folder.parentId)) {
      map.get(folder.parentId)!.children.push(node);
    } else if (folder.path !== "/") {
      roots.push(node);
    }
  });

  map.forEach((node) => {
    node.children.sort((a, b) => a.name.localeCompare(b.name));
  });

  return roots.sort((a, b) => a.name.localeCompare(b.name));
}

