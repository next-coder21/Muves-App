# Muves Mobile — Known Limitations (Pre-Beta)

This document records architectural constraints and platform-level limitations that testers and reviewers must be aware of. These are not bugs — they are known tradeoffs or platform behaviours that affect testing strategy.

---

## 1. Lock Screen / Notification Metadata Requires a Native Build

**What**: Song title, artist name, and cover art on the Android lock screen and in the notification shade are managed by a native media session. This functionality is not available in Expo Go.

**Why**: Expo Go does not support custom native modules or foreground service configurations required for the Android `MediaSession` API.

**Impact**: Lock screen metadata will appear blank or use placeholder data when testing in Expo Go. Notification controls may not function fully.

**Resolution**: Build and install a dev client using:
```
npx expo run:android
```
All lock screen, notification, and background playback tests must be performed on a dev build, not Expo Go.

---

## 2. Xiaomi / Oppo / Vivo Battery Optimisation Kills Background Playback

**What**: MIUI (Xiaomi), ColorOS (Oppo), and FuntouchOS (Vivo) ship with aggressive battery optimisation that terminates background processes — including foreground services — more aggressively than stock Android.

**Why**: These OEMs override standard Android lifecycle guarantees to reduce battery consumption. A foreground service that would survive indefinitely on a Pixel or Samsung device may be killed within minutes on a Xiaomi device.

**Impact**: Background audio playback may stop unexpectedly on these devices, even with a correctly configured foreground service.

**Resolution — Developer action**: Ensure the foreground service is declared correctly in `AndroidManifest.xml` and that `FOREGROUND_SERVICE` permission is included.

**Resolution — User action**: Users on affected devices must manually whitelist the Muves app in their battery settings:
- **Xiaomi/MIUI**: Settings > Apps > Muves > Battery Saver > No restrictions
- **Oppo/ColorOS**: Settings > Battery > App power consumption > Muves > Allow background activity
- **Vivo/FuntouchOS**: Settings > Battery > High background power consumption > Enable for Muves

**Testing note**: Xiaomi battery optimisation tests should be marked as a known platform limitation in test reports, not as app bugs, unless the foreground service declaration is itself incorrect.

---

## 3. `expo-media-library` Limited Access in Expo Go on Android 13+

**What**: On Android 13 and above, `expo-media-library` requires the new `READ_MEDIA_AUDIO` permission (replacing the deprecated `READ_EXTERNAL_STORAGE`). In Expo Go, this permission is scoped to Expo's own entitlements and may not grant full access to the device's audio library.

**Why**: Expo Go is a sandboxed host app. Its `AndroidManifest.xml` was built before Android 13 permission splits were fully adopted in all Expo SDK versions, and the host app's permission grants do not always extend to SDK modules in the way a standalone build would.

**Impact**:
- Local song library may appear empty or partially populated in Expo Go on Android 13+ devices
- `expo-media-library.getAssetsAsync()` may return fewer results than expected
- Permission prompts may behave differently than in a production build

**Resolution**: Test all local media library features using a dev build (`npx expo run:android`). Expo Go testing is acceptable only for UI and non-media flows.

---

## 4. Rate Limiting Is Currently Disabled

**What**: The backend API does not currently enforce rate limiting on any endpoints.

**Why**: Rate limiting was disabled during active development to avoid blocking internal testing traffic. It has not yet been re-enabled.

**Impact**:
- The app and its users are not protected against abuse, accidental request floods, or runaway retry loops
- Performance test results (e.g. rapid sequential API calls) may not reflect production behaviour once limiting is re-enabled

**Resolution**: Rate limiting must be explicitly re-enabled on the backend before the public beta or production launch. This is a backend task. Once re-enabled, the mobile app should be tested to ensure it handles `429 Too Many Requests` responses gracefully — ideally with exponential back-off and a user-facing message.

**Risk**: High — leaving rate limiting disabled in production exposes the backend to abuse and unexpected cost.

---

## 5. `audioUrl` Is Always `undefined` in Song Objects (By Design)

**What**: The `audioUrl` field on the `Song` type is always set to `undefined` in `normalizeSong()`, regardless of what the API returns.

**Why**: All audio must be streamed through the authenticated proxy endpoint `/auth/music/stream/:id`. Direct CDN or storage URLs are never exposed to the client. This is a security measure to prevent unauthenticated access to audio files.

**Impact**: Any code that reads `song.audioUrl` directly to resolve a playback URL will get `undefined`. Audio playback must go through the proxy endpoint using the song's `_id`.

**Resolution**: This is correct behaviour. Do not "fix" this. If a new developer adds direct URL playback, it should be treated as a security regression.

---

## 6. `localPath` Is Not Populated by `normalizeSong()`

**What**: The `Song.localPath` field (used for offline device-local files) is not set by `normalizeSong()`. It is only populated by the local songs context after reading from the device media library.

**Why**: `normalizeSong()` maps remote DB rows. Local file paths are a separate concern managed by `LocalSongsContext`.

**Impact**: Remote songs fetched via the API will always have `localPath: undefined` after normalization. This is expected. The player resolves local vs remote at playback time.
