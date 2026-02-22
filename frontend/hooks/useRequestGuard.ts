import { useCallback, useEffect, useMemo, useRef } from "react";

export function useRequestGuard() {
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const beginRequest = useCallback(() => {
    requestIdRef.current += 1;
    return requestIdRef.current;
  }, []);

  const isActive = useCallback((requestId: number) => {
    return mountedRef.current && requestIdRef.current === requestId;
  }, []);

  const isMounted = useCallback(() => mountedRef.current, []);

  return useMemo(
    () => ({ beginRequest, isActive, isMounted }),
    [beginRequest, isActive, isMounted],
  );
}
