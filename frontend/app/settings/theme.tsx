import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Slider from "@react-native-community/slider";
import { ThemedText } from "@/components/ThemedText";
import { usePreferences } from "@/contexts/PreferencesContext";
import { useAppColors } from "@/hooks/useAppColors";
import { SettingsPageShell, settingsStyles } from "@/features/settings/shared";
import {
  accentPresetOptions,
  hexToHsv,
  hexToRgb,
  hsvToHex,
  rgbToHex,
  visualizationModeOptions,
} from "@/features/settings/utils";

export default function SettingsThemeScreen() {
  const colors = useAppColors();
  const { preferences, updatePreferences } = usePreferences();
  const [accentHue, setAccentHue] = useState(140);
  const [accentSaturation, setAccentSaturation] = useState(0.78);
  const [accentValue, setAccentValue] = useState(0.95);
  const [accentRed, setAccentRed] = useState(0);
  const [accentGreen, setAccentGreen] = useState(243);
  const [accentBlue, setAccentBlue] = useState(41);
  const accentUpdateRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const accentPreview = useMemo(
    () => hsvToHex(accentHue, accentSaturation, accentValue),
    [accentHue, accentSaturation, accentValue],
  );

  useEffect(() => {
    const seed = preferences.accentColor || colors.tint;
    const { h, s, v } = hexToHsv(seed);
    setAccentHue(h);
    setAccentSaturation(s);
    setAccentValue(v);
  }, [colors.tint, preferences.accentColor]);

  useEffect(() => {
    const rgb = hexToRgb(accentPreview);
    setAccentRed(rgb.r);
    setAccentGreen(rgb.g);
    setAccentBlue(rgb.b);
  }, [accentPreview]);

  useEffect(() => {
    return () => {
      if (accentUpdateRef.current) {
        clearTimeout(accentUpdateRef.current);
      }
    };
  }, []);

  const scheduleAccentUpdate = (nextColor: string, flush = false) => {
    if (accentUpdateRef.current) {
      clearTimeout(accentUpdateRef.current);
      accentUpdateRef.current = null;
    }

    if (flush) {
      void updatePreferences({ accentColor: nextColor });
      return;
    }

    accentUpdateRef.current = setTimeout(() => {
      void updatePreferences({ accentColor: nextColor });
      accentUpdateRef.current = null;
    }, 160);
  };

  const applyRgbAccent = (red: number, green: number, blue: number) => {
    const next = rgbToHex(red, green, blue);
    const { h, s, v } = hexToHsv(next);
    setAccentHue(h);
    setAccentSaturation(s);
    setAccentValue(v);
    scheduleAccentUpdate(next);
  };

  return (
    <SettingsPageShell
      title="Theme"
      subtitle="Visual style and accent controls"
    >
      <View
        style={[
          settingsStyles.sectionCard,
          { borderColor: colors.border, backgroundColor: colors.surface },
        ]}
      >
        <ThemedText type="defaultSemiBold">Accent color</ThemedText>

        <View style={styles.previewRow}>
          <View
            style={[
              styles.accentPreview,
              {
                backgroundColor: accentPreview,
                borderColor: colors.border,
              },
            ]}
          />
          <ThemedText type="caption" style={{ color: colors.muted }}>
            {accentPreview}
          </ThemedText>
        </View>

        <View style={settingsStyles.chips}>
          {accentPresetOptions.map((preset) => {
            const active =
              accentPreview.toUpperCase() === preset.color.toUpperCase();
            return (
              <Pressable
                key={preset.label}
                onPress={() => {
                  const next = preset.color.toUpperCase();
                  const { h, s, v } = hexToHsv(next);
                  setAccentHue(h);
                  setAccentSaturation(s);
                  setAccentValue(v);
                  scheduleAccentUpdate(next, true);
                }}
                style={({ pressed }) => [
                  settingsStyles.chip,
                  {
                    borderColor: colors.border,
                    backgroundColor: active ? colors.tint : colors.surfaceAlt,
                  },
                  pressed && { opacity: 0.82 },
                ]}
              >
                <ThemedText
                  type="caption"
                  style={{ color: active ? colors.onTint : colors.muted }}
                >
                  {preset.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        <Label text="Hue" />
        <Slider
          value={accentHue}
          minimumValue={0}
          maximumValue={360}
          step={1}
          onValueChange={(value) => {
            setAccentHue(value);
            scheduleAccentUpdate(
              hsvToHex(value, accentSaturation, accentValue),
            );
          }}
          onSlidingComplete={(value) =>
            scheduleAccentUpdate(
              hsvToHex(value, accentSaturation, accentValue),
              true,
            )
          }
          minimumTrackTintColor={accentPreview}
          maximumTrackTintColor={colors.surfaceAlt}
          thumbTintColor={colors.tint}
          style={settingsStyles.slider}
        />

        <Label text="Saturation" />
        <Slider
          value={accentSaturation}
          minimumValue={0}
          maximumValue={1}
          step={0.01}
          onValueChange={(value) => {
            setAccentSaturation(value);
            scheduleAccentUpdate(hsvToHex(accentHue, value, accentValue));
          }}
          onSlidingComplete={(value) =>
            scheduleAccentUpdate(hsvToHex(accentHue, value, accentValue), true)
          }
          minimumTrackTintColor={accentPreview}
          maximumTrackTintColor={colors.surfaceAlt}
          thumbTintColor={colors.tint}
          style={settingsStyles.slider}
        />

        <Label text="Brightness" />
        <Slider
          value={accentValue}
          minimumValue={0}
          maximumValue={1}
          step={0.01}
          onValueChange={(value) => {
            setAccentValue(value);
            scheduleAccentUpdate(hsvToHex(accentHue, accentSaturation, value));
          }}
          onSlidingComplete={(value) =>
            scheduleAccentUpdate(
              hsvToHex(accentHue, accentSaturation, value),
              true,
            )
          }
          minimumTrackTintColor={accentPreview}
          maximumTrackTintColor={colors.surfaceAlt}
          thumbTintColor={colors.tint}
          style={settingsStyles.slider}
        />

        <Label text={`Red (${accentRed})`} />
        <Slider
          value={accentRed}
          minimumValue={0}
          maximumValue={255}
          step={1}
          onValueChange={(value) => {
            const next = Math.round(value);
            setAccentRed(next);
            applyRgbAccent(next, accentGreen, accentBlue);
          }}
          onSlidingComplete={(value) => {
            const next = Math.round(value);
            scheduleAccentUpdate(rgbToHex(next, accentGreen, accentBlue), true);
          }}
          minimumTrackTintColor="#FF5252"
          maximumTrackTintColor={colors.surfaceAlt}
          thumbTintColor={colors.tint}
          style={settingsStyles.slider}
        />

        <Label text={`Green (${accentGreen})`} />
        <Slider
          value={accentGreen}
          minimumValue={0}
          maximumValue={255}
          step={1}
          onValueChange={(value) => {
            const next = Math.round(value);
            setAccentGreen(next);
            applyRgbAccent(accentRed, next, accentBlue);
          }}
          onSlidingComplete={(value) => {
            const next = Math.round(value);
            scheduleAccentUpdate(rgbToHex(accentRed, next, accentBlue), true);
          }}
          minimumTrackTintColor="#4ADE80"
          maximumTrackTintColor={colors.surfaceAlt}
          thumbTintColor={colors.tint}
          style={settingsStyles.slider}
        />

        <Label text={`Blue (${accentBlue})`} />
        <Slider
          value={accentBlue}
          minimumValue={0}
          maximumValue={255}
          step={1}
          onValueChange={(value) => {
            const next = Math.round(value);
            setAccentBlue(next);
            applyRgbAccent(accentRed, accentGreen, next);
          }}
          onSlidingComplete={(value) => {
            const next = Math.round(value);
            scheduleAccentUpdate(rgbToHex(accentRed, accentGreen, next), true);
          }}
          minimumTrackTintColor="#60A5FA"
          maximumTrackTintColor={colors.surfaceAlt}
          thumbTintColor={colors.tint}
          style={settingsStyles.slider}
        />
      </View>

      <View
        style={[
          settingsStyles.sectionCard,
          { borderColor: colors.border, backgroundColor: colors.surface },
        ]}
      >
        <ThemedText type="defaultSemiBold">Visualization mode</ThemedText>
        <View style={settingsStyles.chips}>
          {visualizationModeOptions.map((option) => {
            const active = preferences.visualizationMode === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() =>
                  void updatePreferences({ visualizationMode: option.value })
                }
                style={({ pressed }) => [
                  settingsStyles.chip,
                  {
                    borderColor: colors.border,
                    backgroundColor: active ? colors.tint : colors.surfaceAlt,
                  },
                  pressed && { opacity: 0.82 },
                ]}
              >
                <ThemedText
                  type="caption"
                  style={{ color: active ? colors.onTint : colors.muted }}
                >
                  {option.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        <Label
          text={`Visualization intensity (${Math.round((preferences.visualizationIntensity ?? 0.55) * 100)}%)`}
        />
        <Slider
          value={preferences.visualizationIntensity ?? 0.55}
          minimumValue={0}
          maximumValue={1}
          step={0.01}
          onValueChange={(value) =>
            void updatePreferences({ visualizationIntensity: value })
          }
          minimumTrackTintColor={colors.tint}
          maximumTrackTintColor={colors.surfaceAlt}
          thumbTintColor={colors.tint}
          style={settingsStyles.slider}
        />
      </View>
    </SettingsPageShell>
  );
}

function Label({ text }: { text: string }) {
  const colors = useAppColors();
  return (
    <ThemedText type="caption" style={{ color: colors.muted }}>
      {text}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  accentPreview: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
  },
});
