"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  AssetDTO,
  AssetFolderDTO,
  AssetTagDTO,
} from "@/types/assets";
import { AssetDetailsPanel } from "@/components/admin/assets/asset-details-panel";
import { AssetGrid } from "@/components/admin/assets/asset-grid";
import { FolderTree } from "@/components/admin/assets/folder-tree";
import { TagFilter } from "@/components/admin/assets/tag-filter";
import { UploadPanel } from "@/components/admin/assets/upload-panel";

type MediaLibraryProps = {
  siteId: string;
  maxUploadMb: number;
  initialAssets: AssetDTO[];
  initialFolders: AssetFolderDTO[];
  initialTags: AssetTagDTO[];
  initialCursor?: string | null;
};

export function MediaLibrary({
  siteId,
  maxUploadMb,
  initialAssets,
  initialFolders,
  initialTags,
  initialCursor,
}: MediaLibraryProps) {
  const [assets, setAssets] = useState<AssetDTO[]>(initialAssets);
  const [folders, setFolders] = useState<AssetFolderDTO[]>(initialFolders);
  const [tags, setTags] = useState<AssetTagDTO[]>(initialTags);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [isLoading, setIsLoading] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>(
    initialCursor ?? undefined,
  );
  const [selectedAsset, setSelectedAsset] = useState<AssetDTO | null>(
    initialAssets[0] ?? null,
  );
  const firstLoadRef = useRef(true);

  useEffect(() => {
    if (firstLoadRef.current) {
      firstLoadRef.current = false;
      return;
    }
    void loadAssets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFolder, selectedTags, debouncedSearch]);

  async function loadAssets(cursor?: string, append = false) {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        siteId,
        limit: "24",
      });
      if (selectedFolder) params.set("folderId", selectedFolder);
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (selectedTags.length) params.append("tagIds", selectedTags.join(","));
      if (cursor) params.set("cursor", cursor);

      const response = await fetch(`/api/assets?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to load assets");
      const payload = await response.json();
      setAssets((prev) =>
        append ? [...prev, ...payload.items] : payload.items,
      );
      setNextCursor(payload.nextCursor);
      if (!append) {
        setSelectedAsset(payload.items[0] ?? null);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  const filteredFolders = useMemo(
    () => folders.filter((folder) => folder.path !== "/"),
    [folders],
  );

  async function handleCreateFolder(parentId: string | null) {
    const name = prompt("Folder name");
    if (!name) return;
    const response = await fetch("/api/assets/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteId, name, parentId }),
    });
    if (!response.ok) {
      alert("Failed to create folder");
      return;
    }
    const payload = await response.json();
    setFolders((prev) => [...prev, payload.folder]);
  }

  async function handleCreateTag(payload: { name: string; color?: string }) {
    const response = await fetch("/api/assets/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteId, ...payload }),
    });
    if (!response.ok) {
      alert("Failed to create tag");
      return;
    }
    const data = await response.json();
    setTags((prev) => [...prev, data.tag]);
  }

  function handleUploadComplete(asset: AssetDTO) {
    const matchesFolder = !selectedFolder || asset.folderId === selectedFolder;
    const matchesTags =
      selectedTags.length === 0 ||
      selectedTags.every((tagId) =>
        asset.tags.some((entry) => entry.tagId === tagId),
      );

    if (!matchesFolder || !matchesTags) {
      return;
    }

    setAssets((prev) => [asset, ...prev]);
    setSelectedAsset(asset);
  }

  function handleAssetUpdate(updated: AssetDTO) {
    setAssets((prev) =>
      prev.map((asset) => (asset.id === updated.id ? updated : asset)),
    );
    setSelectedAsset(updated);
  }

  function toggleTag(tagId: string) {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr_360px]">
      <div className="space-y-4">
        <UploadPanel
          siteId={siteId}
          currentFolderId={selectedFolder}
          maxUploadMb={maxUploadMb}
          onUploaded={handleUploadComplete}
        />
        <FolderTree
          folders={filteredFolders}
          selectedFolderId={selectedFolder}
          onSelect={setSelectedFolder}
          onCreateFolder={handleCreateFolder}
        />
        <TagFilter
          tags={tags}
          selected={selectedTags}
          onToggle={toggleTag}
          onCreateTag={handleCreateTag}
        />
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Input
            placeholder="Search assets by name"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => loadAssets()}
            disabled={isLoading}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>

        <AssetGrid
          assets={assets}
          selectedAssetId={selectedAsset?.id}
          onSelect={setSelectedAsset}
          isLoading={isLoading}
        />

        {nextCursor && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => loadAssets(nextCursor, true)}
            disabled={isLoading}
          >
            Load more
          </Button>
        )}
      </div>

      <AssetDetailsPanel asset={selectedAsset} onAssetUpdated={handleAssetUpdate} />
    </div>
  );
}

function useDebounce<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

