import {
  Animated, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Text, TouchableWithoutFeedback, View,
} from "react-native";
import { Image } from "expo-image";
import { MaterialIcons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useApi } from "@/hooks/useApi";
import { usePlayer, Song } from "@/context/PlayerContext";
import { useFavourites } from "@/context/FavouritesContext";
import { API } from "@/constants/api";
import { normalizeSongs } from "@/utils/normalize";
import { usePlayerInset } from "@/hooks/usePlayerInset";
import AddToPlaylistSheet from "@/components/AddToPlaylistSheet";

// ─── Palette ──────────────────────────────────────────────────────────────────
const P = {
  bg:      "#F5F5F5",
  surface: "#FFFFFF",
  red:     "#E53935",
  text:    "#1A1A1A",
  sub:     "#9E9E9E",
  border:  "#EEEEEE",
  divider: "#F0F0F0",
  lime:    "#E53935",
};

function fmt(sec: number) {
  if (!sec) return "";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function AlbumSkeleton({ topInset }: { topInset: number }) {
  const shimmer = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, [shimmer]);

  const block = { backgroundColor: "#EBEBEB", borderRadius: 8 } as const;

  return (
    <Animated.View style={{ opacity: shimmer, paddingTop: topInset + 68, paddingHorizontal: 20 }}>
      <View style={{ alignItems: "center", gap: 12, marginBottom: 28 }}>
        <View style={{ width: 140, height: 140, borderRadius: 16, backgroundColor: "#EBEBEB" }} />
        <View style={{ ...block, width: 160, height: 18 }} />
        <View style={{ ...block, width: 100, height: 13 }} />
        <View style={{ ...block, width: 120, height: 42, borderRadius: 24 }} />
      </View>
      {Array.from({ length: 5 }).map((_, i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 12, borderBottomWidth: 1, borderBottomColor: P.divider }}>
          <View style={{ ...block, width: 42, height: 42, borderRadius: 10 }} />
          <View style={{ flex: 1, gap: 6 }}>
            <View style={{ ...block, width: "65%", height: 13 }} />
            <View style={{ ...block, width: "40%", height: 10 }} />
          </View>
          <View style={{ ...block, width: 28, height: 10 }} />
        </View>
      ))}
    </Animated.View>
  );
}

// ─── Song options sheet ────────────────────────────────────────────────────────
function SongOptionsSheet({ song, visible, onClose, onAddToQueue, onPlayNext, onAddToPlaylist, isLiked, onToggleLike }: {
  song: Song | null;
  visible: boolean;
  onClose: () => void;
  onAddToQueue: () => void;
  onPlayNext: () => void;
  onAddToPlaylist: () => void;
  isLiked: boolean;
  onToggleLike: () => void;
}) {
  const slideY = useRef(new Animated.Value(400)).current;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.spring(slideY, { toValue: 0, useNativeDriver: true, tension: 70, friction: 12 }).start();
    } else {
      Animated.timing(slideY, { toValue: 400, duration: 240, useNativeDriver: true })
        .start(() => setMounted(false));
    }
  }, [visible]);

  if (!mounted && !visible) return null;

  const OPTIONS = [
    { icon: "playlist-play",  label: "Play Next",         action: onPlayNext },
    { icon: "queue-music",    label: "Add to Queue",      action: onAddToQueue },
    { icon: "playlist-add",   label: "Add to Playlist",   action: onAddToPlaylist },
    { icon: isLiked ? "favorite" : "favorite-border", label: isLiked ? "Remove from favourites" : "Add to favourites", action: onToggleLike },
  ] as const;

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={sheet.backdrop} />
      </TouchableWithoutFeedback>
      <Animated.View style={[sheet.panel, { transform: [{ translateY: slideY }] }]}>
        <View style={sheet.handle} />

        {/* Song info header */}
        {song && (
          <View style={sheet.songHeader}>
            <View style={sheet.songThumb}>
              {song.coverImage
                ? <Image source={{ uri: song.coverImage }} style={StyleSheet.absoluteFill} contentFit="cover" />
                : <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center", backgroundColor: "#FFF0F0" }]}>
                    <MaterialIcons name="music-note" size={18} color={P.red} />
                  </View>
              }
            </View>
            <View style={{ flex: 1 }}>
              <Text style={sheet.songTitle} numberOfLines={1}>{song.title}</Text>
              <Text style={sheet.songArtist} numberOfLines={1}>{song.artist}</Text>
            </View>
          </View>
        )}

        <View style={sheet.divider} />

        {OPTIONS.map(({ icon, label, action }) => (
          <Pressable
            key={label}
            style={({ pressed }) => [sheet.option, pressed && { backgroundColor: "#F5F5F5" }]}
            onPress={() => { action(); onClose(); }}
          >
            <MaterialIcons
              name={icon as React.ComponentProps<typeof MaterialIcons>["name"]}
              size={22}
              color={label.includes("favourites") && isLiked ? P.red : P.text}
            />
            <Text style={[sheet.optionLabel, label.includes("favourites") && isLiked && { color: P.red }]}>
              {label}
            </Text>
          </Pressable>
        ))}
      </Animated.View>
    </Modal>
  );
}

