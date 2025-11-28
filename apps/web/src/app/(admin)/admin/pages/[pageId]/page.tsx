import { notFound } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { PageEditorForm } from "@/components/admin/page-editor-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/server/auth/guards";
import { getRenderablePage } from "@/server/services/page-service";
import { listSites } from "@/server/services/site-service";
import { prisma } from "@/server/db";

type PageEditorProps = {
  params: { pageId: string };
};

export default async function PageEditor({ params }: PageEditorProps) {
  await requireUser();
  const pageRecord = await prisma.page.findUnique({
    where: { id: params.pageId },
    include: {
      site: true,
    },
  });

  if (!pageRecord) {
    notFound();
  }

  const sites = await listSites();
  const currentSite = pageRecord.site;

  const page = await getRenderablePage({
    siteId: pageRecord.siteId,
    path: pageRecord.path,
    includeDraft: true,
  });

  if (!page) {
    notFound();
  }

  return (
    <AdminShell
      currentPath={`/admin/pages/${page.id}`}
      sites={sites}
      activeSite={currentSite}
    >
      <Card>
        <CardHeader className="flex items-center justify-between">
          <div>
            <CardTitle>{page.title}</CardTitle>
            <p className="text-sm text-slate-500">{page.path}</p>
          </div>
          <Badge variant="outline">{page.status.toLowerCase()}</Badge>
        </CardHeader>
        <CardContent className="text-sm text-slate-600">
          <p>Site: {page.site.name}</p>
          <p>Revision: {page.revision?.status ?? "None"}</p>
        </CardContent>
      </Card>
      <PageEditorForm page={page} previewSecret={currentSite.previewSecret} />
    </AdminShell>
  );
}

