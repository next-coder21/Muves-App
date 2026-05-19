import React, {
  createContext, useContext, useState, useRef,
  useCallback, useEffect,
} from "react";
import {
  createAudioPlayer, setAudioModeAsync,
  AudioPlayer, AudioStatus,
} from "expo-audio";
import { API } from "@/constants/api";
import { useAuth } from "@/context/AuthContext";
import { resolveLocalPath } from "@/context/LocalSongsContext";

export type Song = {
  _id: string;
  title: string;
  artist: string;
  album?: string;
  coverImage?: string;
  audioUrl?: string;
  duration?: number;
  genre?: string;
  playCount?: number;
  lyrics?: string;
  localPath?: string; // file:// URI when downloaded for offline
};

type PlayerContextType = {
  currentSong: Song | null;
  queue: Song[];
  history: Song[];
  isPlaying: boolean;
  progress: number;
  duration: number;
  elapsed: number;
  isShuffle: boolean;
  isRepeat: boolean;
  isLoading: boolean;   // true only during initial song load (disables play btn)
  isBuffering: boolean; // true during mid-playback network stalls (album art only)
  error: string | null;
  playSong: (song: Song, queue?: Song[]) => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  seek: (ratio: number) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  closePlayer: () => void;
};

const PlayerContext = createContext<PlayerContextType | null>(null);

const HISTORY_LIMIT = 50;

// Applies now-playing metadata to the lock screen / notification.
// Uses updateLockScreenMetadata (dedicated override API) after activating
// the session. Called multiple times with increasing delays because Android's
// ExoPlayer reads ID3 tags from the audio stream asynchronously and keeps
// overwriting MediaSession as new chunks arrive.
function buildMeta(song: Song) {
  return {
    title: song.title,
    artist: song.artist,
    albumTitle: song.album ?? "",
    // Local songs use a MediaLibrary asset ID for _id, not a server object ID,
    // so attempting to fetch cover art from the server using that ID would 404.
    // Only build a cover URL when the song has no local file (i.e. it is a
    // server-side song whose _id is a valid MongoDB ObjectId).
    artworkUrl: !song.localPath && song._id
      ? `${API.COVER_URL}/${encodeURIComponent(song._id)}`
      : undefined,
  };
}

function applyLockScreenMeta(player: AudioPlayer, song: Song) {
  try {
    const meta = buildMeta(song);
    player.setActiveForLockScreen(true, meta);
    player.updateLockScreenMetadata(meta);
  } catch { /* best-effort */ }
}

