import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type CommentAuthor = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
};

export type CommentMessage = {
  id: string;
  body: string;
  createdAt: string;
  author: CommentAuthor | null;
};

export type CommentThread = {
  id: string;
  blockReferenceKey: string;
  status: "OPEN" | "RESOLVED";
  createdAt: string;
  createdBy: CommentAuthor | null;
  resolvedBy?: CommentAuthor | null;
  resolvedAt?: string | null;
  comments: CommentMessage[];
};

type CommentsContextValue = {
  threads: CommentThread[];
  isLoading: boolean;
  activeBlockId: string | null;
  openPanelForBlock: (blockId: string) => void;
  closePanel: () => void;
  createThread: (blockId: string, body: string) => Promise<void>;
  replyToThread: (threadId: string, body: string) => Promise<void>;
  updateThreadStatus: (threadId: string, status: "OPEN" | "RESOLVED") => Promise<void>;
};

const CommentsContext = createContext<CommentsContextValue | undefined>(undefined);

export type CommentsProviderProps = {
  revisionId?: string | null;
  children: React.ReactNode;
};

export function CommentsProvider({ revisionId, children }: CommentsProviderProps) {
  const [threads, setThreads] = useState<CommentThread[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);

  const loadThreads = useCallback(async () => {
    if (!revisionId) {
      setThreads([]);
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch(`/api/revisions/${revisionId}/comments`);
      if (!response.ok) {
        throw new Error("Unable to load comments.");
      }
      const payload = (await response.json()) as { threads?: CommentThread[] };
      setThreads(payload.threads ?? []);
    } catch (error) {
      console.error("Failed to load comment threads", error);
    } finally {
      setIsLoading(false);
    }
  }, [revisionId]);

  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  const createThread = useCallback(
    async (blockId: string, body: string) => {
      if (!revisionId) {
        return;
      }
      const response = await fetch(`/api/revisions/${revisionId}/comments`, {
        method: "POST",
        body: JSON.stringify({ blockReferenceKey: blockId, body }),
      });
      if (!response.ok) {
        throw new Error("Failed to create comment thread.");
      }
      await loadThreads();
    },
    [revisionId, loadThreads],
  );

  const replyToThread = useCallback(
    async (threadId: string, body: string) => {
      if (!revisionId) {
        return;
      }
      const response = await fetch(`/api/revisions/${revisionId}/comments/${threadId}`, {
        method: "POST",
        body: JSON.stringify({ body }),
      });
      if (!response.ok) {
        throw new Error("Failed to add comment.");
      }
      await loadThreads();
    },
    [revisionId, loadThreads],
  );

  const updateThreadStatus = useCallback(
    async (threadId: string, status: "OPEN" | "RESOLVED") => {
      if (!revisionId) {
        return;
      }
      const response = await fetch(`/api/revisions/${revisionId}/comments/${threadId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        throw new Error("Failed to update comment status.");
      }
      await loadThreads();
    },
    [revisionId, loadThreads],
  );

  const value = useMemo<CommentsContextValue>(
    () => ({
      threads,
      isLoading,
      activeBlockId,
      openPanelForBlock: setActiveBlockId,
      closePanel: () => setActiveBlockId(null),
      createThread,
      replyToThread,
      updateThreadStatus,
    }),
    [threads, isLoading, activeBlockId, createThread, replyToThread, updateThreadStatus],
  );

  return <CommentsContext.Provider value={value}>{children}</CommentsContext.Provider>;
}

export function useComments() {
  const context = useContext(CommentsContext);
  if (!context) {
    throw new Error("useComments must be used within a CommentsProvider.");
  }
  return context;
}

