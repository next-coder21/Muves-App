import {
  Dimensions,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { usePlayer, Song } from "@/context/PlayerContext";
import { useApi } from "@/hooks/useApi";
import { API } from "@/constants/api";
import {
  normalizeSongs,
  normalizeArtists,
  normalizeAlbums,
  NormalizedArtist,
  NormalizedAlbum,
} from "@/utils/normalize";
import { usePlayerInset } from "@/hooks/usePlayerInset";
import { useNetwork } from "@/context/NetworkContext";
import { useLocalSongs } from "@/context/LocalSongsContext";
import { useFavourites } from "@/context/FavouritesContext";
import AsyncStorage from "@react-native-async-storage/async-storage";

const LIKED_ALBUMS_KEY = "muves_liked_albums_v1";

// ─── Palette (matches reference image exactly) ────────────────────────────────
const P = {
  bg: "#F5F5F5",
  surface: "#FFFFFF",
  red: "#E53935",
  redLight: "#FDECEA",
  text: "#1A1A1A",
  sub: "#9E9E9E",
  border: "#EEEEEE",
  divider: "#F0F0F0",
  shadow: "rgba(0,0,0,0.08)",
};

const { width: SCREEN_W } = Dimensions.get("window");
const GRID_GAP = 14;
const GRID_PAD = 20;
const CARD_W = (SCREEN_W - GRID_PAD * 2 - GRID_GAP) / 2;

type TabId = "overview" | "songs" | "albums" | "artists";
const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "songs", label: "Songs" },
  { id: "albums", label: "Albums" },
  { id: "artists", label: "Artist" },
];

function formatDuration(seconds?: number): string {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

// ─── Horizontal tab bar (text + red underline) ────────────────────────────────
function TabBar({ active, onChange }: { active: TabId; onChange: (t: TabId) => void }) {
  return (
    <View style={tabStyles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={tabStyles.scroll}
      >
        {TABS.map((tab) => {
          const isActive = tab.id === active;
          return (
            <Pressable key={tab.id} onPress={() => onChange(tab.id)} style={tabStyles.tab}>
              <Text style={[tabStyles.label, isActive && tabStyles.labelActive]}>
                {tab.label}
              </Text>
              {isActive && <View style={tabStyles.underline} />}
            </Pressable>
          );
        })}
      </ScrollView>
      {/* Bottom border under all tabs */}
      <View style={tabStyles.borderLine} />
    </View>
  );
}

const tabStyles = StyleSheet.create({
  wrapper: { marginBottom: 22 },
  scroll: { paddingHorizontal: 20, gap: 28 },
  tab: { paddingBottom: 10, alignItems: "center" },
  label: { fontSize: 14, fontWeight: "600", color: P.sub },
  labelActive: { color: P.text, fontWeight: "800" },
  underline: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: P.red,
  },
  borderLine: {
    height: 1,
    backgroundColor: P.border,
    marginTop: -1,
  },
});

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ title, onViewAll }: { title: string; onViewAll?: () => void }) {
  return (
    <View style={shStyles.row}>
      <Text style={shStyles.title}>{title}</Text>
      {onViewAll && (
        <Pressable onPress={onViewAll} hitSlop={8}>
          <Text style={shStyles.viewAll}>View all</Text>
        </Pressable>
      )}
    </View>
  );
}

const shStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  title: { fontSize: 17, fontWeight: "800", color: P.text },
  viewAll: { fontSize: 13, fontWeight: "600", color: P.red },
});

