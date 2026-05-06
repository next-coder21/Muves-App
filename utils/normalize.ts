import { Song } from "@/context/PlayerContext";

// Maps a raw DB song row (KKaudioBk) to the Song shape used throughout the app
export function normalizeSong(raw: any): Song {
  return {
    _id:        String(raw.id ?? raw._id ?? ""),
    title:      raw.title ?? "Unknown",
    artist:     raw.artist_name ?? raw.artist ?? "Unknown Artist",
    album:      raw.album_title ?? raw.album,
    coverImage: raw.cover_url   ?? raw.coverImage,
    audioUrl:   undefined, // always stream via /auth/music/stream/:id proxy
    duration:   raw.duration_seconds ?? raw.duration,
    genre:      raw.genre,
    playCount:  raw.play_count  ?? raw.playCount,
    lyrics:     raw.lyrics      ?? undefined,
  };
}

export function normalizeArtist(raw: any) {
  return {
    _id:       String(raw.id ?? raw._id ?? ""),
    name:      raw.name ?? "Unknown",
    image:     raw.image_url ?? raw.image,
    verified:  raw.verified,
    songCount: raw.song_count ?? raw.songCount,
  };
}

export function normalizeAlbum(raw: any) {
  return {
    _id:        String(raw.id ?? raw._id ?? ""),
    title:      raw.title ?? "Unknown",
    artist:     raw.artist_name ?? raw.artist ?? "Unknown",
    coverImage: raw.cover_url ?? raw.coverImage,
    songCount:  Number(raw.song_count ?? raw.songCount ?? 0),
    year:       raw.year,
  };
}

export function normalizeSongs(data: any): Song[] {
  const arr = Array.isArray(data) ? data : (data?.songs ?? []);
  return arr.map(normalizeSong);
}

export function normalizeArtists(data: any) {
  const arr = Array.isArray(data) ? data : (data?.artists ?? []);
  return arr.map(normalizeArtist);
}

export function normalizeAlbums(data: any) {
  const arr = Array.isArray(data) ? data : (data?.albums ?? []);
  return arr.map(normalizeAlbum);
}
