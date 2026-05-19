import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, Image, PermissionsAndroid, Platform, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import "react-native-reanimated";

import { AuthProvider, useAuth } from "@/context/AuthContext";
import { useAppUpdate } from "@/hooks/useAppUpdate";
import UpdateModal from "@/components/UpdateModal";
import { ThemeProvider as AppThemeProvider, useTheme } from "@/context/ThemeContext";
import { PlayerProvider } from "@/context/PlayerContext";
import { FavouritesProvider } from "@/context/FavouritesContext";
import { PlaylistProvider } from "@/context/PlaylistContext";
import { NetworkProvider, useNetwork } from "@/context/NetworkContext";
import { LocalSongsProvider } from "@/context/LocalSongsContext";

export const unstable_settings = {
  anchor: "(tabs)",
};

const LIME = "#C8FF00";

function SplashLoading() {
  return (
    <View style={splash.container}>
      <LinearGradient colors={["#1a0a2e", "#0d0d0d"]} style={StyleSheet.absoluteFill} />
      <Image
        source={require("../assets/images/splash-icon.png")}
        style={splash.logo}
        resizeMode="contain"
      />
      <Text style={splash.tagline}>Your music, your world</Text>
      <ActivityIndicator color={LIME} style={{ marginTop: 32 }} size="small" />
    </View>
  );
}

// Routes that an unauthenticated user is allowed to view. Anything else
// triggers a redirect to /login.
const AUTH_ROUTES = new Set(["login", "signup", "forgot-password"]);

function AuthGate() {
  const { user, loading } = useAuth();
  const { isOnline, isOfflineMode } = useNetwork();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const top = segments[0] ?? "";
    const inAuthGroup = AUTH_ROUTES.has(top);
    const onOfflineScreen = top === "offline";

    // Offline with no user → offline screen (can still reach downloads)
    if (!isOnline && !user && !isOfflineMode && !onOfflineScreen) {
      router.replace("/offline");
      return;
    }
    // User is online or in offline mode — standard auth routing
    // isOfflineMode grants access to the main tab stack without a user account
    // so that local songs remain reachable without credentials.
    if (!user && !inAuthGroup && !onOfflineScreen && !isOfflineMode) {
      router.replace("/login");
    } else if (user && inAuthGroup) {
      router.replace("/(tabs)");
    } else if (user && onOfflineScreen) {
      router.replace("/(tabs)");
    }
  }, [user, loading, segments, router, isOnline, isOfflineMode]);

  return null;
}

function RootLayoutInner() {
  const { loading } = useAuth();
  const { isDark } = useTheme();
  const { state: updateState, downloadUpdate } = useAppUpdate();
  const [updateDismissed, setUpdateDismissed] = useState(false);

  if (loading) {
    return <SplashLoading />;
  }

  return (
    <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <AuthGate />
      <Stack>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="signup" options={{ headerShown: false, animation: "slide_from_right" }} />
        <Stack.Screen name="forgot-password" options={{ headerShown: false, animation: "slide_from_right" }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="player"
          options={{
            headerShown: false,
            presentation: "modal",
            animation: "slide_from_bottom",
          }}
        />
        <Stack.Screen name="modal" options={{ presentation: "modal", title: "Modal" }} />
        <Stack.Screen name="playlist/[id]" options={{ headerShown: false, animation: "slide_from_right" }} />
        <Stack.Screen name="album/[id]" options={{ headerShown: false, animation: "slide_from_right" }} />
        <Stack.Screen name="artists" options={{ headerShown: false, animation: "slide_from_right" }} />
        <Stack.Screen name="offline" options={{ headerShown: false }} />
      </Stack>
      {updateState.status === "available" && !updateDismissed && (
        <UpdateModal
          info={updateState.info}
          onUpdate={() => { downloadUpdate(updateState.info.apkUrl!); }}
          onDismiss={() => setUpdateDismissed(true)}
        />
      )}
    </ThemeProvider>
  );
}

// Request POST_NOTIFICATIONS on Android 13+ (API level 33+).
// expo-audio's config plugin only injects this permission when
// enableBackgroundRecording is set; for playback-only apps we request it
// manually so lock-screen / notification controls work without crashing.
function useNotificationPermission() {
  useEffect(() => {
    if (Platform.OS !== "android") return;
    // PermissionsAndroid.REQUEST_INSTALL_PACKAGES does not exist on older APIs;
    // guard with the string constant so the call is a no-op below API 33.
    const POST_NOTIFICATIONS = "android.permission.POST_NOTIFICATIONS";
    PermissionsAndroid.request(POST_NOTIFICATIONS).catch(() => {
      // Permission unavailable on this API level — silently ignore.
    });
  }, []);
}

export default function RootLayout() {
  useNotificationPermission();
  return (
    <AppThemeProvider>
    <NetworkProvider>
      <AuthProvider>
        <PlayerProvider>
          <LocalSongsProvider>
            <FavouritesProvider>
              <PlaylistProvider>
                <StatusBar style="light" />
                <RootLayoutInner />
              </PlaylistProvider>
            </FavouritesProvider>
          </LocalSongsProvider>
        </PlayerProvider>
      </AuthProvider>
    </NetworkProvider>
    </AppThemeProvider>
  );
}

const splash = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0d0d0d",
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 280,
    height: 140,
    marginBottom: 16,
  },
  tagline: { fontSize: 14, color: "#888", marginTop: 4 },
});
