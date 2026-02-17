import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Constants from "expo-constants";
import { AppState, Platform } from "react-native";
import { ApiNotification } from "@/constants/Types";
import {
  clearNotifications,
  deleteNotification,
  getNotificationCount,
  getNotifications,
  markNotificationRead,
  registerPushToken,
} from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";

type NotificationsModule = typeof import("expo-notifications");

const isExpoGoRuntime = () => {
  const ownership = Constants.appOwnership;
  const executionEnvironment = Constants.executionEnvironment;
  return ownership === "expo" || executionEnvironment === "storeClient";
};

type NotificationsContextValue = {
  notifications: ApiNotification[];
  unreadCount: number;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  inAppBanner: {
    key: string;
    title: string;
    body: string;
    payload: Record<string, unknown>;
  } | null;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  dismissInAppBanner: () => void;
  showInAppBanner: (input: {
    title: string;
    body: string;
    payload?: Record<string, unknown>;
    incrementUnread?: boolean;
  }) => void;
  markRead: (notificationId: number) => Promise<void>;
  remove: (notificationId: number) => Promise<void>;
  clearAll: () => Promise<void>;
};

const NotificationsContext = createContext<
  NotificationsContextValue | undefined
>(undefined);

export function NotificationsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [inAppBanner, setInAppBanner] = useState<{
    key: string;
    title: string;
    body: string;
    payload: Record<string, unknown>;
  } | null>(null);
  const pageSize = 40;
  const pollIntervalMs = 2500;
  const isRegisteringRef = useRef(false);
  const notificationsModuleRef = useRef<NotificationsModule | null>(null);
  const hasHydratedRef = useRef(false);
  const latestTopIdRef = useRef<number | undefined>(undefined);
  const latestUnreadRef = useRef(0);
  const expoGo = useMemo(() => isExpoGoRuntime(), []);

  useEffect(() => {
    latestTopIdRef.current = notifications[0]?.id;
    latestUnreadRef.current = unreadCount;
  }, [notifications, unreadCount]);

  const mergeUniqueById = useCallback(
    (prev: ApiNotification[], next: ApiNotification[]) => {
      if (!next.length) {
        return prev;
      }
      const seen = new Set(prev.map((item) => item.id));
      const merged = [...prev];
      next.forEach((item) => {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          merged.push(item);
        }
      });
      return merged;
    },
    [],
  );

  const getNotificationTitle = useCallback((type: string) => {
    switch (type) {
      case "direct_message":
        return "New message";
      case "builder_added":
        return "Builder invite";
      case "comment_post":
        return "New comment";
      case "save_post":
        return "Byte saved";
      case "save_project":
        return "Stream saved";
      case "follow_user":
        return "New follower";
      default:
        return "Notification";
    }
  }, []);

  const getNotificationBody = useCallback(
    (type: string, actorName?: string) => {
      const actor = actorName || "Someone";
      switch (type) {
        case "direct_message":
          return `${actor} sent you a message.`;
        case "builder_added":
          return `${actor} added you as a builder.`;
        case "comment_post":
          return `${actor} commented on your byte.`;
        case "save_post":
          return `${actor} saved your byte.`;
        case "save_project":
          return `${actor} saved your stream.`;
        case "follow_user":
          return `${actor} followed you.`;
        default:
          return `${actor} sent you a notification.`;
      }
    },
    [],
  );

  const showInAppBanner = useCallback(
    (input: {
      title: string;
      body: string;
      payload?: Record<string, unknown>;
      incrementUnread?: boolean;
    }) => {
      if (input.incrementUnread) {
        setUnreadCount((prev) => prev + 1);
      }
      setInAppBanner({
        key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: input.title,
        body: input.body,
        payload: input.payload ?? {},
      });
    },
    [],
  );

  const loadNotifications = useCallback(
    async (showLoader = true) => {
      if (!user?.username) {
        setNotifications([]);
        setUnreadCount(0);
        setIsLoading(false);
        setIsLoadingMore(false);
        setHasMore(false);
        return;
      }
      if (showLoader) {
        setIsLoading(true);
      }
      try {
        const [items, count] = await Promise.all([
          getNotifications(0, pageSize),
          getNotificationCount(),
        ]);
        const safeItems = Array.isArray(items) ? items : [];
        const nextUnread = count?.count ?? 0;
        const previousTopId = latestTopIdRef.current;
        const nextTop = safeItems[0];

        setNotifications(safeItems);
        setHasMore(safeItems.length === pageSize);
        setUnreadCount(nextUnread);

        if (
          hasHydratedRef.current &&
          nextTop &&
          typeof previousTopId === "number" &&
          nextTop.id !== previousTopId &&
          nextUnread > latestUnreadRef.current
        ) {
          const type = String(nextTop.type ?? "notification");
          const actorName = String(nextTop.actor_name ?? "");
          setInAppBanner({
            key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            title: getNotificationTitle(type),
            body: getNotificationBody(type, actorName),
            payload: {
              type,
              actor_name: actorName,
              project_id: nextTop.project_id ?? undefined,
              post_id: nextTop.post_id ?? undefined,
            },
          });
        }

        hasHydratedRef.current = true;
      } catch {
        setNotifications([]);
        setUnreadCount(0);
        setHasMore(false);
      } finally {
        if (showLoader) {
          setIsLoading(false);
        }
      }
    },
    [getNotificationBody, getNotificationTitle, pageSize, user?.username],
  );

  const loadMore = useCallback(async () => {
    if (!user?.username || isLoading || isLoadingMore || !hasMore) {
      return;
    }
    setIsLoadingMore(true);
    try {
      const start = notifications.length;
      const items = await getNotifications(start, pageSize);
      const safeItems = Array.isArray(items) ? items : [];
      setNotifications((prev) => mergeUniqueById(prev, safeItems));
      setHasMore(safeItems.length === pageSize);
    } catch {
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [
    hasMore,
    isLoading,
    isLoadingMore,
    mergeUniqueById,
    notifications.length,
    pageSize,
    user?.username,
  ]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!user?.username) {
      return;
    }
    const intervalId = setInterval(() => {
      void loadNotifications(false);
    }, pollIntervalMs);
    return () => {
      clearInterval(intervalId);
    };
  }, [loadNotifications, pollIntervalMs, user?.username]);

  useEffect(() => {
    if (!user?.username) {
      return;
    }
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void loadNotifications(false);
      }
    });
    return () => {
      subscription.remove();
    };
  }, [loadNotifications, user?.username]);

  useEffect(() => {
    if (!user?.username || isRegisteringRef.current || expoGo) {
      return;
    }
    isRegisteringRef.current = true;

    const register = async () => {
      const Notifications =
        notificationsModuleRef.current ?? (await import("expo-notifications"));
      notificationsModuleRef.current = Notifications;

      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: false,
          shouldShowBanner: false,
          shouldShowList: false,
          shouldPlaySound: false,
          shouldSetBadge: false,
        }),
      });

      const permissions = await Notifications.getPermissionsAsync();
      let status = permissions.status;
      if (status !== "granted") {
        const request = await Notifications.requestPermissionsAsync();
        status = request.status;
      }
      if (status !== "granted") {
        return;
      }

      const projectId =
        Constants.easConfig?.projectId ??
        Constants.expoConfig?.extra?.eas?.projectId ??
        null;
      if (!projectId) {
        return;
      }

      try {
        const tokenResponse = await Notifications.getExpoPushTokenAsync({
          projectId,
        });
        const platform = Platform.OS === "ios" ? "ios" : "android";
        await registerPushToken({
          token: tokenResponse.data,
          platform,
        });
      } catch {
        // Ignore token registration failures in Expo Go.
      }
    };

    register().finally(() => {
      isRegisteringRef.current = false;
    });
  }, [expoGo, user?.username]);

  useEffect(() => {
    if (expoGo) {
      return;
    }

    let cancelled = false;
    let subscription: { remove: () => void } | null = null;

    const setupListener = async () => {
      const Notifications =
        notificationsModuleRef.current ?? (await import("expo-notifications"));
      if (cancelled) {
        return;
      }

      notificationsModuleRef.current = Notifications;
      subscription = Notifications.addNotificationReceivedListener(
        (incoming) => {
          const payload = (incoming?.request?.content?.data ?? {}) as Record<
            string,
            unknown
          >;
          const type = String(payload.type ?? "notification");
          const actorName = String(payload.actor_name ?? "");
          const title =
            String(incoming?.request?.content?.title ?? "").trim() ||
            getNotificationTitle(type);
          const body =
            String(incoming?.request?.content?.body ?? "").trim() ||
            getNotificationBody(type, actorName);

          showInAppBanner({
            title,
            body,
            payload,
            incrementUnread: true,
          });

          void loadNotifications(false);
        },
      );
    };

    void setupListener();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [
    expoGo,
    getNotificationBody,
    getNotificationTitle,
    loadNotifications,
    showInAppBanner,
  ]);

  const refresh = useCallback(async () => {
    await loadNotifications();
  }, [loadNotifications]);

  const dismissInAppBanner = useCallback(() => {
    setInAppBanner(null);
  }, []);

  const markRead = useCallback(
    async (notificationId: number) => {
      const target = notifications.find((item) => item.id === notificationId);
      await markNotificationRead(notificationId);
      setNotifications((prev) =>
        prev.map((item) =>
          item.id === notificationId
            ? { ...item, read_at: new Date().toISOString() }
            : item,
        ),
      );
      if (!target?.read_at) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    },
    [notifications],
  );

  const remove = useCallback(
    async (notificationId: number) => {
      const target = notifications.find((item) => item.id === notificationId);
      await deleteNotification(notificationId);
      setNotifications((prev) =>
        prev.filter((item) => item.id !== notificationId),
      );
      if (target && !target.read_at) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    },
    [notifications],
  );

  const clearAll = useCallback(async () => {
    await clearNotifications();
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      isLoading,
      isLoadingMore,
      hasMore,
      inAppBanner,
      refresh,
      loadMore,
      dismissInAppBanner,
      showInAppBanner,
      markRead,
      remove,
      clearAll,
    }),
    [
      notifications,
      unreadCount,
      isLoading,
      isLoadingMore,
      hasMore,
      inAppBanner,
      refresh,
      loadMore,
      dismissInAppBanner,
      showInAppBanner,
      markRead,
      remove,
      clearAll,
    ],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error(
      "useNotifications must be used within NotificationsProvider",
    );
  }
  return context;
}
