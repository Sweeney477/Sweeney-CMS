'use client';

import { useEffect, useMemo, useState, useTransition } from "react";

import { BlockEditor } from "@/components/admin/block-editor/block-editor";
import { CommentsProvider } from "@/components/admin/comments/comments-provider";
import { CommentPanel } from "@/components/admin/comments/comment-panel";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createBlock, type BlockPayload } from "@/lib/blocks";
import { env } from "@/env";
import { savePageContentAction } from "@/server/actions/page-actions";
import type { RenderableBlock, RenderablePage } from "@/server/services/page-service";

type Props = {
  page: RenderablePage;
};

export function PageEditorForm({ page }: Props) {

  const initialBlocks = useMemo(() => deserializeBlocks(page.blocks), [page.blocks]);
  const initialMeta = useMemo(() => resolveMetadata(page), [page]);

  const [blocks, setBlocks] = useState<BlockPayload[]>(initialBlocks);
  const [metadata, setMetadata] = useState(initialMeta);
  const [summary, setSummary] = useState(page.revision?.summary ?? "");
  const [revisionId, setRevisionId] = useState(page.revision?.id);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [isSaving, startSaving] = useTransition();

  useEffect(() => {
    setBlocks(initialBlocks);
  }, [initialBlocks]);

  useEffect(() => {
    setMetadata(initialMeta);
  }, [initialMeta]);

  useEffect(() => {
    setRevisionId(page.revision?.id);
    setSummary(page.revision?.summary ?? "");
  }, [page.revision?.id, page.revision?.summary]);

  const handleSave = () => {
    setMessage(null);
    setError(null);
    startSaving(async () => {
      const formData = new FormData();
      formData.append("pageId", page.id);
      if (revisionId) {
        formData.append("revisionId", revisionId);
      }
      if (summary.trim()) {
        formData.append("summary", summary.trim());
      }
      formData.append("blocks", JSON.stringify(blocks));
      formData.append("metadata", JSON.stringify(metadata));

      const result = await savePageContentAction(formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      if (result.data?.revisionId) {
        setRevisionId(result.data.revisionId);
      }
      setMessage("Draft saved—generate a preview link or submit for review.");
    });
  };

  const resetEditor = () => {
    setBlocks(initialBlocks);
    setMetadata(initialMeta);
    setSummary(page.revision?.summary ?? "");
    setError(null);
    setMessage(null);
  };

  const previewCanonical =
    metadata.canonicalUrl.trim() ||
    new URL(page.path, env.NEXT_PUBLIC_APP_URL).toString();
  const previewTitle = metadata.seoTitle.trim() || page.title;
  const previewDescription =
    metadata.seoDescription.trim() ||
    "Add a short summary to improve discovery and click-through rates.";
  const previewOgTitle =
    metadata.seoOgTitle.trim() || metadata.seoTitle.trim() || page.title;
  const previewOgDescription =
    metadata.seoOgDescription.trim() || previewDescription;
  const previewOgImage = metadata.seoOgImage.trim();

  return (
    <CommentsProvider revisionId={page.revision?.id}>
      <section className="space-y-6">
    <Card>
      <CardHeader className="flex items-center justify-between">
        <div>
            <CardTitle>Visual editor</CardTitle>
          <p className="text-sm text-slate-500">
              Drag sections to reorder, edit content inline, then save a draft revision.
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
          <BlockEditor blocks={blocks} onChange={setBlocks} />
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-600">Revision summary</span>
              <Input
                value={summary}
                placeholder="ie: Update hero copy"
                onChange={(event) => setSummary(event.target.value)}
              />
            </label>
            <div className="flex items-end gap-3">
              <Button type="button" variant="secondary" onClick={resetEditor}>
                Reset changes
              </Button>
              <Button type="button" onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save draft"}
              </Button>
            </div>
          </div>
          {message && <p className="text-sm text-emerald-600">{message}</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Metadata</CardTitle>
          <p className="text-sm text-slate-500">
            SEO data is versioned with the revision and published together.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-600">SEO title</span>
              <Input
                value={metadata.seoTitle}
                placeholder="Sweeney CMS — Build multi-site experiences"
                onChange={(event) =>
                  setMetadata((current) => ({
                    ...current,
                    seoTitle: event.target.value,
                  }))
                }
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-600">SEO description</span>
              <Textarea
                value={metadata.seoDescription}
                className="min-h-[80px]"
                onChange={(event) =>
                  setMetadata((current) => ({
                    ...current,
                    seoDescription: event.target.value,
                  }))
                }
              />
            </label>
          </div>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-600">Canonical URL</span>
            <Input
              value={metadata.canonicalUrl}
              placeholder="https://www.example.com/about"
              onChange={(event) =>
                setMetadata((current) => ({
                  ...current,
                  canonicalUrl: event.target.value,
                }))
              }
            />
            <span className="text-xs text-slate-500">
              Leave blank to fall back to the site domain and page path.
            </span>
          </label>

          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-600">
            <p className="text-xs font-semibold uppercase text-slate-400">
              Search preview
            </p>
            <p className="truncate text-xs text-emerald-700">{previewCanonical}</p>
            <p className="mt-1 text-base font-semibold text-slate-900">
              {previewTitle}
            </p>
            <p className="line-clamp-2 text-sm">{previewDescription}</p>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-slate-600">
                Open Graph (social sharing)
              </p>
              <p className="text-xs text-slate-500">
                Customize how the page appears on social platforms.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-600">OG title</span>
                <Input
                  value={metadata.seoOgTitle}
                  placeholder="Social card heading"
                  onChange={(event) =>
                    setMetadata((current) => ({
                      ...current,
                      seoOgTitle: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-600">OG image URL</span>
                <Input
                  value={metadata.seoOgImage}
                  placeholder="https://cdn.example.com/card.jpg"
                  onChange={(event) =>
                    setMetadata((current) => ({
                      ...current,
                      seoOgImage: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-600">OG description</span>
              <Textarea
                value={metadata.seoOgDescription}
                className="min-h-[80px]"
                onChange={(event) =>
                  setMetadata((current) => ({
                    ...current,
                    seoOgDescription: event.target.value,
                  }))
                }
              />
            </label>
            <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
              <p className="text-xs font-semibold uppercase text-slate-400">
                Social preview
              </p>
              <p className="text-base font-semibold text-slate-900">
                {previewOgTitle}
              </p>
              <p className="text-sm text-slate-600">{previewOgDescription}</p>
              {previewOgImage && (
                <p className="mt-2 truncate text-xs text-slate-500">
                  Image: {previewOgImage}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      </section>
      <CommentPanel blocks={blocks} />
    </CommentsProvider>
  );
}

type MetadataState = {
  seoTitle: string;
  seoDescription: string;
  canonicalUrl: string;
  seoOgTitle: string;
  seoOgDescription: string;
  seoOgImage: string;
};

function deserializeBlocks(blocks: RenderableBlock[]): BlockPayload[] {
  if (!blocks.length) {
    return [createBlock("hero"), createBlock("text")];
  }

  return blocks.map((block) => convertBlock(block));
}

function convertBlock(block: RenderableBlock): BlockPayload {
  const blockId = block.referenceKey ?? block.id;
  switch (block.kind) {
    case "hero":
      return {
        id: blockId,
        kind: "hero",
        settings: normalizeSettings(block),
        data: {
          eyebrow: stringOrEmpty(block.data.eyebrow),
          heading: stringOrEmpty(block.data.heading) || "Update heading",
          body: stringOrEmpty(block.data.body),
          mediaUrl: stringOrEmpty(block.data.mediaUrl),
          mediaAlt: stringOrEmpty(block.data.mediaAlt),
          ctas: normalizeCtas(block.data),
        },
      };
    case "grid":
      return {
        id: blockId,
        kind: "grid",
        settings: normalizeSettings(block),
        data: {
          title: stringOrEmpty(block.data.title),
          columns: normalizeColumns(block.data.columns),
        },
      };
    case "feature-grid":
      return {
        id: blockId,
        kind: "grid",
        settings: normalizeSettings(block),
        data: {
          title: "",
          columns: normalizeLegacyFeatures(block.data.items),
        },
      };
    case "rich-text":
      return {
        id: blockId,
        kind: "text",
        settings: normalizeSettings(block),
        data: {
          html: stringOrEmpty(block.data.content) || "<p>Start writing...</p>",
        },
      };
    case "text":
      return {
        id: blockId,
        kind: "text",
        settings: normalizeSettings(block),
        data: {
          html: stringOrEmpty(block.data.html) || "<p>Start writing...</p>",
        },
      };
    case "media":
      return {
        id: blockId,
        kind: "media",
        settings: normalizeSettings(block),
        data: {
          label: stringOrEmpty(block.data.label),
          url: stringOrEmpty(block.data.url),
          alt: stringOrEmpty(block.data.alt),
          caption: stringOrEmpty(block.data.caption),
          aspect: (typeof block.data.aspect === "string" ? block.data.aspect : "auto") as
            | "auto"
            | "square"
            | "wide",
        },
      };
    case "cta":
      return {
        id: blockId,
        kind: "cta",
        settings: normalizeSettings(block),
        data: {
          heading: stringOrEmpty(block.data.heading) || "Ready to get started?",
          body: stringOrEmpty(block.data.body),
          ctas: normalizeCtas(block.data),
        },
      };
    default:
      return {
        id: blockId,
        kind: "text",
        settings: normalizeSettings(block),
        data: {
          html: `<p>Unsupported block "${block.kind}".</p>`,
        },
      };
  }
}

function normalizeSettings(block: RenderableBlock): BlockPayload["settings"] {
  const raw = block.settings ?? {};
  const background =
    raw && typeof raw.background === "string" && ["default", "muted", "dark"].includes(raw.background)
      ? raw.background
      : "default";
  const alignment =
    raw && typeof raw.alignment === "string" && ["left", "center"].includes(raw.alignment)
      ? raw.alignment
      : "left";
  const fullWidth = typeof raw.fullWidth === "boolean" ? raw.fullWidth : false;

  return {
    background: background as BlockPayload["settings"]["background"],
    alignment: alignment as BlockPayload["settings"]["alignment"],
    fullWidth,
  };
}

function normalizeCtas(
  data: Record<string, unknown>,
): Array<{ label: string; href: string; variant: "primary" | "secondary" }> {
  const ctas = Array.isArray(data.ctas) ? data.ctas : [];
  const normalized = ctas
    .filter((cta): cta is { label?: unknown; href?: unknown; variant?: unknown } => Boolean(cta))
    .map((cta) => {
      const variant =
        typeof cta.variant === "string" && (cta.variant === "primary" || cta.variant === "secondary")
          ? (cta.variant as "primary" | "secondary")
          : "primary";
      return {
        label: stringOrEmpty(cta.label) || "Learn more",
        href: stringOrEmpty(cta.href) || "/",
        variant,
      };
    });

  if (!normalized.length) {
    const legacyLabel = stringOrEmpty(data.ctaLabel);
    const legacyHref = stringOrEmpty(data.ctaHref);
    if (legacyLabel || legacyHref) {
      normalized.push({
        label: legacyLabel || "Get started",
        href: legacyHref || "/contact",
        variant: "primary",
      });
    }
  }

  return normalized.slice(0, 2);
}

function normalizeColumns(columns: unknown) {
  if (!Array.isArray(columns)) {
    return [
      { title: "Feature one", body: "Explain the benefit in a sentence.", icon: "" },
      { title: "Feature two", body: "Add supporting detail or stat.", icon: "" },
    ];
  }

  const normalized = columns
    .filter((column): column is Record<string, unknown> => Boolean(column) && typeof column === "object")
    .map((column) => ({
      title: stringOrEmpty(column.title) || "Feature",
      body: stringOrEmpty(column.body),
      icon: stringOrEmpty(column.icon),
    }));

  return normalized.length ? normalized : [{ title: "Feature", body: "", icon: "" }];
}

function normalizeLegacyFeatures(items: unknown) {
  if (!Array.isArray(items)) {
    return normalizeColumns([]);
  }

  return items
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      title: stringOrEmpty(item.title) || "Feature",
      body: stringOrEmpty(item.body),
      icon: "",
    }));
}

function stringOrEmpty(value: unknown) {
  return typeof value === "string" ? value : "";
}

function resolveMetadata(page: RenderablePage): MetadataState {
  const revisionMeta =
    (page.revision?.meta && typeof page.revision.meta === "object"
      ? (page.revision.meta as Record<string, unknown>)
      : undefined) ?? {};
  const merged = page.metadata ?? {};

  return {
    seoTitle: pickMeta(revisionMeta, merged, "seoTitle"),
    seoDescription: pickMeta(revisionMeta, merged, "seoDescription"),
    canonicalUrl: pickMeta(revisionMeta, merged, "canonicalUrl"),
    seoOgTitle: pickMeta(revisionMeta, merged, "seoOgTitle"),
    seoOgDescription: pickMeta(revisionMeta, merged, "seoOgDescription"),
    seoOgImage: pickMeta(revisionMeta, merged, "seoOgImage"),
  };
}

function pickMeta(
  revisionMeta: Record<string, unknown>,
  storedMeta: Record<string, unknown>,
  key: string,
) {
  const revisionValue = revisionMeta[key];
  if (typeof revisionValue === "string") {
    return revisionValue;
  }
  const storedValue = storedMeta[key];
  if (typeof storedValue === "string") {
    return storedValue;
  }
  return "";
}
