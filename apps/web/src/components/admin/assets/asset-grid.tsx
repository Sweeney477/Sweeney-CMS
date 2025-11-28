"use client";

import { FileAudio2, FileText, Film, Loader2 } from "lucide-react";

import type { AssetDTO } from "@/types/assets";
import { buildAssetUrl, cn } from "@/lib/utils";

type AssetGridProps = {
  assets: AssetDTO[];
  selectedAssetId?: string | null;
  onSelect?: (asset: AssetDTO) => void;
  isLoading?: boolean;
};

export function AssetGrid({
  assets,
  selectedAssetId,
  onSelect,
  isLoading,
}: AssetGridProps) {
  if (!assets.length && !isLoading) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 p-12 text-center text-sm text-slate-500">
        Drag files into the uploader or click to browse. Uploaded assets will
        appear here.
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {assets.map((asset) => (
        <button
          key={asset.id}
          type="button"
          onClick={() => onSelect?.(asset)}
          className={cn(
            "rounded-lg border bg-white text-left transition hover:border-slate-400",
            selectedAssetId === asset.id
              ? "border-slate-900 shadow-lg"
              : "border-slate-200 shadow-sm",
          )}
        >
          <div className="relative h-40 w-full overflow-hidden rounded-t-lg bg-slate-50">
            {renderPreview(asset)}
          </div>
          <div className="space-y-2 p-4 text-sm">
            <div className="flex items-center justify-between">
              <p className="font-medium text-slate-900">{asset.label}</p>
              <span className="text-xs text-slate-500">
                {formatFileSize(asset.fileSize)}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {asset.mimeType} · {asset.width ?? "--"}×{asset.height ?? "--"}
            </p>
            {asset.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {asset.tags.slice(0, 3).map(({ tag }) => (
                  <span
                    key={`${asset.id}-${tag.id}`}
                    className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600"
                  >
                    {tag.name}
                  </span>
                ))}
                {asset.tags.length > 3 && (
                  <span className="text-[11px] text-slate-400">
                    +{asset.tags.length - 3}
                  </span>
                )}
              </div>
            )}
          </div>
        </button>
      ))}
      {isLoading && (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-sm text-slate-500 sm:col-span-2 lg:col-span-3">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading assets…
        </div>
      )}
    </div>
  );
}

function renderPreview(asset: AssetDTO) {
  const url = buildAssetUrl({ cdnUrl: asset.cdnUrl, url: asset.url });
  if (asset.mimeType.startsWith("image/")) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={url}
        alt={asset.altText ?? asset.label}
        className="h-full w-full object-cover"
      />
    );
  }
  if (asset.mimeType.startsWith("video/")) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-500">
        <Film className="h-8 w-8" />
        <p className="text-xs">Video</p>
      </div>
    );
  }
  if (asset.mimeType.startsWith("audio/")) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-500">
        <FileAudio2 className="h-8 w-8" />
        <p className="text-xs">Audio</p>
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-500">
      <FileText className="h-8 w-8" />
      <p className="text-xs">Document</p>
    </div>
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

