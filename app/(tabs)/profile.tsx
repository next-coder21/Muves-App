import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useEffect, useRef, useState } from "react";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialIcons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";
import { API } from "@/constants/api";
import { usePlayer } from "@/context/PlayerContext";
import { useFavourites } from "@/context/FavouritesContext";
import { usePlayerInset } from "@/hooks/usePlayerInset";

const LIME = "#C8FF00";
const BG = "#0d0d0d";
const TEXT = "#f5f5f5";
const MUTED = "#666";
const CARD_BORDER = "rgba(255,255,255,0.08)";
const DANGER = "#ef4444";

type MIName = React.ComponentProps<typeof MaterialIcons>["name"];

function GlassRow({
  icon,
  label,
  value,
  onPress,
  danger = false,
  toggle = false,
  toggled = false,
  onToggle,
  badge,
}: {
  icon: MIName;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  toggle?: boolean;
  toggled?: boolean;
  onToggle?: (v: boolean) => void;
  badge?: string;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        !toggle && pressed && { backgroundColor: "rgba(255,255,255,0.04)" },
      ]}
      onPress={toggle ? undefined : onPress}
    >
      <View style={[styles.rowIcon, danger && styles.rowIconDanger]}>
        <MaterialIcons name={icon} size={20} color={danger ? DANGER : TEXT} />
      </View>
      <Text style={[styles.rowLabel, danger && { color: DANGER }]}>{label}</Text>
      <View style={styles.rowRight}>
        {badge && (
          <View style={styles.rowBadge}>
            <Text style={styles.rowBadgeText}>{badge}</Text>
          </View>
        )}
        {value && <Text style={styles.rowValue}>{value}</Text>}
        {toggle ? (
          <Switch
            value={toggled}
            onValueChange={onToggle}
            trackColor={{ false: "#2a2a2a", true: LIME }}
            thumbColor={toggled ? "#000" : "#888"}
            ios_backgroundColor="#2a2a2a"
          />
        ) : (
          <MaterialIcons name="chevron-right" size={22} color={danger ? DANGER : MUTED} />
        )}
      </View>
    </Pressable>
  );
}

function SectionLabel({ text }: { text: string }) {
  return text ? (
    <Text style={styles.sectionLabel}>{text}</Text>
  ) : (
    <View style={{ height: 8 }} />
  );
}

const PREFS_KEY = "muves_profile_prefs_v1";

type StreamQuality = "Auto" | "Low" | "Medium" | "High";

type Prefs = {
  notifications: boolean;
  autoPlay: boolean;
  crossfade: boolean;
  streamQuality: StreamQuality;
};

const DEFAULT_PREFS: Prefs = {
  notifications: true,
  autoPlay: true,
  crossfade: false,
  streamQuality: "Auto",
};

const QUALITY_OPTIONS: StreamQuality[] = ["Auto", "Low", "Medium", "High"];

