import React from "react";
import { Pressable, View } from "react-native";
import Constants from "expo-constants";
import { openBrowserAsync } from "expo-web-browser";
import { ThemedText } from "@/components/ThemedText";
import { useAuth } from "@/contexts/AuthContext";
import { useAppColors } from "@/hooks/useAppColors";
import { SettingsPageShell, settingsStyles } from "@/features/settings/shared";

const SITE_BASE_URL = (
  process.env.EXPO_PUBLIC_SITE_URL?.trim() || "https://devbits.ddns.net"
).replace(/\/+$/, "");

const publicLinks = [
  {
    label: "Privacy policy",
    detail: "Open public privacy policy page",
    href: `${SITE_BASE_URL}/privacy-policy`,
  },
  {
    label: "Account deletion",
    detail: "Open account deletion instructions",
    href: `${SITE_BASE_URL}/account-deletion`,
  },
];

export default function SettingsAboutScreen() {
  const colors = useAppColors();
  const { user } = useAuth();

  const appVersion =
    Constants.expoConfig?.version ??
    Constants.manifest2?.extra?.expoClient?.version ??
    "Unknown";

  const runtimeVersion =
    (typeof Constants.expoConfig?.runtimeVersion === "string"
      ? Constants.expoConfig.runtimeVersion
      : null) || "default";

  return (
    <SettingsPageShell
      title="About"
      subtitle="DevBits app details and public pages"
    >
      <View
        style={[
          settingsStyles.sectionCard,
          { borderColor: colors.border, backgroundColor: colors.surface },
        ]}
      >
        <ThemedText type="defaultSemiBold">App</ThemedText>
        <InfoRow label="App name" value="DevBits" />
        <InfoRow label="Version" value={appVersion} />
        <InfoRow label="Runtime" value={runtimeVersion} />
        <InfoRow label="Signed in" value={user?.username || "Anonymous"} />
      </View>

      <View
        style={[
          settingsStyles.sectionCard,
          { borderColor: colors.border, backgroundColor: colors.surface },
        ]}
      >
        <ThemedText type="defaultSemiBold">Public pages</ThemedText>
        {publicLinks.map((item) => (
          <Pressable
            key={item.href}
            onPress={() => void openBrowserAsync(item.href)}
            style={({ pressed }) => [
              settingsStyles.buttonAlt,
              {
                borderColor: colors.border,
                backgroundColor: colors.surfaceAlt,
                opacity: pressed ? 0.82 : 1,
              },
            ]}
          >
            <View style={{ alignItems: "center", gap: 2 }}>
              <ThemedText type="defaultSemiBold">{item.label}</ThemedText>
              <ThemedText type="caption" style={{ color: colors.muted }}>
                {item.detail}
              </ThemedText>
            </View>
          </Pressable>
        ))}
      </View>

      <ThemedText type="caption" style={{ color: colors.muted }}>
        Base URL: {SITE_BASE_URL}
      </ThemedText>
    </SettingsPageShell>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  const colors = useAppColors();
  return (
    <View style={settingsStyles.rowBetween}>
      <ThemedText type="caption" style={{ color: colors.muted }}>
        {label}
      </ThemedText>
      <ThemedText type="defaultSemiBold">{value}</ThemedText>
    </View>
  );
}