// ─── Featured 2-col song card ─────────────────────────────────────────────────
function SongGridCard({
  song,
  songs,
  onPlay,
  isFav,
  onToggleFav,
}: {
  song: Song;
  songs: Song[];
  onPlay: (s: Song, q: Song[]) => void;
  isFav: boolean;
  onToggleFav: (id: string) => void;
}) {
  const { currentSong, isPlaying, togglePlay } = usePlayer();
  const isActive = currentSong?._id === song._id;

  return (
    <Pressable
      style={({ pressed }) => [gcStyles.card, pressed && { opacity: 0.88 }]}
      onPress={() => { if (isActive) togglePlay(); else onPlay(song, songs); }}
    >
      {/* Album art */}
      <View style={gcStyles.art}>
        {song.coverImage ? (
          <Image source={{ uri: song.coverImage }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, gcStyles.noArt]}>
            <MaterialIcons name="music-note" size={36} color={P.red + "55"} />
          </View>
        )}
        {/* Play indicator overlay */}
        {isActive && (
          <View style={gcStyles.playOverlay}>
            <View style={gcStyles.playCircle}>
              <MaterialIcons name={isPlaying ? "pause" : "play-arrow"} size={16} color={P.surface} />
            </View>
          </View>
        )}
        {/* Active red border */}
        {isActive && <View style={[StyleSheet.absoluteFillObject, gcStyles.activeBorder]} />}
      </View>

      {/* Info row */}
      <View style={gcStyles.infoRow}>
        <View style={{ flex: 1 }}>
          <Text style={[gcStyles.songName, isActive && { color: P.red }]} numberOfLines={1}>
            {song.title}
          </Text>
          <Text style={gcStyles.artistName} numberOfLines={1}>{song.artist}</Text>
        </View>
        <Pressable onPress={() => onToggleFav(song._id)} hitSlop={10} accessibilityLabel={isFav ? "Unlike" : "Like"}>
          <MaterialIcons name={isFav ? "favorite" : "favorite-border"} size={18} color={isFav ? P.red : P.sub} />
        </Pressable>
      </View>
    </Pressable>
  );
}

const gcStyles = StyleSheet.create({
  card: {
    width: CARD_W,
    backgroundColor: P.surface,
    borderRadius: 16,
    overflow: "hidden",
    ...Platform.select({
      ios: { shadowColor: P.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  art: {
    width: CARD_W,
    height: CARD_W,
    backgroundColor: "#F0F0F0",
  },
  noArt: { alignItems: "center", justifyContent: "center", backgroundColor: "#F5F5F5" },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  playCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: P.red,
    alignItems: "center",
    justifyContent: "center",
  },
  activeBorder: { borderRadius: 0, borderWidth: 2.5, borderColor: P.red },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 6,
  },
  songName: { fontSize: 13, fontWeight: "700", color: P.text, marginBottom: 2 },
  artistName: { fontSize: 11, color: P.sub },
});

// ─── Playlist / song row ──────────────────────────────────────────────────────
function PlaylistRow({
  song,
  songs,
  onPlay,
  isFav,
  onToggleFav,
}: {
  song: Song;
  songs: Song[];
  onPlay: (s: Song, q: Song[]) => void;
  isFav: boolean;
  onToggleFav: (id: string) => void;
}) {
  const { currentSong, isPlaying, togglePlay } = usePlayer();
  const isActive = currentSong?._id === song._id;

  return (
    <Pressable
      style={({ pressed }) => [prStyles.row, pressed && { backgroundColor: "#F9F9F9" }]}
      onPress={() => { if (isActive) togglePlay(); else onPlay(song, songs); }}
    >
      {/* Thumbnail */}
      <View style={prStyles.thumb}>
        {song.coverImage ? (
          <Image source={{ uri: song.coverImage }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, prStyles.noThumb]}>
            <MaterialIcons name="music-note" size={16} color={P.red} />
          </View>
        )}
        {isActive && (
          <View style={prStyles.thumbOverlay}>
            <MaterialIcons name={isPlaying ? "graphic-eq" : "play-arrow"} size={12} color={P.surface} />
          </View>
        )}
      </View>

      {/* Text */}
      <View style={{ flex: 1 }}>
        <Text style={[prStyles.songTitle, isActive && { color: P.red }]} numberOfLines={1}>{song.title}</Text>
        <Text style={prStyles.artistText} numberOfLines={1}>{song.artist}</Text>
      </View>

      {/* Duration */}
      {song.duration ? (
        <Text style={prStyles.duration}>{formatDuration(song.duration)}</Text>
      ) : null}

      {/* Like */}
      <Pressable onPress={() => onToggleFav(song._id)} hitSlop={10} accessibilityLabel={isFav ? "Unlike" : "Like"}>
        <MaterialIcons name={isFav ? "favorite" : "favorite-border"} size={16} color={isFav ? P.red : P.sub} />
      </Pressable>
    </Pressable>
  );
}

const prStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: P.divider,
    backgroundColor: P.surface,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#F0F0F0",
  },
  noThumb: { alignItems: "center", justifyContent: "center", backgroundColor: P.redLight },
  thumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(229,57,53,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  songTitle: { fontSize: 13, fontWeight: "700", color: P.text, marginBottom: 2 },
  artistText: { fontSize: 11, color: P.sub },
  duration: { fontSize: 12, color: P.sub, minWidth: 34, textAlign: "right" },
});

