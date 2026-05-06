<div align="center">

# Muve𝄞 Mobile

### Music Streaming App — React Native & Expo

*A production-grade, cross-platform music streaming application with synchronized lyrics, background audio, lock screen controls, and a full playlist management system*

---

[![Expo](https://img.shields.io/badge/Expo-54-000020?style=flat-square&logo=expo&logoColor=white)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React_Native-0.81-61DAFB?style=flat-square&logo=react&logoColor=black)](https://reactnative.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Reanimated](https://img.shields.io/badge/Reanimated-4-purple?style=flat-square)](https://docs.swmansion.com/react-native-reanimated)
[![EAS](https://img.shields.io/badge/Build-EAS-000020?style=flat-square&logo=expo&logoColor=white)](https://expo.dev/eas)
[![Platform](https://img.shields.io/badge/Platforms-Android_·_iOS_·_Web-green?style=flat-square)](https://expo.dev)

</div>

---

## What Is This?

Muve𝄞 Mobile is the **Android and iOS client** for the KK-lisn music streaming platform — a personal project built to archive and stream Kanyakumari VBS (Vacation Bible School) Christian music from 2020–2024.

It is a full-featured streaming app: real-time audio from a server-side proxy, synchronized LRC lyrics, background playback with lock screen controls, playlist and favorites management, and a glass-morphism dark UI — all built with React Native, Expo, and TypeScript.

> **License Notice:** This codebase is publicly visible for educational and portfolio reference only. It may not be copied, modified, distributed, or used in any project without explicit permission.

---

## Feature Overview

### Playback

| Feature | Description |
|---|---|
| **Audio Streaming** | Server-proxied streaming (resolves Google Drive tokens server-side) with HTTP range support for seek |
| **Background Playback** | Music continues playing when the app is backgrounded or the screen locks |
| **Lock Screen Controls** | Now-playing metadata and playback controls on the Android/iOS lock screen |
| **Full-Screen Player** | Large artwork, animated progress scrubber, time display, shuffle, repeat |
| **Mini Player** | Persistent compact player above the tab bar — play/pause, skip, progress bar |
| **Synchronized Lyrics** | LRC-format lyrics that auto-scroll to the active line in real time |
| **Queue & History** | Play queue with shuffle (Fisher-Yates), playback history (capped at 50 items) |

### Discovery & Library

| Feature | Description |
|---|---|
| **Home** | Time-based greeting, artist carousel, trending and featured songs |
| **Search** | Real-time debounced search across songs, artists, and albums with persistent history |
| **Albums** | Album detail pages with cover art hero, song list, and Play All |
| **Artists** | Browsable artist grid with song counts |
| **Playlists** | Create, rename, delete playlists; add and remove individual songs |
| **Favorites** | Heart-toggle on any song, dedicated Favorites tab, optimistic UI updates |
| **Library** | Unified view — Playlists, Recent, Albums, Favourites tabs |

### Account

| Feature | Description |
|---|---|
| **Auth** | Email/password login and signup with JWT session persistence |
| **Password Recovery** | Security-question-based password reset flow |
| **Profile** | Account management and preference settings |
| **Per-User Caching** | All AsyncStorage keys are scoped to the user's email — no data leaks on shared devices |

---

## Tech Stack

```
Core
├── React Native 0.81.5    — Cross-platform mobile framework
├── Expo 54.0.33           — Managed workflow, build tooling, native modules
├── TypeScript 5.9.2       — Strict mode, path aliases (@/*)
└── React 19.1.0           — Concurrent features, React Compiler (experimental)

Navigation
├── Expo Router 6.0.23     — File-based routing (typed routes experiment enabled)
├── @react-navigation/native         — Navigation primitives
├── @react-navigation/bottom-tabs    — Tab bar navigator
└── expo-linking           — Deep link handling (scheme: muves://)

Audio
└── expo-audio 1.1.1       — Audio engine (streaming, background, lock screen metadata)

Animations
├── react-native-reanimated 4.1.1    — Gesture-driven and worklet animations
├── react-native-gesture-handler 2.28.0
├── react-native-worklets 0.5.1
└── Animated API (RN)                — Spring/timing for MiniPlayer, bottom sheets

UI & Visual
├── expo-blur              — BlurView for glass-morphism surfaces
├── expo-linear-gradient   — Gradient overlays on artwork and hero sections
├── expo-haptics           — Tactile feedback on tab and interactive presses
├── @expo/vector-icons     — MaterialIcons icon system
└── expo-image             — Optimized image rendering (disk + memory cache)

State & Persistence
├── React Context API      — 4 custom providers (Auth, Player, Favourites, Playlists)
└── AsyncStorage           — Per-user persistent caching for session, favorites, playlists

HTTP & API
└── Custom apiClient.ts    — AbortController timeouts, Bearer injection, global 401 hook

Build
└── EAS (Expo Application Services) — Multi-profile builds: dev / preview / production APK / Play Store AAB
```

---

## Architecture

```
muvesmobile/
├── app/                        # Screen routes (Expo Router file-based)
│   ├── _layout.tsx             # Root: provider tree, auth gate, splash control
│   ├── login.tsx               # Public auth screens
│   ├── signup.tsx
│   ├── forgot-password.tsx
│   ├── player.tsx              # Full-screen player (modal — slides from bottom)
│   ├── artists.tsx             # Artists grid
│   ├── album/[id].tsx          # Dynamic album detail route
│   ├── playlist/[id].tsx       # Dynamic playlist detail route
│   └── (tabs)/
│       ├── _layout.tsx         # Tab navigator with MiniPlayer overlay
│       ├── index.tsx           # Home — greeting, carousel, featured songs
│       ├── explore.tsx         # Search with debouncing and history
│       ├── library.tsx         # Playlists / Recent / Albums / Favourites
│       └── profile.tsx         # Account settings and preferences
│
├── components/
│   ├── MiniPlayer.tsx          # Compact player above tab bar
│   ├── AddToPlaylistSheet.tsx  # Animated bottom sheet for playlist operations
│   ├── haptic-tab.tsx          # Tab button with expo-haptics feedback
│   ├── parallax-scroll-view.tsx
│   ├── themed-text.tsx         # Dark-theme aware Text
│   ├── themed-view.tsx         # Dark-theme aware View
│   └── ui/
│       ├── collapsible.tsx
│       └── icon-symbol.tsx     # Cross-platform icon abstraction (iOS / Android)
│
├── context/
│   ├── AuthContext.tsx         # Session, login, logout, 401 global hook
│   ├── PlayerContext.tsx       # Queue, playback state, controls, lock screen
│   ├── FavouritesContext.tsx   # Favourite IDs (Set), optimistic toggle
│   └── PlaylistContext.tsx     # Playlist CRUD, optimistic updates
│
├── hooks/
│   ├── useApi.ts               # GET/POST/PATCH/DELETE wrappers with auto-token
│   ├── usePlayerInset.ts       # Safe area inset for player overlay
│   ├── use-color-scheme.ts
│   └── use-theme-color.ts
│
├── utils/
│   ├── apiClient.ts            # Centralized HTTP — timeouts, errors, auth
│   └── normalize.ts            # DB row → app model transformations
│
├── constants/
│   ├── api.ts                  # Endpoint definitions, base URL toggle (dev/prod)
│   └── theme.ts                # Color palette, fonts
│
├── app.json                    # Expo manifest (package, permissions, icons)
└── eas.json                    # EAS build profiles
```

---

## State Management

Four React Context providers, each with a focused domain and composed in dependency order:

```
AuthProvider           ← manages user session + token
  └── PlayerProvider   ← uses token to authenticate audio stream URLs
        └── FavouritesProvider   ← uses token for API calls
              └── PlaylistProvider     ← uses token for API calls
```

### AuthContext

- JWT stored in AsyncStorage (`muves_token`, `muves_user`) for auto-login on next open
- Background token validation on startup with a **45-second timeout** (tolerates Render cold boots)
- Global 401/403 handler — any API call returning unauthorized automatically signs the user out
- Logout handler registry — PlayerContext and FavouritesContext register cleanup callbacks that fire on logout

### PlayerContext

The most complex piece of the app. Manages a single persistent `AudioPlayer` instance across the entire session:

| Concern | Implementation |
|---|---|
| **Playback** | Single `AudioPlayer` reused via `replace()` — no memory leaks from repeated instantiation |
| **Queue** | Ordered array; shuffle uses Fisher-Yates for unbiased randomization |
| **History** | Capped at 50 entries — plays previous song on `prev()` if history exists |
| **Loading state** | Distinguishes *initial load* (spinner) from *mid-playback buffering* (progress bar pulse) |
| **Lock screen** | Sets now-playing metadata (title, artist, artwork) and responds to lock screen transport controls |
| **Streaming** | Audio URLs point to `/auth/music/stream/:id` — never direct Google Drive links |

### FavouritesContext & PlaylistContext

Both implement **optimistic UI**: the UI updates instantly on user action, the API call runs in the background, and the state rolls back if the request fails. Each uses a **load ID** pattern to discard stale responses when a newer request is in flight — preventing race conditions on slow connections.

---

## API Integration

All HTTP calls go through `utils/apiClient.ts` — a thin wrapper around `fetch` with:

- **AbortController timeouts** — configurable per endpoint, not a blunt global setting
- **Bearer token injection** from AuthContext on every authenticated request
- **Structured error parsing** — distinguishes network failure, timeout, auth error, and HTTP error shapes
- **Global 401 hook** — registered by AuthContext so any screen can trigger sign-out without prop drilling

**Per-endpoint timeouts (reflecting real-world conditions):**

| Endpoint | Timeout | Reason |
|---|---|---|
| `/auth/check-auth` | 45s | Render free-tier cold boot tolerance |
| `/auth/login` | 60s | First request after cold boot |
| `/auth/logout` | 6s | Best-effort, non-blocking |
| All others | 15s | Standard |

**Base URL** is toggled via `constants/api.ts` — switch between local dev server and production with one line.

---

## Navigation Design

Expo Router's file-based routing maps directly to the app's URL structure:

| Route | Screen | Auth |
|---|---|---|
| `/login` | Login | Public |
| `/signup` | Sign Up | Public |
| `/forgot-password` | Password Reset | Public |
| `/(tabs)` | Home | Protected |
| `/(tabs)/explore` | Search | Protected |
| `/(tabs)/library` | Library | Protected |
| `/(tabs)/profile` | Profile | Protected |
| `/player` | Full-Screen Player | Protected (modal) |
| `/album/[id]` | Album Detail | Protected |
| `/playlist/[id]` | Playlist Detail | Protected |
| `/artists` | Artists Grid | Protected |

The root `_layout.tsx` is the **auth gate**: unauthenticated users are redirected to `/login` before any protected route resolves. The tab layout renders `MiniPlayer` as a persistent overlay above the tab bar, independently of which tab is active.

---

## UI & Design System

**Design language:** Dark-first, glass-morphism, lime accent.

```
Colors
├── Background:   #0d0d0d  #141414  #161616
├── Accent:       #C8FF00  (lime — active states, progress, highlights)
├── Surface:      rgba(255,255,255,0.04)   card backgrounds
├── Border:       rgba(255,255,255,0.08)   subtle separators
└── Text:         #ffffff (primary)   rgba(255,255,255,0.5) (secondary)

Effects
├── expo-blur BlurView          — Glass-morphism panels (MiniPlayer, bottom sheets)
├── expo-linear-gradient        — Album art gradients, hero overlays
└── react-native-reanimated     — Gesture-linked, worklet-based animations

Haptics
└── expo-haptics                — Impact feedback on tab presses and key interactions

Animation patterns
├── MiniPlayer:         Spring scale + fade on song change
├── AddToPlaylistSheet: Animated.spring slide-up from off-screen
├── Lyrics panel:       Timed scroll to active line on timestamp change
└── Progress scrubber:  Continuous Animated.timing driven by PlayerContext state
```

---

## Build & Deployment

Configured with **EAS (Expo Application Services)** across four profiles:

| Profile | Format | Distribution | Use Case |
|---|---|---|---|
| `development` | APK | Internal | Local development with dev client |
| `preview` | APK | Internal | Stakeholder testing builds |
| `production-apk` | APK | Internal | Sideload release (current channel) |
| `production` | AAB | Google Play | Play Store submission |

**Android config:**
- Package: `com.muves.app`
- New Architecture: enabled (`newArchEnabled: true`)
- React Compiler: enabled (experimental)
- Permissions: `INTERNET`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK`, `WAKE_LOCK`, `MODIFY_AUDIO_SETTINGS`
- Edge-to-edge layout enabled

**iOS config:**
- Bundle ID: `com.muves.app`
- Background audio mode enabled
- Tablet support enabled

---

## Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI — `npm install -g expo`
- EAS CLI ≥ 12.0.0 — `npm install -g eas-cli`
- Android emulator or physical device

### Local Setup

```bash
# Clone
git clone https://github.com/next-coder21/muvesmobile.git
cd muvesmobile

# Install dependencies
npm install

# Start Expo dev server
npx expo start

# Run on Android
npx expo run:android

# Run on iOS
npx expo run:ios
```

### Switching API Target

In `constants/api.ts`, toggle the `BASE_URL` to point at your local backend:

```ts
// Development
export const BASE_URL = "http://10.x.x.x:5000";

// Production
export const BASE_URL = "https://kkmusicserver.onrender.com";
```

### EAS Builds

```bash
# Preview APK (internal testing)
eas build --profile preview --platform android

# Production AAB (Play Store)
eas build --profile production --platform android
```

---

## Design Decisions

**Why a single persistent `AudioPlayer` instance?**
Creating a new audio instance per song causes memory fragmentation and brief silence gaps during track changes. A single instance reused via `replace()` gives clean transitions and predictable resource usage across the entire session.

**Why server-proxied streaming instead of direct Drive URLs?**
Google Drive URLs for audio files embed short-lived confirmation tokens that mobile apps cannot reliably follow. Routing all audio through `/auth/music/stream/:id` lets the backend resolve, cache (50-minute TTL), and proxy the stream — the app sends a single Bearer-authed request like any other endpoint.

**Why per-user AsyncStorage key scoping?**
On a shared or family device, a second user logging in should never see the first user's cached favorites or playlists. Suffixing every key with the user's email (`muves_fav_ids:{email}`) makes cache isolation automatic and requires no explicit cleanup on logout.

**Why load IDs in FavouritesContext and PlaylistContext?**
On a slow connection, a user might trigger multiple rapid state changes before the first fetch resolves. Without load IDs, the stale response from an earlier request can overwrite fresher state. A monotonically incrementing load ID lets each response check whether it's still the most recent before committing.

**Why Fisher-Yates shuffle?**
`arr.sort(() => Math.random() - 0.5)` produces a biased shuffle — some permutations are statistically far more likely than others. Fisher-Yates is O(n) and uniformly unbiased, which matters when a queue might have dozens of songs.

---

## Author

Built by **[@next-coder21](https://github.com/next-coder21)** — the Android and iOS client for the KK-lisn platform, preserving and streaming Kanyakumari VBS music from 2020–2024.

---

<div align="center">

*"For educational and portfolio reference only — see license notice above."*

</div>
