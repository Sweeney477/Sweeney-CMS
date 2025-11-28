'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import {
  deleteWebhookAction,
  retryWebhookDeliveryAction,
  saveWebhookAction,
} from "@/server/actions/integration-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const EVENT_OPTIONS = [
  { value: "page.published", label: "Page published" },
  { value: "page.unpublished", label: "Page unpublished" },
  { value: "revision.scheduled", label: "Revision scheduled" },
  { value: "revision.unscheduled", label: "Revision unscheduled" },
];

type WebhookSummary = {
  id: string;
  name: string;
  url: string;
  events: string[];
  isEnabled: boolean;
  secret: string;
  updatedAt: string;
};

type DeliverySummary = {
  id: string;
  eventType: string;
  status: "PENDING" | "DELIVERED" | "FAILED";
  createdAt: string;
  deliveredAt: string | null;
  responseCode: number | null;
  errorMessage: string | null;
  webhookName: string;
};

type WebhookManagerProps = {
  siteId: string;
  webhooks: WebhookSummary[];
  deliveries: DeliverySummary[];
};

export function WebhookManager({
  siteId,
  webhooks,
  deliveries,
}: WebhookManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const editingWebhook = useMemo(
    () => webhooks.find((webhook) => webhook.id === editingId) ?? null,
    [editingId, webhooks],
  );

  useEffect(() => {
    if (!editingWebhook) {
      formRef.current?.reset();
    }
  }, [editingWebhook]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set("siteId", siteId);
    if (editingWebhook) {
      formData.set("webhookId", editingWebhook.id);
    }

    if (!formData.has("isEnabled")) {
      formData.set("isEnabled", "false");
    }

    startTransition(async () => {
      setStatus(null);
      setError(null);
      const result = await saveWebhookAction(formData);
      if (result.success) {
        setStatus(editingWebhook ? "Webhook updated" : "Webhook created");
        setEditingId(null);
        formRef.current?.reset();
      } else {
        setError(result.error);
      }
    });
  };

  const deleteWebhook = (webhookId: string) => {
    const formData = new FormData();
    formData.append("webhookId", webhookId);
    startTransition(async () => {
      setStatus(null);
      setError(null);
      const result = await deleteWebhookAction(formData);
      if (!result.success) {
        setError(result.error);
      }
    });
  };

  const retryDelivery = (deliveryId: string) => {
    const formData = new FormData();
    formData.append("deliveryId", deliveryId);
    startTransition(async () => {
      await retryWebhookDeliveryAction(formData);
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Webhooks</CardTitle>
        <CardDescription>Notify downstream systems when publishing events happen.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3 rounded-lg border border-slate-200 p-4">
            {webhooks.length === 0 && (
              <p className="text-sm text-slate-500">No webhooks configured.</p>
            )}
            {webhooks.map((webhook) => (
              <div
                key={webhook.id}
                className="rounded-md border border-slate-200 bg-white p-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{webhook.name}</p>
                    <p className="text-xs text-slate-500">{webhook.url}</p>
                  </div>
                  <Badge variant={webhook.isEnabled ? "default" : "outline"}>
                    {webhook.isEnabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {webhook.events.length ? (
                    webhook.events.map((event) => (
                      <Badge key={event} variant="outline">
                        {event}
                      </Badge>
                    ))
                  ) : (
                    <Badge variant="outline">All events</Badge>
                  )}
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingId(webhook.id)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => deleteWebhook(webhook.id)}
                    disabled={isPending}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <form
            ref={formRef}
            onSubmit={handleSubmit}
            className="space-y-4 rounded-lg border border-slate-200 p-4"
          >
            <div className="flex items-center justify-between">
              <p className="font-semibold text-slate-900">
                {editingWebhook ? "Edit webhook" : "New webhook"}
              </p>
              {editingWebhook && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingId(null)}
                >
                  Cancel
                </Button>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="webhook-name">Name</Label>
              <Input
                id="webhook-name"
                name="name"
                defaultValue={editingWebhook?.name}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="webhook-url">URL</Label>
              <Input
                id="webhook-url"
                name="url"
                type="url"
                defaultValue={editingWebhook?.url}
                placeholder="https://hooks.example.com/cms"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="webhook-secret">Shared secret</Label>
              <Input
                id="webhook-secret"
                name="secret"
                type="text"
                defaultValue={editingWebhook?.secret}
                placeholder="Optional signature secret"
              />
            </div>
            <div className="space-y-2">
              <Label>Events</Label>
              <div className="space-y-2">
                {EVENT_OPTIONS.map((option) => (
                  <label key={option.value} className="flex gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      name="events"
                      value={option.value}
                      defaultChecked={
                        editingWebhook?.events.includes(option.value) ?? false
                      }
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900/40"
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-slate-500">
                Leave all unchecked to receive every event.
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                name="isEnabled"
                defaultChecked={editingWebhook?.isEnabled ?? true}
                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900/40"
              />
              Enabled
            </label>
            {status && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                {status}
              </div>
            )}
            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}
            <Button type="submit" disabled={isPending}>
              {editingWebhook ? "Update webhook" : "Create webhook"}
            </Button>
          </form>
        </div>

        <div className="rounded-lg border border-slate-200">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600">
            Recent deliveries
          </div>
          <ul className="divide-y divide-slate-100">
            {deliveries.map((delivery) => (
              <li key={delivery.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <div className="flex-1">
                  <p className="font-medium text-slate-900">
                    {delivery.webhookName}
                  </p>
                  <p className="text-xs text-slate-500">{delivery.eventType}</p>
                  <p className="text-xs text-slate-500">
                    {formatDate(delivery.createdAt)}
                    {delivery.responseCode && ` · HTTP ${delivery.responseCode}`}
                    {delivery.errorMessage && ` · ${delivery.errorMessage}`}
                  </p>
                </div>
                <Badge variant={badgeVariant(delivery.status)}>
                  {delivery.status.toLowerCase()}
                </Badge>
                {delivery.status === "FAILED" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => retryDelivery(delivery.id)}
                  >
                    Retry
                  </Button>
                )}
              </li>
            ))}
            {deliveries.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-slate-500">
                No deliveries yet.
              </li>
            )}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

function formatDate(isoDate: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(isoDate));
}

function badgeVariant(status: DeliverySummary["status"]) {
  if (status === "DELIVERED") {
    return "success" as const;
  }
  if (status === "FAILED") {
    return "warning" as const;
  }
  return "outline" as const;
}

