import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import * as SecureStore from "expo-secure-store";
import { useAuth } from "@/contexts/AuthContext";
import { getSavedPosts, savePost, unsavePost } from "@/services/api";

const SAVED_KEY = "devbits.saved.posts";

type SavedContextValue = {
  savedPostIds: number[];
  isLoading: boolean;
  isSaved: (postId: number) => boolean;
  toggleSave: (postId: number) => Promise<void>;
};

const SavedContext = createContext<SavedContextValue | undefined>(undefined);

export function SavedProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [savedPostIds, setSavedPostIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSaved = async () => {
      if (user?.username) {
        try {
          const ids = await getSavedPosts(user.username);
          setSavedPostIds(Array.isArray(ids) ? ids : []);
        } catch {
          setSavedPostIds([]);
        } finally {
          setIsLoading(false);
        }
        return;
      }

      const stored = await SecureStore.getItemAsync(SAVED_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as number[];
          setSavedPostIds(Array.isArray(parsed) ? parsed : []);
        } catch {
          setSavedPostIds([]);
        }
      }
      setIsLoading(false);
    };

    loadSaved();
  }, [user?.username]);

  const isSaved = (postId: number) => savedPostIds.includes(postId);

  const toggleSave = async (postId: number) => {
    const isAlreadySaved = savedPostIds.includes(postId);
    const nextIds = isAlreadySaved
      ? savedPostIds.filter((id) => id !== postId)
      : [...savedPostIds, postId];
    setSavedPostIds(nextIds);
    if (user?.username) {
      try {
        if (isAlreadySaved) {
          await unsavePost(user.username, postId);
        } else {
          await savePost(user.username, postId);
        }
      } catch {
        setSavedPostIds(savedPostIds);
      }
      return;
    }

    SecureStore.setItemAsync(SAVED_KEY, JSON.stringify(nextIds));
  };

  const value = useMemo(
    () => ({ savedPostIds, isLoading, isSaved, toggleSave }),
    [savedPostIds, isLoading],
  );

  return (
    <SavedContext.Provider value={value}>{children}</SavedContext.Provider>
  );
}

export function useSaved() {
  const context = useContext(SavedContext);
  if (!context) {
    throw new Error("useSaved must be used within SavedProvider");
  }
  return context;
}
