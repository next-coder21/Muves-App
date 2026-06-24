import {
  ActivityIndicator,
  Animated,
  Dimensions,
  LayoutChangeEvent,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Image } from "expo-image";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { StatusBar } from "expo-status-bar";
import { usePlayer, Song } from "@/context/PlayerContext";
import { useFavourites } from "@/context/FavouritesContext";
import { useTheme } from "@/context/ThemeContext";
import { useApi } from "@/hooks/useApi";
import { API } from "@/constants/api";
import AddToPlaylistSheet from "@/components/AddToPlaylistSheet";
import { useAppAlert } from "@/context/AlertContext";

// ─── Palette ──────────────────────────────────────────────────────────────────
type Pal = {
  bg: string; surface: string; card: string; card2: string;
  lime: string; limeGlow: string; limeText: string;
  text: string; sub: string; muted: string; border: string; trackInactive: string;
};

const DARK_P: Pal = {
  bg:            "#07070f",
  surface:       "#0d0d1f",
  card:          "#131328",
  card2:         "#1a1a30",
  lime:          "#E53935",
  limeGlow:      "rgba(229,57,53,0.18)",
  limeText:      "#FFFFFF",
  text:          "#FFFFFF",
  sub:           "rgba(255,255,255,0.5)",
  muted:         "rgba(255,255,255,0.22)",
  border:        "rgba(255,255,255,0.08)",
  trackInactive: "rgba(255,255,255,0.14)",
};

const LIGHT_P: Pal = {
  bg:            "#f2f2fa",
  surface:       "#ffffff",
  card:          "#e8e8f5",
  card2:         "#dcdcec",
  lime:          "#C62828",
  limeGlow:      "rgba(229,57,53,0.1)",
  limeText:      "#ffffff",
  text:          "#0a0a18",
  sub:           "rgba(10,10,24,0.55)",
  muted:         "rgba(10,10,24,0.3)",
  border:        "rgba(10,10,24,0.1)",
  trackInactive: "rgba(10,10,24,0.18)",
};

// Local palette context — lets sub-components read the active palette
const PalCtx = createContext<Pal>(DARK_P);
const usePal = () => useContext(PalCtx);

