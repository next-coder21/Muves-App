import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { UpdateInfo } from "@/hooks/useAppUpdate";
import { useColors } from "@/context/ThemeContext";

const LIME = "#C8FF00";

type Props = {
  info: UpdateInfo;
  onUpdate: () => void;
  onDismiss: () => void;
};

export default function UpdateModal({ info, onUpdate, onDismiss }: Props) {
  const c = useColors();

  return (
    <Modal transparent animationType="fade" visible statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: c.card, borderColor: c.cardBorder }]}>
          <View style={styles.iconWrap}>
            <MaterialIcons name="system-update" size={36} color={LIME} />
          </View>

          <Text style={[styles.title, { color: c.text }]}>Update Available</Text>
          <Text style={[styles.version, { color: c.muted }]}>Version {info.version}</Text>
          <Text style={[styles.message, { color: c.muted }]}>{info.message}</Text>

          <Pressable
            style={({ pressed }) => [styles.updateBtn, pressed && { opacity: 0.85 }]}
            onPress={onUpdate}
          >
            <MaterialIcons name="download" size={20} color="#000" />
            <Text style={styles.updateBtnText}>Download & Update</Text>
          </Pressable>

          {!info.forceUpdate && (
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
    backgroundColor: "rgba(0,0,0,0.6)",
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
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(200,255,0,0.1)",
    borderWidth: 1,
    borderColor: LIME + "44",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  title: { fontSize: 20, fontWeight: "800", marginBottom: 4 },
  version: { fontSize: 13, fontWeight: "600", marginBottom: 12 },
  message: { fontSize: 14, textAlign: "center", lineHeight: 21, marginBottom: 24 },
  updateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: LIME,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
    width: "100%",
    justifyContent: "center",
    marginBottom: 12,
  },
  updateBtnText: { fontSize: 15, fontWeight: "800", color: "#000" },
  laterBtn: { paddingVertical: 10, paddingHorizontal: 20 },
  laterText: { fontSize: 14, fontWeight: "600" },
});
