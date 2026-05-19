import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useDownloads } from "@/context/DownloadsContext";
import { Song } from "@/context/PlayerContext";

const LIME = "#C8FF00";
const MUTED = "#555";
const RED = "#ff4d4d";

type Props = {
  song: Song;
  size?: number;
};

export default function DownloadButton({ song, size = 22 }: Props) {
  const { isDownloaded, getProgress, downloadSong, deleteDownload } = useDownloads();

  const downloaded = isDownloaded(song._id);
  const prog = getProgress(song._id);
  const isDownloading = prog?.status === "downloading";
  const hasError = prog?.status === "error";

  async function handlePress() {
    if (downloaded) {
      Alert.alert(
        "Remove Download",
        `Remove "${song.title}" from downloads?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Remove", style: "destructive", onPress: () => deleteDownload(song._id) },
        ],
      );
      return;
    }
    if (isDownloading) return;
    try {
      await downloadSong(song);
    } catch {
      Alert.alert("Download failed", "Could not download this song. Try again.");
    }
  }

  if (isDownloading) {
    const pct = Math.round((prog?.ratio ?? 0) * 100);
    return (
      <Pressable style={styles.btn} hitSlop={12} disabled>
        <View style={styles.progressRing}>
          <ActivityIndicator size="small" color={LIME} />
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.btn, pressed && { opacity: 0.6 }]}
      onPress={handlePress}
      hitSlop={12}
    >
      <MaterialIcons
        name={downloaded ? "download-done" : hasError ? "error-outline" : "download"}
        size={size}
        color={downloaded ? LIME : hasError ? RED : MUTED}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { padding: 4 },
  progressRing: { width: 22, height: 22, alignItems: "center", justifyContent: "center" },
});
