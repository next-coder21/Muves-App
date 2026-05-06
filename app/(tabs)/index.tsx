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
import { useEffect, useState, useCallback } from "react";
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

type Artist = {
  _id: string;
  name: string;
  image?: string;
  verified?: boolean;
  songCount?: number | string;
};

const LIME = "#C8FF00";
const BG = "#0d0d0d";
const TEXT = "#f5f5f5";
const MUTED = "#777";
const CARD_BORDER = "rgba(255,255,255,0.08)";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function ArtistCircle({ artist }: { artist: Artist }) {
  return (
    <Pressable style={({ pressed }) => [styles.artistCircle, pressed && { opacity: 0.7 }]}>
      <View style={styles.artistImg}>
        {artist.image ? (
          <Image source={{ uri: artist.image }} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.artistFallback]}>
            <Text style={{ fontSize: 24 }}>🎤</Text>
          </View>
        )}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.45)"]}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <Text style={styles.artistName} numberOfLines={1}>{artist.name}</Text>
    </Pressable>
  );
}

function SongCard({
  song, songs, onPlay, rank,
}: {
  song: Song; songs: Song[]; onPlay: (s: Song, q: Song[]) => void; rank?: number;
}) {
  const { currentSong, isPlaying, togglePlay } = usePlayer();
  const isActive = currentSong?._id === song._id;

  return (
    <Pressable
      style={({ pressed }) => [styles.songCard, pressed && { opacity: 0.8 }]}
      onPress={() => {
        if (isActive) togglePlay();
        else onPlay(song, songs);
      }}
    >
      <View style={styles.songCardCover}>
        {song.coverImage ? (
          <Image source={{ uri: song.coverImage }} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.coverFallback]}>
            <MaterialIcons name="music-note" size={28} color={LIME} />
          </View>
        )}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.75)"]}
          style={styles.songCardGradient}
        />
        {rank !== undefined && (
          <View style={styles.rankBadge}>
            <Text style={styles.rankText}>#{rank + 1}</Text>
          </View>
        )}
        <View style={[styles.songCardPlayBtn, isActive && styles.songCardPlayBtnActive]}>
          <MaterialIcons
            name={isActive && isPlaying ? "pause" : "play-arrow"}
            size={18}
            color={isActive ? "#000" : LIME}
          />
        </View>
        {isActive && (
          <View style={[StyleSheet.absoluteFillObject, { borderRadius: 18, borderWidth: 2, borderColor: LIME }]} />
        )}
      </View>
      <Text style={[styles.songCardTitle, isActive && { color: LIME }]} numberOfLines={1}>
        {song.title}
      </Text>
      <Text style={styles.songCardArtist} numberOfLines={1}>{song.artist}</Text>
    </Pressable>
  );
}

