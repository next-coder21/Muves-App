import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import NetInfo from "@react-native-community/netinfo";

type NetworkContextType = {
  isOnline: boolean;
  isOfflineMode: boolean;
  setOfflineMode: (v: boolean) => void;
};

const NetworkContext = createContext<NetworkContextType>({
  isOnline: true,
  isOfflineMode: false,
  setOfflineMode: () => {},
});

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // One-shot fetch to set the initial state. Guard against setState after
    // unmount in case the provider is torn down before the promise resolves.
    NetInfo.fetch().then((state) => {
      if (cancelled) return;
      setIsOnline(state.isConnected === true && state.isInternetReachable !== false);
    }).catch(() => {});

    const unsub = NetInfo.addEventListener((state) => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      setIsOnline(online);
      if (online) setIsOfflineMode(false);
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  const setOfflineMode = useCallback((v: boolean) => setIsOfflineMode(v), []);

  return (
    <NetworkContext.Provider value={{ isOnline, isOfflineMode, setOfflineMode }}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  return useContext(NetworkContext);
}
