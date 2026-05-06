import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API } from "@/constants/api";
import { useAuth } from "@/context/AuthContext";
import { ApiError, apiRequest } from "@/utils/apiClient";
import { normalizeSong } from "@/utils/normalize";
import { Song } from "@/context/PlayerContext";

export type Playlist = {
  id: string;
  name: string;
  songCount: number;
  isShared: boolean;
};

type PlaylistContextType = {
  playlists: Playlist[];
  loading: boolean;
  loadPlaylists: () => Promise<void>;
  createPlaylist: (name: string) => Promise<Playlist>;
  deletePlaylist: (id: string) => Promise<void>;
  addSongToPlaylist: (playlistId: string, songId: string) => Promise<void>;
  removeSongFromPlaylist: (playlistId: string, songId: string) => Promise<void>;
  getPlaylistSongs: (playlistId: string) => Promise<Song[]>;
};

const PlaylistContext = createContext<PlaylistContextType | null>(null);

const cacheKey = (email?: string | null) =>
  email ? `muves_playlists:${email.toLowerCase()}` : "muves_playlists:_anon";

function normalizePlaylist(raw: any): Playlist {
  return {
    id:        String(raw?.id ?? raw?._id ?? ""),
    name:      typeof raw?.name === "string" && raw.name ? raw.name : "Untitled",
    songCount: Math.max(0, Number(raw?.songCount ?? raw?.song_count ?? 0) || 0),
    isShared:  Boolean(raw?.isShared ?? raw?.is_public ?? false),
  };
}

export function PlaylistProvider({ children }: { children: React.ReactNode }) {
  const { token, user, registerLogoutHandler } = useAuth();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(false);
  const loadIdRef = useRef(0);

  const persist = useCallback(async (list: Playlist[], email?: string | null) => {
    try {
      await AsyncStorage.setItem(cacheKey(email), JSON.stringify(list));
    } catch { /* cache writes are best-effort */ }
  }, []);

  const loadPlaylists = useCallback(async () => {
    if (!token) return;
    const myId = ++loadIdRef.current;
    const email = user?.email;
    setLoading(true);
    try {
      const data = await apiRequest<any>(API.PLAYLISTS, { token });
      if (myId !== loadIdRef.current) return;
      const arr: Playlist[] = (Array.isArray(data) ? data : [])
        .map(normalizePlaylist)
        .filter(p => p.id);
      setPlaylists(arr);
      persist(arr, email);
    } catch (err) {
      if (myId !== loadIdRef.current) return;
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) return;
      // Network / 5xx — keep whatever we already have rather than wiping the UI
    } finally {
      if (myId === loadIdRef.current) setLoading(false);
    }
  }, [token, user?.email, persist]);

  // Restore from per-user cache, then refresh from the server
  useEffect(() => {
    if (!user) { setPlaylists([]); return; }
    const email = user.email;
    AsyncStorage.getItem(cacheKey(email))
      .then(cached => {
        if (!cached) return;
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) setPlaylists(parsed.map(normalizePlaylist).filter(p => p.id));
        } catch { /* corrupt cache; ignore */ }
      })
      .catch(() => {});
    loadPlaylists();
  }, [user?.email, loadPlaylists, user]);

  useEffect(() => {
    return registerLogoutHandler(() => {
      loadIdRef.current++;
      setPlaylists([]);
    });
  }, [registerLogoutHandler]);

  const createPlaylist = useCallback(async (name: string): Promise<Playlist> => {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Playlist name is required");
    const data = await apiRequest<any>(API.PLAYLISTS, {
      method: "POST",
      body: { name: trimmed },
      token,
    });
    const pl = normalizePlaylist(data);
    if (!pl.id) throw new Error("Server returned malformed playlist");
    setPlaylists(prev => {
      const next = [pl, ...prev.filter(p => p.id !== pl.id)];
      persist(next, user?.email);
      return next;
    });
    return pl;
  }, [token, user?.email, persist]);

  const deletePlaylist = useCallback(async (id: string) => {
    if (!id) return;
    // Optimistic removal — restore on failure
    let snapshot: Playlist[] = [];
    setPlaylists(prev => {
      snapshot = prev;
      const next = prev.filter(p => p.id !== id);
      persist(next, user?.email);
      return next;
    });
    try {
      await apiRequest(API.PLAYLIST(id), { method: "DELETE", token });
    } catch (err) {
      setPlaylists(snapshot);
      persist(snapshot, user?.email);
      throw err;
    }
  }, [token, user?.email, persist]);

  const addSongToPlaylist = useCallback(async (playlistId: string, songId: string) => {
    if (!playlistId || !songId) return;
    await apiRequest(API.PLAYLIST_SONGS(playlistId), {
      method: "POST",
      body: { songId },
      token,
    });
    // The backend dedupes via ON CONFLICT DO NOTHING, but our optimistic
    // count would still drift on repeated taps. Re-fetch the playlist's
    // accurate song count to stay truthful.
    setPlaylists(prev => {
      const next = prev.map(p =>
        p.id === playlistId ? { ...p, songCount: p.songCount + 1 } : p
      );
      persist(next, user?.email);
      return next;
    });
  }, [token, user?.email, persist]);

  const removeSongFromPlaylist = useCallback(async (playlistId: string, songId: string) => {
    if (!playlistId || !songId) return;
    await apiRequest(API.PLAYLIST_SONG(playlistId, songId), { method: "DELETE", token });
    setPlaylists(prev => {
      const next = prev.map(p =>
        p.id === playlistId ? { ...p, songCount: Math.max(0, p.songCount - 1) } : p
      );
      persist(next, user?.email);
      return next;
    });
  }, [token, user?.email, persist]);

  const getPlaylistSongs = useCallback(async (playlistId: string): Promise<Song[]> => {
    if (!playlistId) return [];
    const data = await apiRequest<any>(API.PLAYLIST_SONGS(playlistId), { token });
    return (Array.isArray(data) ? data : []).map(normalizeSong);
  }, [token]);

  return (
    <PlaylistContext.Provider value={{
      playlists, loading,
      loadPlaylists, createPlaylist, deletePlaylist,
      addSongToPlaylist, removeSongFromPlaylist, getPlaylistSongs,
    }}>
      {children}
    </PlaylistContext.Provider>
  );
}

export function usePlaylists() {
  const ctx = useContext(PlaylistContext);
  if (!ctx) throw new Error("usePlaylists must be inside PlaylistProvider");
  return ctx;
}
