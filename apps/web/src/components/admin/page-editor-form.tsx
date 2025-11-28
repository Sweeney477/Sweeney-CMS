import { env } from "@/env";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { RenderablePage } from "@/server/services/page-service";
import {
  publishPageAction,
  savePageContentAction,
} from "@/server/actions/page-actions";

type Props = {
  page: RenderablePage;
  previewSecret: string;
};

export function PageEditorForm({ page, previewSecret }: Props) {
  const hero = page.blocks.find((block) => block.kind === "hero")?.data ?? {};
  const richText =
    (page.blocks.find((block) => block.kind === "rich-text")?.data ?? {})
      .content ?? "";
  const rawFeatures =
    (page.blocks.find((block) => block.kind === "feature-grid")?.data ?? {})
      .items ?? [];
  const featureItems = Array.isArray(rawFeatures)
    ? (rawFeatures as Array<{ title?: string; body?: string }>)
    : [];
  const seoTitle =
    typeof page.metadata.seoTitle === "string" ? page.metadata.seoTitle : "";
  const seoDescription =
    typeof page.metadata.seoDescription === "string"
      ? page.metadata.seoDescription
      : "";

  const previewUrl = new URL("/api/preview", env.NEXT_PUBLIC_APP_URL);
  previewUrl.searchParams.set("token", previewSecret);
  previewUrl.searchParams.set("path", page.path);
  previewUrl.searchParams.set("site", page.site.slug);

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <div>
          <CardTitle>Edit content</CardTitle>
          <p className="text-sm text-slate-500">
            Save to create a draft revision, then publish or share a preview.
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <a href={previewUrl.toString()} target="_blank" rel="noreferrer">
            Open preview
          </a>
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        <form action={savePageContentAction} className="space-y-6">
          <input type="hidden" name="pageId" value={page.id} />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="heroEyebrow">Eyebrow</Label>
              <Input
                id="heroEyebrow"
                name="heroEyebrow"
                defaultValue={String(hero.eyebrow ?? "")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="heroHeading">Heading</Label>
              <Input
                id="heroHeading"
                name="heroHeading"
                defaultValue={String(hero.heading ?? "")}
                required
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ctaLabel">CTA label</Label>
              <Input
                id="ctaLabel"
                name="ctaLabel"
                defaultValue={String(hero.ctaLabel ?? "")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ctaHref">CTA link</Label>
              <Input
                id="ctaHref"
                name="ctaHref"
                defaultValue={String(hero.ctaHref ?? "")}
                placeholder="/contact"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="heroBody">Lead</Label>
            <Textarea
              id="heroBody"
              name="heroBody"
              defaultValue={String(hero.body ?? "")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="richText">Body content</Label>
            <Textarea
              id="richText"
              name="richText"
              defaultValue={String(richText ?? "")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="featureList">Feature list (one per line)</Label>
            <Textarea
              id="featureList"
              name="featureList"
              defaultValue={featureItems.map((item) => item.title ?? "").join("\n")}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="seoTitle">SEO title</Label>
              <Input
                id="seoTitle"
                name="seoTitle"
                defaultValue={seoTitle}
                placeholder="Sweeney CMS — Build multi-site experiences"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="seoDescription">SEO description</Label>
              <Textarea
                id="seoDescription"
                name="seoDescription"
                defaultValue={seoDescription}
                className="min-h-[80px]"
              />
            </div>
          </div>
          <Button type="submit">Save draft</Button>
        </form>

        <form action={publishPageAction} className="flex items-center gap-4">
          <input type="hidden" name="pageId" value={page.id} />
          <Button type="submit" variant="secondary">
            Publish latest draft
          </Button>
          <p className="text-xs text-slate-500">
            Publishing will update the live site and invalidate cached pages.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

