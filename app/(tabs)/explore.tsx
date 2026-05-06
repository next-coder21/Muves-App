import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useState, useCallback, useRef, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BlurView } from "expo-blur";
import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useApi } from "@/hooks/useApi";
import { usePlayer, Song } from "@/context/PlayerContext";
import { API } from "@/constants/api";
import { normalizeSongs } from "@/utils/normalize";
import { usePlayerInset } from "@/hooks/usePlayerInset";

const LIME = "#C8FF00";
const BG = "#0d0d0d";
const TEXT = "#f5f5f5";
const MUTED = "#666";
const CARD_BORDER = "rgba(255,255,255,0.08)";
const HISTORY_KEY = "search_history";
const MAX_HISTORY = 10;

async function loadHistory(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function saveHistory(history: string[]) {
  try { await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch {}
}

function ResultRow({ song, index, queue }: { song: Song; index: number; queue: Song[] }) {
  const { playSong } = usePlayer();
  const router = useRouter();
  return (
    <Pressable
      style={({ pressed }) => [styles.resultRow, pressed && { opacity: 0.7 }]}
      onPress={() => { playSong(song, queue.length ? queue : [song]); router.push("/player"); }}
    >
      <Text style={styles.resultIndex}>{index + 1}</Text>
      <View style={styles.resultCover}>
        {song.coverImage ? (
          <Image source={{ uri: song.coverImage }} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.resultCoverFallback]}>
            <MaterialIcons name="music-note" size={20} color={LIME} />
          </View>
        )}
      </View>
      <View style={styles.resultInfo}>
        <Text style={styles.resultTitle} numberOfLines={1}>{song.title}</Text>
        <Text style={styles.resultArtist} numberOfLines={1}>
          {song.artist}{song.album ? ` · ${song.album}` : ""}
        </Text>
      </View>
      <View style={styles.resultPlayBtn}>
        <MaterialIcons name="play-arrow" size={16} color={LIME} />
      </View>
    </Pressable>
  );
}