function RecentRow({
  song, songs, onPlay,
}: {
  song: Song; songs: Song[]; onPlay: (s: Song, q: Song[]) => void;
}) {
  const { currentSong, isPlaying, togglePlay } = usePlayer();
  const isActive = currentSong?._id === song._id;

  return (
    <Pressable
      style={({ pressed }) => [styles.recentRow, pressed && { opacity: 0.75 }]}
      onPress={() => {
        if (isActive) togglePlay();
        else onPlay(song, songs);
      }}
    >
      <View style={styles.recentCover}>
        {song.coverImage ? (
          <Image source={{ uri: song.coverImage }} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.coverFallback]}>
            <MaterialIcons name="music-note" size={20} color={LIME} />
          </View>
        )}
        {isActive && (
          <View style={styles.recentActiveOverlay}>
            <MaterialIcons name="play-arrow" size={12} color={LIME} />
          </View>
        )}
      </View>
      <View style={styles.recentInfo}>
        <Text style={[styles.recentTitle, isActive && { color: LIME }]} numberOfLines={1}>
          {song.title}
        </Text>
        <Text style={styles.recentArtist} numberOfLines={1}>
          {song.artist}{song.genre ? ` · ${song.genre}` : ""}
        </Text>
      </View>
      <View style={[styles.recentPlayBtn, isActive && styles.recentPlayBtnActive]}>
        <MaterialIcons
          name={isActive && isPlaying ? "pause" : "play-arrow"}
          size={16}
          color={isActive ? "#000" : LIME}
        />
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

  const [songs, setSongs] = useState<Song[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await get(API.SONGS_URL);
      setSongs(normalizeSongs(d));
    } catch { /* keep empty */ }
    try {
      const d = await get(API.ARTISTS_URL);
      setArtists(normalizeArtists(d));
    } catch { /* keep empty */ }
  }, [get]);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function handlePlay(song: Song, queue: Song[]) {
    playSong(song, queue);
    router.push("/player");
  }

  const initial = (user?.name ?? "U")[0].toUpperCase();
  // Use player history for "recently played", fall back to first songs from API
  const recentlyPlayed = history.length > 0 ? history.slice(0, 6) : songs.slice(0, 6);
  const trending = songs.slice(0, 8);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient
        colors={["#181808", "#0d0d0d", "#0d0d0d"]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={LIME} colors={[LIME]} />
        }
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomInset + 16 }]}
      >
        {/* Top bar */}
        <View style={styles.topBar}>
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
              <BlurView intensity={25} tint="dark" style={styles.iconBtn}>
                <Text style={styles.iconBtnText}>🔔</Text>
              </BlurView>
            </Pressable>
          </View>
        </View>

        {/* Search bar — navigates to explore tab */}
        <Pressable
          style={styles.searchBar}
          onPress={() => router.push("/(tabs)/explore")}
        >
          <Text style={styles.searchIcon}>⌕</Text>
          <Text style={styles.searchPlaceholder}>Find your sound...</Text>
          <BlurView intensity={20} tint="dark" style={styles.filterBtn}>
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
            {/* Popular Artists */}
            {artists.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Popular artists</Text>
                  <Pressable onPress={() => router.push("/artists")}>
                    <Text style={styles.seeAll}>See all</Text>
                  </Pressable>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.hScroll}
                >
                  {artists.slice(0, 10).map((a, i) => (
                    <ArtistCircle key={a._id ?? String(i)} artist={a} />
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Recently Played */}
            {recentlyPlayed.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>
                    {history.length > 0 ? "Recently played" : "Latest music"}
                  </Text>
                  <Pressable onPress={() => router.push("/(tabs)/library")}>
                    <Text style={styles.seeAll}>See all</Text>
                  </Pressable>
                </View>
                <View style={styles.recentList}>
                  {recentlyPlayed.map((song, i) => (
                    <RecentRow
                      key={song._id ?? String(i)}
                      song={song}
                      songs={recentlyPlayed}
                      onPlay={handlePlay}
                    />
                  ))}
                </View>
              </View>
            )}

            {/* Trending */}
            {trending.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Trending now 🔥</Text>
                  <Pressable onPress={() => router.push("/(tabs)/library")}>
                    <Text style={styles.seeAll}>See all</Text>
                  </Pressable>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.hScroll}
                >
                  {trending.map((song, i) => (
                    <SongCard
                      key={song._id ?? String(i)}
                      song={song}
                      songs={trending}
                      onPlay={handlePlay}
                      rank={i}
                    />
                  ))}
                </ScrollView>
              </View>
            )}

            {songs.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={{ fontSize: 56, marginBottom: 16 }}>🎵</Text>
                <Text style={styles.emptyTitle}>No music yet</Text>
                <Text style={styles.emptyText}>
                  Make sure your backend is running and your device is on the same network.
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  scrollContent: {},

  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 20,
  },
  topBarLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: LIME,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: LIME + "44",
  },
  avatarInitial: { fontSize: 18, fontWeight: "800", color: "#000" },
  greetingText: { fontSize: 12, color: MUTED },
  userName: { fontSize: 17, fontWeight: "800", color: TEXT },
  topBarRight: { flexDirection: "row", gap: 8 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  iconBtnText: { fontSize: 18 },

  // Search bar (button, navigates to Explore)
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginBottom: 28,
    height: 50,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  searchIcon: { fontSize: 18, color: MUTED, marginRight: 8 },
  searchPlaceholder: { flex: 1, color: MUTED, fontSize: 14 },
  filterBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },

  loadingBox: { alignItems: "center", paddingVertical: 80 },
  loadingText: { color: MUTED, marginTop: 12, fontSize: 14 },

  section: { marginBottom: 32 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 19, fontWeight: "800", color: TEXT },
  seeAll: { fontSize: 13, color: LIME, fontWeight: "600" },
  hScroll: { paddingHorizontal: 20, gap: 14 },

  // Artist circle
  artistCircle: { width: 76, alignItems: "center" },
  artistImg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: "hidden",
    marginBottom: 6,
    borderWidth: 2,
    borderColor: LIME + "33",
  },
  artistFallback: { alignItems: "center", justifyContent: "center", backgroundColor: "#222" },
  artistName: { fontSize: 11, fontWeight: "600", color: TEXT, textAlign: "center" },

  // Recent row
  recentList: { paddingHorizontal: 20, gap: 4 },
  recentRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
  },
  recentCover: {
    width: 54,
    height: 54,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
  },
  recentActiveOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  coverFallback: { alignItems: "center", justifyContent: "center", backgroundColor: "#1a1a1a" },
  recentInfo: { flex: 1 },
  recentTitle: { fontSize: 14, fontWeight: "700", color: TEXT },
  recentArtist: { fontSize: 12, color: MUTED, marginTop: 3 },
  recentPlayBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  recentPlayBtnActive: { backgroundColor: LIME, borderColor: LIME },
  recentPlayIcon: { fontSize: 13, color: TEXT, marginLeft: 2 },

  // Trending card
  songCard: { width: 150 },
  songCardCover: {
    width: 150,
    height: 150,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
    marginBottom: 10,
  },
  songCardGradient: { position: "absolute", bottom: 0, left: 0, right: 0, height: "55%" },
  rankBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  rankText: { fontSize: 11, fontWeight: "800", color: LIME },
  songCardPlayBtn: {
    position: "absolute",
    bottom: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  songCardPlayBtnActive: { backgroundColor: LIME, borderColor: LIME },
  songCardPlayIcon: { fontSize: 14, color: TEXT, marginLeft: 2 },
  songCardTitle: { fontSize: 13, fontWeight: "700", color: TEXT },
  songCardArtist: { fontSize: 12, color: MUTED, marginTop: 2 },

  emptyState: { alignItems: "center", paddingVertical: 60, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: TEXT, marginBottom: 8 },
  emptyText: { fontSize: 14, color: MUTED, textAlign: "center", lineHeight: 21 },
});
