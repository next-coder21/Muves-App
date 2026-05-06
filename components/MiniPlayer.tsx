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

const LIME = "#C8FF00";
const TEXT = "#f5f5f5";
const MUTED = "#777";

export default function MiniPlayer() {
  const { currentSong, isPlaying, progress, togglePlay, next } = usePlayer();
  const router = useRouter();
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
      <BlurView intensity={55} tint="dark" style={styles.blur}>
        {/* Progress line */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${(progress * 100).toFixed(1)}%` as any }]} />
        </View>

        <Pressable style={styles.inner} onPress={() => router.push("/player")}>
          {/* Cover */}
          <View style={styles.cover}>
            {currentSong.coverImage ? (
              <Image source={{ uri: currentSong.coverImage }} style={StyleSheet.absoluteFill} />
            ) : (
              <View style={[StyleSheet.absoluteFill, styles.coverFallback]}>
                <MaterialIcons name="music-note" size={20} color={LIME} />
              </View>
            )}
          </View>

          {/* Song info */}
          <View style={styles.info}>
            <Text style={styles.title} numberOfLines={1}>{currentSong.title}</Text>
            <Text style={styles.artist} numberOfLines={1}>{currentSong.artist}</Text>
          </View>

          {/* Controls */}
          <Pressable
            style={({ pressed }) => [styles.ctrlBtn, pressed && { opacity: 0.5 }]}
            onPress={(e) => { e.stopPropagation(); togglePlay(); }}
            hitSlop={8}
          >
            <MaterialIcons name={isPlaying ? "pause" : "play-arrow"} size={22} color={LIME} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.ctrlBtn, pressed && { opacity: 0.5 }]}
            onPress={(e) => { e.stopPropagation(); next(); }}
            hitSlop={8}
          >
            <MaterialIcons name="skip-next" size={22} color={LIME} />
          </Pressable>
        </Pressable>
      </BlurView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 10,
    marginBottom: 6,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  blur: {
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  progressTrack: {
    height: 2,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  progressFill: {
    height: "100%",
    backgroundColor: LIME,
    borderRadius: 1,
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 12,
  },
  cover: {
    width: 42,
    height: 42,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#1f1f1f",
  },
  coverFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1f1f1f",
  },
  info: { flex: 1 },
  title: { fontSize: 13, fontWeight: "700", color: TEXT },
  artist: { fontSize: 11, color: MUTED, marginTop: 2 },
  ctrlBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  ctrlIcon: { fontSize: 19, color: LIME },
});
