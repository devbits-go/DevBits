import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  Animated,
  RefreshControl,
  ActivityIndicator,
  Platform,
  Pressable,
  Modal,
  TextInput,
  Alert,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { MessageThreadItem } from "@/components/MessageThreadItem";
import { useAppColors } from "@/hooks/useAppColors";
import { useMotionConfig } from "@/hooks/useMotionConfig";
import { useAuth } from "@/contexts/AuthContext";
import { getDirectMessageThreads } from "@/services/api";
import { ApiDirectMessageThread } from "@/services/api";

export default function MessageScreen() {
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const motion = useMotionConfig();
  const router = useRouter();
  const { user } = useAuth();

  const [threads, setThreads] = useState<ApiDirectMessageThread[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const reveal = useRef(new Animated.Value(0.08)).current;

  // Reveal animation
  useEffect(() => {
    if (motion.prefersReducedMotion) {
      reveal.setValue(1);
      return;
    }

    Animated.timing(reveal, {
      toValue: 1,
      duration: motion.duration(360),
      useNativeDriver: true,
    }).start();
  }, [motion, reveal]);

  const fetchThreads = useCallback(async () => {
    if (!user?.username) return;

    try {
      setError(null);
      const response = await getDirectMessageThreads(user.username, 0, 50);
      setThreads(response.threads || []);
    } catch (err) {
      console.error("Failed to fetch message threads:", err);
      setError("Failed to load messages");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.username]);

  // Initial load
  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  // Refresh on focus
  useFocusEffect(
    useCallback(() => {
      if (!isLoading) {
        fetchThreads();
      }
    }, [fetchThreads, isLoading])
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchThreads();
  };

  const formatTimestamp = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "now";
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const renderEmpty = () => {
    if (isLoading) return null;

    return (
      <View style={[styles.emptyState, styles.content]}>
        <ThemedText type="caption" style={{ color: colors.muted, textAlign: "center" }}>
          No messages yet.{"\n"}
          Tap the + button to start a new conversation.
        </ThemedText>
      </View>
    );
  };

  const renderError = () => {
    if (!error) return null;

    return (
      <View style={[styles.emptyState, styles.content]}>
        <ThemedText type="caption" style={{ color: colors.muted, textAlign: "center" }}>
          {error}
        </ThemedText>
      </View>
    );
  };

  const renderItem = ({ item }: { item: ApiDirectMessageThread }) => (
    <MessageThreadItem
      username={item.peer_username}
      lastMessage={item.last_content}
      timestamp={formatTimestamp(item.last_at)}
    />
  );

  const renderSeparator = () => <View style={{ height: 12 }} />;

  const handleNewChat = () => {
    setShowNewChatModal(true);
  };

  const handleStartChat = () => {
    const username = searchQuery.trim();
    if (!username) {
      Alert.alert("Enter username", "Please enter a username to start a conversation.");
      return;
    }

    setShowNewChatModal(false);
    setSearchQuery("");
    router.push(`/conversation/${username}`);
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={["top"]}>
      <Animated.View
        style={{
          flex: 1,
          opacity: reveal,
          transform: [
            {
              translateY: reveal.interpolate({
                inputRange: [0, 1],
                outputRange: [10, 0],
              }),
            },
          ],
        }}
      >
        {/* Header */}
        <View style={styles.headerSection}>
          <View>
            <ThemedText type="display">Messages</ThemedText>
            <ThemedText type="caption" style={{ color: colors.muted }}>
              {isLoading
                ? "Loading..."
                : threads.length === 0
                  ? "No conversations yet"
                  : `${threads.length} conversation${threads.length === 1 ? "" : "s"}`}
            </ThemedText>
          </View>
        </View>

        {/* Thread List */}
        {isLoading ? (
          <View style={[styles.emptyState, styles.content]}>
            <ActivityIndicator size="large" color={colors.tint} />
          </View>
        ) : error ? (
          renderError()
        ) : (
          <Animated.FlatList
            data={threads}
            renderItem={renderItem}
            keyExtractor={(item) => item.peer_username}
            contentContainerStyle={[
              styles.content,
              { paddingBottom: 96 + insets.bottom },
            ]}
            ItemSeparatorComponent={renderSeparator}
            ListEmptyComponent={renderEmpty}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor={colors.tint}
                colors={[colors.tint]}
              />
            }
            removeClippedSubviews={Platform.OS === "android"}
            windowSize={8}
            initialNumToRender={10}
            maxToRenderPerBatch={5}
            keyboardShouldPersistTaps="handled"
          />
        )}

        {/* FAB for New Conversation */}
        <Pressable
          onPress={handleNewChat}
          style={({ pressed }) => [
            styles.fab,
            {
              backgroundColor: colors.tint,
              bottom: insets.bottom + 80, // Above tab bar
            },
            pressed && styles.fabPressed,
          ]}
        >
          <Feather name="edit" size={24} color={colors.onTint} />
        </Pressable>
      </Animated.View>

      {/* New Chat Modal */}
      <Modal
        visible={showNewChatModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNewChatModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowNewChatModal(false)}
        >
          <Pressable
            style={[
              styles.modalContent,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <ThemedText type="defaultSemiBold">New Conversation</ThemedText>
              <Pressable
                onPress={() => setShowNewChatModal(false)}
                style={[styles.closeButton, { backgroundColor: colors.surfaceAlt }]}
              >
                <Feather name="x" size={20} color={colors.text} />
              </Pressable>
            </View>

            <ThemedText type="caption" style={{ color: colors.muted, marginBottom: 12 }}>
              Enter the username of the person you want to message
            </ThemedText>

            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Username"
              placeholderTextColor={colors.muted}
              style={[
                styles.searchInput,
                {
                  color: colors.text,
                  backgroundColor: colors.surfaceAlt,
                  borderColor: colors.border,
                },
              ]}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              returnKeyType="go"
              onSubmitEditing={handleStartChat}
            />

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setShowNewChatModal(false)}
                style={[
                  styles.modalButton,
                  {
                    backgroundColor: colors.surfaceAlt,
                    borderColor: colors.border,
                  },
                ]}
              >
                <ThemedText type="caption" style={{ color: colors.muted }}>
                  Cancel
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={handleStartChat}
                style={[
                  styles.modalButton,
                  {
                    backgroundColor: colors.tint,
                  },
                ]}
              >
                <ThemedText type="caption" style={{ color: colors.onTint }}>
                  Start Chat
                </ThemedText>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  headerSection: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  content: {
    paddingHorizontal: 16,
  },
  emptyState: {
    marginTop: 48,
    alignItems: "center",
  },
  fab: {
    position: "absolute",
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabPressed: {
    transform: [{ scale: 0.95 }],
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "85%",
    maxWidth: 400,
    borderRadius: 14,
    borderWidth: 1,
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  searchInput: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: "SpaceMono",
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
  },
  modalButton: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
