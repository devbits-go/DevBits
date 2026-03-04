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
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { MessageThreadItem } from "@/components/MessageThreadItem";
import { FadeInImage } from "@/components/FadeInImage";
import { useAppColors } from "@/hooks/useAppColors";
import { useAuth } from "@/contexts/AuthContext";
import {
  getDirectMessageThreads,
  getAllUsers,
  searchUsers,
  resolveMediaUrl,
  ApiDirectMessageThread,
} from "@/services/api";
import { ApiUser } from "@/constants/Types";

const dedupeThreadsByPeer = (items: ApiDirectMessageThread[]) => {
  const byPeer = new Map<string, ApiDirectMessageThread>();
  items.forEach((item) => {
    const peer = (item.peer_username || "").trim().toLowerCase();
    if (!peer) return;
    const existing = byPeer.get(peer);
    if (!existing) {
      byPeer.set(peer, item);
      return;
    }
    const existingAt = new Date(existing.last_at).getTime();
    const nextAt = new Date(item.last_at).getTime();
    if (
      Number.isFinite(nextAt) &&
      (!Number.isFinite(existingAt) || nextAt >= existingAt)
    ) {
      byPeer.set(peer, item);
    }
  });
  return Array.from(byPeer.values()).sort(
    (a, b) => new Date(b.last_at).getTime() - new Date(a.last_at).getTime(),
  );
};

const normalizeUsernameInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const withoutAt = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
  return withoutAt.replace(/@devbits$/i, "");
};

const sortSuggestions = (items: ApiUser[], query: string) => {
  const q = query.toLowerCase();
  return [...items].sort((a, b) => {
    const aName = a.username.toLowerCase();
    const bName = b.username.toLowerCase();
    const aStarts = aName.startsWith(q) ? 0 : 1;
    const bStarts = bName.startsWith(q) ? 0 : 1;
    if (aStarts !== bStarts) {
      return aStarts - bStarts;
    }
    return aName.localeCompare(bName);
  });
};

const filterUsersByQuery = (
  items: ApiUser[],
  query: string,
  currentUsername?: string,
) => {
  const q = query.trim().toLowerCase();
  if (!q) {
    return [] as ApiUser[];
  }

  return items.filter((item) => {
    const username = (item.username || "").trim().toLowerCase();
    if (!username) return false;
    if (currentUsername && username === currentUsername.toLowerCase())
      return false;
    return username.startsWith(q) || username.includes(q);
  });
};

