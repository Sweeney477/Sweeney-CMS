import { createPageAction } from "@/server/actions/page-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  siteId: string;
};

export function NewPageForm({ siteId }: Props) {
  return (
    <Card id="create-page">
      <CardHeader>
        <CardTitle>Create a new page</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={createPageAction} className="space-y-4">
          <input type="hidden" name="siteId" value={siteId} />
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" placeholder="About us" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              name="slug"
              placeholder="about-us"
              pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
              required
            />
            <p className="text-xs text-slate-500">
              The page will be published at /slug. Use lowercase letters and
              dashes.
            </p>
          </div>
          <Button type="submit">Create page</Button>
        </form>
      </CardContent>
    </Card>
  );
}

