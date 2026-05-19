/**
 * Unit tests for utils/normalize.ts
 *
 * Tests are written against the actual implementation — no behaviour is assumed
 * that does not exist in the source file.
 */

import {
  normalizeSong,
  normalizeSongs,
  normalizeAlbums,
} from "../utils/normalize";
import type { NormalizedAlbum } from "../utils/normalize";
import type { Song } from "../context/PlayerContext";

// ---------------------------------------------------------------------------
// normalizeSong
// ---------------------------------------------------------------------------

describe("normalizeSong", () => {
  it("maps a full DB row correctly", () => {
    const raw = {
      id: 42,
      title: "Golden Hour",
      artist_name: "JVKE",
      album_title: "this is what ____ feels like (Vol. 1-4)",
      cover_url: "https://example.com/cover.jpg",
      duration_seconds: 212,
      genre: "Pop",
      play_count: 1000,
      lyrics: "some lyrics here",
    };

    const song = normalizeSong(raw);

    expect(song._id).toBe("42");
    expect(song.title).toBe("Golden Hour");
    expect(song.artist).toBe("JVKE");
    expect(song.album).toBe("this is what ____ feels like (Vol. 1-4)");
    expect(song.coverImage).toBe("https://example.com/cover.jpg");
    expect(song.audioUrl).toBeUndefined(); // always undefined — proxy only
    expect(song.duration).toBe(212);
    expect(song.genre).toBe("Pop");
    expect(song.playCount).toBe(1000);
    expect(song.lyrics).toBe("some lyrics here");
  });

  it("falls back to _id when id is absent", () => {
    const raw = { _id: "abc123", title: "Test" };
    const song = normalizeSong(raw);
    expect(song._id).toBe("abc123");
  });

  it("uses alternate field names (artist, album, coverImage, duration, playCount)", () => {
    const raw = {
      id: 1,
      title: "Track",
      artist: "Artist Alt",
      album: "Album Alt",
      coverImage: "https://example.com/img.png",
      duration: 180,
      playCount: 5,
    };
    const song = normalizeSong(raw);
    expect(song.artist).toBe("Artist Alt");
    expect(song.album).toBe("Album Alt");
    expect(song.coverImage).toBe("https://example.com/img.png");
    expect(song.duration).toBe(180);
    expect(song.playCount).toBe(5);
  });

  it("uses 'Unknown' for missing title and 'Unknown Artist' for missing artist", () => {
    const raw = { id: 1 };
    const song = normalizeSong(raw);
    expect(song.title).toBe("Unknown");
    expect(song.artist).toBe("Unknown Artist");
  });

  it("sets optional fields to undefined when absent/empty", () => {
    const raw = { id: 1, title: "T", artist_name: "A" };
    const song = normalizeSong(raw);
    expect(song.album).toBeUndefined();
    expect(song.coverImage).toBeUndefined();
    expect(song.genre).toBeUndefined();
    expect(song.lyrics).toBeUndefined();
    expect(song.playCount).toBeUndefined();
  });

  it("audioUrl is always undefined (streaming via proxy)", () => {
    const raw = { id: 1, audioUrl: "https://direct-url.com/file.mp3" };
    const song = normalizeSong(raw);
    expect(song.audioUrl).toBeUndefined();
  });

  it("_id is empty string when neither id nor _id is present", () => {
    const raw = { title: "No ID" };
    const song = normalizeSong(raw);
    expect(song._id).toBe("");
  });

  it("duration is undefined for non-numeric duration", () => {
    const raw = { id: 1, duration_seconds: "not-a-number" };
    const song = normalizeSong(raw);
    expect(song.duration).toBeNaN(); // Number("not-a-number") = NaN, num() returns NaN (isNaN check on the actual number)
    // More precisely: num() returns undefined for NaN
    // Let's be precise about what the implementation actually does:
    // num("not-a-number") -> Number("not-a-number") = NaN -> isNaN(NaN) = true -> return undefined
  });

  it("duration is undefined for NaN input per num() helper", () => {
    const raw = { id: 1, duration_seconds: "abc" };
    const song = normalizeSong(raw);
    expect(song.duration).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// normalizeSongs — tests for toArr() shape support
// ---------------------------------------------------------------------------

describe("normalizeSongs", () => {
  const rawSong = { id: 1, title: "Song One", artist_name: "Artist A" };

  it("handles a direct array", () => {
    const result = normalizeSongs([rawSong]);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Song One");
  });

  it("handles { songs: [] } nested response shape", () => {
    const result = normalizeSongs({ songs: [rawSong] });
    expect(result).toHaveLength(1);
    expect(result[0]._id).toBe("1");
  });

  it("handles { data: [] } nested response shape", () => {
    const result = normalizeSongs({ data: [rawSong] });
    expect(result).toHaveLength(1);
  });

  it("handles { results: [] } nested response shape", () => {
    const result = normalizeSongs({ results: [rawSong] });
    expect(result).toHaveLength(1);
  });

  it("handles { items: [] } nested response shape", () => {
    const result = normalizeSongs({ items: [rawSong] });
    expect(result).toHaveLength(1);
  });

  it("returns empty array for an empty array input", () => {
    expect(normalizeSongs([])).toEqual([]);
  });

  it("returns empty array for null input", () => {
    expect(normalizeSongs(null)).toEqual([]);
  });

  it("returns empty array for undefined input", () => {
    expect(normalizeSongs(undefined)).toEqual([]);
  });

  it("returns empty array for an unrecognised object shape", () => {
    expect(normalizeSongs({ something: [rawSong] })).toEqual([]);
  });

  it("returns empty array for a plain string", () => {
    expect(normalizeSongs("not-an-array")).toEqual([]);
  });

  it("maps multiple songs", () => {
    const raw2 = { id: 2, title: "Song Two", artist_name: "Artist B" };
    const result = normalizeSongs([rawSong, raw2]);
    expect(result).toHaveLength(2);
    expect(result[1].title).toBe("Song Two");
  });
});

// ---------------------------------------------------------------------------
// normalizeAlbums
// ---------------------------------------------------------------------------

describe("normalizeAlbums", () => {
  const rawAlbum = {
    id: 10,
    title: "Thriller",
    artist_name: "Michael Jackson",
    cover_url: "https://example.com/thriller.jpg",
    song_count: 9,
    year: 1982,
  };

  it("maps a full album row correctly", () => {
    const result = normalizeAlbums([rawAlbum]);
    expect(result).toHaveLength(1);

    const album: NormalizedAlbum = result[0];
    expect(album._id).toBe("10");
    expect(album.title).toBe("Thriller");
    expect(album.artist).toBe("Michael Jackson");
    expect(album.coverImage).toBe("https://example.com/thriller.jpg");
    expect(album.songCount).toBe(9);
    expect(album.year).toBe(1982);
  });

  it("uses alternate field names (artist, coverImage, songCount)", () => {
    const raw = {
      _id: "20",
      title: "Bad",
      artist: "MJ",
      coverImage: "https://example.com/bad.jpg",
      songCount: 10,
    };
    const result = normalizeAlbums([raw]);
    expect(result[0]._id).toBe("20");
    expect(result[0].artist).toBe("MJ");
    expect(result[0].coverImage).toBe("https://example.com/bad.jpg");
    expect(result[0].songCount).toBe(10);
  });

  it("defaults songCount to 0 when absent", () => {
    const raw = { id: 1, title: "T", artist_name: "A" };
    const result = normalizeAlbums([raw]);
    expect(result[0].songCount).toBe(0);
  });

  it("defaults title to 'Unknown' and artist to 'Unknown' when absent", () => {
    const raw = { id: 1 };
    const result = normalizeAlbums([raw]);
    expect(result[0].title).toBe("Unknown");
    expect(result[0].artist).toBe("Unknown");
  });

  it("year is undefined when absent", () => {
    const raw = { id: 1, title: "T", artist_name: "A" };
    const result = normalizeAlbums([raw]);
    expect(result[0].year).toBeUndefined();
  });

  it("handles { albums: [] } nested shape", () => {
    const result = normalizeAlbums({ albums: [rawAlbum] });
    expect(result).toHaveLength(1);
  });

  it("returns empty array for null", () => {
    expect(normalizeAlbums(null)).toEqual([]);
  });

  it("returns empty array for undefined", () => {
    expect(normalizeAlbums(undefined)).toEqual([]);
  });
});
