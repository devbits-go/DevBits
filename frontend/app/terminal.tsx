import React, { useEffect, useMemo, useRef, useState } from "react";
import {
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
import { ApiDirectMessage } from "@/constants/Types";
import {
  createDirectMessage,
  getAllUsers,
  getDirectChatPeers,
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
  author: "me" | "them";
  text: string;
  timestamp: string;
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
    author: sender === myName ? "me" : "them",
    text: message.content,
    timestamp: formatTime(message.created_at),
  };
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

export default function TerminalScreen() {
  const colors = useAppColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ chat?: string | string[] }>();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const outputRef = useRef<ScrollView>(null);
  const autoOpenedChatRef = useRef<string | null>(null);
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
    { id: 3, type: "out", text: "Start a chat: chat username" },
    { id: 4, type: "out", text: "List friends: friends" },
    { id: 5, type: "out", text: "" },
  ]);
  const chatOtherColor = "#F59E0B";

  const commandHelp = useMemo(
    () => [
      "help                   show available commands",
      "clear                  clear terminal output",
      "echo <text>            print text",
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
      getDirectChatPeers(user.username).catch(() => []),
    ]).then(([users, following, peers]) => {
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
      const peerNames = Array.isArray(peers)
        ? peers.map((name) => normalizeUsername(name)).filter(Boolean)
        : [];
      setChatPeers(Array.from(new Set(peerNames)).sort());
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

  const appendChatEntries = (username: string, entries: ChatEntry[]) => {
    const normalizedUser = normalizeUsername(username);
    if (!normalizedUser || entries.length === 0) {
      return;
    }

    setChatThreads((prev) => {
      const existing = prev[normalizedUser] ?? [];
      return {
        ...prev,
        [normalizedUser]: [...existing, ...entries],
      };
    });
  };

  const renderChatHistory = (username: string, entries?: ChatEntry[]) => {
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
  };

  const loadChatHistory = async (username: string) => {
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
      setChatThreads((prev) => ({
        ...prev,
        [normalizedUser]: mapped,
      }));
      renderChatHistory(normalizedUser, mapped);
    } catch (error) {
      const message = parseApiErrorMessage(
        error,
        `Failed to load chat with @${normalizedUser}`,
      );
      appendLines([{ type: "err", text: message }]);
    }
  };

  const openChatSession = async (username: string) => {
    const target = normalizeUsername(username);
    if (!target) {
      return;
    }
    setActiveChat(target);
    await loadChatHistory(target);
    appendLines([
      { type: "out", text: `Chat mode: @${target} (type /exit to leave)` },
    ]);
  };

  const handleSendChatMessage = async (targetUser: string, message: string) => {
    const normalizedUser = normalizeUsername(targetUser);
    const trimmedMessage = message.trim();
    if (!normalizedUser || !trimmedMessage || !user?.username) {
      return;
    }

    try {
      const response = await createDirectMessage(
        user.username,
        normalizedUser,
        trimmedMessage,
      );
      const created = response.direct_message;
      const entry = mapMessageToChatEntry(user.username, created);
      appendChatEntries(normalizedUser, [entry]);
      appendLines([
        {
          type: "out",
          chatRole: "me",
          text: `[${entry.timestamp}] you: ${entry.text}`,
        },
      ]);
      setChatPeers((prev) =>
        prev.includes(normalizedUser) ? prev : [...prev, normalizedUser].sort(),
      );
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

      await handleSendChatMessage(activeChat, trimmed);
      return;
    }

    appendLines([{ type: "cmd", text: `$ ${trimmed}` }]);

    const [command, ...args] = trimmed.split(/\s+/);
    const lowered = command.toLowerCase();

    if (lowered === "help") {
      appendLines(commandHelp.map((text) => ({ type: "out" as const, text })));
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
        ).sort();
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
          setChatPeers(activeUsers);
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
      await openChatSession(normalizedTarget);
      await handleSendChatMessage(normalizedTarget, message);
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
    outputRef.current?.scrollToEnd({ animated: true });
  }, [lines]);

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
  }, [params.chat, user?.username]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.screen} edges={["top"]}>
        <KeyboardAvoidingView
          style={styles.screen}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
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

          <ScrollView
            ref={outputRef}
            style={styles.outputWrap}
            contentContainerStyle={styles.outputContent}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() =>
              outputRef.current?.scrollToEnd({ animated: true })
            }
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
                        ? "#ef4444"
                        : line.chatRole === "me"
                          ? colors.tint
                          : line.chatRole === "them"
                            ? chatOtherColor
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
                color={colors.accent}
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
  },
  outputContent: {
    gap: 6,
    paddingTop: 4,
    paddingBottom: 16,
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
