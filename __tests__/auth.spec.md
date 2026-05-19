# Muves Auth & Security — Manual Test Checklist

> Jest is not configured in this project (no `jest` / `ts-jest` in `package.json`).
> This checklist documents every scenario with expected pass/fail behaviour.
> Wire it into Jest later by installing `jest`, `ts-jest`, `@testing-library/react-hooks`,
> and `@testing-library/react-native`, then migrating each section to `.test.ts` files.

---

## 1. AuthContext — Token Storage

| # | Scenario | Expected | Pass/Fail |
|---|----------|----------|-----------|
| 1.1 | After successful login, `AsyncStorage` contains `muves_token` and `muves_user` keys | Both keys present with non-empty values | [ ] |
| 1.2 | App cold-start with stored token — `user` is non-null before network check completes | Cached session restored synchronously from AsyncStorage | [ ] |
| 1.3 | App cold-start with NO stored token — `loading` becomes `false`, `user` remains `null` | Login screen shown | [ ] |
| 1.4 | After `logout()`, both `muves_token` and `muves_user` are removed from AsyncStorage | Keys absent from storage | [ ] |
| 1.5 | Concurrent 401 responses only trigger logout once (`loggingOutRef` guard) | `logout()` body executes exactly once | [ ] |

---

## 2. 401 → Logout Flow (end-to-end)

| # | Scenario | Expected | Pass/Fail |
|---|----------|----------|-----------|
| 2.1 | Any `apiRequest` call (except `skipAuthErrorHook`) receives a 401 → `onAuthErrorHandler` fires | `logout()` called, user state cleared | [ ] |
| 2.2 | Any `apiRequest` call receives a 403 → same as 2.1 | `logout()` called | [ ] |
| 2.3 | After auto-logout from 401, app navigates to `/login` | AuthGate redirects to login screen | [ ] |
| 2.4 | `checkAuth` on startup gets 401 from `/auth/check-auth` → clears storage and sets user=null | No infinite loop; login screen shown | [ ] |
| 2.5 | `checkAuth` on startup gets a network error → keeps cached session (user NOT logged out) | App usable offline with cached credentials | [ ] |

---

## 3. Session Persistence — App Reopen

| # | Scenario | Expected | Pass/Fail |
|---|----------|----------|-----------|
| 3.1 | Kill and relaunch app after login → user sees main tabs without re-login | Token + user restored from AsyncStorage | [ ] |
| 3.2 | Kill app, go offline, relaunch → user still logged in (no server check required) | Cached session used; server check times out gracefully | [ ] |
| 3.3 | Token expires server-side between sessions → on next launch, checkAuth gets 401 → login shown | Storage cleared, login screen displayed | [ ] |

---

## 4. Login Form — UI / UX

| # | Scenario | Expected | Pass/Fail |
|---|----------|----------|-----------|
| 4.1 | Password TextInput has `secureTextEntry={true}` by default | Password masked on render | [ ] |
| 4.2 | Tapping eye icon toggles `secureTextEntry` to false / true | Password revealed / hidden | [ ] |
| 4.3 | Submit with empty email → Alert "Missing fields" | Alert shown, no network request | [ ] |
| 4.4 | Submit with malformed email → Alert "Invalid email" | Alert shown | [ ] |
| 4.5 | Submit with password < 6 chars → Alert "Password too short" | Alert shown | [ ] |
| 4.6 | Sign-in button disabled and shows ActivityIndicator while `loading=true` | Button not pressable mid-request | [ ] |
| 4.7 | Signup password field has `secureTextEntry={true}` by default | Password masked | [ ] |
| 4.8 | Forgot-password new-password and confirm fields have `secureTextEntry={true}` by default | Both fields masked | [ ] |

---

## 5. Network Error During Login

| # | Scenario | Expected | Pass/Fail |
|---|----------|----------|-----------|
| 5.1 | Airplane mode ON during login attempt → `apiRequest` throws `ApiError` with `isNetwork=true` | `Alert.alert("Login failed", <message>)` shown; loading spinner cleared | [ ] |
| 5.2 | Server unresponsive for > 60 s → `LOGIN_TIMEOUT_MS` AbortController fires | `ApiError` with `isTimeout=true`; UI shows error, not infinite spinner | [ ] |
| 5.3 | Network lost mid-form (not yet submitted) → user taps Sign in → error shown | Same as 5.1 | [ ] |

