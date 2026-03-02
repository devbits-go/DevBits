import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
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
import { API_BASE_URL, getDirectMessages, createDirectMessage } from "@/services/api";
import { ApiDirectMessage } from "@/constants/Types";

type MessageWithState = ApiDirectMessage & {
  isPending?: boolean;
  isError?: boolean;
  tempId?: string;
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
  const { username: recipientUsername } = useLocalSearchParams<{ username: string }>();
  const { user, token } = useAuth();

  const [messages, setMessages] = useState<MessageWithState[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    if (!user?.username || !recipientUsername) return;

    try {
      setError(null);
      const response = await getDirectMessages(
        user.username,
        recipientUsername as string,
        0,
        100
      );
      setMessages(response ?? []);
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
      user.username
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
                  // Check if message already exists (avoid duplicates)
                  const exists = prev.some((m) => m.id === newMessage.id);
                  if (exists) return prev;
                  return [...prev, newMessage];
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
          console.log(
            "WebSocket closed",
            event?.code,
            event?.reason ?? ""
          );

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
            maxDelayMs
          );
          reconnectAttempts += 1;

          console.log(
            `Attempting WebSocket reconnect #${reconnectAttempts} in ${delayMs}ms`
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
    setMessages((prev) => [...prev, optimisticMessage]);

    // Scroll to bottom
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 50);

    try {
      const response = await createDirectMessage(
        user.username,
        recipientUsername as string,
        content
      );

      // Replace optimistic message with real one
      setMessages((prev) =>
        prev.map((msg) =>
          msg.tempId === tempId ? response.direct_message : msg
        )
      );
    } catch (err) {
      console.error("Failed to send message:", err);

      // Mark message as error
      setMessages((prev) =>
        prev.map((msg) =>
          msg.tempId === tempId ? { ...msg, isPending: false, isError: true } : msg
        )
      );

      Alert.alert("Failed to send", "Your message could not be sent. Please try again.", [
        {
          text: "OK",
          onPress: () => {
            // Remove failed message so the user can re-send from the composer
            setMessages((prev) => prev.filter((msg) => msg.tempId !== tempId));
          },
        },
      ]);
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
      />
    );
  };

  const renderEmpty = () => {
    if (isLoading) return null;

    return (
      <View style={styles.emptyState}>
        <ThemedText type="caption" style={{ color: colors.muted, textAlign: "center" }}>
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
        <ThemedText type="caption" style={{ color: colors.muted, textAlign: "center" }}>
          {error}
        </ThemedText>
      </View>
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
          keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 56 : 0}
        >
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
          <View style={[styles.screen, { justifyContent: "center", alignItems: "center" }]}>
            <ActivityIndicator size="large" color={colors.tint} />
          </View>
        ) : error ? (
          renderError()
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item, index) => item.tempId || item.id?.toString() || index.toString()}
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
            keyboardShouldPersistTaps="handled"
            maintainVisibleContentPosition={{
              minIndexForVisible: 0,
              autoscrollToTopThreshold: 10,
            }}
          />
        )}

        {/* Message Input */}
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
  keyboardView: {
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
