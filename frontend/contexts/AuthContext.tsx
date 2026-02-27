import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import * as SecureStore from "expo-secure-store";
import {
  ApiUser,
  AuthLoginRequest,
  AuthRegisterRequest,
} from "@/constants/Types";
import { getMe, loginUser, registerUser, setAuthToken } from "@/services/api";

const TOKEN_KEY = "devbits.auth.token";

type AuthContextValue = {
  user: ApiUser | null;
  token: string | null;
  isLoading: boolean;
  justSignedUp: boolean;
  signIn: (payload: AuthLoginRequest) => Promise<void>;
  signUp: (payload: AuthRegisterRequest) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUserDirect: (user: ApiUser) => void;
  acknowledgeSignUp: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [justSignedUp, setJustSignedUp] = useState(false);

  const clearSession = useCallback(async () => {
    setAuthToken(null);
    setUser(null);
    setToken(null);
    setJustSignedUp(false);
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    } catch {
      // Ignore secure store failures and keep client in signed-out state.
    }
  }, []);

  useEffect(() => {
    const loadSession = async () => {
      try {
        const storedToken = await SecureStore.getItemAsync(TOKEN_KEY);
        try {
          // eslint-disable-next-line no-console
          console.log("AuthProvider: storedToken present=", !!storedToken);
        } catch {}
        if (!storedToken) {
          await clearSession();
          return;
        }

        setAuthToken(storedToken);
        const me = await getMe();
        setUser(me);
        setToken(storedToken);
      } catch (error) {
        await clearSession();
      } finally {
        setIsLoading(false);
      }
    };

    loadSession();
  }, [clearSession]);

  const signIn = useCallback(async (payload: AuthLoginRequest) => {
    const response = await loginUser(payload);
    try {
      // eslint-disable-next-line no-console
      console.log("AuthProvider.signIn: received token=", !!response?.token);
    } catch {}
    setAuthToken(response.token);
    setUser(response.user);
    setToken(response.token);
    setJustSignedUp(false);
    try {
      await SecureStore.setItemAsync(TOKEN_KEY, response.token);
      try {
        // eslint-disable-next-line no-console
        console.log("AuthProvider.signIn: stored token in SecureStore");
      } catch {}
    } catch {
      // Continue with in-memory session even if secure store is unavailable.
    }
  }, []);

  const signUp = useCallback(async (payload: AuthRegisterRequest) => {
    const response = await registerUser(payload);
    setAuthToken(response.token);
    setUser(response.user);
    setToken(response.token);
    setJustSignedUp(true);
    try {
      await SecureStore.setItemAsync(TOKEN_KEY, response.token);
    } catch {
      // Continue with in-memory session even if secure store is unavailable.
    }
  }, []);

  const signOut = useCallback(async () => {
    await clearSession();
  }, [clearSession]);

  const setUserDirect = useCallback((u: ApiUser) => {
    setUser(u);
  }, []);

  const acknowledgeSignUp = useCallback(() => {
    setJustSignedUp(false);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!token) {
      return;
    }
    try {
      const me = await getMe();
      setUser(me);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message.toLowerCase()
          : String(error).toLowerCase();
      const isAuthFailure =
        message.includes("unauthorized") ||
        message.includes("missing auth token") ||
        message.includes("invalid auth token") ||
        message.includes("forbidden") ||
        message.includes("request failed (401)") ||
        message.includes("request failed (403)");

      if (isAuthFailure) {
        await clearSession();
      }
    }
  }, [clearSession, token]);

  const value = useMemo(
    () => ({
      user,
      token,
      isLoading,
      justSignedUp,
      signIn,
      signUp,
      signOut,
      refreshUser,
      setUserDirect,
      acknowledgeSignUp,
    }),
    [
      user,
      token,
      isLoading,
      justSignedUp,
      signIn,
      signUp,
      signOut,
      refreshUser,
      setUserDirect,
      acknowledgeSignUp,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