function SuggestionAvatar({
  pictureUrl,
  initial,
  colors,
}: {
  pictureUrl: string;
  initial: string;
  colors: ReturnType<typeof useAppColors>;
}) {
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    setLoadFailed(false);
  }, [pictureUrl]);

  const showPicture = Boolean(pictureUrl) && !loadFailed;

  return (
    <View
      style={[
        styles.suggestionAvatar,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      {showPicture ? (
        <FadeInImage
          source={{ uri: pictureUrl }}
          style={styles.suggestionAvatarImage}
          onLoadFailed={() => setLoadFailed(true)}
        />
      ) : (
        <ThemedText type="caption" style={{ color: colors.muted }}>
          {initial}
        </ThemedText>
      )}
    </View>
  );
}

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
  const latestSearchRequestRef = useRef(0);
  const allUsersCacheRef = useRef<ApiUser[] | null>(null);
  const normalizedQuery = normalizeUsernameInput(searchQuery);

  // Debounced autocomplete
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = normalizedQuery;
    if (!q) {
      latestSearchRequestRef.current += 1;
      setSuggestions([]);
      setIsSuggestionsLoading(false);
      return;
    }

    setIsSuggestionsLoading(true);

    debounceRef.current = setTimeout(async () => {
      const requestId = latestSearchRequestRef.current + 1;
      latestSearchRequestRef.current = requestId;
      try {
        const results = await searchUsers(q, 12);
        if (requestId !== latestSearchRequestRef.current) {
          return;
        }

        let filtered = filterUsersByQuery(results ?? [], q, user?.username);

        if (filtered.length === 0) {
          let allUsers = allUsersCacheRef.current;
          if (!allUsers) {
            allUsers = await getAllUsers(0, 200);
            allUsersCacheRef.current = allUsers;
          }
          filtered = filterUsersByQuery(allUsers, q, user?.username);
        }

        setSuggestions(sortSuggestions(filtered, q).slice(0, 8));
      } catch {
        if (requestId !== latestSearchRequestRef.current) {
          return;
        }

        try {
          let allUsers = allUsersCacheRef.current;
          if (!allUsers) {
            allUsers = await getAllUsers(0, 200);
            allUsersCacheRef.current = allUsers;
          }
          const fallback = filterUsersByQuery(allUsers, q, user?.username);
          setSuggestions(sortSuggestions(fallback, q).slice(0, 8));
        } catch {
          setSuggestions([]);
        }
      } finally {
        if (requestId === latestSearchRequestRef.current) {
          setIsSuggestionsLoading(false);
        }
      }
    }, 150);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [normalizedQuery, user?.username]);

  const fetchThreads = useCallback(async () => {
    if (!user?.username) return;

    try {
      setError(null);
      const threads = await getDirectMessageThreads(user.username, 0, 50);
      setThreads(dedupeThreadsByPeer(Array.isArray(threads) ? threads : []));
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
    }, [fetchThreads]),
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
        <ThemedText
          type="caption"
          style={{ color: colors.muted, textAlign: "center" }}
        >
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
        <ThemedText
          type="caption"
          style={{ color: colors.muted, textAlign: "center" }}
        >
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
    if (!allUsersCacheRef.current) {
      getAllUsers(0, 200)
        .then((users) => {
          allUsersCacheRef.current = users;
        })
        .catch(() => {
          // Ignore; search endpoint or future retries can still populate suggestions.
        });
    }
    setShowNewChatModal(true);
  };

  const handleStartChat = () => {
    const username = normalizeUsernameInput(searchQuery);
    if (!username) {
      Alert.alert(
        "Enter username",
        "Please enter a username to start a conversation.",
      );
      return;
    }

    setShowNewChatModal(false);
    setSearchQuery("");
    setSuggestions([]);
    router.push(`/conversation/${username}`);
  };

  const renderSuggestion = ({
    item,
    index,
  }: {
    item: ApiUser;
    index: number;
  }) => {
    const pictureUrl = resolveMediaUrl(item.picture);
    const initial = item.username?.[0]?.toUpperCase() || "?";

    return (
      <Pressable
        key={item.id || item.username}
        onPress={() => handleSelectSuggestion(item.username)}
        style={({ pressed }) => [
          styles.suggestionItem,
          index < suggestions.length - 1 && {
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          },
          pressed && styles.suggestionItemPressed,
        ]}
      >
        <SuggestionAvatar
          pictureUrl={pictureUrl}
          initial={initial}
          colors={colors}
        />

        <View style={styles.suggestionTextWrap}>
          <ThemedText type="defaultSemiBold" numberOfLines={1}>
            {item.username}
          </ThemedText>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
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
          <Pressable style={styles.modalOverlay} onPress={handleCloseModal}>
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
                  style={[
                    styles.closeButton,
                    { backgroundColor: colors.surfaceAlt },
                  ]}
                >
                  <Feather name="x" size={20} color={colors.text} />
                </Pressable>
              </View>

              <ThemedText
                type="caption"
                style={{ color: colors.muted, marginBottom: 12 }}
              >
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
                    marginBottom: 10,
                  },
                ]}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                returnKeyType="go"
                onSubmitEditing={handleStartChat}
              />

              {/* Autocomplete suggestions */}
              {normalizedQuery.length > 0 && (
                <View
                  style={[
                    styles.suggestionsContainer,
                    {
                      backgroundColor: colors.surfaceAlt,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  {isSuggestionsLoading ? (
                    <ActivityIndicator
                      size="small"
                      color={colors.tint}
                      style={{ paddingVertical: 10 }}
                    />
                  ) : (
                    <FlatList
                      data={suggestions}
                      keyExtractor={(item) => String(item.id ?? item.username)}
                      renderItem={renderSuggestion}
                      keyboardShouldPersistTaps="always"
                      nestedScrollEnabled
                      initialNumToRender={8}
                      maxToRenderPerBatch={8}
                      windowSize={3}
                      ListEmptyComponent={
                        <View style={styles.suggestionsEmpty}>
                          <ThemedText
                            type="caption"
                            style={{ color: colors.muted }}
                          >
                            No users found
                          </ThemedText>
                        </View>
                      }
                    />
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
    maxHeight: 250,
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    minHeight: 50,
  },
  suggestionItemPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  suggestionAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
  },
  suggestionAvatarImage: {
    width: "100%",
    height: "100%",
  },
  suggestionTextWrap: {
    flex: 1,
  },
  suggestionsEmpty: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignItems: "center",
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
