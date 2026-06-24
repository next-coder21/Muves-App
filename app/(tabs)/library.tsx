import {
  Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { Image } from "expo-image";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
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
import { useAppAlert } from "@/context/AlertContext";

type Album = { _id: string; title: string; artist: string; coverImage?: string; songCount?: number; year?: number };

// Matches Home / Search / Explore palette exactly
const P = {
  bg: "#F5F5F5",
  surface: "#FFFFFF",
  red: "#E53935",
  redLight: "#FDECEA",
  text: "#1A1A1A",
  sub: "#9E9E9E",
  border: "#EEEEEE",
  shadow: "rgba(0,0,0,0.06)",
};

const TABS = ["Playlists", "Recent", "Albums", "Favourites"] as const;
type Tab = (typeof TABS)[number];
type MIName = React.ComponentProps<typeof MaterialIcons>["name"];

const TAB_ICONS: Record<Tab, MIName> = {
  Playlists: "queue-music",
  Recent: "history",
  Albums: "album",
  Favourites: "favorite",
};

// ─── Song row ─────────────────────────────────────────────────────────────────
function SongRow({ song, index, queue, onAdd }: { song: Song; index: number; queue: Song[]; onAdd: (s: Song) => void }) {
  const { playSong, currentSong, isPlaying } = usePlayer();
  const { isFavourite, toggleFavourite } = useFavourites();
  const router = useRouter();
  const active = currentSong?._id === song._id;
  const liked = isFavourite(song._id);
  return (
    <Pressable
      style={({ pressed }) => [{
        flexDirection: "row", alignItems: "center", paddingVertical: 10,
        borderRadius: 14, paddingHorizontal: 8, marginBottom: 2, gap: 6,
      }, pressed && { backgroundColor: "rgba(0,0,0,0.04)" }]}
      onPress={() => { playSong(song, queue.length ? queue : [song]); router.push("/player"); }}
    >
      {active
        ? <MaterialIcons name={isPlaying ? "play-arrow" : "pause"} size={16} color={P.red} style={{ width: 22, textAlign: "center" }} />
        : <Text style={{ width: 28, fontSize: 13, color: P.sub, fontWeight: "700", textAlign: "center" }}>{index + 1}</Text>
      }
      <View style={{ width: 52, height: 52, borderRadius: 14, overflow: "hidden", backgroundColor: P.border, marginRight: 6 }}>
        {song.coverImage
          ? <Image source={{ uri: song.coverImage }} style={StyleSheet.absoluteFill} />
          : <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center", backgroundColor: P.redLight }]}>
              <MaterialIcons name="music-note" size={20} color={P.red} />
            </View>
        }
        {active && (
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(229,57,53,0.15)", alignItems: "center", justifyContent: "center" }]}>
            <MaterialIcons name={isPlaying ? "play-arrow" : "pause"} size={14} color={P.red} />
          </View>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[{ fontSize: 14, fontWeight: "700", color: P.text }, active && { color: P.red }]} numberOfLines={1}>{song.title}</Text>
        <Text style={{ fontSize: 12, color: P.sub, marginTop: 3 }} numberOfLines={1}>{song.artist}</Text>
      </View>
      <Pressable hitSlop={12} onPress={() => toggleFavourite(song._id)} style={{ padding: 4 }}>
        <MaterialIcons name={liked ? "favorite" : "favorite-border"} size={20} color={liked ? P.red : P.sub} />
      </Pressable>
      <Pressable hitSlop={12} onPress={() => onAdd(song)} style={{ padding: 4 }}>
        <MaterialIcons name="playlist-add" size={22} color={P.sub} />
      </Pressable>
    </Pressable>
  );
}

// ─── Album card ───────────────────────────────────────────────────────────────
function AlbumCard({ album }: { album: Album }) {
  const router = useRouter();
  const { currentSong } = usePlayer();
  const isAlbumPlaying = !!currentSong && currentSong.album === album.title;
  return (
    <Pressable style={({ pressed }) => [{ flex: 1 }, pressed && { opacity: 0.75 }]} onPress={() => router.push(`/album/${album._id}`)}>
      <View style={{ aspectRatio: 1, borderRadius: 18, overflow: "hidden", backgroundColor: P.border, marginBottom: 8 }}>
        {album.coverImage
          ? <Image source={{ uri: album.coverImage }} style={StyleSheet.absoluteFill} />
          : <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center", backgroundColor: P.redLight }]}>
              <MaterialIcons name="album" size={40} color={P.red} />
            </View>
        }
        {album.songCount !== undefined && (
          <View style={{ position: "absolute", bottom: 8, left: 8, backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 }}>
            <Text style={{ fontSize: 10, color: "#fff", fontWeight: "600" }}>{album.songCount} songs</Text>
          </View>
        )}
        {isAlbumPlaying && (
          <>
            <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, borderRadius: 18, borderWidth: 2, borderColor: P.red }} />
            <View style={{ position: "absolute", top: 8, right: 8, width: 24, height: 24, borderRadius: 12, backgroundColor: P.red, alignItems: "center", justifyContent: "center" }}>
              <MaterialIcons name="graphic-eq" size={14} color="#fff" />
            </View>
          </>
        )}
      </View>
      <Text style={{ fontSize: 13, fontWeight: "700", color: isAlbumPlaying ? P.red : P.text }} numberOfLines={1}>{album.title}</Text>
      <Text style={{ fontSize: 12, color: P.sub, marginTop: 2 }} numberOfLines={1}>{album.artist}</Text>
    </Pressable>
  );
}