const sheet = StyleSheet.create({
  backdrop:   { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.38)" },
  panel: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: P.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingBottom: 32,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 12 },
      android: { elevation: 16 },
    }),
  },
  handle:     { width: 36, height: 4, borderRadius: 2, backgroundColor: "#E0E0E0", alignSelf: "center", marginTop: 12, marginBottom: 6 },
  songHeader: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 14 },
  songThumb:  { width: 46, height: 46, borderRadius: 10, overflow: "hidden", backgroundColor: "#F0F0F0" },
  songTitle:  { fontSize: 14, fontWeight: "700", color: P.text },
  songArtist: { fontSize: 12, color: P.sub, marginTop: 2 },
  divider:    { height: 1, backgroundColor: P.divider, marginBottom: 4 },
  option:     { flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 20, paddingVertical: 16 },
  optionLabel:{ fontSize: 15, color: P.text, fontWeight: "500" },
});

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function AlbumScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { get } = useApi();
  const { playSong, currentSong, isPlaying, addToQueue, playNext } = usePlayer();
  const { isFavourite, toggleFavourite } = useFavourites();
  const bottomInset = usePlayerInset();
  const { top: topInset } = useSafeAreaInsets();

  const [songs,   setSongs]   = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  // Song options sheet state
  const [sheetSong,      setSheetSong]      = useState<Song | null>(null);
  const [sheetVisible,   setSheetVisible]   = useState(false);
  const [playlistSong,   setPlaylistSong]   = useState<Song | null>(null);
  const [playlistVisible, setPlaylistVisible] = useState(false);

  useEffect(() => {
    if (!id) return;
    const ctrl = new AbortController();
    setLoading(true);
    get<unknown>(API.ALBUM_SONGS(id), { signal: ctrl.signal })
      .then((d) => {
        if (ctrl.signal.aborted) return;
        setSongs(normalizeSongs(d));
        setError(null);
      })
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name === "AbortError") return;
        setError("Failed to load album songs.");
      })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    return () => ctrl.abort();
  }, [id, get]);

  const albumCover  = songs[0]?.coverImage ?? null;
  const albumTitle  = songs[0]?.album ?? "Album";
  const albumArtist = songs[0]?.artist ?? "";

  function playAll() {
    if (!songs.length) return;
    playSong(songs[0], songs);
    router.push("/player");
  }

  function addAllToQueue() {
    songs.forEach(s => addToQueue(s));
  }

  function openSheet(song: Song) {
    setSheetSong(song);
    setSheetVisible(true);
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* ── Fixed header ── */}
      <View style={[styles.header, { paddingTop: topInset + 10 }]}>
        <Pressable
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityLabel="Go back"
        >
          <MaterialIcons name="arrow-back-ios" size={20} color={P.text} />
        </Pressable>

        <Text style={styles.headerTitle}>Detail Album</Text>

        <Pressable
          style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.6 }]}
          accessibilityLabel="Share album"
        >
          <MaterialIcons name="share" size={20} color={P.sub} />
        </Pressable>
      </View>

      {loading ? (
        <AlbumSkeleton topInset={topInset} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: bottomInset + 32 }}
        >
          {/* ── Hero ── */}
          <View style={styles.hero}>
            <View style={styles.coverWrap}>
              {albumCover ? (
                <Image source={{ uri: albumCover }} style={StyleSheet.absoluteFill} contentFit="cover" alt={albumTitle} />
              ) : (
                <View style={[StyleSheet.absoluteFill, styles.noArt]}>
                  <MaterialIcons name="album" size={64} color={P.sub} />
                </View>
              )}
            </View>

            <Text style={styles.albumTitle} numberOfLines={2}>{albumTitle}</Text>
            {!!albumArtist && <Text style={styles.albumArtist}>{albumArtist}</Text>}

            {songs.length > 0 && (
              <View style={styles.heroActions}>
                <Pressable
                  style={({ pressed }) => [styles.playAllBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
                  onPress={playAll}
                >
                  <MaterialIcons name="play-arrow" size={22} color={P.surface} />
                  <Text style={styles.playAllText}>Play All</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [styles.addAllBtn, pressed && { opacity: 0.75, transform: [{ scale: 0.97 }] }]}
                  onPress={addAllToQueue}
                >
                  <MaterialIcons name="queue-music" size={20} color={P.red} />
                  <Text style={styles.addAllText}>Add to Queue</Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* ── Song list ── */}
          {error ? (
            <View style={styles.center}>
              <Text style={{ color: P.sub, fontSize: 14 }}>{error}</Text>
            </View>
          ) : songs.length === 0 ? (
            <View style={styles.center}>
              <MaterialIcons name="album" size={44} color={P.sub} style={{ marginBottom: 12 }} />
              <Text style={{ color: P.text, fontWeight: "700", fontSize: 16 }}>No songs in this album</Text>
            </View>
          ) : (
            <>
              <View style={styles.listHeader}>
                <Text style={styles.listHeaderTitle}>List Song</Text>
                <Text style={styles.songCount}>{songs.length} songs</Text>
              </View>

              {songs.map((song, i) => {
                const isActive = currentSong?._id === song._id;
                const liked    = isFavourite(song._id);
                return (
                  <Pressable
                    key={song._id ?? String(i)}
                    style={({ pressed }) => [styles.row, pressed && { backgroundColor: "#F9F9F9" }]}
                    onPress={() => { playSong(song, songs); router.push("/player"); }}
                  >
                    {/* Thumbnail */}
                    <View style={styles.thumb}>
                      {song.coverImage ? (
                        <Image source={{ uri: song.coverImage }} style={StyleSheet.absoluteFill} contentFit="cover" />
                      ) : (
                        <View style={[StyleSheet.absoluteFill, styles.noThumb]}>
                          <MaterialIcons name="music-note" size={16} color={P.red} />
                        </View>
                      )}
                      {isActive && (
                        <View style={styles.thumbOverlay}>
                          <MaterialIcons name={isPlaying ? "graphic-eq" : "pause"} size={14} color={P.surface} />
                        </View>
                      )}
                    </View>

                    {/* Info */}
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowTitle, isActive && { color: P.red }]} numberOfLines={1}>{song.title}</Text>
                      <Text style={styles.rowArtist} numberOfLines={1}>{song.artist}</Text>
                    </View>

                    {/* Duration */}
                    {!!song.duration && (
                      <Text style={styles.rowDuration}>{fmt(song.duration)}</Text>
                    )}

                    {/* Like */}
                    <Pressable
                      hitSlop={12}
                      onPress={() => toggleFavourite(song._id)}
                      accessibilityLabel={liked ? "Remove from favourites" : "Add to favourites"}
                    >
                      <MaterialIcons name={liked ? "favorite" : "favorite-border"} size={18} color={liked ? P.red : P.sub} />
                    </Pressable>

                    {/* Three-dot menu */}
                    <Pressable
                      hitSlop={12}
                      onPress={() => openSheet(song)}
                      accessibilityLabel="Song options"
                    >
                      <MaterialIcons name="more-vert" size={20} color={P.sub} />
                    </Pressable>
                  </Pressable>
                );
              })}

            </>
          )}
        </ScrollView>
      )}

      {/* ── Song options sheet ── */}
      <SongOptionsSheet
        song={sheetSong}
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onPlayNext={() => { if (sheetSong) playNext(sheetSong); }}
        onAddToQueue={() => { if (sheetSong) addToQueue(sheetSong); }}
        onAddToPlaylist={() => {
          if (sheetSong) { setPlaylistSong(sheetSong); setPlaylistVisible(true); }
        }}
        isLiked={sheetSong ? isFavourite(sheetSong._id) : false}
        onToggleLike={() => { if (sheetSong) toggleFavourite(sheetSong._id); }}
      />

      <AddToPlaylistSheet
        visible={playlistVisible}
        songId={playlistSong?._id ?? null}
        songTitle={playlistSong?.title}
        onClose={() => setPlaylistVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.bg },

  // Header
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingBottom: 12,
    backgroundColor: P.bg, zIndex: 10,
  },
  backBtn:     { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 16, fontWeight: "800", color: P.text },
  shareBtn:    { width: 40, height: 40, alignItems: "center", justifyContent: "center" },

  // Hero
  hero: { alignItems: "center", paddingVertical: 24, paddingHorizontal: 24 },
  coverWrap: {
    width: 140, height: 140, borderRadius: 16,
    overflow: "hidden", backgroundColor: "#E8E8E8", marginBottom: 18,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20 },
      android: { elevation: 10 },
    }),
  },
  noArt:       { alignItems: "center", justifyContent: "center", backgroundColor: "#F0F0F0" },
  albumTitle:  { fontSize: 22, fontWeight: "900", color: P.text, textAlign: "center", marginBottom: 6, letterSpacing: -0.3 },
  albumArtist: { fontSize: 14, color: P.sub, marginBottom: 18 },
  heroActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  playAllBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: P.red, borderRadius: 30,
    paddingHorizontal: 28, paddingVertical: 13,
    ...Platform.select({
      ios: { shadowColor: P.red, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12 },
      android: { elevation: 8 },
    }),
  },
  playAllText: { fontSize: 15, fontWeight: "800", color: P.surface },

  // List header
  listHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: P.border, backgroundColor: P.bg,
  },
  listHeaderTitle: { fontSize: 16, fontWeight: "800", color: P.text },
  songCount:       { fontSize: 12, color: P.sub },

  // Song row
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 10, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: P.divider,
    backgroundColor: P.surface,
  },
  thumb:        { width: 42, height: 42, borderRadius: 10, overflow: "hidden", backgroundColor: "#F0F0F0" },
  noThumb:      { alignItems: "center", justifyContent: "center", backgroundColor: "#FFF0F0" },
  thumbOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(229,57,53,0.55)", alignItems: "center", justifyContent: "center" },
  rowTitle:     { fontSize: 13, fontWeight: "700", color: P.text, marginBottom: 2 },
  rowArtist:    { fontSize: 11, color: P.sub },
  rowDuration:  { fontSize: 12, color: P.sub, minWidth: 32, textAlign: "right" },

  // Add all button (inline, next to Play All)
  addAllBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: P.surface,
    borderRadius: 30, borderWidth: 1.5, borderColor: P.red,
    paddingHorizontal: 20, paddingVertical: 13,
    ...Platform.select({
      ios: { shadowColor: P.red, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.1, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  addAllText: { fontSize: 14, fontWeight: "700", color: P.red },

  center: { alignItems: "center", paddingTop: 60 },
});
