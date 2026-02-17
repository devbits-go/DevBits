import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import Slider from "@react-native-community/slider";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { FloatingScrollTopButton } from "@/components/FloatingScrollTopButton";
import { ThemedText } from "@/components/ThemedText";
import { TopBlur } from "@/components/TopBlur";
import { FadeInImage } from "@/components/FadeInImage";
import { useAuth } from "@/contexts/AuthContext";
import { usePreferences } from "@/contexts/PreferencesContext";
import {
  deleteUser,
  resolveMediaUrl,
  updateUser,
  uploadMedia,
} from "@/services/api";
import { useAppColors } from "@/hooks/useAppColors";
import { useMotionConfig } from "@/hooks/useMotionConfig";
import { useTopBlurScroll } from "@/hooks/useTopBlurScroll";
import * as ImagePicker from "expo-image-picker";

export default function SettingsScreen() {
  const colors = useAppColors();
  const { fontScale, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, refreshUser, signOut } = useAuth();
  const { preferences, updatePreferences } = usePreferences();
  const motion = useMotionConfig();
  const reveal = React.useRef(new Animated.Value(0.08)).current;
  const scrollRef = useRef<ScrollView | null>(null);
  const { scrollY, onScroll } = useTopBlurScroll();
  const [picture, setPicture] = useState(user?.picture ?? "");
  const [pendingPicture, setPendingPicture] = useState<{
    uri: string;
    name: string;
    type: string;
  } | null>(null);
  const [bio, setBio] = useState(user?.bio ?? "");
  const [website, setWebsite] = useState("");
  const [github, setGithub] = useState("");
  const [twitter, setTwitter] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [extraLinks, setExtraLinks] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [message, setMessage] = useState("");
  const [accentHue, setAccentHue] = useState(140);
  const [accentSaturation, setAccentSaturation] = useState(0.78);
  const [accentValue, setAccentValue] = useState(0.95);
  const [accentRed, setAccentRed] = useState(0);
  const [accentGreen, setAccentGreen] = useState(243);
  const [accentBlue, setAccentBlue] = useState(41);
  const accentUpdateRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentHorizontalPadding = width < 370 ? 12 : 16;
  const inputFontSize = Math.round(15 * Math.min(1.25, Math.max(1, fontScale)));
  const inputLineHeight = Math.round(
    22 * Math.min(1.25, Math.max(1, fontScale)),
  );

  useEffect(() => {
    if (!user) {
      setPicture("");
      setBio("");
      setWebsite("");
      setGithub("");
      setTwitter("");
      setLinkedin("");
      setExtraLinks("");
      setHasLoaded(false);
      setIsDirty(false);
      return;
    }

    if (isDirty) {
      return;
    }
    setPicture(user.picture ?? "");
    setPendingPicture(null);
    setBio(user.bio ?? "");
    const parsed = parseLinks(user.links ?? []);
    setWebsite(parsed.website);
    setGithub(parsed.github);
    setTwitter(parsed.twitter);
    setLinkedin(parsed.linkedin);
    setExtraLinks(parsed.extraLinks.join(", "));
    setHasLoaded(true);
  }, [isDirty, user]);

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
    if (!user?.username || isDirty || isSaving) {
      return;
    }
    let isActive = true;
    const refresh = async () => {
      setIsSyncing(true);
      try {
        await refreshUser();
      } catch {
        // AuthContext handles auth/session reset; avoid uncaught sync errors here.
      } finally {
        if (isActive) {
          setIsSyncing(false);
        }
      }
    };

    refresh();
    return () => {
      isActive = false;
    };
  }, [isDirty, isSaving, refreshUser, user?.username]);

  useEffect(() => {
    if (motion.prefersReducedMotion) {
      reveal.setValue(1);
      return;
    }

    Animated.timing(reveal, {
      toValue: 1,
      duration: motion.duration(320),
      useNativeDriver: true,
    }).start();
  }, [motion, reveal]);

  const accentPreview = hsvToHex(accentHue, accentSaturation, accentValue);

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

  const handleInputFocus = (event: any) => {
    const target = event?.target ?? event?.nativeEvent?.target;
    if (!target) {
      return;
    }
    scrollRef.current?.scrollResponderScrollNativeHandleToKeyboard(
      target,
      84,
      true,
    );
  };

  const handlePickImage = async () => {
    const currentPermission =
      await ImagePicker.getMediaLibraryPermissionsAsync();
    const isAllowed =
      currentPermission.granted ||
      currentPermission.accessPrivileges === "limited";
    let permission = currentPermission;

    if (!isAllowed && currentPermission.canAskAgain) {
      permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    }

    if (!permission.granted && permission.accessPrivileges !== "limited") {
      setMessage("Photo access is required to pick an image.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.length) {
      const asset = result.assets[0];
      setPicture(asset.uri);
      setPendingPicture({
        uri: asset.uri,
        name: asset.fileName ?? `profile-${Date.now()}.jpg`,
        type: asset.mimeType ?? "image/jpeg",
      });
      setIsDirty(true);
    }
  };

  const resolvedPicture = resolveMediaUrl(picture);

  const handleSave = async () => {
    if (!user?.username) {
      return;
    }
    setIsSaving(true);
    setMessage("");
    try {
      let nextPicture = picture.trim();
      if (pendingPicture && /^file:|^content:/i.test(nextPicture)) {
        const upload = await uploadMedia(pendingPicture);
        nextPicture = upload?.url ?? nextPicture;
        setPicture(nextPicture);
        setPendingPicture(null);
      }
      const linkList = buildLinks({
        website,
        github,
        twitter,
        linkedin,
        extraLinks,
      });
      await updateUser(user.username, {
        bio,
        links: linkList,
        picture: nextPicture,
      });
      await refreshUser();
      setIsDirty(false);
      setMessage("Profile updated.");
    } catch {
      setMessage("Update failed. Try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = () => {
    if (!user?.username || isDeletingAccount) {
      return;
    }
    Alert.alert(
      "Delete account?",
      "This permanently deletes your account, streams, bytes, and history.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setIsDeletingAccount(true);
              setMessage("");
              try {
                await deleteUser(user.username);
                await signOut();
              } catch {
                setMessage("Account deletion failed. Try again.");
              } finally {
                setIsDeletingAccount(false);
              }
            })();
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.screen} edges={[]}>
        <KeyboardAvoidingView
          style={styles.screen}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={insets.top + 12}
        >
          <View style={styles.screen}>
            <Animated.ScrollView
              ref={scrollRef}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={
                Platform.OS === "ios" ? "interactive" : "on-drag"
              }
              onScroll={onScroll}
              scrollEventThrottle={16}
              alwaysBounceVertical
              bounces
              nestedScrollEnabled
              automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
              contentInsetAdjustmentBehavior="automatic"
              onScrollBeginDrag={Keyboard.dismiss}
              contentContainerStyle={[
                styles.content,
                {
                  paddingHorizontal: contentHorizontalPadding,
                  paddingTop: insets.top + 8,
                  paddingBottom: insets.bottom + 20,
                },
              ]}
              scrollIndicatorInsets={{ bottom: insets.bottom + 8 }}
            >
              <Animated.View
                style={{
                  opacity: reveal,
                  transform: [
                    {
                      translateY: reveal.interpolate({
                        inputRange: [0, 1],
                        outputRange: [12, 0],
                      }),
                    },
                  ],
                }}
              >
                <View style={styles.header}>
                  <ThemedText type="display">Settings</ThemedText>
                  <ThemedText type="caption" style={{ color: colors.muted }}>
                    Tune your profile and links.
                  </ThemedText>
                  {isSyncing ? (
                    <ActivityIndicator
                      size="small"
                      color={colors.muted}
                      style={styles.syncIndicator}
                    />
                  ) : null}
                </View>

                <View style={[styles.form, !hasLoaded && styles.formLoading]}>
                  <View style={styles.avatarRow}>
                    <View
                      style={[
                        styles.avatar,
                        {
                          backgroundColor: colors.surfaceAlt,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      {picture ? (
                        <FadeInImage
                          source={{ uri: resolvedPicture }}
                          style={styles.avatarImage}
                        />
                      ) : (
                        <ThemedText
                          type="caption"
                          style={{ color: colors.muted }}
                        >
                          Add photo
                        </ThemedText>
                      )}
                    </View>
                    <Pressable
                      onPress={handlePickImage}
                      style={({ pressed }) => [
                        styles.pickButton,
                        { borderColor: colors.border },
                        pressed && styles.pressFeedback,
                      ]}
                    >
                      <ThemedText
                        type="caption"
                        style={{ color: colors.muted }}
                      >
                        Choose image
                      </ThemedText>
                    </Pressable>
                  </View>
                  <View
                    style={[
                      styles.inputRow,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.surface,
                      },
                    ]}
                  >
                    <TextInput
                      value={picture}
                      onChangeText={(value) => {
                        setIsDirty(true);
                        setPicture(value);
                        setPendingPicture(null);
                      }}
                      placeholder="Profile image URL"
                      placeholderTextColor={colors.muted}
                      onFocus={handleInputFocus}
                      allowFontScaling
                      maxFontSizeMultiplier={1.25}
                      style={[
                        styles.input,
                        {
                          color: colors.text,
                          fontSize: inputFontSize,
                          lineHeight: inputLineHeight,
                        },
                      ]}
                    />
                  </View>
                  <View
                    style={[
                      styles.inputRow,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.surface,
                      },
                    ]}
                  >
                    <TextInput
                      value={bio}
                      onChangeText={(value) => {
                        setIsDirty(true);
                        setBio(value);
                      }}
                      placeholder="Bio"
                      placeholderTextColor={colors.muted}
                      onFocus={handleInputFocus}
                      textAlignVertical="top"
                      multiline
                      allowFontScaling
                      maxFontSizeMultiplier={1.25}
                      style={[
                        styles.input,
                        {
                          color: colors.text,
                          minHeight: Math.max(80, inputLineHeight * 4),
                          fontSize: inputFontSize,
                          lineHeight: inputLineHeight,
                        },
                      ]}
                    />
                  </View>
                  <View
                    style={[
                      styles.inputRow,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.surface,
                      },
                    ]}
                  >
                    <TextInput
                      value={website}
                      onChangeText={(value) => {
                        setIsDirty(true);
                        setWebsite(value);
                      }}
                      placeholder="Website"
                      placeholderTextColor={colors.muted}
                      onFocus={handleInputFocus}
                      allowFontScaling
                      maxFontSizeMultiplier={1.25}
                      style={[
                        styles.input,
                        {
                          color: colors.text,
                          fontSize: inputFontSize,
                          lineHeight: inputLineHeight,
                        },
                      ]}
                    />
                  </View>
                  <View
                    style={[
                      styles.inputRow,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.surface,
                      },
                    ]}
                  >
                    <TextInput
                      value={github}
                      onChangeText={(value) => {
                        setIsDirty(true);
                        setGithub(value);
                      }}
                      placeholder="GitHub"
                      placeholderTextColor={colors.muted}
                      onFocus={handleInputFocus}
                      allowFontScaling
                      maxFontSizeMultiplier={1.25}
                      style={[
                        styles.input,
                        {
                          color: colors.text,
                          fontSize: inputFontSize,
                          lineHeight: inputLineHeight,
                        },
                      ]}
                    />
                  </View>
                  <View
                    style={[
                      styles.inputRow,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.surface,
                      },
                    ]}
                  >
                    <TextInput
                      value={twitter}
                      onChangeText={(value) => {
                        setIsDirty(true);
                        setTwitter(value);
                      }}
                      placeholder="Twitter/X"
                      placeholderTextColor={colors.muted}
                      onFocus={handleInputFocus}
                      allowFontScaling
                      maxFontSizeMultiplier={1.25}
                      style={[
                        styles.input,
                        {
                          color: colors.text,
                          fontSize: inputFontSize,
                          lineHeight: inputLineHeight,
                        },
                      ]}
                    />
                  </View>
                  <View
                    style={[
                      styles.inputRow,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.surface,
                      },
                    ]}
                  >
                    <TextInput
                      value={linkedin}
                      onChangeText={(value) => {
                        setIsDirty(true);
                        setLinkedin(value);
                      }}
                      placeholder="LinkedIn"
                      placeholderTextColor={colors.muted}
                      onFocus={handleInputFocus}
                      allowFontScaling
                      maxFontSizeMultiplier={1.25}
                      style={[
                        styles.input,
                        {
                          color: colors.text,
                          fontSize: inputFontSize,
                          lineHeight: inputLineHeight,
                        },
                      ]}
                    />
                  </View>
                  <View
                    style={[
                      styles.inputRow,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.surface,
                      },
                    ]}
                  >
                    <TextInput
                      value={extraLinks}
                      onChangeText={(value) => {
                        setIsDirty(true);
                        setExtraLinks(value);
                      }}
                      placeholder="Other links (comma separated)"
                      placeholderTextColor={colors.muted}
                      onFocus={handleInputFocus}
                      allowFontScaling
                      maxFontSizeMultiplier={1.25}
                      style={[
                        styles.input,
                        {
                          color: colors.text,
                          fontSize: inputFontSize,
                          lineHeight: inputLineHeight,
                        },
                      ]}
                    />
                  </View>

                  {message ? (
                    <ThemedText type="caption" style={{ color: colors.muted }}>
                      {message}
                    </ThemedText>
                  ) : null}

                  <Pressable
                    onPress={handleSave}
                    style={({ pressed }) => [
                      styles.button,
                      { backgroundColor: colors.tint },
                      pressed && styles.pressFeedbackStrong,
                    ]}
                  >
                    {isSaving ? (
                      <ActivityIndicator size="small" color={colors.onTint} />
                    ) : (
                      <ThemedText
                        type="defaultSemiBold"
                        style={{ color: colors.onTint }}
                      >
                        Save changes
                      </ThemedText>
                    )}
                  </Pressable>
                  <View style={styles.section}>
                    <ThemedText type="subtitle">Site settings</ThemedText>
                    <View style={styles.toggleRow}>
                      <ThemedText type="default">Background refresh</ThemedText>
                      <Switch
                        value={preferences.backgroundRefreshEnabled}
                        onValueChange={(value) =>
                          updatePreferences({
                            backgroundRefreshEnabled: value,
                          })
                        }
                        trackColor={{
                          false: colors.surfaceAlt,
                          true: colors.tint,
                        }}
                        thumbColor={colors.accent}
                      />
                    </View>
                    <View style={styles.toggleRow}>
                      <ThemedText type="default">
                        Prompt for link scheme
                      </ThemedText>
                      <Switch
                        value={preferences.linkOpenMode === "promptScheme"}
                        onValueChange={(value) =>
                          updatePreferences({
                            linkOpenMode: value ? "promptScheme" : "asTyped",
                          })
                        }
                        trackColor={{
                          false: colors.surfaceAlt,
                          true: colors.tint,
                        }}
                        thumbColor={colors.accent}
                      />
                    </View>
                    <View style={styles.toggleRow}>
                      <ThemedText type="default">Refresh interval</ThemedText>
                      <View style={styles.intervalRow}>
                        {intervalOptions.map((option) => {
                          const isActive =
                            preferences.refreshIntervalMs === option.value;
                          return (
                            <Pressable
                              key={option.value}
                              onPress={() =>
                                updatePreferences({
                                  refreshIntervalMs: option.value,
                                })
                              }
                              disabled={!preferences.backgroundRefreshEnabled}
                              style={({ pressed }) => [
                                styles.intervalChip,
                                {
                                  borderColor: colors.border,
                                  backgroundColor: isActive
                                    ? colors.tint
                                    : colors.surfaceAlt,
                                  opacity: preferences.backgroundRefreshEnabled
                                    ? 1
                                    : 0.5,
                                },
                                pressed && styles.pressFeedback,
                              ]}
                            >
                              <ThemedText
                                type="caption"
                                style={{
                                  color: isActive
                                    ? colors.onTint
                                    : colors.muted,
                                }}
                              >
                                {option.label}
                              </ThemedText>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  </View>

                  <View style={styles.section}>
                    <ThemedText type="subtitle">Personalization</ThemedText>
                    <View style={styles.toggleRow}>
                      <ThemedText type="default">
                        Zen mode (reduce motion)
                      </ThemedText>
                      <Switch
                        value={preferences.zenMode}
                        onValueChange={(value) =>
                          updatePreferences({ zenMode: value })
                        }
                        trackColor={{
                          false: colors.surfaceAlt,
                          true: colors.tint,
                        }}
                        thumbColor={colors.accent}
                      />
                    </View>
                    <View style={styles.toggleRow}>
                      <ThemedText type="default">Compact layout</ThemedText>
                      <Switch
                        value={preferences.compactMode}
                        onValueChange={(value) =>
                          updatePreferences({ compactMode: value })
                        }
                        trackColor={{
                          false: colors.surfaceAlt,
                          true: colors.tint,
                        }}
                        thumbColor={colors.accent}
                      />
                    </View>
                    <View style={styles.accentRow}>
                      <ThemedText type="default">Text render effect</ThemedText>
                      <View style={styles.optionRowWrap}>
                        {textRenderOptions.map((option) => {
                          const isActive =
                            preferences.textRenderEffect === option.value;
                          return (
                            <Pressable
                              key={option.value}
                              onPress={() =>
                                updatePreferences({
                                  textRenderEffect: option.value,
                                })
                              }
                              style={({ pressed }) => [
                                styles.intervalChip,
                                {
                                  borderColor: colors.border,
                                  backgroundColor: isActive
                                    ? colors.tint
                                    : colors.surfaceAlt,
                                },
                                pressed && styles.pressFeedback,
                              ]}
                            >
                              <ThemedText
                                type="caption"
                                style={{
                                  color: isActive
                                    ? colors.onTint
                                    : colors.muted,
                                }}
                              >
                                {option.label}
                              </ThemedText>
                            </Pressable>
                          );
                        })}
                      </View>
                      <ThemedText
                        type="caption"
                        animateOnMount
                        animationMode="auto"
                        style={{ color: colors.muted }}
                      >
                        LOADING DATA
                      </ThemedText>
                    </View>
                    <View style={styles.accentRow}>
                      <ThemedText type="default">Image reveal</ThemedText>
                      <View style={styles.optionRowWrap}>
                        {imageRevealOptions.map((option) => {
                          const isActive =
                            preferences.imageRevealEffect === option.value;
                          return (
                            <Pressable
                              key={option.value}
                              onPress={() =>
                                updatePreferences({
                                  imageRevealEffect: option.value,
                                })
                              }
                              style={({ pressed }) => [
                                styles.intervalChip,
                                {
                                  borderColor: colors.border,
                                  backgroundColor: isActive
                                    ? colors.tint
                                    : colors.surfaceAlt,
                                },
                                pressed && styles.pressFeedback,
                              ]}
                            >
                              <ThemedText
                                type="caption"
                                style={{
                                  color: isActive
                                    ? colors.onTint
                                    : colors.muted,
                                }}
                              >
                                {option.label}
                              </ThemedText>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                    <View style={styles.accentRow}>
                      <ThemedText type="default">Accent color</ThemedText>
                      <View style={styles.accentPicker}>
                        <View
                          style={[
                            styles.accentPreview,
                            {
                              backgroundColor: accentPreview,
                              borderColor: colors.border,
                            },
                          ]}
                        />
                        <ThemedText
                          type="caption"
                          style={{ color: colors.muted }}
                        >
                          {accentPreview.toUpperCase()}
                        </ThemedText>
                      </View>
                      <View style={styles.optionRowWrap}>
                        {accentPresetOptions.map((preset) => {
                          const isActive =
                            accentPreview.toUpperCase() ===
                            preset.color.toUpperCase();
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
                                styles.intervalChip,
                                {
                                  borderColor: colors.border,
                                  backgroundColor: isActive
                                    ? colors.tint
                                    : colors.surfaceAlt,
                                },
                                pressed && styles.pressFeedback,
                              ]}
                            >
                              <ThemedText
                                type="caption"
                                style={{
                                  color: isActive
                                    ? colors.onTint
                                    : colors.muted,
                                }}
                              >
                                {preset.label}
                              </ThemedText>
                            </Pressable>
                          );
                        })}
                      </View>
                      <View style={styles.sliderGroup}>
                        <ThemedText
                          type="caption"
                          style={{ color: colors.muted }}
                        >
                          Hue
                        </ThemedText>
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
                          style={styles.slider}
                        />
                      </View>
                      <View style={styles.sliderGroup}>
                        <ThemedText
                          type="caption"
                          style={{ color: colors.muted }}
                        >
                          Saturation
                        </ThemedText>
                        <Slider
                          value={accentSaturation}
                          minimumValue={0}
                          maximumValue={1}
                          step={0.01}
                          onValueChange={(value) => {
                            setAccentSaturation(value);
                            scheduleAccentUpdate(
                              hsvToHex(accentHue, value, accentValue),
                            );
                          }}
                          onSlidingComplete={(value) =>
                            scheduleAccentUpdate(
                              hsvToHex(accentHue, value, accentValue),
                              true,
                            )
                          }
                          minimumTrackTintColor={accentPreview}
                          maximumTrackTintColor={colors.surfaceAlt}
                          thumbTintColor={colors.tint}
                          style={styles.slider}
                        />
                      </View>
                      <View style={styles.sliderGroup}>
                        <ThemedText
                          type="caption"
                          style={{ color: colors.muted }}
                        >
                          Brightness
                        </ThemedText>
                        <Slider
                          value={accentValue}
                          minimumValue={0}
                          maximumValue={1}
                          step={0.01}
                          onValueChange={(value) => {
                            setAccentValue(value);
                            scheduleAccentUpdate(
                              hsvToHex(accentHue, accentSaturation, value),
                            );
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
                          style={styles.slider}
                        />
                      </View>
                      <View style={styles.sliderGroup}>
                        <ThemedText
                          type="caption"
                          style={{ color: colors.muted }}
                        >
                          Red ({accentRed})
                        </ThemedText>
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
                            const hex = rgbToHex(next, accentGreen, accentBlue);
                            scheduleAccentUpdate(hex, true);
                          }}
                          minimumTrackTintColor="#FF5252"
                          maximumTrackTintColor={colors.surfaceAlt}
                          thumbTintColor={colors.tint}
                          style={styles.slider}
                        />
                      </View>
                      <View style={styles.sliderGroup}>
                        <ThemedText
                          type="caption"
                          style={{ color: colors.muted }}
                        >
                          Green ({accentGreen})
                        </ThemedText>
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
                            const hex = rgbToHex(accentRed, next, accentBlue);
                            scheduleAccentUpdate(hex, true);
                          }}
                          minimumTrackTintColor="#4ADE80"
                          maximumTrackTintColor={colors.surfaceAlt}
                          thumbTintColor={colors.tint}
                          style={styles.slider}
                        />
                      </View>
                      <View style={styles.sliderGroup}>
                        <ThemedText
                          type="caption"
                          style={{ color: colors.muted }}
                        >
                          Blue ({accentBlue})
                        </ThemedText>
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
                            const hex = rgbToHex(accentRed, accentGreen, next);
                            scheduleAccentUpdate(hex, true);
                          }}
                          minimumTrackTintColor="#60A5FA"
                          maximumTrackTintColor={colors.surfaceAlt}
                          thumbTintColor={colors.tint}
                          style={styles.slider}
                        />
                      </View>
                    </View>
                    <View style={styles.accentRow}>
                      <ThemedText type="default">
                        Visualization style
                      </ThemedText>
                      <View style={styles.optionRowWrap}>
                        {visualizationModeOptions.map((option) => {
                          const isActive =
                            preferences.visualizationMode === option.value;
                          return (
                            <Pressable
                              key={option.value}
                              onPress={() =>
                                updatePreferences({
                                  visualizationMode: option.value,
                                })
                              }
                              style={({ pressed }) => [
                                styles.intervalChip,
                                {
                                  borderColor: colors.border,
                                  backgroundColor: isActive
                                    ? colors.tint
                                    : colors.surfaceAlt,
                                },
                                pressed && styles.pressFeedback,
                              ]}
                            >
                              <ThemedText
                                type="caption"
                                style={{
                                  color: isActive
                                    ? colors.onTint
                                    : colors.muted,
                                }}
                              >
                                {option.label}
                              </ThemedText>
                            </Pressable>
                          );
                        })}
                      </View>
                      <View style={styles.sliderGroup}>
                        <ThemedText
                          type="caption"
                          style={{ color: colors.muted }}
                        >
                          Visualization intensity (
                          {Math.round(
                            (preferences.visualizationIntensity ?? 0.55) * 100,
                          )}
                          %)
                        </ThemedText>
                        <Slider
                          value={preferences.visualizationIntensity ?? 0.55}
                          minimumValue={0}
                          maximumValue={1}
                          step={0.01}
                          onValueChange={(value) =>
                            updatePreferences({
                              visualizationIntensity: value,
                            })
                          }
                          minimumTrackTintColor={colors.tint}
                          maximumTrackTintColor={colors.surfaceAlt}
                          thumbTintColor={colors.tint}
                          style={styles.slider}
                        />
                      </View>
                    </View>
                  </View>

                  <View style={styles.section}>
                    <ThemedText type="subtitle">Profile</ThemedText>
                    <ThemedText type="caption" style={{ color: colors.muted }}>
                      View your public profile.
                    </ThemedText>
                    <Pressable
                      onPress={() => {
                        if (!user?.username) {
                          return;
                        }
                        router.push({
                          pathname: "/user/[username]",
                          params: { username: user.username },
                        });
                      }}
                      style={({ pressed }) => [
                        styles.secondaryButton,
                        { borderColor: colors.border },
                        pressed && styles.pressFeedback,
                      ]}
                      disabled={!user?.username}
                    >
                      <ThemedText
                        type="defaultSemiBold"
                        style={{ color: colors.muted }}
                      >
                        View public profile
                      </ThemedText>
                    </Pressable>
                  </View>

                  <View style={styles.section}>
                    <ThemedText type="subtitle">Help & navigation</ThemedText>
                    <ThemedText type="caption" style={{ color: colors.muted }}>
                      Reopen the welcome tour anytime.
                    </ThemedText>
                    <Pressable
                      onPress={() =>
                        router.push({
                          pathname: "/welcome",
                          params: { mode: "help" },
                        })
                      }
                      style={({ pressed }) => [
                        styles.secondaryButton,
                        { borderColor: colors.border },
                        pressed && styles.pressFeedback,
                      ]}
                    >
                      <ThemedText
                        type="defaultSemiBold"
                        style={{ color: colors.muted }}
                      >
                        Open welcome tour
                      </ThemedText>
                    </Pressable>
                    <Pressable
                      onPress={() => router.push("/markdown-help")}
                      style={({ pressed }) => [
                        styles.secondaryButton,
                        { borderColor: colors.border },
                        pressed && styles.pressFeedback,
                      ]}
                    >
                      <ThemedText
                        type="defaultSemiBold"
                        style={{ color: colors.muted }}
                      >
                        Markdown syntax help
                      </ThemedText>
                    </Pressable>
                  </View>

                  <View style={styles.section}>
                    <ThemedText type="subtitle">Account</ThemedText>
                    <Pressable
                      onPress={signOut}
                      style={({ pressed }) => [
                        styles.secondaryButton,
                        { borderColor: colors.border },
                        pressed && styles.pressFeedback,
                      ]}
                    >
                      <ThemedText
                        type="defaultSemiBold"
                        style={{ color: colors.muted }}
                      >
                        Sign out
                      </ThemedText>
                    </Pressable>
                  </View>

                  <View style={styles.section}>
                    <ThemedText type="subtitle">Danger zone</ThemedText>
                    <ThemedText type="caption" style={{ color: colors.muted }}>
                      Deleting your account removes your streams, bytes, and
                      history.
                    </ThemedText>
                    <Pressable
                      onPress={handleDeleteAccount}
                      style={({ pressed }) => [
                        styles.dangerButton,
                        {
                          borderColor: colors.border,
                          backgroundColor: colors.surfaceAlt,
                        },
                        pressed && styles.pressFeedbackStrong,
                      ]}
                      disabled={isDeletingAccount}
                    >
                      {isDeletingAccount ? (
                        <ActivityIndicator size="small" color={colors.muted} />
                      ) : (
                        <ThemedText
                          type="defaultSemiBold"
                          style={{ color: colors.muted }}
                        >
                          Delete account
                        </ThemedText>
                      )}
                    </Pressable>
                  </View>
                </View>
              </Animated.View>
            </Animated.ScrollView>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
      <TopBlur scrollY={scrollY} />
      <FloatingScrollTopButton
        scrollY={scrollY}
        onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
        bottomOffset={insets.bottom + 20}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingBottom: 24,
    gap: 20,
  },
  header: {
    marginTop: 20,
    gap: 6,
  },
  form: {
    gap: 12,
  },
  formLoading: {
    opacity: 0.7,
  },
  section: {
    marginTop: 16,
    gap: 10,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  intervalRow: {
    flexDirection: "row",
    gap: 6,
  },
  optionRowWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  intervalChip: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  accentRow: {
    gap: 8,
  },
  accentPicker: {
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
  sliderGroup: {
    gap: 6,
  },
  slider: {
    width: "100%",
    height: 36,
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  pickButton: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  syncIndicator: {
    marginTop: 8,
  },
  inputRow: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  input: {
    fontFamily: "SpaceMono",
    fontSize: 15,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
  },
  dangerButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
  },
  pressFeedback: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
  pressFeedbackStrong: {
    opacity: 0.78,
    transform: [{ scale: 0.98 }],
  },
});

