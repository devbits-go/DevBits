import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { usePreferences } from "@/contexts/PreferencesContext";

type AutoRefreshOptions = {
  focusRefresh?: boolean;
  silentFocusRefresh?: boolean;
  skipInitialFocusRefresh?: boolean;
};

export const useAutoRefresh = (
  onRefresh: () => Promise<void>,
  options: AutoRefreshOptions = {},
) => {
  const { preferences } = usePreferences();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isRunningRef = useRef(false);
  const hasFocusedRef = useRef(false);

  const runRefresh = useCallback(async (options?: { silent?: boolean }) => {
    if (isRunningRef.current) {
      return;
    }
    isRunningRef.current = true;
    if (!options?.silent) {
      setIsRefreshing(true);
    }
    try {
      await onRefresh();
    } finally {
      if (!options?.silent) {
        setIsRefreshing(false);
      }
      isRunningRef.current = false;
    }
  }, [onRefresh]);

  useFocusEffect(
    useCallback(() => {
      if (options.focusRefresh !== false) {
        if (!hasFocusedRef.current && options.skipInitialFocusRefresh) {
          hasFocusedRef.current = true;
        } else {
          hasFocusedRef.current = true;
          runRefresh({ silent: options.silentFocusRefresh !== false });
        }
      }

      let intervalId: ReturnType<typeof setInterval> | null = null;
      if (preferences.backgroundRefreshEnabled && preferences.refreshIntervalMs > 0) {
        intervalId = setInterval(() => {
          runRefresh();
        }, preferences.refreshIntervalMs);
      }

      return () => {
        if (intervalId) {
          clearInterval(intervalId);
        }
      };
    }, [options.focusRefresh, options.silentFocusRefresh, options.skipInitialFocusRefresh, preferences.backgroundRefreshEnabled, preferences.refreshIntervalMs, runRefresh]),
  );

  return { isRefreshing, onRefresh: runRefresh };
};
