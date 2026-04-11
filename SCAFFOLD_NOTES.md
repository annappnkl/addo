# Scaffold Notes — ADDo Session 1

Session 1 laid the foundation. Session 2+ can add one feature at a time on top of this.

---

## How to run

```bash
# 1. Copy env file and fill in your Supabase project credentials
cp .env.example .env.local
# edit .env.local

# 2. Install dependencies (already done, but just in case)
npm install

# 3. Start in web mode (no Apple auth, email only)
npm run web

# 4. Start in Expo Go / dev client mode
npm run dev

# Type check + lint
npm run typecheck
npm run lint
```

---

## Folder structure

```
app/                     # expo-router screens
  _layout.tsx            # root layout — initialises SQLite DB
  index.tsx              # auth redirect (no-flash: spins until auth checked)
  (auth)/
    sign-in.tsx          # email/password + Sign in with Apple (iOS only)
    sign-up.tsx          # same, sign-up variant
    consent.tsx          # first-launch ToS + Privacy consent
  (app)/
    _layout.tsx          # consent guard — redirects to consent if not accepted
    tasks.tsx            # Task Pool — Feature 1 (Must/Want/Later buckets)

src/
  types/index.ts         # shared TS types (Todo, Area, Session, etc.)
  constants/legal.ts     # CURRENT_TOS_VERSION, CURRENT_PRIVACY_VERSION, URLs
  logic/
    todos.ts             # bucketTotalMinutes(), formatMinutes() — pure functions
  db/
    sqlite.ts            # expo-sqlite: getDb(), initDb() — creates all tables locally
    dao.ts               # CRUD for todos: getTodosByUser, insertTodo, updateTodo, deleteTodo
    supabase.ts          # typed Supabase client, reads EXPO_PUBLIC_* env vars

supabase/migrations/
  20260411000000_initial_schema.sql  # all tables + RLS policies

legal/
  privacy-policy.md      # draft — needs lawyer review
  terms-of-service.md    # draft — needs lawyer review
  eula.md                # stub — uses Apple's default EULA for v1
```

---

## What's stubbed / deferred

| Item | Status | Notes |
|------|--------|-------|
| Sync engine | Stub only | `queueForSync()` writes to `sync_queue` table, but nothing reads from it. Build in a later session. |
| Apple Sign In | Code complete | Only works on iOS physical device / simulator. Web always uses email. Needs `bundleIdentifier` registered with Apple. |
| Supabase project | Not created | Anna needs to create the project, run the migration SQL, and put credentials in `.env.local`. |
| Legal docs hosted URL | Placeholder | `TOS_URL` and `PRIVACY_URL` in `src/constants/legal.ts` point to `addo.app/legal/*` — need a real Vercel deployment. |
| Areas UI | Not built | `area_id` field exists in todos schema and type, shows as `null` until Feature 7 ships. |
| Supabase type generation | Manual | `src/db/supabase.ts` has hand-written types matching the migration. Once the Supabase project exists, regenerate with `npx supabase gen types typescript` and replace. |

---

## Before the app can run

Anna needs to do these manually:

1. **Create a Supabase project** at supabase.com — pick EU region (Frankfurt).
2. **Run the migration**: paste `supabase/migrations/20260411000000_initial_schema.sql` into the Supabase SQL editor and run it.
3. **Enable Sign in with Apple** in Supabase Auth settings → Providers.
4. **Copy `.env.example` to `.env.local`** and fill in `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` from the Supabase project settings.
5. **(For iOS)** Register the `bundleIdentifier` (`com.papanakli.addo`) in Apple Developer portal and set up Sign in with Apple capability.

---

## Process note for Lead

Session 1 deviated slightly from the handoff commit plan: auth screens (Task 5), consent screen (Task 6), and the Task Pool screen (Task 8) were committed together with the scaffold in commit 1 (`chore: expo typescript scaffold with rn web`) rather than as separate commits. The code is all present and passing typecheck+lint — the history is just bundled differently than specified. Lead should decide if a rebase is worth doing.

---

## Next session picks up at

**Feature 2 — Session Setup.** Before that session can start, the Supabase project needs to exist and the env vars need to be filled in, so the app can connect to a real backend.