const intervalOptions = [
  { label: "1m", value: 60000 },
  { label: "2m", value: 120000 },
  { label: "5m", value: 300000 },
];

const textRenderOptions: Array<{
  label: string;
  value: "smooth" | "typewriter" | "wave" | "random" | "off";
}> = [
  { label: "Smooth", value: "smooth" },
  { label: "Typewriter", value: "typewriter" },
  { label: "Wave", value: "wave" },
  { label: "Random", value: "random" },
  { label: "Off", value: "off" },
];

const imageRevealOptions: Array<{
  label: string;
  value: "smooth" | "off";
}> = [
  { label: "Smooth", value: "smooth" },
  { label: "Off", value: "off" },
];

const accentPresetOptions = [
  { label: "Default", color: "#00F329" },
  { label: "Aurora", color: "#4A8DFF" },
  { label: "Sunset", color: "#FF6B6B" },
  { label: "Violet", color: "#A855F7" },
  { label: "Amber", color: "#F59E0B" },
  { label: "Aqua", color: "#06B6D4" },
];

const visualizationModeOptions: Array<{
  label: string;
  value:
    | "monoAccent"
    | "retro"
    | "classic"
    | "vivid"
    | "neon"
    | "cinematic"
    | "frost";
}> = [
  { label: "Monochrome + Accent", value: "monoAccent" },
  { label: "Retro", value: "retro" },
  { label: "Classic", value: "classic" },
  { label: "Vivid", value: "vivid" },
  { label: "Neon", value: "neon" },
  { label: "Cinematic", value: "cinematic" },
  { label: "Frost", value: "frost" },
];

