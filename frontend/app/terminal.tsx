import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { useAppColors } from "@/hooks/useAppColors";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationsContext";
import { ApiDirectMessage } from "@/constants/Types";
import {
  API_BASE_URL,
  ApiDirectMessageThread,
  createDirectMessage,
  getAllUsers,
  getDirectChatPeers,
  getDirectMessageThreads,
  getDirectMessages,
  getUsersFollowingUsernames,
} from "@/services/api";

type TerminalLine = {
  id: number;
  type: "cmd" | "out" | "err";
  text: string;
  chatRole?: "me" | "them";
};

type ChatEntry = {
  id: number;
  author: "me" | "them";
  text: string;
  timestamp: string;
};

type DirectMessageStreamEvent = {
  type: "direct_message";
  direct_message: ApiDirectMessage;
};

type TerminalSuggestion = {
  id: string;
  label: string;
  value: string;
};

const normalizeUsername = (value: string) =>
  value.replace(/^@+/, "").trim().toLowerCase();

const formatTime = (dateValue: string) => {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return "now";
  }
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
};

const mapMessageToChatEntry = (
  me: string,
  message: ApiDirectMessage,
): ChatEntry => {
  const myName = normalizeUsername(me);
  const sender = normalizeUsername(message.sender_name);
  return {
    id: message.id,
    author: sender === myName ? "me" : "them",
    text: message.content,
    timestamp: formatTime(message.created_at),
  };
};

const getPeerForMessage = (me: string, message: ApiDirectMessage) => {
  const myName = normalizeUsername(me);
  const sender = normalizeUsername(message.sender_name);
  const recipient = normalizeUsername(message.recipient_name);
  return sender === myName ? recipient : sender;
};

const getWebSocketBaseUrl = (baseUrl?: string) => {
  if (!baseUrl) {
    return "";
  }
  if (baseUrl.startsWith("https://")) {
    return `wss://${baseUrl.slice("https://".length)}`;
  }
  if (baseUrl.startsWith("http://")) {
    return `ws://${baseUrl.slice("http://".length)}`;
  }
  return baseUrl;
};

