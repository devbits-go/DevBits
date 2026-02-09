import { useCallback } from "react";
import { usePreferences } from "@/contexts/PreferencesContext";

export const useMotionConfig = () => {
  const { preferences } = usePreferences();
  const prefersReducedMotion = preferences.zenMode;

  const duration = useCallback(
    (valueMs: number) => (prefersReducedMotion ? 0 : valueMs),
    [prefersReducedMotion],
  );

  const delay = useCallback(
    (valueMs: number) => (prefersReducedMotion ? 0 : valueMs),
    [prefersReducedMotion],
  );

  return { prefersReducedMotion, duration, delay };
};
