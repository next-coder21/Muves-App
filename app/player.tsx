import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  LayoutChangeEvent,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useEffect, useRef, useState, useMemo } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { usePlayer, Song } from "@/context/PlayerContext";
import { useFavourites } from "@/context/FavouritesContext";
import { useApi } from "@/hooks/useApi";
import { API } from "@/constants/api";
import AddToPlaylistSheet from "@/components/AddToPlaylistSheet";

const P = {
  bg:           "#F5F5F5",
  surface:      "#FFFFFF",
  red:          "#E53935",
  redLight:     "#FDECEA",
  text:         "#1A1A1A",
  sub:          "#9E9E9E",
  border:       "#EEEEEE",
  trackInactive:"#E0E0E0",
};

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const CENTER_ART = Math.round(SCREEN_W * 0.46);
const SIDE_ART   = Math.round(CENTER_ART * 0.82);
const FAN_H      = CENTER_ART + 36;

function fmt(s: number) {
  if (!s || isNaN(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// ─── Fan / carousel artwork ───────────────────────────────────────────────────
function FanArtwork({
  current, prev, next, scaleAnim,
}: {
  current: Song; prev?: Song; next?: Song; scaleAnim: Animated.Value;
}) {
  const leftSong  = prev ?? current;
  const rightSong = next ?? current;

  return (
    <View style={fanStyles.container}>
      <View style={fanStyles.sideWrap} pointerEvents="none">
        <View style={[fanStyles.sideCard, fanStyles.leftCard]}>
          {leftSong.coverImage
            ? <Image source={{ uri: leftSong.coverImage }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            : <View style={[StyleSheet.absoluteFill, fanStyles.noArt]}><MaterialIcons name="music-note" size={28} color={P.sub} /></View>
          }
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(255,255,255,0.35)" }]} />
        </View>
      </View>

      <Animated.View style={[fanStyles.centerWrap, { transform: [{ scale: scaleAnim }] }]}>
        <View style={fanStyles.centerCard}>
          {current.coverImage
            ? <Image source={{ uri: current.coverImage }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            : <View style={[StyleSheet.absoluteFill, fanStyles.noArt]}><MaterialIcons name="music-note" size={56} color={P.red + "88"} /></View>
          }
        </View>
      </Animated.View>

      <View style={fanStyles.sideWrap} pointerEvents="none">
        <View style={[fanStyles.sideCard, fanStyles.rightCard]}>
          {rightSong.coverImage
            ? <Image source={{ uri: rightSong.coverImage }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            : <View style={[StyleSheet.absoluteFill, fanStyles.noArt]}><MaterialIcons name="music-note" size={28} color={P.sub} /></View>
          }
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(255,255,255,0.35)" }]} />
        </View>
      </View>
    </View>
  );
}

const fanStyles = StyleSheet.create({
  container: {
    width: SCREEN_W, height: FAN_H,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    marginBottom: 20,
  },
  sideWrap:   { position: "absolute", zIndex: 0 },
  sideCard: {
    width: SIDE_ART, height: SIDE_ART, borderRadius: 18,
    overflow: "hidden", backgroundColor: "#E0E0E0",
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 12 },
      android: { elevation: 4 },
    }),
  },
  leftCard:  { transform: [{ rotate: "-14deg" }], right: SCREEN_W * 0.5 - 20 },
  rightCard: { transform: [{ rotate: "14deg" }],  left:  SCREEN_W * 0.5 - 20 },
  centerWrap: {
    zIndex: 2,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.22, shadowRadius: 20 },
      android: { elevation: 12 },
    }),
  },
  centerCard: { width: CENTER_ART, height: CENTER_ART, borderRadius: 22, overflow: "hidden", backgroundColor: "#E8E8E8" },
  noArt:      { alignItems: "center", justifyContent: "center", backgroundColor: "#F0F0F0" },
});

// ─── Flat seek bar ─────────────────────────────────────────────────────────────
const THUMB_R = 7;