const truncatePreview = (text: string, max = 46) => {
  const value = text.trim();
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 1)}…`;
};

const formatInboxTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "now";
  }

  const diffMs = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) {
    return "now";
  }
  if (diffMs < hour) {
    return `${Math.floor(diffMs / minute)}m`;
  }
  if (diffMs < day) {
    return `${Math.floor(diffMs / hour)}h`;
  }
  return `${Math.floor(diffMs / day)}d`;
};

const parseApiErrorMessage = (error: unknown, fallback: string) => {
  if (!(error instanceof Error)) {
    return fallback;
  }

  const rawMessage = error.message?.trim();
  if (!rawMessage) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(rawMessage) as {
      error?: string;
      message?: string;
    };
    const value = parsed.error ?? parsed.message;
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  } catch {
    // Keep raw error text when message is not JSON.
  }

  return rawMessage;
};

const isMissingDirectMessageUserError = (error: unknown) => {
  const message = parseApiErrorMessage(error, "").toLowerCase();
  return (
    message.includes("failed to fetch direct messages") &&
    message.includes("not found")
  );
};

export default function TerminalScreen() {
  const colors = useAppColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ chat?: string | string[] }>();
  const { user, token } = useAuth();
  const { showInAppBanner } = useNotifications();
  const insets = useSafeAreaInsets();
  const outputRef = useRef<ScrollView>(null);
  const outputScrollRafRef = useRef<number | null>(null);
  const autoOpenedChatRef = useRef<string | null>(null);
  const activeChatRef = useRef<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const seenMessageIdsRef = useRef<Set<number>>(new Set());
  const spamWindowByPeerRef = useRef<Record<string, number[]>>({});
  const spamCooldownByPeerRef = useRef<Record<string, number>>({});
  const [input, setInput] = useState("");
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [chatThreads, setChatThreads] = useState<Record<string, ChatEntry[]>>(
    {},
  );
  const [allUsers, setAllUsers] = useState<string[]>([]);
  const [friendUsers, setFriendUsers] = useState<string[]>([]);
  const [chatPeers, setChatPeers] = useState<string[]>([]);
  const [lines, setLines] = useState<TerminalLine[]>([
    { id: 1, type: "out", text: "DevBits Terminal v1" },
    { id: 2, type: "out", text: "Type 'help' to list commands." },
    { id: 3, type: "out", text: "Open your inbox: inbox" },
    { id: 4, type: "out", text: "Start a chat: chat username" },
    { id: 5, type: "out", text: "" },
  ]);

  const movePeerToTop = useCallback((peerUsername: string) => {
    const normalizedPeer = normalizeUsername(peerUsername);
    if (!normalizedPeer) {
      return;
    }
    setChatPeers((prev) => [
      normalizedPeer,
      ...prev.filter((entry) => entry !== normalizedPeer),
    ]);
  }, []);

  const commandHelp = useMemo(
    () => [
      "help                   show available commands",
      "clear                  clear terminal output",
      "echo <text>            print text",
      "inbox                  show direct-message threads",
      "friends                list your follows and active chats",
      "chat <username>        open terminal chat session",
      "exit                   leave active chat session",
      "msg @user <text>       send message to a user",
      "open home|explore      navigate app sections",
      "status                 show current session status",
    ],
    [],
  );

  const commandNames = useMemo(
    () => [
      "help",
      "clear",
      "echo",
      "inbox",
      "friends",
      "chat",
      "exit",
      "msg",
      "open",
      "status",
    ],
    [],
  );

  useEffect(() => {
    let active = true;
    if (!user?.username) {
      setAllUsers([]);
      setFriendUsers([]);
      setChatPeers([]);
      return;
    }

    void Promise.all([
      getAllUsers(0, 200).catch(() => []),
      getUsersFollowingUsernames(user.username).catch(() => []),
      getDirectMessageThreads(user.username, 0, 100).catch(() => []),
      getDirectChatPeers(user.username).catch(() => []),
    ]).then(([users, following, threads, peers]) => {
      if (!active) {
        return;
      }
      const usernames = Array.isArray(users)
        ? users
            .map((entry) => entry.username)
            .filter((name): name is string => Boolean(name))
            .map((name) => normalizeUsername(name))
        : [];
      setAllUsers(Array.from(new Set(usernames)).sort());
      const follows = Array.isArray(following)
        ? following.map((name) => normalizeUsername(name)).filter(Boolean)
        : [];
      setFriendUsers(Array.from(new Set(follows)).sort());
      const threadPeers = Array.isArray(threads)
        ? threads
            .map((thread) => normalizeUsername(thread.peer_username))
            .filter(Boolean)
        : [];
      const peerNames = Array.isArray(peers)
        ? peers.map((name) => normalizeUsername(name)).filter(Boolean)
        : [];
      setChatPeers(Array.from(new Set([...threadPeers, ...peerNames])));
    });

    return () => {
      active = false;
    };
  }, [user?.username]);

  const suggestions = useMemo<TerminalSuggestion[]>(() => {
    const trimmed = input.trim();
    if (!trimmed) {
      return [];
    }

    if (activeChat) {
      const chatCommands = ["/help", "/exit"];
      return chatCommands
        .filter((item) => item.startsWith(trimmed.toLowerCase()))
        .map((item) => ({
          id: `chat-${item}`,
          label: item,
          value: item,
        }))
        .slice(0, 5);
    }

    const [commandRaw, ...args] = trimmed.split(/\s+/);
    const command = commandRaw.toLowerCase();

    if (!trimmed.includes(" ")) {
      return commandNames
        .filter((item) => item.startsWith(command))
        .map((item) => ({
          id: `cmd-${item}`,
          label: item,
          value: item,
        }))
        .slice(0, 5);
    }

    if (command === "open") {
      const target = (args[0] ?? "").toLowerCase();
      return ["home", "explore"]
        .filter((item) => item.startsWith(target))
        .map((item) => ({
          id: `open-${item}`,
          label: `open ${item}`,
          value: `open ${item}`,
        }));
    }

    if (command === "chat") {
      const typed = normalizeUsername(args[0] ?? "");
      const source = Array.from(
        new Set([
          ...friendUsers,
          ...chatPeers,
          ...Object.keys(chatThreads),
          ...allUsers,
        ]),
      );
      return source
        .filter((name) => !typed || name.startsWith(typed))
        .slice(0, 5)
        .map((name) => ({
          id: `chat-user-${name}`,
          label: `chat ${name}`,
          value: `chat ${name}`,
        }));
    }

    if (command === "msg") {
      const targetRaw = args[0] ?? "";
      const typed = normalizeUsername(targetRaw);
      const source = Array.from(new Set([...friendUsers, ...allUsers]));
      const base = source
        .filter((name) => !typed || name.startsWith(typed))
        .slice(0, 5)
        .map((name) => ({
          id: `msg-user-${name}`,
          label: `msg @${name}`,
          value: `msg @${name} `,
        }));

      if (args.length > 1) {
        return [];
      }
      return base;
    }

    return [];
  }, [
    activeChat,
    allUsers,
    chatPeers,
    chatThreads,
    commandNames,
    friendUsers,
    input,
  ]);

  const appendLines = (entries: Omit<TerminalLine, "id">[]) => {
    setLines((prev) => {
      const start = prev.length ? prev[prev.length - 1].id + 1 : 1;
      const mapped = entries.map((entry, index) => ({
        id: start + index,
        ...entry,
      }));
      return [...prev, ...mapped];
    });
  };

  const scheduleOutputScroll = useCallback((animated: boolean) => {
    if (outputScrollRafRef.current !== null) {
      cancelAnimationFrame(outputScrollRafRef.current);
      outputScrollRafRef.current = null;
    }
    outputScrollRafRef.current = requestAnimationFrame(() => {
      outputRef.current?.scrollToEnd({ animated });
      outputScrollRafRef.current = null;
    });
  }, []);

  const notifyIncomingMessage = useCallback(
    (peer: string, text: string) => {
      const now = Date.now();
      const windowMs = 5000;
      const spamThreshold = 10;
      const spamCooldownMs = 15000;
      const spamBannerHoldMs = 4000;

      const existing = spamWindowByPeerRef.current[peer] ?? [];
      const recent = existing.filter(
        (timestamp) => now - timestamp <= windowMs,
      );
      recent.push(now);
      spamWindowByPeerRef.current[peer] = recent;

      const lastSpam = spamCooldownByPeerRef.current[peer] ?? 0;
      if (recent.length >= spamThreshold && now - lastSpam > spamCooldownMs) {
        spamCooldownByPeerRef.current[peer] = now;
        showInAppBanner({
          title: "Spam detected",
          body: `@${peer} is spamming you — Stack overflow: inbox hit 10 msgs in 5s.`,
          payload: { type: "direct_message", actor_name: peer },
          incrementUnread: true,
        });
        return;
      }

      if (now - lastSpam < spamBannerHoldMs) {
        return;
      }

      showInAppBanner({
        title: "New message",
        body: `@${peer}: ${text}`,
        payload: { type: "direct_message", actor_name: peer },
        incrementUnread: true,
      });
    },
    [showInAppBanner],
  );

  const appendChatEntries = (username: string, entries: ChatEntry[]) => {
    const normalizedUser = normalizeUsername(username);
    if (!normalizedUser || entries.length === 0) {
      return [] as ChatEntry[];
    }

    const uniqueEntries = entries.filter((entry) => {
      if (seenMessageIdsRef.current.has(entry.id)) {
        return false;
      }
      seenMessageIdsRef.current.add(entry.id);
      return true;
    });
    if (!uniqueEntries.length) {
      return [] as ChatEntry[];
    }

    setChatThreads((prev) => {
      const existing = prev[normalizedUser] ?? [];
      return {
        ...prev,
        [normalizedUser]: [...existing, ...uniqueEntries],
      };
    });

    return uniqueEntries;
  };

  const renderChatHistory = useCallback(
    (username: string, entries?: ChatEntry[]) => {
      const normalizedUser = normalizeUsername(username);
      const thread = entries ?? chatThreads[normalizedUser] ?? [];
      if (!thread.length) {
        appendLines([
          { type: "out", text: `chat @${normalizedUser}` },
          { type: "out", text: "No previous messages. Say hello." },
        ]);
        return;
      }

      appendLines([
        { type: "out", text: `chat @${normalizedUser}` },
        ...thread.map((entry) => ({
          type: "out" as const,
          chatRole: entry.author,
          text:
            entry.author === "me"
              ? `[${entry.timestamp}] you: ${entry.text}`
              : `[${entry.timestamp}] @${normalizedUser}: ${entry.text}`,
        })),
      ]);
    },
    [chatThreads],
  );

  const loadChatHistory = useCallback(
    async (username: string) => {
      const normalizedUser = normalizeUsername(username);
      if (!user?.username) {
        appendLines([{ type: "err", text: "Sign in to open chat." }]);
        return;
      }

      try {
        const messages = await getDirectMessages(
          user.username,
          normalizedUser,
          0,
          200,
        );
        const mapped = messages.map((message) =>
          mapMessageToChatEntry(user.username ?? "", message),
        );
        const historyIds = messages.map((message) => message.id);
        for (const messageID of historyIds) {
          seenMessageIdsRef.current.add(messageID);
        }
        setChatThreads((prev) => ({
          ...prev,
          [normalizedUser]: mapped,
        }));
        renderChatHistory(normalizedUser, mapped);
      } catch (error) {
        if (isMissingDirectMessageUserError(error)) {
          appendLines([
            {
              type: "err",
              text: `Chat unavailable: @${normalizedUser} does not exist.`,
            },
          ]);
          setActiveChat((current) =>
            current === normalizedUser ? null : current,
          );
          return;
        }

        const message = parseApiErrorMessage(
          error,
          `Failed to load chat with @${normalizedUser}`,
        );
        appendLines([{ type: "err", text: message }]);
      }
    },
    [renderChatHistory, user?.username],
  );

  const openChatSession = useCallback(
    async (username: string) => {
      const target = normalizeUsername(username);
      if (!target) {
        return;
      }
      setActiveChat(target);
      appendLines([
        { type: "out", text: `Chat mode: @${target} (type /exit to leave)` },
      ]);
      await loadChatHistory(target);
    },
    [loadChatHistory],
  );

  const renderInbox = useCallback(async () => {
    if (!user?.username) {
      appendLines([{ type: "err", text: "Sign in to view inbox." }]);
      return;
    }

    const threads = await getDirectMessageThreads(user.username, 0, 50).catch(
      () => [] as ApiDirectMessageThread[],
    );

    if (!threads.length) {
      appendLines([
        { type: "out", text: "Inbox" },
        { type: "out", text: "No direct messages yet." },
      ]);
      return;
    }

    const normalizedPeers = threads
      .map((thread) => normalizeUsername(thread.peer_username))
      .filter(Boolean);
    setChatPeers((prev) => Array.from(new Set([...normalizedPeers, ...prev])));

    appendLines([
      { type: "out", text: "Inbox" },
      ...threads.map((thread) => {
        const peer = normalizeUsername(thread.peer_username);
        const preview = truncatePreview(thread.last_content || "");
        const when = formatInboxTime(thread.last_at);
        return {
          type: "out" as const,
          text: `@${peer.padEnd(18, " ")} ${when.padStart(3, " ")}  ${preview}`,
        };
      }),
      { type: "out", text: "Use: chat <username>" },
    ]);
  }, [user?.username]);

  const handleSendChatMessage = async (targetUser: string, message: string) => {
    const normalizedUser = normalizeUsername(targetUser);
    const trimmedMessage = message.trim();
    if (!normalizedUser || !trimmedMessage || !user?.username) {
      return;
    }

    const optimisticTimestamp = formatTime(new Date().toISOString());
    appendLines([
      {
        type: "out",
        chatRole: "me",
        text: `[${optimisticTimestamp}] you: ${trimmedMessage}`,
      },
    ]);

    try {
      const response = await createDirectMessage(
        user.username,
        normalizedUser,
        trimmedMessage,
      );
      const created = response.direct_message;
      const entry = mapMessageToChatEntry(user.username, created);
      appendChatEntries(normalizedUser, [entry]);
      movePeerToTop(normalizedUser);
    } catch (error) {
      const message = parseApiErrorMessage(
        error,
        `Failed to send message to @${normalizedUser}`,
      );
      appendLines([{ type: "err", text: message }]);
    }
  };

  const runCommand = async (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      return;
    }

    if (activeChat) {
      const loweredInput = trimmed.toLowerCase();
      if (loweredInput === "exit" || loweredInput === "/exit") {
        appendLines([{ type: "out", text: `Closed chat @${activeChat}` }]);
        setActiveChat(null);
        return;
      }
      if (loweredInput === "help" || loweredInput === "/help") {
        appendLines([
          { type: "out", text: "Chat mode commands:" },
          { type: "out", text: "  /exit    close current chat" },
          { type: "out", text: "  /help    show this help" },
        ]);
        return;
      }

      void handleSendChatMessage(activeChat, trimmed);
      return;
    }

    appendLines([{ type: "cmd", text: `$ ${trimmed}` }]);

    const [command, ...args] = trimmed.split(/\s+/);
    const lowered = command.toLowerCase();

    if (lowered === "help") {
      appendLines(commandHelp.map((text) => ({ type: "out" as const, text })));
      return;
    }

    if (lowered === "inbox") {
      await renderInbox();
      return;
    }

    if (lowered === "friends" || lowered === "lsfriends") {
      if (!user?.username) {
        appendLines([{ type: "err", text: "Sign in to load friends." }]);
        return;
      }

      try {
        const following = await getUsersFollowingUsernames(user.username);
        const peers = await getDirectChatPeers(user.username).catch(() => []);
        const activeUsers = Array.from(
          new Set([
            ...peers.map((name) => normalizeUsername(name)),
            ...Object.keys(chatThreads),
          ]),
        );
        if (!following.length && !activeUsers.length) {
          appendLines([
            { type: "out", text: "No friends or active chats yet." },
          ]);
          return;
        }

        if (following.length) {
          appendLines([
            { type: "out", text: "Friends (following):" },
            ...following.map((name) => ({
              type: "out" as const,
              text: `- @${name}`,
            })),
          ]);
        }

        if (activeUsers.length) {
          setChatPeers((prev) =>
            Array.from(new Set([...prev, ...activeUsers])),
          );
          appendLines([
            { type: "out", text: "Active chat threads:" },
            ...activeUsers.map((name) => ({
              type: "out" as const,
              text: `- @${name}`,
            })),
          ]);
        }
      } catch {
        appendLines([{ type: "err", text: "Could not load friends list." }]);
      }
      return;
    }

    if (lowered === "chat") {
      const target = normalizeUsername(args[0] ?? "");
      if (!target) {
        appendLines([{ type: "err", text: "Usage: chat <username>" }]);
        return;
      }
      await openChatSession(target);
      return;
    }

    if (lowered === "exit") {
      appendLines([{ type: "err", text: "No active chat to exit." }]);
      return;
    }

    if (lowered === "clear") {
      setLines([]);
      return;
    }

    if (lowered === "echo") {
      appendLines([{ type: "out", text: args.join(" ") }]);
      return;
    }

    if (lowered === "status") {
      appendLines([
        { type: "out", text: "session: active" },
        {
          type: "out",
          text: `chat: ${activeChat ? `@${activeChat}` : "none"}`,
        },
        { type: "out", text: "notifications: enabled" },
        { type: "out", text: "messaging gateway: online" },
      ]);
      return;
    }

    if (lowered === "open") {
      const target = (args[0] ?? "").toLowerCase();
      if (target === "home") {
        appendLines([{ type: "out", text: "Opening home..." }]);
        router.push("/(tabs)");
        return;
      }
      if (target === "explore") {
        appendLines([{ type: "out", text: "Opening explore..." }]);
        router.push("/(tabs)/explore");
        return;
      }
      appendLines([{ type: "err", text: "Usage: open home|explore" }]);
      return;
    }

    if (lowered === "msg") {
      if (args.length < 2 || !args[0].startsWith("@")) {
        appendLines([{ type: "err", text: "Usage: msg @user <message>" }]);
        return;
      }
      const target = args[0].slice(1);
      const message = args.slice(1).join(" ");
      if (!target || !message) {
        appendLines([{ type: "err", text: "Usage: msg @user <message>" }]);
        return;
      }
      const normalizedTarget = normalizeUsername(target);
      if (activeChat !== normalizedTarget) {
        setActiveChat(normalizedTarget);
        appendLines([
          {
            type: "out",
            text: `Chat mode: @${normalizedTarget} (type /exit to leave)`,
          },
        ]);
        void loadChatHistory(normalizedTarget);
      }
      movePeerToTop(normalizedTarget);
      void handleSendChatMessage(normalizedTarget, message);
      return;
    }

    appendLines([{ type: "err", text: `Unknown command: ${command}` }]);
  };

  const handleSubmit = () => {
    const suggestion = suggestions[0];
    const normalizedInput = input.trim().toLowerCase();
    if (
      suggestion &&
      suggestion.value.trim().toLowerCase() !== normalizedInput
    ) {
      setInput(suggestion.value);
      return;
    }

    const value = input;
    setInput("");
    void runCommand(value);
  };

  useEffect(() => {
    scheduleOutputScroll(true);
  }, [lines, scheduleOutputScroll]);

  useEffect(() => {
    if (!input.length) {
      return;
    }
    scheduleOutputScroll(false);
  }, [input, scheduleOutputScroll]);

  useEffect(() => {
    return () => {
      if (outputScrollRafRef.current !== null) {
        cancelAnimationFrame(outputScrollRafRef.current);
        outputScrollRafRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

  useEffect(() => {
    const rawParam = params.chat;
    const chatParam = Array.isArray(rawParam)
      ? (rawParam[0] ?? "")
      : (rawParam ?? "");
    const target = normalizeUsername(chatParam);
    if (!target || !user?.username) {
      return;
    }

    if (autoOpenedChatRef.current === target) {
      return;
    }

    autoOpenedChatRef.current = target;
    void openChatSession(target);
  }, [openChatSession, params.chat, user?.username]);

  useEffect(() => {
    if (!user?.username || !token) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      return;
    }

    let cancelled = false;
    let reconnectAttempt = 0;

    const connect = () => {
      if (cancelled || !user.username || !token) {
        return;
      }

      const wsBase = getWebSocketBaseUrl(API_BASE_URL);
      const url = `${wsBase}/messages/${encodeURIComponent(user.username)}/stream?token=${encodeURIComponent(token)}`;
      const socket = new WebSocket(url);
      wsRef.current = socket;

      socket.onopen = () => {
        reconnectAttempt = 0;
      };

      socket.onmessage = (event) => {
        const raw = typeof event.data === "string" ? event.data : "";
        if (!raw) {
          return;
        }

        try {
          const payload = JSON.parse(raw) as DirectMessageStreamEvent;
          if (payload.type !== "direct_message" || !payload.direct_message) {
            return;
          }
          if (!user.username) {
            return;
          }

          const message = payload.direct_message;
          const normalizedMe = normalizeUsername(user.username);
          const sender = normalizeUsername(message.sender_name);
          const recipient = normalizeUsername(message.recipient_name);
          if (sender !== normalizedMe && recipient !== normalizedMe) {
            return;
          }

          const peer = getPeerForMessage(user.username, message);
          if (!peer) {
            return;
          }

          const entry = mapMessageToChatEntry(user.username, message);
          const appended = appendChatEntries(peer, [entry]);
          if (!appended.length) {
            return;
          }
          movePeerToTop(peer);

          if (entry.author === "them") {
            notifyIncomingMessage(peer, entry.text);
          }

          if (activeChatRef.current === peer && entry.author === "them") {
            appendLines([
              {
                type: "out",
                chatRole: entry.author,
                text: `[${entry.timestamp}] @${peer}: ${entry.text}`,
              },
            ]);
            return;
          }

          if (entry.author === "them") {
            appendLines([
              {
                type: "out",
                text: `New message from @${peer}: ${entry.text}`,
              },
            ]);
          }
        } catch {
          // Ignore malformed stream payloads.
        }
      };

      socket.onclose = () => {
        wsRef.current = null;
        if (cancelled) {
          return;
        }

        reconnectAttempt += 1;
        const backoffMs = Math.min(1000 * reconnectAttempt, 5000);
        reconnectTimeoutRef.current = setTimeout(connect, backoffMs);
      };

      socket.onerror = () => {
        socket.close();
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [movePeerToTop, notifyIncomingMessage, token, user?.username]);

  useEffect(() => {
    if (!activeChat || !user?.username) {
      return;
    }

    const interval = setInterval(() => {
      void getDirectMessages(user.username, activeChat, 0, 200)
        .then((messages) => {
          const incoming = messages
            .filter((message) => !seenMessageIdsRef.current.has(message.id))
            .map((message) => mapMessageToChatEntry(user.username, message));
          if (!incoming.length) {
            return;
          }

          const appended = appendChatEntries(activeChat, incoming);
          if (!appended.length) {
            return;
          }
          appended
            .filter((entry) => entry.author === "them")
            .forEach((entry) => {
              notifyIncomingMessage(activeChat, entry.text);
            });
          appendLines(
            appended.map((entry) => ({
              type: "out" as const,
              chatRole: entry.author,
              text:
                entry.author === "me"
                  ? `[${entry.timestamp}] you: ${entry.text}`
                  : `[${entry.timestamp}] @${activeChat}: ${entry.text}`,
            })),
          );
        })
        .catch((error) => {
          if (isMissingDirectMessageUserError(error)) {
            appendLines([
              {
                type: "err",
                text: `Chat closed: @${activeChat} no longer exists.`,
              },
            ]);
            setActiveChat((current) =>
              current === activeChat ? null : current,
            );
          }
        });
    }, 3000);

    return () => {
      clearInterval(interval);
    };
  }, [activeChat, notifyIncomingMessage, user?.username]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.screen} edges={["top"]}>
        <KeyboardAvoidingView
          style={styles.screen}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={insets.top + 8}
        >
          <View
            style={[
              styles.header,
              { borderColor: colors.border, backgroundColor: colors.surface },
            ]}
          >
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <Feather name="arrow-left" size={16} color={colors.muted} />
            </Pressable>
            <ThemedText type="defaultSemiBold">Terminal</ThemedText>
            <View style={styles.headerDotWrap}>
              <View
                style={[styles.headerDot, { backgroundColor: colors.tint }]}
              />
            </View>
          </View>

          <View
            style={[
              styles.statusStrip,
              {
                borderColor: colors.border,
                backgroundColor: colors.surfaceAlt,
              },
            ]}
          >
            <ThemedText type="caption" style={{ color: colors.muted }}>
              {activeChat ? `chat @${activeChat}` : "command mode"}
            </ThemedText>
            <ThemedText type="caption" style={{ color: colors.muted }}>
              peers {chatPeers.length}
            </ThemedText>
          </View>

          <ScrollView
            ref={outputRef}
            style={[
              styles.outputWrap,
              {
                borderColor: colors.border,
                backgroundColor: colors.surface,
              },
            ]}
            contentContainerStyle={styles.outputContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={
              Platform.OS === "ios" ? "interactive" : "on-drag"
            }
            onScrollBeginDrag={Keyboard.dismiss}
            onContentSizeChange={() => scheduleOutputScroll(true)}
          >
            {lines.map((line) => (
              <ThemedText
                key={line.id}
                type="caption"
                style={[
                  styles.line,
                  {
                    color:
                      line.type === "err"
                        ? colors.muted
                        : line.chatRole === "me"
                          ? colors.tint
                          : line.chatRole === "them"
                            ? colors.chipText
                            : line.type === "cmd"
                              ? colors.tint
                              : colors.text,
                  },
                ]}
              >
                {line.text}
              </ThemedText>
            ))}
          </ScrollView>

          {suggestions.length ? (
            <View
              style={[
                styles.suggestionWrap,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                },
              ]}
            >
              {suggestions.map((suggestion, index) => (
                <Pressable
                  key={suggestion.id}
                  onPress={() => setInput(suggestion.value)}
                  style={[
                    styles.suggestionItem,
                    index === suggestions.length - 1 &&
                      styles.suggestionItemLast,
                    {
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <ThemedText type="caption" style={{ color: colors.muted }}>
                    {suggestion.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          ) : null}

          <View
            style={[
              styles.inputRow,
              {
                borderColor: colors.border,
                backgroundColor: colors.surface,
                marginBottom: insets.bottom + 12,
              },
            ]}
          >
            <TextInput
              value={input}
              onChangeText={setInput}
              onFocus={() => scheduleOutputScroll(true)}
              onSubmitEditing={handleSubmit}
              placeholder={
                activeChat
                  ? `Message @${activeChat} (/exit to close)`
                  : "Enter command"
              }
              placeholderTextColor={colors.muted}
              style={[styles.input, { color: colors.text }]}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="send"
            />
            <Pressable
              onPress={handleSubmit}
              style={[styles.sendButton, { backgroundColor: colors.tint }]}
            >
              <Feather
                name="corner-down-left"
                size={14}
                color={colors.onTint}
              />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    marginHorizontal: 16,
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  headerDotWrap: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  headerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  outputWrap: {
    flex: 1,
    marginHorizontal: 16,
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  outputContent: {
    gap: 6,
    paddingTop: 2,
    paddingBottom: 16,
  },
  statusStrip: {
    marginHorizontal: 16,
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  suggestionWrap: {
    marginHorizontal: 16,
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 8,
    overflow: "hidden",
  },
  suggestionItem: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  suggestionItemLast: {
    borderBottomWidth: 0,
  },
  line: {
    fontFamily: "SpaceMono",
    fontSize: 13,
    lineHeight: 18,
  },
  inputRow: {
    marginHorizontal: 16,
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 10,
  },
  input: {
    flex: 1,
    fontFamily: "SpaceMono",
    fontSize: 14,
  },
  sendButton: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
});
