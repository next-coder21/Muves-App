import {
  ActivityIndicator,
  Animated,
  GestureResponderEvent,
  Image,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { usePlayer, Song } from "@/context/PlayerContext";
import { useFavourites } from "@/context/FavouritesContext";
import { useApi } from "@/hooks/useApi";
import { API } from "@/constants/api";
import AddToPlaylistSheet from "@/components/AddToPlaylistSheet";

const LIME = "#C8FF00";
const BG = "#0d0d0d";
const TEXT = "#ffffff";
const MUTED = "#999";
const DIM = "rgba(255,255,255,0.12)";

type LrcLine = { time: number; text: string };
type LyricsData =
  | { type: "lrc"; lines: LrcLine[] }
  | { type: "plain"; lines: string[] }
  | null;

function fmt(s: number) {
  if (!s || isNaN(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// ─── Lyrics panel ─────────────────────────────────────────────────────────────
function LyricsPanel({
  lyrics,
  elapsed,
  loading,
}: {
  lyrics: LyricsData;
  elapsed: number;
  loading: boolean;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const lineRefs = useRef<number[]>([]);

  // Find the active LRC line index
  let activeLine = -1;
  if (lyrics?.type === "lrc") {
    for (let i = 0; i < lyrics.lines.length; i++) {
      if (lyrics.lines[i].time <= elapsed) activeLine = i;
      else break;
    }
  }

  // Auto-scroll to active line
  useEffect(() => {
    if (activeLine >= 0 && lineRefs.current[activeLine] !== undefined) {
      scrollRef.current?.scrollTo({ y: lineRefs.current[activeLine] - 80, animated: true });
    }
  }, [activeLine]);

  if (loading) {
    return (
      <View style={lStyles.center}>
        <ActivityIndicator color={LIME} />
      </View>
    );
  }

  if (!lyrics) {
    return (
      <View style={lStyles.center}>
        <Text style={lStyles.empty}>No lyrics available</Text>
      </View>
    );
  }

  return (
    <ScrollView
      ref={scrollRef}
      style={lStyles.scroll}
      contentContainerStyle={lStyles.content}
      showsVerticalScrollIndicator={false}
    >
      {lyrics.type === "lrc"
        ? lyrics.lines.map((line, i) => (
            <Text
              key={i}
              onLayout={(e) => { lineRefs.current[i] = e.nativeEvent.layout.y; }}
              style={[
                lStyles.lrcLine,
                i === activeLine && lStyles.lrcLineActive,
                i < activeLine && lStyles.lrcLinePast,
              ]}
            >
              {line.text}
            </Text>
          ))
        : lyrics.lines.map((line, i) => (
            <Text key={i} style={lStyles.plainLine}>{line}</Text>
          ))
      }
    </ScrollView>
  );
}

const lStyles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingHorizontal: 28, paddingVertical: 20, paddingBottom: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { color: MUTED, fontSize: 15 },
  lrcLine: { fontSize: 18, fontWeight: "600", color: MUTED, lineHeight: 36, textAlign: "center" },
  lrcLineActive: { color: TEXT, fontSize: 22, fontWeight: "800" },
  lrcLinePast: { color: "rgba(255,255,255,0.35)" },
  plainLine: { fontSize: 15, color: TEXT, lineHeight: 28, textAlign: "center" },
});

// ─── Queue panel ──────────────────────────────────────────────────────────────
function QueuePanel({
  queue, currentSong, onPlay,
}: {
  queue: Song[]; currentSong: Song; onPlay: (s: Song) => void;
}) {
  if (!queue.length) {
    return (
      <View style={[lStyles.center, { paddingVertical: 40 }]}>
        <Text style={lStyles.empty}>No songs in queue</Text>
      </View>
    );
  }
  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {queue.map((song, i) => {
        const isCurrent = song._id === currentSong._id;
        return (
          <Pressable
            key={song._id ?? String(i)}
            style={({ pressed }) => [qStyles.row, isCurrent && qStyles.rowActive, pressed && { opacity: 0.7 }]}
            onPress={() => onPlay(song)}
          >
            <View style={qStyles.cover}>
              {song.coverImage
                ? <Image source={{ uri: song.coverImage }} style={StyleSheet.absoluteFill} />
                : <View style={[StyleSheet.absoluteFill, qStyles.coverFallback]}><MaterialIcons name="music-note" size={16} color={LIME} /></View>
              }
              {isCurrent && (
                <View style={qStyles.activeOverlay}><MaterialIcons name="play-arrow" size={12} color={LIME} /></View>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[qStyles.title, isCurrent && { color: LIME }]} numberOfLines={1}>{song.title}</Text>
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
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 12, gap: 12 },
  rowActive: { backgroundColor: "rgba(200,255,0,0.06)" },
  cover: { width: 44, height: 44, borderRadius: 10, overflow: "hidden", backgroundColor: "#1a1a1a" },
  coverFallback: { alignItems: "center", justifyContent: "center", backgroundColor: "#1a1a1a" },
  activeOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" },
  title: { fontSize: 14, fontWeight: "600", color: TEXT },
  artist: { fontSize: 12, color: MUTED, marginTop: 2 },
  dur: { fontSize: 12, color: MUTED },
});

// ─── Lyrics data validator ────────────────────────────────────────────────────
function parseLyricsData(raw: unknown): LyricsData | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  if (!Array.isArray(d.lines) || d.lines.length === 0) return null;

  if (d.type === "lrc") {
    const lines: LrcLine[] = d.lines
      .filter((l): l is LrcLine =>
        l !== null && typeof l === "object" &&
        typeof (l as LrcLine).time === "number" &&
        typeof (l as LrcLine).text === "string"
      );
    return lines.length > 0 ? { type: "lrc", lines } : null;
  }

  // plain or unknown type — treat lines as strings
  const lines: string[] = d.lines
    .filter((l): l is string => typeof l === "string");
  return lines.length > 0 ? { type: "plain", lines } : null;
}

// ─── Main player screen ───────────────────────────────────────────────────────
export default function PlayerScreen() {
  const {
    currentSong, queue, isPlaying, progress, elapsed, duration,
    isShuffle, isRepeat, isLoading, isBuffering, error,
    togglePlay, next, prev, seek, toggleShuffle, toggleRepeat, playSong,
  } = usePlayer();
  const { get } = useApi();
  const { isFavourite, toggleFavourite } = useFavourites();
  const router = useRouter();
  const { top: topInset } = useSafeAreaInsets();

  const liked = currentSong ? isFavourite(currentSong._id) : false;
  const [showPlaylistSheet, setShowPlaylistSheet] = useState(false);
  const [tab, setTab] = useState<"lyrics" | "queue">("queue");
  const [lyrics, setLyrics] = useState<LyricsData>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [hasLyrics, setHasLyrics] = useState(false);

  const barWidth = useRef(0);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const fetchedFor = useRef<string | null>(null);

  // Fetch lyrics when song changes
  useEffect(() => {
    if (!currentSong) return;
    if (fetchedFor.current === currentSong._id) return;
    fetchedFor.current = currentSong._id;

    setLyrics(null);
    setHasLyrics(false);
    setLyricsLoading(true);

    // Capture the song ID so the async callback can verify the song
    // hasn't changed before applying its result (prevents stale overwrites).
    const forId = currentSong._id;
    const ctrl = new AbortController();

    get(API.LYRICS_URL(currentSong._id), { signal: ctrl.signal })
      .then((data: unknown) => {
        if (ctrl.signal.aborted || fetchedFor.current !== forId) return;
        const parsed = parseLyricsData(data);
        if (parsed) {
          setLyrics(parsed);
          setHasLyrics(true);
          setTab("lyrics");
        } else {
          setHasLyrics(false);
          setTab("queue");
        }
      })
      .catch(() => {
        if (ctrl.signal.aborted || fetchedFor.current !== forId) return;
        setHasLyrics(false);
        setTab("queue");
      })
      .finally(() => {
        if (!ctrl.signal.aborted && fetchedFor.current === forId) setLyricsLoading(false);
      });

    return () => ctrl.abort();
  }, [currentSong?._id, get]);

  function onBarLayout(e: LayoutChangeEvent) {
    barWidth.current = e.nativeEvent.layout.width;
  }

  function onBarPress(e: GestureResponderEvent) {
    if (!barWidth.current) return;
    seek(Math.max(0, Math.min(1, e.nativeEvent.locationX / barWidth.current)));
  }

  function pulseCover() {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.94, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 130, friction: 7 }),
    ]).start();
  }

  if (!currentSong) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center", paddingTop: topInset }]}>
        <StatusBar style="light" />
        <MaterialIcons name="music-off" size={52} color={MUTED} style={{ marginBottom: 16 }} />
        <Text style={{ color: TEXT, fontSize: 18, fontWeight: "700" }}>Nothing playing</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 20, padding: 14 }}>
          <Text style={{ color: LIME, fontWeight: "700", fontSize: 15 }}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Blurred bg */}
      {currentSong.coverImage && (
        <Image source={{ uri: currentSong.coverImage }} style={StyleSheet.absoluteFill} blurRadius={60} />
      )}
      <LinearGradient
        colors={["rgba(10,10,10,0.7)", "rgba(10,10,10,0.88)", "#0a0a0a"]}
        style={StyleSheet.absoluteFill}
      />

      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: topInset + 8 }]}>
        <Pressable style={({ pressed }) => [styles.headerSideBtn, pressed && { opacity: 0.5 }]} onPress={() => router.back()}>
          <MaterialIcons name="keyboard-arrow-down" size={32} color={TEXT} />
        </Pressable>
        <View style={{ alignItems: "center" }}>
          <Text style={styles.headerSub}>
            {currentSong.album ?? currentSong.genre ?? "Single"}
          </Text>
          <Text style={styles.headerTitle} numberOfLines={1}>{currentSong.title}</Text>
        </View>
        <Pressable style={({ pressed }) => [styles.headerSideBtn, pressed && { opacity: 0.5 }]}>
          <MaterialIcons name="more-horiz" size={26} color={TEXT} />
        </Pressable>
      </View>

      {/* ── Album Art ── */}
      <Animated.View style={[styles.artworkWrapper, { transform: [{ scale: scaleAnim }] }]}>
        <View style={styles.artwork}>
          {currentSong.coverImage
            ? <Image source={{ uri: currentSong.coverImage }} style={StyleSheet.absoluteFill} />
            : (
              <View style={[StyleSheet.absoluteFill, styles.artworkFallback]}>
                <MaterialIcons name="music-note" size={80} color={MUTED} />
              </View>
            )
          }
          {(isLoading || isBuffering) && (
            <View style={[StyleSheet.absoluteFillObject, styles.loadingOverlay, isBuffering && !isLoading && styles.bufferingOverlay]}>
              <ActivityIndicator size={isBuffering && !isLoading ? "small" : "large"} color={LIME} />
            </View>
          )}
        </View>
      </Animated.View>

      {/* ── Error banner ── */}
      {!!error && (
        <Pressable
          style={styles.errorBanner}
          onPress={() => currentSong && playSong(currentSong, queue.length ? queue : undefined)}
        >
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.errorRetryHint}>Tap to retry</Text>
        </Pressable>
      )}

      {/* ── Song info ── */}
      <View style={styles.infoRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.songTitle} numberOfLines={1}>{currentSong.title}</Text>
          <Text style={styles.songArtist} numberOfLines={1}>{currentSong.artist}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Pressable
            style={({ pressed }) => [styles.likeBtn, pressed && { opacity: 0.6 }]}
            onPress={() => currentSong && toggleFavourite(currentSong._id)}
          >
            <MaterialIcons name={liked ? "favorite" : "favorite-border"} size={26} color={liked ? LIME : MUTED} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.likeBtn, pressed && { opacity: 0.6 }]}
            onPress={() => setShowPlaylistSheet(true)}
          >
            <MaterialIcons name="playlist-add" size={28} color={MUTED} />
          </Pressable>
        </View>
      </View>

      {/* ── Progress bar ── */}
      <View style={styles.progressSection}>
        <Pressable style={styles.progressTrack} onLayout={onBarLayout} onPress={onBarPress}>
          <View style={styles.progressBg} />
          <View style={[styles.progressFill, { width: `${(progress * 100).toFixed(2)}%` as `${number}%` }]}>
            <View style={styles.progressThumb} />
          </View>
        </Pressable>
        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{fmt(elapsed)}</Text>
          <Text style={styles.timeText}>{fmt(duration)}</Text>
        </View>
      </View>

      {/* ── Main controls ── */}
      <View style={styles.controls}>
        <Pressable style={({ pressed }) => [styles.sideCtrl, pressed && { opacity: 0.5 }]} onPress={toggleShuffle}>
          <MaterialIcons name="shuffle" size={22} color={isShuffle ? LIME : MUTED} />
          {isShuffle && <View style={styles.dot} />}
        </Pressable>

        <Pressable style={({ pressed }) => [styles.navCtrl, pressed && { opacity: 0.6 }]} onPress={prev}>
          <MaterialIcons name="skip-previous" size={36} color={TEXT} />
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.playCtrl, pressed && { transform: [{ scale: 0.93 }] }]}
          onPress={() => { togglePlay(); pulseCover(); }}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#000" size="small" />
          ) : (
            <MaterialIcons name={isPlaying ? "pause" : "play-arrow"} size={36} color="#000" />
          )}
        </Pressable>

        <Pressable style={({ pressed }) => [styles.navCtrl, pressed && { opacity: 0.6 }]} onPress={next}>
          <MaterialIcons name="skip-next" size={36} color={TEXT} />
        </Pressable>

        <Pressable style={({ pressed }) => [styles.sideCtrl, pressed && { opacity: 0.5 }]} onPress={toggleRepeat}>
          <MaterialIcons name="repeat" size={22} color={isRepeat ? LIME : MUTED} />
          {isRepeat && <View style={styles.dot} />}
        </Pressable>
      </View>


      {/* ── Lyrics / Queue tab ── */}
      <View style={styles.tabBar}>
        {hasLyrics && (
          <Pressable
            style={[styles.tabBtn, tab === "lyrics" && styles.tabBtnActive]}
            onPress={() => setTab("lyrics")}
          >
            <Text style={[styles.tabBtnText, tab === "lyrics" && styles.tabBtnTextActive]}>Lyrics</Text>
          </Pressable>
        )}
        <Pressable
          style={[styles.tabBtn, tab === "queue" && styles.tabBtnActive]}
          onPress={() => setTab("queue")}
        >
          <Text style={[styles.tabBtnText, tab === "queue" && styles.tabBtnTextActive]}>
            Up Next ({queue.length})
          </Text>
        </Pressable>
      </View>

      {/* ── Content panel ── */}
      <View style={styles.panel}>
        {tab === "lyrics" ? (
          <LyricsPanel lyrics={lyrics} elapsed={elapsed} loading={lyricsLoading} />
        ) : (
          <QueuePanel
            queue={queue}
            currentSong={currentSong}
            onPlay={(s) => playSong(s, queue)}
          />
        )}
      </View>

      <AddToPlaylistSheet
        visible={showPlaylistSheet}
        songId={currentSong._id}
        songTitle={currentSong.title}
        onClose={() => setShowPlaylistSheet(false)}
      />
    </View>
  );
}

