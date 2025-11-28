import Link from "next/link";

import type { NavigationTreeItem } from "@/server/services/navigation-service";
import type { RenderableBlock, RenderablePage } from "@/server/services/page-service";

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
            <Link
              key={item.id}
              href={item.url}
              className="rounded-md px-2 py-1 transition hover:bg-slate-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

function renderBlock(block: RenderableBlock) {
  switch (block.kind) {
    case "hero":
      return <HeroBlock data={block.data} />;
    case "feature-grid":
      return <FeatureGridBlock data={block.data} />;
    case "rich-text":
      return <RichTextBlock data={block.data} />;
    default:
      return (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
          Unsupported block type: {block.kind}
        </div>
      );
  }
}

function HeroBlock({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/70 p-10 text-center shadow-sm">
      {data.eyebrow && (
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
          {String(data.eyebrow)}
        </p>
      )}
      <h1 className="mt-4 text-4xl font-semibold text-slate-900 md:text-5xl">
        {String(data.heading ?? "")}
      </h1>
      {data.body && (
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
          {String(data.body)}
        </p>
      )}
      {typeof data.ctaLabel === "string" &&
        typeof data.ctaHref === "string" &&
        data.ctaHref && (
          <div className="mt-8">
            <Link
              href={data.ctaHref}
              className="inline-flex items-center rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              target={
                String(data.ctaHref).startsWith("http") ? "_blank" : undefined
              }
              rel={
                String(data.ctaHref).startsWith("http") ? "noreferrer" : undefined
              }
            >
              {data.ctaLabel}
            </Link>
          </div>
        )}
    </div>
  );
}

type FeatureItem = {
  title?: string;
  body?: string;
};

function FeatureGridBlock({ data }: { data: Record<string, unknown> }) {
  const items = Array.isArray(data.items)
    ? (data.items.filter(
        (item): item is FeatureItem =>
          Boolean(item) && typeof item === "object",
      ) as FeatureItem[])
    : [];

  if (!items.length) {
    return null;
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {items.map((item, index) => (
        <article
          key={`${item.title ?? "feature"}-${index}`}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Feature {index + 1}
          </p>
          <h3 className="mt-2 text-xl font-semibold text-slate-900">
            {item.title ?? ""}
          </h3>
          {item.body && (
            <p className="mt-2 text-sm text-slate-600">{item.body}</p>
          )}
        </article>
      ))}
    </div>
  );
}

function RichTextBlock({ data }: { data: Record<string, unknown> }) {
  if (!data.content) {
    return null;
  }

  return (
    <div className="space-y-4 text-base leading-relaxed text-slate-600">
      {String(data.content)}
    </div>
  );
}

