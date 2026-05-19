# Muves Mobile — Beta Test Checklist
**App**: Muves Expo 54 (React Native / Expo Router)  
**Platform**: Android (primary), Expo Go + dev build  
**Format**: `[ ] Scenario — Expected behaviour — Risk (High/Medium/Low)`

---

## 1. Authentication Testing

### Core Flows
- [ ] Register with new email/password — Account created, JWT stored, user lands on home screen — High
- [ ] Login with valid credentials — JWT received, stored in AsyncStorage, auth context populated — High
- [ ] Login with wrong password — Error message displayed, no navigation — High
- [ ] Login with unregistered email — Clear "user not found" error, no crash — Medium
- [ ] Logout — JWT cleared from AsyncStorage, auth context reset, user returned to login screen — High
- [ ] JWT expires mid-session — `onAuthErrorHandler` fires (401), user redirected to login without crash — High
- [ ] App cold-start with valid stored JWT — Auto-login succeeds, home screen loads without re-entering credentials — High
- [ ] App cold-start with expired/invalid stored JWT — Silent failure, user sees login screen — High
- [ ] Password reset flow (if implemented) — Reset email sent, new password accepted — Medium

### Edge Cases
- [ ] Concurrent requests during token expiry — Only one logout triggered (handler fires once), no duplicate redirects — High
- [ ] Register with already-used email — Server 409 surfaces as readable error, no crash — Medium
- [ ] `skipAuthErrorHook: true` on auth-check calls — 401 does not trigger global logout loop — High

---

## 2. Offline Mode Testing

> Note: There is NO server-download feature. "Offline songs" are device-local files only (READ_MEDIA_AUDIO).

- [ ] Open app with no internet and no local songs — Empty state message shown, no crash — High
- [ ] Open app with no internet but local songs present — Local songs load from device, playback works — High
- [ ] Stream a song while online, lose connection mid-playback — Graceful error or buffered audio continues; no crash — High
- [ ] Browse local song list while offline — List renders correctly from device media library — Medium
- [ ] Attempt to fetch remote playlist/album while offline — Network error caught, user-facing message shown, app does not crash — High
- [ ] Regain connectivity after offline — Remote features become available without requiring app restart — Medium
- [ ] expo-media-library permission denied — Empty local library shown, permission rationale displayed — Medium

---

## 3. Audio Playback Testing

### Core Playback
- [ ] Tap a remote song — Proxy stream starts via `/auth/music/stream/:id`, audio plays — High
- [ ] Tap a local song — `file://` URI resolved, audio plays without network — High
- [ ] Play / Pause toggle — Audio starts and stops correctly, UI state matches — High
- [ ] Seek to position — Playback resumes from correct time — Medium
- [ ] Next / Previous track — Queue advances/retreats, new song loads and plays — High
- [ ] Shuffle toggle — Queue reordered randomly, player reflects new order — Medium
- [ ] Repeat one — Same song restarts after finishing — Medium
- [ ] Repeat all — Queue loops back to first song — Medium
- [ ] Song finishes naturally — Next song in queue starts automatically — High
- [ ] Play song from album view — Correct song plays, full album queued — Medium

### Background Playback
- [ ] Lock screen while playing — Audio continues without interruption — High
- [ ] Open another app while playing — Audio continues in background — High
- [ ] Swipe app from recents while playing — Audio stops (expected on Android without foreground service persistence) — Medium
- [ ] Resume from notification (if notification controls exist) — Play/pause from notification works — Medium

### Android-Specific
- [ ] Audio focus interrupted by phone call — Playback pauses during call, resumes after (or remains paused) — High
- [ ] Another audio app starts playing — Muves pauses (audio focus lost), no crash — High
- [ ] Plug in / unplug headphones — Audio pauses on unplug (Android standard behaviour) — Medium

---

## 4. ExoPlayer / Metadata Testing

> Lock screen metadata fix requires a native build — `npx expo run:android` — NOT testable in Expo Go.

- [ ] Now-playing metadata on lock screen — Title, artist, cover art shown correctly (native build only) — High
- [ ] Notification media controls — Show correct title/artist, buttons functional — High
- [ ] Seek bar in notification — Reflects correct progress — Medium
- [ ] Cover art loads in notification — Image resolves from URL, no placeholder stuck — Medium
- [ ] Metadata updates when track changes — Lock screen and notification update to new track info — High

