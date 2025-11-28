type ActivityFeedItem = {
  id: string;
  kind: string;
  occurredAt: string;
  actor?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  metadata?: Record<string, unknown>;
};

type ActivityFeedProps = {
  title?: string;
  items: ActivityFeedItem[];
  emptyState?: string;
};

export function ActivityFeed({ title = "Activity", items, emptyState }: ActivityFeedProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <span className="text-xs text-slate-500">{items.length} items</span>
      </div>
      {items.length === 0 && (
        <p className="text-sm text-slate-500">{emptyState ?? "No activity yet."}</p>
      )}
      {items.length > 0 && (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-xl border border-slate-100 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {formatActivityKind(item.kind)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {item.actor?.name ?? item.actor?.email ?? "System"}
                  </p>
                </div>
                <span className="text-xs text-slate-500">
                  {new Date(item.occurredAt).toLocaleString()}
                </span>
              </div>
              {typeof item.metadata?.note !== "undefined" && (
                <p className="mt-2 text-sm text-slate-600">{String(item.metadata.note)}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatActivityKind(kind: string) {
  return kind
    .replace(/^PUBLICATION_/i, "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^\w/, (letter) => letter.toUpperCase());
}


