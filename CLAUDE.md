# CLAUDE.md — project rules for any Claude working in this repo

This file is auto-loaded by Claude Code. Any Claude instance opening this repo must read and follow these rules. If in doubt, read [BUILD_ROADMAP.md](BUILD_ROADMAP.md) — that is the single source of truth for what ADDo is and what we're building.

## What is ADDo

Gamified task manager for ADHD-friendly flexible workers. "Attention Deficit Disordered Doing." Evolution of an earlier Python/Streamlit prototype called Todo Roulette. Full product spec and all locked feature specs are in [BUILD_ROADMAP.md](BUILD_ROADMAP.md) — read it before doing anything in this repo.

## The user
Anna Papanakli, Munich-based, building this solo. Role: designer/product + lead. Gives clear, opinionated feedback. Prefers honest pushback over compliance. Wants privacy-respecting, non-guilty, non-gamified-score ADHD-friendly UX. She uses this repo personally as her dogfooding ground.

## The workflow (three-chat setup)
1. **Lead chat (planning/review)** — separate conversation. Makes architecture and design decisions, updates BUILD_ROADMAP.md, reviews Builder's commits. Do NOT edit BUILD_ROADMAP.md from Builder without Lead's sign-off.
2. **Builder chat (implementation)** — executes one feature at a time against the locked spec in BUILD_ROADMAP.md. Commits after each feature. Reports completion. This is probably you if you're reading this fresh.
3. **Scratchpad chat** — ad-hoc debugging, no persistent role.

## Non-negotiable rules

### Product / UX
- **No streaks, no XP, no leveling, no score.** The roulette is the game. The summary is a receipt. ADDo is not Duolingo.
- **No guilt messaging anywhere.** Ever. Escape hatches are endorsed, not shamed. Skipped tasks are silent, not penalized.
- **No due dates on todos.** Due dates belong on calendar events. Todos float inside goal-tagged calendar time.
- **Calendar is the plan, ADDo is the log.** No calendar writeback in v2.0. Deviations show as planned-vs-actual gaps, not corrections.
- **Trust the user.** No rate limits on escape hatches, no nagging, no "you've been working too long" popups beyond the opt-in break interval.

### Privacy / safety (hard requirements, not best-effort)
- **Row-Level Security enabled on every Supabase table, strict `user_id = auth.uid()` policies.** Non-negotiable. If you're creating a new table and don't write the RLS policy in the same migration, you're doing it wrong.
- **No third-party trackers, no analytics-as-a-service piping user content out.** If we add product analytics later, it must be self-hostable or stay inside Supabase.
- **No secrets in the app bundle.** All API keys live in environment variables, loaded from `.env.local` (git-ignored). `.env.example` committed with placeholders.
- **Data minimization.** Collect only what a feature needs. Never "just in case" fields.
- **EU data region for Supabase.** Anna is in Germany; early users are likely EU.

### Code / technical
- **Stack is locked:** Expo (React Native + React Native Web) with TypeScript, Supabase backend, Expo SQLite local mirror, RevenueCat wrapper for subs (deferred), Vercel for web, EAS Build for iOS.
- **TypeScript strict mode.** No `any` unless you've already tried for 10 minutes and commented why.
- **One feature per commit — no bundling.** If the handoff doc specifies 10 commits, make 10 commits. Clean granular history is how Lead reviews your work and how we roll back safely.
- **Conventional Commit messages** (`feat:`, `fix:`, `chore:`, `docs:`, etc.) with the feature number when applicable, e.g. `feat(f1): task pool CRUD with sqlite mirror`.
- **No features, no refactors, no abstractions beyond what the locked spec requires.** Don't design for hypothetical future needs. Three similar lines is better than a premature abstraction.
- **Don't add error handling for impossible cases.** Validate at system boundaries (user input, external APIs), trust internal code.
- **No comments explaining WHAT the code does.** Names do that. Only comment WHY when it's non-obvious.
- **Offline-first.** Every read hits local SQLite first. Remote writes queue and flush when online. No feature should require network to function.
- **Pure TypeScript business logic.** UI is a thin React layer over testable pure functions. No logic locked inside components.

### Process
- **Lock specs live in [BUILD_ROADMAP.md](BUILD_ROADMAP.md).** Follow them exactly. If you think a spec is wrong, STOP and kick it back to Lead. Do not silently reinterpret.
- **Run `npm run typecheck` and `npm run lint` before declaring a feature done.** If they fail, fix the root cause — don't paper over with `// @ts-ignore`.
- **Ask Anna (not Lead) for external account actions:** Supabase project creation, Apple Developer sign-up, etc. You cannot do these, only she can.
- **Never force-push, never amend committed work, never skip hooks with `--no-verify`.** Destructive git is off-limits without explicit permission.

## Locked technical decisions (Session 1)
- **expo-router** (file-based routing, Expo SDK 54 standard) — not React Navigation
- **expo-crypto** for UUID generation — not the `uuid` npm package
- **@react-native-async-storage/async-storage** for Supabase Auth session storage on mobile
- **Bundle ID: `app.addo`** — permanent once registered with Apple, do not change
- **Consent guard lives in `(app)/_layout.tsx`** — runs on every app open to catch future TOS version bumps
- **Hand-written Database types in `src/db/supabase.ts`** — regenerate with `npx supabase gen types typescript` once the Supabase project exists

## Folder layout (canonical)
```
addo/
├── app/                   # expo-router screens (file-based routing)
│   ├── _layout.tsx        # root layout — DB init, StatusBar
│   ├── index.tsx          # auth redirect (→ sign-in or →tasks)
│   ├── (auth)/            # unauthenticated screens
│   │   ├── sign-in.tsx
│   │   ├── sign-up.tsx
│   │   └── consent.tsx    # first-launch legal consent
│   └── (app)/             # authenticated screens (consent-gated)
│       ├── _layout.tsx    # checks consent on entry
│       └── tasks.tsx      # Task Pool — Feature 1
├── src/
│   ├── types/index.ts     # shared TypeScript types
│   ├── constants/legal.ts # TOS/Privacy version numbers + hosted URLs
│   ├── logic/             # pure TS business logic (no React)
│   │   └── todos.ts       # bucket helpers, formatMinutes
│   └── db/
│       ├── sqlite.ts      # expo-sqlite: getDb(), initDb()
│       ├── dao.ts         # local read/write + sync queue stub
│       └── supabase.ts    # typed Supabase client
├── supabase/migrations/   # SQL migrations (run manually in Supabase dashboard)
├── legal/                 # draft legal docs (review before App Store)
├── assets/                # icons, splash
├── .env.example           # env var template (copy to .env.local)
└── SCAFFOLD_NOTES.md      # how to run, what's stubbed, next steps
```

## File Anna should never lose
- [BUILD_ROADMAP.md](BUILD_ROADMAP.md) — the product contract
- This file (CLAUDE.md) — the project rules
