import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { usePlayer, Song } from "@/context/PlayerContext";
import { useApi } from "@/hooks/useApi";
import { API } from "@/constants/api";
import { normalizeSongs, normalizeArtists } from "@/utils/normalize";
import { usePlayerInset } from "@/hooks/usePlayerInset";
import { useNetwork } from "@/context/NetworkContext";
import { useLocalSongs } from "@/context/LocalSongsContext";
import { useColors, Colors } from "@/context/ThemeContext";

const LIME = "#C8FF00";

type Artist = {
  _id: string;
  name: string;
  image?: string;
  verified?: boolean;
  songCount?: number | string;
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function ArtistCircle({ artist }: { artist: Artist }) {
  const c = useColors();
  return (
    <Pressable style={({ pressed }) => [{ width: 76, alignItems: "center" as const }, pressed && { opacity: 0.7 }]}>
      <View style={{ width: 64, height: 64, borderRadius: 32, overflow: "hidden", marginBottom: 6, borderWidth: 2, borderColor: LIME + "33" }}>
        {artist.image ? (
          <Image source={{ uri: artist.image }} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center", backgroundColor: c.card2 }]}>
            <Text style={{ fontSize: 24 }}>🎤</Text>
          </View>
        )}
        <LinearGradient colors={["transparent", "rgba(0,0,0,0.45)"]} style={StyleSheet.absoluteFill} />
      </View>
      <Text style={{ fontSize: 11, fontWeight: "600", color: c.text, textAlign: "center" }} numberOfLines={1}>{artist.name}</Text>
    </Pressable>
  );
}

function SongCard({ song, songs, onPlay, rank }: { song: Song; songs: Song[]; onPlay: (s: Song, q: Song[]) => void; rank?: number }) {
  const { currentSong, isPlaying, togglePlay } = usePlayer();
  const c = useColors();
  const isActive = currentSong?._id === song._id;
  return (
    <Pressable style={({ pressed }) => [{ width: 150 }, pressed && { opacity: 0.8 }]} onPress={() => { if (isActive) togglePlay(); else onPlay(song, songs); }}>
      <View style={{ width: 150, height: 150, borderRadius: 18, overflow: "hidden", backgroundColor: c.card2, marginBottom: 10 }}>
        {song.coverImage ? (
          <Image source={{ uri: song.coverImage }} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center", backgroundColor: c.card2 }]}>
            <MaterialIcons name="music-note" size={28} color={LIME} />
          </View>
        )}
        <LinearGradient colors={["transparent", "rgba(0,0,0,0.75)"]} style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "55%" }} />
        {rank !== undefined && (
          <View style={{ position: "absolute", top: 10, left: 10, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 }}>
            <Text style={{ fontSize: 11, fontWeight: "800", color: LIME }}>#{rank + 1}</Text>
          </View>
        )}
        <View style={[{ position: "absolute", bottom: 10, right: 10, width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", backgroundColor: "rgba(255,255,255,0.15)" }, isActive && { backgroundColor: LIME, borderColor: LIME }]}>
          <MaterialIcons name={isActive && isPlaying ? "pause" : "play-arrow"} size={18} color={isActive ? "#000" : LIME} />
        </View>
        {isActive && <View style={[StyleSheet.absoluteFillObject, { borderRadius: 18, borderWidth: 2, borderColor: LIME }]} />}
      </View>
      <Text style={[{ fontSize: 13, fontWeight: "700", color: c.text }, isActive && { color: LIME }]} numberOfLines={1}>{song.title}</Text>
      <Text style={{ fontSize: 12, color: c.muted, marginTop: 2 }} numberOfLines={1}>{song.artist}</Text>
    </Pressable>
  );
}

function RecentRow({ song, songs, onPlay }: { song: Song; songs: Song[]; onPlay: (s: Song, q: Song[]) => void }) {
  const { currentSong, isPlaying, togglePlay } = usePlayer();
  const c = useColors();
  const isActive = currentSong?._id === song._id;
  return (
    <Pressable style={({ pressed }) => [{ flexDirection: "row" as const, alignItems: "center" as const, paddingVertical: 10, gap: 14, borderBottomWidth: 1, borderBottomColor: c.divider }, pressed && { opacity: 0.75 }]} onPress={() => { if (isActive) togglePlay(); else onPlay(song, songs); }}>
      <View style={{ width: 54, height: 54, borderRadius: 14, overflow: "hidden", backgroundColor: c.card2 }}>
        {song.coverImage ? (
          <Image source={{ uri: song.coverImage }} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center", backgroundColor: c.card2 }]}>
            <MaterialIcons name="music-note" size={20} color={LIME} />
          </View>
        )}
        {isActive && (
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center" }]}>
            <MaterialIcons name="play-arrow" size={12} color={LIME} />
          </View>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[{ fontSize: 14, fontWeight: "700", color: c.text }, isActive && { color: LIME }]} numberOfLines={1}>{song.title}</Text>
        <Text style={{ fontSize: 12, color: c.muted, marginTop: 3 }} numberOfLines={1}>{song.artist}{song.genre ? ` · ${song.genre}` : ""}</Text>
      </View>
      <View style={[{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.cardBorder, backgroundColor: c.card2 }, isActive && { backgroundColor: LIME, borderColor: LIME }]}>
        <MaterialIcons name={isActive && isPlaying ? "pause" : "play-arrow"} size={16} color={isActive ? "#000" : LIME} />
      </View>
    </Pressable>
  );
}

export default function HomeScreen() {
  const { user } = useAuth();
  const { playSong, history } = usePlayer();
  const { get } = useApi();
  const router = useRouter();
  const bottomInset = usePlayerInset();
  const { isOnline } = useNetwork();
  const { localSongs } = useLocalSongs();
  const { top: topInset } = useSafeAreaInsets();
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [songs, setSongs] = useState<Song[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const d = await get(API.SONGS_URL, { signal });
      if (!signal?.aborted) setSongs(normalizeSongs(d));
    } catch (e) {
      if ((e as { name?: string })?.name === "AbortError") return;
    }
    try {
      const d = await get(API.ARTISTS_URL, { signal });
      if (!signal?.aborted) setArtists(normalizeArtists(d));
    } catch (e) {
      if ((e as { name?: string })?.name === "AbortError") return;
    }
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
  const recentlyPlayed = history.length > 0 ? history.slice(0, 6) : songs.slice(0, 6);
  const trending = !isOnline && localSongs.length > 0 ? localSongs.slice(0, 8) : songs.slice(0, 8);

  return (
    <View style={styles.container}>
      <StatusBar style={c.statusBar} />
      <LinearGradient
        colors={c.isDark ? ["#181808", "#0d0d0d", "#0d0d0d"] : ["#f0f5d0", "#f5f5f5", "#f5f5f5"]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={LIME} colors={[LIME]} />}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomInset + 16 }]}
      >
        {/* Top bar */}
        <View style={[styles.topBar, { paddingTop: topInset + 12 }]}>
          <View style={styles.topBarLeft}>
            <View style={styles.avatar}>
              <Text style={styles.avatarInitial}>{initial}</Text>
            </View>
            <View>
              <Text style={styles.greetingText}>{greeting()}</Text>
              <Text style={styles.userName}>{user?.name ?? "Listener"}</Text>
            </View>
          </View>
          <View style={styles.topBarRight}>
            <Pressable>
              <BlurView intensity={25} tint={c.tint} style={styles.iconBtn}>
                <Text style={styles.iconBtnText}>🔔</Text>
              </BlurView>
            </Pressable>
          </View>
        </View>

        {!isOnline && (
          <Pressable style={styles.offlineBanner} onPress={() => router.push("/(tabs)/library")}>
            <MaterialIcons name="wifi-off" size={16} color="#000" />
            <Text style={styles.offlineBannerText}>You're offline · {localSongs.length} song{localSongs.length !== 1 ? "s" : ""} available</Text>
            <MaterialIcons name="chevron-right" size={16} color="#000" />
          </Pressable>
        )}

        <Pressable style={styles.searchBar} onPress={() => router.push("/(tabs)/explore")}>
          <Text style={[styles.searchIcon, { color: c.muted }]}>⌕</Text>
          <Text style={styles.searchPlaceholder}>Find your sound...</Text>
          <BlurView intensity={20} tint={c.tint} style={styles.filterBtn}>
            <Text style={{ fontSize: 14 }}>⚙</Text>
          </BlurView>
        </Pressable>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={LIME} />
            <Text style={styles.loadingText}>Loading your music...</Text>
          </View>
        ) : (
          <>
            {artists.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Popular artists</Text>
                  <Pressable onPress={() => router.push("/artists")}><Text style={styles.seeAll}>See all</Text></Pressable>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
                  {artists.slice(0, 10).map((a, i) => <ArtistCircle key={a._id ?? String(i)} artist={a} />)}
                </ScrollView>
              </View>
            )}

            {recentlyPlayed.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{history.length > 0 ? "Recently played" : "Latest music"}</Text>
                  <Pressable onPress={() => router.push("/(tabs)/library")}><Text style={styles.seeAll}>See all</Text></Pressable>
                </View>
                <View style={styles.recentList}>
                  {recentlyPlayed.map((song, i) => <RecentRow key={song._id ?? String(i)} song={song} songs={recentlyPlayed} onPlay={handlePlay} />)}
                </View>
              </View>
            )}

            {trending.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Trending now 🔥</Text>
                  <Pressable onPress={() => router.push("/(tabs)/library")}><Text style={styles.seeAll}>See all</Text></Pressable>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
                  {trending.map((song, i) => <SongCard key={song._id ?? String(i)} song={song} songs={trending} onPlay={handlePlay} rank={i} />)}
                </ScrollView>
              </View>
            )}

            {songs.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={{ fontSize: 56, marginBottom: 16 }}>🎵</Text>
                <Text style={styles.emptyTitle}>No music yet</Text>
                <Text style={styles.emptyText}>Make sure your backend is running and your device is on the same network.</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    scrollContent: {},

    offlineBanner: {
      flexDirection: "row", alignItems: "center", gap: 8,
      marginHorizontal: 20, marginBottom: 12,
      backgroundColor: LIME, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14,
    },
    offlineBannerText: { flex: 1, fontSize: 13, fontWeight: "700", color: "#000" },

    topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingBottom: 20 },
    topBarLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
    avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: LIME, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: LIME + "44" },
    avatarInitial: { fontSize: 18, fontWeight: "800", color: "#000" },
    greetingText: { fontSize: 12, color: c.muted },
    userName: { fontSize: 17, fontWeight: "800", color: c.text },
    topBarRight: { flexDirection: "row", gap: 8 },
    iconBtn: { width: 40, height: 40, borderRadius: 14, overflow: "hidden", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.cardBorder },
    iconBtnText: { fontSize: 18 },

    searchBar: { flexDirection: "row", alignItems: "center", marginHorizontal: 20, marginBottom: 28, height: 50, backgroundColor: c.card2, borderRadius: 16, paddingHorizontal: 14, borderWidth: 1, borderColor: c.cardBorder },
    searchIcon: { fontSize: 18, marginRight: 8 },
    searchPlaceholder: { flex: 1, color: c.muted, fontSize: 14 },
    filterBtn: { width: 32, height: 32, borderRadius: 10, overflow: "hidden", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.cardBorder },

    loadingBox: { alignItems: "center", paddingVertical: 80 },
    loadingText: { color: c.muted, marginTop: 12, fontSize: 14 },

    section: { marginBottom: 32 },
    sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, marginBottom: 16 },
    sectionTitle: { fontSize: 19, fontWeight: "800", color: c.text },
    seeAll: { fontSize: 13, color: LIME, fontWeight: "600" },
    hScroll: { paddingHorizontal: 20, gap: 14 },

    recentList: { paddingHorizontal: 20, gap: 4 },

    emptyState: { alignItems: "center", paddingVertical: 60, paddingHorizontal: 40 },
    emptyTitle: { fontSize: 18, fontWeight: "700", color: c.text, marginBottom: 8 },
    emptyText: { fontSize: 14, color: c.muted, textAlign: "center", lineHeight: 21 },
  });
}
