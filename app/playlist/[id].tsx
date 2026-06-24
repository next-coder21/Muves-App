import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Animated, Pressable,
  RefreshControl, ScrollView, StyleSheet, Text, View,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePlaylists } from "@/context/PlaylistContext";
import { useFavourites } from "@/context/FavouritesContext";
import { usePlayer, Song } from "@/context/PlayerContext";
import { useColors } from "@/context/ThemeContext";
import AddToPlaylistSheet from "@/components/AddToPlaylistSheet";
import { useAppAlert } from "@/context/AlertContext";

const LIME = "#E53935";

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

function PlaylistSkeleton({ topInset }: { topInset: number }) {
  const shimmer = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 0.9, duration: 600, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0.4, duration: 600, useNativeDriver: true }),
      ])
    ).start();
  }, [shimmer]);
  return (
    <Animated.View style={{ opacity: shimmer, paddingTop: topInset + 16 }}>
      <View style={{ alignItems: "center", paddingHorizontal: 28, paddingBottom: 24, gap: 12 }}>
        <View style={{ width: 180, height: 180, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.07)" }} />
        <View style={{ width: 160, height: 24, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.07)" }} />
        <View style={{ width: 100, height: 13, borderRadius: 6, backgroundColor: "rgba(255,255,255,0.07)" }} />
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ width: 120, height: 46, borderRadius: 30, backgroundColor: "rgba(255,255,255,0.07)" }} />
          <View style={{ width: 110, height: 46, borderRadius: 30, backgroundColor: "rgba(255,255,255,0.07)" }} />
        </View>
      </View>
      {Array.from({ length: 5 }).map((_, i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 24, paddingVertical: 10, gap: 10 }}>
          <View style={{ width: 22, height: 12, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.07)" }} />
          <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.07)" }} />
          <View style={{ flex: 1, gap: 6 }}>
            <View style={{ width: "65%", height: 14, borderRadius: 6, backgroundColor: "rgba(255,255,255,0.07)" }} />
            <View style={{ width: "40%", height: 11, borderRadius: 5, backgroundColor: "rgba(255,255,255,0.07)" }} />
          </View>
        </View>
      ))}
    </Animated.View>
  );
}

