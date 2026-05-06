import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
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
import { API } from "@/constants/api";
import { useAuth } from "@/context/AuthContext";
import { ApiError, apiRequest } from "@/utils/apiClient";

const LIME = "#C8FF00";
const BG = "#0d0d0d";
const CARD = "#141414";
const BORDER = "#222";
const TEXT = "#f5f5f5";
const MUTED = "#666";

export default function SignupScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const securityRef = useRef<TextInput>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSignup() {
    const trimmedName  = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedAns   = securityAnswer.trim();

    if (!trimmedName) return Alert.alert("Missing name", "What should we call you?");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail))
      return Alert.alert("Invalid email", "Enter a valid email address.");
    if (password.length < 8)
      return Alert.alert("Weak password", "Password must be at least 8 characters.");
    if (!trimmedAns)
      return Alert.alert(
        "Security keyword required",
        "Pick a memorable word — you'll need it to recover your password."
      );

    Keyboard.dismiss();
    setLoading(true);
    try {
      await apiRequest(API.REGISTER, {
        method: "POST",
        body: {
          name: trimmedName,
          email: trimmedEmail,
          password,
          securityAnswer: trimmedAns,
        },
        timeoutMs: 60_000,
        skipAuthErrorHook: true,
      });

      // Backend auto-verifies new accounts, so we can sign the user straight in.
      try {
        await login(trimmedEmail, password);
        router.replace("/(tabs)");
      } catch {
        // Registration succeeded but auto-login failed for some reason —
        // surface a friendly hand-off back to the login screen.
        Alert.alert(
          "Account created",
          "You're all set — sign in with your new credentials.",
          [{ text: "OK", onPress: () => router.replace("/login") }]
        );
      }
    } catch (err) {
      const msg = err instanceof ApiError && err.message
        ? err.message
        : err instanceof Error ? err.message : "Sign up failed";
      Alert.alert("Sign up failed", msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <StatusBar style="light" />
        <LinearGradient colors={["#1a1a0a", "#0d0d0d", "#0d0d0d"]} style={StyleSheet.absoluteFill} />

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.headerRow}>
              <Pressable hitSlop={12} onPress={() => router.back()}>
                <Text style={styles.backIcon}>‹</Text>
              </Pressable>
              <Text style={styles.headerTitle}>Create account</Text>
              <View style={{ width: 28 }} />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Welcome to Muves</Text>
              <Text style={styles.cardSubtitle}>Start listening in seconds</Text>

              <Field label="Name">
                <TextInput
                  style={styles.input}
                  placeholder="Your name"
                  placeholderTextColor={MUTED}
                  value={name}
                  onChangeText={setName}
                  returnKeyType="next"
                  onSubmitEditing={() => emailRef.current?.focus()}
                  autoCapitalize="words"
                  autoComplete="name"
                />
              </Field>

              <Field label="Email">
                <TextInput
                  ref={emailRef}
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor={MUTED}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                />
              </Field>

              <Field label="Password">
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <TextInput
                    ref={passwordRef}
                    style={[styles.input, { flex: 1 }]}
                    placeholder="At least 8 characters"
                    placeholderTextColor={MUTED}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoComplete="password-new"
                    returnKeyType="next"
                    onSubmitEditing={() => securityRef.current?.focus()}
                  />
                  <Pressable onPress={() => setShowPassword(v => !v)} hitSlop={10}>
                    <Text style={styles.eye}>{showPassword ? "🙈" : "👁️"}</Text>
                  </Pressable>
                </View>
              </Field>

              <Field
                label="Security keyword"
                hint="Used to recover your password if you forget it. Pick something memorable."
              >
                <TextInput
                  ref={securityRef}
                  style={styles.input}
                  placeholder='e.g. "first pet"'
                  placeholderTextColor={MUTED}
                  value={securityAnswer}
                  onChangeText={setSecurityAnswer}
                  autoCapitalize="none"
                  returnKeyType="done"
                  onSubmitEditing={handleSignup}
                />
              </Field>

              <Pressable
                style={({ pressed }) => [
                  styles.btn,
                  pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                  loading && { opacity: 0.6 },
                ]}
                onPress={handleSignup}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#000" />
                  : <Text style={styles.btnText}>Create account</Text>}
              </Pressable>

              <View style={styles.footer}>
                <Text style={styles.footerText}>Already have an account? </Text>
                <Pressable hitSlop={8} onPress={() => router.replace("/login")}>
                  <Text style={styles.footerLink}>Sign in</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </TouchableWithoutFeedback>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldBox}>{children}</View>
      {hint && <Text style={styles.fieldHint}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  scroll: { paddingBottom: 32, paddingTop: 56 },
  headerRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, marginBottom: 16,
  },
  backIcon: { fontSize: 32, color: TEXT, fontWeight: "300", width: 28, textAlign: "center" },
  headerTitle: { fontSize: 16, fontWeight: "700", color: TEXT },

  card: {
    marginHorizontal: 20, padding: 24, borderRadius: 24,
    backgroundColor: CARD, borderWidth: 1, borderColor: BORDER,
  },
  cardTitle: { fontSize: 22, fontWeight: "800", color: TEXT, marginBottom: 4 },
  cardSubtitle: { fontSize: 13, color: MUTED, marginBottom: 22 },

  field: { marginBottom: 14 },
  fieldLabel: { fontSize: 12, color: MUTED, fontWeight: "700", marginBottom: 6, letterSpacing: 0.5 },
  fieldBox: {
    backgroundColor: "#1a1a1a",
    borderRadius: 14, borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 14, height: 50, justifyContent: "center",
  },
  fieldHint: { fontSize: 11, color: MUTED, marginTop: 6, lineHeight: 16 },
  input: { color: TEXT, fontSize: 15, height: 50 },
  eye: { fontSize: 16, padding: 4 },

  btn: {
    marginTop: 10,
    backgroundColor: LIME, borderRadius: 14, height: 52,
    alignItems: "center", justifyContent: "center",
  },
  btnText: { color: "#000", fontSize: 15, fontWeight: "800" },

  footer: { flexDirection: "row", justifyContent: "center", marginTop: 18 },
  footerText: { color: MUTED, fontSize: 14 },
  footerLink: { color: LIME, fontSize: 14, fontWeight: "700" },
});
