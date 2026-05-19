import {
  Alert, Image, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
import { useLocalSongs } from "@/context/LocalSongsContext";
import { useNetwork } from "@/context/NetworkContext";
import { useColors, Colors } from "@/context/ThemeContext";

type Album = { _id: string; title: string; artist: string; coverImage?: string; songCount?: number; year?: number };

const LIME = "#C8FF00";
const TABS = ["Playlists", "Recent", "Albums", "Favourites", "On Device"] as const;
type Tab = (typeof TABS)[number];
type MIName = React.ComponentProps<typeof MaterialIcons>["name"];

function SongRow({ song, index, queue, onAdd }: { song: Song; index: number; queue: Song[]; onAdd: (s: Song) => void }) {
  const { playSong, currentSong, isPlaying } = usePlayer();
  const { isFavourite, toggleFavourite } = useFavourites();
  const router = useRouter();
  const c = useColors();
  const active = currentSong?._id === song._id;
  const liked = isFavourite(song._id);
  return (
    <Pressable
      style={({ pressed }) => [{ flexDirection: "row" as const, alignItems: "center" as const, paddingVertical: 10, borderRadius: 12, paddingHorizontal: 4, marginBottom: 1, gap: 6 }, pressed && { backgroundColor: c.rowPress }]}
      onPress={() => { playSong(song, queue.length ? queue : [song]); router.push("/player"); }}
    >
      {active
        ? <MaterialIcons name={isPlaying ? "play-arrow" : "pause"} size={16} color={LIME} style={{ width: 22, textAlign: "center" }} />
        : <Text style={{ width: 28, fontSize: 13, color: c.muted, fontWeight: "700", textAlign: "center" }}>{index + 1}</Text>
      }
      <View style={{ width: 52, height: 52, borderRadius: 14, overflow: "hidden", backgroundColor: c.card2, marginRight: 6 }}>
        {song.coverImage
          ? <Image source={{ uri: song.coverImage }} style={StyleSheet.absoluteFill} />
          : <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center", backgroundColor: c.card2 }]}><MaterialIcons name="music-note" size={20} color={LIME} /></View>
        }
        {active && (
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" }]}>
            <MaterialIcons name={isPlaying ? "play-arrow" : "pause"} size={12} color={LIME} />
          </View>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[{ fontSize: 14, fontWeight: "700", color: c.text }, active && { color: LIME }]} numberOfLines={1}>{song.title}</Text>
        <Text style={{ fontSize: 12, color: c.muted, marginTop: 3 }} numberOfLines={1}>{song.artist}</Text>
      </View>
      <Pressable hitSlop={12} onPress={() => toggleFavourite(song._id)} style={{ padding: 4 }}>
        <MaterialIcons name={liked ? "favorite" : "favorite-border"} size={20} color={liked ? LIME : c.muted} />
      </Pressable>
      <Pressable hitSlop={12} onPress={() => onAdd(song)} style={{ padding: 4 }}>
        <MaterialIcons name="playlist-add" size={22} color={c.muted} />
      </Pressable>
    </Pressable>
  );
}

function AlbumCard({ album }: { album: Album }) {
  const router = useRouter();
  const c = useColors();
  return (
    <Pressable style={({ pressed }) => [{ flex: 1 }, pressed && { opacity: 0.75 }]} onPress={() => router.push(`/album/${album._id}`)}>
      <View style={{ aspectRatio: 1, borderRadius: 18, overflow: "hidden", backgroundColor: c.card2, marginBottom: 8 }}>
        {album.coverImage
          ? <Image source={{ uri: album.coverImage }} style={StyleSheet.absoluteFill} />
          : <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center", backgroundColor: c.card2 }]}><MaterialIcons name="album" size={40} color={c.muted} /></View>
        }
        <LinearGradient colors={["transparent", "rgba(0,0,0,0.65)"]} style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "45%" }} />
        {album.songCount !== undefined && (
          <View style={{ position: "absolute", bottom: 8, left: 8, backgroundColor: "rgba(0,0,0,0.7)", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 }}>
            <Text style={{ fontSize: 10, color: c.muted, fontWeight: "600" }}>{album.songCount} songs</Text>
          </View>
        )}
      </View>
      <Text style={{ fontSize: 13, fontWeight: "700", color: c.text }} numberOfLines={1}>{album.title}</Text>
      <Text style={{ fontSize: 12, color: c.muted, marginTop: 2 }} numberOfLines={1}>{album.artist}</Text>
    </Pressable>
  );
}

