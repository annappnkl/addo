# Handoff to Builder — ADDo Session 1

This document is your first assignment. After completing the tasks below, delete this file in your final commit and replace it with a short `SCAFFOLD_NOTES.md` that explains what you set up and where. Future sessions won't need this file.

## Before you do anything

1. Read [CLAUDE.md](CLAUDE.md) — the project rules, especially the non-negotiables.
2. Read [BUILD_ROADMAP.md](BUILD_ROADMAP.md) — the full product spec, all locked features, stack decisions, privacy requirements.
3. Confirm you understand both by stating in one line what ADDo is and naming the three non-negotiable product rules before starting any work.

## Your task for this session: Session 1 foundation

Build a running, committable foundation. **You are NOT building the entire app.** You are building the bones so that Sessions 2+ can add one feature at a time onto a clean base.

### In scope for Session 1

1. **Expo TypeScript app scaffold**
   - Initialize an Expo app with TypeScript strict mode in this repo (the repo root is where CLAUDE.md and BUILD_ROADMAP.md live — `npx create-expo-app` into a subfolder if needed, or configure it to work from root).
   - React Native Web configured so the same codebase runs on iOS and in a browser.
   - Folder layout should separate: `src/ui` (React components), `src/logic` (pure TS business logic), `src/db` (SQLite + Supabase clients), `src/types` (shared types).
   - Run scripts: `npm run dev` (starts Expo), `npm run typecheck`, `npm run lint`, `npm run web`.
   - Commit: `chore: expo typescript scaffold with rn web`.

2. **Supabase schema as SQL migrations**
   - Write SQL files for all tables listed in Feature 5 of BUILD_ROADMAP.md: `todos`, `areas`, `side_quests`, `sessions`, `session_rolls`, `calendar_links`, `settings`, plus a `user_profile` table for `accepted_tos_version` / `accepted_privacy_version`.
   - **Every table must have Row-Level Security enabled with `user_id = auth.uid()` policies in the same migration file.** This is the single most important rule — don't skip it.
   - Files go in `supabase/migrations/` with timestamped filenames.
   - Reference the foreign keys: todos → areas (nullable), sessions → areas, session_rolls → sessions + (todos or side_quests).
   - Commit: `feat(db): initial schema with rls on all tables`.

3. **Local SQLite mirror**
   - Configure `expo-sqlite`, define the same tables locally as TypeScript schema + migrations.
   - Write a thin data-access layer in `src/db/` that reads/writes SQLite and queues remote sync separately.
   - Do NOT build the full sync engine yet — just the local layer + a stubbed `queueForSync()` function. Real sync is a later session.
   - Commit: `feat(db): local sqlite mirror and dao layer`.

4. **Supabase client wiring**
   - `src/db/supabase.ts` exports a typed Supabase client reading from `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
   - Commit `.env.example` with placeholder values. `.env.local` stays git-ignored.
   - Commit: `chore(db): supabase client config with env placeholders`.

5. **Auth flow (Sign in with Apple + email/password fallback)**
   - Screens: `SignInScreen`, `SignUpScreen` (email flow only — Apple is a single button).
   - Use Supabase Auth. Sign in with Apple via `expo-apple-authentication` on iOS, falls back to email/password everywhere else.
   - On successful sign-in, route to the consent screen (next item).
   - Commit: `feat(auth): sign in with apple + email fallback`.

6. **First-launch consent screen**
   - Screen `ConsentScreen` that appears after sign-in, before the main app, IF the user's `accepted_tos_version` or `accepted_privacy_version` doesn't match the current constants in `src/constants/legal.ts`.
   - Shows short plain-language summary, with links to the full ToS and Privacy Policy (routed to in-app WebView of the hosted URLs — placeholder URLs for now).
   - Explicit tap buttons (NOT pre-checked): `[I've read and accept the Terms]` `[I acknowledge the Privacy Policy]`. Both must be tapped to proceed.
   - On tap, write the version numbers to `user_profile` and route to the main app.
   - Commit: `feat(legal): first-launch consent screen with versioned acceptance`.

7. **Draft legal docs (plain markdown, not final legalese)**
   - `legal/privacy-policy.md` — plain-language first draft. What we collect (email, todos, sessions, optional calendar events), why, retention, user rights, contact. Honest, short, GDPR-compliant in spirit.
   - `legal/terms-of-service.md` — plain-language first draft. Account rules, acceptable use, "as is," governing law = Germany, contact.
   - `legal/eula.md` — just a stub noting we use Apple's default EULA unless Anna wants custom.
   - These are drafts for Anna to review and later get a lawyer to bless. Do not pretend they're finished.
   - Commit: `docs(legal): first-draft privacy policy and tos`.

8. **Task Pool screen — Feature 1, following the locked spec**
   - `TaskPoolScreen` with three bucket columns (Must / Want / Later).
   - Add todo (title, estimated_minutes, bucket selector), edit todo (tap to open modal), delete todo, move between buckets.
   - Running time total per bucket in a small label.
   - Writes through the SQLite DAO layer (which queues for remote sync via the stub).
   - Show empty state for each bucket ("Nothing here yet — add your first task").
   - No Area selector yet — field exists in the schema as nullable, populated when Feature 7 ships.
   - Commit: `feat(f1): task pool screen with bucket crud`.

9. **Run typecheck + lint + smoke test**
   - Fix any errors. Don't commit with failing typecheck.
   - Confirm `npm run web` actually opens the app in a browser and you can add a task.
   - Confirm `npm run dev` boots the Expo dev server without errors.
   - Commit: `chore: pass typecheck and lint`.

10. **Session wrap-up commit**
    - Delete [HANDOFF_TO_BUILDER.md](HANDOFF_TO_BUILDER.md) (this file).
    - Create `SCAFFOLD_NOTES.md` with: folder structure, how to run the app, what's stubbed, what the next session should pick up. Keep it under 200 lines.
    - Final commit: `docs: scaffold notes for future sessions`.

### Out of scope for Session 1

Do NOT build any of these — they're for later sessions:

- Session Setup screen (Feature 2) — needs calendar integration scaffolding first
- Side Quest Pool (Feature 2b)
- Roulette Work Mode (Feature 3) — the juicy bit, deserves its own session
- Session Summary (Feature 4)
- Real sync engine — stub it, don't build it
- Areas UI (Feature 7)
- Calendar linking (Feature 8)
- Integrations (Feature 9)
- Analytics (Feature 10)

If you finish Session 1 work with time to spare, STOP and report back rather than starting new features. Lead will decide what comes next.

## How to report back at the end

When all commits are in, respond with:

1. One-paragraph summary of what shipped
2. The exact commit hashes in order
3. Any decisions you had to make that weren't specified in BUILD_ROADMAP.md — Lead needs to know what you chose so these can be confirmed or reverted
4. Any parts of the spec that were unclear or ambiguous — Lead will update the doc
5. What needs doing manually by Anna before the app can run locally (Supabase project creation, env vars, etc.)

Do not push to GitHub. Commit locally; Anna pushes when she's ready.

## Tech reference notes

- Expo docs: https://docs.expo.dev
- Supabase docs: https://supabase.com/docs
- Sign in with Apple on Expo: https://docs.expo.dev/versions/latest/sdk/apple-authentication/
- expo-sqlite: https://docs.expo.dev/versions/latest/sdk/sqlite/
- React Native Web: https://necolas.github.io/react-native-web/

Good luck. Follow the spec. When in doubt, kick it back to Lead.
