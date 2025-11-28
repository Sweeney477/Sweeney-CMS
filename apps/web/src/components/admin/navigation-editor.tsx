import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { NavigationTreeItem } from "@/server/services/navigation-service";
import { createNavigationItemAction } from "@/server/actions/navigation-actions";

type Props = {
  menuId: string;
  items: NavigationTreeItem[];
};

export function NavigationEditor({ menuId, items }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Navigation</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3 rounded-lg border border-slate-200 px-4 py-4">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {item.label}
                </p>
                <p className="text-xs text-slate-500">{item.url}</p>
              </div>
              <Badge variant="outline">{item.openInNew ? "New tab" : "Same tab"}</Badge>
            </div>
          ))}
          {!items.length && (
            <p className="text-sm text-slate-500">
              No navigation items yet. Add your first link using the form.
            </p>
          )}
        </div>
        <form action={createNavigationItemAction} className="space-y-4">
          <input type="hidden" name="menuId" value={menuId} />
          <div className="space-y-2">
            <Label htmlFor="navLabel">Label</Label>
            <Input id="navLabel" name="label" placeholder="Contact" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="navUrl">URL</Label>
            <Input id="navUrl" name="url" placeholder="/contact" required />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <input
              id="openInNew"
              name="openInNew"
              type="checkbox"
              value="true"
              className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900/30"
            />
            <Label htmlFor="openInNew">Open in new tab</Label>
          </div>
          <Button type="submit">Add navigation item</Button>
        </form>
      </CardContent>
    </Card>
  );
}