const parseLinks = (links: string[]) => {
  let website = "";
  let github = "";
  let twitter = "";
  let linkedin = "";
  const extraLinks: string[] = [];

  links.forEach((link) => {
    const value = link.trim();
    if (!value) {
      return;
    }
    const lower = value.toLowerCase();
    if (!github && lower.includes("github.com")) {
      github = value;
    } else if (
      !twitter &&
      (lower.includes("twitter.com") || lower.includes("x.com"))
    ) {
      twitter = value;
    } else if (!linkedin && lower.includes("linkedin.com")) {
      linkedin = value;
    } else if (
      !website &&
      (lower.startsWith("http") || lower.startsWith("www."))
    ) {
      website = value;
    } else {
      extraLinks.push(value);
    }
  });

  return { website, github, twitter, linkedin, extraLinks };
};

const buildLinks = (fields: {
  website: string;
  github: string;
  twitter: string;
  linkedin: string;
  extraLinks: string;
}) => {
  const base = [fields.website, fields.github, fields.twitter, fields.linkedin]
    .map((item) => item.trim())
    .filter(Boolean);

  const extras = fields.extraLinks
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return [...base, ...extras];
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const hsvToHex = (hue: number, saturation: number, value: number) => {
  const h = ((hue % 360) + 360) % 360;
  const s = clamp(saturation, 0, 1);
  const v = clamp(value, 0, 1);
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;

  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  const toHex = (channel: number) =>
    Math.round((channel + m) * 255)
      .toString(16)
      .padStart(2, "0");

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
};

const hexToHsv = (hex: string) => {
  const normalized = hex.replace("#", "").trim();
  const value =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized.padEnd(6, "0");
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;

  if (delta !== 0) {
    if (max === r) {
      h = ((g - b) / delta) % 6;
    } else if (max === g) {
      h = (b - r) / delta + 2;
    } else {
      h = (r - g) / delta + 4;
    }
    h *= 60;
  }

  if (h < 0) {
    h += 360;
  }

  const s = max === 0 ? 0 : delta / max;
  const v = max;

  return { h, s, v };
};

const hexToRgb = (hex: string) => {
  const normalized = hex.replace("#", "").trim();
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized.padEnd(6, "0").slice(0, 6);
  return {
    r: parseInt(expanded.slice(0, 2), 16),
    g: parseInt(expanded.slice(2, 4), 16),
    b: parseInt(expanded.slice(4, 6), 16),
  };
};

const rgbToHex = (red: number, green: number, blue: number) => {
  const toHex = (channel: number) =>
    clamp(channel, 0, 255).toString(16).padStart(2, "0");
  return `#${toHex(Math.round(red))}${toHex(Math.round(green))}${toHex(Math.round(blue))}`.toUpperCase();
};
