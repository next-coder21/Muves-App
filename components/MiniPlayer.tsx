import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useEffect, useRef } from "react";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { usePlayer } from "@/context/PlayerContext";

const RED = "#E53935";

export default function MiniPlayer() {
  const { currentSong, isPlaying, progress, togglePlay, next, prev } = usePlayer();
  const router = useRouter();
  const scaleAnim   = useRef(new Animated.Value(0.96)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (currentSong) {
      Animated.parallel([
        Animated.spring(scaleAnim,   { toValue: 1, useNativeDriver: true, tension: 80, friction: 10 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [currentSong?._id]);

  if (!currentSong) return null;

  return (
    <Animated.View style={[styles.wrapper, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}>
      {/* Progress bar at top */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${(progress * 100).toFixed(1)}%` as `${number}%` }]} />
      </View>

      <Pressable style={styles.inner} onPress={() => router.push("/player")}>
        {/* Album art */}
        <View style={styles.art}>
          {currentSong.coverImage ? (
            <Image source={{ uri: currentSong.coverImage }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.artFallback]}>
              <MaterialIcons name="music-note" size={18} color={RED} />
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>{currentSong.title}</Text>
          <Text style={styles.artist} numberOfLines={1}>{currentSong.artist}</Text>
        </View>

        {/* Controls — stop propagation so taps don't open the player */}
        <Pressable style={styles.controls} onPress={(e) => e.stopPropagation?.()}>
          <Pressable
            style={({ pressed }) => [styles.ctrlBtn, pressed && { opacity: 0.5 }]}
            onPress={(e) => { e.stopPropagation?.(); prev(); }}
            hitSlop={8}
            accessibilityLabel="Previous song"
          >
            <MaterialIcons name="skip-previous" size={24} color="#555" />
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.playBtn, pressed && { opacity: 0.85 }]}
            onPress={(e) => { e.stopPropagation?.(); togglePlay(); }}
            hitSlop={8}
            accessibilityLabel={isPlaying ? "Pause" : "Play"}
          >
            <MaterialIcons name={isPlaying ? "pause" : "play-arrow"} size={22} color="#fff" />
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.ctrlBtn, pressed && { opacity: 0.5 }]}
            onPress={(e) => { e.stopPropagation?.(); next(); }}
            hitSlop={8}
            accessibilityLabel="Next song"
          >
            <MaterialIcons name="skip-next" size={24} color={RED} />
          </Pressable>
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 10,
    marginBottom: 6,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#EEEEEE",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
      },
      android: { elevation: 8 },
    }),
  },
  progressTrack: { height: 3, backgroundColor: "#F0F0F0" },
  progressFill: { height: "100%", backgroundColor: RED, borderRadius: 1 },

  inner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 12,
  },

  art: {
    width: 42,
    height: 42,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#F5F5F5",
  },
  artFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FDECEA",
  },

  info: { flex: 1 },
  title:  { fontSize: 13, fontWeight: "700", color: "#1A1A1A" },
  artist: { fontSize: 11, color: "#9E9E9E", marginTop: 2 },

  controls: { flexDirection: "row", alignItems: "center", gap: 4 },
  ctrlBtn:  { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: RED,
    alignItems: "center",
    justifyContent: "center",
  },
});
