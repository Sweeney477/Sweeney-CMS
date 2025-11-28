import type { ReactNode } from "react";

import { buildAssetUrl, cn } from "@/lib/utils";
import type { NavigationTreeItem } from "@/server/services/navigation-service";
import type { RenderableBlock, RenderablePage } from "@/server/services/page-service";
import type { BlockSettings } from "@/lib/blocks";

type PageRendererProps = {
  page: RenderablePage;
  navigation?: NavigationTreeItem[] | null;
  isPreview?: boolean;
};

export function PageRenderer({
  page,
  navigation,
  isPreview,
}: PageRendererProps) {
  return (
    <>
      <SiteHeader
        siteName={page.site.name}
        navigation={navigation ?? []}
        isPreview={isPreview}
      />
      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-12 px-6 pb-24 pt-16 md:pt-24">
        {page.blocks.map((block) => (
          <section key={block.id}>{renderBlock(block)}</section>
        ))}
      </main>
    </>
  );
}

function SiteHeader({
  siteName,
  navigation,
  isPreview,
}: {
  siteName: string;
  navigation: NavigationTreeItem[];
  isPreview?: boolean;
}) {
  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <div className="flex flex-col">
          <span className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            {siteName}
          </span>
          {isPreview && (
            <span className="text-xs font-medium text-amber-600">
              Preview mode — shareable draft
            </span>
          )}
        </div>
        <nav className="flex items-center gap-4 text-sm font-medium text-slate-600">
          {navigation?.map((item) => (
            <a
              key={item.id}
              href={item.url}
              className="rounded-md px-2 py-1 transition hover:bg-slate-100"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}

function renderBlock(block: RenderableBlock) {
  const settings = getBlockSettings(block);
      let content: ReactNode = null;

  switch (block.kind) {
    case "hero":
      content = <HeroBlock data={block.data} tone={settings.background} />;
      break;
    case "feature-grid":
      content = (
        <FeatureGridBlock
          data={{ title: "", columns: normalizeLegacyColumns(block.data) }}
          tone={settings.background}
        />
      );
      break;
    case "grid":
      content = <FeatureGridBlock data={block.data} tone={settings.background} />;
      break;
    case "rich-text":
      content = (
        <TextBlock
          html={typeof block.data.content === "string" ? block.data.content : ""}
          tone={settings.background}
        />
      );
      break;
    case "text":
      content = (
        <TextBlock
          html={typeof block.data.html === "string" ? block.data.html : ""}
          tone={settings.background}
        />
      );
      break;
    case "media":
      content = <MediaBlock data={block.data} tone={settings.background} />;
      break;
    case "cta":
      content = <CtaBlock data={block.data} tone={settings.background} />;
      break;
    default:
      content = (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
          Unsupported block type: {block.kind}
        </div>
      );
  }

  if (!content) {
    return null;
  }

  return <BlockSurface settings={settings}>{content}</BlockSurface>;
}

function HeroBlock({
  data,
  tone,
}: {
  data: Record<string, unknown>;
  tone: BlockSettings["background"];
}) {
  const isDark = tone === "dark";
  const eyebrow = typeof data.eyebrow === "string" ? data.eyebrow : null;
  const heading = typeof data.heading === "string" ? data.heading : "";
  const body = typeof data.body === "string" ? data.body : null;
  const ctas = Array.isArray(data.ctas) ? data.ctas : [];

  return (
    <div className="space-y-4">
      {eyebrow && (
        <p className={cn("text-xs uppercase tracking-[0.2em]", isDark ? "text-slate-200" : "text-slate-500")}>
          {eyebrow}
        </p>
      )}
      <h1 className={cn("text-4xl font-semibold md:text-5xl", isDark ? "text-white" : "text-slate-900")}>
        {heading}
      </h1>
      {body && (
        <p className={cn("mx-auto max-w-2xl text-lg", isDark ? "text-slate-100/90" : "text-slate-600")}>
          {body}
        </p>
      )}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {ctas
          .filter(
            (cta): cta is { label?: unknown; href?: unknown; variant?: unknown } =>
              Boolean(cta) && typeof cta === "object",
          )
          .map((cta, index) => {
            const label = String(cta.label ?? "");
            const href = String(cta.href ?? "#");
            const variant = cta.variant === "secondary" ? "secondary" : "primary";
            const isExternal = href.startsWith("http");
            return (
              <a
                key={`${label}-${index}`}
                href={href}
                className={cn(
                  "inline-flex items-center rounded-full px-6 py-3 text-sm font-semibold transition",
                  variant === "primary"
                    ? isDark
                      ? "bg-white text-slate-900 hover:bg-slate-100"
                      : "bg-slate-900 text-white hover:bg-slate-800"
                    : isDark
                      ? "border border-white/50 text-white hover:bg-white/10"
                      : "border border-slate-300 text-slate-700 hover:bg-slate-100",
                )}
                target={isExternal ? "_blank" : undefined}
                rel={isExternal ? "noreferrer" : undefined}
              >
                {label || "Learn more"}
              </a>
            );
          })}
      </div>
    </div>
  );
}

type FeatureItem = {
  title?: string;
  body?: string;
};

function FeatureGridBlock({
  data,
  tone,
}: {
  data: { title?: unknown; columns?: unknown };
  tone: BlockSettings["background"];
}) {
  const columns = normalizeColumns(data.columns);

  if (!columns.length) {
    return null;
  }

  return (
    <div className="space-y-6">
      {typeof data.title === "string" && data.title && (
        <h2 className={cn("text-3xl font-semibold", tone === "dark" ? "text-white" : "text-slate-900")}>
          {data.title}
        </h2>
      )}
      <div className="grid gap-6 md:grid-cols-2">
        {columns.map((item, index) => (
          <article
            key={`${item.title}-${index}`}
            className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Feature {index + 1}
            </p>
            <h3 className="mt-2 text-xl font-semibold text-slate-900">{item.title}</h3>
            {item.body && <p className="mt-2 text-sm text-slate-600">{item.body}</p>}
          </article>
        ))}
      </div>
    </div>
  );
}

function TextBlock({ html, tone }: { html: string; tone: BlockSettings["background"] }) {
  if (!html) {
    return null;
  }

  return (
    <div
      className={cn(
        "space-y-4 text-base leading-relaxed",
        tone === "dark" ? "text-slate-100" : "text-slate-600",
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function MediaBlock({
  data,
  tone,
}: {
  data: Record<string, unknown>;
  tone: BlockSettings["background"];
}) {
  if (typeof data.url !== "string" || !data.url) {
    return null;
  }
  const src = buildAssetUrl({ url: data.url });
  const label = typeof data.label === "string" ? data.label : null;
  const caption = typeof data.caption === "string" ? data.caption : null;

  return (
    <figure className={cn("w-full", tone === "dark" ? "text-white" : "text-slate-600")}>
      {label && (
        <figcaption className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </figcaption>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={typeof data.alt === "string" ? data.alt : ""}
        className="w-full rounded-3xl border border-slate-200 object-cover shadow-sm"
      />
      {caption && <p className="mt-2 text-xs text-slate-500">{caption}</p>}
    </figure>
  );
}

function CtaBlock({
  data,
  tone,
}: {
  data: Record<string, unknown>;
  tone: BlockSettings["background"];
}) {
  const isDark = tone === "dark";
  const heading = typeof data.heading === "string" ? data.heading : "Ready to get started?";
  const body = typeof data.body === "string" ? data.body : null;
  const ctas = Array.isArray(data.ctas)
    ? data.ctas.filter(
        (cta): cta is { label?: unknown; href?: unknown; variant?: unknown } =>
          Boolean(cta) && typeof cta === "object",
      )
    : [];

  return (
    <div className="space-y-4">
      <h3 className={cn("text-2xl font-semibold", isDark ? "text-white" : "text-slate-900")}>
        {heading}
      </h3>
      {body && (
        <p className={cn("text-sm", isDark ? "text-slate-200" : "text-slate-600")}>
          {body}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        {ctas.map((cta, index) => {
          const label = String(cta.label ?? "Learn more");
          const href = String(cta.href ?? "#");
          const variant = cta.variant === "secondary" ? "secondary" : "primary";
          const isExternal = href.startsWith("http");
          return (
            <a
              key={`${label}-${index}`}
              href={href}
              className={cn(
                "inline-flex items-center rounded-full px-5 py-2 text-sm font-semibold transition",
                variant === "primary"
                  ? isDark
                    ? "bg-white text-slate-900 hover:bg-slate-100"
                    : "bg-slate-900 text-white hover:bg-slate-800"
                  : "border border-slate-300 text-slate-700 hover:bg-slate-100",
              )}
              target={isExternal ? "_blank" : undefined}
              rel={isExternal ? "noreferrer" : undefined}
            >
              {label}
            </a>
          );
        })}
      </div>
    </div>
  );
}

function BlockSurface({
  settings,
  children,
}: {
  settings: BlockSettings;
  children: ReactNode;
}) {
  const backgroundClass =
    settings.background === "dark"
      ? "border-slate-800 bg-slate-900 text-white"
      : settings.background === "muted"
        ? "border-slate-100 bg-slate-50"
        : "border-slate-200 bg-white";
  const alignmentClass =
    settings.alignment === "center" ? "text-center" : "text-left";
  const widthClass = settings.fullWidth ? "w-full" : "mx-auto w-full max-w-4xl";

  return (
    <div
      className={cn(
        "rounded-3xl border px-8 py-10 shadow-sm transition",
        backgroundClass,
        widthClass,
        alignmentClass,
      )}
    >
      {children}
    </div>
  );
}

function getBlockSettings(block: RenderableBlock): BlockSettings {
  const settings = (block as RenderableBlock & { settings?: BlockSettings }).settings;
  if (!settings) {
    return {
      background: "default",
      alignment: "left",
      fullWidth: false,
    };
  }
  return settings;
}

function normalizeColumns(columns: unknown) {
  if (!Array.isArray(columns)) {
    return [];
  }

  return columns
    .filter((column): column is FeatureItem => Boolean(column) && typeof column === "object")
    .map((column) => ({
      title: column.title ?? "Feature",
      body: column.body ?? "",
    }));
}

function normalizeLegacyColumns(items: unknown) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter((item): item is FeatureItem => Boolean(item) && typeof item === "object")
    .map((item) => ({
      title: item.title ?? "Feature",
      body: item.body ?? "",
    }));
}