export default function PlaylistDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();
  const { top: topInset } = useSafeAreaInsets();
  const { playlists, getPlaylistSongs, removeSongFromPlaylist, deletePlaylist } = usePlaylists();
  const { isFavourite, toggleFavourite } = useFavourites();
  const { playSong, currentSong, isPlaying } = usePlayer();
  const c = useColors();
  const { showAlert } = useAppAlert();

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
      showAlert("Error", "Failed to remove song");
    } finally { setRemoving(null); }
  }

  function confirmDelete() {
    showAlert("Delete Playlist", `Delete "${playlist?.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          if (!id) return;
          try {
            await deletePlaylist(id);
            router.back();
          } catch {
            showAlert("Error", "Failed to delete playlist");
          }
        },
      },
    ]);
  }

  const totalDur = songs.reduce((a, s) => a + (s.duration ?? 0), 0);
  const coverUri = songs[0]?.coverImage;

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <StatusBar style={c.statusBar} />

      {coverUri && (
        <Image source={{ uri: coverUri }} style={StyleSheet.absoluteFill} blurRadius={50} alt="" />
      )}
      <LinearGradient
        colors={c.isDark
          ? ["rgba(10,10,10,0.65)", "rgba(13,13,13,0.92)", "#0d0d0d"]
          : ["rgba(240,245,225,0.8)", "rgba(245,245,245,0.95)", "#f5f5f5"]
        }
        style={StyleSheet.absoluteFill}
      />

      {loading ? (
        <PlaylistSkeleton topInset={topInset} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 130 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={LIME} colors={[LIME]} />
          }
        >
          {/* Header */}
          <View style={[styles.header, { paddingTop: topInset + 8 }]}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.5 }]}
              accessibilityLabel="Go back"
            >
              <MaterialIcons name="arrow-back-ios" size={22} color={c.text} />
            </Pressable>
            <Text style={[styles.headerTitle, { color: c.text }]} numberOfLines={1}>Playlist</Text>
            <Pressable
              onPress={confirmDelete}
              style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.5 }]}
              accessibilityLabel="Delete playlist"
            >
              <MaterialIcons name="delete-outline" size={22} color={c.muted} />
            </Pressable>
          </View>

          {/* Hero */}
          <View style={styles.hero}>
            <View style={[
              styles.coverWrap,
              coverUri
                ? { shadowColor: LIME, shadowOpacity: 0.2, shadowRadius: 24 }
                : { shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 16 },
            ]}>
              {coverUri
                ? <Image source={{ uri: coverUri }} style={StyleSheet.absoluteFill} contentFit="cover" alt={playlist?.name ?? "Playlist cover"} />
                : (
                  <View style={[StyleSheet.absoluteFill, { backgroundColor: c.card2, alignItems: "center", justifyContent: "center" }]}>
                    <MaterialIcons name="queue-music" size={48} color={c.muted} />
                  </View>
                )
              }
            </View>

            <Text style={[styles.playlistName, { color: c.text }]}>{playlist?.name ?? "Playlist"}</Text>
            <Text style={[styles.playlistMeta, { color: c.muted }]}>
              {songs.length} {songs.length === 1 ? "song" : "songs"}
              {totalDur > 0 && `  ·  ${fmtTotal(totalDur)}`}
            </Text>

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
                style={({ pressed }) => [
                  styles.shuffleBtn,
                  { borderColor: c.cardBorder, backgroundColor: c.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" },
                  pressed && { opacity: 0.8 },
                  !songs.length && { opacity: 0.4 },
                ]}
              >
                <MaterialIcons name="shuffle" size={18} color={LIME} />
                <Text style={[styles.shuffleBtnText, { color: c.text }]}>Shuffle</Text>
              </Pressable>
            </View>
          </View>

          {/* Song list */}
          {songs.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="music-note" size={48} color={c.muted} style={{ marginBottom: 12 }} />
              <Text style={[styles.emptyTitle, { color: c.text }]}>No songs yet</Text>
              <Text style={[styles.emptyText, { color: c.muted }]}>Use the + button on any song to add it here.</Text>
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
                      pressed && { backgroundColor: c.rowPress },
                      isRemoving && { opacity: 0.3 },
                    ]}
                  >
                    {isActive
                      ? <MaterialIcons name={isPlaying ? "graphic-eq" : "pause"} size={16} color={LIME} style={{ width: 28 }} />
                      : <Text style={[styles.rank, { color: c.muted }]}>{i + 1}</Text>
                    }
                    <View style={[styles.cover, { backgroundColor: c.card2 }]}>
                      {song.coverImage
                        ? <Image source={{ uri: song.coverImage }} style={StyleSheet.absoluteFill} alt={song.title} />
                        : <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}><MaterialIcons name="music-note" size={18} color={LIME} /></View>
                      }
                    </View>
                    <View style={styles.info}>
                      <Text style={[styles.title, { color: isActive ? LIME : c.text }]} numberOfLines={1}>{song.title}</Text>
                      <Text style={[styles.artist, { color: c.muted }]} numberOfLines={1}>{song.artist}</Text>
                    </View>
                    {!!song.duration && <Text style={[styles.dur, { color: c.muted }]}>{fmt(song.duration)}</Text>}
                    <View style={styles.rowActions}>
                      <Pressable
                        hitSlop={10}
                        onPress={() => toggleFavourite(song._id)}
                        style={({ pressed }) => [{ padding: 6 }, pressed && { opacity: 0.5 }]}
                        accessibilityLabel={liked ? "Remove from favourites" : "Add to favourites"}
                      >
                        <MaterialIcons name={liked ? "favorite" : "favorite-border"} size={20} color={liked ? LIME : c.muted} />
                      </Pressable>
                      <Pressable
                        hitSlop={10}
                        onPress={() => setSheetSong(song)}
                        style={({ pressed }) => [{ padding: 6 }, pressed && { opacity: 0.5 }]}
                        accessibilityLabel="Add to playlist"
                      >
                        <MaterialIcons name="playlist-add" size={22} color={c.muted} />
                      </Pressable>
                      <Pressable
                        hitSlop={10}
                        onPress={() => handleRemove(song._id)}
                        disabled={isRemoving}
                        style={({ pressed }) => [{ padding: 6 }, pressed && { opacity: 0.5 }]}
                        accessibilityLabel="Remove from playlist"
                      >
                        <MaterialIcons name="remove-circle-outline" size={20} color={c.muted} />
                      </Pressable>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}

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
  container: { flex: 1 },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 8,
  },
  backBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 16, fontWeight: "700", flex: 1, textAlign: "center" },

  hero: { alignItems: "center", paddingHorizontal: 28, paddingBottom: 24 },
  coverWrap: {
    width: 180, height: 180, borderRadius: 20,
    overflow: "hidden",
    marginBottom: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },
  playlistName: { fontSize: 24, fontWeight: "800", textAlign: "center", marginBottom: 6 },
  playlistMeta: { fontSize: 13, marginBottom: 20 },

  actionRow: { flexDirection: "row", gap: 12 },
  playBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: LIME, paddingHorizontal: 28, paddingVertical: 13,
    borderRadius: 30,
    shadowColor: LIME, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },
  playBtnText: { fontSize: 15, fontWeight: "800", color: "#000" },
  shuffleBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 22, paddingVertical: 13,
    borderRadius: 30, borderWidth: 1,
  },
  shuffleBtnText: { fontSize: 15, fontWeight: "700" },

  songList: { paddingHorizontal: 16 },
  songRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 10, paddingHorizontal: 8,
    borderRadius: 12, marginBottom: 2,
    gap: 10,
  },
  rank: { width: 22, fontSize: 12, fontWeight: "700", textAlign: "center" },
  cover: {
    width: 48, height: 48, borderRadius: 12,
    overflow: "hidden",
  },
  info: { flex: 1, minWidth: 0 },
  title: { fontSize: 14, fontWeight: "700" },
  artist: { fontSize: 12, marginTop: 2 },
  dur: { fontSize: 11 },
  rowActions: { flexDirection: "row", alignItems: "center" },

  emptyState: { alignItems: "center", paddingTop: 60, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  emptyText: { fontSize: 14, textAlign: "center", lineHeight: 22 },
});
