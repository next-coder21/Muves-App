import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useRef, useState } from "react";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "@/context/AuthContext";

const LIME = "#C8FF00";
const BG = "#0d0d0d";
const CARD = "#141414";
const BORDER = "#222";
const TEXT = "#f5f5f5";
const MUTED = "#666";

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();
  const passwordRef = useRef<TextInput>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  async function handleLogin() {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      Alert.alert("Missing fields", "Please enter your email and password.");
      return;
    }
    // Minimal client-side checks — server is the real authority but these
    // catch obvious typos before a round trip.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      Alert.alert("Invalid email", "Please enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Password too short", "Passwords are at least 6 characters.");
      return;
    }
    Keyboard.dismiss();
    setLoading(true);
    try {
      await login(trimmedEmail, password);
      router.replace("/(tabs)");
    } catch (err: unknown) {
      const msg = err instanceof Error && err.message ? err.message : "Login failed";
      Alert.alert("Login failed", msg);
    } finally {
      setLoading(false);
    }
  }

  // (no longer needed — the sign-up and forgot-password screens are now real
  // routes; left here as a placeholder for future flows that aren't built yet.)

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <StatusBar style="light" />

        {/* Background gradient */}
        <LinearGradient
          colors={["#1a1a0a", "#0d0d0d", "#0d0d0d"]}
          style={StyleSheet.absoluteFill}
        />

        {/* Glow blobs */}
        <View style={styles.blob1} />
        <View style={styles.blob2} />

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.inner}
        >
          {/* Logo */}
          <View style={styles.logoArea}>
            <View style={styles.logoIcon}>
              <Text style={styles.logoGlyph}>♫</Text>
            </View>
            <Text style={styles.appName}>Muves</Text>
            <Text style={styles.tagline}>Your music, your world</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Welcome back</Text>
            <Text style={styles.cardSubtitle}>Sign in to continue listening</Text>

            {/* Email */}
            <View style={[styles.inputWrapper, emailFocused && styles.inputFocused]}>
              <Text style={styles.inputIcon}>✉</Text>
              <TextInput
                style={styles.input}
                placeholder="Email address"
                placeholderTextColor={MUTED}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                returnKeyType="next"
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
            </View>

            {/* Password */}
            <View style={[styles.inputWrapper, passwordFocused && styles.inputFocused]}>
              <Text style={styles.inputIcon}>🔒</Text>
              <TextInput
                ref={passwordRef}
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={MUTED}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoComplete="password"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
              />
              <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={10}>
                <Text style={styles.eyeIcon}>{showPassword ? "🙈" : "👁️"}</Text>
              </Pressable>
            </View>

            {/* Forgot password */}
            <Pressable style={styles.forgotRow} hitSlop={8} onPress={() => router.push("/forgot-password")}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </Pressable>

            {/* Sign in button */}
            <Pressable
              style={({ pressed }) => [
                styles.loginBtn,
                pressed && styles.loginBtnPressed,
                loading && styles.loginBtnDisabled,
              ]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.loginBtnText}>Sign in</Text>
              )}
            </Pressable>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Sign up */}
            <View style={styles.signupRow}>
              <Text style={styles.signupText}>{"Don't have an account? "}</Text>
              <Pressable hitSlop={8} onPress={() => router.push("/signup")}>
                <Text style={styles.signupLink}>Sign up</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  blob1: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "#556600",
    opacity: 0.15,
    top: -100,
    right: -80,
  },
  blob2: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "#333a00",
    opacity: 0.2,
    bottom: 60,
    left: -60,
  },

  inner: { flex: 1, justifyContent: "center", paddingHorizontal: 24 },

  logoArea: { alignItems: "center", marginBottom: 40 },
  logoIcon: {
    width: 76,
    height: 76,
    borderRadius: 22,
    backgroundColor: LIME,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    shadowColor: LIME,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 12,
  },
  logoGlyph: { fontSize: 34, color: "#000" },
  appName: { fontSize: 34, fontWeight: "800", color: TEXT, letterSpacing: 1 },
  tagline: { fontSize: 14, color: MUTED, marginTop: 5 },

  card: {
    backgroundColor: CARD,
    borderRadius: 28,
    padding: 28,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 10,
  },
  cardTitle: { fontSize: 22, fontWeight: "800", color: TEXT, marginBottom: 4 },
  cardSubtitle: { fontSize: 14, color: MUTED, marginBottom: 24 },

  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 14,
    marginBottom: 14,
    height: 54,
  },
  inputFocused: { borderColor: LIME + "88" },
  inputIcon: { fontSize: 16, marginRight: 10 },
  input: { flex: 1, color: TEXT, fontSize: 15, height: 54 },
  eyeIcon: { fontSize: 16, padding: 4 },

  forgotRow: { alignSelf: "flex-end", marginBottom: 22 },
  forgotText: { color: LIME, fontSize: 13, fontWeight: "600" },

  loginBtn: {
    backgroundColor: LIME,
    borderRadius: 16,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: LIME,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  loginBtnPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  loginBtnDisabled: { opacity: 0.6 },
  loginBtnText: { color: "#000", fontSize: 16, fontWeight: "800", letterSpacing: 0.3 },

  divider: { flexDirection: "row", alignItems: "center", marginVertical: 22 },
  dividerLine: { flex: 1, height: 1, backgroundColor: BORDER },
  dividerText: { color: MUTED, fontSize: 13, marginHorizontal: 12 },

  signupRow: { flexDirection: "row", justifyContent: "center", alignItems: "center" },
  signupText: { color: MUTED, fontSize: 14 },
  signupLink: { color: LIME, fontSize: 14, fontWeight: "700" },
});
