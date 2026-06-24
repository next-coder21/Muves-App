import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import SearchSkeleton from "@/components/SearchSkeleton";
import BrowseGrid from "@/components/BrowseGrid";
import { useState, useCallback, useRef, useEffect } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialIcons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useApi } from "@/hooks/useApi";
import { usePlayer, Song } from "@/context/PlayerContext";
import { API } from "@/constants/api";
import { normalizeSongs } from "@/utils/normalize";
import { usePlayerInset } from "@/hooks/usePlayerInset";

// ─── Palette ──────────────────────────────────────────────────────────────────
const P = {
  bg: "#F5F5F5",
  surface: "#FFFFFF",
  red: "#E53935",
  redLight: "#FDECEA",
  text: "#1A1A1A",
  sub: "#9E9E9E",
  border: "#EEEEEE",
  divider: "#F0F0F0",
};

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
      <View style={styles.resultThumb}>
        {song.coverImage ? (
          <Image source={{ uri: song.coverImage }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.resultThumbFallback]}>
            <MaterialIcons name="music-note" size={20} color={P.red} />
          </View>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.resultTitle} numberOfLines={1}>{song.title}</Text>
        <Text style={styles.resultArtist} numberOfLines={1}>
          {song.artist}{song.album ? ` · ${song.album}` : ""}
        </Text>
      </View>
      <View style={styles.resultPlayBtn}>
        <MaterialIcons name="play-arrow" size={18} color={P.red} />
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
    if (!trimmed) {
      inflightRef.current?.abort(); inflightRef.current = null;
      setResults([]); setSearched(false); setLoading(false);
      return;
    }
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
    if (!t.trim()) {
      inflightRef.current?.abort(); inflightRef.current = null;
      setResults([]); setSearched(false); setLoading(false);
      return;
    }
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
      <StatusBar style="dark" />

      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: topInset + 12 }]}>
        <Text style={styles.headerTitle}>Search</Text>
        <Text style={styles.headerSub}>Find songs, artists &amp; more</Text>
      </View>

      {/* ── Search bar ── */}
      <View style={[styles.searchBar, focused && styles.searchBarFocused]}>
        <MaterialIcons name="search" size={20} color={focused ? P.red : P.sub} style={{ marginRight: 8 }} />
        <TextInput
          ref={inputRef}
          style={styles.searchInput}
          placeholder="Songs, artists, albums..."
          placeholderTextColor={P.sub}
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
          <Pressable onPress={clear} hitSlop={10} accessibilityLabel="Clear search">
            <MaterialIcons name="close" size={18} color={P.sub} />
          </Pressable>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomInset + 16 }}
        keyboardShouldPersistTaps="handled"
      >
        {loading ? (
          <SearchSkeleton />
        ) : searched ? (
          results.length > 0 ? (
            <View style={styles.resultsList}>
              <Text style={styles.resultsCount}>{results.length} result{results.length !== 1 ? "s" : ""}</Text>
              {results.map((item, i) => (
                <ResultRow key={item._id ?? String(i)} song={item} index={i} queue={results} />
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <MaterialIcons name="search-off" size={52} color={P.sub} style={{ marginBottom: 14 }} />
              <Text style={styles.emptyTitle}>No results</Text>
              <Text style={styles.emptyText}>Try searching for a different artist or song name</Text>
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
            <View style={styles.chipsWrap}>
              {history.map((term) => (
                <Pressable
                  key={term}
                  style={({ pressed }) => [styles.chip, pressed && { opacity: 0.7 }]}
                  onPress={() => tapHistory(term)}
                >
                  <MaterialIcons name="history" size={14} color={P.sub} />
                  <Text style={styles.chipText} numberOfLines={1}>{term}</Text>
                  <Pressable onPress={() => removeHistory(term)} hitSlop={10} accessibilityLabel={`Remove ${term} from history`}>
                    <MaterialIcons name="close" size={12} color={P.sub} />
                  </Pressable>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <>
            <Text style={styles.browseTitle}>Browse by mood</Text>
            <BrowseGrid />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.bg },

  header: { paddingHorizontal: 20, paddingBottom: 16 },
  headerTitle: { fontSize: 28, fontWeight: "800", color: P.text },
  headerSub: { fontSize: 13, color: P.sub, marginTop: 4 },

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginBottom: 24,
    height: 52,
    borderRadius: 16,
    paddingHorizontal: 14,
    backgroundColor: P.surface,
    borderWidth: 1.5,
    borderColor: P.border,
  },
  searchBarFocused: { borderColor: P.red },
  searchInput: { flex: 1, color: P.text, fontSize: 15 },

  resultsList: { paddingHorizontal: 20 },
  resultsCount: { fontSize: 13, color: P.sub, marginBottom: 12, fontWeight: "600" },

  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: P.divider,
    gap: 12,
  },
  resultIndex: { width: 22, fontSize: 13, color: P.sub, fontWeight: "700", textAlign: "center" },
  resultThumb: { width: 52, height: 52, borderRadius: 12, overflow: "hidden", backgroundColor: P.border },
  resultThumbFallback: { alignItems: "center", justifyContent: "center", backgroundColor: P.redLight },
  resultTitle: { fontSize: 14, fontWeight: "700", color: P.text },
  resultArtist: { fontSize: 12, color: P.sub, marginTop: 2 },
  resultPlayBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: P.redLight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#FBCDD2",
  },

  emptyState: { alignItems: "center", paddingVertical: 60, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: P.text, marginBottom: 8 },
  emptyText: { fontSize: 14, color: P.sub, textAlign: "center", lineHeight: 21 },

  historySection: { paddingHorizontal: 20 },
  historyHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  historyTitle: { fontSize: 16, fontWeight: "700", color: P.text },
  clearAllBtn: { fontSize: 13, color: P.red, fontWeight: "600" },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: P.surface,
    borderRadius: 50,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: P.border,
  },
  chipText: { fontSize: 13, color: P.text, fontWeight: "600" },

  browseTitle: { fontSize: 18, fontWeight: "800", color: P.text, paddingHorizontal: 20, marginBottom: 14, marginTop: 8 },
});
