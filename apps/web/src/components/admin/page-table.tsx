import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

type PageSummary = {
  id: string;
  title: string;
  path: string;
  status: string;
  updatedAt: Date;
  publishedAt: Date | null;
};

type PageTableProps = {
  pages: PageSummary[];
};

const statusVariant: Record<string, "default" | "success" | "warning"> = {
  PUBLISHED: "success",
  DRAFT: "warning",
  ARCHIVED: "default",
};

export function PageTable({ pages }: PageTableProps) {
  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Pages</CardTitle>
        <Button variant="secondary" size="sm" asChild>
          <a href="#create-page">New Page</a>
        </Button>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <THead>
            <TR>
              <TH>Title</TH>
              <TH>Path</TH>
              <TH>Status</TH>
              <TH>Updated</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {pages.map((page) => (
              <TR key={page.id}>
                <TD className="font-medium text-slate-900">{page.title}</TD>
                <TD className="font-mono text-xs text-slate-500">{page.path}</TD>
                <TD>
                  <Badge variant={statusVariant[page.status] ?? "default"}>
                    {page.status.toLowerCase()}
                  </Badge>
                </TD>
                <TD className="text-xs text-slate-500">
                  {formatDistanceToNow(page.updatedAt, { addSuffix: true })}
                </TD>
                <TD className="text-right">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/admin/pages/${page.id}`}>Edit</Link>
                  </Button>
                </TD>
              </TR>
            ))}
            {!pages.length && (
              <TR>
                <TD colSpan={5} className="py-12 text-center text-sm text-slate-500">
                  No pages yet. Use the New Page button to create your first one.
                </TD>
              </TR>
            )}
          </TBody>
        </Table>
      </CardContent>
    </Card>
  );
}

