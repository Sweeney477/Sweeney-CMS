'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DateTime } from "luxon";

import { ActivityFeed } from "@/components/admin/activity-feed";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  cancelScheduleAction,
  markRevisionReviewedAction,
  requestReviewAction,
  returnRevisionToDraftAction,
  scheduleRevisionAction,
} from "@/server/actions/revision-actions";
import { publishPageAction, unpublishPageAction } from "@/server/actions/page-actions";
import type {
  RevisionDiff,
  RevisionSummary,
} from "@/server/services/revision-service";
import { env } from "@/env";

type RevisionPanelProps = {
  pageId: string;
  pagePath: string;
  siteSlug: string;
  siteTimezone: string;
  pageStatus: string;
  currentRevisionId?: string;
  revisions: RevisionSummary[];
  reviewEvents: ReviewEventItem[];
  publicationLog: PublicationLogItem[];
  activityFeed: ActivityFeedEntry[];
};

type PublicationLogItem = {
  id: string;
  action: string;
  source: string;
  occurredAt: string;
  metadata: Record<string, unknown>;
  actor: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  revision: {
    id: string;
    summary: string | null;
  } | null;
};

type ReviewEventItem = {
  id: string;
  type: string;
  note: string | null;
  createdAt: string;
  actor: {
    id: string;
    name: string | null;
    email: string;
  } | null;
};

type ActivityFeedEntry = {
  id: string;
  kind: string;
  occurredAt: string;
  metadata?: Record<string, unknown>;
  source: string;
  actor: {
    id: string;
    name: string | null;
    email: string;
  } | null;
};

