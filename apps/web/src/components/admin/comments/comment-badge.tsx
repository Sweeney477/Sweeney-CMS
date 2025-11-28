import { useMemo } from "react";

import { useComments } from "./comments-provider";

type CommentBadgeProps = {
  blockId: string;
};

export function CommentBadge({ blockId }: CommentBadgeProps) {
  const { threads, openPanelForBlock } = useComments();
  const count = useMemo(
    () => threads.filter((thread) => thread.blockReferenceKey === blockId).length,
    [threads, blockId],
  );

  return (
    <button
      type="button"
      className="rounded-full border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:border-slate-400"
      onClick={() => openPanelForBlock(blockId)}
    >
      💬 {count}
    </button>
  );
}



