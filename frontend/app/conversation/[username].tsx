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
import { getDirectMessages, createDirectMessage } from "@/services/api";
import { ApiDirectMessage } from "@/constants/Types";

type MessageWithState = ApiDirectMessage & {
  isPending?: boolean;
  isError?: boolean;
  tempId?: string;
};

export default function ConversationScreen() {
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { username: recipientUsername } = useLocalSearchParams<{ username: string }>();
  const { user } = useAuth();

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
      // Reverse to show oldest first (for inverted FlatList)
      setMessages(response.reverse());
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
    if (!user?.username) return;

    // Connect to WebSocket (reuse existing connection pattern from terminal)
    const protocol = __DEV__ ? "ws" : "wss";
    const host = __DEV__ ? "10.0.2.2:8080" : "devbits.ddns.net";
    const wsUrl = `${protocol}://${host}/ws?username=${encodeURIComponent(user.username)}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket connected for conversation");
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

      ws.onclose = () => {
        console.log("WebSocket closed");
      };

      return () => {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
      };
    } catch (err) {
      console.error("Failed to connect WebSocket:", err);
    }
  }, [user?.username, recipientUsername]);

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
          text: "Retry",
          onPress: () => {
            // Remove failed message and retry
            setMessages((prev) => prev.filter((msg) => msg.tempId !== tempId));
            handleSendMessage(content);
          },
        },
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => {
            // Remove failed message
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
        keyboardVerticalOffset={0}
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
