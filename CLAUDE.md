\# Anchor



React Native / Expo wellness app. Firebase Auth + Firestore + Storage. Claude AI chat via Express backend (server.js).



\## Stack

\- Expo \~53, React Native 0.79, React 19

\- Firebase ^10 (Auth, Firestore, Storage)

\- Express backend proxying Anthropic claude-sonnet-4

\- No React Navigation yet — screen state managed via useState in App.js



\## Env vars

See README.md. Never hardcode keys. All Firebase vars are EXPO\_PUBLIC\_\*. ANTHROPIC\_API\_KEY is backend-only.



\## Key conventions

\- Firebase UID is the user identifier everywhere (user\_id field on all docs)

\- serverTimestamp() on all created\_at fields

\- Backend at EXPO\_PUBLIC\_API\_BASE\_URL/api/anchor-chat



\## Current priority tasks

1\. ~~Add React Navigation (native-stack) — replace setScreen useState~~ ✓ Done

2\. ~~Add countdown timer to SupportScreen (10 minutes)~~ ✓ Done

3\. ~~Add emergency resources screen with crisis numbers~~ ✓ Done

