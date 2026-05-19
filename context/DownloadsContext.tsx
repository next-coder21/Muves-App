import React, {
  createContext, useCallback, useContext,
  useEffect, useRef, useState,
} from "react";
import * as FileSystem from "expo-file-system/legacy";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API } from "@/constants/api";
import { useAuth } from "@/context/AuthContext";
import { Song } from "@/context/PlayerContext";

export type DownloadStatus = "idle" | "downloading" | "done" | "error";

export type DownloadProgress = {
  status: DownloadStatus;
  ratio: number;   // 0–1
  error?: string;
};

type DownloadEntry = {
  song: Song;
  localPath: string;
  downloadedAt: number;
};

type DownloadsContextType = {
  downloadedSongs: Song[];
  totalDownloads: number;
  isDownloaded: (id: string) => boolean;
  getLocalPath: (id: string) => string | undefined;
  getProgress: (id: string) => DownloadProgress | undefined;
  downloadSong: (song: Song) => Promise<void>;
  deleteDownload: (id: string) => Promise<void>;
};

const DownloadsContext = createContext<DownloadsContextType | null>(null);

const DOWNLOADS_DIR = (FileSystem.documentDirectory ?? "") + "muves_downloads/";

const cacheKey = (email: string) => `muves_dl_meta:${email.toLowerCase()}`;

// Module-level resolver so PlayerContext can look up local paths without
// directly depending on DownloadsContext (avoids circular imports).
let _localPathResolver: ((id: string) => string | undefined) | null = null;
export function setLocalPathResolver(fn: typeof _localPathResolver) {
  _localPathResolver = fn;
}
export function resolveLocalPath(id: string): string | undefined {
  return _localPathResolver?.(id);
}

export function DownloadsProvider({ children }: { children: React.ReactNode }) {
  const { token, user, registerLogoutHandler } = useAuth();
  const [entries, setEntries] = useState<Map<string, DownloadEntry>>(new Map());
  const [progress, setProgress] = useState<Map<string, DownloadProgress>>(new Map());
  const tokenRef = useRef(token);
  useEffect(() => { tokenRef.current = token; }, [token]);

  // Ensure download directory exists
  useEffect(() => {
    FileSystem.makeDirectoryAsync(DOWNLOADS_DIR, { intermediates: true }).catch(() => {});
  }, []);

  // Load persisted metadata per user
  useEffect(() => {
    if (!user?.email) { setEntries(new Map()); return; }
    AsyncStorage.getItem(cacheKey(user.email)).then((raw) => {
      if (!raw) return;
      try {
        const list: DownloadEntry[] = JSON.parse(raw);
        setEntries(new Map(list.map((e) => [e.song._id, e])));
      } catch {}
    });
  }, [user?.email]);

  // Wire up the module-level resolver so PlayerContext can find local files
  useEffect(() => {
    setLocalPathResolver((id) => entries.get(id)?.localPath);
    return () => setLocalPathResolver(null);
  }, [entries]);

  const persist = useCallback(
    async (map: Map<string, DownloadEntry>, email?: string | null) => {
      if (!email) return;
      try {
        await AsyncStorage.setItem(cacheKey(email), JSON.stringify([...map.values()]));
      } catch {}
    },
    [],
  );

  useEffect(() => {
    return registerLogoutHandler(() => {
      setEntries(new Map());
      setProgress(new Map());
    });
  }, [registerLogoutHandler]);

  const isDownloaded = useCallback((id: string) => entries.has(id), [entries]);
  const getLocalPath = useCallback((id: string) => entries.get(id)?.localPath, [entries]);
  const getProgress = useCallback((id: string) => progress.get(id), [progress]);

  const downloadSong = useCallback(
    async (song: Song) => {
      if (!song._id || entries.has(song._id)) return;
      const localPath = DOWNLOADS_DIR + song._id + ".mp3";
      const url = `${API.STREAM_URL}/${encodeURIComponent(song._id)}`;

      setProgress((prev) => new Map(prev).set(song._id, { status: "downloading", ratio: 0 }));

      try {
        const task = FileSystem.createDownloadResumable(
          url,
          localPath,
          { headers: tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : {} },
          ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
            const ratio = totalBytesExpectedToWrite > 0
              ? Math.min(1, totalBytesWritten / totalBytesExpectedToWrite)
              : 0;
            setProgress((prev) => new Map(prev).set(song._id, { status: "downloading", ratio }));
          },
        );

        const result = await task.downloadAsync();
        if (!result?.uri) throw new Error("Download returned no URI");

        const entry: DownloadEntry = {
          song: { ...song, localPath: result.uri },
          localPath: result.uri,
          downloadedAt: Date.now(),
        };

        setEntries((prev) => {
          const next = new Map(prev).set(song._id, entry);
          persist(next, user?.email);
          return next;
        });
        setProgress((prev) => new Map(prev).set(song._id, { status: "done", ratio: 1 }));
      } catch (e) {
        FileSystem.deleteAsync(localPath, { idempotent: true }).catch(() => {});
        const msg = e instanceof Error ? e.message : "Download failed";
        setProgress((prev) =>
          new Map(prev).set(song._id, { status: "error", ratio: 0, error: msg }),
        );
        throw e;
      }
    },
    [entries, user?.email, persist],
  );

  const deleteDownload = useCallback(
    async (id: string) => {
      const entry = entries.get(id);
      if (!entry) return;
      await FileSystem.deleteAsync(entry.localPath, { idempotent: true }).catch(() => {});
      setEntries((prev) => {
        const next = new Map(prev);
        next.delete(id);
        persist(next, user?.email);
        return next;
      });
      setProgress((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
    },
    [entries, user?.email, persist],
  );

  const downloadedSongs: Song[] = [...entries.values()].map((e) => ({
    ...e.song,
    localPath: e.localPath,
  }));

  return (
    <DownloadsContext.Provider
      value={{
        downloadedSongs,
        totalDownloads: entries.size,
        isDownloaded,
        getLocalPath,
        getProgress,
        downloadSong,
        deleteDownload,
      }}
    >
      {children}
    </DownloadsContext.Provider>
  );
}

export function useDownloads() {
  const ctx = useContext(DownloadsContext);
  if (!ctx) throw new Error("useDownloads must be inside DownloadsProvider");
  return ctx;
}