export function RevisionPanel({
  pageId,
  pagePath,
  siteSlug,
  siteTimezone,
  pageStatus,
  currentRevisionId,
  revisions,
  reviewEvents,
  publicationLog,
  activityFeed,
}: RevisionPanelProps) {
  const router = useRouter();
  const [selectedRevisionId, setSelectedRevisionId] = useState(
    currentRevisionId ?? revisions[0]?.id ?? null,
  );
  const [diff, setDiff] = useState<RevisionDiff | null>(null);
  const [diffError, setDiffError] = useState<string | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [scheduleAt, setScheduleAt] = useState<string>("");
  const [workflowMessage, setWorkflowMessage] = useState<string | null>(null);
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [actionNote, setActionNote] = useState("");
  const [isWorking, startAction] = useTransition();
  const [, startScheduleSync] = useTransition();
  const [, startDiffSync] = useTransition();

  const selectedRevision = useMemo(
    () => revisions.find((revision) => revision.id === selectedRevisionId),
    [revisions, selectedRevisionId],
  );

  const scheduleTimezone = selectedRevision?.scheduledTimezone ?? siteTimezone;
  const scheduledDisplay = selectedRevision?.scheduledFor
    ? formatScheduleDisplay(selectedRevision.scheduledFor, scheduleTimezone)
    : null;
  const scheduleMinValue = useMemo(
    () => DateTime.now().setZone(scheduleTimezone).toFormat(INPUT_FORMAT),
    [scheduleTimezone],
  );

  useEffect(() => {
    startScheduleSync(() => {
      if (selectedRevision?.scheduledFor) {
        const formatted = toScheduleInputValue(
          selectedRevision.scheduledFor,
          scheduleTimezone,
        );
        setScheduleAt(formatted ?? "");
      } else {
        setScheduleAt("");
      }
    });
  }, [selectedRevision?.scheduledFor, scheduleTimezone, startScheduleSync]);

  useEffect(() => {
    if (!selectedRevisionId) {
      startDiffSync(() => {
        setDiff(null);
        setDiffError(null);
        setDiffLoading(false);
      });
      return;
    }

    startDiffSync(() => {
      setDiffLoading(true);
      setDiffError(null);
    });

    let cancelled = false;

    fetch(`/api/revisions/${selectedRevisionId}/diff`)
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json();
          throw new Error(payload.error ?? "Failed to load diff");
        }
        return response.json();
      })
      .then((payload) => {
        if (!cancelled) {
          startDiffSync(() => setDiff(payload as RevisionDiff));
        }
      })
      .catch((error) => {
        if (!cancelled) {
          startDiffSync(() => setDiffError(error.message));
        }
      })
      .finally(() => {
        if (!cancelled) {
          startDiffSync(() => setDiffLoading(false));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedRevisionId, startDiffSync]);

  const runAction = (
    action: (formData: FormData) => Promise<{ success: boolean; error?: string }>,
    nextMessage: string,
    noteOverride?: string,
  ) => {
    if (!selectedRevisionId) {
      return;
    }
    setWorkflowMessage(null);
    setWorkflowError(null);
    startAction(async () => {
      const formData = new FormData();
      formData.append("pageId", pageId);
      formData.append("revisionId", selectedRevisionId);
      const note = (noteOverride ?? actionNote).trim();
      if (note) {
        formData.append("message", note);
      }
      const result = await action(formData);
      if (!result.success) {
        setWorkflowError(result.error ?? "Action failed");
        return;
      }
      setWorkflowMessage(nextMessage);
      setActionNote("");
      router.refresh();
    });
  };

  const handlePublish = () => {
    if (!selectedRevisionId) {
      return;
    }
    startAction(async () => {
      setWorkflowMessage(null);
      setWorkflowError(null);
      const formData = new FormData();
      formData.append("pageId", pageId);
      formData.append("revisionId", selectedRevisionId);
      const result = await publishPageAction(formData);
      if (!result.success) {
        setWorkflowError(result.error ?? "Publish failed");
        return;
      }
      setWorkflowMessage("Revision published");
      router.refresh();
    });
  };

  const handleUnpublish = () => {
    setWorkflowMessage(null);
    setWorkflowError(null);
    startAction(async () => {
      const formData = new FormData();
      formData.append("pageId", pageId);
      const result = await unpublishPageAction(formData);
      if (!result.success) {
        setWorkflowError(result.error ?? "Unable to unpublish page.");
        return;
      }
      setWorkflowMessage("Page unpublished");
      router.refresh();
    });
  };

  const handleSchedule = () => {
    if (!selectedRevisionId || !scheduleAt) {
      return;
    }
    const parsed = parseScheduleInput(scheduleAt, scheduleTimezone);
    if (!parsed) {
      setWorkflowError("Choose a valid time in the future.");
      return;
    }
    if (parsed.toUTC().toMillis() <= Date.now()) {
      setWorkflowError("Choose a time in the future.");
      return;
    }
    setWorkflowMessage(null);
    setWorkflowError(null);
    startAction(async () => {
      const formData = new FormData();
      formData.append("pageId", pageId);
      formData.append("revisionId", selectedRevisionId);
      formData.append("scheduledAt", scheduleAt);
      formData.append("scheduledTimezone", scheduleTimezone);
      const result = await scheduleRevisionAction(formData);
      if (!result.success) {
        setWorkflowError(result.error ?? "Scheduling failed");
        return;
      }
      setWorkflowMessage("Revision scheduled");
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Workflow</CardTitle>
          <p className="text-sm text-slate-500">
            Manage review, approvals, and publishing for the selected revision.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-600">Status:</span>
            {selectedRevision ? (
              <Badge variant="outline">{selectedRevision.status.toLowerCase()}</Badge>
            ) : (
              <span className="text-sm text-slate-500">No revision selected</span>
            )}
          </div>

          <div>
            <Label className="text-xs uppercase text-slate-500">Review note</Label>
            <Textarea
              value={actionNote}
              onChange={(event) => setActionNote(event.target.value)}
              rows={2}
              placeholder="Share context with reviewers (optional)"
            />
            <p className="text-xs text-slate-500">
              This note is included when submitting, approving, or requesting changes.
            </p>
          </div>

          {selectedRevision?.status === "DRAFT" && (
            <Button
              type="button"
              disabled={isWorking}
              onClick={() =>
                runAction(requestReviewAction, "Revision sent to review", actionNote)
              }
            >
              Submit for review
            </Button>
          )}

          {selectedRevision?.status === "REVIEW" && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  disabled={isWorking}
                  onClick={() =>
                    runAction(markRevisionReviewedAction, "Revision approved", actionNote)
                  }
                >
                  Mark as reviewed
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isWorking}
                  onClick={() =>
                    runAction(
                      returnRevisionToDraftAction,
                      "Revision returned to draft",
                      actionNote,
                    )
                  }
                >
                  Request changes
                </Button>
              </div>
              <div className="space-y-2 rounded-xl border border-slate-200 p-3">
                <Label className="text-xs uppercase text-slate-500">Schedule publish</Label>
                <Input
                  type="datetime-local"
                  value={scheduleAt}
                  onChange={(event) => setScheduleAt(event.target.value)}
                  min={scheduleMinValue}
                />
                <p className="text-xs text-slate-500">
                  Times are stored in {scheduleTimezone}.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={isWorking || !scheduleAt}
                  onClick={handleSchedule}
                >
                  Schedule publish
                </Button>
              </div>
            </div>
          )}

          {selectedRevision?.status === "SCHEDULED" && (
            <div className="space-y-2 rounded-xl border border-slate-200 p-3">
              <p className="text-sm text-slate-600">
                Scheduled for{" "}
                {scheduledDisplay ?? "TBD"} ({scheduleTimezone})
              </p>
              <Button
                type="button"
                variant="outline"
                disabled={isWorking}
                onClick={() => runAction(cancelScheduleAction, "Schedule cancelled")}
              >
                Cancel schedule
              </Button>
            </div>
          )}

          {selectedRevision && selectedRevision.status !== "PUBLISHED" && (
            <Button type="button" variant="ghost" disabled={isWorking} onClick={handlePublish}>
              Publish now
            </Button>
          )}
          {pageStatus === "PUBLISHED" && (
            <Button
              type="button"
              variant="secondary"
              disabled={isWorking}
              onClick={handleUnpublish}
            >
              Unpublish page
            </Button>
          )}

          {workflowMessage && <p className="text-sm text-emerald-600">{workflowMessage}</p>}
          {workflowError && <p className="text-sm text-red-600">{workflowError}</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Review history</CardTitle>
          <p className="text-sm text-slate-500">
            Notes left when reviewers approve or request changes.
          </p>
        </CardHeader>
        <CardContent>
          {reviewEvents.length === 0 && (
            <p className="text-sm text-slate-500">No review activity yet.</p>
          )}
          {reviewEvents.length > 0 && (
            <ul className="space-y-3">
              {reviewEvents.map((event) => (
                <li key={event.id} className="rounded-xl border border-slate-100 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-700">
                      {event.actor?.name ?? event.actor?.email ?? "Unknown reviewer"}
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Date(event.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs uppercase text-slate-400">{event.type.toLowerCase()}</p>
                  {event.note && <p className="text-sm text-slate-600">{event.note}</p>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <ActivityFeed
        title="Activity"
        items={activityFeed}
        emptyState="No recent collaboration activity."
      />

      <Card>
        <CardHeader>
          <CardTitle>Revision history</CardTitle>
          <p className="text-sm text-slate-500">
            Select any revision to inspect changes and compare against the live site.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {revisions.map((revision) => (
              <button
                type="button"
                key={revision.id}
                className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                  revision.id === selectedRevisionId
                    ? "border-slate-900 bg-slate-900/5"
                    : "border-slate-200 hover:border-slate-300"
                }`}
                onClick={() => setSelectedRevisionId(revision.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{revision.status.toLowerCase()}</Badge>
                    <span className="text-xs text-slate-500">
                      {new Date(revision.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {revision.publishedAt && (
                    <span className="text-xs text-emerald-600">Published</span>
                  )}
                </div>
                <p className="mt-1 text-sm font-medium text-slate-700">
                  {revision.summary ?? "Content update"}
                </p>
                <p className="text-xs text-slate-500">
                  {revision.author?.name ?? revision.author?.email ?? "Unknown author"}
                </p>
              </button>
            ))}
            {!revisions.length && (
              <p className="text-sm text-slate-500">No revisions yet—save a draft to get started.</p>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-sm font-semibold text-slate-700">Differences</p>
            {diffLoading && <p className="text-sm text-slate-500">Loading diff…</p>}
            {diffError && <p className="text-sm text-red-600">{diffError}</p>}
            {!diffLoading && diff && (
              <div className="mt-3 space-y-3 text-sm text-slate-600">
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-400">Blocks</p>
                  {diff.blocks.length ? (
                    <ul className="mt-1 space-y-1">
                      {diff.blocks.map((block) => (
                        <li key={`${block.index}-${block.kind}`} className="flex items-center gap-3">
                          <ChangeBadge change={block.change} />
                          <span>
                            Section {block.index + 1} · {block.kind ?? "unknown"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-500">No changes detected.</p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-400">Metadata</p>
                  {diff.metadata.length ? (
                    <ul className="mt-1 space-y-1">
                      {diff.metadata.map((meta) => (
                        <li key={meta.key} className="flex items-center gap-3">
                          <ChangeBadge change={meta.change} />
                          <span>{meta.key}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-500">No metadata changes.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      <RevisionPreviewLinks
        revisionId={selectedRevisionId}
        siteSlug={siteSlug}
        pagePath={pagePath}
      />
      <PublicationActivity publicationLog={publicationLog} />
    </div>
  );
}

function ChangeBadge({ change }: { change: RevisionDiff["blocks"][number]["change"] }) {
  const map: Record<string, string> = {
    added: "bg-emerald-100 text-emerald-700",
    removed: "bg-rose-100 text-rose-700",
    modified: "bg-amber-100 text-amber-700",
    unchanged: "bg-slate-100 text-slate-600",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${map[change] ?? map.unchanged}`}>
      {change}
    </span>
  );
}

const INPUT_FORMAT = "yyyy-LL-dd'T'HH:mm";

function toScheduleInputValue(
  value: string | Date,
  timezone: string,
): string | null {
  const iso = typeof value === "string" ? value : value.toISOString();
  const dt = DateTime.fromISO(iso, { zone: "utc" }).setZone(timezone);
  return dt.isValid ? dt.toFormat(INPUT_FORMAT) : null;
}

function parseScheduleInput(value: string, timezone: string) {
  const dt = DateTime.fromFormat(value, INPUT_FORMAT, { zone: timezone });
  return dt.isValid ? dt : null;
}

function formatScheduleDisplay(value: string | Date, timezone: string) {
  const iso = typeof value === "string" ? value : value.toISOString();
  const dt = DateTime.fromISO(iso, { zone: "utc" }).setZone(timezone);
  if (!dt.isValid) {
    return new Date(value).toLocaleString();
  }
  return dt.toFormat("MMM d, yyyy h:mm a");
}

function PublicationActivity({ publicationLog }: { publicationLog: PublicationLogItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Publishing activity</CardTitle>
        <p className="text-sm text-slate-500">
          Recent publish, unpublish, and scheduling events for this page.
        </p>
      </CardHeader>
      <CardContent>
        {publicationLog.length === 0 ? (
          <p className="text-sm text-slate-500">No activity recorded yet.</p>
        ) : (
          <ul className="space-y-3">
            {publicationLog.map((event) => (
              <li
                key={event.id}
                className="rounded-lg border border-slate-200 p-3 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-800">
                      {formatActionLabel(event.action)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(event.occurredAt).toLocaleString()} ·{" "}
                      {formatSourceLabel(event.source)}
                    </p>
                  </div>
                  <Badge variant="outline">{event.action.toLowerCase()}</Badge>
                </div>
                {event.actor && (
                  <p className="text-xs text-slate-500">
                    By {event.actor.name ?? event.actor.email}
                  </p>
                )}
                {event.revision?.summary && (
                  <p className="mt-1 text-slate-600">
                    “{event.revision.summary}”
                  </p>
                )}
                {renderMetadataDetail(event.action, event.metadata)}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function formatActionLabel(action: string) {
  switch (action) {
    case "PUBLISH":
      return "Published";
    case "UNPUBLISH":
      return "Unpublished";
    case "SCHEDULE":
      return "Schedule created";
    case "UNSCHEDULE":
      return "Schedule cancelled";
    case "AUTO_PUBLISH":
      return "Auto-published";
    default:
      return action.toLowerCase();
  }
}

function formatSourceLabel(source: string) {
  switch (source) {
    case "MANUAL":
      return "Manual";
    case "SCHEDULER":
      return "Scheduler";
    case "SYSTEM":
      return "System";
    default:
      return source;
  }
}

function renderMetadataDetail(action: string, metadata: Record<string, unknown>) {
  if (!metadata) {
    return null;
  }

  const scheduledFor = metadata["scheduledFor"];
  const timezoneValue = metadata["timezone"];
  const previousTimezone = metadata["previousTimezone"];

  if (action === "SCHEDULE" && typeof scheduledFor === "string") {
    const timezone =
      typeof timezoneValue === "string" ? timezoneValue : "UTC";
    return (
      <p className="mt-2 text-xs text-slate-500">
        Scheduled for {formatScheduleDisplay(scheduledFor, timezone)} ({timezone})
      </p>
    );
  }

  if (
    action === "UNSCHEDULE" &&
    typeof scheduledFor === "string"
  ) {
    const timezone =
      typeof previousTimezone === "string" ? previousTimezone : "UTC";
    return (
      <p className="mt-2 text-xs text-slate-500">
        Removed schedule ({formatScheduleDisplay(scheduledFor, timezone)} {timezone})
      </p>
    );
  }

  return null;
}

type PreviewToken = {
  id: string;
  token: string;
  expiresAt: string;
  revoked: boolean;
  revokedAt: string | null;
  createdAt: string;
};

function RevisionPreviewLinks({
  revisionId,
  siteSlug,
  pagePath,
}: {
  revisionId: string | null;
  siteSlug: string;
  pagePath: string;
}) {
  const [tokens, setTokens] = useState<PreviewToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const loadTokens = useCallback(async () => {
    if (!revisionId) {
      setTokens([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/revisions/${revisionId}/preview-tokens`);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Failed to load preview links.");
      }
      const payload = (await response.json()) as { tokens?: PreviewToken[] };
      setTokens(payload.tokens ?? []);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load preview links.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [revisionId]);

  useEffect(() => {
    setMessage(null);
    setError(null);
    void loadTokens();
  }, [loadTokens]);

  const handleCreate = async () => {
    if (!revisionId) {
      return;
    }
    setIsCreating(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(`/api/revisions/${revisionId}/preview-tokens`, {
        method: "POST",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Unable to create preview link.");
      }
      await loadTokens();
      setMessage("Preview link created.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to create preview link.";
      setError(message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevoke = async (tokenId: string) => {
    if (!revisionId) {
      return;
    }
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/revisions/${revisionId}/preview-tokens/${tokenId}`,
        {
          method: "DELETE",
        },
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Unable to revoke preview link.");
      }
      await loadTokens();
      setMessage("Preview link revoked.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to revoke preview link.";
      setError(message);
    }
  };

  const handleCopy = async (token: string) => {
    const url = buildPreviewUrl(token, siteSlug, pagePath);
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Copied preview link to clipboard.");
    } catch {
      setError("Failed to copy link. Copy manually from the list below.");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preview links</CardTitle>
        <p className="text-sm text-slate-500">
          Generate expiring share links for the selected revision. Links can be revoked at any time.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!revisionId && (
          <p className="text-sm text-slate-500">
            Save a draft revision to generate preview links.
          </p>
        )}
        {revisionId && (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" onClick={handleCreate} disabled={isCreating}>
                {isCreating ? "Creating…" : "Create preview link"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={loadTokens}
                disabled={loading}
              >
                Refresh
              </Button>
            </div>
            {message && <p className="text-sm text-emerald-600">{message}</p>}
            {error && <p className="text-sm text-red-600">{error}</p>}
            {loading && <p className="text-sm text-slate-500">Loading preview links…</p>}
            {!loading && tokens.length === 0 && (
              <p className="text-sm text-slate-500">
                No active preview links yet. Create one above to share this revision.
              </p>
            )}
            {!loading && tokens.length > 0 && (
              <ul className="space-y-3">
                {tokens.map((token) => (
                  <li
                    key={token.id}
                    className="rounded-lg border border-slate-200 p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge variant="outline">{formatTokenStatus(token)}</Badge>
                      <span className="text-xs text-slate-500">
                        Expires{" "}
                        {new Date(token.expiresAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-2 break-all font-mono text-xs text-slate-500">
                      {buildPreviewUrl(token.token, siteSlug, pagePath)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => handleCopy(token.token)}
                      >
                        Copy link
                      </Button>
                      {!token.revoked && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:bg-red-50 hover:text-red-700"
                          onClick={() => handleRevoke(token.id)}
                        >
                          Revoke
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function buildPreviewUrl(token: string, siteSlug: string, pagePath: string) {
  const url = new URL("/api/preview", env.NEXT_PUBLIC_APP_URL);
  url.searchParams.set("token", token);
  url.searchParams.set("site", siteSlug);
  url.searchParams.set("path", pagePath);
  return url.toString();
}

function formatTokenStatus(token: PreviewToken) {
  if (token.revoked) {
    return "revoked";
  }
  if (new Date(token.expiresAt).getTime() <= Date.now()) {
    return "expired";
  }
  return "active";
}
