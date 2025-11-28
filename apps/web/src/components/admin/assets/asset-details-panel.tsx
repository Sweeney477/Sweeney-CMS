"use client";

import { Copy, Download, RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AssetDTO } from "@/types/assets";
import { buildAssetUrl } from "@/lib/utils";

type AssetDetailsPanelProps = {
  asset: AssetDTO | null;
  onAssetUpdated?: (asset: AssetDTO) => void;
};

export function AssetDetailsPanel({
  asset: assetProp,
  onAssetUpdated,
}: AssetDetailsPanelProps) {
  const [altText, setAltText] = useState("");
  const [prompt, setPrompt] = useState(
    "Describe the subject, context, and tone in one concise sentence.",
  );
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [regeneratingTransforms, setRegeneratingTransforms] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setAltText(assetProp?.altText ?? "");
    setMessage(null);
  }, [assetProp?.id, assetProp?.altText]);

  if (!assetProp) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">
        Select an asset to view details, transforms, and alt text.
      </div>
    );
  }

  const asset = assetProp;
  const previewUrl = buildAssetUrl({
    cdnUrl: asset.cdnUrl,
    url: asset.url,
  });
  const folderLabel = asset.folder?.path ?? "Uncategorized";

  async function handleCopy(value: string) {
    await navigator.clipboard.writeText(value);
    setMessage("Copied to clipboard");
    setTimeout(() => setMessage(null), 1500);
  }

  async function handleSaveAltText() {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/assets/alt-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId: asset.id,
          mode: "manual",
          altText,
        }),
      });
      if (!response.ok) {
        throw new Error("Unable to save alt text");
      }
      const next = { ...asset, altText };
      onAssetUpdated?.(next);
      setMessage("Alt text saved");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Failed to save alt text",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateAltText() {
    setGenerating(true);
    setMessage(null);
    try {
      const response = await fetch("/api/assets/alt-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId: asset.id,
          prompt,
        }),
      });
      if (!response.ok) {
        const details = await response.json();
        throw new Error(details.error ?? "Unable to generate alt text");
      }
      const data = await response.json();
      setAltText(data.altText);
      onAssetUpdated?.({
        ...asset,
        altText: data.altText,
      });
      setMessage("Alt text generated with AI");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "AI generation failed",
      );
    } finally {
      setGenerating(false);
    }
  }

  async function handleRegenerateTransforms() {
    setRegeneratingTransforms(true);
    setMessage(null);
    try {
      const response = await fetch("/api/assets/transforms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId: asset.id }),
      });
      if (!response.ok) {
        throw new Error("Failed to regenerate transforms");
      }
      const data = await response.json();
      const updatedAsset = {
        ...asset,
        transforms: data.transforms ?? asset.transforms,
      };
      onAssetUpdated?.(updatedAsset);
      setMessage("Transforms regenerated");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Transform job failed",
      );
    } finally {
      setRegeneratingTransforms(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 text-sm">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-slate-500">
          Preview
        </p>
        <div className="overflow-hidden rounded-lg border border-slate-100">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
            src={previewUrl}
            alt={asset.altText ?? asset.label}
            className="aspect-video w-full object-cover"
          />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-slate-500">
          Metadata
        </p>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
          <dt>Name</dt>
          <dd className="truncate">{asset.fileName}</dd>
          <dt>Folder</dt>
          <dd>{folderLabel}</dd>
          <dt>MIME type</dt>
          <dd>{asset.mimeType}</dd>
          <dt>Size</dt>
          <dd>{formatFileSize(asset.fileSize)}</dd>
          <dt>Dimensions</dt>
          <dd>
            {asset.width ?? "--"} × {asset.height ?? "--"}
          </dd>
        </dl>
        <div className="space-y-2 text-xs">
          <Label htmlFor="cdn-url">CDN URL</Label>
          <div className="flex gap-2">
            <Input id="cdn-url" value={previewUrl} readOnly />
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleCopy(previewUrl)}
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => window.open(previewUrl, "_blank", "noreferrer")}
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Alt text
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1 text-xs"
              onClick={handleGenerateAltText}
              disabled={generating}
            >
              <Sparkles className="h-3.5 w-3.5" />
              {generating ? "Generating…" : "Suggest"}
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="gap-1 text-xs"
              onClick={handleSaveAltText}
              disabled={saving}
            >
              Save
            </Button>
          </div>
        </div>
        <Textarea
          rows={4}
          value={altText}
          onChange={(event) => setAltText(event.target.value)}
        />
        <Label htmlFor="alt-text-prompt" className="text-xs text-slate-500">
          Prompt for AI suggestions
        </Label>
        <Textarea
          id="alt-text-prompt"
          rows={2}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Transforms
          </p>
          <Button
            variant="outline"
            size="sm"
            className="gap-1 text-xs"
            onClick={handleRegenerateTransforms}
            disabled={regeneratingTransforms}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {regeneratingTransforms ? "Regenerating…" : "Regenerate"}
          </Button>
        </div>
        <div className="space-y-2">
          {asset.transforms.length === 0 && (
            <p className="text-xs text-slate-500">
              No transforms yet. Upload an image to generate responsive
              variants.
            </p>
          )}
          {asset.transforms.map((transform) => {
            const transformUrl = buildAssetUrl({
              url: transform.url,
              cdnUrl: undefined,
            });
            return (
              <div
                key={transform.id}
                className="flex items-center justify-between rounded border border-slate-100 px-3 py-2 text-xs"
              >
                <div>
                  <p className="font-medium text-slate-900">
                    {transform.kind} · {transform.width ?? "--"}×
                    {transform.height ?? "--"}
                  </p>
                  <p className="break-all text-slate-500">{transformUrl}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleCopy(transformUrl)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      {message && (
        <p className="text-xs font-medium text-slate-600">{message}</p>
      )}
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
