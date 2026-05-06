import React, { useState, useEffect, useRef } from "react";
import {
  Animated, Dimensions, Modal, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { BlurView } from "expo-blur";
import { usePlaylists } from "@/context/PlaylistContext";

const LIME = "#C8FF00";
const BG = "#161616";
const TEXT = "#f5f5f5";
const MUTED = "#666";
const BORDER = "rgba(255,255,255,0.1)";
const { height: SCREEN_H } = Dimensions.get("window");

type Props = {
  visible: boolean;
  songId: string | null;
  songTitle?: string;
  onClose: () => void;
};

export default function AddToPlaylistSheet({ visible, songId, songTitle, onClose }: Props) {
  const { playlists, createPlaylist, addSongToPlaylist } = usePlaylists();
  const [added, setAdded]         = useState<Set<string>>(new Set());
  const [adding, setAdding]       = useState<string | null>(null);
  const [creating, setCreating]   = useState(false);
  const [newName, setNewName]     = useState("");
  const [showInput, setShowInput] = useState(false);
  const slideAnim = useRef(new Animated.Value(SCREEN_H)).current;

  useEffect(() => {
    if (visible) {
      setAdded(new Set());
      setNewName("");
      setShowInput(false);
      Animated.spring(slideAnim, {
        toValue: 0, useNativeDriver: true,
        tension: 65, friction: 11,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: SCREEN_H, duration: 260, useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const handleAdd = async (playlistId: string) => {
    if (!songId || adding || added.has(playlistId)) return;
    setAdding(playlistId);
    try {
      await addSongToPlaylist(playlistId, songId);
      setAdded(prev => new Set([...prev, playlistId]));
    } catch {}
    finally { setAdding(null); }
  };

  const handleCreate = async () => {
    if (!newName.trim() || creating) return;
    setCreating(true);
    try {
      const pl = await createPlaylist(newName.trim());
      setNewName(""); setShowInput(false);
      if (songId) {
        await addSongToPlaylist(pl.id, songId);
        setAdded(prev => new Set([...prev, pl.id]));
      }
    } catch {}
    finally { setCreating(false); }
  };

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={onClose}>
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
      </Pressable>

      {/* Sheet */}
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        {/* Handle */}
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.sheetHeader}>
          <View>
            <Text style={styles.sheetTitle}>Add to Playlist</Text>
            {songTitle && (
              <Text style={styles.sheetSub} numberOfLines={1}>{songTitle}</Text>
            )}
          </View>
          <Pressable onPress={onClose} style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.5 }]}>
            <Text style={styles.closeIcon}>✕</Text>
          </Pressable>
        </View>

        {/* New playlist row */}
        {showInput ? (
          <View style={styles.inputRow}>
            <TextInput
              autoFocus
              value={newName}
              onChangeText={setNewName}
              placeholder="Playlist name…"
              placeholderTextColor={MUTED}
              style={styles.input}
              onSubmitEditing={handleCreate}
              returnKeyType="done"
            />
            <Pressable
              onPress={handleCreate}
              disabled={!newName.trim() || creating}
              style={({ pressed }) => [styles.inputOk, pressed && { opacity: 0.7 }, (!newName.trim() || creating) && { opacity: 0.4 }]}
            >
              <Text style={styles.inputOkText}>{creating ? "…" : "OK"}</Text>
            </Pressable>
            <Pressable onPress={() => { setShowInput(false); setNewName(""); }} style={styles.inputCancel}>
              <Text style={{ color: MUTED, fontSize: 14 }}>✕</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => setShowInput(true)}
            style={({ pressed }) => [styles.newBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.newBtnIcon}>＋</Text>
            <Text style={styles.newBtnText}>New Playlist</Text>
          </Pressable>
        )}

        {/* Playlist list */}
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {playlists.length === 0 ? (
            <View style={styles.empty}>
              <Text style={{ fontSize: 36, marginBottom: 10 }}>🎵</Text>
              <Text style={styles.emptyText}>No playlists yet</Text>
            </View>
          ) : (
            playlists.map(pl => {
              const isDone = added.has(pl.id);
              const isBusy = adding === pl.id;
              return (
                <Pressable
                  key={pl.id}
                  onPress={() => handleAdd(pl.id)}
                  disabled={isDone || isBusy}
                  style={({ pressed }) => [
                    styles.plRow,
                    isDone && styles.plRowDone,
                    pressed && !isDone && { backgroundColor: "rgba(255,255,255,0.04)" },
                  ]}
                >
                  <View style={[styles.plIcon, isDone && styles.plIconDone]}>
                    <Text style={{ fontSize: 16 }}>🎵</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.plName, isDone && { color: LIME }]} numberOfLines={1}>{pl.name}</Text>
                    <Text style={styles.plCount}>{pl.songCount} songs</Text>
                  </View>
                  <Text style={[styles.plAction, isDone && { color: LIME }]}>
                    {isBusy ? "…" : isDone ? "✓" : "＋"}
                  </Text>
                </Pressable>
              );
            })
          )}
          <View style={{ height: 32 }} />
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  sheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: BG,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: SCREEN_H * 0.72,
    borderTopWidth: 1, borderColor: BORDER,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: BORDER, alignSelf: "center", marginTop: 10, marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  sheetTitle: { fontSize: 17, fontWeight: "800", color: TEXT },
  sheetSub: { fontSize: 12, color: MUTED, marginTop: 2, maxWidth: 240 },
  closeBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  closeIcon: { fontSize: 14, color: MUTED },

  newBtn: {
    flexDirection: "row", alignItems: "center", gap: 12,
    marginHorizontal: 16, marginVertical: 10,
    padding: 14, borderRadius: 12,
    borderWidth: 1, borderStyle: "dashed", borderColor: LIME,
  },
  newBtnIcon: { fontSize: 18, color: LIME, fontWeight: "700" },
  newBtnText: { fontSize: 14, fontWeight: "700", color: LIME },

  inputRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginHorizontal: 16, marginVertical: 10,
  },
  input: {
    flex: 1, height: 44, paddingHorizontal: 14,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 10, borderWidth: 1, borderColor: LIME,
    color: TEXT, fontSize: 14,
  },
  inputOk: {
    height: 44, paddingHorizontal: 16, borderRadius: 10,
    backgroundColor: LIME, alignItems: "center", justifyContent: "center",
  },
  inputOkText: { fontWeight: "800", color: "#000", fontSize: 14 },
  inputCancel: {
    width: 36, height: 44, alignItems: "center", justifyContent: "center",
  },

  list: { flex: 1, marginTop: 4 },
  plRow: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingHorizontal: 20, paddingVertical: 13,
  },
  plRowDone: { opacity: 0.85 },
  plIcon: {
    width: 46, height: 46, borderRadius: 12,
    backgroundColor: "#1e1e1e", alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: BORDER,
  },
  plIconDone: { borderColor: LIME },
  plName: { fontSize: 14, fontWeight: "700", color: TEXT },
  plCount: { fontSize: 12, color: MUTED, marginTop: 2 },
  plAction: { fontSize: 20, color: MUTED, fontWeight: "700", minWidth: 24, textAlign: "center" },

  empty: { alignItems: "center", paddingVertical: 40 },
  emptyText: { fontSize: 15, color: MUTED },
});