// ─── Layout constants ─────────────────────────────────────────────────────────
const { width: W, height: H } = Dimensions.get("window");
const ART_SIZE    = Math.round(W * 0.74);
const VINYL_SIZE  = Math.round(ART_SIZE * 0.90);
const QUEUE_ROW_H = 68;
const THUMB_D     = 14;
const TRACK_H     = 4;
const SEEK_H      = 32;
const VOL_THUMB   = 14;
const VOL_H       = 28;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(s: number) {
  if (!s || isNaN(s)) return "0:00";
  const m = Math.floor(s / 60);
  return `${m}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
}

// ─── Lyrics types ─────────────────────────────────────────────────────────────
type LrcLine    = { time: number; text: string };
type LyricsData = { type: "lrc"; lines: LrcLine[] } | { type: "plain"; lines: string[] } | null;

function parseLyricsData(raw: unknown): LyricsData | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  if (!Array.isArray(d.lines) || d.lines.length === 0) return null;
  if (d.type === "lrc") {
    const lines: LrcLine[] = d.lines.filter(
      (l): l is LrcLine =>
        l !== null && typeof l === "object" &&
        typeof (l as LrcLine).time === "number" && typeof (l as LrcLine).text === "string"
    );
    return lines.length > 0 ? { type: "lrc", lines } : null;
  }
  const lines: string[] = d.lines.filter((l): l is string => typeof l === "string");
  return lines.length > 0 ? { type: "plain", lines } : null;
}

// ─── Vinyl disc (always dark – decorative) ────────────────────────────────────
function VinylDisc({ size }: { size: number }) {
  const r = size / 2;
  const rings = [0.94, 0.82, 0.70, 0.58, 0.44, 0.30, 0.16];
  return (
    <View style={{ width: size, height: size, borderRadius: r, backgroundColor: "#080810", alignItems: "center", justifyContent: "center" }}>
      {rings.map((ratio, i) => (
        <View key={i} style={{
          position: "absolute",
          width: size * ratio, height: size * ratio,
          borderRadius: (size * ratio) / 2,
          borderWidth: 0.6,
          borderColor: i % 2 === 0 ? "rgba(255,255,255,0.055)" : "rgba(255,255,255,0.03)",
        }} />
      ))}
      <View style={{ width: size * 0.19, height: size * 0.19, borderRadius: size * 0.095, backgroundColor: "#1c1c32", alignItems: "center", justifyContent: "center" }}>
        <View style={{ width: size * 0.05, height: size * 0.05, borderRadius: size * 0.025, backgroundColor: "#07070f" }} />
      </View>
    </View>
  );
}

// ─── Linear seek bar ──────────────────────────────────────────────────────────
function LinearSeekBar({ progress, onSeek }: { progress: number; onSeek: (r: number) => void }) {
  const P         = usePal();
  const widthRef  = useRef(0);
  const offsetRef = useRef(0);
  const clamp     = (px: number) => Math.max(0, Math.min(1, (px - offsetRef.current) / widthRef.current));
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderGrant: (e) => {
      offsetRef.current = e.nativeEvent.pageX - e.nativeEvent.locationX;
      onSeek(clamp(e.nativeEvent.pageX));
    },
    onPanResponderMove: (e) => onSeek(clamp(e.nativeEvent.pageX)),
  })).current;

  const pct = `${Math.round(progress * 100)}%` as `${number}%`;

  const ss = useMemo(() => StyleSheet.create({
    container: { height: SEEK_H, justifyContent: "center" },
    track:     { height: TRACK_H, borderRadius: TRACK_H / 2, backgroundColor: P.trackInactive, overflow: "hidden" },
    fill:      { height: TRACK_H, borderRadius: TRACK_H / 2, backgroundColor: P.lime },
    thumb: {
      position: "absolute",
      width: THUMB_D, height: THUMB_D, borderRadius: THUMB_D / 2,
      backgroundColor: P.lime,
      top: (SEEK_H - THUMB_D) / 2,
      marginLeft: -(THUMB_D / 2),
      ...Platform.select({
        ios: { shadowColor: P.lime, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.85, shadowRadius: 8 },
        android: { elevation: 5 },
      }),
    },
  }), [P]);

  return (
    <View
      style={ss.container}
      onLayout={(e: LayoutChangeEvent) => { widthRef.current = e.nativeEvent.layout.width; }}
      {...pan.panHandlers}
    >
      <View style={ss.track}>
        <View style={[ss.fill, { width: pct }]} />
      </View>
      <View style={[ss.thumb, { left: pct }]} />
    </View>
  );
}

// ─── Volume slider ────────────────────────────────────────────────────────────
function VolumeSlider({ volume, onVolume }: { volume: number; onVolume: (v: number) => void }) {
  const P         = usePal();
  const widthRef  = useRef(0);
  const offsetRef = useRef(0);
  const clamp     = (px: number) => Math.max(0, Math.min(1, (px - offsetRef.current) / widthRef.current));
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderGrant: (e) => {
      offsetRef.current = e.nativeEvent.pageX - e.nativeEvent.locationX;
      onVolume(clamp(e.nativeEvent.pageX));
    },
    onPanResponderMove: (e) => onVolume(clamp(e.nativeEvent.pageX)),
  })).current;

  const pct = `${Math.round(volume * 100)}%` as `${number}%`;

  const ss = useMemo(() => StyleSheet.create({
    row:       { flexDirection: "row", alignItems: "center", gap: 10 },
    container: { flex: 1, height: VOL_H, justifyContent: "center" },
    track:     { height: 3, borderRadius: 2, backgroundColor: P.trackInactive, overflow: "hidden" },
    fill:      { height: 3, borderRadius: 2, backgroundColor: P.sub },
    thumb: {
      position: "absolute",
      width: VOL_THUMB, height: VOL_THUMB, borderRadius: VOL_THUMB / 2,
      backgroundColor: P.text,
      top: (VOL_H - VOL_THUMB) / 2,
      marginLeft: -(VOL_THUMB / 2),
    },
  }), [P]);

  return (
    <View style={ss.row}>
      <MaterialIcons name="volume-mute" size={18} color={P.sub} />
      <View
        style={ss.container}
        onLayout={(e: LayoutChangeEvent) => { widthRef.current = e.nativeEvent.layout.width; }}
        {...pan.panHandlers}
      >
        <View style={ss.track}>
          <View style={[ss.fill, { width: pct }]} />
        </View>
        <View style={[ss.thumb, { left: pct }]} />
      </View>
      <MaterialIcons name="volume-up" size={18} color={P.sub} />
    </View>
  );
}

// ─── Sleep timer sheet ────────────────────────────────────────────────────────
const TIMER_OPTIONS: Array<{ label: string; mins: number | "song" }> = [
  { label: "5 minutes",  mins: 5   },
  { label: "15 minutes", mins: 15  },
  { label: "30 minutes", mins: 30  },
  { label: "45 minutes", mins: 45  },
  { label: "1 hour",     mins: 60  },
  { label: "End of song",mins: "song" },
];

function SleepTimerSheet({ visible, activeLabel, remaining, onSelect, onCancel, onClose }: {
  visible: boolean; activeLabel: string; remaining: string;
  onSelect: (mins: number | "song", label: string) => void;
  onCancel: () => void; onClose: () => void;
}) {
  const P            = usePal();
  const translateY   = useRef(new Animated.Value(H)).current;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
    } else {
      Animated.timing(translateY, { toValue: H, duration: 260, useNativeDriver: true }).start(() => setMounted(false));
    }
  }, [visible]);

  const ss = useMemo(() => StyleSheet.create({
    backdrop:       { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.65)" },
    sheet: {
      position: "absolute", bottom: 0, left: 0, right: 0,
      backgroundColor: P.surface,
      borderTopLeftRadius: 28, borderTopRightRadius: 28,
      paddingBottom: 32,
      ...Platform.select({
        ios: { shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.5, shadowRadius: 20 },
        android: { elevation: 20 },
      }),
    },
    handle:        { width: 36, height: 4, borderRadius: 2, backgroundColor: P.border, alignSelf: "center", marginTop: 12, marginBottom: 4 },
    header:        { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 24, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: P.border },
    title:         { flex: 1, fontSize: 15, fontWeight: "800", color: P.text },
    activePill:    { backgroundColor: P.limeGlow, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, borderColor: P.lime + "50" },
    activePillText:{ fontSize: 11, fontWeight: "700", color: P.lime },
    row:           { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: P.border },
    rowActive:     { backgroundColor: P.limeGlow },
    rowLabel:      { flex: 1, fontSize: 15, color: P.text, fontWeight: "600" },
    cancelBtn:     { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 24, marginTop: 16, padding: 14, borderRadius: 14, backgroundColor: "rgba(255,107,107,0.1)", borderWidth: 1, borderColor: "rgba(255,107,107,0.2)" },
    cancelText:    { fontSize: 14, fontWeight: "700", color: "#FF6B6B" },
  }), [P]);

  if (!mounted && !visible) return null;
  const isActive = !!activeLabel;

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={ss.backdrop} />
      </TouchableWithoutFeedback>
      <Animated.View style={[ss.sheet, { transform: [{ translateY }] }]}>
        <View style={ss.handle} />
        <View style={ss.header}>
          <MaterialIcons name="hourglass-empty" size={18} color={P.lime} />
          <Text style={ss.title}>Sleep Timer</Text>
          {isActive && (
            <View style={ss.activePill}>
              <Text style={ss.activePillText}>{remaining || activeLabel}</Text>
            </View>
          )}
        </View>
        {TIMER_OPTIONS.map((opt) => {
          const isSelected = activeLabel === opt.label;
          return (
            <Pressable
              key={opt.label}
              style={({ pressed }) => [ss.row, isSelected && ss.rowActive, pressed && { opacity: 0.7 }]}
              onPress={() => onSelect(opt.mins, opt.label)}
            >
              <MaterialIcons name={opt.mins === "song" ? "music-note" : "timer"} size={20} color={isSelected ? P.lime : P.sub} />
              <Text style={[ss.rowLabel, isSelected && { color: P.lime }]}>{opt.label}</Text>
              {isSelected && <MaterialIcons name="check-circle" size={18} color={P.lime} />}
            </Pressable>
          );
        })}
        {isActive && (
          <Pressable style={ss.cancelBtn} onPress={onCancel}>
            <MaterialIcons name="cancel" size={18} color="#FF6B6B" />
            <Text style={ss.cancelText}>Cancel timer</Text>
          </Pressable>
        )}
      </Animated.View>
    </Modal>
  );
}

// ─── Song options sheet ───────────────────────────────────────────────────────
function SongOptionsSheet({ visible, song, onClose, onAddToPlaylist, onViewQueue, onShare }: {
  visible: boolean;
  song: Song | null;
  onClose: () => void;
  onAddToPlaylist: () => void;
  onViewQueue: () => void;
  onShare: () => void;
}) {
  const P              = usePal();
  const router         = useRouter();
  const { showAlert }  = useAppAlert();
  const translateY = useRef(new Animated.Value(H)).current;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
    } else {
      Animated.timing(translateY, { toValue: H, duration: 260, useNativeDriver: true }).start(() => setMounted(false));
    }
  }, [visible]);

  const fmtDur = (s?: number) => {
    if (!s) return "—";
    const m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const os = useMemo(() => StyleSheet.create({
    backdrop:  { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.65)" },
    sheet: {
      position: "absolute", bottom: 0, left: 0, right: 0,
      backgroundColor: P.surface,
      borderTopLeftRadius: 28, borderTopRightRadius: 28,
      paddingBottom: 32,
      ...Platform.select({
        ios: { shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.5, shadowRadius: 20 },
        android: { elevation: 20 },
      }),
    },
    handle:    { width: 36, height: 4, borderRadius: 2, backgroundColor: P.border, alignSelf: "center", marginTop: 12, marginBottom: 8 },
    songCard: {
      flexDirection: "row", alignItems: "center", gap: 12,
      marginHorizontal: 20, marginBottom: 12,
      padding: 12, borderRadius: 16,
      backgroundColor: P.card, borderWidth: 1, borderColor: P.border,
    },
    songThumb: { width: 46, height: 46, borderRadius: 10, overflow: "hidden", backgroundColor: P.card2 },
    songName:  { fontSize: 14, fontWeight: "800", color: P.text },
    songSub:   { fontSize: 12, color: P.sub, marginTop: 2 },
    divider:   { height: 1, backgroundColor: P.border, marginBottom: 4 },
    row: {
      flexDirection: "row", alignItems: "center", gap: 16,
      paddingHorizontal: 24, paddingVertical: 15,
    },
    rowLabel:  { flex: 1, fontSize: 15, color: P.text, fontWeight: "600" },
    rowSub:    { fontSize: 12, color: P.sub },
    iconBox: {
      width: 38, height: 38, borderRadius: 19,
      backgroundColor: P.card, borderWidth: 1, borderColor: P.border,
      alignItems: "center", justifyContent: "center",
    },
  }), [P]);

  if (!mounted && !visible) return null;

  const options: Array<{
    icon: React.ComponentProps<typeof MaterialIcons>["name"];
    label: string;
    sub?: string;
    onPress: () => void;
    accent?: boolean;
  }> = [
    {
      icon: "playlist-add",
      label: "Add to Playlist",
      sub: "Save to a collection",
      onPress: () => { onClose(); setTimeout(onAddToPlaylist, 300); },
    },
    {
      icon: "person",
      label: "View Artist",
      sub: song?.artist ?? "",
      onPress: () => { onClose(); setTimeout(() => router.push("/artists"), 300); },
    },
    {
      icon: "share",
      label: "Share",
      sub: "Send to a friend",
      onPress: () => { onClose(); setTimeout(onShare, 300); },
    },
    {
      icon: "queue-music",
      label: "View Queue",
      sub: "See what's playing next",
      onPress: () => { onClose(); setTimeout(onViewQueue, 200); },
    },
    {
      icon: "album",
      label: "Go to Album",
      sub: song?.albumTitle || song?.album || "Coming soon",
      onPress: () => { onClose(); setTimeout(() => showAlert("Go to Album", "Album navigation is coming soon."), 300); },
    },
    {
      icon: "equalizer",
      label: "Song Details",
      sub: song ? `${fmtDur(song.duration)}${song.genre ? ` · ${song.genre}` : ""}` : "",
      onPress: () => { onClose(); },
    },
  ];

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={os.backdrop} />
      </TouchableWithoutFeedback>
      <Animated.View style={[os.sheet, { transform: [{ translateY }] }]}>
        <View style={os.handle} />

        {/* Mini song card */}
        {song && (
          <View style={os.songCard}>
            <View style={os.songThumb}>
              {song.coverImage
                ? <Image source={{ uri: song.coverImage }} style={StyleSheet.absoluteFill} contentFit="cover" alt="" />
                : <View style={[StyleSheet.absoluteFill, { backgroundColor: P.card2, alignItems: "center", justifyContent: "center" }]}>
                    <MaterialIcons name="music-note" size={22} color={P.muted} />
                  </View>
              }
            </View>
            <View style={{ flex: 1 }}>
              <Text style={os.songName} numberOfLines={1}>{song.title}</Text>
              <Text style={os.songSub} numberOfLines={1}>{song.artist}</Text>
            </View>
            <MaterialIcons name="music-note" size={16} color={P.lime} />
          </View>
        )}

        <View style={os.divider} />

        {options.map((opt, i) => (
          <Pressable
            key={i}
            style={({ pressed }) => [os.row, pressed && { opacity: 0.6 }]}
            onPress={opt.onPress}
          >
            <View style={os.iconBox}>
              <MaterialIcons name={opt.icon} size={20} color={P.lime} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={os.rowLabel}>{opt.label}</Text>
              {!!opt.sub && <Text style={os.rowSub} numberOfLines={1}>{opt.sub}</Text>}
            </View>
            <MaterialIcons name="chevron-right" size={18} color={P.muted} />
          </Pressable>
        ))}
      </Animated.View>
    </Modal>
  );
}

// ─── Queue view ────────────────────────────────────────────────────────────────
function QueueView({ queue, currentSong, isSyncing, onPlay, onRemove, onReorder }: {
  queue: Song[]; currentSong: Song; isSyncing: boolean;
  onPlay: (s: Song) => void; onRemove: (id: string) => void; onReorder: (from: number, to: number) => void;
}) {
  const P = usePal();
  const [draggingIdx,    setDraggingIdx]    = useState<number | null>(null);
  const [hoverIdx,       setHoverIdx]       = useState<number | null>(null);
  const [scrollEnabled,  setScrollEnabled]  = useState(true);
  const dragOffsetY = useRef(new Animated.Value(0)).current;

  const queueRef     = useRef(queue);
  const onRemoveRef  = useRef(onRemove);
  const onReorderRef = useRef(onReorder);
  useEffect(() => { queueRef.current     = queue;     }, [queue]);
  useEffect(() => { onRemoveRef.current  = onRemove;  }, [onRemove]);
  useEffect(() => { onReorderRef.current = onReorder; }, [onReorder]);

  const makeDragPan = useCallback((itemIdx: number) => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: () => {
        dragOffsetY.setValue(0);
        setDraggingIdx(itemIdx); setHoverIdx(itemIdx); setScrollEnabled(false);
      },
      onPanResponderMove: (_, gs) => {
        dragOffsetY.setValue(gs.dy);
        const newIdx = Math.max(0, Math.min(queueRef.current.length - 1, itemIdx + Math.round(gs.dy / QUEUE_ROW_H)));
        setHoverIdx(newIdx);
      },
      onPanResponderRelease: (_, gs) => {
        const newIdx = Math.max(0, Math.min(queueRef.current.length - 1, itemIdx + Math.round(gs.dy / QUEUE_ROW_H)));
        if (newIdx !== itemIdx) onReorderRef.current(itemIdx, newIdx);
        setDraggingIdx(null); setHoverIdx(null); setScrollEnabled(true); dragOffsetY.setValue(0);
      },
      onPanResponderTerminate: () => {
        setDraggingIdx(null); setHoverIdx(null); setScrollEnabled(true); dragOffsetY.setValue(0);
      },
    });
  }, []);

  const ss = useMemo(() => StyleSheet.create({
    listHeader:     { paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: P.border },
    listHeaderText: { fontSize: 12, fontWeight: "700", color: P.sub, textTransform: "uppercase", letterSpacing: 1 },
    row: {
      flexDirection: "row", alignItems: "center",
      paddingVertical: 10, paddingHorizontal: 16,
      gap: 12, height: QUEUE_ROW_H,
      borderBottomWidth: 1, borderBottomColor: P.border,
      backgroundColor: P.bg,
    },
    rowActive:   { backgroundColor: P.limeGlow },
    rowDragging: {
      backgroundColor: P.card2, zIndex: 10,
      ...Platform.select({
        ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16 },
        android: { elevation: 14 },
      }),
    },
    rowDropZone:   { borderTopWidth: 2, borderTopColor: P.lime },
    dragHandle:    { width: 28, alignItems: "center" },
    thumb:         { width: 44, height: 44, borderRadius: 10, overflow: "hidden", backgroundColor: P.card },
    activeOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: P.limeGlow, alignItems: "center", justifyContent: "center" },
    title:         { fontSize: 13, fontWeight: "700", color: P.text, marginBottom: 2 },
    artist:        { fontSize: 11, color: P.sub },
    dur:           { fontSize: 11, color: P.sub, minWidth: 32, textAlign: "right" },
    removeBtn:     { width: 28, alignItems: "center" },
  }), [P]);

  if (!queue.length) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 60 }}>
        <MaterialIcons name="queue-music" size={48} color={P.muted} />
        <Text style={{ color: P.sub, fontSize: 14, marginTop: 12 }}>Queue is empty</Text>
      </View>
    );
  }

  return (
    <ScrollView scrollEnabled={scrollEnabled} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
      <View style={ss.listHeader}>
        <Text style={ss.listHeaderText}>{queue.length} songs</Text>
        {isSyncing && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <ActivityIndicator size="small" color={P.sub} />
            <Text style={{ color: P.sub, fontSize: 11 }}>Syncing…</Text>
          </View>
        )}
      </View>
      {queue.map((song, i) => {
        const isActive   = song._id === currentSong._id;
        const isDragging = draggingIdx === i;
        const isDropZone = hoverIdx === i && draggingIdx !== null && draggingIdx !== i;
        const panHandlers = makeDragPan(i).panHandlers;
        return (
          <Animated.View
            key={song._id + String(i)}
            style={[ss.row, isActive && ss.rowActive, isDragging && ss.rowDragging, isDropZone && ss.rowDropZone,
              isDragging && { transform: [{ translateY: dragOffsetY }] }]}
          >
            <View {...panHandlers} style={ss.dragHandle} hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}>
              <MaterialIcons name="drag-handle" size={22} color={isDragging ? P.lime : P.muted} />
            </View>
            <Pressable style={ss.thumb} onPress={() => onPlay(song)}>
              {song.coverImage
                ? <Image source={{ uri: song.coverImage }} style={StyleSheet.absoluteFill} contentFit="cover" />
                : <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center", backgroundColor: P.card2 }]}>
                    <MaterialIcons name="music-note" size={16} color={P.sub} />
                  </View>
              }
              {isActive && (
                <View style={ss.activeOverlay}>
                  <MaterialIcons name="graphic-eq" size={14} color={P.lime} />
                </View>
              )}
            </Pressable>
            <Pressable style={{ flex: 1 }} onPress={() => onPlay(song)}>
              <Text style={[ss.title, isActive && { color: P.lime }]} numberOfLines={1}>{song.title}</Text>
              <Text style={ss.artist} numberOfLines={1}>{song.artist}</Text>
            </Pressable>
            {!!song.duration && <Text style={ss.dur}>{fmt(song.duration)}</Text>}
            <Pressable
              onPress={() => onRemove(song._id)}
              style={({ pressed }) => [ss.removeBtn, pressed && { opacity: 0.6 }]}
              hitSlop={10}
              accessibilityLabel="Remove from queue"
            >
              <MaterialIcons name="close" size={16} color={P.muted} />
            </Pressable>
          </Animated.View>
        );
      })}
    </ScrollView>
  );
}

// ─── Bottom tab type ──────────────────────────────────────────────────────────
type Tab = "player" | "queue" | "lyrics";

// ─── Main player screen ───────────────────────────────────────────────────────
export default function PlayerScreen() {
  const {
    currentSong, queue, isPlaying, progress, elapsed, duration,
    isShuffle, isRepeat, isLoading, isBuffering, error,
    isSyncingQueue,
    togglePlay, next, prev, seek, toggleShuffle, toggleRepeat,
    playSong, removeFromQueue, reorderQueue,
    volume, setVolume,
  } = usePlayer();
  const { get }                             = useApi();
  const { isFavourite, toggleFavourite }   = useFavourites();
  const { isDark, setTheme }               = useTheme();
  const router                             = useRouter();
  const { top: topInset, bottom: botInset } = useSafeAreaInsets();

  // Active palette — re-derived whenever isDark changes
  const P = isDark ? DARK_P : LIGHT_P;

  const liked = currentSong ? isFavourite(currentSong._id) : false;

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [activeTab,         setActiveTab]         = useState<Tab>("player");
  const [showPlaylistSheet,  setShowPlaylistSheet]  = useState(false);
  const [showSongOptions,    setShowSongOptions]    = useState(false);
  const [hasLyrics,          setHasLyrics]          = useState(false);
  const { showAlert } = useAppAlert();

  async function handleShare(song: Song = currentSong!) {
    if (!song) return;
    const deepLink = Linking.createURL("player", { queryParams: { id: song._id } });
    const text = `${song.title} by ${song.artist}`;
    try {
      await Share.share(
        Platform.select({
          ios: {
            title: song.title,
            message: `Listen to ${text} on Muves`,
            url: deepLink,
          },
          default: {
            title: song.title,
            message: `Listen to ${text} on Muves\n${deepLink}`,
          },
        })!
      );
    } catch {}
  }
  const [lyricsLoading,     setLyricsLoading]     = useState(false);

  // ── Sleep timer ──────────────────────────────────────────────────────────────
  const [showTimerSheet,  setShowTimerSheet]  = useState(false);
  const [timerEndMs,      setTimerEndMs]      = useState<number | null>(null);
  const [timerMode,       setTimerMode]       = useState<"time" | "song" | null>(null);
  const [timerLabel,      setTimerLabel]      = useState("");
  const [timerRemaining,  setTimerRemaining]  = useState("");
  const timerSongIdRef  = useRef<string | null>(null);
  const isPlayingRef    = useRef(isPlaying);
  const togglePlayRef   = useRef(togglePlay);
  useEffect(() => { isPlayingRef.current  = isPlaying; },  [isPlaying]);
  useEffect(() => { togglePlayRef.current = togglePlay; }, [togglePlay]);

  useEffect(() => {
    if (!timerEndMs || timerMode !== "time") { setTimerRemaining(""); return; }
    const tick = () => {
      const rem = timerEndMs - Date.now();
      if (rem <= 0) {
        if (isPlayingRef.current) togglePlayRef.current();
        setTimerEndMs(null); setTimerMode(null); setTimerLabel(""); setTimerRemaining(""); return;
      }
      const m = Math.floor(rem / 60000);
      const s = Math.floor((rem % 60000) / 1000);
      setTimerRemaining(`${m}:${s.toString().padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [timerEndMs, timerMode]);

  useEffect(() => {
    if (timerMode !== "song" || !timerSongIdRef.current) return;
    if (currentSong && currentSong._id !== timerSongIdRef.current) {
      if (isPlayingRef.current) togglePlayRef.current();
      setTimerMode(null); setTimerLabel(""); timerSongIdRef.current = null;
    }
  }, [currentSong?._id, timerMode]);

  function activateTimer(mins: number | "song", label: string) {
    if (mins === "song") {
      timerSongIdRef.current = currentSong?._id ?? null;
      setTimerMode("song"); setTimerLabel(label);
    } else {
      setTimerEndMs(Date.now() + (mins as number) * 60_000);
      setTimerMode("time"); setTimerLabel(label);
    }
    setShowTimerSheet(false);
  }

  function cancelTimer() {
    setTimerEndMs(null); setTimerMode(null);
    setTimerLabel(""); setTimerRemaining("");
    timerSongIdRef.current = null;
  }

  // ── Track-change slide animation ──────────────────────────────────────────
  const slideAnim      = useRef(new Animated.Value(0)).current;
  const scaleAnim      = useRef(new Animated.Value(1)).current;
  const lastIdRef      = useRef<string | null>(currentSong?._id ?? null);
  const queueSnapRef   = useRef(queue);
  const [displayedSong, setDisplayedSong] = useState<Song | null>(currentSong ?? null);
  useEffect(() => { queueSnapRef.current = queue; }, [queue]);

  useEffect(() => {
    if (!currentSong) return;
    const newId = currentSong._id;
    const oldId = lastIdRef.current;
    if (oldId === newId) return;
    const q      = queueSnapRef.current;
    const oldIdx = q.findIndex(s => s._id === oldId);
    const newIdx = q.findIndex(s => s._id === newId);
    const dir    = (oldIdx === -1 || newIdx >= oldIdx) ? -1 : 1;
    lastIdRef.current = newId;
    Animated.timing(slideAnim, { toValue: W * dir, duration: 200, useNativeDriver: true }).start(() => {
      setDisplayedSong(currentSong);
      slideAnim.setValue(-W * dir);
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 90, friction: 11 }).start();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSong?._id]);

  useEffect(() => {
    if (currentSong && !displayedSong) setDisplayedSong(currentSong);
  }, [currentSong, displayedSong]);

  // ── Lyrics check ──────────────────────────────────────────────────────────
  const fetchedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!currentSong) return;
    if (fetchedFor.current === currentSong._id) return;
    fetchedFor.current = currentSong._id;
    setHasLyrics(false); setLyricsLoading(true);
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
      Animated.timing(scaleAnim, { toValue: 0.97, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 130, friction: 7 }),
    ]).start();
  }

  // ── Dynamic styles (regenerate when palette changes) ────────────────────────
  const styles = useMemo(() => makeStyles(P), [P]);

  const timerActive = !!timerMode;

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!currentSong || !displayedSong) {
    return (
      <View style={{ flex: 1, backgroundColor: P.bg, justifyContent: "center", alignItems: "center" }}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <MaterialIcons name="music-off" size={52} color={P.sub} style={{ marginBottom: 16 }} />
        <Text style={{ color: P.text, fontSize: 18, fontWeight: "700" }}>Nothing playing</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 20, padding: 14 }}>
          <Text style={{ color: P.lime, fontWeight: "700", fontSize: 15 }}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <PalCtx.Provider value={P}>
      <View style={[styles.root, { backgroundColor: P.bg }]}>
        <StatusBar style={isDark ? "light" : "dark"} />

        {/* ── Header ── */}
        <View style={[styles.header, { paddingTop: topInset + 10 }]}>
          <Pressable
            style={({ pressed }) => [styles.headerBtn, { backgroundColor: P.muted.replace("0.22", "0.09") }, pressed && { opacity: 0.65 }]}
            onPress={() => router.back()}
            accessibilityLabel="Go back"
          >
            <MaterialIcons name="expand-more" size={26} color={P.text} />
          </Pressable>

          <View style={{ alignItems: "center" }}>
            <Text style={[styles.nowPlayingLabel, { color: P.sub }]}>NOW PLAYING</Text>
            <View style={styles.headerDots}>
              <View style={[styles.dot, { backgroundColor: P.lime }]} />
              <View style={[styles.dot, { backgroundColor: P.lime }]} />
              <View style={[styles.dotLine, { backgroundColor: P.lime }]} />
              <View style={[styles.dot, { backgroundColor: P.lime }]} />
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [styles.headerBtn, { backgroundColor: P.muted.replace("0.22", "0.09") }, pressed && { opacity: 0.65 }]}
            onPress={() => handleShare()}
            accessibilityLabel="Share song"
          >
            <MaterialIcons name="share" size={20} color={P.sub} />
          </Pressable>
        </View>

        {/* ── Main area ── */}
        {activeTab === "queue" ? (
          <QueueView
            queue={queue}
            currentSong={currentSong}
            isSyncing={isSyncingQueue}
            onPlay={(s) => playSong(s, queue)}
            onRemove={removeFromQueue}
            onReorder={reorderQueue}
          />
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} bounces={false} contentContainerStyle={{ paddingBottom: 8 }}>

            {/* Art + Vinyl */}
            <View style={styles.artSection}>
              <View style={styles.vinylWrap} pointerEvents="none">
                <VinylDisc size={VINYL_SIZE} />
              </View>
              <Animated.View style={[styles.artCard, { transform: [{ scale: scaleAnim }] }]}>
                <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX: slideAnim }] }]}>
                  {displayedSong.coverImage && (
                    <Image source={{ uri: displayedSong.coverImage }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  )}
                </Animated.View>
                {!displayedSong.coverImage && (
                  <View style={[StyleSheet.absoluteFill, { backgroundColor: P.card, alignItems: "center", justifyContent: "center" }]}>
                    <MaterialIcons name="music-note" size={80} color={P.lime + "44"} />
                  </View>
                )}
                {(isLoading || isBuffering) && (
                  <View style={styles.artLoader}>
                    <ActivityIndicator size="small" color={P.lime} />
                  </View>
                )}
              </Animated.View>
            </View>

            {/* Error banner */}
            {!!error && (
              <Pressable style={styles.errorBanner} onPress={() => currentSong && playSong(currentSong, queue.length ? queue : undefined)}>
                <Text style={styles.errorText}>{error}</Text>
                <Text style={styles.errorHint}>Tap to retry</Text>
              </Pressable>
            )}

            {/* Song info */}
            <View style={styles.infoRow}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={[styles.songTitle, { color: P.text }]} numberOfLines={1}>{currentSong.title}</Text>
                <Text style={[styles.songArtist, { color: P.sub }]} numberOfLines={1}>{currentSong.artist}</Text>
              </View>
              <Pressable onPress={() => toggleFavourite(currentSong._id)} hitSlop={10} accessibilityLabel={liked ? "Unlike" : "Like"}>
                <MaterialIcons name={liked ? "favorite" : "favorite-border"} size={26} color={liked ? P.lime : P.sub} />
              </Pressable>
              <Pressable onPress={() => setShowSongOptions(true)} hitSlop={10} style={{ marginLeft: 6 }} accessibilityLabel="Song options">
                <MaterialIcons name="more-vert" size={22} color={P.sub} />
              </Pressable>
            </View>

            {/* Seek bar */}
            <View style={{ paddingHorizontal: 24 }}>
              <LinearSeekBar progress={progress} onSeek={seek} />
            </View>

            {/* Time row */}
            <View style={styles.timeRow}>
              <Text style={[styles.timeText, { color: P.sub }]}>{fmt(elapsed)}</Text>
              <Text style={[styles.timeText, { color: P.sub }]}>{fmt(duration)}</Text>
            </View>

            {/* Controls */}
            <View style={styles.controls}>
              <Pressable style={({ pressed }) => [styles.sideBtn, pressed && { opacity: 0.5 }]} onPress={toggleShuffle} accessibilityLabel="Toggle shuffle">
                <MaterialIcons name="shuffle" size={22} color={isShuffle ? P.lime : P.sub} />
                <Text style={[styles.ctrlLabel, { color: isShuffle ? P.lime : P.sub }]}>SHUFFLE</Text>
              </Pressable>

              <Pressable style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.65 }]} onPress={prev} accessibilityLabel="Previous">
                <MaterialIcons name="skip-previous" size={40} color={P.text} />
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.playBtn, { backgroundColor: P.lime }, pressed && { transform: [{ scale: 0.93 }] }]}
                onPress={() => { togglePlay(); pulseCover(); }}
                disabled={isLoading}
                accessibilityLabel={isPlaying ? "Pause" : "Play"}
              >
                {isLoading
                  ? <ActivityIndicator color={P.limeText} size="small" />
                  : <MaterialIcons name={isPlaying ? "pause" : "play-arrow"} size={42} color={P.limeText} />
                }
              </Pressable>

              <Pressable style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.65 }]} onPress={next} accessibilityLabel="Next">
                <MaterialIcons name="skip-next" size={40} color={P.text} />
              </Pressable>

              <Pressable style={({ pressed }) => [styles.sideBtn, pressed && { opacity: 0.5 }]} onPress={toggleRepeat} accessibilityLabel="Toggle repeat">
                <MaterialIcons name="repeat" size={22} color={isRepeat ? P.lime : P.sub} />
                <Text style={[styles.ctrlLabel, { color: isRepeat ? P.lime : P.sub }]}>REPEAT</Text>
              </Pressable>
            </View>

            {/* Action card */}
            <View style={[styles.actionCard, { backgroundColor: P.card, borderColor: P.border }]}>
              {/* TIMER */}
              <Pressable
                style={({ pressed }) => [styles.actionItem, pressed && { opacity: 0.6 }]}
                onPress={() => setShowTimerSheet(true)}
                accessibilityLabel="Sleep timer"
              >
                <MaterialIcons name="hourglass-empty" size={24} color={timerActive ? P.lime : P.sub} />
                <Text style={[styles.actionLabel, { color: timerActive ? P.lime : P.sub }]}>
                  {timerActive ? (timerRemaining || "ACTIVE") : "TIMER"}
                </Text>
              </Pressable>

              <View style={[styles.actionDivider, { backgroundColor: P.border }]} />

              {/* PLAYLIST */}
              <Pressable
                style={({ pressed }) => [styles.actionItem, pressed && { opacity: 0.6 }]}
                onPress={() => setShowPlaylistSheet(true)}
                accessibilityLabel="Add to playlist"
              >
                <MaterialIcons name="playlist-add" size={24} color={P.sub} />
                <Text style={[styles.actionLabel, { color: P.sub }]}>PLAYLIST</Text>
              </Pressable>

              <View style={[styles.actionDivider, { backgroundColor: P.border }]} />

              {/* THEME */}
              <Pressable
                style={({ pressed }) => [styles.actionItem, pressed && { opacity: 0.6 }]}
                onPress={() => setTheme(isDark ? "Light" : "Dark")}
                accessibilityLabel={isDark ? "Switch to light mode" : "Switch to dark mode"}
              >
                <MaterialIcons name={isDark ? "wb-sunny" : "nightlight-round"} size={24} color={P.sub} />
                <Text style={[styles.actionLabel, { color: P.sub }]}>{isDark ? "LIGHT" : "DARK"}</Text>
              </Pressable>
            </View>

            {/* Volume */}
            <View style={{ paddingHorizontal: 24, marginTop: 20, marginBottom: 6 }}>
              <VolumeSlider volume={volume} onVolume={setVolume} />
            </View>
          </ScrollView>
        )}

        {/* ── Bottom tab bar ── */}
        <View style={[styles.tabBar, { borderTopColor: P.border, backgroundColor: P.bg, paddingBottom: Math.max(botInset, 14) }]}>
          {(
            [
              { key: "player",  icon: "music-note",   label: "NOW PLAYING" },
              { key: "queue",   icon: "queue-music",  label: "QUEUE" },
              { key: "lyrics",  icon: "format-quote", label: "LYRICS" },
            ] as { key: Tab; icon: string; label: string }[]
          ).map(({ key, icon, label }) => {
            const active = activeTab === key;
            return (
              <Pressable
                key={key}
                style={({ pressed }) => [styles.tabItem, pressed && { opacity: 0.6 }]}
                onPress={() => {
                  if (key === "lyrics") {
                    if (hasLyrics) router.push("/lyrics");
                    else showAlert("No Lyrics", "Lyrics for this track haven't been added yet.");
                  } else {
                    setActiveTab(key);
                  }
                }}
                accessibilityLabel={label}
              >
                <View>
                  <MaterialIcons
                    name={icon as React.ComponentProps<typeof MaterialIcons>["name"]}
                    size={22}
                    color={active ? P.lime : P.sub}
                  />
                  {key === "queue" && queue.length > 0 && (
                    <View style={styles.queueBadge}>
                      <Text style={styles.queueBadgeText}>
                        {queue.length > 99 ? "99+" : String(queue.length)}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.tabLabel, { color: active ? P.lime : P.sub }]}>{label}</Text>
                {active && <View style={[styles.tabActiveBar, { backgroundColor: P.lime }]} />}
              </Pressable>
            );
          })}
        </View>

        {/* ── Sheets ── */}
        <SleepTimerSheet
          visible={showTimerSheet}
          activeLabel={timerLabel}
          remaining={timerRemaining}
          onSelect={activateTimer}
          onCancel={cancelTimer}
          onClose={() => setShowTimerSheet(false)}
        />
        <AddToPlaylistSheet
          visible={showPlaylistSheet}
          songId={currentSong._id}
          songTitle={currentSong.title}
          onClose={() => setShowPlaylistSheet(false)}
        />
        <SongOptionsSheet
          visible={showSongOptions}
          song={currentSong}
          onClose={() => setShowSongOptions(false)}
          onAddToPlaylist={() => setShowPlaylistSheet(true)}
          onViewQueue={() => setActiveTab("queue")}
          onShare={() => handleShare(currentSong)}
        />


      </View>
    </PalCtx.Provider>
  );
}

