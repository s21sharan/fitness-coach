"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { convertDBToUIMessage, type ConversationSummary } from "@/lib/chat/conversation";

interface ChatContextValue {
  messages: UIMessage[];
  status: "submitted" | "streaming" | "ready" | "error";
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  historyLoaded: boolean;
  sendMessage: (text: string) => void;
  setMessages: (messages: UIMessage[]) => void;
  switchConversation: (id: string) => Promise<void>;
  startNewConversation: () => void;
  refreshConversations: () => Promise<void>;
  renameConversation: (id: string, title: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextValue | null>(null);

interface DBMessage {
  id: string;
  role: string;
  content: string;
  tool_calls: unknown;
  created_at: string;
}

// Build a transport instance ONCE per mount. The activeConversationId is
// piped in through a ref so we don't re-create the transport (and lose the
// in-flight fetch) every time it changes.
function useTransport(getActiveId: () => string | null) {
  return useMemo(() => {
    return new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: ({ messages, body }) => ({
        body: {
          ...body,
          messages,
          conversationId: getActiveId(),
        },
      }),
    });
    // getActiveId is a stable ref accessor; transport stays the same forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const activeIdRef = useRef<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const transport = useTransport(() => activeIdRef.current);

  const { messages, sendMessage, status, setMessages } = useChat({ transport });

  const setActiveId = useCallback((id: string | null) => {
    activeIdRef.current = id;
    setActiveConversationId(id);
  }, []);

  const refreshConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/conversations");
      const data = await res.json();
      setConversations((data?.conversations ?? []) as ConversationSummary[]);
    } catch {
      // best-effort; sidebar stays with last good state
    }
  }, []);

  const loadConversationMessages = useCallback(
    async (id: string | null) => {
      const url = id ? `/api/chat/messages?conversationId=${id}` : "/api/chat/messages";
      try {
        const res = await fetch(url);
        const data = await res.json();
        const dbMsgs = (data?.messages ?? []) as DBMessage[];
        const ui = dbMsgs.map(convertDBToUIMessage) as unknown as UIMessage[];
        setMessages(ui);
        if (data?.conversationId) setActiveId(data.conversationId as string);
      } catch {
        // empty
      }
    },
    [setActiveId, setMessages],
  );

  // Initial hydrate: load conversations and the most recent thread.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [convRes, msgRes] = await Promise.all([
          fetch("/api/chat/conversations").then((r) => r.json()),
          fetch("/api/chat/messages").then((r) => r.json()),
        ]);
        if (cancelled) return;
        setConversations((convRes?.conversations ?? []) as ConversationSummary[]);
        const dbMsgs = (msgRes?.messages ?? []) as DBMessage[];
        if (dbMsgs.length > 0) {
          const ui = dbMsgs.map(convertDBToUIMessage) as unknown as UIMessage[];
          setMessages(ui);
        }
        if (msgRes?.conversationId) setActiveId(msgRes.conversationId as string);
      } finally {
        if (!cancelled) setHistoryLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setActiveId, setMessages]);

  // After a stream completes, refresh the sidebar so a newly-created /
  // auto-titled conversation shows up. We piggyback on `status` transitions
  // — when it returns to "ready" after streaming, refresh.
  const prevStatus = useRef(status);
  useEffect(() => {
    if (prevStatus.current !== status && (prevStatus.current === "streaming" || prevStatus.current === "submitted") && status === "ready") {
      // Slight delay so the server-side auto-title commit has time to land.
      const t = window.setTimeout(() => {
        void refreshConversations();
      }, 500);
      return () => window.clearTimeout(t);
    }
    prevStatus.current = status;
  }, [status, refreshConversations]);

  const sendWrapper = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      sendMessage({ text });
    },
    [sendMessage],
  );

  const switchConversation = useCallback(
    async (id: string) => {
      if (id === activeIdRef.current) return;
      setActiveId(id);
      await loadConversationMessages(id);
    },
    [loadConversationMessages, setActiveId],
  );

  const startNewConversation = useCallback(() => {
    // Clear local id + messages. The server will create a conversation when
    // the next message lands, and we'll pick up the new id from the next
    // refresh. (We can't proactively create one without a message because the
    // sidebar would fill with empty threads if the user just clicks around.)
    setActiveId(null);
    setMessages([]);
  }, [setActiveId, setMessages]);

  const renameConversationFn = useCallback(
    async (id: string, title: string) => {
      await fetch(`/api/chat/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      await refreshConversations();
    },
    [refreshConversations],
  );

  const deleteConversationFn = useCallback(
    async (id: string) => {
      await fetch(`/api/chat/conversations/${id}`, { method: "DELETE" });
      if (id === activeIdRef.current) {
        setActiveId(null);
        setMessages([]);
      }
      await refreshConversations();
    },
    [refreshConversations, setActiveId, setMessages],
  );

  const value: ChatContextValue = {
    messages,
    status: status as ChatContextValue["status"],
    conversations,
    activeConversationId,
    historyLoaded,
    sendMessage: sendWrapper,
    setMessages,
    switchConversation,
    startNewConversation,
    refreshConversations,
    renameConversation: renameConversationFn,
    deleteConversation: deleteConversationFn,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChatContext(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatContext must be called inside <ChatProvider>");
  return ctx;
}
