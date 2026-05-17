# Anchor v2 — Firebase + Claude AI

Rebuilt from the ChatGPT / Supabase prototype. This version uses:

| What | Original | Now |
|---|---|---|
| AI chat | OpenAI / simulated | **Claude (claude-sonnet-4)** via secure backend proxy |
| Database | Supabase Postgres | **Firebase Firestore** |
| Auth | Supabase Auth | **Firebase Auth** |
| File storage | Supabase Storage | **Firebase Storage** |
| Access control | Supabase RLS (SQL) | **Firestore + Storage security rules** |

---

## Project structure

```
anchor/
├── App.js                  ← Full React Native app (Expo)
├── server.js               ← Express backend — Claude AI proxy
├── firestore.rules         ← Firestore security rules (deploy to Firebase)
├── storage.rules           ← Storage security rules (deploy to Firebase)
├── package.json
└── .env                    ← You create this (never commit)
```

---

## 1. Firebase setup

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → New project → call it `anchor`.
2. Enable **Authentication** → Email/Password provider.
3. Enable **Firestore** → Start in **production mode**.
4. Enable **Storage** → Start in **production mode**.
5. Go to Project Settings → Your apps → Add a **Web app** (Expo uses the web SDK).
6. Copy the config values into your `.env`.

---

## 2. Environment variables

Create a `.env` file at the project root (never commit this):

```env
# Firebase (mobile app)
EXPO_PUBLIC_FIREBASE_API_KEY=AIza...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
EXPO_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123

# Backend URL (where server.js is running)
EXPO_PUBLIC_API_BASE_URL=http://localhost:3001

# Backend only — never put this in the Expo app
ANTHROPIC_API_KEY=sk-ant-...
PORT=3001
ALLOWED_ORIGIN=*
```

---

## 3. Deploy security rules

```bash
npm install -g firebase-tools
firebase login
firebase init  # choose Firestore + Storage, point at your project

# Then:
firebase deploy --only firestore:rules
firebase deploy --only storage
```

---

## 4. Run the backend

```bash
# Install backend deps (once)
npm install express cors @anthropic-ai/sdk

# Start
node server.js
# → Anchor API listening on port 3001
```

For production, deploy `server.js` to Railway, Render, or a Firebase Cloud Function.

---

## 5. Run the Expo app

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go.

---

## Firestore collections

| Collection | Fields | Notes |
|---|---|---|
| `profiles` | `email`, `preferred_tone`, `created_at` | Doc ID = Firebase Auth UID |
| `checkins` | `user_id`, `mood`, `stress`, `urge`, `drank_today`, `created_at` | |
| `future_self_messages` | `user_id`, `message`, `message_type`, `media_url`, `created_at` | `media_url` populated when Storage upload added |
| `support_sessions` | `user_id`, `mode`, `urge_start`, `urge_end`, `created_at` | |
| `support_messages` | `session_id`, `role`, `content`, `created_at` | Children of sessions |

---

## What changed from the original prototype

### App.js
- **Auth layer added** — Firebase Auth with email/password; sign up creates a Firestore profile doc automatically.
- **All data is now persistent** — check-ins, future-self messages, and support sessions are saved to Firestore and fetched on login. No more in-memory-only state.
- **Real Claude AI chat** — `SupportScreen` calls your backend proxy instead of returning a hardcoded string. Full conversation history is sent on every turn.
- **Session saving** — at the end of a support session, urge-end is recorded and the full message log is written to `support_sessions` + `support_messages`.
- **Breathing animation** — replaced the static circle with a looping `Animated.timing` scale pulse (inhale 4s / exhale 4s).
- **Mode-aware AI** — the selected mode (Calm / Distract / Motivate) is passed to the backend and appended to the system prompt so Claude adapts its tone automatically.
- **Sign out** — added to Home screen footer.

### server.js (new)
- Express + CORS proxy that receives `{ messages, mode }`, builds the system prompt with the original `ai-system-prompt.txt` behavior intact plus a mode suffix, and calls `claude-sonnet-4` with `max_tokens: 300`.
- The Anthropic API key never leaves the server.

### Security rules
- `firestore.rules` replicates the row-level security from `supabase-schema.sql`. Every collection is scoped by `request.auth.uid == resource.data.user_id`.
- `storage.rules` locks future-self media to `future_self/{uid}/` paths.

---

## Next steps (from original codex-next-prompts.md, updated)

1. **React Navigation** — replace `setScreen` state machine with `@react-navigation/native-stack`.
2. **Breathing timer** — add a countdown alongside the breathing animation.
3. **Emergency resources screen** — configurable crisis numbers + trusted contacts stored in Firestore.
4. **Teen/adult onboarding** — write `age_group` and `primary_goal` to the `profiles` doc and conditionally adjust copy.
5. **Voice notes** — use `expo-av` to record audio, upload to Firebase Storage under `future_self/{uid}/`, save `media_url` to the message doc.
6. **Push notifications** — Firebase Cloud Messaging + Expo Notifications for daily check-in reminders.
7. **Backend hardening** — add Firebase ID token verification to `server.js` so only authenticated Anchor users can hit the Claude proxy.

---

## Important

This is wellness support software, not medical treatment, crisis care, or addiction therapy. For production, add professional review, crisis resources, moderation, privacy controls, and age-appropriate safeguards.
