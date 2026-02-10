import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import * as SecureStore from "expo-secure-store";
import { useAuth } from "@/contexts/AuthContext";
import {
  followProject,
  getProjectFollowing,
  unfollowProject,
} from "@/services/api";

const SAVED_STREAMS_KEY = "devbits.saved.streams";

type SavedStreamsContextValue = {
  savedProjectIds: number[];
  isLoading: boolean;
  isSaved: (projectId: number) => boolean;
  toggleSave: (projectId: number) => Promise<void>;
  removeSavedProjectIds: (projectIds: number[]) => Promise<void>;
};

const SavedStreamsContext = createContext<SavedStreamsContextValue | undefined>(
  undefined,
);

export function SavedStreamsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const [savedProjectIds, setSavedProjectIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const normalizeIds = (ids: number[]) =>
    Array.from(new Set(ids.filter((id) => Number.isFinite(id))));

  useEffect(() => {
    const loadSaved = async () => {
      if (user?.username) {
        try {
          const ids = await getProjectFollowing(user.username);
          setSavedProjectIds(Array.isArray(ids) ? normalizeIds(ids) : []);
        } catch {
          setSavedProjectIds([]);
        } finally {
          setIsLoading(false);
        }
        return;
      }

      const stored = await SecureStore.getItemAsync(SAVED_STREAMS_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as number[];
          setSavedProjectIds(Array.isArray(parsed) ? normalizeIds(parsed) : []);
        } catch {
          setSavedProjectIds([]);
        }
      }
      setIsLoading(false);
    };

    loadSaved();
  }, [user?.username]);

  const isSaved = (projectId: number) => savedProjectIds.includes(projectId);

  const toggleSave = async (projectId: number) => {
    const isAlreadySaved = savedProjectIds.includes(projectId);
    if (user?.username) {
      if (isAlreadySaved) {
        await unfollowProject(user.username, projectId);
        setSavedProjectIds((prev) =>
          normalizeIds(prev.filter((id) => id !== projectId)),
        );
      } else {
        await followProject(user.username, projectId);
        setSavedProjectIds((prev) => normalizeIds([...prev, projectId]));
      }

      try {
        const ids = await getProjectFollowing(user.username);
        setSavedProjectIds(Array.isArray(ids) ? normalizeIds(ids) : []);
      } catch {
        // Keep optimistic state if refresh fails.
      }
      return;
    }

    setSavedProjectIds((prev) => {
      const next = normalizeIds(
        prev.includes(projectId)
          ? prev.filter((id) => id !== projectId)
          : [...prev, projectId],
      );
      SecureStore.setItemAsync(SAVED_STREAMS_KEY, JSON.stringify(next));
      return next;
    });
  };

  const removeSavedProjectIds = async (projectIds: number[]) => {
    if (!projectIds.length) {
      return;
    }
    if (user?.username) {
      await Promise.allSettled(
        projectIds.map((projectId) =>
          unfollowProject(user.username, projectId),
        ),
      );
    }
    setSavedProjectIds((prev) => {
      const next = normalizeIds(prev.filter((id) => !projectIds.includes(id)));
      if (!user?.username) {
        SecureStore.setItemAsync(SAVED_STREAMS_KEY, JSON.stringify(next));
      }
      return next;
    });
  };

  const value = useMemo(
    () => ({
      savedProjectIds,
      isLoading,
      isSaved,
      toggleSave,
      removeSavedProjectIds,
    }),
    [isLoading, removeSavedProjectIds, savedProjectIds, toggleSave],
  );

  return (
    <SavedStreamsContext.Provider value={value}>
      {children}
    </SavedStreamsContext.Provider>
  );
}

export function useSavedStreams() {
  const context = useContext(SavedStreamsContext);
  if (!context) {
    throw new Error("useSavedStreams must be used within SavedStreamsProvider");
  }
  return context;
}
