import { useEffect, useRef, useState } from "react";
import { Alert, Platform } from "react-native";
import Constants from "expo-constants";
import * as FileSystem from "expo-file-system";
import * as IntentLauncher from "expo-intent-launcher";

const VERSION_URL = "https://api.lijishwilson.in/muves/version";
const APK_CACHE   = FileSystem.cacheDirectory + "muves-update.apk";

export type UpdateInfo = {
  version: string;
  versionCode: number;
  apkUrl: string | null;
  message: string;
  forceUpdate: boolean;
};

export type DownloadStatus =
  | { phase: "idle" }
  | { phase: "downloading"; progress: number }   // 0–1
  | { phase: "installing" }
  | { phase: "error"; message: string };

export type AppUpdateState =
  | { status: "idle" }
  | { status: "available"; info: UpdateInfo }
  | { status: "none" };

export function useAppUpdate() {
  const [state,    setState]    = useState<AppUpdateState>({ status: "idle" });
  const [dlStatus, setDlStatus] = useState<DownloadStatus>({ phase: "idle" });
  const downloadRef = useRef<FileSystem.DownloadResumable | null>(null);

  useEffect(() => {
    if (Platform.OS !== "android") { setState({ status: "none" }); return; }
    const ctrl = new AbortController();
    fetch(VERSION_URL, { signal: ctrl.signal })
      .then(r => r.json())
      .then((data: UpdateInfo) => {
        const current = Constants.expoConfig?.version ?? "0.1.0";
        const currentCode = data.versionCode
          ? parseInt(String(data.versionCode), 10)
          : parseVersion(current);
        const remoteCode = data.versionCode ?? parseVersion(data.version);
        if (remoteCode > currentCode && data.apkUrl) {
          setState({ status: "available", info: data });
        } else {
          setState({ status: "none" });
        }
      })
      .catch(() => setState({ status: "none" }));
    return () => ctrl.abort();
  }, []);

  async function startUpdate(apkUrl: string) {
    try {
      // Delete any previous partial download
      const existing = await FileSystem.getInfoAsync(APK_CACHE);
      if (existing.exists) await FileSystem.deleteAsync(APK_CACHE, { idempotent: true });

      setDlStatus({ phase: "downloading", progress: 0 });

      const dl = FileSystem.createDownloadResumable(
        apkUrl,
        APK_CACHE,
        {},
        ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
          if (totalBytesExpectedToWrite > 0) {
            setDlStatus({
              phase: "downloading",
              progress: totalBytesWritten / totalBytesExpectedToWrite,
            });
          }
        }
      );
      downloadRef.current = dl;

      const result = await dl.downloadAsync();
      if (!result?.uri) throw new Error("Download failed — no file returned");

      setDlStatus({ phase: "installing" });

      // Get content URI (required for Android 7+ file access)
      const contentUri = await FileSystem.getContentUriAsync(result.uri);
      await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
        data: contentUri,
        flags: 1,   // FLAG_GRANT_READ_URI_PERMISSION
        type: "application/vnd.android.package-archive",
      });

      setDlStatus({ phase: "idle" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Update failed";
      setDlStatus({ phase: "error", message: msg });
      Alert.alert("Update failed", msg);
    }
  }

  return { state, dlStatus, startUpdate };
}

function parseVersion(v: string): number {
  const parts = v.split(".").map(p => parseInt(p || "0", 10));
  return (parts[0] ?? 0) * 10000 + (parts[1] ?? 0) * 100 + (parts[2] ?? 0);
}
