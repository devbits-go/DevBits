import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as SecureStore from "expo-secure-store";
import { useAuth } from "@/contexts/AuthContext";
import { updateUser } from "@/services/api";

const PREFS_KEY = "devbits.preferences";
const prefsKeyForUser = (username?: string | null) =>
  username ? `${PREFS_KEY}.${username}` : PREFS_KEY;

export type Preferences = {
  backgroundRefreshEnabled: boolean;
  refreshIntervalMs: number;
  zenMode: boolean;
  compactMode: boolean;
  textRenderEffect: "smooth" | "typewriter" | "wave" | "random" | "off";
  imageRevealEffect: "smooth" | "off";
  accentColor: string;
  rgbShiftEnabled: boolean;
  rgbShiftSpeedMs: number;
  rgbShiftTickMs: number;
  rgbShiftStep: number;
  rgbShiftTheme: "rainbow" | "ocean" | "sunset" | "neon" | "user1" | "user2";
  rgbUserTheme1: string[];
  rgbUserTheme2: string[];
  visualizationMode:
    | "monoAccent"
    | "retro"
    | "classic"
    | "vivid"
    | "neon"
    | "cinematic"
    | "frost";
  visualizationIntensity: number;
  linkOpenMode: "asTyped" | "promptScheme";
  hasSeenWelcomeTour: boolean;
};

const defaultPreferences: Preferences = {
  backgroundRefreshEnabled: false,
  refreshIntervalMs: 120000,
  zenMode: false,
  compactMode: false,
  textRenderEffect: "smooth",
  imageRevealEffect: "smooth",
  accentColor: "",
  rgbShiftEnabled: false,
  rgbShiftSpeedMs: 3200,
  rgbShiftTickMs: 44,
  rgbShiftStep: 0.85,
  rgbShiftTheme: "rainbow",
  rgbUserTheme1: ["#00F329", "#06B6D4", "#A855F7"],
  rgbUserTheme2: ["#FF6B6B", "#F59E0B", "#FDE047"],
  visualizationMode: "monoAccent",
  visualizationIntensity: 0.55,
  linkOpenMode: "asTyped",
  hasSeenWelcomeTour: false,
};

const normalizeAccentColor = (value: unknown) => {
  if (typeof value !== "string") {
    return "";
  }
  const raw = value.trim();
  if (!raw) {
    return "";
  }
  const withHash = raw.startsWith("#") ? raw : `#${raw}`;
  const isValid = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(withHash);
  return isValid ? withHash.toUpperCase() : "";
};

const sanitizePreferences = (candidate: Partial<Preferences>): Preferences => {
  const merged = {
    ...defaultPreferences,
    ...candidate,
  };

  return {
    ...merged,
    accentColor: normalizeAccentColor(merged.accentColor),
    rgbShiftEnabled: false,
    rgbShiftSpeedMs: defaultPreferences.rgbShiftSpeedMs,
    rgbShiftTickMs: defaultPreferences.rgbShiftTickMs,
    rgbShiftStep: defaultPreferences.rgbShiftStep,
    rgbShiftTheme: defaultPreferences.rgbShiftTheme,
    rgbUserTheme1: [...defaultPreferences.rgbUserTheme1],
    rgbUserTheme2: [...defaultPreferences.rgbUserTheme2],
  };
};

type PreferencesContextValue = {
  preferences: Preferences;
  isLoading: boolean;
  updatePreferences: (updates: Partial<Preferences>) => Promise<void>;
};

const PreferencesContext = createContext<PreferencesContextValue | undefined>(
  undefined,
);

export function PreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const [preferences, setPreferences] =
    useState<Preferences>(defaultPreferences);
  const [isLoading, setIsLoading] = useState(true);
  const isHydratingRef = useRef(false);

  useEffect(() => {
    let isActive = true;
    const loadPreferences = async () => {
      isHydratingRef.current = true;
      setIsLoading(true);

      if (!user?.username) {
        setPreferences(defaultPreferences);
        setIsLoading(false);
        isHydratingRef.current = false;
        return;
      }

      const stored = await SecureStore.getItemAsync(
        prefsKeyForUser(user.username),
      );
      if (!isActive) {
        return;
      }
      let parsed: Partial<Preferences> = {};
      if (stored) {
        try {
          parsed = JSON.parse(stored) as Partial<Preferences>;
        } catch {
          parsed = {};
        }
      }

      setPreferences(
        sanitizePreferences({
          ...parsed,
          ...(user.settings ?? {}),
        }),
      );
      setIsLoading(false);
      isHydratingRef.current = false;
    };

    loadPreferences();
    return () => {
      isActive = false;
    };
  }, [user?.settings, user?.username]);

  const updatePreferences = async (updates: Partial<Preferences>) => {
    const next = sanitizePreferences({ ...preferences, ...updates });
    setPreferences(next);

    if (isHydratingRef.current) {
      return;
    }

    if (user?.username) {
      await SecureStore.setItemAsync(
        prefsKeyForUser(user.username),
        JSON.stringify(next),
      );
      try {
        const response = await updateUser(user.username, { settings: next });
        const serverSettings = response?.user?.settings as
          | Partial<Preferences>
          | undefined;
        if (serverSettings) {
          const merged = sanitizePreferences({ ...next, ...serverSettings });
          setPreferences(merged);
          await SecureStore.setItemAsync(
            prefsKeyForUser(user.username),
            JSON.stringify(merged),
          );
        }
      } catch {
        // keep local preferences if backend fails
      }
    } else {
      await SecureStore.setItemAsync(PREFS_KEY, JSON.stringify(next));
    }
  };

  const value = useMemo(
    () => ({ preferences, isLoading, updatePreferences }),
    [preferences, isLoading],
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error("usePreferences must be used within PreferencesProvider");
  }
  return context;
}
