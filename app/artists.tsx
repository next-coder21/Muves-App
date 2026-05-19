import {
  ActivityIndicator, Image, Pressable,
  ScrollView, StyleSheet, Text, View,
} from "react-native";
import { useEffect, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { useApi } from "@/hooks/useApi";
import { API } from "@/constants/api";
import { normalizeArtists } from "@/utils/normalize";
import { usePlayerInset } from "@/hooks/usePlayerInset";

type Artist = {
  _id: string;
  name: string;
  image?: string;
  verified?: boolean;
  songCount?: number | string;
};

const LIME = "#C8FF00";
const BG = "#0d0d0d";
const TEXT = "#f5f5f5";
const MUTED = "#666";
const CARD_BORDER = "rgba(255,255,255,0.08)";

export default function ArtistsScreen() {
  const { get } = useApi();
  const router = useRouter();
  const bottomInset = usePlayerInset();
  const { top: topInset } = useSafeAreaInsets();

  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ctrl = new AbortController();
    get<unknown>(API.ARTISTS_URL, { signal: ctrl.signal })
      .then(d => { if (!ctrl.signal.aborted) setArtists(normalizeArtists(d)); })
      .catch((e: unknown) => { if ((e as { name?: string })?.name === "AbortError") return; })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    return () => ctrl.abort();
  }, [get]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient colors={["#111100", "#0d0d0d"]} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: topInset + 8 }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={10}>
          <MaterialIcons name="arrow-back-ios" size={24} color={TEXT} />
        </Pressable>
        <Text style={styles.headerTitle}>All Artists</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={LIME} />
        </View>
      ) : artists.length === 0 ? (
        <View style={styles.center}>
          <MaterialIcons name="mic-off" size={52} color={MUTED} style={{ marginBottom: 12 }} />
          <Text style={{ color: TEXT, fontWeight: "700", fontSize: 16 }}>No artists found</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.grid, { paddingBottom: bottomInset + 16 }]}
        >
          {artists.map((artist, i) => (
            <Pressable
              key={artist._id ?? String(i)}
              style={({ pressed }) => [styles.artistCard, pressed && { opacity: 0.75 }]}
              onPress={() => router.push(`/(tabs)/explore?artist=${encodeURIComponent(artist.name)}`)}
            >
              <View style={styles.artistImg}>
                {artist.image ? (
                  <Image source={{ uri: artist.image }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                ) : (
                  <View style={[StyleSheet.absoluteFill, styles.artistFallback]}>
                    <MaterialIcons name="mic" size={32} color={MUTED} />
                  </View>
                )}
                <LinearGradient
                  colors={["transparent", "rgba(0,0,0,0.5)"]}
                  style={StyleSheet.absoluteFill}
                />
              </View>
              <Text style={styles.artistName} numberOfLines={1}>{artist.name}</Text>
              {!!artist.songCount && (
                <Text style={styles.artistMeta}>{artist.songCount} songs</Text>
              )}
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const ITEM_SIZE = 160;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 20, fontWeight: "800", color: TEXT },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 12,
  },

  artistCard: {
    width: ITEM_SIZE,
    alignItems: "center",
  },
  artistImg: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  artistFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1a1a1a",
  },
  artistName: { fontSize: 13, fontWeight: "700", color: TEXT, textAlign: "center" },
  artistMeta: { fontSize: 11, color: MUTED, marginTop: 2 },
});
