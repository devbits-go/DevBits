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
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
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

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

type NotificationsContextValue = {
  notifications: ApiNotification[];
  unreadCount: number;
  isLoading: boolean;
  refresh: () => Promise<void>;
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
  const isRegisteringRef = useRef(false);

  const loadNotifications = useCallback(async () => {
    if (!user?.username) {
      setNotifications([]);
      setUnreadCount(0);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [items, count] = await Promise.all([
        getNotifications(0, 50),
        getNotificationCount(),
      ]);
      setNotifications(Array.isArray(items) ? items : []);
      setUnreadCount(count?.count ?? 0);
    } catch {
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [user?.username]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!user?.username || isRegisteringRef.current) {
      return;
    }
    isRegisteringRef.current = true;

    const register = async () => {
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
  }, [user?.username]);

  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener(() => {
      void loadNotifications();
    });
    return () => subscription.remove();
  }, [loadNotifications]);

  const refresh = useCallback(async () => {
    await loadNotifications();
  }, [loadNotifications]);

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
      refresh,
      markRead,
      remove,
      clearAll,
    }),
    [
      notifications,
      unreadCount,
      isLoading,
      refresh,
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
