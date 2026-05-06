import {
  Alert, Image, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { useEffect, useMemo, useState, useCallback } from "react";
import { BlurView } from "expo-blur";
import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useApi } from "@/hooks/useApi";
import { usePlayer, Song } from "@/context/PlayerContext";
import { useFavourites } from "@/context/FavouritesContext";
import { usePlaylists, Playlist } from "@/context/PlaylistContext";
import { API } from "@/constants/api";
import { normalizeSong, normalizeSongs, normalizeAlbums } from "@/utils/normalize";
import AddToPlaylistSheet from "@/components/AddToPlaylistSheet";
import { usePlayerInset } from "@/hooks/usePlayerInset";

type Album = {
  _id: string; title: string; artist: string;
  coverImage?: string; songCount?: number; year?: number;
};

const LIME = "#C8FF00";
const BG = "#0d0d0d";
const TEXT = "#f5f5f5";
const MUTED = "#666";
const CARD_BORDER = "rgba(255,255,255,0.08)";

const TABS = ["Playlists", "Recent", "Albums", "Favourites"] as const;
type Tab = (typeof TABS)[number];

// ─── Song row ─────────────────────────────────────────────────────────────────
function SongRow({
  song, index, queue, onAdd,
}: {
  song: Song; index: number; queue: Song[]; onAdd: (s: Song) => void;
}) {
  const { playSong, currentSong, isPlaying } = usePlayer();
  const { isFavourite, toggleFavourite } = useFavourites();
  const router = useRouter();
  const active = currentSong?._id === song._id;
  const liked  = isFavourite(song._id);

  return (
    <Pressable
      style={({ pressed }) => [styles.songRow, pressed && { backgroundColor: "rgba(255,255,255,0.03)" }]}
      onPress={() => { playSong(song, queue.length ? queue : [song]); router.push("/player"); }}
    >
      {active
        ? <MaterialIcons name={isPlaying ? "play-arrow" : "pause"} size={16} color={LIME} style={{ width: 22, textAlign: "center" }} />
        : <Text style={[styles.songIndex]}>{index + 1}</Text>
      }
      <View style={styles.songCover}>
        {song.coverImage
          ? <Image source={{ uri: song.coverImage }} style={StyleSheet.absoluteFill} />
          : <View style={[StyleSheet.absoluteFill, styles.coverFallback]}><MaterialIcons name="music-note" size={20} color={LIME} /></View>
        }
        {active && (
          <View style={styles.activeOverlay}>
            <MaterialIcons name={isPlaying ? "play-arrow" : "pause"} size={12} color={LIME} />
          </View>
        )}
      </View>
      <View style={styles.songInfo}>
        <Text style={[styles.songTitle, active && { color: LIME }]} numberOfLines={1}>{song.title}</Text>
        <Text style={styles.songArtist} numberOfLines={1}>{song.artist}</Text>
      </View>
      <Pressable hitSlop={12} onPress={() => toggleFavourite(song._id)} style={{ padding: 4 }}>
        <MaterialIcons name={liked ? "favorite" : "favorite-border"} size={20} color={liked ? LIME : MUTED} />
      </Pressable>
      <Pressable hitSlop={12} onPress={() => onAdd(song)} style={{ padding: 4 }}>
        <MaterialIcons name="playlist-add" size={22} color={MUTED} />
      </Pressable>
    </Pressable>
  );
}

// ─── Album card ───────────────────────────────────────────────────────────────
function AlbumCard({ album }: { album: Album }) {
  const router = useRouter();
  return (
    <Pressable
      style={({ pressed }) => [styles.albumCard, pressed && { opacity: 0.75 }]}
      onPress={() => router.push(`/album/${album._id}` as any)}
    >
      <View style={styles.albumCover}>
        {album.coverImage
          ? <Image source={{ uri: album.coverImage }} style={StyleSheet.absoluteFill} />
          : <View style={[StyleSheet.absoluteFill, styles.coverFallback]}><MaterialIcons name="album" size={40} color={MUTED} /></View>
        }
        <LinearGradient colors={["transparent", "rgba(0,0,0,0.65)"]} style={styles.albumGradient} />
        {album.songCount !== undefined && (
          <View style={styles.albumCountBadge}>
            <Text style={styles.albumCountText}>{album.songCount} songs</Text>
          </View>
        )}
      </View>
      <Text style={styles.albumTitle} numberOfLines={1}>{album.title}</Text>
      <Text style={styles.albumArtist} numberOfLines={1}>{album.artist}</Text>
    </Pressable>
  );
}

