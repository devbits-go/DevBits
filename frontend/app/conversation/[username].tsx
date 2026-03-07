import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  ActivityIndicator,
  Pressable,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { MessageBubble } from "@/components/MessageBubble";
import { MessageComposer } from "@/components/MessageComposer";
import { useAppColors } from "@/hooks/useAppColors";
import { useAuth } from "@/contexts/AuthContext";
import {
  API_BASE_URL,
  getDirectMessages,
  createDirectMessage,
} from "@/services/api";
import { ApiDirectMessage } from "@/constants/Types";

type MessageWithState = ApiDirectMessage & {
  isPending?: boolean;
  isError?: boolean;
  tempId?: string;
};

const dedupeMessages = (items: MessageWithState[]) => {
  const seen = new Set<string>();
  const output: MessageWithState[] = [];

  items.forEach((item) => {
    const idKey =
      typeof item.id === "number" && item.id > 0 ? `id:${item.id}` : null;
    const key =
      item.tempId ||
      idKey ||
      `fallback:${item.sender_name}:${item.recipient_name}:${item.created_at}:${item.content}`;

    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    output.push(item);
  });

  return output;
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

export default function ConversationScreen() {
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { username: recipientUsername } = useLocalSearchParams<{
    username: string;
  }>();
  const { user, token } = useAuth();

  const [messages, setMessages] = useState<MessageWithState[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    if (!user?.username || !recipientUsername) {
      // If we don't have the necessary identifiers, stop loading and show an error/empty state
      setIsLoading(false);
      setError("Unable to load conversation.");
      return;
    }

    try {
      setError(null);
      const response = await getDirectMessages(
        user.username,
        recipientUsername as string,
        0,
        100,
      );
      setMessages(dedupeMessages(response ?? []));
    } catch (err) {
      console.error("Failed to fetch messages:", err);
      setError("Failed to load messages");
    } finally {
      setIsLoading(false);
    }
  }, [user?.username, recipientUsername]);

  // Initial load
  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // WebSocket connection for real-time messages
  useEffect(() => {
    if (!user?.username || !token) return;

    // Track reconnection state within this effect
    let reconnectAttempts = 0;
    let reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let isActive = true;
    // Connect to WebSocket using API_BASE_URL
    const wsBase = getWebSocketBaseUrl(API_BASE_URL);
    const wsUrl = `${wsBase}/messages/${encodeURIComponent(
      user.username,
    )}/stream?token=${encodeURIComponent(token)}`;
    const connect = () => {
      if (!isActive) {
        return;
      }

      try {
        // Close any existing socket from a previous run before creating a new one
        if (
          wsRef.current &&
          (wsRef.current.readyState === WebSocket.OPEN ||
            wsRef.current.readyState === WebSocket.CONNECTING)
        ) {
          wsRef.current.close();
        }

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log("WebSocket connected for conversation");
          // Reset reconnect attempts on successful connection
          reconnectAttempts = 0;
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            // Handle incoming direct message
            if (data.type === "direct_message") {
              const newMessage = data.direct_message as ApiDirectMessage;

              // Only add if it's from the current conversation
              if (
                newMessage.sender_name === recipientUsername ||
                newMessage.recipient_name === recipientUsername
              ) {
                setMessages((prev) => {
                  // First, try to reconcile against any pending optimistic message
                  const pendingIndex = prev.findIndex(
                    (m) =>
                      m.isPending &&
                      m.id === -1 &&
                      m.sender_name === newMessage.sender_name &&
                      m.recipient_name === newMessage.recipient_name &&
                      m.content === newMessage.content
                  );

                  if (pendingIndex !== -1) {
                    const updated = [...prev];
                    const pendingMessage = updated[pendingIndex];

                    // Replace the optimistic message with the real one, preserving client-only fields
                    updated[pendingIndex] = {
                      ...pendingMessage,
                      ...newMessage,
                      isPending: false,
                      isError: false,
                    };

                    return dedupeMessages(updated);
                  }

                  // Check if message already exists (avoid duplicates by server id)
                  const exists = prev.some((m) => m.id === newMessage.id);
                  if (exists) return prev;
                  return dedupeMessages([...prev, newMessage]);
                });

                // Scroll to bottom
                setTimeout(() => {
                  flatListRef.current?.scrollToEnd({ animated: true });
                }, 100);
              }
            }
          } catch (err) {
            console.error("Failed to parse WebSocket message:", err);
          }
        };

        ws.onerror = (error) => {
          console.error("WebSocket error:", error);
        };

        ws.onclose = (event) => {
          console.log("WebSocket closed", event?.code, event?.reason ?? "");

          if (!isActive) {
            // Component unmounted or effect cleaned up; do not attempt to reconnect
            return;
          }

          const maxAttempts = 5;
          if (reconnectAttempts >= maxAttempts) {
            console.log("Max WebSocket reconnect attempts reached; giving up.");
            return;
          }

          const baseDelayMs = 1000;
          const maxDelayMs = 10000;
          const delayMs = Math.min(
            baseDelayMs * Math.pow(2, reconnectAttempts),
            maxDelayMs,
          );
          reconnectAttempts += 1;

          console.log(
            `Attempting WebSocket reconnect #${reconnectAttempts} in ${delayMs}ms`,
          );

          reconnectTimeoutId = setTimeout(() => {
            reconnectTimeoutId = null;
            connect();
          }, delayMs);
        };
      } catch (err) {
        console.error("Failed to connect WebSocket:", err);
      }
    };

    // Initial connection
    connect();

    return () => {
      // Prevent any further reconnect attempts
      isActive = false;

      if (reconnectTimeoutId !== null) {
        clearTimeout(reconnectTimeoutId);
        reconnectTimeoutId = null;
      }

      const ws = wsRef.current;
      if (
        ws &&
        (ws.readyState === WebSocket.OPEN ||
          ws.readyState === WebSocket.CONNECTING)
      ) {
        ws.close();
      }
    };
  }, [user?.username, recipientUsername, token]);

  // Send message with optimistic UI
  const handleSendMessage = async (content: string) => {
    if (!user?.username || !recipientUsername) return;

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: MessageWithState = {
      id: -1,
      sender_id: user.id || 0,
      recipient_id: 0,
      sender_name: user.username,
      recipient_name: recipientUsername as string,
      content,
      created_at: new Date().toISOString(),
      isPending: true,
      tempId,
    };

    // Add optimistic message
    setMessages((prev) => dedupeMessages([...prev, optimisticMessage]));

    // Scroll to bottom
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 50);

    try {
      const response = await createDirectMessage(
        user.username,
        recipientUsername as string,
        content,
      );

      // Replace optimistic message with real one
      setMessages((prev) => {
        const replaced = prev.map((msg) =>
          msg.tempId === tempId ? response.direct_message : msg,
        );
        return dedupeMessages(replaced);
      });
    } catch (err) {
      console.error("Failed to send message:", err);

      // Mark message as error
      setMessages((prev) =>
        prev.map((msg) =>
          msg.tempId === tempId
            ? { ...msg, isPending: false, isError: true }
            : msg,
        ),
      );

      Alert.alert(
        "Failed to send",
        "Your message could not be sent. Please try again.",
        [
          {
            text: "OK",
            onPress: () => {
              // Remove failed message so the user can re-send from the composer
              setMessages((prev) =>
                prev.filter((msg) => msg.tempId !== tempId),
              );
            },
          },
        ],
      );
    }
  };

  const handleBack = () => {
    router.back();
  };

  const renderMessage = ({ item }: { item: MessageWithState }) => {
    const isSent = item.sender_name === user?.username;
    return (
      <MessageBubble
        content={item.content}
        timestamp={item.created_at}
        isSent={isSent}
        isPending={item.isPending}
        isError={item.isError}
        authorLabel={isSent ? "you" : (recipientUsername as string)}
      />
    );
  };

  const renderEmpty = () => {
    if (isLoading) return null;

    return (
      <View style={styles.emptyState}>
        <ThemedText
          type="caption"
          style={{ color: colors.muted, textAlign: "center" }}
        >
          No messages yet.{"\n"}
          Start the conversation!
        </ThemedText>
      </View>
    );
  };

  const renderError = () => {
    if (!error) return null;

    return (
      <View style={styles.emptyState}>
        <ThemedText
          type="caption"
          style={{ color: colors.muted, textAlign: "center" }}
        >
          {error}
        </ThemedText>
      </View>
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
            paddingTop: insets.top + 8,
          },
        ]}
      >
        <Pressable
          onPress={handleBack}
          style={[styles.backButton, { backgroundColor: colors.surfaceAlt }]}
        >
          <Feather name="chevron-left" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.headerContent}>
          <ThemedText type="defaultSemiBold" numberOfLines={1}>
            {recipientUsername}
          </ThemedText>
        </View>
        <View style={styles.headerRight}>
          {/* Placeholder for future actions (e.g., settings, info) */}
        </View>
      </View>

      {/* Messages */}
      {isLoading ? (
        <View
          style={[
            styles.screen,
            { justifyContent: "center", alignItems: "center" },
          ]}
        >
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      ) : error ? (
        renderError()
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item, index) =>
            item.tempId || item.id?.toString() || index.toString()
          }
          contentContainerStyle={[
            styles.messageList,
            messages.length === 0 && { flex: 1 },
          ]}
          ListEmptyComponent={renderEmpty}
          onContentSizeChange={() => {
            if (messages.length > 0) {
              flatListRef.current?.scrollToEnd({ animated: false });
            }
          }}
          onLayout={() => {
            if (messages.length > 0) {
              flatListRef.current?.scrollToEnd({ animated: false });
            }
          }}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode={
            Platform.OS === "ios" ? "interactive" : "on-drag"
          }
          onScrollBeginDrag={() => {
            Keyboard.dismiss();
          }}
          maintainVisibleContentPosition={{
            minIndexForVisible: 0,
            autoscrollToTopThreshold: 10,
          }}
        />
      )}

      {/* Message Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={{ paddingBottom: insets.bottom }}>
          <MessageComposer onSend={handleSendMessage} autoFocus={false} />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headerContent: {
    flex: 1,
  },
  headerRight: {
    width: 36,
  },
  messageList: {
    paddingTop: 16,
    paddingBottom: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
});
