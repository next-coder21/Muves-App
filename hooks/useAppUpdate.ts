import { useEffect, useState } from "react";
import { Linking, Platform } from "react-native";
import Constants from "expo-constants";

const VERSION_URL = "https://kkmusicserver.onrender.com/version";

export type UpdateInfo = {
  version: string;
  versionCode: number;
  apkUrl: string | null;
  message: string;
  forceUpdate: boolean;
};

export type AppUpdateState =
  | { status: "idle" }
  | { status: "available"; info: UpdateInfo }
  | { status: "none" };

function parseVersionCode(v: string): number {
  // "1.2.3" → 10203
  return v.split(".").reduce((acc, part, i) => acc + parseInt(part || "0", 10) * Math.pow(100, 2 - i), 0);
}

export function useAppUpdate() {
  const [state, setState] = useState<AppUpdateState>({ status: "idle" });

  useEffect(() => {
    // Only relevant on Android APK builds — skip web/iOS
    if (Platform.OS !== "android") { setState({ status: "none" }); return; }

    const ctrl = new AbortController();
    fetch(VERSION_URL, { signal: ctrl.signal })
      .then(r => r.json())
      .then((data: UpdateInfo) => {
        const currentVersion = Constants.expoConfig?.version ?? "1.0.0";
        const currentCode = parseVersionCode(currentVersion);
        const remoteCode = data.versionCode ?? parseVersionCode(data.version);
        if (remoteCode > currentCode && data.apkUrl) {
          setState({ status: "available", info: data });
        } else {
          setState({ status: "none" });
        }
      })
      .catch(() => setState({ status: "none" }));

    return () => ctrl.abort();
  }, []);

  function downloadUpdate(apkUrl: string) {
    Linking.openURL(apkUrl);
  }

  return { state, downloadUpdate };
}