// ─── Artist circle (horizontal scroll in overview) ────────────────────────────
function ArtistCircle({ artist }: { artist: NormalizedArtist }) {
  return (
    <View style={acStyles.wrap}>
      <View style={acStyles.avatar}>
        {artist.image ? (
          <Image source={{ uri: artist.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, acStyles.noImg]}>
            <Text style={{ fontSize: 24 }}>🎤</Text>
          </View>
        )}
      </View>
      <Text style={acStyles.name} numberOfLines={1}>{artist.name}</Text>
    </View>
  );
}

const acStyles = StyleSheet.create({
  wrap: { width: 72, alignItems: "center" },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: "hidden",
    backgroundColor: "#F0F0F0",
    marginBottom: 6,
    borderWidth: 2,
    borderColor: P.border,
  },
  noImg: { alignItems: "center", justifyContent: "center" },
  name: { fontSize: 11, fontWeight: "600", color: P.text, textAlign: "center" },
});

// ─── Artist row (Artists tab) ─────────────────────────────────────────────────
function ArtistRow({ artist }: { artist: NormalizedArtist }) {
  return (
    <View style={arStyles.row}>
      <View style={arStyles.avatar}>
        {artist.image ? (
          <Image source={{ uri: artist.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, arStyles.noImg]}>
            <Text style={{ fontSize: 22 }}>🎤</Text>
          </View>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={arStyles.name} numberOfLines={1}>{artist.name}</Text>
        {artist.songCount != null && (
          <Text style={arStyles.count}>{artist.songCount} Song{artist.songCount !== 1 ? "s" : ""}</Text>
        )}
      </View>
      {artist.verified && (
        <MaterialIcons name="verified" size={16} color={P.red} />
      )}
    </View>
  );
}

const arStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 11,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: P.divider,
    backgroundColor: P.surface,
  },
  avatar: { width: 52, height: 52, borderRadius: 26, overflow: "hidden", backgroundColor: "#F0F0F0" },
  noImg: { alignItems: "center", justifyContent: "center" },
  name: { fontSize: 14, fontWeight: "700", color: P.text, marginBottom: 2 },
  count: { fontSize: 12, color: P.sub },
});

// ─── Album card ───────────────────────────────────────────────────────────────
function AlbumCard({
  album,
  onPress,
  isLiked,
  onToggleLike,
}: {
  album: NormalizedAlbum;
  onPress: () => void;
  isLiked: boolean;
  onToggleLike: (id: string) => void;
}) {
  const meta = [album.artist, album.year].filter(Boolean).join(" · ");

  return (
    <View style={albStyles.card}>
      <Pressable
        style={({ pressed }) => [albStyles.artWrap, pressed && { opacity: 0.9 }]}
        onPress={onPress}
      >
        {album.coverImage ? (
          <Image source={{ uri: album.coverImage }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, albStyles.noArt]}>
            <MaterialIcons name="album" size={36} color={P.red + "55"} />
          </View>
        )}
      </Pressable>
      <View style={albStyles.info}>
        <Pressable style={albStyles.titleRow} onPress={onPress}>
          <Text style={albStyles.title} numberOfLines={1}>{album.title}</Text>
          <Pressable
            hitSlop={10}
            onPress={() => onToggleLike(album._id)}
            accessibilityLabel={isLiked ? "Unlike album" : "Like album"}
          >
            <MaterialIcons
              name={isLiked ? "favorite" : "favorite-border"}
              size={16}
              color={isLiked ? P.red : P.sub}
            />
          </Pressable>
        </Pressable>
        <Text style={albStyles.sub} numberOfLines={1}>{meta}</Text>
      </View>
    </View>
  );
}