export default function SearchScreen() {
  const { get } = useApi();
  const bottomInset = usePlayerInset();
  const inputRef = useRef<TextInput>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflightRef = useRef<AbortController | null>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [focused, setFocused] = useState(false);
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    loadHistory().then(setHistory);
  }, []);

  const pushHistory = useCallback(async (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    setHistory(prev => {
      const next = [trimmed, ...prev.filter(h => h.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX_HISTORY);
      saveHistory(next);
      return next;
    });
  }, []);

  const removeHistory = useCallback((term: string) => {
    setHistory(prev => {
      const next = prev.filter(h => h !== term);
      saveHistory(next);
      return next;
    });
  }, []);

  const clearAllHistory = useCallback(() => {
    setHistory([]);
    saveHistory([]);
  }, []);

  const doSearch = useCallback(async (q: string, saveToHistory = false) => {
    const trimmed = q.trim();
    if (!trimmed) {
      inflightRef.current?.abort();
      inflightRef.current = null;
      setResults([]);
      setSearched(false);
      setLoading(false);
      return;
    }
    inflightRef.current?.abort();
    const ctrl = new AbortController();
    inflightRef.current = ctrl;

    setLoading(true);
    setSearched(true);
    try {
      const url = `${API.SEARCH_URL}?q=${encodeURIComponent(trimmed)}`;
      const d = await get<any>(url, { signal: ctrl.signal });
      if (ctrl.signal.aborted) return;
      setResults(normalizeSongs(d?.songs ?? d));
      if (saveToHistory) pushHistory(trimmed);
    } catch {
      if (ctrl.signal.aborted) return;
      setResults([]);
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
      if (inflightRef.current === ctrl) inflightRef.current = null;
    }
  }, [get, pushHistory]);

  function handleChangeText(t: string) {
    setQuery(t);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!t.trim()) {
      inflightRef.current?.abort();
      inflightRef.current = null;
      setResults([]);
      setSearched(false);
      setLoading(false);
      return;
    }
    debounceRef.current = setTimeout(() => doSearch(t, false), 400);
  }

  function handleSubmit() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    doSearch(query, true);
  }

  function tapHistory(term: string) {
    setQuery(term);
    doSearch(term, false);
  }

  function clear() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    inflightRef.current?.abort();
    inflightRef.current = null;
    setQuery("");
    setResults([]);
    setSearched(false);
    setLoading(false);
    inputRef.current?.focus();
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      inflightRef.current?.abort();
    };
  }, []);

  const showHistory = !searched && !loading && history.length > 0;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient colors={["#111100", "#0d0d0d"]} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Search</Text>
        <Text style={styles.headerSub}>Find songs, artists & more</Text>
      </View>

      {/* Search bar */}
      <BlurView
        intensity={20}
        tint="dark"
        style={[styles.searchBar, focused && styles.searchBarFocused]}
      >
        <MaterialIcons name="search" size={20} color={MUTED} style={{ marginRight: 8 }} />
        <TextInput
          ref={inputRef}
          style={styles.searchInput}
          placeholder="Songs, artists, albums..."
          placeholderTextColor={MUTED}
          value={query}
          onChangeText={handleChangeText}
          onSubmitEditing={handleSubmit}
          returnKeyType="search"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {query.length > 0 && (
          <Pressable onPress={clear} hitSlop={10}>
            <MaterialIcons name="close" size={18} color={MUTED} />
          </Pressable>
        )}
      </BlurView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomInset + 16 }}
        keyboardShouldPersistTaps="handled"
      >
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={LIME} />
            <Text style={styles.loadingText}>Searching...</Text>
          </View>
        ) : searched ? (
          results.length > 0 ? (
            <View style={styles.resultsList}>
              <Text style={styles.resultsCount}>{results.length} results</Text>
              {results.map((item, i) => (
                <ResultRow key={item._id ?? String(i)} song={item} index={i} queue={results} />
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <MaterialIcons name="search-off" size={52} color={MUTED} style={{ marginBottom: 14 }} />
              <Text style={styles.emptyTitle}>No results</Text>
              <Text style={styles.emptyText}>
                Try searching for a different artist or song name
              </Text>
            </View>
          )
        ) : showHistory ? (
          <View style={styles.historySection}>
            <View style={styles.historyHeader}>
              <Text style={styles.historyTitle}>Recent Searches</Text>
              <Pressable onPress={clearAllHistory} hitSlop={10}>
                <Text style={styles.clearAllBtn}>Clear all</Text>
              </Pressable>
            </View>
            {history.map((term) => (
              <View key={term} style={styles.historyRow}>
                <Pressable
                  style={styles.historyRowLeft}
                  onPress={() => tapHistory(term)}
                >
                  <MaterialIcons name="history" size={18} color={MUTED} />
                  <Text style={styles.historyTerm} numberOfLines={1}>{term}</Text>
                </Pressable>
                <Pressable onPress={() => removeHistory(term)} hitSlop={10}>
                  <MaterialIcons name="close" size={16} color={MUTED} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16 },
  headerTitle: { fontSize: 28, fontWeight: "800", color: TEXT },
  headerSub: { fontSize: 13, color: MUTED, marginTop: 4 },

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginBottom: 24,
    height: 52,
    borderRadius: 16,
    paddingHorizontal: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  searchBarFocused: { borderColor: LIME + "55" },
  searchIcon: { fontSize: 18, color: MUTED, marginRight: 8 },
  searchInput: { flex: 1, color: TEXT, fontSize: 15 },
  clearBtn: { fontSize: 14, color: MUTED, padding: 4 },

  loadingBox: { alignItems: "center", paddingVertical: 60 },
  loadingText: { color: MUTED, marginTop: 12, fontSize: 14 },

  resultsList: { paddingHorizontal: 20 },
  resultsCount: { fontSize: 13, color: MUTED, marginBottom: 12, fontWeight: "600" },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
    gap: 12,
  },
  resultIndex: { width: 22, fontSize: 13, color: MUTED, fontWeight: "700", textAlign: "center" },
  resultCover: {
    width: 52,
    height: 52,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
  },
  resultCoverFallback: { alignItems: "center", justifyContent: "center", backgroundColor: "#1a1a1a" },
  resultInfo: { flex: 1 },
  resultTitle: { fontSize: 14, fontWeight: "700", color: TEXT },
  resultArtist: { fontSize: 12, color: MUTED, marginTop: 2 },
  resultPlayBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(200,255,0,0.1)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: LIME + "33",
  },
  resultPlayIcon: { fontSize: 13, color: LIME, marginLeft: 2 },

  emptyState: { alignItems: "center", paddingVertical: 60, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: TEXT, marginBottom: 8 },
  emptyText: { fontSize: 14, color: MUTED, textAlign: "center", lineHeight: 21 },

  historySection: { paddingHorizontal: 20 },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  historyTitle: { fontSize: 16, fontWeight: "700", color: TEXT },
  clearAllBtn: { fontSize: 13, color: LIME, fontWeight: "600" },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  historyRowLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  historyIcon: { fontSize: 16, color: MUTED },
  historyTerm: { fontSize: 14, color: TEXT, flex: 1 },
  historyRemove: { fontSize: 12, color: MUTED, paddingLeft: 12 },
});