// Pure Fisher-Yates avoids the bias of [..arr].sort(() => Math.random() - 0.5)
function pickRandomIndex(length: number, exclude: number): number {
  if (length <= 1) return 0;
  let idx = Math.floor(Math.random() * length);
  if (idx === exclude) idx = (idx + 1) % length;
  return idx;
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const { token, registerLogoutHandler } = useAuth();

  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [queue, setQueue] = useState<Song[]>([]);
  const [history, setHistory] = useState<Song[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const playerRef = useRef<AudioPlayer | null>(null);
  // Stores all pending lock-screen metadata retry timers so every timer fired
  // for the previous song can be cancelled before the next song starts.
  const metaTimerRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const currentSongRef = useRef<Song | null>(null);
  const queueIndexRef = useRef(0);
  const isRepeatRef = useRef(false);
  const isShuffleRef = useRef(false);
  const queueRef = useRef<Song[]>([]);
  const elapsedRef = useRef(0);
  const loadIdRef = useRef(0);
  const tokenRef = useRef<string | null>(token);
  // True while we are waiting for a manual _loadAndPlay to start playing.
  // Prevents the status listener from clearing isLoading based on the previous
  // song's stale status that arrives before replace() is called.
  const manualLoadingRef = useRef(false);
  // Set to true the moment player.replace() is called, so the listener knows
  // that any subsequent isLoaded=true belongs to the NEW source (not the old one).
  const replaceCalledRef = useRef(false);

  useEffect(() => { isRepeatRef.current = isRepeat; }, [isRepeat]);
  useEffect(() => { isShuffleRef.current = isShuffle; }, [isShuffle]);
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { elapsedRef.current = elapsed; }, [elapsed]);
  useEffect(() => { tokenRef.current = token; }, [token]);

  // Create one persistent player on mount; reuse it for all songs via replace()
  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true })
      .catch(() => { /* audio session config is best-effort */ });

    const player = createAudioPlayer(null, { updateInterval: 500 });
    playerRef.current = player;

    const sub = player.addListener("playbackStatusUpdate", (status: AudioStatus) => {
      const song = currentSongRef.current;
      const dur = status.duration || (song?.duration ?? 0);
      const pos = status.currentTime ?? 0;
      setDuration(dur);
      setElapsed(pos);
      setProgress(dur > 0 ? Math.max(0, Math.min(1, pos / dur)) : 0);
      setIsPlaying(status.playing);
      // isBuffering tracks mid-playback network stalls (separate from isLoading)
      setIsBuffering(status.isBuffering && !manualLoadingRef.current);

      // isLoading only tracks the INITIAL load (manualLoadingRef window).
      // Mid-playback buffer stalls do NOT set isLoading — that was causing the
      // spinner to appear on the play button at 0:22, 0:30, etc. during streaming.
      if (manualLoadingRef.current) {
        // Clear once the NEW source is ready. replaceCalledRef gates isLoaded so
        // the old song's final isLoaded=true (arriving before replace()) is ignored.
        const newSourceReady =
          status.playing ||
          (replaceCalledRef.current && status.isLoaded);
        if (newSourceReady) {
          manualLoadingRef.current = false;
          replaceCalledRef.current = false;
          setIsLoading(false);
          setError(null);

          // Re-apply lock screen metadata at 200ms, 800ms, and 2000ms.
          // ExoPlayer reads ID3 tags from the stream asynchronously in
          // multiple passes as chunks arrive — a single delayed call isn't
          // enough. Three retries across 2 s covers the full buffering window.
          if (song) {
            applyLockScreenMeta(player, song);
            const snapId = loadIdRef.current;
            // Cancel any pending retries from the previous song before
            // scheduling new ones, so stale timers don't overwrite the
            // lock screen metadata of the song that just started.
            metaTimerRef.current.forEach(clearTimeout);
            metaTimerRef.current = [200, 800, 2000].map(delay =>
              setTimeout(() => {
                if (loadIdRef.current !== snapId) return;
                const current = currentSongRef.current;
                if (current) applyLockScreenMeta(player, current);
              }, delay)
            );
          }
        }
        // else: still buffering the new source — keep isLoading true
      }

      if (status.didJustFinish) {
        // Always clear loading when a song ends — short songs may finish before
        // a status.playing === true ever fires, leaving isLoading stuck true.
        manualLoadingRef.current = false;
        setIsLoading(false);
        if (isRepeatRef.current) {
          // seekTo returns a Promise; play() must be called after seek completes
          player.seekTo(0).then(() => {
            // Guard: if user skipped to another song while seek was in flight, abort
            if (manualLoadingRef.current) return;
            player.play();
          }).catch(() => { /* seek may fail if source was replaced */ });
        } else {
          const q = queueRef.current;
          if (!q.length) return;
          if (isShuffleRef.current) {
            const idx = pickRandomIndex(q.length, queueIndexRef.current);
            queueIndexRef.current = idx;
            pushHistoryRef.current?.(q[idx]);
            _loadAndPlay(q[idx]);
          } else {
            const nextIdx = queueIndexRef.current + 1;
            if (nextIdx >= q.length) { setIsPlaying(false); return; }
            queueIndexRef.current = nextIdx;
            pushHistoryRef.current?.(q[nextIdx]);
            _loadAndPlay(q[nextIdx]);
          }
        }
      }
    });

    return () => {
      metaTimerRef.current.forEach(clearTimeout);
      metaTimerRef.current = [];
      try { sub?.remove?.(); } catch { /* listener already gone */ }
      try { player.remove(); } catch { /* player already disposed */ }
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Forward-declared so the playbackStatusUpdate listener (which captures it
  // by reference) always sees the latest pushHistory implementation.
  const pushHistoryRef = useRef<((song: Song) => void) | null>(null);

  function _loadAndPlay(song: Song) {
    const myId = ++loadIdRef.current;
    manualLoadingRef.current = true;
    setIsLoading(true);
    setError(null);
    setCurrentSong(song);
    currentSongRef.current = song;
    setElapsed(0);
    setProgress(0);
    setDuration(song.duration ?? 0);
    setIsPlaying(false);

    try {
      const player = playerRef.current;
      if (!player) {
        manualLoadingRef.current = false;
        setIsLoading(false);
        setError("Player not ready. Reopen the app and try again.");
        return;
      }

      // Use the local downloaded file if available — no network needed.
      // Otherwise fall back to the server streaming proxy which handles
      // Google Drive token resolution, range requests, and caching.
      const localPath = song.localPath ?? resolveLocalPath(song._id);
      const uri = localPath ?? `${API.STREAM_URL}/${encodeURIComponent(song._id)}`;
      const headers: Record<string, string> = !localPath && tokenRef.current
        ? { Authorization: `Bearer ${tokenRef.current}` }
        : {};

      if (myId !== loadIdRef.current) return; // newer load started, abort

      replaceCalledRef.current = true;
      player.replace({ uri, headers });
      player.play();

      // Set lock screen / notification metadata immediately.
      // A delayed re-apply fires from the status listener once the source
      // is loaded, overriding any ID3 tags ExoPlayer reads from the stream.
      applyLockScreenMeta(player, song);
    } catch (e) {
      if (myId === loadIdRef.current) {
        console.error("Audio load failed:", e);
        manualLoadingRef.current = false;
        replaceCalledRef.current = false;
        setIsLoading(false);
        setError("Failed to load song. Tap play to retry.");
      }
    }
  }

  const pushHistory = useCallback((song: Song) => {
    setHistory((prev) => {
      const filtered = prev.filter((s) => s._id !== song._id);
      return [song, ...filtered].slice(0, HISTORY_LIMIT);
    });
  }, []);
  useEffect(() => { pushHistoryRef.current = pushHistory; }, [pushHistory]);

  const playSong = useCallback((song: Song, newQueue?: Song[]) => {
    if (!song?._id) return;
    pushHistory(song);
    if (newQueue && newQueue.length) {
      // Defensive copy so callers can mutate their array without affecting us
      const q = newQueue.slice();
      setQueue(q);
      queueRef.current = q;
      const idx = q.findIndex((s) => s._id === song._id);
      // If the song isn't in the queue, prepend it so prev/next still make sense
      if (idx < 0) {
        q.unshift(song);
        setQueue(q);
        queueRef.current = q;
        queueIndexRef.current = 0;
      } else {
        queueIndexRef.current = idx;
      }
    } else if (!queueRef.current.length) {
      // Single-song play with no existing queue — seed a one-item queue so
      // prev/next don't no-op silently
      const q = [song];
      setQueue(q);
      queueRef.current = q;
      queueIndexRef.current = 0;
    }
    _loadAndPlay(song);
  }, [pushHistory]);

  const togglePlay = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    const song = currentSongRef.current;

    // If we're sitting on an error or the source isn't loaded, restart from
    // scratch instead of asking the native player to play a broken stream.
    if (!p.playing && song) {
      const needsReload =
        !manualLoadingRef.current &&
        (!p.isLoaded || error !== null);
      if (needsReload) {
        _loadAndPlay(song);
        return;
      }
    }
    if (p.playing) p.pause();
    else p.play();
  }, [error]);

  const next = useCallback(() => {
    const q = queueRef.current;
    if (!q.length) return;
    let idx: number;
    if (isShuffleRef.current) {
      idx = pickRandomIndex(q.length, queueIndexRef.current);
    } else {
      const nextIdx = queueIndexRef.current + 1;
      // Stop at queue end (no wrap) — consistent with the auto-advance behaviour
      // in the didJustFinish handler so pressing next at the last song feels the
      // same as letting the last song finish naturally.
      if (nextIdx >= q.length) {
        playerRef.current?.pause();
        setIsPlaying(false);
        return;
      }
      idx = nextIdx;
    }
    queueIndexRef.current = idx;
    pushHistory(q[idx]);
    _loadAndPlay(q[idx]);
  }, [pushHistory]);

  const prev = useCallback(() => {
    const q = queueRef.current;
    if (elapsedRef.current > 3) {
      // First press within a song: restart from beginning
      playerRef.current?.seekTo(0).catch(() => {});
      return;
    }
    if (!q.length) return;
    const idx = (queueIndexRef.current - 1 + q.length) % q.length;
    queueIndexRef.current = idx;
    pushHistory(q[idx]);
    _loadAndPlay(q[idx]);
  }, [pushHistory]);

  const seek = useCallback((ratio: number) => {
    const p = playerRef.current;
    if (!p) return;
    // p.duration can be 0 before audio metadata loads; fall back to state value
    const dur = p.duration > 0 ? p.duration : duration;
    if (dur > 0) {
      p.seekTo(Math.max(0, Math.min(1, ratio)) * dur).catch(() => {});
    }
  }, [duration]);

  const toggleShuffle = useCallback(() => setIsShuffle((v) => !v), []);
  const toggleRepeat = useCallback(() => setIsRepeat((v) => !v), []);

  const closePlayer = useCallback(() => {
    const p = playerRef.current;
    if (p) {
      try { p.pause(); } catch {}
      try { p.clearLockScreenControls(); } catch { /* best-effort */ }
    }
    manualLoadingRef.current = false;
    replaceCalledRef.current = false;
    currentSongRef.current = null;
    queueRef.current = [];
    queueIndexRef.current = 0;
    setCurrentSong(null);
    setQueue([]);
    setIsPlaying(false);
    setIsLoading(false);
    setIsBuffering(false);
    setError(null);
    setProgress(0);
    setElapsed(0);
    setDuration(0);
  }, []);

  // Tear playback + per-user state down on logout so the next user doesn't
  // inherit playback or hear it continue after signing out.
  useEffect(() => {
    const unregister = registerLogoutHandler(() => {
      closePlayer();
      setHistory([]);
    });
    return unregister;
  }, [registerLogoutHandler, closePlayer]);

  return (
    <PlayerContext.Provider value={{
      currentSong, queue, history, isPlaying, progress, duration, elapsed,
      isShuffle, isRepeat, isLoading, isBuffering, error,
      playSong, togglePlay, next, prev,
      seek, toggleShuffle, toggleRepeat, closePlayer,
    }}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be inside PlayerProvider");
  return ctx;
}
