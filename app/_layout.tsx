import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import "react-native-reanimated";

import { AuthProvider, useAuth } from "@/context/AuthContext";
import { PlayerProvider } from "@/context/PlayerContext";
import { FavouritesProvider } from "@/context/FavouritesContext";
import { PlaylistProvider } from "@/context/PlaylistContext";

export const unstable_settings = {
  anchor: "(tabs)",
};

const LIME = "#C8FF00";

function SplashLoading() {
  return (
    <View style={splash.container}>
      <LinearGradient colors={["#1a1a0a", "#0d0d0d"]} style={StyleSheet.absoluteFill} />
      <View style={splash.logoIcon}>
        <Text style={splash.logoGlyph}>♫</Text>
      </View>
      <Text style={splash.appName}>Muves</Text>
      <Text style={splash.tagline}>Your music, your world</Text>
      <ActivityIndicator color={LIME} style={{ marginTop: 40 }} size="small" />
    </View>
  );
}

// Routes that an unauthenticated user is allowed to view. Anything else
// triggers a redirect to /login.
const AUTH_ROUTES = new Set(["login", "signup", "forgot-password"]);

function AuthGate() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const top = segments[0] ?? "";
    const inAuthGroup = AUTH_ROUTES.has(top);
    if (!user && !inAuthGroup) {
      router.replace("/login");
    } else if (user && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [user, loading, segments, router]);

  return null;
}

function RootLayoutInner() {
  const { loading } = useAuth();

  if (loading) {
    return <SplashLoading />;
  }

  return (
    <>
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
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <PlayerProvider>
        <FavouritesProvider>
          <PlaylistProvider>
            <ThemeProvider value={DarkTheme}>
              <StatusBar style="light" />
              <RootLayoutInner />
            </ThemeProvider>
          </PlaylistProvider>
        </FavouritesProvider>
      </PlayerProvider>
    </AuthProvider>
  );
}

const splash = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0d0d0d",
    alignItems: "center",
    justifyContent: "center",
  },
  logoIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: LIME,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    shadowColor: LIME,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 12,
  },
  logoGlyph: { fontSize: 36, color: "#000" },
  appName: { fontSize: 36, fontWeight: "800", color: "#f5f5f5", letterSpacing: 1 },
  tagline: { fontSize: 14, color: "#666", marginTop: 6 },
});
