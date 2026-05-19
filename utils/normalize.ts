import { Song } from "@/context/PlayerContext";

type R = Record<string, unknown>;

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" && v ? v : fallback;
}
function num(v: unknown): number | undefined {
  const n = Number(v);
  return isNaN(n) ? undefined : n;
}
function toArr(data: unknown): R[] {
  if (Array.isArray(data)) return data as R[];
  const d = data as R;
  // Support: { songs:[] } | { artists:[] } | { albums:[] } | { data:[] } | { items:[] } | { results:[] }
  const nested =
    d?.songs ??
    d?.artists ??
    d?.albums ??
    d?.data ??
    d?.items ??
    d?.results;
  return Array.isArray(nested) ? (nested as R[]) : [];
}

// Maps a raw DB song row (KKaudioBk) to the Song shape used throughout the app
export function normalizeSong(raw: R): Song {
  return {
    _id:        String(raw.id ?? raw._id ?? ""),
    title:      str(raw.title, "Unknown"),
    artist:     str(raw.artist_name ?? raw.artist, "Unknown Artist"),
    album:      str(raw.album_title ?? raw.album) || undefined,
    coverImage: str(raw.cover_url ?? raw.coverImage) || undefined,
    audioUrl:   undefined, // always stream via /auth/music/stream/:id proxy
    duration:   num(raw.duration_seconds ?? raw.duration),
    genre:      str(raw.genre) || undefined,
    playCount:  num(raw.play_count ?? raw.playCount),
    lyrics:     str(raw.lyrics) || undefined,
  };
}

export type NormalizedArtist = {
  _id: string;
  name: string;
  image: string | undefined;
  verified: boolean;
  songCount: number | undefined;
};

export type NormalizedAlbum = {
  _id: string;
  title: string;
  artist: string;
  coverImage: string | undefined;
  songCount: number;
  year: number | undefined;
};

export function normalizeArtist(raw: R): NormalizedArtist {
  return {
    _id:       String(raw.id ?? raw._id ?? ""),
    name:      str(raw.name, "Unknown"),
    image:     str(raw.image_url ?? raw.image) || undefined,
    verified:  Boolean(raw.verified),
    songCount: num(raw.song_count ?? raw.songCount),
  };
}

export function normalizeAlbum(raw: R): NormalizedAlbum {
  return {
    _id:        String(raw.id ?? raw._id ?? ""),
    title:      str(raw.title, "Unknown"),
    artist:     str(raw.artist_name ?? raw.artist, "Unknown"),
    coverImage: str(raw.cover_url ?? raw.coverImage) || undefined,
    songCount:  Number(raw.song_count ?? raw.songCount ?? 0) || 0,
    year:       num(raw.year),
  };
}

export function normalizeSongs(data: unknown): Song[] {
  return toArr(data).map(normalizeSong);
}

export function normalizeArtists(data: unknown): NormalizedArtist[] {
  return toArr(data).map(normalizeArtist);
}

export function normalizeAlbums(data: unknown): NormalizedAlbum[] {
  return toArr(data).map(normalizeAlbum);
}
