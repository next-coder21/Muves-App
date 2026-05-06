import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API } from "@/constants/api";
import { useAuth } from "@/context/AuthContext";
import { ApiError, apiRequest } from "@/utils/apiClient";

type FavouritesContextType = {
  favouriteIds: Set<string>;
  count: number;
  isFavourite: (id: string) => boolean;
  toggleFavourite: (songId: string) => Promise<void>;
  loadFavourites: () => Promise<void>;
};

const FavouritesContext = createContext<FavouritesContextType | null>(null);

// Per-user cache key — keeps user A's likes from leaking into user B's
// session if both accounts are used on the same device.
const cacheKey = (email?: string | null) =>
  email ? `muves_fav_ids:${email.toLowerCase()}` : "muves_fav_ids:_anon";

export function FavouritesProvider({ children }: { children: React.ReactNode }) {
  const { token, user, registerLogoutHandler } = useAuth();
  const [favouriteIds, setFavouriteIds] = useState<Set<string>>(new Set());
  // Tracks the "current" load so a slow response from a previous user can't
  // overwrite freshly-loaded favourites.
  const loadIdRef = useRef(0);

  const persist = useCallback(async (ids: Iterable<string>, email?: string | null) => {
    try {
      await AsyncStorage.setItem(cacheKey(email), JSON.stringify([...ids]));
    } catch { /* cache write failures aren't fatal */ }
  }, []);

  const loadFavourites = useCallback(async () => {
    if (!token) return;
    const myId = ++loadIdRef.current;
    const email = user?.email;
    try {
      const data = await apiRequest<{ favourites?: string[] }>(API.FAVOURITES, { token });
      if (myId !== loadIdRef.current) return;
      const ids: string[] = Array.isArray(data?.favourites) ? data.favourites.filter(Boolean) : [];
      setFavouriteIds(new Set(ids));
      persist(ids, email);
    } catch (err) {
      if (myId !== loadIdRef.current) return;
      // 401/403 already routes through the global auth-error hook → logout.
      // For other failures, fall back to the per-user cache so the UI keeps
      // showing what we last knew.
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) return;
      try {
        const cached = await AsyncStorage.getItem(cacheKey(email));
        if (cached) setFavouriteIds(new Set(JSON.parse(cached)));
      } catch { /* ignore — empty set is a fine default */ }
    }
  }, [token, user?.email, persist]);

  // Restore from per-user cache then refresh from server
  useEffect(() => {
    if (!user) { setFavouriteIds(new Set()); return; }
    const email = user.email;
    AsyncStorage.getItem(cacheKey(email))
      .then(cached => {
        if (!cached) return;
        try { setFavouriteIds(new Set(JSON.parse(cached))); }
        catch { /* corrupt cache; server load will repopulate */ }
      })
      .catch(() => {});
    loadFavourites();
  }, [user?.email, loadFavourites, user]);

  // Clear in-memory state on logout. The cache file remains so the same user
  // signing back in still has a fast first paint.
  useEffect(() => {
    return registerLogoutHandler(() => {
      loadIdRef.current++; // invalidate any in-flight load
      setFavouriteIds(new Set());
    });
  }, [registerLogoutHandler]);

  const toggleFavourite = useCallback(async (songId: string) => {
    if (!songId || !token) return;
    const isLiked = favouriteIds.has(songId);

    // Optimistic update
    setFavouriteIds(prev => {
      const next = new Set(prev);
      if (isLiked) next.delete(songId); else next.add(songId);
      // Cache the optimistic state immediately so a fast refresh shows it
      persist(next, user?.email);
      return next;
    });

    try {
      const url = isLiked ? API.FAV_REMOVE : API.FAV_ADD;
      await apiRequest(url, { method: "POST", body: { songIds: [songId] }, token });
    } catch (err) {
      // Revert on failure (auth errors will sign the user out separately)
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) return;
      setFavouriteIds(prev => {
        const next = new Set(prev);
        if (isLiked) next.add(songId); else next.delete(songId);
        persist(next, user?.email);
        return next;
      });
    }
  }, [favouriteIds, token, user?.email, persist]);

  const isFavourite = useCallback((id: string) => favouriteIds.has(id), [favouriteIds]);

  return (
    <FavouritesContext.Provider
      value={{
        favouriteIds,
        count: favouriteIds.size,
        isFavourite,
        toggleFavourite,
        loadFavourites,
      }}
    >
      {children}
    </FavouritesContext.Provider>
  );
}

export function useFavourites() {
  const ctx = useContext(FavouritesContext);
  if (!ctx) throw new Error("useFavourites must be inside FavouritesProvider");
  return ctx;
}
