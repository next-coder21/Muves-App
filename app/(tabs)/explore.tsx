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
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
import { useColors, Colors } from "@/context/ThemeContext";

const LIME = "#C8FF00";
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
  const c = useColors();
  return (
    <Pressable
      style={({ pressed }) => [{ flexDirection: "row" as const, alignItems: "center" as const, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: c.divider, gap: 12 }, pressed && { opacity: 0.7 }]}
      onPress={() => { playSong(song, queue.length ? queue : [song]); router.push("/player"); }}
    >
      <Text style={{ width: 22, fontSize: 13, color: c.muted, fontWeight: "700", textAlign: "center" }}>{index + 1}</Text>
      <View style={{ width: 52, height: 52, borderRadius: 12, overflow: "hidden", backgroundColor: c.card2 }}>
        {song.coverImage ? (
          <Image source={{ uri: song.coverImage }} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center", backgroundColor: c.card2 }]}>
            <MaterialIcons name="music-note" size={20} color={LIME} />
          </View>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: "700", color: c.text }} numberOfLines={1}>{song.title}</Text>
        <Text style={{ fontSize: 12, color: c.muted, marginTop: 2 }} numberOfLines={1}>{song.artist}{song.album ? ` · ${song.album}` : ""}</Text>
      </View>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(200,255,0,0.1)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: LIME + "33" }}>
        <MaterialIcons name="play-arrow" size={16} color={LIME} />
      </View>
    </Pressable>
  );
}

export default function SearchScreen() {
  const { get } = useApi();
  const bottomInset = usePlayerInset();
  const { top: topInset } = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflightRef = useRef<AbortController | null>(null);
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [focused, setFocused] = useState(false);
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => { loadHistory().then(setHistory); }, []);

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
    setHistory(prev => { const next = prev.filter(h => h !== term); saveHistory(next); return next; });
  }, []);

  const clearAllHistory = useCallback(() => { setHistory([]); saveHistory([]); }, []);

  const doSearch = useCallback(async (q: string, saveToHistory = false) => {
    const trimmed = q.trim();
    if (!trimmed) { inflightRef.current?.abort(); inflightRef.current = null; setResults([]); setSearched(false); setLoading(false); return; }
    inflightRef.current?.abort();
    const ctrl = new AbortController();
    inflightRef.current = ctrl;
    setLoading(true); setSearched(true);
    try {
      const url = `${API.SEARCH_URL}?q=${encodeURIComponent(trimmed)}`;
      const d = await get<unknown>(url, { signal: ctrl.signal });
      if (ctrl.signal.aborted) return;
      setResults(normalizeSongs(d));
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
    if (!t.trim()) { inflightRef.current?.abort(); inflightRef.current = null; setResults([]); setSearched(false); setLoading(false); return; }
    debounceRef.current = setTimeout(() => doSearch(t, false), 400);
  }

  function handleSubmit() { if (debounceRef.current) clearTimeout(debounceRef.current); doSearch(query, true); }
  function tapHistory(term: string) { setQuery(term); doSearch(term, false); }
  function clear() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    inflightRef.current?.abort(); inflightRef.current = null;
    setQuery(""); setResults([]); setSearched(false); setLoading(false);
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
      <StatusBar style={c.statusBar} />
      <LinearGradient colors={c.isDark ? ["#111100", "#0d0d0d"] : ["#f5f5d0", "#f5f5f5"]} style={StyleSheet.absoluteFill} />

      <View style={[styles.header, { paddingTop: topInset + 12 }]}>
        <Text style={styles.headerTitle}>Search</Text>
        <Text style={styles.headerSub}>Find songs, artists &amp; more</Text>
      </View>

      <BlurView intensity={20} tint={c.tint} style={[styles.searchBar, focused && styles.searchBarFocused]}>
        <MaterialIcons name="search" size={20} color={c.muted} style={{ marginRight: 8 }} />
        <TextInput
          ref={inputRef}
          style={styles.searchInput}
          placeholder="Songs, artists, albums..."
          placeholderTextColor={c.muted}
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
            <MaterialIcons name="close" size={18} color={c.muted} />
          </Pressable>
        )}
      </BlurView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottomInset + 16 }} keyboardShouldPersistTaps="handled">
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={LIME} />
            <Text style={styles.loadingText}>Searching...</Text>
          </View>
        ) : searched ? (
          results.length > 0 ? (
            <View style={styles.resultsList}>
              <Text style={styles.resultsCount}>{results.length} results</Text>
              {results.map((item, i) => <ResultRow key={item._id ?? String(i)} song={item} index={i} queue={results} />)}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <MaterialIcons name="search-off" size={52} color={c.muted} style={{ marginBottom: 14 }} />
              <Text style={styles.emptyTitle}>No results</Text>
              <Text style={styles.emptyText}>Try searching for a different artist or song name</Text>
            </View>
          )
        ) : showHistory ? (
          <View style={styles.historySection}>
            <View style={styles.historyHeader}>
              <Text style={styles.historyTitle}>Recent Searches</Text>
              <Pressable onPress={clearAllHistory} hitSlop={10}><Text style={styles.clearAllBtn}>Clear all</Text></Pressable>
            </View>
            {history.map((term) => (
              <View key={term} style={styles.historyRow}>
                <Pressable style={styles.historyRowLeft} onPress={() => tapHistory(term)}>
                  <MaterialIcons name="history" size={18} color={c.muted} />
                  <Text style={styles.historyTerm} numberOfLines={1}>{term}</Text>
                </Pressable>
                <Pressable onPress={() => removeHistory(term)} hitSlop={10}>
                  <MaterialIcons name="close" size={16} color={c.muted} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    header: { paddingHorizontal: 20, paddingBottom: 16 },
    headerTitle: { fontSize: 28, fontWeight: "800", color: c.text },
    headerSub: { fontSize: 13, color: c.muted, marginTop: 4 },

    searchBar: { flexDirection: "row", alignItems: "center", marginHorizontal: 20, marginBottom: 24, height: 52, borderRadius: 16, paddingHorizontal: 14, overflow: "hidden", borderWidth: 1, borderColor: c.cardBorder },
    searchBarFocused: { borderColor: LIME + "55" },
    searchInput: { flex: 1, color: c.text, fontSize: 15 },

    loadingBox: { alignItems: "center", paddingVertical: 60 },
    loadingText: { color: c.muted, marginTop: 12, fontSize: 14 },

    resultsList: { paddingHorizontal: 20 },
    resultsCount: { fontSize: 13, color: c.muted, marginBottom: 12, fontWeight: "600" },

    emptyState: { alignItems: "center", paddingVertical: 60, paddingHorizontal: 40 },
    emptyTitle: { fontSize: 18, fontWeight: "700", color: c.text, marginBottom: 8 },
    emptyText: { fontSize: 14, color: c.muted, textAlign: "center", lineHeight: 21 },

    historySection: { paddingHorizontal: 20 },
    historyHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
    historyTitle: { fontSize: 16, fontWeight: "700", color: c.text },
    clearAllBtn: { fontSize: 13, color: LIME, fontWeight: "600" },
    historyRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: c.divider },
    historyRowLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
    historyTerm: { fontSize: 14, color: c.text, flex: 1 },
  });
}