// ─── Static styles (layout only — colours applied inline) ─────────────────────
function makeStyles(P: Pal) {
  return StyleSheet.create({
    root: { flex: 1 },

    // Header
    header:          { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 10 },
    headerBtn:       { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
    nowPlayingLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 2, textTransform: "uppercase" },
    headerDots:      { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
    dot:             { width: 5, height: 5, borderRadius: 3 },
    dotLine:         { width: 16, height: 3, borderRadius: 2 },

    // Art
    artSection: { paddingHorizontal: 24, marginTop: 22, marginBottom: 30, height: ART_SIZE, position: "relative" },
    artCard: {
      position: "absolute", left: 24, top: 0,
      width: ART_SIZE, height: ART_SIZE,
      borderRadius: 22, overflow: "hidden",
      zIndex: 2,
      ...Platform.select({
        ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.5, shadowRadius: 32 },
        android: { elevation: 20 },
      }),
    },
    vinylWrap: {
      position: "absolute",
      right: 24 - (VINYL_SIZE - ART_SIZE) / 2 - 10,
      top: (ART_SIZE - VINYL_SIZE) / 2,
      width: VINYL_SIZE, height: VINYL_SIZE, zIndex: 1,
    },
    artLoader: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center" },

    // Error
    errorBanner: { marginHorizontal: 24, marginBottom: 8, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: "rgba(229,57,53,0.12)", borderRadius: 10, borderWidth: 1, borderColor: "rgba(229,57,53,0.25)", alignItems: "center" },
    errorText:   { color: "#FF6B6B", fontSize: 13, fontWeight: "600", textAlign: "center" },
    errorHint:   { color: "rgba(255,107,107,0.65)", fontSize: 11, marginTop: 2 },

    // Info
    infoRow:    { flexDirection: "row", alignItems: "center", paddingHorizontal: 24, marginBottom: 4 },
    songTitle:  { fontSize: 22, fontWeight: "900", letterSpacing: -0.5 },
    songArtist: { fontSize: 14, marginTop: 3 },

    // Time
    timeRow:  { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 26, marginBottom: 4 },
    timeText: { fontSize: 11, fontWeight: "600" },

    // Controls
    controls:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, marginBottom: 20 },
    sideBtn:   { width: 52, alignItems: "center", gap: 4 },
    ctrlLabel: { fontSize: 8, fontWeight: "800", letterSpacing: 0.8 },
    navBtn:    { width: 52, height: 52, alignItems: "center", justifyContent: "center" },
    playBtn: {
      width: 76, height: 76, borderRadius: 38,
      alignItems: "center", justifyContent: "center",
      ...Platform.select({
        ios: { shadowColor: P.lime, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.55, shadowRadius: 20 },
        android: { elevation: 14 },
      }),
    },

    // Action card
    actionCard:    { marginHorizontal: 20, borderRadius: 18, borderWidth: 1, flexDirection: "row", alignItems: "center", paddingVertical: 4 },
    actionItem:    { flex: 1, alignItems: "center", paddingVertical: 14, gap: 6 },
    actionLabel:   { fontSize: 7.5, fontWeight: "800", letterSpacing: 0.6 },
    actionDivider: { width: 1, height: 36 },

    // Tab bar
    tabBar:      { flexDirection: "row", borderTopWidth: 1, paddingTop: 10 },
    tabItem:     { flex: 1, alignItems: "center", gap: 3, position: "relative", paddingBottom: 2 },
    tabLabel:    { fontSize: 7, fontWeight: "800", letterSpacing: 0.5 },
    tabActiveBar:{ position: "absolute", bottom: -2, left: "25%", right: "25%", height: 2, borderRadius: 1 },
    // Queue count badge
    queueBadge: {
      position: "absolute", top: -5, right: -8,
      minWidth: 15, height: 15, borderRadius: 8,
      backgroundColor: P.lime,
      alignItems: "center", justifyContent: "center",
      paddingHorizontal: 3,
    },
    queueBadgeText: { fontSize: 8, fontWeight: "900", color: P.limeText, lineHeight: 11 },
  });
}