// ─── Playlist card ────────────────────────────────────────────────────────────
function PlaylistCard({ pl, onDelete }: { pl: Playlist; onDelete: (id: string) => void }) {
  const router = useRouter();
  const { showAlert } = useAppAlert();
  return (
    <Pressable
      onPress={() => router.push(`/playlist/${pl.id}`)}
      style={({ pressed }) => [{
        flexDirection: "row", alignItems: "center", gap: 14,
        padding: 14, borderRadius: 16, marginBottom: 8,
        backgroundColor: P.surface, borderWidth: 1, borderColor: P.border,
      }, pressed && { opacity: 0.75 }]}
    >
      <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: P.redLight, alignItems: "center", justifyContent: "center" }}>
        <MaterialIcons name="queue-music" size={28} color={P.red} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: "700", color: P.text }} numberOfLines={1}>{pl.name}</Text>
        <Text style={{ fontSize: 12, color: P.sub, marginTop: 3 }}>{pl.songCount} {pl.songCount === 1 ? "song" : "songs"}</Text>
      </View>
      <Pressable
        hitSlop={12}
        onPress={() => showAlert("Delete Playlist", `Delete "${pl.name}"?`, [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => onDelete(pl.id) }])}
        style={({ pressed }) => [{ padding: 6 }, pressed && { opacity: 0.5 }]}
      >
        <MaterialIcons name="delete-outline" size={20} color={P.sub} />
      </Pressable>
    </Pressable>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState({ icon, title, text }: { icon: MIName; title: string; text: string }) {
  return (
    <View style={{ alignItems: "center", paddingTop: 60, paddingHorizontal: 40 }}>
      <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: P.redLight, alignItems: "center", justifyContent: "center", marginBottom: 18, borderWidth: 1.5, borderColor: "rgba(229,57,53,0.2)" }}>
        <MaterialIcons name={icon} size={40} color={P.red} />
      </View>
      <Text style={{ fontSize: 17, fontWeight: "800", color: P.text, marginBottom: 8, letterSpacing: -0.4 }}>{title}</Text>
      <Text style={{ fontSize: 14, color: P.sub, textAlign: "center", lineHeight: 22 }}>{text}</Text>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function LibraryScreen() {
  const { top: topInset } = useSafeAreaInsets();
  const { get } = useApi();
  const { favouriteIds, count: favCount, loadFavourites } = useFavourites();
  const { playlists, loadPlaylists, createPlaylist, deletePlaylist } = usePlaylists();
  const { totalLocal } = useLocalSongs();
  const bottomInset = usePlayerInset();
  const { showAlert } = useAppAlert();

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
    const fetched = await Promise.all(ids.map(id =>
      get<Record<string, unknown>>(API.SONG_BY_ID(id))
        .then(d => normalizeSong({ ...d, id: d?.id ?? id }))
        .catch(() => null)
    ));
    setFavDetails(prev => {
      const next = new Map(prev);
      for (const s of fetched) { if (s && s._id) next.set(s._id, s); }
      return next;
    });
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
    for (const id of favouriteIds) {
      if (!id) continue;
      if (!known.has(id) && !favDetails.has(id)) missing.push(id);
    }
    if (missing.length) loadMissingFavDetails(missing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favouriteIds, songs]);

  async function onRefresh() {
    setRefreshing(true);
    try { await Promise.all([loadSongs(), loadAlbums(), loadPlaylists(), loadFavourites()]); }
    finally { setRefreshing(false); }
  }

  async function handleCreatePlaylist() {
    const trimmed = newName.trim();
    if (!trimmed || creating) return;
    setCreating(true);
    try { await createPlaylist(trimmed); setNewName(""); setShowCreate(false); }
    catch (e) { showAlert("Error", e instanceof Error ? e.message : "Failed to create playlist"); }
    finally { setCreating(false); }
  }

  async function handleDeletePlaylist(id: string) {
    try { await deletePlaylist(id); }
    catch (e) { showAlert("Error", e instanceof Error ? e.message : "Failed to delete playlist"); }
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

  const STAT_ITEMS = [
    { num: songs.length, label: "Songs", icon: "music-note" as MIName },
    { num: playlists.length, label: "Playlists", icon: "queue-music" as MIName },
    { num: favCount, label: "Favourites", icon: "favorite" as MIName },
    { num: totalLocal, label: "Local", icon: "folder" as MIName },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={{ paddingTop: topInset + 16, paddingHorizontal: 20, paddingBottom: 16 }}>
        <Text style={{ fontSize: 30, fontWeight: "900", color: P.text, letterSpacing: -1 }}>Library</Text>
      </View>

      {/* Stats */}
      <View style={{ flexDirection: "row", paddingHorizontal: 16, gap: 8, marginBottom: 20 }}>
        {STAT_ITEMS.map((s) => (
          <View key={s.label} style={styles.statCard}>
            <View style={styles.statIconWrap}>
              <MaterialIcons name={s.icon} size={14} color={P.red} />
            </View>
            <Text style={styles.statNum}>{s.num}</Text>
            <Text style={styles.statLabel}>{s.label.toUpperCase()}</Text>
          </View>
        ))}
      </View>

      {/* Tab bar — underline style matching Home */}
      <View style={{ marginBottom: 16 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 28, flexDirection: "row", alignItems: "flex-end" }}
        >
          {TABS.map(t => {
            const active = tab === t;
            return (
              <Pressable key={t} onPress={() => setTab(t)} style={{ paddingBottom: 10, alignItems: "center" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <MaterialIcons name={TAB_ICONS[t]} size={13} color={active ? P.text : P.sub} />
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>{t}</Text>
                </View>
                {active && <View style={styles.tabUnderline} />}
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={{ height: 1, backgroundColor: P.border, marginTop: -1 }} />
      </View>

      {/* Content */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomInset + 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={P.red} colors={[P.red]} />}
      >
        {/* Playlists tab */}
        {tab === "Playlists" && (
          <View style={{ paddingHorizontal: 16 }}>
            {showCreate ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <TextInput
                  autoFocus
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="Playlist name…"
                  placeholderTextColor={P.sub}
                  style={{ flex: 1, height: 46, paddingHorizontal: 14, backgroundColor: P.surface, borderRadius: 14, borderWidth: 1, borderColor: P.border, color: P.text, fontSize: 14 }}
                  onSubmitEditing={handleCreatePlaylist}
                  returnKeyType="done"
                />
                <Pressable
                  onPress={handleCreatePlaylist}
                  disabled={!newName.trim() || creating}
                  style={({ pressed }) => [{ height: 46, paddingHorizontal: 16, borderRadius: 14, backgroundColor: P.red, alignItems: "center", justifyContent: "center" }, pressed && { opacity: 0.8 }, (!newName.trim() || creating) && { opacity: 0.5 }]}
                >
                  <Text style={{ fontWeight: "800", color: "#fff", fontSize: 14 }}>{creating ? "…" : "Create"}</Text>
                </Pressable>
                <Pressable onPress={() => { setShowCreate(false); setNewName(""); }} style={{ padding: 10 }}>
                  <MaterialIcons name="close" size={18} color={P.sub} />
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={() => setShowCreate(true)}
                style={({ pressed }) => [styles.newPlaylistBtn, pressed && { opacity: 0.8 }]}
              >
                <View style={styles.newPlaylistIcon}>
                  <MaterialIcons name="add" size={20} color="#fff" />
                </View>
                <Text style={styles.newPlaylistText}>New Playlist</Text>
              </Pressable>
            )}
            {playlists.length === 0
              ? <EmptyState icon="queue-music" title="No playlists" text="Create a playlist to organise your music." />
              : playlists.map(pl => <PlaylistCard key={pl.id} pl={pl} onDelete={handleDeletePlaylist} />)
            }
          </View>
        )}

        {/* Recent tab */}
        {tab === "Recent" && (
          recent.length > 0
            ? <View style={{ paddingHorizontal: 16 }}>{recent.map((s, i) => <SongRow key={s._id ?? String(i)} song={s} index={i} queue={recent} onAdd={setSheetSong} />)}</View>
            : <EmptyState icon="history" title="No songs yet" text="Songs you play will appear here." />
        )}

        {/* Albums tab */}
        {tab === "Albums" && (
          albums.length > 0
            ? <View style={{ paddingHorizontal: 16 }}>
                {albums.map((a, i) => {
                  if (i % 2 !== 0) return null;
                  return (
                    <View key={a._id ?? String(i)} style={{ flexDirection: "row", gap: 14, marginBottom: 16 }}>
                      <AlbumCard album={a} />
                      {albums[i + 1] ? <AlbumCard album={albums[i + 1]} /> : <View style={{ flex: 1 }} />}
                    </View>
                  );
                })}
              </View>
            : <EmptyState icon="album" title="No albums" text="Albums will appear here once added." />
        )}

        {/* Favourites tab */}
        {tab === "Favourites" && (
          favSongs.length > 0
            ? <View style={{ paddingHorizontal: 16 }}>{favSongs.map((s, i) => <SongRow key={s._id ?? String(i)} song={s} index={i} queue={favSongs} onAdd={setSheetSong} />)}</View>
            : <EmptyState icon="favorite-border" title="No favourites yet" text="Tap the heart on any song to save it here." />
        )}
      </ScrollView>

      <AddToPlaylistSheet visible={!!sheetSong} songId={sheetSong?._id ?? null} songTitle={sheetSong?.title} onClose={() => setSheetSong(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  statCard: {
    flex: 1, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 6,
    alignItems: "center", gap: 3,
    backgroundColor: P.surface, borderWidth: 1, borderColor: P.border,
  },
  statIconWrap: {
    width: 30, height: 30, borderRadius: 9,
    backgroundColor: P.redLight, alignItems: "center", justifyContent: "center", marginBottom: 4,
  },
  statNum: { fontSize: 20, fontWeight: "900", color: P.text, letterSpacing: -0.5 },
  statLabel: { fontSize: 9, color: P.sub, fontWeight: "700", letterSpacing: 0.4 },

  tabText: { fontSize: 14, fontWeight: "600", color: P.sub },
  tabTextActive: { color: P.text, fontWeight: "800" },
  tabUnderline: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    height: 2.5, borderRadius: 2, backgroundColor: P.red,
  },

  newPlaylistBtn: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 16, borderRadius: 16, marginBottom: 14,
    backgroundColor: P.surface, borderWidth: 1, borderColor: P.border,
  },
  newPlaylistIcon: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: P.red, alignItems: "center", justifyContent: "center",
  },
  newPlaylistText: { fontSize: 15, fontWeight: "800", color: P.text },
});