const albStyles = StyleSheet.create({
  card: {
    width: CARD_W,
    backgroundColor: P.surface,
    borderRadius: 16,
    overflow: "hidden",
    ...Platform.select({
      ios: { shadowColor: "rgba(0,0,0,0.08)", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  artWrap: { width: CARD_W, height: CARD_W, backgroundColor: "#F0F0F0" },
  noArt: { alignItems: "center", justifyContent: "center", backgroundColor: P.redLight },
  info: { paddingHorizontal: 10, paddingVertical: 10 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 4, marginBottom: 3 },
  title: { flex: 1, fontSize: 13, fontWeight: "700", color: P.text },
  sub: { fontSize: 11, color: P.sub },
});

// ─── Skeleton loader ──────────────────────────────────────────────────────────
function Skeleton() {
  const blockStyle = {
    backgroundColor: "#EBEBEB",
    borderRadius: 8,
  } as const;

  return (
    <View style={{ paddingHorizontal: GRID_PAD }}>
      {/* 2-col grid placeholders */}
      <View style={{ flexDirection: "row", gap: GRID_GAP, marginBottom: 24 }}>
        {[0, 1].map((i) => (
          <View key={i} style={{ width: CARD_W, backgroundColor: P.surface, borderRadius: 16, overflow: "hidden" }}>
            <View style={{ width: CARD_W, height: CARD_W, backgroundColor: "#EBEBEB" }} />
            <View style={{ padding: 10, gap: 6 }}>
              <View style={{ ...blockStyle, height: 12, width: "70%" }} />
              <View style={{ ...blockStyle, height: 10, width: "45%" }} />
            </View>
          </View>
        ))}
      </View>
      {/* Playlist rows */}
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: P.divider }}>
          <View style={{ ...blockStyle, width: 48, height: 48 }} />
          <View style={{ flex: 1, gap: 6 }}>
            <View style={{ ...blockStyle, height: 12, width: "60%" }} />
            <View style={{ ...blockStyle, height: 10, width: "40%" }} />
          </View>
          <View style={{ ...blockStyle, height: 10, width: 30 }} />
        </View>
      ))}
    </View>
  );
}

// ─── Continue Listening banner ─────────────────────────────────────────────────
function ContinueListeningBanner({
  song, queueLength, onResume, onDismiss,
}: { song: Song; queueLength: number; onResume: () => void; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 8000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <View style={clStyles.banner}>
      {song.coverImage ? (
        <Image source={{ uri: song.coverImage }} style={clStyles.art} contentFit="cover" />
      ) : (
        <View style={[clStyles.art, clStyles.artFallback]}>
          <MaterialIcons name="music-note" size={16} color={P.red + "88"} />
        </View>
      )}
      <View style={clStyles.info}>
        <Text style={clStyles.title} numberOfLines={1}>{song.title}</Text>
        <Text style={clStyles.sub} numberOfLines={1}>
          {song.artist} · {queueLength} song{queueLength !== 1 ? "s" : ""}
        </Text>
      </View>
      <Pressable
        style={({ pressed }) => [clStyles.resumeBtn, pressed && { opacity: 0.75 }]}
        onPress={onResume}
        accessibilityLabel="Resume queue"
      >
        <Text style={clStyles.resumeLabel}>Resume</Text>
      </Pressable>
      <Pressable onPress={onDismiss} hitSlop={10} accessibilityLabel="Dismiss">
        <MaterialIcons name="close" size={16} color={P.sub} />
      </Pressable>
    </View>
  );
}

