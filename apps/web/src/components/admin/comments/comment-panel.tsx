import { useMemo, useState } from "react";

import type { BlockPayload } from "@/lib/blocks";

import { useComments } from "./comments-provider";

type CommentPanelProps = {
  blocks: BlockPayload[];
};

export function CommentPanel({ blocks }: CommentPanelProps) {
  const {
    threads,
    activeBlockId,
    closePanel,
    createThread,
    replyToThread,
    updateThreadStatus,
  } = useComments();
  const [newMessage, setNewMessage] = useState("");
  const blockMeta = useMemo(() => {
    return blocks.map((block, index) => ({
      id: block.id ?? `block-${index}`,
      label: `Section ${index + 1}`,
    }));
  }, [blocks]);

  const activeBlock = blockMeta.find((block) => block.id === activeBlockId);
  const blockThreads = threads.filter((thread) => thread.blockReferenceKey === activeBlockId);

  const handleCreate = async () => {
    if (!activeBlockId || !newMessage.trim()) {
      return;
    }
    await createThread(activeBlockId, newMessage.trim());
    setNewMessage("");
  };

  if (!activeBlockId) {
    return null;
  }

  return (
    <aside className="fixed right-6 top-32 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase text-slate-400">Comments</p>
          <h3 className="text-lg font-semibold text-slate-900">
            {activeBlock?.label ?? "Selected block"}
          </h3>
        </div>
        <button
          type="button"
          className="text-sm text-slate-500 hover:text-slate-900"
          onClick={closePanel}
        >
          Close
        </button>
      </div>

      <div className="mt-4 space-y-4 max-h-[60vh] overflow-y-auto pr-2">
        {blockThreads.map((thread) => (
          <div key={thread.id} className="rounded-xl border border-slate-200 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  thread.status === "RESOLVED"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {thread.status.toLowerCase()}
              </span>
              <button
                type="button"
                className="text-xs text-slate-500 hover:text-slate-900"
                onClick={() =>
                  updateThreadStatus(thread.id, thread.status === "RESOLVED" ? "OPEN" : "RESOLVED")
                }
              >
                {thread.status === "RESOLVED" ? "Reopen" : "Resolve"}
              </button>
            </div>

            <ul className="space-y-3">
              {thread.comments.map((comment) => (
                <li key={comment.id} className="rounded-lg bg-slate-50 p-3">
                  <p className="text-sm text-slate-900">{comment.body}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {comment.author?.name ?? comment.author?.email ?? "Unknown"} ·{" "}
                    {new Date(comment.createdAt).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>

            <ReplyForm
              placeholder="Reply to this thread..."
              onSubmit={async (value) => {
                await replyToThread(thread.id, value);
              }}
            />
          </div>
        ))}

        {!blockThreads.length && (
          <p className="text-sm text-slate-500">No comments yet for this block.</p>
        )}
      </div>

      <div className="mt-4 border-t border-slate-100 pt-4">
        <label className="text-xs font-semibold uppercase text-slate-500">New comment</label>
        <textarea
          className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-slate-900 focus:outline-none"
          rows={3}
          value={newMessage}
          onChange={(event) => setNewMessage(event.target.value)}
          placeholder="Start a new thread..."
        />
        <button
          type="button"
          className="mt-2 inline-flex items-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          onClick={handleCreate}
          disabled={!newMessage.trim()}
        >
          Start thread
        </button>
      </div>
    </aside>
  );
}

function ReplyForm({
  onSubmit,
  placeholder,
}: {
  onSubmit: (value: string) => Promise<void>;
  placeholder: string;
}) {
  const [value, setValue] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSubmit = async () => {
    if (!value.trim()) {
      return;
    }
    setIsSending(true);
    try {
      await onSubmit(value.trim());
      setValue("");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="mt-3">
      <textarea
        className="w-full rounded-xl border border-slate-200 p-2 text-sm focus:border-slate-900 focus:outline-none"
        rows={2}
        placeholder={placeholder}
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      <button
        type="button"
        className="mt-2 inline-flex items-center rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        onClick={handleSubmit}
        disabled={!value.trim() || isSending}
      >
        {isSending ? "Sending…" : "Reply"}
      </button>
    </div>
  );
}