---

## 5. Network Transition Testing

- [ ] Switch from WiFi to mobile data mid-stream — Stream recovers or shows reconnecting state — High
- [ ] Switch from mobile data to WiFi mid-stream — Stream recovers without restart — Medium
- [ ] Airplane mode on then off — App detects reconnection, resumes remote features — High
- [ ] Very slow network (throttled) — Loading states shown, no timeout crash (default 15s timeout) — Medium
- [ ] VPN toggle while streaming — Stream handles IP change gracefully — Low

---

## 6. API Testing

Test each endpoint against the live backend:

- [ ] `GET /auth/music/stream/:id` — Audio stream proxied with valid JWT, 401 without token — High
- [ ] `GET /songs` (or equivalent list endpoint) — Returns song list, normalised via `normalizeSongs()` — High
- [ ] `GET /albums` — Returns albums list, normalised via `normalizeAlbums()` — High
- [ ] `GET /artists` — Returns artists list — Medium
- [ ] `POST /auth/login` — Valid credentials return JWT — High
- [ ] `POST /auth/register` — New user created — High
- [ ] `POST /auth/logout` (if exists) — Session invalidated server-side — Medium
- [ ] Any `PATCH`/`PUT` endpoint (profile update, etc.) — Correct body sent, response handled — Medium
- [ ] 401 on expired token — Global `onAuthErrorHandler` fires, user redirected to login — High
- [ ] 403 on insufficient permissions — Handler fires, user notified — High
- [ ] 500 from server — `ApiError` with status 500 thrown, error boundary catches — High
- [ ] Request timeout (server takes > 15s) — `ApiError.isTimeout = true`, user sees timeout message — Medium

---

## 7. Performance Testing

- [ ] Cold start time < 3 seconds — App fully interactive within 3s on mid-range Android (e.g. Xiaomi Redmi) — High
- [ ] Warm start time < 1.5 seconds — Acceptable resume speed — Medium
- [ ] Memory usage < 150 MB after 30 minutes of continuous use — Monitor via Android Studio profiler — High
- [ ] Memory usage after 30 songs played — No significant heap growth (no memory leak in player context) — High
- [ ] Scroll performance on large song list (100+ items) — No dropped frames, smooth 60fps — Medium
- [ ] Image loading on slow network — Images load progressively, no UI jank — Low
- [ ] Bundle size — JS bundle size within Expo 54 norms; check with `expo export` — Low

---

## 8. Device Compatibility

> Xiaomi note: MIUI aggressive battery optimisation kills background services. User must whitelist app in battery settings.

