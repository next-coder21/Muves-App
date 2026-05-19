import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useEffect, useRef } from "react";
import { BlurView } from "expo-blur";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { usePlayer } from "@/context/PlayerContext";
import { useColors } from "@/context/ThemeContext";

const LIME = "#C8FF00";

export default function MiniPlayer() {
  const { currentSong, isPlaying, progress, togglePlay, next } = usePlayer();
  const router = useRouter();
  const c = useColors();
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (currentSong) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 10 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [currentSong?._id]);

  if (!currentSong) return null;

  return (
    <Animated.View style={[styles.wrapper, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}>
      <BlurView intensity={55} tint={c.tint} style={[styles.blur, { borderColor: c.cardBorder }]}>
        <View style={[styles.progressTrack, { backgroundColor: c.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)" }]}>
          <View style={[styles.progressFill, { width: `${(progress * 100).toFixed(1)}%` as `${number}%` }]} />
        </View>

        <Pressable style={styles.inner} onPress={() => router.push("/player")}>
          <View style={[styles.cover, { backgroundColor: c.card2 }]}>
            {currentSong.coverImage ? (
              <Image source={{ uri: currentSong.coverImage }} style={StyleSheet.absoluteFill} />
            ) : (
              <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center", backgroundColor: c.card2 }]}>
                <MaterialIcons name="music-note" size={20} color={LIME} />
              </View>
            )}
          </View>

          <View style={styles.info}>
            <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>{currentSong.title}</Text>
            <Text style={[styles.artist, { color: c.muted }]} numberOfLines={1}>{currentSong.artist}</Text>
          </View>

          <Pressable style={({ pressed }) => [styles.ctrlBtn, pressed && { opacity: 0.5 }]} onPress={(e) => { e.stopPropagation(); togglePlay(); }} hitSlop={8}>
            <MaterialIcons name={isPlaying ? "pause" : "play-arrow"} size={22} color={LIME} />
          </Pressable>
          <Pressable style={({ pressed }) => [styles.ctrlBtn, pressed && { opacity: 0.5 }]} onPress={(e) => { e.stopPropagation(); next(); }} hitSlop={8}>
            <MaterialIcons name="skip-next" size={22} color={LIME} />
          </Pressable>
        </Pressable>
      </BlurView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginHorizontal: 10, marginBottom: 6, borderRadius: 20, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 10 },
  blur: { borderRadius: 20, overflow: "hidden", borderWidth: 1 },
  progressTrack: { height: 2 },
  progressFill: { height: "100%", backgroundColor: LIME, borderRadius: 1 },
  inner: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 11, gap: 12 },
  cover: { width: 42, height: 42, borderRadius: 10, overflow: "hidden" },
  info: { flex: 1 },
  title: { fontSize: 13, fontWeight: "700" },
  artist: { fontSize: 11, marginTop: 2 },
  ctrlBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
});
