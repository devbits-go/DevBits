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

  useEffect(() => {
    const loadSession = async () => {
      const storedToken = await SecureStore.getItemAsync(TOKEN_KEY);
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      setAuthToken(storedToken);
      try {
        const me = await getMe();
        setUser(me);
        setToken(storedToken);
      } catch (error) {
        setAuthToken(null);
        setUser(null);
        setToken(null);
        await SecureStore.deleteItemAsync(TOKEN_KEY);
      } finally {
        setIsLoading(false);
      }
    };

    loadSession();
  }, []);

  const signIn = useCallback(async (payload: AuthLoginRequest) => {
    const response = await loginUser(payload);
    setAuthToken(response.token);
    setUser(response.user);
    setToken(response.token);
    setJustSignedUp(false);
    await SecureStore.setItemAsync(TOKEN_KEY, response.token);
  }, []);

  const signUp = useCallback(async (payload: AuthRegisterRequest) => {
    const response = await registerUser(payload);
    setAuthToken(response.token);
    setUser(response.user);
    setToken(response.token);
    setJustSignedUp(true);
    await SecureStore.setItemAsync(TOKEN_KEY, response.token);
  }, []);

  const signOut = useCallback(async () => {
    setAuthToken(null);
    setUser(null);
    setToken(null);
    setJustSignedUp(false);
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }, []);

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
        message.includes("request failed (401)");

      if (isAuthFailure) {
        setAuthToken(null);
        setUser(null);
        setToken(null);
        setJustSignedUp(false);
        await SecureStore.deleteItemAsync(TOKEN_KEY);
      }
    }
  }, [token]);

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
