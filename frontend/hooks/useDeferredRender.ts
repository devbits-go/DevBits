import { InteractionManager } from "react-native";
import { useEffect, useState } from "react";

type DeferredOptions = {
  enabled?: boolean;
  delayMs?: number;
  deferUntilInteractions?: boolean;
  runOnce?: boolean;
};

export function useDeferredRender({
  enabled = true,
  delayMs = 0,
  deferUntilInteractions = false,
  runOnce = false,
}: DeferredOptions = {}) {
  const [ready, setReady] = useState(!enabled);

  useEffect(() => {
    if (!enabled) {
      setReady(true);
      return;
    }

    if (runOnce && ready) {
      return;
    }

    setReady(false);
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const runReady = () => {
      if (cancelled) {
        return;
      }
      if (delayMs > 0) {
        timeout = setTimeout(() => {
          if (!cancelled) {
            setReady(true);
          }
        }, delayMs);
        return;
      }
      setReady(true);
    };

    let rafId: number | null = null;
    const task = deferUntilInteractions
      ? InteractionManager.runAfterInteractions(runReady)
      : null;

    if (!deferUntilInteractions) {
      rafId = requestAnimationFrame(runReady);
    }

    return () => {
      cancelled = true;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      if (timeout) {
        clearTimeout(timeout);
      }
      task?.cancel?.();
    };
  }, [deferUntilInteractions, delayMs, enabled, ready, runOnce]);

  return ready;
}
