import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { UpdateInfo, DownloadStatus } from "@/hooks/useAppUpdate";
import { useColors } from "@/context/ThemeContext";

const LIME = "#C8FF00";

type Props = {
  info: UpdateInfo;
  dlStatus: DownloadStatus;
  onUpdate: () => void;
  onDismiss: () => void;
};

export default function UpdateModal({ info, dlStatus, onUpdate, onDismiss }: Props) {
  const c = useColors();
  const isDownloading = dlStatus.phase === "downloading";
  const isInstalling  = dlStatus.phase === "installing";
  const busy          = isDownloading || isInstalling;
  const progress      = isDownloading ? (dlStatus as { phase: "downloading"; progress: number }).progress : 0;

  return (
    <Modal transparent animationType="fade" visible statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: c.card, borderColor: c.cardBorder }]}>
          {/* Icon */}
          <View style={[styles.iconWrap, { borderColor: LIME + "44" }]}>
            <MaterialIcons name="system-update" size={36} color={LIME} />
          </View>

          <Text style={[styles.title, { color: c.text }]}>Update Available</Text>
          <Text style={[styles.version, { color: c.muted }]}>Version {info.version}</Text>
          <Text style={[styles.message, { color: c.muted }]}>{info.message}</Text>

          {/* Progress bar — visible while downloading */}
          {busy && (
            <View style={styles.progressWrap}>
              <View style={[styles.progressTrack, { backgroundColor: c.cardBorder }]}>
                <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%`, backgroundColor: LIME }]} />
              </View>
              <Text style={[styles.progressLabel, { color: c.muted }]}>
                {isInstalling ? "Installing…" : `Downloading… ${Math.round(progress * 100)}%`}
              </Text>
            </View>
          )}

          {/* Download button */}
          {!busy && (
            <Pressable
              style={({ pressed }) => [styles.updateBtn, { backgroundColor: LIME }, pressed && { opacity: 0.85 }]}
              onPress={onUpdate}
            >
              <MaterialIcons name="download" size={20} color="#000" />
              <Text style={styles.updateBtnText}>Download & Install</Text>
            </Pressable>
          )}

          {/* Later — hidden for force updates or while busy */}
          {!info.forceUpdate && !busy && (
            <Pressable
              style={({ pressed }) => [styles.laterBtn, pressed && { opacity: 0.6 }]}
              onPress={onDismiss}
            >
              <Text style={[styles.laterText, { color: c.muted }]}>Later</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  sheet: {
    width: "100%",
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
  },
  iconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: "rgba(200,255,0,0.08)",
    borderWidth: 1,
    alignItems: "center", justifyContent: "center",
    marginBottom: 18,
  },
  title:   { fontSize: 20, fontWeight: "800", marginBottom: 4 },
  version: { fontSize: 13, fontWeight: "600", marginBottom: 12 },
  message: { fontSize: 14, textAlign: "center", lineHeight: 21, marginBottom: 24 },

  progressWrap:  { width: "100%", marginBottom: 20 },
  progressTrack: { height: 6, borderRadius: 3, overflow: "hidden", marginBottom: 8 },
  progressFill:  { height: 6, borderRadius: 3 },
  progressLabel: { fontSize: 12, textAlign: "center" },

  updateBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 14, paddingVertical: 14, paddingHorizontal: 28,
    width: "100%", justifyContent: "center", marginBottom: 12,
  },
  updateBtnText: { fontSize: 15, fontWeight: "800", color: "#000" },
  laterBtn:  { paddingVertical: 10, paddingHorizontal: 20 },
  laterText: { fontSize: 14, fontWeight: "600" },
});