function SeekBar({ progress, onSeek }: { progress: number; onSeek: (r: number) => void }) {
  const widthRef  = useRef(0);
  const offsetRef = useRef(0);

  const clamp = (pageX: number) =>
    Math.max(0, Math.min(1, (pageX - offsetRef.current) / widthRef.current));

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: (e) => {
        offsetRef.current = e.nativeEvent.pageX - e.nativeEvent.locationX;
        onSeek(clamp(e.nativeEvent.pageX));
      },
      onPanResponderMove: (e) => {
        onSeek(clamp(e.nativeEvent.pageX));
      },
    })
  ).current;

  return (
    <View
      style={seekStyles.container}
      onLayout={(e: LayoutChangeEvent) => { widthRef.current = e.nativeEvent.layout.width; }}
      {...pan.panHandlers}
    >
      {/* track */}
      <View style={seekStyles.track}>
        <View style={[seekStyles.fill, { width: `${progress * 100}%` as `${number}%` }]} />
      </View>
      {/* thumb */}
      <View style={[seekStyles.thumb, { left: `${progress * 100}%` as `${number}%` }]} />
    </View>
  );
}

const seekStyles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    justifyContent: "center",
  },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: P.trackInactive,
    overflow: "hidden",
  },
  fill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: P.red,
  },
  thumb: {
    position: "absolute",
    width:  THUMB_R * 2,
    height: THUMB_R * 2,
    borderRadius: THUMB_R,
    backgroundColor: P.red,
    top: "50%",
    marginTop: -THUMB_R,
    marginLeft: -THUMB_R,
    ...Platform.select({
      ios: { shadowColor: P.red, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 4 },
      android: { elevation: 4 },
    }),
  },
});

// ─── Lyrics types ─────────────────────────────────────────────────────────────
type LrcLine    = { time: number; text: string };
type LyricsData = { type: "lrc"; lines: LrcLine[] } | { type: "plain"; lines: string[] } | null;

// ─── Queue panel ──────────────────────────────────────────────────────────────
function QueuePanel({ queue, currentSong, onPlay }: { queue: Song[]; currentSong: Song; onPlay: (s: Song) => void }) {
  if (!queue.length) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 14, color: P.sub }}>No songs in queue</Text>
      </View>
    );
  }
  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {queue.map((song, i) => {
        const isActive = song._id === currentSong._id;
        return (
          <Pressable
            key={song._id ?? String(i)}
            style={({ pressed }) => [qStyles.row, isActive && qStyles.rowActive, pressed && { backgroundColor: "#F9F9F9" }]}
            onPress={() => onPlay(song)}
          >
            <View style={qStyles.thumb}>
              {song.coverImage
                ? <Image source={{ uri: song.coverImage }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                : <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center", backgroundColor: "#F0F0F0" }]}><MaterialIcons name="music-note" size={16} color={P.sub} /></View>
              }
              {isActive && (
                <View style={qStyles.activeOverlay}>
                  <MaterialIcons name="graphic-eq" size={14} color={P.red} />
                </View>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[qStyles.title, isActive && { color: P.red }]} numberOfLines={1}>{song.title}</Text>
              <Text style={qStyles.artist} numberOfLines={1}>{song.artist}</Text>
            </View>
            {!!song.duration && <Text style={qStyles.dur}>{fmt(song.duration)}</Text>}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const qStyles = StyleSheet.create({
  row:           { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 10, gap: 12, borderBottomWidth: 1, borderBottomColor: P.border },
  rowActive:     { backgroundColor: "#FFF5F5" },
  thumb:         { width: 42, height: 42, borderRadius: 10, overflow: "hidden", backgroundColor: "#F0F0F0" },
  activeOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(229,57,53,0.15)", alignItems: "center", justifyContent: "center" },
  title:         { fontSize: 13, fontWeight: "700", color: P.text, marginBottom: 2 },
  artist:        { fontSize: 11, color: P.sub },
  dur:           { fontSize: 11, color: P.sub },
});

// ─── Queue bottom sheet ───────────────────────────────────────────────────────
function QueueSheet({
  visible, queue, currentSong, onPlay, onClose,
}: {
  visible: boolean;
  queue: Song[];
  currentSong: Song;
  onPlay: (s: Song) => void;
  onClose: () => void;
}) {
  const translateY = useRef(new Animated.Value(SCREEN_H)).current;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
    } else {
      Animated.timing(translateY, { toValue: SCREEN_H, duration: 280, useNativeDriver: true }).start(() => setMounted(false));
    }
  }, [visible]);

  if (!mounted && !visible) return null;

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={sheetStyles.backdrop} />
      </TouchableWithoutFeedback>
      <Animated.View style={[sheetStyles.sheet, { transform: [{ translateY }] }]}>
        <View style={sheetStyles.handle} />
        <View style={sheetStyles.header}>
          <MaterialIcons name="queue-music" size={16} color={P.sub} />
          <Text style={sheetStyles.headerText}>Up Next ({queue.length})</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close queue">
            <MaterialIcons name="close" size={22} color={P.sub} />
          </Pressable>
        </View>
        <View style={{ flex: 1 }}>
          <QueuePanel queue={queue} currentSong={currentSong} onPlay={(s) => { onPlay(s); onClose(); }} />
        </View>
      </Animated.View>
    </Modal>
  );
}

const sheetStyles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    height: SCREEN_H * 0.65,
    backgroundColor: P.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: "hidden",
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 16 },
      android: { elevation: 16 },
    }),
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: P.border, alignSelf: "center", marginTop: 12, marginBottom: 4 },
  header: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: P.border },
  headerText: { flex: 1, fontSize: 13, fontWeight: "700", color: P.sub },
});

