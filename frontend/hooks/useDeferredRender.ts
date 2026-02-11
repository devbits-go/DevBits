import { InteractionManager } from "react-native";
import { useEffect, useState } from "react";

type DeferredOptions = {
  enabled?: boolean;
  delayMs?: number;
};

export function useDeferredRender({ enabled = true, delayMs = 0 }: DeferredOptions = {}) {
  const [ready, setReady] = useState(!enabled);

  useEffect(() => {
    if (!enabled) {
      setReady(true);
      return;
    }

    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const task = InteractionManager.runAfterInteractions(() => {
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
    });

    return () => {
      cancelled = true;
      if (timeout) {
        clearTimeout(timeout);
      }
      task?.cancel?.();
    };
  }, [delayMs, enabled]);

  return ready;
}
