import {
  DarkTheme,
  DefaultTheme,
  type Theme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import Constants from "expo-constants";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import "react-native-reanimated";
import { Colors } from "@/constants/Colors";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { SavedProvider } from "@/contexts/SavedContext";
import { SavedStreamsProvider } from "@/contexts/SavedStreamsContext";
import { PreferencesProvider } from "@/contexts/PreferencesContext";
import { NotificationsProvider } from "@/contexts/NotificationsContext";
import { useNotifications } from "@/contexts/NotificationsContext";
import { useColorScheme } from "@/hooks/useColorScheme";
import { HyprBackdrop } from "@/components/HyprBackdrop";
import { BootScreen } from "@/components/BootScreen";
import { InAppNotificationBanner } from "@/components/InAppNotificationBanner";
// Prevent the splash screen from auto-hiding before asset loading is complete
SplashScreen.preventAutoHideAsync();

type NotificationsModule = typeof import("expo-notifications");

const isExpoGoRuntime = () => {
  const ownership = Constants.appOwnership;
  const executionEnvironment = Constants.executionEnvironment;
  return ownership === "expo" || executionEnvironment === "storeClient";
};

let hasShownBoot = false;

const navLightTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: Colors.light.tint,
    background: Colors.light.background,
    card: Colors.light.surface,
    text: Colors.light.text,
    border: Colors.light.border,
    notification: Colors.light.tint,
  },
};

const navDarkTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Colors.dark.tint,
    background: Colors.dark.background,
    card: Colors.dark.surface,
    text: Colors.dark.text,
    border: Colors.dark.border,
    notification: Colors.dark.tint,
  },
};

export default function RootLayout() {
  return (
    <AuthProvider>
      <PreferencesProvider>
        <NotificationsProvider>
          <SavedProvider>
            <SavedStreamsProvider>
              <RootLayoutNav />
            </SavedStreamsProvider>
          </SavedProvider>
        </NotificationsProvider>
      </PreferencesProvider>
    </AuthProvider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });
  const { user, isLoading } = useAuth();
  const { inAppBanner, dismissInAppBanner } = useNotifications();
  const segments = useSegments();
  const router = useRouter();
  const [showBoot, setShowBoot] = useState(() => !hasShownBoot);
  const shouldShowBoot = useMemo(
    () => loaded && showBoot && !hasShownBoot,
    [loaded, showBoot],
  );

  const openFromPayload = (payload: Record<string, any>) => {
    const type = String(payload?.type ?? "").toLowerCase();
    const actorName = String(payload?.actor_name ?? "").trim();
    const asNumber = (value: unknown) => {
      if (typeof value === "number" && Number.isFinite(value)) {
        return value;
      }
      if (typeof value === "string" && value.trim()) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
      }
      return null;
    };

    if (type === "direct_message" && actorName) {
      router.push({ pathname: "/terminal", params: { chat: actorName } });
      return;
    }

    if (type === "follow_user" && actorName) {
      router.push({
        pathname: "/user/[username]",
        params: { username: actorName },
      });
      return;
    }

    const projectId = asNumber(payload?.project_id);
    if ((type === "save_project" || type === "builder_added") && projectId) {
      router.push({
        pathname: "/stream/[projectId]",
        params: { projectId: String(projectId) },
      });
      return;
    }

    const postId = asNumber(payload?.post_id);
    if ((type === "save_post" || type === "comment_post") && postId) {
      router.push({
        pathname: "/post/[postId]",
        params: { postId: String(postId) },
      });
      return;
    }

    router.push("/notifications");
  };

  useEffect(() => {
    if (loaded) {
      // Hide splash screen
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  useEffect(() => {
    if (!loaded || isLoading) {
      return;
    }

    const inAuthGroup = segments[0] === "(auth)";
    if (!user && !inAuthGroup) {
      router.replace("/(auth)/sign-in");
    }
    if (user && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [isLoading, loaded, segments, router, user]);

  useEffect(() => {
    if (isExpoGoRuntime()) {
      return;
    }

    let cancelled = false;
    let subscription: { remove: () => void } | null = null;

    const setup = async () => {
      const Notifications: NotificationsModule =
        await import("expo-notifications");
      if (cancelled) {
        return;
      }

      subscription = Notifications.addNotificationResponseReceivedListener(
        (response) => {
          const data = (response?.notification?.request?.content?.data ??
            {}) as Record<string, any>;
          openFromPayload(data);
        },
      );

      const response = await Notifications.getLastNotificationResponseAsync();
      if (cancelled) {
        return;
      }

      const data = (response?.notification?.request?.content?.data ??
        {}) as Record<string, any>;
      if (Object.keys(data).length) {
        openFromPayload(data);
      }
    };

    void setup();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [router]);

  // Render null if fonts are not loaded
  if (!loaded) {
    return null;
  }

  return (
    <ThemeProvider
      value={colorScheme === "dark" ? navDarkTheme : navLightTheme}
    >
      <View style={{ flex: 1 }}>
        <HyprBackdrop />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: {
              backgroundColor: Colors[colorScheme ?? "light"].background,
            },
          }}
        >
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="+not-found" />
        </Stack>
        {shouldShowBoot ? (
          <BootScreen
            onDone={() => {
              hasShownBoot = true;
              setShowBoot(false);
            }}
          />
        ) : null}
        <InAppNotificationBanner
          visible={!!inAppBanner}
          title={inAppBanner?.title ?? "Notification"}
          body={inAppBanner?.body ?? "You have new activity."}
          onDismiss={dismissInAppBanner}
          onPress={() => {
            const payload =
              (inAppBanner?.payload as Record<string, any> | undefined) ?? {};
            dismissInAppBanner();
            openFromPayload(payload);
          }}
        />
        <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
      </View>
    </ThemeProvider>
  );
}
