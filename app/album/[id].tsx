import {
  ActivityIndicator, Image, Pressable,
  ScrollView, StyleSheet, Text, View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useApi } from "@/hooks/useApi";
import { usePlayer, Song } from "@/context/PlayerContext";
import { useFavourites } from "@/context/FavouritesContext";
import { API } from "@/constants/api";
import { normalizeSongs } from "@/utils/normalize";
import { usePlayerInset } from "@/hooks/usePlayerInset";

const LIME = "#C8FF00";
const BG   = "#0d0d0d";
const TEXT = "#f5f5f5";
const MUTED = "#666";
const BORDER = "rgba(255,255,255,0.08)";

function fmt(sec: number) {
  if (!sec) return "";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function AlbumScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { get } = useApi();
  const { playSong, currentSong, isPlaying } = usePlayer();
  const { isFavourite, toggleFavourite } = useFavourites();
  const bottomInset = usePlayerInset();

  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    get<any>(API.ALBUM_SONGS(id))
      .then(d => { setSongs(normalizeSongs(d)); setError(null); })
      .catch(() => setError("Failed to load album songs."))
      .finally(() => setLoading(false));
  }, [id]);

  const albumCover  = songs[0]?.coverImage ?? null;
  const albumTitle  = (songs[0] as any)?.album  ?? "Album";
  const albumArtist = songs[0]?.artist ?? "";

  function playAll() {
    if (!songs.length) return;
    playSong(songs[0], songs);
    router.push("/player");
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient colors={["#111100", "#0d0d0d"]} style={StyleSheet.absoluteFill} />

      {/* Back */}
      <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={10}>
        <MaterialIcons name="arrow-back-ios" size={24} color={TEXT} />
      </Pressable>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomInset + 16 }}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.coverWrap}>
            {albumCover
              ? <Image source={{ uri: albumCover }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              : <MaterialIcons name="album" size={64} color={MUTED} />
            }
          </View>
          <Text style={styles.albumTitle} numberOfLines={2}>{albumTitle}</Text>
          {!!albumArtist && <Text style={styles.albumArtist}>{albumArtist}</Text>}
          {!loading && (
            <Text style={styles.albumMeta}>{songs.length} {songs.length === 1 ? "song" : "songs"}</Text>
          )}

          {/* Play all */}
          {songs.length > 0 && (
            <Pressable style={({ pressed }) => [styles.playAllBtn, pressed && { opacity: 0.8 }]} onPress={playAll}>
              <MaterialIcons name="play-arrow" size={20} color="#000" />
          <Text style={styles.playAllText}>Play All</Text>
            </Pressable>
          )}
        </View>

        {/* Song list */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={LIME} />
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={{ color: MUTED, fontSize: 14 }}>{error}</Text>
          </View>
        ) : songs.length === 0 ? (
          <View style={styles.center}>
            <MaterialIcons name="album" size={44} color={MUTED} style={{ marginBottom: 12 }} />
            <Text style={{ color: TEXT, fontWeight: "700", fontSize: 16 }}>No songs in this album</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {songs.map((song, i) => {
              const active = currentSong?._id === song._id;
              const liked  = isFavourite(song._id);
              return (
                <Pressable
                  key={song._id ?? String(i)}
                  style={({ pressed }) => [styles.row, pressed && { backgroundColor: "rgba(255,255,255,0.04)" }]}
                  onPress={() => { playSong(song, songs); router.push("/player"); }}
                >
                  {active
                    ? <MaterialIcons name={isPlaying ? "play-arrow" : "pause"} size={16} color={LIME} style={{ width: 24, textAlign: "center" }} />
                    : <Text style={styles.rowIndex}>{i + 1}</Text>
                  }
                  <View style={styles.rowInfo}>
                    <Text style={[styles.rowTitle, active && { color: LIME }]} numberOfLines={1}>{song.title}</Text>
                    <Text style={styles.rowMeta} numberOfLines={1}>
                      {song.artist}{song.duration ? `  ·  ${fmt(song.duration)}` : ""}
                    </Text>
                  </View>
                  <Pressable hitSlop={12} onPress={() => toggleFavourite(song._id)}>
                    <MaterialIcons name={liked ? "favorite" : "favorite-border"} size={20} color={liked ? LIME : MUTED} />
                  </Pressable>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  backBtn: { position: "absolute", top: 52, left: 16, zIndex: 10, padding: 6 },
  backIcon: { fontSize: 34, color: TEXT, lineHeight: 34 },

  hero: { alignItems: "center", paddingTop: 100, paddingBottom: 32, paddingHorizontal: 24 },
  coverWrap: {
    width: 200, height: 200, borderRadius: 20,
    overflow: "hidden", backgroundColor: "#1a1a1a",
    alignItems: "center", justifyContent: "center",
    marginBottom: 20,
    shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 20, shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  albumTitle:  { fontSize: 22, fontWeight: "800", color: TEXT, textAlign: "center", marginBottom: 4 },
  albumArtist: { fontSize: 14, color: MUTED, marginBottom: 4 },
  albumMeta:   { fontSize: 12, color: MUTED, marginBottom: 20 },

  playAllBtn: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: LIME, borderRadius: 30,
    paddingHorizontal: 32, paddingVertical: 12,
  },
  playAllText: { fontSize: 15, fontWeight: "800", color: "#000" },

  list: { paddingHorizontal: 16 },
  row: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 12, paddingHorizontal: 8,
    borderBottomWidth: 1, borderBottomColor: BORDER,
    gap: 12, borderRadius: 10,
  },
  rowIndex: { width: 24, fontSize: 13, color: MUTED, fontWeight: "700", textAlign: "center" },
  rowInfo:  { flex: 1 },
  rowTitle: { fontSize: 14, fontWeight: "700", color: TEXT },
  rowMeta:  { fontSize: 12, color: MUTED, marginTop: 3 },
  heart:    { fontSize: 20, color: MUTED, paddingHorizontal: 4 },

  center: { alignItems: "center", paddingTop: 60 },
});