---

## 6. Expired Token During Playback

| # | Scenario | Expected | Pass/Fail |
|---|----------|----------|-----------|
| 6.1 | Token expires while stream request is in-flight → server returns 401 | Global auth handler fires → logout → login screen; no crash | [ ] |
| 6.2 | Stream URL called with expired token → PlayerContext catches error | Playback stops cleanly; no unhandled promise rejection | [ ] |
| 6.3 | Cover/lyrics endpoint 401 during playback → non-fatal, rest of UI still functional | Error swallowed or shown as toast; app does not crash | [ ] |

---

## 7. Security — Secrets & HTTPS

| # | Scenario | Expected | Pass/Fail |
|---|----------|----------|-----------|
| 7.1 | No `console.log` of token, password, or raw user object in any `.ts`/`.tsx` | Grep for `console.log.*token\|password\|user` returns 0 matches | [x] PASS |
| 7.2 | No hardcoded secret/API keys in source files | Grep returns 0 matches | [x] PASS |
| 7.3 | `.env.local` is NOT committed to git (in `.gitignore`) | `git status` does not show `.env.local` as tracked | [ ] Verify |
| 7.4 | Production build does NOT set `EXPO_PUBLIC_API_URL` → `constants/api.ts` uses `PROD_BASE` (HTTPS) | `BASE_URL` starts with `https://` in prod bundle | [ ] |
| 7.5 | `app.json` iOS `NSAllowsArbitraryLoads: false` ensures ATS enforces HTTPS on iOS | Present — confirmed | [x] PASS |

---

## 8. Permissions — Android

| # | Scenario | Expected | Pass/Fail |
|---|----------|----------|-----------|
| 8.1 | `app.json` lists `READ_MEDIA_AUDIO` (Android 13+) | Present — confirmed | [x] PASS |
| 8.2 | `app.json` lists `READ_EXTERNAL_STORAGE` (Android ≤12) | Present — confirmed | [x] PASS |
| 8.3 | `app.json` lists `POST_NOTIFICATIONS` (Android 13+) | Present — added by audit | [x] FIXED |
| 8.4 | `_layout.tsx` requests `POST_NOTIFICATIONS` at runtime on Android 13+ | `useNotificationPermission` hook present — added by audit | [x] FIXED |
| 8.5 | User denies media permission → "On Device" tab shows graceful UI, not crash | `permissionStatus` exposed; UI should gate behind it | [ ] |
| 8.6 | User denies media permission → `requestPermission()` returns false → no exception | Confirmed in `LocalSongsContext` | [x] PASS |

---

## 9. Offline Mode

| # | Scenario | Expected | Pass/Fail |
|---|----------|----------|-----------|
| 9.1 | App opened with no internet, no stored session → routes to `/offline` | AuthGate first branch fires | [x] PASS (logic verified) |
| 9.2 | User taps "Play Local Songs" on offline screen → `isOfflineMode=true`, navigates to `/(tabs)` | `setOfflineMode(true)` → `router.replace("/(tabs)")` | [x] PASS |
| 9.3 | `isOfflineMode=true`, `user=null`, current route is `/(tabs)` → AuthGate does NOT redirect to login | Fixed by audit (was a bug — `!isOfflineMode` not checked) | [x] FIXED |
| 9.4 | Connection restored while in offline mode → `isOfflineMode` auto-cleared to false | `NetworkContext` resets `isOfflineMode` on `online=true` event | [x] PASS |
| 9.5 | Offline retry button: taps "Retry Connection" → waits 1.5 s → routes to `/login` if online | `handleRetry` in `offline.tsx` | [x] PASS |

---

## How to Migrate to Jest

When Jest is added to the project:

```
npm install --save-dev jest ts-jest @types/jest @testing-library/react-native \
  @testing-library/react-hooks react-test-renderer
```

Add to `package.json`:
```json
"jest": {
  "preset": "ts-jest",
  "testEnvironment": "node",
  "moduleNameMapper": { "^@/(.*)$": "<rootDir>/$1" },
  "setupFiles": ["./jest.setup.ts"]
}
```

Create `jest.setup.ts` with AsyncStorage and NetInfo mocks, then convert each section
above into `describe/it` blocks in `__tests__/auth.test.ts`.
