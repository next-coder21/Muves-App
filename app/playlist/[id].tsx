import React, { useState, useEffect, useCallback } from "react";
import {
  ActivityIndicator, Alert, Image, Pressable,
  RefreshControl, ScrollView, StyleSheet, Text, View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import { usePlaylists } from "@/context/PlaylistContext";
import { useFavourites } from "@/context/FavouritesContext";
import { usePlayer, Song } from "@/context/PlayerContext";
import AddToPlaylistSheet from "@/components/AddToPlaylistSheet";

const LIME = "#C8FF00";
const BG   = "#0d0d0d";
const TEXT = "#f5f5f5";
const MUTED = "#666";
const BORDER = "rgba(255,255,255,0.08)";

function fmt(s: number) {
  if (!s || isNaN(s)) return "";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function fmtTotal(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h} hr ${m} min`;
  return `${m} min`;
}

export default function PlaylistDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();
  const { playlists, getPlaylistSongs, removeSongFromPlaylist, deletePlaylist } = usePlaylists();
  const { isFavourite, toggleFavourite } = useFavourites();
  const { playSong, currentSong, isPlaying } = usePlayer();

  const playlist = playlists.find(p => p.id === id);

  const [songs,       setSongs]       = useState<Song[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [removing,    setRemoving]    = useState<string | null>(null);
  const [sheetSong,   setSheetSong]   = useState<Song | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getPlaylistSongs(id);
      setSongs(data);
    } catch {}
    finally { setLoading(false); }
  }, [id, getPlaylistSongs]);

  useEffect(() => { load(); }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function playAll(shuffle = false) {
    if (!songs.length) return;
    const list = shuffle ? [...songs].sort(() => Math.random() - 0.5) : songs;
    playSong(list[0], list);
    router.push("/player");
  }

  async function handleRemove(songId: string) {
    if (!id) return;
    setRemoving(songId);
    try {
      await removeSongFromPlaylist(id, songId);
      setSongs(prev => prev.filter(s => s._id !== songId));
    } catch {
      Alert.alert("Error", "Failed to remove song");
    } finally { setRemoving(null); }
  }

  function confirmDelete() {
    Alert.alert("Delete Playlist", `Delete "${playlist?.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          if (!id) return;
          try {
            await deletePlaylist(id);
            router.back();
          } catch {
            Alert.alert("Error", "Failed to delete playlist");
          }
        },
      },
    ]);
  }

  const totalDur = songs.reduce((a, s) => a + (s.duration ?? 0), 0);
  const coverUri = songs[0]?.coverImage;

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <StatusBar style="light" />
        <ActivityIndicator color={LIME} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Blurred hero background */}
      {coverUri && (
        <Image source={{ uri: coverUri }} style={StyleSheet.absoluteFill} blurRadius={50} />
      )}
      <LinearGradient
        colors={["rgba(10,10,10,0.65)", "rgba(13,13,13,0.9)", BG]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 130 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={LIME} colors={[LIME]} />
        }
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.5 }]}>
            <MaterialIcons name="arrow-back-ios" size={22} color="#f5f5f5" />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>Playlist</Text>
          <Pressable onPress={confirmDelete} style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.5 }]}>
            <MaterialIcons name="delete-outline" size={22} color="#666" />
          </Pressable>
        </View>

        {/* ── Hero section ── */}
        <View style={styles.hero}>
          <View style={styles.coverWrap}>
            {coverUri
              ? <Image source={{ uri: coverUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              : (
                <View style={[StyleSheet.absoluteFill, styles.coverFallback]}>
                  <MaterialIcons name="queue-music" size={48} color="#666" />
                </View>
              )
            }
          </View>

          <Text style={styles.playlistName}>{playlist?.name ?? "Playlist"}</Text>
          <Text style={styles.playlistMeta}>
            {songs.length} {songs.length === 1 ? "song" : "songs"}
            {totalDur > 0 && `  ·  ${fmtTotal(totalDur)}`}
          </Text>

          {/* Action buttons */}
          <View style={styles.actionRow}>
            <Pressable
              onPress={() => playAll(false)}
              disabled={!songs.length}
              style={({ pressed }) => [styles.playBtn, pressed && { opacity: 0.8 }, !songs.length && { opacity: 0.4 }]}
            >
              <MaterialIcons name="play-arrow" size={18} color="#000" />
              <Text style={styles.playBtnText}>Play All</Text>
            </Pressable>
            <Pressable
              onPress={() => playAll(true)}
              disabled={!songs.length}
              style={({ pressed }) => [styles.shuffleBtn, pressed && { opacity: 0.8 }, !songs.length && { opacity: 0.4 }]}
            >
              <MaterialIcons name="shuffle" size={18} color="#C8FF00" />
              <Text style={styles.shuffleBtnText}>Shuffle</Text>
            </Pressable>
          </View>
        </View>

        {/* ── Song list ── */}
        {songs.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="music-note" size={48} color="#666" style={{ marginBottom: 12 }} />
            <Text style={styles.emptyTitle}>No songs yet</Text>
            <Text style={styles.emptyText}>Use the + button on any song to add it here.</Text>
          </View>
        ) : (
          <View style={styles.songList}>
            {songs.map((song, i) => {
              const isActive = currentSong?._id === song._id;
              const isRemoving = removing === song._id;
              const liked = isFavourite(song._id);
              return (
                <Pressable
                  key={song._id ?? String(i)}
                  onPress={() => { playSong(song, songs); router.push("/player"); }}
                  style={({ pressed }) => [
                    styles.songRow,
                    pressed && { backgroundColor: "rgba(255,255,255,0.04)" },
                    isRemoving && { opacity: 0.3 },
                  ]}
                >
                  {isActive
                    ? <MaterialIcons name={isPlaying ? "play-arrow" : "pause"} size={16} color={LIME} style={{ width: 28 }} />
                    : <Text style={styles.rank}>{i + 1}</Text>
                  }
                  <View style={styles.cover}>
                    {song.coverImage
                      ? <Image source={{ uri: song.coverImage }} style={StyleSheet.absoluteFill} />
                      : <View style={[StyleSheet.absoluteFill, styles.coverFallback]}><MaterialIcons name="music-note" size={18} color={LIME} /></View>
                    }
                  </View>
                  <View style={styles.info}>
                    <Text style={[styles.title, isActive && { color: LIME }]} numberOfLines={1}>{song.title}</Text>
                    <Text style={styles.artist} numberOfLines={1}>{song.artist}</Text>
                  </View>
                  {!!song.duration && <Text style={styles.dur}>{fmt(song.duration)}</Text>}
                  {/* Actions */}
                  <View style={styles.rowActions}>
                    <Pressable
                      hitSlop={10}
                      onPress={() => toggleFavourite(song._id)}
                      style={({ pressed }) => [{ padding: 6 }, pressed && { opacity: 0.5 }]}
                    >
                      <MaterialIcons name={liked ? "favorite" : "favorite-border"} size={20} color={liked ? LIME : "#666"} />
                    </Pressable>
                    <Pressable
                      hitSlop={10}
                      onPress={() => setSheetSong(song)}
                      style={({ pressed }) => [{ padding: 6 }, pressed && { opacity: 0.5 }]}
                    >
                      <MaterialIcons name="playlist-add" size={22} color="#666" />
                    </Pressable>
                    <Pressable
                      hitSlop={10}
                      onPress={() => handleRemove(song._id)}
                      disabled={isRemoving}
                      style={({ pressed }) => [{ padding: 6 }, pressed && { opacity: 0.5 }]}
                    >
                      <MaterialIcons name="remove-circle-outline" size={20} color="#666" />
                    </Pressable>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      <AddToPlaylistSheet
        visible={!!sheetSong}
        songId={sheetSong?._id ?? null}
        songTitle={sheetSong?.title}
        onClose={() => setSheetSong(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingTop: 52, paddingBottom: 8,
  },
  backBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  backIcon: { fontSize: 32, color: TEXT, fontWeight: "300" },
  headerTitle: { fontSize: 16, fontWeight: "700", color: TEXT, flex: 1, textAlign: "center" },

  hero: { alignItems: "center", paddingHorizontal: 28, paddingBottom: 24 },
  coverWrap: {
    width: 180, height: 180, borderRadius: 20,
    overflow: "hidden", backgroundColor: "#1a1a1a",
    marginBottom: 20,
    shadowColor: "#000", shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5, shadowRadius: 24, elevation: 16,
  },
  coverFallback: { alignItems: "center", justifyContent: "center", backgroundColor: "#1a1a1a" },
  playlistName: { fontSize: 24, fontWeight: "800", color: TEXT, textAlign: "center", marginBottom: 6 },
  playlistMeta: { fontSize: 13, color: MUTED, marginBottom: 20 },

  actionRow: { flexDirection: "row", gap: 12 },
  playBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: LIME, paddingHorizontal: 28, paddingVertical: 13,
    borderRadius: 30,
  },
  playBtnIcon: { fontSize: 14, color: "#000" },
  playBtnText: { fontSize: 15, fontWeight: "800", color: "#000" },
  shuffleBtn: {
    paddingHorizontal: 22, paddingVertical: 13,
    borderRadius: 30, borderWidth: 1, borderColor: BORDER,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  shuffleBtnText: { fontSize: 15, fontWeight: "700", color: TEXT },

  songList: { paddingHorizontal: 16 },
  songRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 10, paddingHorizontal: 8,
    borderRadius: 12, marginBottom: 2,
    gap: 10,
  },
  rank: { width: 22, fontSize: 12, color: MUTED, fontWeight: "700", textAlign: "center" },
  cover: {
    width: 48, height: 48, borderRadius: 12,
    overflow: "hidden", backgroundColor: "#1a1a1a",
  },
  info: { flex: 1, minWidth: 0 },
  title: { fontSize: 14, fontWeight: "700", color: TEXT },
  artist: { fontSize: 12, color: MUTED, marginTop: 2 },
  dur: { fontSize: 11, color: MUTED },
  rowActions: { flexDirection: "row", alignItems: "center" },
  heartIcon: { fontSize: 18, color: MUTED },
  moreIcon: { fontSize: 18, color: MUTED, fontWeight: "700" },
  removeIcon: { fontSize: 14, color: MUTED },

  emptyState: { alignItems: "center", paddingTop: 60, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: TEXT, marginBottom: 8 },
  emptyText: { fontSize: 14, color: MUTED, textAlign: "center", lineHeight: 22 },
});