- [ ] **Samsung Galaxy (One UI)** — Full playback, UI renders correctly, no font issues — High
- [ ] **Xiaomi / Redmi (MIUI)** — Background playback stops unless app whitelisted; test and document — High
- [ ] **OnePlus (OxygenOS)** — Playback and notifications work; battery optimisation check — Medium
- [ ] **Google Pixel (Stock Android)** — Full feature parity; baseline reference device — High
- [ ] **Vivo (FuntouchOS)** — Background service survival; notify users to whitelist — Medium
- [ ] **Android 13+** — `READ_MEDIA_AUDIO` permission flow; no legacy `READ_EXTERNAL_STORAGE` — High
- [ ] **Android 12 and below** — Fallback permission handling — Medium
- [ ] **Small screen (< 5.5")** — No layout overflow, player controls accessible — Low
- [ ] **Large screen / tablet** — No stretched UI — Low

---

## 9. Permissions Testing

- [ ] `READ_MEDIA_AUDIO` — Prompt shown on first local-library access; granted: songs appear; denied: empty state — High
- [ ] `READ_MEDIA_AUDIO` permanently denied — Settings deep-link shown — Medium
- [ ] `POST_NOTIFICATIONS` (Android 13+) — Prompt shown before first playback notification; granted: notification appears — High
- [ ] `POST_NOTIFICATIONS` denied — Playback continues without notification, no crash — High
- [ ] `FOREGROUND_SERVICE` — Background playback service starts without crash (native build) — High
- [ ] Revoke permission mid-session — App handles gracefully, no crash — Medium
- [ ] Cold start after permission revoked — App re-prompts correctly — Medium

---

## 10. Crash Testing

- [ ] Force kill app during active playback — No data corruption, clean restart — High
- [ ] Low memory (run multiple apps) — Muves degrades gracefully, does not crash other apps — High
- [ ] Corrupted/malformed API response — `normalizeSong()` returns fallback values, no unhandled exception — High
- [ ] Extremely long song title/artist name — UI truncates, no overflow crash — Low
- [ ] Play song with null `audioUrl` (proxy-only path) — Stream attempted via `/auth/music/stream/:id`, no null-deref crash — High
- [ ] API unreachable at cold start — Error boundary shows message, no white screen — High
- [ ] Rapid navigation between screens — No memory leak, no stale state crash — Medium

---

## 11. Security Testing

- [ ] JWT stored in AsyncStorage — Acceptable for mobile (not in plain text on web); document as known tradeoff — Medium
- [ ] `audioUrl` field is always `undefined` in Song object — Confirm no direct CDN URLs leak to client — High
- [ ] Bearer token sent only over HTTPS — Verify API base URL enforces HTTPS — High
- [ ] 401/403 always clears session — No partial-auth state where protected data is accessible — High
- [ ] Sensitive fields not logged — Console.log calls do not expose tokens in production build — Medium
- [ ] Rate limiting — Currently disabled; re-enable before public launch — High

---

## 12. Store Release Testing

- [ ] Release build (`eas build --profile production`) compiles without errors — High
- [ ] ProGuard / R8 minification does not break native modules — High
- [ ] App version and versionCode incremented in `app.json` / `eas.json` — Medium
- [ ] App icon and splash screen render correctly in release build — Medium
- [ ] No debug/development-only code paths in release build — Medium
- [ ] APK/AAB size within Play Store limits — Low
- [ ] Tested on minimum supported Android API level (check `app.json` `minSdkVersion`) — High
- [ ] Privacy policy URL present in Play Store listing — Medium

---

## 13. The "Most Important Final Test" — 10-Step Flow

This test validates the complete happy path a new user will experience.

- [ ] **Step 1** — Fresh install, no stored data. Open app. Login screen appears cleanly.
- [ ] **Step 2** — Register a new account. Confirmation received, user logged in, home screen loads.
- [ ] **Step 3** — Grant `READ_MEDIA_AUDIO` permission when prompted. Local songs populate the library.
- [ ] **Step 4** — Browse to remote songs/albums list. Data loads within 3 seconds.
- [ ] **Step 5** — Tap a remote song. Proxy stream starts, audio plays, Now Playing bar appears.
- [ ] **Step 6** — Lock the screen. Audio continues. Lock screen shows song title and artist.
- [ ] **Step 7** — Tap Next from the notification. Next song in queue loads and plays.
- [ ] **Step 8** — Pull down notification panel. Media controls visible and functional.
- [ ] **Step 9** — Switch to a local song. Playback transitions from remote stream to device file without crash.
- [ ] **Step 10** — Kill and reopen the app. User is still logged in (stored JWT valid). Player state reset cleanly.

---

## 14. Regression Testing After Each Fix

- [ ] After any auth change — Re-run full Authentication section
- [ ] After any player change — Re-run Playback + ExoPlayer sections
- [ ] After any API change — Re-run API + normalize unit tests (`npm test`)
- [ ] Before every release build — Run "Most Important Final Test" (13 steps above) in full

---

## 15. Expo Go vs Dev Build Limitations

| Feature | Expo Go | Dev Build (`expo run:android`) |
|---|---|---|
| Lock screen metadata | Not available | Full support |
| `expo-media-library` Android 13+ | Limited access | Full access |
| Background foreground service | Limited | Full support |
| Custom native modules | Not supported | Supported |

> Recommendation: All audio, notification, and media library tests should be run on a dev build, not Expo Go.

---

## 16. Known Limitations (Quick Reference)

See `KNOWN_LIMITATIONS.md` for full details.

- Lock screen metadata requires `npx expo run:android`
- Xiaomi/Oppo/Vivo battery optimisation kills background playback
- `expo-media-library` limited in Expo Go on Android 13+
- Rate limiting currently disabled

---

## 17. Sign-Off Criteria

All **High** risk items must be passing before beta release.  
All **Medium** risk items must be passing or have a documented workaround.  
**Low** risk items may be deferred to post-beta with a logged issue.