function PlaylistCard({ pl, onDelete }: { pl: Playlist; onDelete: (id: string) => void }) {
  const router = useRouter();
  const c = useColors();
  return (
    <Pressable onPress={() => router.push(`/playlist/${pl.id}`)} style={({ pressed }) => [{ flexDirection: "row" as const, alignItems: "center" as const, gap: 14, padding: 14, borderRadius: 16, marginBottom: 8, backgroundColor: c.rowPress, borderWidth: 1, borderColor: c.cardBorder }, pressed && { opacity: 0.8 }]}>
      <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: c.card2, alignItems: "center", justifyContent: "center" }}>
        <MaterialIcons name="queue-music" size={28} color={LIME} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: "700", color: c.text }} numberOfLines={1}>{pl.name}</Text>
        <Text style={{ fontSize: 12, color: c.muted, marginTop: 3 }}>{pl.songCount} {pl.songCount === 1 ? "song" : "songs"}</Text>
      </View>
      <Pressable hitSlop={12} onPress={() => { Alert.alert("Delete Playlist", `Delete "${pl.name}"?`, [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => onDelete(pl.id) }]); }} style={({ pressed }) => [{ padding: 6 }, pressed && { opacity: 0.5 }]}>
        <MaterialIcons name="delete-outline" size={20} color={c.muted} />
      </Pressable>
    </Pressable>
  );
}

function EmptyState({ icon, title, text }: { icon: MIName; title: string; text: string }) {
  const c = useColors();
  return (
    <View style={{ alignItems: "center", paddingTop: 70, paddingHorizontal: 40 }}>
      <MaterialIcons name={icon} size={52} color={c.muted} style={{ marginBottom: 16 }} />
      <Text style={{ fontSize: 18, fontWeight: "700", color: c.text, marginBottom: 8 }}>{title}</Text>
      <Text style={{ fontSize: 14, color: c.muted, textAlign: "center", lineHeight: 22 }}>{text}</Text>
    </View>
  );
}

