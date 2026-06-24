// ─── Toggle here ─────────────────────────────────────────────────────────────
// Set USE_LOCAL to true  → dev server at DEV_BASE
// Set USE_LOCAL to false → production Render server
const USE_LOCAL = false;
// adb reverse tcp:5000 tcp:5000 tunnels host port 5000 → emulator localhost:5000
const DEV_BASE  = "http://10.103.109.254:5000";
const PROD_BASE = "https://api.lijishwilson.in/muves";
// ─────────────────────────────────────────────────────────────────────────────

const RAW_BASE =
  (typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_URL) ||
  (USE_LOCAL ? DEV_BASE : PROD_BASE);

// Strip trailing slash so url joins are predictable
const BASE_URL = RAW_BASE.replace(/\/+$/, "");

export const API = {
  BASE_URL,
  // Auth
  LOGIN:           `${BASE_URL}/auth/login`,
  REGISTER:        `${BASE_URL}/auth/register`,
  FORGOT_PASSWORD: `${BASE_URL}/auth/forgot-password`,
  VERIFY_OTP:      `${BASE_URL}/auth/verify-otp`,
  VERIFY_SECURITY: `${BASE_URL}/auth/verify-security`,
  RESET_PASSWORD:  `${BASE_URL}/auth/reset-password`,
  LOGOUT:          `${BASE_URL}/auth/logout`,
  CHECK_AUTH:      `${BASE_URL}/auth/check-auth`,
  UPDATE_ACCOUNT:  `${BASE_URL}/auth/update-account`,
  // Music  (mounted at /auth/music in KKaudioBk)
  SONGS_URL:       `${BASE_URL}/auth/music/songs`,
  ALBUMS_URL:      `${BASE_URL}/auth/music/albums`,
  ARTISTS_URL:     `${BASE_URL}/auth/music/artists`,
  STREAM_URL:      `${BASE_URL}/auth/music/stream`,
  COVER_URL:       `${BASE_URL}/auth/music/cover`,
  SONG_BY_ID:      (id: string) => `${BASE_URL}/auth/music/songs/${encodeURIComponent(id)}`,
  ALBUM_SONGS:     (id: string) => `${BASE_URL}/auth/music/albums/${encodeURIComponent(id)}/songs`,
  // Lyrics (per song)
  LYRICS_URL:      (id: string) => `${BASE_URL}/auth/music/songs/${encodeURIComponent(id)}/lyrics`,
  // Search
  SEARCH_URL:      `${BASE_URL}/auth/search`,
  // Queue persistence
  QUEUE_GET:       `${BASE_URL}/auth/queue`,
  QUEUE_SYNC:      `${BASE_URL}/auth/queue/sync`,
  QUEUE_CLEAR:     `${BASE_URL}/auth/queue/clear`,
  // Favourites
  FAVOURITES:      `${BASE_URL}/auth/favourites`,
  FAV_ADD:         `${BASE_URL}/auth/favourites/add`,
  FAV_REMOVE:      `${BASE_URL}/auth/favourites/remove`,
  // Feedback
  FEEDBACK:        `${BASE_URL}/auth/feedback`,
  // Playlists
  PLAYLISTS:       `${BASE_URL}/auth/playlists`,
  PLAYLIST:        (id: string) => `${BASE_URL}/auth/playlists/${encodeURIComponent(id)}`,
  PLAYLIST_SONGS:  (id: string) => `${BASE_URL}/auth/playlists/${encodeURIComponent(id)}/songs`,
  PLAYLIST_SONG:   (id: string, songId: string) =>
    `${BASE_URL}/auth/playlists/${encodeURIComponent(id)}/songs/${encodeURIComponent(songId)}`,
};