export default function ProfileScreen() {
  const { user, logout, updateUser } = useAuth();
  const { history, queue } = usePlayer();
  const { count: favCount } = useFavourites();
  const router = useRouter();
  const bottomInset = usePlayerInset();
  const { post } = useApi();

  // Edit profile modal
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDob, setEditDob] = useState("");
  const [editGender, setEditGender] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  function openEdit() {
    setEditName(user?.name ?? "");
    const rawDob: string = (user as any)?.dob ?? "";
    setEditDob(rawDob ? rawDob.slice(0, 10) : "");
    setEditGender((user as any)?.gender ?? "");
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!editName.trim()) {
      Alert.alert("Name required", "Please enter your display name.");
      return;
    }
    setEditSaving(true);
    try {
      const data = await post<{ user: any }>(API.UPDATE_ACCOUNT, {
        name: editName.trim(),
        dob: editDob.trim() || undefined,
        gender: editGender.trim() || undefined,
      });
      updateUser(data.user ?? { name: editName.trim() });
      setEditOpen(false);
    } catch {
      Alert.alert("Update failed", "Could not save changes. Please try again.");
    } finally {
      setEditSaving(false);
    }
  }

  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const prefsLoadedRef = useRef(false);
  const [qualityOpen, setQualityOpen] = useState(false);

  // Load persisted preferences once on mount
  useEffect(() => {
    AsyncStorage.getItem(PREFS_KEY)
      .then(raw => {
        if (!raw) { prefsLoadedRef.current = true; return; }
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object") {
            setPrefs({ ...DEFAULT_PREFS, ...parsed });
          }
        } catch { /* corrupt cache; defaults are fine */ }
        prefsLoadedRef.current = true;
      })
      .catch(() => { prefsLoadedRef.current = true; });
  }, []);

  // Persist preferences whenever they change (after initial load completes)
  useEffect(() => {
    if (!prefsLoadedRef.current) return;
    AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs)).catch(() => {});
  }, [prefs]);

  function setPref<K extends keyof Prefs>(key: K, value: Prefs[K]) {
    setPrefs(prev => ({ ...prev, [key]: value }));
  }

  async function handleLogout() {
    Alert.alert(
      "Sign out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out",
          style: "destructive",
          onPress: async () => {
            try { await logout(); } catch { /* logout is best-effort, continue */ }
            router.replace("/login");
          },
        },
      ]
    );
  }

  function notImplemented(feature: string) {
    Alert.alert(`${feature} coming soon`, "We're still working on this one.");
  }

  const initial = (user?.name?.trim() || "U")[0].toUpperCase();

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient colors={["#0a0a00", "#0d0d0d"]} style={StyleSheet.absoluteFill} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomInset + 24 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        {/* User card */}
        <BlurView intensity={20} tint="dark" style={styles.userCard}>
          <View style={styles.userCardInner}>
            <View style={styles.avatarRing}>
              <LinearGradient colors={[LIME, "#88cc00"]} style={styles.avatarGradient}>
                <Text style={styles.avatarInitial}>{initial}</Text>
              </LinearGradient>
            </View>

            <View style={styles.userInfo}>
              <Text style={styles.userName}>{user?.name ?? "Listener"}</Text>
              <Text style={styles.userEmail} numberOfLines={1}>{user?.email ?? ""}</Text>
              <View style={styles.userBadge}>
                <Text style={styles.userBadgeText}>🎵  Free plan</Text>
              </View>
            </View>

            <Pressable style={styles.editBtn} hitSlop={8} onPress={openEdit}>
              <Text style={styles.editBtnText}>Edit</Text>
            </Pressable>
          </View>
        </BlurView>

        {/* Listening stats */}
        <View style={styles.statsRow}>
          <BlurView intensity={20} tint="dark" style={styles.statCard}>
            <Text style={styles.statNum}>{history.length}</Text>
            <Text style={styles.statLabel}>Played</Text>
          </BlurView>
          <BlurView intensity={20} tint="dark" style={styles.statCard}>
            <Text style={styles.statNum}>{queue.length}</Text>
            <Text style={styles.statLabel}>In Queue</Text>
          </BlurView>
          <BlurView intensity={20} tint="dark" style={styles.statCard}>
            <Text style={styles.statNum}>{favCount}</Text>
            <Text style={styles.statLabel}>Favourites</Text>
          </BlurView>
        </View>

        {/* Playback */}
        <SectionLabel text="PLAYBACK" />
        <BlurView intensity={15} tint="dark" style={styles.card}>
          <View style={styles.cardInner}>
            <GlassRow icon="notifications" label="Notifications" toggle toggled={prefs.notifications} onToggle={(v) => setPref("notifications", v)} />
            <View style={styles.divider} />
            <GlassRow icon="play-arrow" label="Autoplay" toggle toggled={prefs.autoPlay} onToggle={(v) => setPref("autoPlay", v)} />
            <View style={styles.divider} />
            <GlassRow icon="shuffle" label="Crossfade" toggle toggled={prefs.crossfade} onToggle={(v) => setPref("crossfade", v)} />
            <View style={styles.divider} />

            {/* Stream quality dropdown */}
            <Pressable
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: "rgba(255,255,255,0.04)" }]}
              onPress={() => setQualityOpen(o => !o)}
            >
              <View style={styles.rowIcon}>
                <MaterialIcons name="graphic-eq" size={20} color={TEXT} />
              </View>
              <Text style={styles.rowLabel}>Stream Quality</Text>
              <View style={styles.rowRight}>
                <Text style={styles.rowValue}>{prefs.streamQuality}</Text>
                <MaterialIcons
                  name="chevron-right"
                  size={22}
                  color={MUTED}
                  style={{ transform: [{ rotate: qualityOpen ? "90deg" : "0deg" }] }}
                />
              </View>
            </Pressable>

            {qualityOpen && (
              <View style={styles.dropdown}>
                {QUALITY_OPTIONS.map((opt, i) => (
                  <Pressable
                    key={opt}
                    style={({ pressed }) => [
                      styles.dropdownItem,
                      i < QUALITY_OPTIONS.length - 1 && styles.dropdownDivider,
                      pressed && { backgroundColor: "rgba(255,255,255,0.04)" },
                    ]}
                    onPress={() => { setPref("streamQuality", opt); setQualityOpen(false); }}
                  >
                    <View style={styles.dropdownLeft}>
                      <View style={[styles.dropdownDot, prefs.streamQuality === opt && styles.dropdownDotActive]} />
                      <Text style={[styles.dropdownLabel, prefs.streamQuality === opt && { color: LIME }]}>{opt}</Text>
                      <Text style={styles.dropdownHint}>
                        {opt === "Auto" ? "Adjusts to network" : opt === "Low" ? "~64 kbps" : opt === "Medium" ? "~128 kbps" : "~320 kbps"}
                      </Text>
                    </View>
                    {prefs.streamQuality === opt && <MaterialIcons name="check" size={16} color={LIME} />}
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </BlurView>

        {/* Account */}
        <SectionLabel text="ACCOUNT" />
        <BlurView intensity={15} tint="dark" style={styles.card}>
          <View style={styles.cardInner}>
            <GlassRow icon="person" label="Edit Profile" onPress={openEdit} />
            <View style={styles.divider} />
            <GlassRow icon="lock" label="Change Password" onPress={() => notImplemented("Password change")} />
            <View style={styles.divider} />
            <GlassRow icon="dark-mode" label="Appearance" value="Dark" onPress={() => notImplemented("Theme picker")} />
          </View>
        </BlurView>

        {/* Support */}
        <SectionLabel text="SUPPORT" />
        <BlurView intensity={15} tint="dark" style={styles.card}>
          <View style={styles.cardInner}>
            <GlassRow icon="help-outline" label="Help & FAQ" onPress={() => notImplemented("Help & FAQ")} />
            <View style={styles.divider} />
            <GlassRow icon="star-outline" label="Rate Muves" onPress={() => notImplemented("Rate Muves")} />
            <View style={styles.divider} />
            <GlassRow icon="privacy-tip" label="Privacy Policy" onPress={() => notImplemented("Privacy policy")} />
          </View>
        </BlurView>

        {/* Logout */}
        <SectionLabel text="" />
        <BlurView intensity={15} tint="dark" style={styles.card}>
          <View style={styles.cardInner}>
            <GlassRow icon="logout" label="Sign out" onPress={handleLogout} danger />
          </View>
        </BlurView>

        <Text style={styles.version}>Muves v1.0.0  ·  Made with ♪</Text>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={editOpen} transparent animationType="slide" onRequestClose={() => setEditOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Edit Profile</Text>

            <Text style={styles.fieldLabel}>Display Name</Text>
            <TextInput
              style={styles.fieldInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Your name"
              placeholderTextColor={MUTED}
              autoCapitalize="words"
              returnKeyType="next"
            />

            <Text style={styles.fieldLabel}>Date of Birth</Text>
            <TextInput
              style={styles.fieldInput}
              value={editDob}
              onChangeText={setEditDob}
              placeholder="YYYY-MM-DD (optional)"
              placeholderTextColor={MUTED}
              keyboardType="numbers-and-punctuation"
              returnKeyType="next"
            />

            <Text style={styles.fieldLabel}>Gender</Text>
            <TextInput
              style={styles.fieldInput}
              value={editGender}
              onChangeText={setEditGender}
              placeholder="e.g. Male / Female / Other (optional)"
              placeholderTextColor={MUTED}
              autoCapitalize="sentences"
              returnKeyType="done"
              onSubmitEditing={saveEdit}
            />

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setEditOpen(false)}
                disabled={editSaving}
              >
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, styles.modalBtnSave, editSaving && { opacity: 0.7 }]}
                onPress={saveEdit}
                disabled={editSaving}
              >
                {editSaving
                  ? <ActivityIndicator size="small" color="#000" />
                  : <Text style={styles.modalBtnSaveText}>Save</Text>
                }
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16 },
  headerTitle: { fontSize: 28, fontWeight: "800", color: TEXT },

  userCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  userCardInner: { flexDirection: "row", alignItems: "center", padding: 20, gap: 14 },
  avatarRing: {
    width: 66,
    height: 66,
    borderRadius: 33,
    borderWidth: 2,
    borderColor: LIME + "55",
    padding: 2,
  },
  avatarGradient: { flex: 1, borderRadius: 31, alignItems: "center", justifyContent: "center" },
  avatarInitial: { fontSize: 26, fontWeight: "800", color: "#000" },
  userInfo: { flex: 1 },
  userName: { fontSize: 17, fontWeight: "800", color: TEXT },
  userEmail: { fontSize: 12, color: MUTED, marginTop: 2 },
  userBadge: {
    alignSelf: "flex-start",
    marginTop: 7,
    backgroundColor: "rgba(200,255,0,0.08)",
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: LIME + "33",
  },
  userBadgeText: { fontSize: 11, color: LIME, fontWeight: "700" },
  editBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: LIME + "55",
  },
  editBtnText: { fontSize: 13, color: LIME, fontWeight: "700" },

  statsRow: { flexDirection: "row", paddingHorizontal: 20, gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  statNum: { fontSize: 20, fontWeight: "800", color: LIME },
  statLabel: { fontSize: 11, color: MUTED, marginTop: 3, fontWeight: "600" },

  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: MUTED,
    letterSpacing: 1.2,
    paddingHorizontal: 20,
    marginBottom: 8,
    marginTop: 4,
  },
  card: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  cardInner: { borderRadius: 20, overflow: "hidden" },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderRadius: 20,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.07)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  rowIconDanger: { backgroundColor: "rgba(239,68,68,0.12)" },
  rowIconText: { fontSize: 17 },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: "600", color: TEXT },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowBadge: {
    backgroundColor: LIME + "1a",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: LIME + "33",
  },
  rowBadgeText: { fontSize: 10, color: LIME, fontWeight: "700" },
  rowValue: { fontSize: 13, color: MUTED },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
    marginLeft: 64,
  },

  dropdown: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  dropdownDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  dropdownLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  dropdownDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: MUTED,
  },
  dropdownDotActive: { backgroundColor: LIME },
  dropdownLabel: { fontSize: 14, fontWeight: "700", color: TEXT, width: 72 },
  dropdownHint: { fontSize: 12, color: MUTED },
  dropdownCheck: { fontSize: 14, color: LIME, fontWeight: "800" },

  version: { textAlign: "center", fontSize: 12, color: MUTED, marginTop: 16, marginBottom: 8 },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#1a1a1a",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: CARD_BORDER,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: "#444",
    alignSelf: "center",
    marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: "800", color: TEXT, marginBottom: 20 },
  fieldLabel: { fontSize: 12, fontWeight: "700", color: MUTED, letterSpacing: 0.8, marginBottom: 6 },
  fieldInput: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    color: TEXT,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    marginBottom: 16,
  },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 4 },
  modalBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
  },
  modalBtnCancel: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  modalBtnCancelText: { fontSize: 15, fontWeight: "700", color: TEXT },
  modalBtnSave: { backgroundColor: LIME },
  modalBtnSaveText: { fontSize: 15, fontWeight: "800", color: "#000" },
});
