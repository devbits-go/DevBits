import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Platform,
  Pressable,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { MessageThreadItem } from "@/components/MessageThreadItem";
import { useAppColors } from "@/hooks/useAppColors";
import { useAuth } from "@/contexts/AuthContext";
import { getDirectMessageThreads, searchUsers, ApiDirectMessageThread } from "@/services/api";
import { ApiUser } from "@/constants/Types";

export default function MessageScreen() {
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [threads, setThreads] = useState<ApiDirectMessageThread[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<ApiUser[]>([]);
  const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced autocomplete
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = searchQuery.trim();
    if (!q) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setIsSuggestionsLoading(true);
      try {
        const results = await searchUsers(q, 8);
        setSuggestions(results);
      } catch {
        setSuggestions([]);
      } finally {
        setIsSuggestionsLoading(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  const fetchThreads = useCallback(async () => {
    if (!user?.username) return;

    try {
      setError(null);
      const threads = await getDirectMessageThreads(user.username, 0, 50);
      setThreads(threads);
    } catch (err) {
      console.error("Failed to fetch message threads:", err);
      setError("Failed to load messages");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.username]);

  // Load on mount and refresh on focus
  useFocusEffect(
    useCallback(() => {
      fetchThreads();
    }, [fetchThreads])
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
      avatarUrl={item.peer_picture}
    />
  );

  const renderSeparator = () => <View style={{ height: 12 }} />;

  const handleCloseModal = () => {
    setShowNewChatModal(false);
    setSearchQuery("");
    setSuggestions([]);
  };

  const handleSelectSuggestion = (username: string) => {
    setShowNewChatModal(false);
    setSearchQuery("");
    setSuggestions([]);
    router.push(`/conversation/${username}`);
  };

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
    setSuggestions([]);
    router.push(`/conversation/${username}`);
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={["top"]}>
      <View style={{ flex: 1 }}>
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
          <FlatList
            data={threads}
            renderItem={renderItem}
            keyExtractor={(item) => item.peer_username}
            extraData={threads}
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
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          <Pressable
            onPress={handleNewChat}
            style={({ pressed }) => [
              styles.fab,
              {
                backgroundColor: colors.tint,
                borderColor: colors.border,
                bottom: Math.max(14, insets.bottom + 10),
              },
              pressed && styles.fabPressed,
            ]}
          >
            <Feather name="edit" size={16} color={colors.onTint} />
          </Pressable>
        </View>
      </View>

      {/* New Chat Modal */}
      <Modal
        visible={showNewChatModal}
        transparent
        animationType="fade"
        onRequestClose={handleCloseModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={handleCloseModal}
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
                onPress={handleCloseModal}
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
                  marginBottom: suggestions.length > 0 || isSuggestionsLoading ? 8 : 16,
                },
              ]}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              returnKeyType="go"
              onSubmitEditing={handleStartChat}
            />

            {/* Autocomplete suggestions */}
            {(suggestions.length > 0 || isSuggestionsLoading) && (
              <View
                style={[
                  styles.suggestionsContainer,
                  { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                ]}
              >
                {isSuggestionsLoading ? (
                  <ActivityIndicator size="small" color={colors.tint} style={{ paddingVertical: 10 }} />
                ) : (
                  suggestions.map((s, i) => (
                    <Pressable
                      key={s.username}
                      onPress={() => handleSelectSuggestion(s.username)}
                      style={({ pressed }) => [
                        styles.suggestionItem,
                        i < suggestions.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                        pressed && { backgroundColor: colors.surface },
                      ]}
                    >
                      <ThemedText type="default">{s.username}</ThemedText>
                    </Pressable>
                  ))
                )}
              </View>
            )}

            <View style={styles.modalActions}>
              <Pressable
                onPress={handleCloseModal}
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
        </KeyboardAvoidingView>
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
    flexGrow: 1,
  },
  emptyState: {
    marginTop: 48,
    alignItems: "center",
  },
  fab: {
    position: "absolute",
    right: 16,
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  fabPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 24,
  },
  modalContent: {
    width: "100%",
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
  },
  suggestionsContainer: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    overflow: "hidden",
  },
  suggestionItem: {
    paddingHorizontal: 12,
    paddingVertical: 11,
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
