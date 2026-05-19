import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { useNetwork } from "@/context/NetworkContext";

const LIME = "#C8FF00";
const BG = "#0d0d0d";
const TEXT = "#f5f5f5";
const MUTED = "#555";

export default function OfflineScreen() {
  const router = useRouter();
  const { isOnline, setOfflineMode } = useNetwork();
  const [retrying, setRetrying] = useState(false);

  async function handleRetry() {
    setRetrying(true);
    // Give NetInfo a moment to detect the connection
    await new Promise((r) => setTimeout(r, 1500));
    setRetrying(false);
    if (isOnline) router.replace("/login");
  }

  function handlePlayOffline() {
    setOfflineMode(true);
    router.replace("/(tabs)");
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient colors={["#0a0a00", "#0d0d0d"]} style={StyleSheet.absoluteFill} />

      <View style={styles.iconWrap}>
        <MaterialIcons name="wifi-off" size={56} color={MUTED} />
      </View>

      <Text style={styles.title}>You're Offline</Text>
      <Text style={styles.sub}>
        No internet connection detected.{"\n"}
        You can still listen to songs stored on your device.
      </Text>

      {/* Play downloads */}
      <Pressable
        style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
        onPress={handlePlayOffline}
      >
        <MaterialIcons name="phone-android" size={22} color="#000" />
        <Text style={styles.primaryBtnText}>Play Local Songs</Text>
      </Pressable>

      {/* Retry */}
      <Pressable
        style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.7 }]}
        onPress={handleRetry}
        disabled={retrying}
      >
        {retrying
          ? <ActivityIndicator size="small" color={LIME} />
          : <MaterialIcons name="refresh" size={20} color={LIME} />
        }
        <Text style={styles.secondaryBtnText}>
          {retrying ? "Checking…" : "Retry Connection"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: TEXT,
    marginBottom: 12,
  },
  sub: {
    fontSize: 15,
    color: MUTED,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 40,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: LIME,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
    width: "100%",
    justifyContent: "center",
    marginBottom: 14,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#000",
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: "100%",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(200,255,0,0.3)",
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: LIME,
  },
});
