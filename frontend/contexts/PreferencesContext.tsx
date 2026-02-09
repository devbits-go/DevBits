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
  accentColor: string;
  linkOpenMode: "asTyped" | "promptScheme";
};

const defaultPreferences: Preferences = {
  backgroundRefreshEnabled: false,
  refreshIntervalMs: 120000,
  zenMode: false,
  compactMode: false,
  accentColor: "",
  linkOpenMode: "asTyped",
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

      if (user.settings) {
        setPreferences({ ...defaultPreferences, ...user.settings });
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
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as Partial<Preferences>;
          setPreferences({ ...defaultPreferences, ...parsed });
        } catch {
          setPreferences(defaultPreferences);
        }
      } else {
        setPreferences(defaultPreferences);
      }
      setIsLoading(false);
      isHydratingRef.current = false;
    };

    loadPreferences();
    return () => {
      isActive = false;
    };
  }, [user?.settings, user?.username]);

  const updatePreferences = async (updates: Partial<Preferences>) => {
    const next = { ...preferences, ...updates };
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
        await updateUser(user.username, { settings: next });
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