const ART_SIZE = 280;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  // Header
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 8,
  },
  headerSideBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerSideIcon: { fontSize: 28, color: TEXT, fontWeight: "300" },
  headerSub: { fontSize: 11, color: MUTED, fontWeight: "600", letterSpacing: 1, textTransform: "uppercase" },
  headerTitle: { fontSize: 14, color: TEXT, fontWeight: "700", maxWidth: 200, marginTop: 2 },

  // Artwork
  artworkWrapper: { alignSelf: "center", marginTop: 8, marginBottom: 24 },
  artwork: {
    width: ART_SIZE, height: ART_SIZE, borderRadius: 22,
    overflow: "hidden", backgroundColor: "#1a1a1a",
  },
  artworkFallback: { alignItems: "center", justifyContent: "center", backgroundColor: "#1a1a1a" },
  loadingOverlay: {
    backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 22,
    alignItems: "center", justifyContent: "center",
  },
  bufferingOverlay: {
    backgroundColor: "rgba(0,0,0,0.25)",
    alignItems: "flex-end", justifyContent: "flex-end",
    padding: 10,
  },

  // Error
  errorBanner: {
    marginHorizontal: 28, marginBottom: 10, paddingVertical: 8, paddingHorizontal: 14,
    backgroundColor: "rgba(220,50,50,0.18)", borderRadius: 10,
    borderWidth: 1, borderColor: "rgba(220,50,50,0.4)",
    alignItems: "center",
  },
  errorText: { color: "#ff6b6b", fontSize: 13, fontWeight: "600", textAlign: "center" },
  errorRetryHint: { color: "rgba(255,107,107,0.8)", fontSize: 11, fontWeight: "600", marginTop: 2 },

  // Info
  infoRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 28, marginBottom: 18,
  },
  songTitle: { fontSize: 22, fontWeight: "800", color: TEXT },
  songArtist: { fontSize: 14, color: MUTED, marginTop: 4 },
  likeBtn: { paddingLeft: 16, paddingVertical: 6 },
  likeIcon: { fontSize: 26, color: MUTED },

  // Progress
  progressSection: { paddingHorizontal: 28, marginBottom: 20 },
  progressTrack: { height: 28, justifyContent: "center" },
  progressBg: { position: "absolute", left: 0, right: 0, height: 3, backgroundColor: DIM, borderRadius: 2 },
  progressFill: {
    height: 3, backgroundColor: TEXT, borderRadius: 2,
    flexDirection: "row", alignItems: "center", justifyContent: "flex-end",
  },
  progressThumb: {
    width: 13, height: 13, borderRadius: 7, backgroundColor: TEXT,
    marginRight: -6.5,
    shadowColor: "#fff", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 4,
  },
  timeRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  timeText: { fontSize: 11, color: MUTED, fontWeight: "500" },

  // Controls
  controls: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 24, marginBottom: 16,
  },
  sideCtrl: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  sideCtrlIcon: { fontSize: 22, color: MUTED },
  dot: {
    width: 4, height: 4, borderRadius: 2, backgroundColor: LIME,
    position: "absolute", bottom: 5, alignSelf: "center",
  },
  navCtrl: { width: 52, height: 52, alignItems: "center", justifyContent: "center" },
  navCtrlIcon: { fontSize: 30, color: TEXT },
  playCtrl: {
    width: 68, height: 68, borderRadius: 34, backgroundColor: TEXT,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#fff", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 12, elevation: 10,
  },
  playCtrlIcon: { fontSize: 28, color: "#000", marginLeft: 3 },
  pauseIcon: { flexDirection: "row", alignItems: "center", gap: 5 },
  pauseBar: { width: 4, height: 22, borderRadius: 2, backgroundColor: "#000" },


  // Tab bar
  tabBar: {
    flexDirection: "row", paddingHorizontal: 28, gap: 24,
    borderBottomWidth: 1, borderBottomColor: DIM,
    marginHorizontal: 0,
  },
  tabBtn: { paddingVertical: 12 },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: TEXT, marginBottom: -1 },
  tabBtnText: { fontSize: 14, fontWeight: "700", color: MUTED },
  tabBtnTextActive: { color: TEXT },

  // Panel
  panel: { flex: 1 },
});
