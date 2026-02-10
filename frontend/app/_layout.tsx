import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { View } from "react-native";
import "react-native-reanimated";
import { Colors } from "@/constants/Colors";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { SavedProvider } from "@/contexts/SavedContext";
import { SavedStreamsProvider } from "@/contexts/SavedStreamsContext";
import { PreferencesProvider } from "@/contexts/PreferencesContext";
import { NotificationsProvider } from "@/contexts/NotificationsContext";
import { useColorScheme } from "@/hooks/useColorScheme";
import { HyprBackdrop } from "@/components/HyprBackdrop";
// Prevent the splash screen from auto-hiding before asset loading is complete
SplashScreen.preventAutoHideAsync();

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
  const segments = useSegments();
  const router = useRouter();

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

  // Render null if fonts are not loaded
  if (!loaded) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
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
        <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
      </View>
    </ThemeProvider>
  );
}
