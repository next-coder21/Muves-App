import React, {
  createContext, useCallback, useContext,
  useEffect, useRef, useState,
} from "react";
import * as MediaLibrary from "expo-media-library";
import { Song } from "@/context/PlayerContext";

type LocalSongsContextType = {
  localSongs: Song[];
  totalLocal: number;
  permissionStatus: MediaLibrary.PermissionStatus | "unknown";
  requestPermission: () => Promise<boolean>;
  refresh: () => Promise<void>;
  getLocalPath: (id: string) => string | undefined;
};

const LocalSongsContext = createContext<LocalSongsContextType | null>(null);

// Module-level resolver so PlayerContext can look up local paths without
// directly depending on LocalSongsContext (avoids circular imports).
let _localPathResolver: ((id: string) => string | undefined) | null = null;
export function setLocalPathResolver(fn: typeof _localPathResolver) {
  _localPathResolver = fn;
}
export function resolveLocalPath(id: string): string | undefined {
  return _localPathResolver?.(id);
}

function assetToSong(asset: MediaLibrary.Asset): Song {
  // Try to parse "Artist - Title" from filename
  const nameNoExt = asset.filename.replace(/\.[^.]+$/, "");
  const dashIdx = nameNoExt.indexOf(" - ");
  const artist = dashIdx > -1 ? nameNoExt.slice(0, dashIdx).trim() : "Unknown Artist";
  const title  = dashIdx > -1 ? nameNoExt.slice(dashIdx + 3).trim() : nameNoExt;

  return {
    _id: asset.id,
    title,
    artist,
    localPath: asset.uri,
    duration: asset.duration,
  };
}

async function fetchAllAudio(): Promise<Song[]> {
  const all: MediaLibrary.Asset[] = [];
  let after: string | undefined;
  while (true) {
    const page = await MediaLibrary.getAssetsAsync({
      mediaType: MediaLibrary.MediaType.audio,
      first: 200,
      after,
      sortBy: MediaLibrary.SortBy.default,
    });
    all.push(...page.assets);
    if (!page.hasNextPage) break;
    after = page.endCursor;
  }
  return all.map(assetToSong);
}

export function LocalSongsProvider({ children }: { children: React.ReactNode }) {
  const [songs, setSongs] = useState<Song[]>([]);
  const [permissionStatus, setPermissionStatus] = useState<
    MediaLibrary.PermissionStatus | "unknown"
  >("unknown");
  const pathMapRef = useRef<Map<string, string>>(new Map());

  const loadSongs = useCallback(async () => {
    try {
      const fetched = await fetchAllAudio();
      const pm = new Map<string, string>();
      for (const s of fetched) {
        if (s.localPath) pm.set(s._id, s.localPath);
      }
      pathMapRef.current = pm;
      setSongs(fetched);
    } catch { /* permission denied or unsupported */ }
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    setPermissionStatus(status);
    if (status === MediaLibrary.PermissionStatus.GRANTED) {
      await loadSongs();
      return true;
    }
    return false;
  }, [loadSongs]);

  const refresh = useCallback(async () => {
    const { status } = await MediaLibrary.getPermissionsAsync();
    setPermissionStatus(status);
    if (status === MediaLibrary.PermissionStatus.GRANTED) {
      await loadSongs();
    }
  }, [loadSongs]);

  // On mount: check existing permission
  useEffect(() => {
    (async () => {
      const { status } = await MediaLibrary.getPermissionsAsync();
      setPermissionStatus(status);
      if (status === MediaLibrary.PermissionStatus.GRANTED) {
        await loadSongs();
      }
    })();
  }, [loadSongs]);

  // Wire resolver so PlayerContext can find local URIs.
  // The closure reads pathMapRef (a ref) not songs (state), so this only needs
  // to run once on mount — re-registering on every songs update would briefly
  // expose a null resolver between teardown and re-registration.
  useEffect(() => {
    setLocalPathResolver((id) => pathMapRef.current.get(id));
    return () => setLocalPathResolver(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getLocalPath = useCallback((id: string) => pathMapRef.current.get(id), []);

  return (
    <LocalSongsContext.Provider value={{
      localSongs: songs,
      totalLocal: songs.length,
      permissionStatus,
      requestPermission,
      refresh,
      getLocalPath,
    }}>
      {children}
    </LocalSongsContext.Provider>
  );
}

export function useLocalSongs() {
  const ctx = useContext(LocalSongsContext);
  if (!ctx) throw new Error("useLocalSongs must be inside LocalSongsProvider");
  return ctx;
}