// ─── Lyrics parser ────────────────────────────────────────────────────────────
function parseLyricsData(raw: unknown): LyricsData | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  if (!Array.isArray(d.lines) || d.lines.length === 0) return null;
  if (d.type === "lrc") {
    const lines: LrcLine[] = d.lines.filter(
      (l): l is LrcLine => l !== null && typeof l === "object" && typeof (l as LrcLine).time === "number" && typeof (l as LrcLine).text === "string"
    );
    return lines.length > 0 ? { type: "lrc", lines } : null;
  }
  const lines: string[] = d.lines.filter((l): l is string => typeof l === "string");
  return lines.length > 0 ? { type: "plain", lines } : null;
}

// ─── Main player ──────────────────────────────────────────────────────────────
export default function PlayerScreen() {
  const {
    currentSong, queue, isPlaying, progress, elapsed, duration,
    isShuffle, isRepeat, isLoading, isBuffering, error,
    togglePlay, next, prev, seek, toggleShuffle, toggleRepeat, playSong,
  } = usePlayer();
  const { get } = useApi();
  const { isFavourite, toggleFavourite } = useFavourites();
  const router = useRouter();
  const { top: topInset, bottom: bottomInset } = useSafeAreaInsets();

  const liked = currentSong ? isFavourite(currentSong._id) : false;
  const [showPlaylistSheet, setShowPlaylistSheet] = useState(false);
  const [showQueue,         setShowQueue]         = useState(false);
  const [hasLyrics,         setHasLyrics]         = useState(false);
  const [lyricsLoading,     setLyricsLoading]     = useState(false);

  const slideAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const lastIdRef = useRef<string | null>(currentSong?._id ?? null);
  const queueRef  = useRef(queue);
  const [displayedSong, setDisplayedSong] = useState<Song | null>(currentSong ?? null);

  useEffect(() => { queueRef.current = queue; }, [queue]);

  const displayedIdx  = useMemo(() => queueRef.current.findIndex(s => s._id === displayedSong?._id), [displayedSong]);
  const displayedPrev = displayedIdx > 0 ? queueRef.current[displayedIdx - 1] : undefined;
  const displayedNext = displayedIdx >= 0 && displayedIdx < queueRef.current.length - 1 ? queueRef.current[displayedIdx + 1] : undefined;

  useEffect(() => {
    if (!currentSong) return;
    const newId = currentSong._id;
    const oldId = lastIdRef.current;
    if (oldId === newId) return;

    const q      = queueRef.current;
    const oldIdx = q.findIndex(s => s._id === oldId);
    const newIdx = q.findIndex(s => s._id === newId);
    const dir    = (oldIdx === -1 || newIdx >= oldIdx) ? -1 : 1;
    lastIdRef.current = newId;

    Animated.timing(slideAnim, { toValue: SCREEN_W * dir, duration: 200, useNativeDriver: true }).start(() => {
      setDisplayedSong(currentSong);
      slideAnim.setValue(-SCREEN_W * dir);
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 90, friction: 11 }).start();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSong?._id]);

  useEffect(() => {
    if (currentSong && !displayedSong) setDisplayedSong(currentSong);
  }, [currentSong, displayedSong]);

  const fetchedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!currentSong) return;
    if (fetchedFor.current === currentSong._id) return;
    fetchedFor.current = currentSong._id;
    setHasLyrics(false);
    setLyricsLoading(true);
    const forId = currentSong._id;
    const ctrl  = new AbortController();
    get(API.LYRICS_URL(currentSong._id), { signal: ctrl.signal })
      .then((data: unknown) => {
        if (ctrl.signal.aborted || fetchedFor.current !== forId) return;
        setHasLyrics(parseLyricsData(data) !== null);
      })
      .catch(() => { if (!ctrl.signal.aborted && fetchedFor.current === forId) setHasLyrics(false); })
      .finally(() => { if (!ctrl.signal.aborted && fetchedFor.current === forId) setLyricsLoading(false); });
    return () => ctrl.abort();
  }, [currentSong?._id, get]);

  function pulseCover() {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.93, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 130, friction: 7 }),
    ]).start();
  }

  if (!currentSong || !displayedSong) {
    return (
      <View style={{ flex: 1, backgroundColor: P.bg, justifyContent: "center", alignItems: "center" }}>
        <StatusBar style="dark" />
        <MaterialIcons name="music-off" size={52} color={P.sub} style={{ marginBottom: 16 }} />
        <Text style={{ color: P.text, fontSize: 18, fontWeight: "700" }}>Nothing playing</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 20, padding: 14 }}>
          <Text style={{ color: P.red, fontWeight: "700", fontSize: 15 }}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const pct = Math.round(progress * 100);

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <StatusBar style="dark" />

      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: topInset + 10 }]}>
        <Pressable style={({ pressed }) => [styles.backCircle, pressed && { opacity: 0.75 }]} onPress={() => router.back()} accessibilityLabel="Go back">
          <MaterialIcons name="arrow-back-ios" size={18} color={P.surface} style={{ marginLeft: 4 }} />
        </Pressable>
        <Text style={styles.nowPlayingLabel}>Now Playing</Text>
        <Pressable style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.6 }]} onPress={() => Alert.alert("Share", "Sharing coming soon!")} accessibilityLabel="Share song">
          <MaterialIcons name="share" size={20} color={P.sub} />
        </Pressable>
      </View>

      {/* ── Artwork ── */}
      <Animated.View style={{ transform: [{ translateX: slideAnim }] }}>
        <FanArtwork current={displayedSong} prev={displayedPrev} next={displayedNext} scaleAnim={scaleAnim} />
      </Animated.View>

      {(isLoading || isBuffering) && (
        <View style={styles.loadingBadge}>
          <ActivityIndicator size="small" color={P.red} />
        </View>
      )}

      {!!error && (
        <Pressable style={styles.errorBanner} onPress={() => currentSong && playSong(currentSong, queue.length ? queue : undefined)}>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.errorHint}>Tap to retry</Text>
        </Pressable>
      )}

      {/* ── Song info ── */}
      <View style={styles.infoRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.songTitle} numberOfLines={1}>{currentSong.title}</Text>
          <Text style={styles.songArtist} numberOfLines={1}>{currentSong.artist}</Text>
        </View>
        <Pressable onPress={() => toggleFavourite(currentSong._id)} hitSlop={10} accessibilityLabel={liked ? "Remove from favourites" : "Add to favourites"}>
          <MaterialIcons name={liked ? "favorite" : "favorite-border"} size={24} color={liked ? P.red : P.sub} />
        </Pressable>
      </View>

      {/* ── Spacer pushes controls to bottom ── */}
      <View style={{ flex: 1 }} />

      {/* ── Seek bar ── */}
      <SeekBar progress={progress} onSeek={seek} />

      {/* ── Time row ── */}
      <View style={styles.timeRow}>
        <Text style={styles.timeText}>{fmt(elapsed)}</Text>
        <Text style={styles.timeText}>{fmt(duration)}</Text>
      </View>

      {/* ── Controls ── */}
      <View style={styles.controls}>
        <Pressable style={({ pressed }) => [styles.sideBtn, pressed && { opacity: 0.5 }]} onPress={toggleRepeat} accessibilityLabel="Toggle repeat">
          <MaterialIcons name="repeat" size={22} color={isRepeat ? P.red : P.sub} />
          {isRepeat && <View style={styles.activeDot} />}
        </Pressable>
        <Pressable style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.65 }]} onPress={prev} accessibilityLabel="Previous">
          <MaterialIcons name="skip-previous" size={34} color={P.text} />
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.playBtn, pressed && { transform: [{ scale: 0.93 }] }]}
          onPress={() => { togglePlay(); pulseCover(); }}
          disabled={isLoading}
          accessibilityLabel={isPlaying ? "Pause" : "Play"}
        >
          {isLoading
            ? <ActivityIndicator color={P.surface} size="small" />
            : <MaterialIcons name={isPlaying ? "pause" : "play-arrow"} size={36} color={P.surface} />
          }
        </Pressable>
        <Pressable style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.65 }]} onPress={next} accessibilityLabel="Next">
          <MaterialIcons name="skip-next" size={34} color={P.text} />
        </Pressable>
        <Pressable style={({ pressed }) => [styles.sideBtn, pressed && { opacity: 0.5 }]} onPress={toggleShuffle} accessibilityLabel="Toggle shuffle">
          <MaterialIcons name="shuffle" size={22} color={isShuffle ? P.red : P.sub} />
          {isShuffle && <View style={styles.activeDot} />}
        </Pressable>
      </View>

      {/* ── Action row ── */}
      <View style={[styles.actionRow, { paddingBottom: Math.max(bottomInset, 20) }]}>
        <Pressable style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.6 }]} onPress={() => setShowPlaylistSheet(true)} accessibilityLabel="Add to playlist">
          <MaterialIcons name="playlist-add" size={22} color={P.sub} />
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.actionBtn, hasLyrics && styles.actionBtnActive, pressed && { opacity: 0.7 }, !hasLyrics && { opacity: 0.4 }]}
          onPress={() => router.push("/lyrics")}
          disabled={lyricsLoading}
          accessibilityLabel="View lyrics"
        >
          <MaterialIcons name={lyricsLoading ? "hourglass-empty" : "mic"} size={22} color={hasLyrics ? P.surface : P.sub} />
        </Pressable>
        <Pressable style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.6 }]} onPress={() => setShowQueue(true)} accessibilityLabel="Show queue">
          <MaterialIcons name="queue-music" size={22} color={P.sub} />
        </Pressable>
      </View>

      <AddToPlaylistSheet
        visible={showPlaylistSheet}
        songId={currentSong._id}
        songTitle={currentSong.title}
        onClose={() => setShowPlaylistSheet(false)}
      />

      <QueueSheet
        visible={showQueue}
        queue={queue}
        currentSong={currentSong}
        onPlay={(s) => playSong(s, queue)}
        onClose={() => setShowQueue(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 14 },
  backCircle: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: P.red,
    alignItems: "center", justifyContent: "center",
    ...Platform.select({
      ios: { shadowColor: P.red, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8 },
      android: { elevation: 6 },
    }),
  },
  nowPlayingLabel: { fontSize: 13, fontWeight: "700", color: P.sub, letterSpacing: 0.3 },
  shareBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },

  loadingBadge: { position: "absolute", top: FAN_H / 2 + 80, alignSelf: "center", backgroundColor: "rgba(255,255,255,0.9)", borderRadius: 20, padding: 10 },

  errorBanner: { marginHorizontal: 24, marginBottom: 8, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: "#FDECEA", borderRadius: 10, borderWidth: 1, borderColor: "#FFCDD2", alignItems: "center" },
  errorText:   { color: P.red, fontSize: 13, fontWeight: "600", textAlign: "center" },
  errorHint:   { color: "#E57373", fontSize: 11, marginTop: 2 },

  infoRow:    { flexDirection: "row", alignItems: "center", paddingHorizontal: 24, marginBottom: 4 },
  songTitle:  { fontSize: 20, fontWeight: "900", color: P.text, letterSpacing: -0.3 },
  songArtist: { fontSize: 14, color: P.sub, marginTop: 3 },

  timeRow:  { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 28, marginBottom: 16 },
  timeText: { fontSize: 11, color: P.sub, fontWeight: "600" },

  controls:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 22, marginBottom: 16 },
  sideBtn:   { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  activeDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: P.red, position: "absolute", bottom: 4, alignSelf: "center" },
  navBtn:    { width: 52, height: 52, alignItems: "center", justifyContent: "center" },
  playBtn: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: P.red,
    alignItems: "center", justifyContent: "center",
    ...Platform.select({
      ios: { shadowColor: P.red, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12 },
      android: { elevation: 10 },
    }),
  },

  actionRow:       { flexDirection: "row", justifyContent: "center", gap: 20, paddingTop: 4 },
  actionBtn:       { width: 42, height: 42, borderRadius: 21, backgroundColor: P.border, alignItems: "center", justifyContent: "center" },
  actionBtnActive: { backgroundColor: P.red },
});