export default function LibraryScreen() {
  const { top: topInset } = useSafeAreaInsets();
  const { get } = useApi();
  const { favouriteIds, count: favCount, loadFavourites } = useFavourites();
  const { playlists, loadPlaylists, createPlaylist, deletePlaylist } = usePlaylists();
  const { localSongs, totalLocal, permissionStatus, requestPermission } = useLocalSongs();
  const { isOnline } = useNetwork();
  const bottomInset = usePlayerInset();
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [tab, setTab] = useState<Tab>("Playlists");
  const [songs, setSongs] = useState<Song[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [favDetails, setFavDetails] = useState<Map<string, Song>>(new Map());
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [sheetSong, setSheetSong] = useState<Song | null>(null);

  const loadSongs = useCallback(async (signal?: AbortSignal) => {
    try {
      const d = await get<unknown>(API.SONGS_URL, { signal });
      if (!signal?.aborted) setSongs(normalizeSongs(d));
    } catch (e) { if ((e as { name?: string })?.name === "AbortError") return; }
  }, [get]);

  const loadAlbums = useCallback(async (signal?: AbortSignal) => {
    try {
      const d = await get<unknown>(API.ALBUMS_URL, { signal });
      if (!signal?.aborted) setAlbums(normalizeAlbums(d));
    } catch (e) { if ((e as { name?: string })?.name === "AbortError") return; }
  }, [get]);

  const loadMissingFavDetails = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    const fetched = await Promise.all(ids.map(id => get<Record<string, unknown>>(API.SONG_BY_ID(id)).then(d => normalizeSong({ ...d, id: d?.id ?? id })).catch(() => null)));
    setFavDetails(prev => { const next = new Map(prev); for (const s of fetched) { if (s && s._id) next.set(s._id, s); } return next; });
  }, [get]);

  useEffect(() => {
    const ctrl = new AbortController();
    loadSongs(ctrl.signal);
    loadAlbums(ctrl.signal);
    return () => ctrl.abort();
  }, [loadSongs, loadAlbums]);

  useEffect(() => {
    if (!favouriteIds.size) return;
    const known = new Set(songs.map(s => s._id));
    const missing: string[] = [];
    for (const id of favouriteIds) { if (!id) continue; if (!known.has(id) && !favDetails.has(id)) missing.push(id); }
    if (missing.length) loadMissingFavDetails(missing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favouriteIds, songs]);

  async function onRefresh() {
    setRefreshing(true);
    try { await Promise.all([loadSongs(), loadAlbums(), loadPlaylists(), loadFavourites()]); } finally { setRefreshing(false); }
  }

  async function handleCreatePlaylist() {
    const trimmed = newName.trim();
    if (!trimmed || creating) return;
    setCreating(true);
    try { await createPlaylist(trimmed); setNewName(""); setShowCreate(false); } catch (e) { Alert.alert("Error", e instanceof Error ? e.message : "Failed to create playlist"); } finally { setCreating(false); }
  }

  async function handleDeletePlaylist(id: string) {
    try { await deletePlaylist(id); } catch (e) { Alert.alert("Error", e instanceof Error ? e.message : "Failed to delete playlist"); }
  }

  const recent = useMemo(() => songs.slice(0, 30), [songs]);

  const favSongs = useMemo<Song[]>(() => {
    if (!favouriteIds.size) return [];
    const byId = new Map<string, Song>();
    for (const s of songs) byId.set(s._id, s);
    for (const [id, s] of favDetails) if (!byId.has(id)) byId.set(id, s);
    const out: Song[] = [];
    for (const id of favouriteIds) { const s = byId.get(id); if (s) out.push(s); }
    return out;
  }, [favouriteIds, songs, favDetails]);

  return (
    <View style={styles.container}>
      <StatusBar style={c.statusBar} />
      <LinearGradient colors={c.isDark ? ["#0a0a00", "#0d0d0d"] : ["#f5f5d0", "#f5f5f5"]} style={StyleSheet.absoluteFill} />

      <View style={[styles.header, { paddingTop: topInset + 12 }]}>
        <Text style={styles.headerTitle}>Library</Text>
      </View>

      <View style={styles.statsRow}>
        {([
          { num: songs.length, label: "Songs", icon: "music-note" as MIName },
          { num: playlists.length, label: "Playlists", icon: "queue-music" as MIName },
          { num: favCount, label: "Favourites", icon: "favorite" as MIName },
          { num: totalLocal, label: "On Device", icon: "phone-android" as MIName },
        ]).map((s) => (
          <BlurView key={s.label} intensity={20} tint={c.tint} style={styles.statCard}>
            <MaterialIcons name={s.icon} size={14} color={LIME} style={{ marginBottom: 2 }} />
            <Text style={styles.statNum}>{s.num}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </BlurView>
        ))}
      </View>

      <View style={styles.tabBar}>
        {TABS.map(t => (
          <Pressable key={t} style={styles.tabBarItem} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
            {tab === t && <View style={styles.tabUnderline} />}
          </Pressable>
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomInset + 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={LIME} colors={[LIME]} />}
      >
        {tab === "Playlists" && (
          <View style={{ paddingHorizontal: 16 }}>
            {showCreate ? (
              <View style={styles.createRow}>
                <TextInput autoFocus value={newName} onChangeText={setNewName} placeholder="Playlist name…" placeholderTextColor={c.muted} style={styles.createInput} onSubmitEditing={handleCreatePlaylist} returnKeyType="done" />
                <Pressable onPress={handleCreatePlaylist} disabled={!newName.trim() || creating} style={({ pressed }) => [styles.createOk, pressed && { opacity: 0.7 }, (!newName.trim() || creating) && { opacity: 0.5 }]}>
                  <Text style={styles.createOkText}>{creating ? "…" : "Create"}</Text>
                </Pressable>
                <Pressable onPress={() => { setShowCreate(false); setNewName(""); }} style={{ padding: 10 }}>
                  <MaterialIcons name="close" size={18} color={c.muted} />
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={() => setShowCreate(true)} style={({ pressed }) => [styles.newPlaylistBtn, pressed && { opacity: 0.7 }]}>
                <MaterialIcons name="add" size={20} color={LIME} />
                <Text style={styles.newPlaylistText}>New Playlist</Text>
              </Pressable>
            )}
            {playlists.length === 0
              ? <EmptyState icon="queue-music" title="No playlists" text="Create a playlist to organise your music." />
              : playlists.map(pl => <PlaylistCard key={pl.id} pl={pl} onDelete={handleDeletePlaylist} />)
            }
          </View>
        )}

        {tab === "Recent" && (
          recent.length > 0
            ? <View style={styles.songList}>{recent.map((s, i) => <SongRow key={s._id ?? String(i)} song={s} index={i} queue={recent} onAdd={setSheetSong} />)}</View>
            : <EmptyState icon="music-note" title="No songs yet" text="Songs you play will appear here." />
        )}

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

        {tab === "Favourites" && (
          favSongs.length > 0
            ? <View style={styles.songList}>{favSongs.map((s, i) => <SongRow key={s._id ?? String(i)} song={s} index={i} queue={favSongs} onAdd={setSheetSong} />)}</View>
            : <EmptyState icon="favorite-border" title="No favourites yet" text="Tap the heart on any song to save it here." />
        )}

        {tab === "On Device" && (
          <View style={{ paddingHorizontal: 16 }}>
            {!isOnline && (
              <View style={styles.offlineBadge}>
                <MaterialIcons name="wifi-off" size={14} color="#000" />
                <Text style={styles.offlineBadgeText}>Offline mode · playing from device</Text>
              </View>
            )}
            {permissionStatus !== "granted" ? (
              <View style={styles.emptyState}>
                <MaterialIcons name="folder" size={52} color={c.muted} style={{ marginBottom: 16 }} />
                <Text style={styles.emptyTitle}>Storage Access Required</Text>
                <Text style={styles.emptyText}>Allow Muves to read your music files to play songs stored on your device.</Text>
                <Pressable style={({ pressed }) => [styles.permBtn, pressed && { opacity: 0.8 }]} onPress={requestPermission}>
                  <Text style={styles.permBtnText}>Allow Access</Text>
                </Pressable>
              </View>
            ) : localSongs.length > 0
              ? localSongs.map((s, i) => <SongRow key={s._id ?? String(i)} song={s} index={i} queue={localSongs} onAdd={setSheetSong} />)
              : <EmptyState icon="music-off" title="No audio files found" text="No music files were found on your device storage." />
            }
          </View>
        )}
      </ScrollView>

      <AddToPlaylistSheet visible={!!sheetSong} songId={sheetSong?._id ?? null} songTitle={sheetSong?.title} onClose={() => setSheetSong(null)} />
    </View>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    header: { paddingHorizontal: 20, paddingBottom: 16 },
    headerTitle: { fontSize: 28, fontWeight: "800", color: c.text },

    statsRow: { flexDirection: "row", paddingHorizontal: 20, gap: 8, marginBottom: 14 },
    statCard: { flex: 1, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 6, alignItems: "center", overflow: "hidden", borderWidth: 1, borderColor: c.cardBorder },
    statNum: { fontSize: 15, fontWeight: "800", color: LIME },
    statLabel: { fontSize: 10, color: c.muted, marginTop: 1, fontWeight: "600" },

    tabBar: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: c.cardBorder, marginBottom: 16 },
    tabBarItem: { flex: 1, alignItems: "center", paddingVertical: 12, position: "relative" },
    tabUnderline: { position: "absolute", bottom: 0, left: "15%", right: "15%", height: 2, borderRadius: 2, backgroundColor: LIME },
    tabText: { fontSize: 13, fontWeight: "700", color: c.muted },
    tabTextActive: { color: c.text },

    newPlaylistBtn: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, marginBottom: 12, borderWidth: 1, borderStyle: "dashed", borderColor: LIME },
    newPlaylistText: { fontSize: 15, fontWeight: "700", color: LIME },
    createRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
    createInput: { flex: 1, height: 46, paddingHorizontal: 14, backgroundColor: c.inputBg, borderRadius: 12, borderWidth: 1, borderColor: LIME, color: c.text, fontSize: 14 },
    createOk: { height: 46, paddingHorizontal: 16, borderRadius: 12, backgroundColor: LIME, alignItems: "center", justifyContent: "center" },
    createOkText: { fontWeight: "800", color: "#000", fontSize: 14 },

    songList: { paddingHorizontal: 16 },
    albumGrid: { paddingHorizontal: 16 },
    albumRow: { flexDirection: "row", gap: 14, marginBottom: 16 },

    offlineBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: LIME, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 14, alignSelf: "flex-start" },
    offlineBadgeText: { fontSize: 12, fontWeight: "700", color: "#000" },

    permBtn: { marginTop: 20, backgroundColor: LIME, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 28 },
    permBtnText: { fontWeight: "800", color: "#000", fontSize: 14 },

    emptyState: { alignItems: "center", paddingTop: 70, paddingHorizontal: 40 },
    emptyTitle: { fontSize: 18, fontWeight: "700", color: c.text, marginBottom: 8 },
    emptyText: { fontSize: 14, color: c.muted, textAlign: "center", lineHeight: 22 },
  });
}