// ─── Playlist card ────────────────────────────────────────────────────────────
function PlaylistCard({ pl, onDelete }: { pl: Playlist; onDelete: (id: string) => void }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(`/playlist/${pl.id}` as any)}
      style={({ pressed }) => [styles.plCard, pressed && { opacity: 0.8 }]}
    >
      <View style={styles.plIcon}>
        <MaterialIcons name="queue-music" size={28} color={LIME} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.plName} numberOfLines={1}>{pl.name}</Text>
        <Text style={styles.plMeta}>{pl.songCount} {pl.songCount === 1 ? "song" : "songs"}</Text>
      </View>
      <Pressable
        hitSlop={12}
        onPress={() => {
          Alert.alert("Delete Playlist", `Delete "${pl.name}"?`, [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: () => onDelete(pl.id) },
          ]);
        }}
        style={({ pressed }) => [{ padding: 6 }, pressed && { opacity: 0.5 }]}
      >
        <MaterialIcons name="delete-outline" size={20} color={MUTED} />
      </Pressable>
    </Pressable>
  );
}

type MIName = React.ComponentProps<typeof MaterialIcons>["name"];

function EmptyState({ icon, title, text }: { icon: MIName; title: string; text: string }) {
  return (
    <View style={styles.emptyState}>
      <MaterialIcons name={icon} size={52} color={MUTED} style={{ marginBottom: 16 }} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function LibraryScreen() {
  const { get } = useApi();
  const { favouriteIds, count: favCount, loadFavourites } = useFavourites();
  const { playlists, loadPlaylists, createPlaylist, deletePlaylist } = usePlaylists();
  const bottomInset = usePlayerInset();

  const [tab, setTab]           = useState<Tab>("Playlists");
  const [songs, setSongs]       = useState<Song[]>([]);
  const [albums, setAlbums]     = useState<Album[]>([]);
  const [favDetails, setFavDetails] = useState<Map<string, Song>>(new Map());
  const [refreshing, setRefreshing] = useState(false);

  // Create playlist state
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName]       = useState("");
  const [creating, setCreating]     = useState(false);

  // Add-to-playlist sheet
  const [sheetSong, setSheetSong] = useState<Song | null>(null);

  const loadSongs = useCallback(async () => {
    try {
      const d = await get<any>(API.SONGS_URL);
      setSongs(normalizeSongs(d));
    } catch { /* keep previous list rather than wiping the UI */ }
  }, [get]);

  const loadAlbums = useCallback(async () => {
    try {
      const d = await get<any>(API.ALBUMS_URL);
      setAlbums(normalizeAlbums(d));
    } catch { /* keep previous list rather than wiping the UI */ }
  }, [get]);

  // Hydrate full song records for favourite IDs that aren't already in the
  // bulk songs list. This keeps the favourites tab populated even when a
  // liked song is older than what /songs returns.
  const loadMissingFavDetails = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    const fetched = await Promise.all(
      ids.map(id =>
        get<any>(API.SONG_BY_ID(id))
          .then(d => normalizeSong({ ...d, id: d?.id ?? id }))
          .catch(() => null)
      )
    );
    setFavDetails(prev => {
      const next = new Map(prev);
      for (const s of fetched) {
        if (s && s._id) next.set(s._id, s);
      }
      return next;
    });
  }, [get]);

  useEffect(() => {
    loadSongs();
    loadAlbums();
  }, [loadSongs, loadAlbums]);

  // When the favourites set or the songs list changes, top up missing details
  useEffect(() => {
    if (!favouriteIds.size) return;
    const known = new Set(songs.map(s => s._id));
    const missing: string[] = [];
    for (const id of favouriteIds) {
      if (!id) continue;
      if (!known.has(id) && !favDetails.has(id)) missing.push(id);
    }
    if (missing.length) loadMissingFavDetails(missing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favouriteIds, songs]);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([loadSongs(), loadAlbums(), loadPlaylists(), loadFavourites()]);
    } finally {
      setRefreshing(false);
    }
  }

  async function handleCreatePlaylist() {
    const trimmed = newName.trim();
    if (!trimmed || creating) return;
    setCreating(true);
    try {
      await createPlaylist(trimmed);
      setNewName("");
      setShowCreate(false);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to create playlist");
    } finally {
      setCreating(false);
    }
  }

  async function handleDeletePlaylist(id: string) {
    try {
      await deletePlaylist(id);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to delete playlist");
    }
  }

  const recent = useMemo(() => songs.slice(0, 30), [songs]);

  // Live-derived favourite list — re-computes whenever favouriteIds changes,
  // so unliking a song from the library tab makes it disappear immediately.
  const favSongs = useMemo<Song[]>(() => {
    if (!favouriteIds.size) return [];
    const byId = new Map<string, Song>();
    for (const s of songs) byId.set(s._id, s);
    for (const [id, s] of favDetails) if (!byId.has(id)) byId.set(id, s);
    const out: Song[] = [];
    for (const id of favouriteIds) {
      const s = byId.get(id);
      if (s) out.push(s);
    }
    return out;
  }, [favouriteIds, songs, favDetails]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient colors={["#0a0a00", "#0d0d0d"]} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Library</Text>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        {([
          { num: songs.length,     label: "Songs",      icon: "music-note" as MIName },
          { num: playlists.length, label: "Playlists",  icon: "queue-music" as MIName },
          { num: favCount,         label: "Favourites", icon: "favorite" as MIName },
        ]).map((s) => (
          <BlurView key={s.label} intensity={20} tint="dark" style={styles.statCard}>
            <MaterialIcons name={s.icon} size={14} color={LIME} style={{ marginBottom: 2 }} />
            <Text style={styles.statNum}>{s.num}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </BlurView>
        ))}
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {TABS.map(t => (
          <Pressable
            key={t}
            style={styles.tabBarItem}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
            {tab === t && <View style={styles.tabUnderline} />}
          </Pressable>
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomInset + 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={LIME} colors={[LIME]} />
        }
      >
        {/* ── Playlists ── */}
        {tab === "Playlists" && (
          <View style={{ paddingHorizontal: 16 }}>
            {/* Create playlist */}
            {showCreate ? (
              <View style={styles.createRow}>
                <TextInput
                  autoFocus
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="Playlist name…"
                  placeholderTextColor={MUTED}
                  style={styles.createInput}
                  onSubmitEditing={handleCreatePlaylist}
                  returnKeyType="done"
                />
                <Pressable
                  onPress={handleCreatePlaylist}
                  disabled={!newName.trim() || creating}
                  style={({ pressed }) => [styles.createOk, pressed && { opacity: 0.7 }, (!newName.trim() || creating) && { opacity: 0.5 }]}
                >
                  <Text style={styles.createOkText}>{creating ? "…" : "Create"}</Text>
                </Pressable>
                <Pressable onPress={() => { setShowCreate(false); setNewName(""); }} style={{ padding: 10 }}>
                  <MaterialIcons name="close" size={18} color={MUTED} />
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={() => setShowCreate(true)}
                style={({ pressed }) => [styles.newPlaylistBtn, pressed && { opacity: 0.7 }]}
              >
                <MaterialIcons name="add" size={20} color={LIME} />
                <Text style={styles.newPlaylistText}>New Playlist</Text>
              </Pressable>
            )}

            {playlists.length === 0
              ? <EmptyState icon="queue-music" title="No playlists" text="Create a playlist to organise your music." />
              : playlists.map(pl => (
                  <PlaylistCard key={pl.id} pl={pl} onDelete={handleDeletePlaylist} />
                ))
            }
          </View>
        )}

        {/* ── Recent ── */}
        {tab === "Recent" && (
          recent.length > 0
            ? <View style={styles.songList}>
                {recent.map((s, i) => (
                  <SongRow key={s._id ?? String(i)} song={s} index={i} queue={recent} onAdd={setSheetSong} />
                ))}
              </View>
            : <EmptyState icon="music-note" title="No songs yet" text="Songs you play will appear here." />
        )}

        {/* ── Albums ── */}
        {tab === "Albums" && (
          albums.length > 0
            ? <View style={styles.albumGrid}>
                {albums.map((a, i) => {
                  if (i % 2 !== 0) return null;
                  return (
                    <View key={a._id ?? String(i)} style={styles.albumRow}>
                      <AlbumCard album={a} />
                      {albums[i + 1] ? <AlbumCard album={albums[i + 1]} /> : <View style={{ flex: 1 }} />}
                    </View>
                  );
                })}
              </View>
            : <EmptyState icon="album" title="No albums" text="Albums will appear here once added." />
        )}

        {/* ── Favourites ── */}
        {tab === "Favourites" && (
          favSongs.length > 0
            ? <View style={styles.songList}>
                {favSongs.map((s, i) => (
                  <SongRow key={s._id ?? String(i)} song={s} index={i} queue={favSongs} onAdd={setSheetSong} />
                ))}
              </View>
            : <EmptyState icon="favorite-border" title="No favourites yet" text="Tap the heart on any song to save it here." />
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
  header: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16 },
  headerTitle: { fontSize: 28, fontWeight: "800", color: TEXT },

  statsRow: { flexDirection: "row", paddingHorizontal: 20, gap: 8, marginBottom: 14 },
  statCard: { flex: 1, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 6, alignItems: "center", overflow: "hidden", borderWidth: 1, borderColor: CARD_BORDER },
  statIcon: { fontSize: 13, marginBottom: 2 },
  statNum: { fontSize: 15, fontWeight: "800", color: LIME },
  statLabel: { fontSize: 10, color: MUTED, marginTop: 1, fontWeight: "600" },

  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: CARD_BORDER,
    marginBottom: 16,
  },
  tabBarItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    position: "relative",
  },
  tabUnderline: {
    position: "absolute",
    bottom: 0,
    left: "15%",
    right: "15%",
    height: 2,
    borderRadius: 2,
    backgroundColor: LIME,
  },
  tabText: { fontSize: 13, fontWeight: "700", color: MUTED },
  tabTextActive: { color: TEXT },

  // Playlists
  newPlaylistBtn: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 14, borderRadius: 14, marginBottom: 12,
    borderWidth: 1, borderStyle: "dashed", borderColor: LIME,
  },
  newPlaylistIcon: { fontSize: 20, color: LIME, fontWeight: "700" },
  newPlaylistText: { fontSize: 15, fontWeight: "700", color: LIME },
  createRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  createInput: {
    flex: 1, height: 46, paddingHorizontal: 14,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 12, borderWidth: 1, borderColor: LIME,
    color: TEXT, fontSize: 14,
  },
  createOk: {
    height: 46, paddingHorizontal: 16, borderRadius: 12,
    backgroundColor: LIME, alignItems: "center", justifyContent: "center",
  },
  createOkText: { fontWeight: "800", color: "#000", fontSize: 14 },
  plCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    padding: 14, borderRadius: 16, marginBottom: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: CARD_BORDER,
  },
  plIcon: {
    width: 52, height: 52, borderRadius: 14,
    backgroundColor: "#1a1a1a", alignItems: "center", justifyContent: "center",
  },
  plName: { fontSize: 15, fontWeight: "700", color: TEXT },
  plMeta: { fontSize: 12, color: MUTED, marginTop: 3 },

  // Songs
  songList: { paddingHorizontal: 16 },
  songRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 10, borderRadius: 12,
    paddingHorizontal: 4, marginBottom: 1, gap: 6,
  },
  songIndex: { width: 28, fontSize: 13, color: MUTED, fontWeight: "700", textAlign: "center" },
  songCover: { width: 52, height: 52, borderRadius: 14, overflow: "hidden", backgroundColor: "#1a1a1a", marginRight: 6 },
  coverFallback: { alignItems: "center", justifyContent: "center", backgroundColor: "#1a1a1a" },
  activeOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" },
  songInfo: { flex: 1 },
  songTitle: { fontSize: 14, fontWeight: "700", color: TEXT },
  songArtist: { fontSize: 12, color: MUTED, marginTop: 3 },
  heartBtn: { fontSize: 20, color: MUTED },
  moreBtn: { fontSize: 18, color: MUTED, fontWeight: "700" },

  // Albums
  albumGrid: { paddingHorizontal: 16 },
  albumRow: { flexDirection: "row", gap: 14, marginBottom: 16 },
  albumCard: { flex: 1 },
  albumCover: { aspectRatio: 1, borderRadius: 18, overflow: "hidden", backgroundColor: "#1a1a1a", marginBottom: 8 },
  albumGradient: { position: "absolute", bottom: 0, left: 0, right: 0, height: "45%" },
  albumCountBadge: { position: "absolute", bottom: 8, left: 8, backgroundColor: "rgba(0,0,0,0.7)", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  albumCountText: { fontSize: 10, color: MUTED, fontWeight: "600" },
  albumTitle: { fontSize: 13, fontWeight: "700", color: TEXT },
  albumArtist: { fontSize: 12, color: MUTED, marginTop: 2 },

  // Empty
  emptyState: { alignItems: "center", paddingTop: 70, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: TEXT, marginBottom: 8 },
  emptyText: { fontSize: 14, color: MUTED, textAlign: "center", lineHeight: 22 },
});