const clStyles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: P.surface,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 14,
    padding: 10,
    gap: 10,
    borderWidth: 1,
    borderColor: P.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
  },
  art: { width: 42, height: 42, borderRadius: 8, overflow: "hidden" },
  artFallback: { backgroundColor: P.redLight, alignItems: "center", justifyContent: "center" },
  info: { flex: 1 },
  title: { fontSize: 13, fontWeight: "700", color: P.text },
  sub: { fontSize: 11, color: P.sub, marginTop: 2 },
  resumeBtn: {
    backgroundColor: P.red,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  resumeLabel: { fontSize: 12, fontWeight: "800", color: "#fff" },
});

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const { user } = useAuth();
  const { playSong, history, savedQueueSong, resumeSavedQueue, dismissSavedQueue, queue } = usePlayer();
  const { get } = useApi();
  const { isFavourite, toggleFavourite } = useFavourites();
  const router = useRouter();
  const bottomInset = usePlayerInset();
  const { isOnline } = useNetwork();
  const { localSongs } = useLocalSongs();
  const { top: topInset } = useSafeAreaInsets();

  const [songs, setSongs] = useState<Song[]>([]);
  const [artists, setArtists] = useState<NormalizedArtist[]>([]);
  const [albums, setAlbums] = useState<NormalizedAlbum[]>([]);
  const [likedAlbums, setLikedAlbums] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  const load = useCallback(async (signal?: AbortSignal) => {
    const opts = signal ? { signal } : {};
    const results = await Promise.allSettled([
      get(API.SONGS_URL, opts),
      get(API.ARTISTS_URL, opts),
      get(API.ALBUMS_URL, opts),
    ]);

    if (signal?.aborted) return;

    if (results[0].status === "fulfilled") setSongs(normalizeSongs(results[0].value));
    if (results[1].status === "fulfilled") setArtists(normalizeArtists(results[1].value));
    if (results[2].status === "fulfilled") setAlbums(normalizeAlbums(results[2].value));
  }, [get]);

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal).finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    return () => ctrl.abort();
  }, [load]);

  const prevOnlineRef = useRef(isOnline);
  useEffect(() => {
    if (isOnline && !prevOnlineRef.current) {
      const ctrl = new AbortController();
      load(ctrl.signal).catch(() => {});
      prevOnlineRef.current = true;
      return () => ctrl.abort();
    }
    prevOnlineRef.current = isOnline;
  }, [isOnline, load]);

  // Load liked albums from AsyncStorage
  useEffect(() => {
    AsyncStorage.getItem(LIKED_ALBUMS_KEY)
      .then((raw) => { if (raw) setLikedAlbums(new Set(JSON.parse(raw))); })
      .catch(() => {});
  }, []);

  async function toggleAlbumLike(albumId: string) {
    setLikedAlbums((prev) => {
      const next = new Set(prev);
      if (next.has(albumId)) next.delete(albumId); else next.add(albumId);
      AsyncStorage.setItem(LIKED_ALBUMS_KEY, JSON.stringify([...next])).catch(() => {});
      return next;
    });
  }

  async function onRefresh() {
    setRefreshing(true);
    const ctrl = new AbortController();
    await load(ctrl.signal);
    setRefreshing(false);
  }

  function handlePlay(song: Song, queue: Song[]) {
    playSong(song, queue);
    router.push("/player");
  }

  const initial = (user?.name ?? "U")[0].toUpperCase();
  const displaySongs = !isOnline && localSongs.length > 0 ? localSongs : songs;
  const featuredSongs = displaySongs.slice(0, 8);
  const recentSongs = history.length > 0 ? history.slice(0, 8) : displaySongs.slice(0, 8);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={P.red} colors={[P.red]} />
        }
        contentContainerStyle={{ paddingBottom: bottomInset + 24 }}
      >
        {/* ── Header ── */}
        <View style={[styles.header, { paddingTop: topInset + 16 }]}>
          <Text style={styles.pageTitle}>Listening</Text>
          <View style={styles.headerRight}>
            <Pressable
              style={styles.notifBtn}
              accessibilityLabel="Notifications"
            >
              <MaterialIcons name="notifications-none" size={22} color={P.text} />
            </Pressable>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
          </View>
        </View>

        {/* ── Offline banner ── */}
        {!isOnline && (
          <Pressable style={styles.offlineBanner} onPress={() => router.push("/(tabs)/library")}>
            <MaterialIcons name="wifi-off" size={15} color={P.surface} />
            <Text style={styles.offlineText}>
              Offline · {localSongs.length} song{localSongs.length !== 1 ? "s" : ""} available
            </Text>
            <MaterialIcons name="chevron-right" size={15} color={P.surface} />
          </Pressable>
        )}

        {/* ── Continue Listening banner ── */}
        {savedQueueSong && !history.length && (
          <ContinueListeningBanner
            song={savedQueueSong}
            queueLength={queue.length}
            onResume={resumeSavedQueue}
            onDismiss={dismissSavedQueue}
          />
        )}

        {/* ── Search bar ── */}
        <Pressable style={styles.searchBar} onPress={() => router.push("/(tabs)/explore")}>
          <MaterialIcons name="search" size={18} color={P.sub} />
          <Text style={styles.searchText}>Search Music</Text>
        </Pressable>

        {/* ── Tabs ── */}
        <TabBar active={activeTab} onChange={setActiveTab} />

        {/* ── Content ── */}
        {loading ? (
          <Skeleton />
        ) : (
          <>
            {/* Overview */}
            {activeTab === "overview" && (
              <>
                {featuredSongs.length > 0 ? (
                  <View style={{ marginBottom: 28 }}>
                    {/* 2-column featured grid */}
                    <View style={styles.grid}>
                      {featuredSongs.map((song, i) => (
                        <SongGridCard
                          key={song._id ?? String(i)}
                          song={song}
                          songs={featuredSongs}
                          onPlay={handlePlay}
                          isFav={isFavourite(song._id)}
                          onToggleFav={toggleFavourite}
                        />
                      ))}
                    </View>
                  </View>
                ) : (
                  <View style={styles.emptyWrap}>
                    <MaterialIcons name="music-note" size={60} color={P.sub} style={{ marginBottom: 14 }} />
                    <Text style={styles.emptyTitle}>No music yet</Text>
                    <Text style={styles.emptyBody}>Pull down to refresh or check your connection.</Text>
                  </View>
                )}

                {/* Popular Artists */}
                {artists.length > 0 && (
                  <View style={{ marginBottom: 28 }}>
                    <SectionHeader title="Popular Artists" onViewAll={() => setActiveTab("artists")} />
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ paddingHorizontal: 20, gap: 16 }}
                    >
                      {artists.slice(0, 14).map((a, i) => (
                        <ArtistCircle key={a._id ?? String(i)} artist={a} />
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* Playlist / Recent */}
                {recentSongs.length > 0 && (
                  <View style={{ marginBottom: 28 }}>
                    <SectionHeader
                      title={history.length > 0 ? "Recently Played" : "Playlist"}
                      onViewAll={() => router.push("/(tabs)/library")}
                    />
                    {recentSongs.map((song, i) => (
                      <PlaylistRow
                        key={song._id ?? String(i)}
                        song={song}
                        songs={recentSongs}
                        onPlay={handlePlay}
                        isFav={isFavourite(song._id)}
                        onToggleFav={toggleFavourite}
                      />
                    ))}
                  </View>
                )}
              </>
            )}

            {/* Songs */}
            {activeTab === "songs" && (
              <View style={{ marginBottom: 28 }}>
                <SectionHeader title={`All Songs (${displaySongs.length})`} />
                {displaySongs.length === 0 ? (
                  <View style={styles.emptyWrap}>
                    <Text style={styles.emptyBody}>No songs found.</Text>
                  </View>
                ) : (
                  displaySongs.map((song, i) => (
                    <PlaylistRow
                      key={song._id ?? String(i)}
                      song={song}
                      songs={displaySongs}
                      onPlay={handlePlay}
                      isFav={isFavourite(song._id)}
                      onToggleFav={toggleFavourite}
                    />
                  ))
                )}
              </View>
            )}

            {/* Albums */}
            {activeTab === "albums" && (
              <View style={{ marginBottom: 28 }}>
                <SectionHeader title={`Albums (${albums.length})`} />
                {albums.length === 0 ? (
                  <View style={styles.emptyWrap}>
                    <Text style={styles.emptyBody}>No albums found.</Text>
                  </View>
                ) : (
                  <View style={styles.grid}>
                    {albums.map((album, i) => (
                      <AlbumCard
                        key={album._id ?? String(i)}
                        album={album}
                        onPress={() => router.push(`/album/${album._id}`)}
                        isLiked={likedAlbums.has(album._id)}
                        onToggleLike={toggleAlbumLike}
                      />
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Artists */}
            {activeTab === "artists" && (
              <View style={{ marginBottom: 28 }}>
                <SectionHeader title={`Artists (${artists.length})`} onViewAll={() => router.push("/artists")} />
                {artists.length === 0 ? (
                  <View style={styles.emptyWrap}>
                    <Text style={styles.emptyBody}>No artists found.</Text>
                  </View>
                ) : (
                  artists.map((a, i) => (
                    <ArtistRow key={a._id ?? String(i)} artist={a} />
                  ))
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.bg },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  pageTitle: {
    fontSize: 30,
    fontWeight: "900",
    color: P.text,
    letterSpacing: -0.5,
  },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  notifBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: P.surface,
    borderWidth: 1,
    borderColor: P.border,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: P.red,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 16, fontWeight: "800", color: P.surface },

  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 14,
    backgroundColor: P.red,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  offlineText: { flex: 1, fontSize: 13, fontWeight: "700", color: P.surface },

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 22,
    height: 48,
    backgroundColor: P.surface,
    borderRadius: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: P.border,
    ...Platform.select({
      ios: { shadowColor: P.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6 },
      android: { elevation: 2 },
    }),
  },
  searchText: { flex: 1, fontSize: 14, color: P.sub },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: GRID_PAD,
    gap: GRID_GAP,
    marginBottom: 4,
  },

  emptyWrap: { alignItems: "center", paddingVertical: 60, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: P.text, marginBottom: 8 },
  emptyBody: { fontSize: 14, color: P.sub, textAlign: "center", lineHeight: 22 },
});
