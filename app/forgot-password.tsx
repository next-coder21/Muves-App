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
import { useRef, useState, useMemo } from "react";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { API } from "@/constants/api";
import { ApiError, apiRequest } from "@/utils/apiClient";
import { useColors, Colors } from "@/context/ThemeContext";

const LIME = "#C8FF00";

type Step = "verify" | "reset" | "done";

function Field({ label, children, styles }: { label: string; children: React.ReactNode; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldBox}>{children}</View>
    </View>
  );
}

function PrimaryBtn({ label, loading, onPress, styles }: { label: string; loading?: boolean; onPress: () => void; styles: ReturnType<typeof makeStyles> }) {
  return (
    <Pressable style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }, loading && { opacity: 0.6 }]} onPress={onPress} disabled={loading}>
      {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.btnText}>{label}</Text>}
    </Pressable>
  );
}

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [step, setStep] = useState<Step>("verify");
  const [email, setEmail] = useState("");
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleVerify() {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedAns = securityAnswer.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) return Alert.alert("Invalid email", "Enter the email on your account.");
    if (!trimmedAns) return Alert.alert("Security keyword required", "Enter the keyword you set when you signed up.");
    Keyboard.dismiss();
    setLoading(true);
    try {
      await apiRequest(API.VERIFY_SECURITY, { method: "POST", body: { email: trimmedEmail, securityAnswer: trimmedAns }, timeoutMs: 45_000, skipAuthErrorHook: true });
      setStep("reset");
      setTimeout(() => passwordRef.current?.focus(), 50);
    } catch (err) {
      const msg = err instanceof ApiError && err.message ? err.message : err instanceof Error ? err.message : "Verification failed";
      Alert.alert("Couldn't verify", msg);
    } finally { setLoading(false); }
  }

  async function handleReset() {
    if (newPassword.length < 8) return Alert.alert("Weak password", "Password must be at least 8 characters.");
    if (newPassword !== confirmPassword) return Alert.alert("Passwords don't match", "Re-enter the same password in both fields.");
    Keyboard.dismiss();
    setLoading(true);
    try {
      await apiRequest(API.RESET_PASSWORD, { method: "POST", body: { email: email.trim().toLowerCase(), securityAnswer: securityAnswer.trim(), newPassword }, timeoutMs: 45_000, skipAuthErrorHook: true });
      setStep("done");
    } catch (err) {
      const msg = err instanceof ApiError && err.message ? err.message : err instanceof Error ? err.message : "Reset failed";
      Alert.alert("Couldn't reset password", msg);
    } finally { setLoading(false); }
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <StatusBar style={c.statusBar} />
        <LinearGradient colors={c.isDark ? ["#1a1a0a", "#0d0d0d", "#0d0d0d"] : ["#f5f5d0", "#f5f5f5", "#f5f5f5"]} style={StyleSheet.absoluteFill} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.headerRow}>
              <Pressable hitSlop={12} onPress={() => router.back()}><Text style={styles.backIcon}>‹</Text></Pressable>
              <Text style={styles.headerTitle}>Reset password</Text>
              <View style={{ width: 28 }} />
            </View>
            <View style={styles.card}>
              {step === "verify" && (
                <>
                  <Text style={styles.cardTitle}>Verify it's you</Text>
                  <Text style={styles.cardSubtitle}>Enter your email and the security keyword you chose during sign-up.</Text>
                  <Field label="Email" styles={styles}>
                    <TextInput style={styles.input} placeholder="you@example.com" placeholderTextColor={c.muted} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" returnKeyType="next" />
                  </Field>
                  <Field label="Security keyword" styles={styles}>
                    <TextInput style={styles.input} placeholder="Your keyword" placeholderTextColor={c.muted} value={securityAnswer} onChangeText={setSecurityAnswer} autoCapitalize="none" returnKeyType="done" onSubmitEditing={handleVerify} />
                  </Field>
                  <PrimaryBtn label="Continue" loading={loading} onPress={handleVerify} styles={styles} />
                </>
              )}
              {step === "reset" && (
                <>
                  <Text style={styles.cardTitle}>Choose a new password</Text>
                  <Text style={styles.cardSubtitle}>At least 8 characters.</Text>
                  <Field label="New password" styles={styles}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <TextInput ref={passwordRef} style={[styles.input, { flex: 1 }]} placeholder="New password" placeholderTextColor={c.muted} value={newPassword} onChangeText={setNewPassword} secureTextEntry={!showPassword} autoComplete="password-new" returnKeyType="next" onSubmitEditing={() => confirmRef.current?.focus()} />
                      <Pressable onPress={() => setShowPassword(v => !v)} hitSlop={10}><Text style={styles.eye}>{showPassword ? "🙈" : "👁️"}</Text></Pressable>
                    </View>
                  </Field>
                  <Field label="Confirm password" styles={styles}>
                    <TextInput ref={confirmRef} style={styles.input} placeholder="Re-enter password" placeholderTextColor={c.muted} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry={!showPassword} autoComplete="password-new" returnKeyType="done" onSubmitEditing={handleReset} />
                  </Field>
                  <PrimaryBtn label="Reset password" loading={loading} onPress={handleReset} styles={styles} />
                </>
              )}
              {step === "done" && (
                <>
                  <Text style={{ fontSize: 48, textAlign: "center", marginBottom: 12 }}>✨</Text>
                  <Text style={[styles.cardTitle, { textAlign: "center" }]}>Password updated</Text>
                  <Text style={[styles.cardSubtitle, { textAlign: "center" }]}>Sign in with your new password.</Text>
                  <PrimaryBtn label="Back to sign in" onPress={() => router.replace("/login")} styles={styles} />
                </>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </TouchableWithoutFeedback>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    scroll: { paddingBottom: 32, paddingTop: 56 },
    headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 16 },
    backIcon: { fontSize: 32, color: c.text, fontWeight: "300", width: 28, textAlign: "center" },
    headerTitle: { fontSize: 16, fontWeight: "700", color: c.text },
    card: { marginHorizontal: 20, padding: 24, borderRadius: 24, backgroundColor: c.card, borderWidth: 1, borderColor: c.border },
    cardTitle: { fontSize: 22, fontWeight: "800", color: c.text, marginBottom: 6 },
    cardSubtitle: { fontSize: 13, color: c.muted, marginBottom: 22, lineHeight: 19 },
    field: { marginBottom: 14 },
    fieldLabel: { fontSize: 12, color: c.muted, fontWeight: "700", marginBottom: 6, letterSpacing: 0.5 },
    fieldBox: { backgroundColor: c.inputBg, borderRadius: 14, borderWidth: 1, borderColor: c.border, paddingHorizontal: 14, height: 50, justifyContent: "center" },
    input: { color: c.text, fontSize: 15, height: 50 },
    eye: { fontSize: 16, padding: 4 },
    btn: { marginTop: 10, backgroundColor: LIME, borderRadius: 14, height: 52, alignItems: "center", justifyContent: "center" },
    btnText: { color: "#000", fontSize: 15, fontWeight: "800" },
  });
}
