# ADDo — Build Roadmap

**ADDo = Attention Deficit Disordered "Doing"** — gamified task manager for ADHD-friendly flexible workers. Evolution of Todo Roulette v1.

## Stack (locked)
- **App:** Expo (React Native + React Native Web) — one TS codebase for iOS + Web
- **Backend:** Supabase — Postgres, Auth (Sign in with Apple), Row-Level Security, Realtime
- **Web hosting:** Vercel (free tier)
- **Mobile builds:** EAS Build (Expo free tier)
- **Subscriptions (deferred):** RevenueCat wrapping Apple StoreKit + Stripe — wired in *after* dogfooding decides paywall shape

## Build philosophy
- **No tiers during initial build.** Everything free while Anna dogfoods for weeks. Paywall decisions come from real usage, not upfront guessing.
- **Schema carries tier-aware fields anyway** (e.g. nullable `goal_id`) so future gating is a flag flip, not a migration.
- **Account required from day 1.** Sign in with Apple. Cloud sync is free and assumed (2026 table stakes).

## Core mental model — "the calendar is the schedule"
The key insight that reshaped the whole app:

- Users block time in their calendar per Area ("CompanyX work 9–1", "Health", "Uni")
- At the start of a calendar block, ADDo opens the roulette on todos tagged to that Area
- Todos don't have due dates — **due dates belong on calendar events, not todos**
- Todos float inside goal-tagged time blocks
- External events on a linked calendar auto-count toward that Area's time budget (the yoga class on the Health calendar pays into weekly Health hours even though it isn't a todo)

## Taxonomy
- **Todo** — a task. Has: title, estimated_minutes, bucket, optional area_id, optional subgoal_id, optional notes, optional completed_at.
- **Bucket** — Must / Want / Later. Anna's simplification of Eisenhower.
  - **Must** = something owes you doing it (external deadline, client, assignment)
  - **Want** = something you owe yourself (workout, piano, watch that tutorial)
  - **Later** = brain dump, not yet sorted. Excluded from roulette.
- **Area** — a life/work domain. Maps 1:1 to a calendar (e.g. the iCloud "Health" calendar IS the Health area). Examples: "Health", "EVORA", "Uni", "Personal". A todo can belong to an Area with no subgoal — the Area alone is enough.
- **Subgoal** — a specific goal, project, or habit within an Area. Identified by a `#hashtag` that is the universal routing key across ADDo, calendar events, Obsidian, and Reminders. Examples under Health: `#Hyrox`, `#Pilates`, `#Gym`, `#MealPrep`. A todo can belong to an Area + Subgoal, or just an Area, or neither.
- **The hashtag is the join key.** A calendar event titled "Morning run #Hyrox" on the Health calendar pays time into Health › Hyrox. A todo titled "Sign up for race #Hyrox" is tagged to Health › Hyrox. An Obsidian note with `#Hyrox` scrapes back as a Health › Hyrox todo. Same parser everywhere.
- **Area ↔ Calendar link** — an Area links to exactly one calendar (iCloud/Google). The calendar IS the Area. Subgoals live inside via hashtags in event titles.

## Calendar integration rules
- **Independence:** Areas and calendars are independent. An Area can live with no linked calendar; time is then logged only from manual roulette sessions.
- **Hashtags route to subgoals, not areas.** The calendar already tells us the Area (it's the calendar itself). The `#hashtag` in the event title tells us the subgoal within that Area. Same regex parser used by Notion/Reminders integration — free code reuse.
- **All-day events:** Skipped by default. Opt-in per calendar.
- **Overlapping events — "a minute counts once" rule:** Any given minute of the day counts toward at most one Area. Same-Area overlap → no problem, counts once. Different-Area overlap → shorter event wins the overlapping minutes (outer event still counts for its non-overlapping portion). Per-event manual override available. Handles both the 10am-standup-inside-9–11-work-block case AND the "two tentative options in the same slot" case Anna flagged from real calendar usage.
- **Tentative events (`??` in title, etc.):** counted normally. If the user moves or deletes them, the count updates. No separate tentative state — complexity for little gain.
- **Unicode-safe parsing.** Hashtag parser must handle non-ASCII (Anna's real calendars mix German + English: "Probeputzen Maria", "Steuerklärung NL", etc.).
- **No calendar writeback in v2.0.** Calendar is input, ADDo DB is output. Parked on roadmap: *auto-log completed roulette sessions as calendar events on the matching Area calendar* — would close the loop on "actual time invested" visibility inside the calendar itself. Revisit post-launch.

## Feature list (planning in progress, top-to-bottom)

Features 1–9 drafted previously but being re-planned under the calendar-driven model. Planning tracked in conversation; each feature gets locked before the next starts.

1. **Task Pool** — ✅ LOCKED. Todo fields: `title`, `estimated_minutes`, `bucket` (Must/Want/Later), `area_id` (nullable FK), `notes` (optional), `created_at`. Edit in place. Three-bucket UI. Running time total per bucket. Offline-first with Supabase sync. No recurring tasks in v2.0 (defer).
1b. **Task completion outside a session** — a checkmark icon appears alongside the trash and chevrons when hovering/selecting a task in the Task Pool. Tapping it marks the task as done without starting a session.
   - **Done state:** sets `completed_at` timestamp on the todo record (new nullable column via migration). Does NOT delete the row — the data is kept for analytics.
   - **Working UI:** completed todos are filtered out of the Task Pool view entirely. Out of sight, out of mind — never shown in the bucket columns or the session picker.
   - **Analytics:** completed todos feed into Feature 10 (Analytics / Session History) as a time-investment log — same "Screen Time" philosophy. Per-area, per-bucket, per-day breakdowns of what you actually finished, independent of whether you were in a formal session.
   - **Icon order in task row:** checkmark · chevron-left · chevron-right · trash (left to right). Checkmark in Accent colour to signal it's a positive action, not a delete.
   - **No undo prompt.** Completing a task is not destructive — the data is kept. If the user wants it back in the pool, that's a future edge case — ignore for now.
   - **Schema change:** `todos` needs a nullable `completed_at TIMESTAMPTZ` column. Migration required.

2. **Session Setup** — ✅ LOCKED.
   - **Mode A (auto):** If user is currently inside a calendar event mapped to an Area, ADDo opens to "You're in [Area] until [time]. Start roulette?" One tap. Session length = remaining block time (no 3h cap). Never auto-starts — always a tap.
   - **Mode B (manual):** User picks Area + duration + (optional override) break interval. Used when no calendar match, or user taps "Different Area."
   - **Pre-shuffle "This Session" picker:** After Mode A/B decides Area + duration, show all todos in that Area with a running-total progress bar vs block time. Auto-pre-select Musts first (greedy fill), then Wants if space. Later bucket shown at bottom as escape hatch, never auto-picked. User can toggle anything in/out, can over-fill (bar turns red, warning only). [Start Shuffle] begins roulette. Unselected todos stay in pool for next session.
   - **Two escape hatches from the picker:**
     - **"Just shuffle everything"** — one-tap skip on the picker screen, for when you don't care about fitting the block and just want roulette over all Area todos. Stop when you stop.
     - **"Trust auto-pack"** — Settings toggle that bypasses the picker entirely once the user is comfortable, going straight from Start → roulette with auto-selected tasks.
   - **Soft end with snooze:** When session time is up, show a reminder + "extend by 15/30/60 min" snooze options. If ignored or app closed, assume session over. If user taps Finish, show summary and return remaining todos to pool.
   - **Break interval:** global setting (default 50 min), per-session override available.
   - **Calendar is plan, ADDo is log.** No writeback. User deviations from the plan just show up as gap in planned-vs-actual summary — information, not correction.
2b. **Side Quest Pool** — ✅ LOCKED. Separate global pool of short feel-good / home / break items that get mixed into roulette alongside work todos. The feature that makes ADDo feel like a game, not a productivity grinder.
   - **Side Quest fields:** `title`, `duration_minutes`, optional `link` (URL — opens in in-app WebView; tap to watch a YouTube video, open a meditation track, etc.), optional `notes`.
   - **Global, not Area-specific.** One pool, shared across all sessions.
   - **Default ratio: 70/30 work/side-quest** (Pomodoro-ish, settable). ADHD users tend to want more breaks, not fewer. We'll dogfood and adjust.
   - **Session-size gating on duration:**
     - ≤ 30 min session → only Side Quests ≤ 5 min eligible (water, stretch, breathe)
     - 30 min – 2h → ≤ 10 min eligible
     - > 2h → all, up to 15 min (walks, laundry, longer videos)
     - Short sessions get more, shorter items; long sessions get room for a proper walk.
   - **Picker integration:** appears as its own section at the bottom of the This Session picker. Auto-filled with random eligible picks until the budget is reached. User can swap in/out.
   - **Shuffle mixing:** once session starts, work todos + selected Side Quests are combined into one pool, fully randomized. Next-roll order is unpredictable — that's the fun.
   - **Forced break safety net:** if 50 min elapse (or the user's configured break interval) without a Side Quest surfacing naturally, the next roll is forced to be a Side Quest. Prevents randomness from screwing the user out of a breather.
   - **Completion semantics differ from work todos:**
     - Work todo "done" → deleted from pool (completed)
     - Side Quest "done" → stays in pool forever (it's a prompt, not a task; water glass recurs)
     - Within a single session, a completed Side Quest won't reappear; resets next session.
   - **"Side Quest now" escape hatch:** always-visible button in Roulette Work Mode. Tap to immediately roll a random Side Quest out of turn, for when a work task is drowning you. No rate limit, no shame. Silent counter in the session summary surfaces patterns without moralizing — trust the user.
   - **Procrastination-as-relief is endorsed, never guilt-tripped.** UI copy stays encouraging ("Pick your fun detours"). Completed Side Quests count as wins in the session summary alongside work todos.
3. **Roulette Work Mode** — ✅ LOCKED. The core loop. One task at a time, three buttons: Done / Skip / Side Quest now.
   - **Screen:** Area + elapsed/remaining session progress bar at top. Single task shown huge in the middle with estimated duration and target finish time (`Finish by 14:53 🎯` — informational, not a countdown). Three action buttons. Footer with "next break in X" and "session ends at Y".
   - **Roll logic per tap:** pick next from pre-shuffled pool, then apply guardrails in order — (1) if break interval elapsed → force a Side Quest (or plain break if pool empty); (2) if behind on Side Quest ratio → boost Side Quest probability; (3) if running low on session time → prefer items shorter than remaining time, so we don't start a 45' task with 10' left.
   - **Done** → log `actual_minutes = now - roll_start`, remove work todo from pool (or mark Side Quest "seen this session" so it won't re-roll). Next roll.
   - **Skip** → task goes to back of shuffle, no penalty, no tracking. Next roll.
   - **Side Quest now** (escape hatch, always visible) → forces next roll to be a random Side Quest regardless of ratio. Increments a silent counter for the session summary. No rate limit, no guilt messaging.
   - **Long-overrun behavior:** silent. If estimated 30 min and you're at 90, nothing happens — log actual, move on when user taps Done. Accurate logging teaches real task durations over time; interrupting mid-flow is anti-ADHD.
   - **Visual shuffle animation** on each next-roll transition (<1s), with haptic feedback on mobile. Makes it feel like a game, not a task list.
   - **Target finish time** always shown. No countdown timer — we don't do pressure.
   - **Offline-first:** the session pool is cached locally, all logs queue up in SQLite, sync to Supabase on reconnect. Roulette works on a subway with zero internet.
   - **Haptics/sound:** deferred to post-MVP.
   - **v1 bugs explicitly fixed:**
     - `st.button("Done") or st.button("Skip")` chaining bug on break screen ([Code/main.py:218](todo-roulette/Code/main.py#L218)) — impossible in React Native's event model.
     - Delete decrementing `total_work_time` instead of task time ([Code/main.py:178](todo-roulette/Code/main.py#L178)) — new schema separates `session.planned_duration` from `task.estimated_minutes`, cross-contamination impossible.
     - Meal times dead feature — cut entirely.
     - Tight Streamlit/session_state coupling — gone. Pure TS logic, thin React UI layer, testable without a browser.
3b. **Inactivity check ("are you still there?")** — if a task has been showing on screen for more than 2× its estimated duration (minimum floor: 30 minutes), show a gentle full-screen overlay — not a popup, not a nag — with two buttons:
   - **"I was working"** → dismiss overlay, log actual elapsed time as-is when Done is eventually tapped.
   - **"I got distracted"** → dismiss overlay, cap logged time at the task's estimated duration (not actual). No extra prompt, no judgment, no explanation required.
   - **Trigger logic:** `elapsed >= max(estimatedMinutes * 2, 30) minutes`. Fires once per task — if dismissed with "I was working", does not re-fire for the same roll. Resets on every new roll.
   - **Known limitation:** cannot detect phone/browser sleep — if the screen was asleep for 3 hours the timer still ran. On iOS, AppState can be used post-MVP to pause the timer when app is backgrounded. For now, the inactivity check is the safety valve.
   - **Copy:** "Still there? 👋" headline, "You've been on this task for a while." subline. No guilt — just a check-in.
   - **This modifies Feature 3 behavior.** The existing spec says long-overrun is "silent" — this replaces that silence with one gentle prompt.

4. **Session Summary** — ✅ LOCKED. Shown at session end (soft end, manual Finish, or extension timeout). This-session only — not a dashboard.
   - **Header:** Area name, planned duration, actual duration.
   - **Three sections:** Done work todos (with per-task `actual' (est X')`), Side Quests completed, Skipped tasks returning to pool.
   - **CTAs:** [Start another session] and [Back to pool].
   - **Persistent:** every summary is saved in DB as a `session` record, viewable later in Feature 7's session history. Never ephemeral.
   - **Short sessions still get a summary.** 5-minute bailout shows honestly — non-judgmental but accurate.
   - **No aggregate judgment on the summary screen itself.** No estimate-accuracy line, no escape-hatch count, no streaks, no XP, no comparisons to previous sessions, no goal progress bars. The summary is a receipt of what just happened, not a performance review. All aggregated metrics live in Feature 7 analytics (opt-in visit, retrospective, screen-time-style).
   - **Design principle:** the roulette is the game; the summary is the receipt. Adding a score turns ADDo into Duolingo and that's a different app.
5. **Local + Cloud Persistence** — ✅ LOCKED. Two-layer storage: SQLite on-device (via Expo SQLite) + Supabase Postgres in the cloud. Local-first: every read hits SQLite, zero network calls on happy path, roulette works offline on a plane.
   - **Tables:** `todos`, `areas`, `side_quests`, `sessions`, `session_rolls`, `calendar_links`, `settings`.
   - **Sync:** bidirectional, event-based. Local writes queue up and flush to Supabase on reconnect. Remote changes (another device) stream back via Supabase Realtime.
   - **Conflict resolution:** last-write-wins per row via `updated_at` timestamps. Sufficient for single-user model.
   - **No offline nagging, no cap.** Offline for 3 weeks on a research trip? Still works. Syncs cleanly when online.
   - **Reinstall recovery:** local data gone, cloud data intact. First sign-in re-downloads everything. Confirmed expected behavior.
   - **Auth:** Sign in with Apple (primary, required on iOS anyway), email+password fallback for web users without Apple IDs. Supabase Auth handles password hashing and token management — never rolling our own.
   - **Data export:** deferred to v2.1. Non-trivially useful but not launch-blocking.

   ### Safety + Privacy (baked into the build, not bolted on)
   - **Row-Level Security (RLS) enabled on every table, strict policies.** `user_id = auth.uid()` enforced at the database level. Even a bug in app code cannot leak user A's data to user B — Postgres itself refuses. Non-negotiable.
   - **Encryption:** TLS in transit, AES at rest (Supabase default).
   - **EU data region** (Supabase lets us pick — required for GDPR since Anna's in Germany and most early users likely EU too).
   - **Data minimization:** collect only email + todos/sessions/areas. No tracking pixels, no third-party analytics piping content to Google/Mixpanel. If product analytics is needed later, use a self-hostable one (PostHog) or Supabase's built-in.
   - **Secrets never in the app bundle.** Notion/Google Calendar API keys stay in Supabase environment variables.
   - **GDPR compliance shipped with launch:** privacy policy, "Download my data" button, "Delete my account" button. All required by App Store and EU law.
   - **Calendar / Notion / Reminders integrations** use user-granted tokens, user-revocable from within ADDo. Store only the minimum token scope needed.
   - **No end-to-end encryption.** Considered and deliberately not built. E2E kills sync, search, and integrations — overkill for a productivity app at this scale. Revisit only if corporate users ever demand it.
   - **Trust anchor acknowledged:** we trust Supabase (YC-backed, SOC 2 certified) the same way most apps trust AWS. Reasonable bar, not paranoid-grade.
6. **Legal, Consent & Store Readiness** — ✅ LOCKED. Not glamorous but non-negotiable for App Store + GDPR.
   - **First-launch consent screen** after sign-in, before app opens. Explicit tap to accept ToS + acknowledge Privacy Policy. Not pre-checked (Apple rejects pre-checked).
   - **Versioned acceptance:** `accepted_tos_version` + `accepted_privacy_version` stored per user. ToS/Privacy updates trigger re-prompt only.
   - **Settings → Legal section:** permanent links to ToS, Privacy Policy, granted permissions list (calendar, notifications, integrations — user-revocable).
   - **GDPR rights in Settings:** "Download my data" (JSON export of everything) + "Delete my account" (irreversible server + local wipe, confirmation step).
   - **Just-in-time permission prompts.** Calendar access asked only when linking a calendar. Notifications asked only when enabling a reminder. Never upfront.
   - **App Store Privacy Labels:** honest — email + user content, linked to identity, not used for tracking.
   - **Age rating:** 4+.
   - **Documents to draft:** Privacy Policy, Terms of Service, EULA (Apple default acceptable for v1). All hosted on public Vercel URL — required by Apple reviewers.
   - **Governing law:** Germany (Anna is Munich-based).
7. **Areas + Subgoals** — CRUD for Areas and their Subgoals. The foundation everything else builds on.
   - **Area management:** create, edit, delete Areas. Each Area has: name, optional colour (for visual differentiation), optional weekly hour budget, optional calendar link (added in F8).
   - **Subgoal management:** within each Area, create/edit/delete Subgoals. Each Subgoal has: name, hashtag (auto-suggested as `#Name`, editable, must be unique within the Area), optional weekly hour budget.
   - **Schema:** new `subgoals` table — `id`, `user_id`, `area_id` (FK → areas), `name`, `hashtag` (e.g. `#Hyrox`), `weekly_budget_minutes` (nullable), `created_at`, `updated_at`. RLS: `user_id = auth.uid()`. Migration also adds `subgoal_id` (nullable FK → subgoals) to `todos` table.
   - **Task Pool chip filter UI (ships with F7):** a horizontally scrollable chip row sits below the add-form area on the Task Pool screen. Shows all Areas as chips. Tapping an Area: filters the task list to that Area's todos + shows a second row of that Area's Subgoal chips. Tapping a Subgoal chip: narrows filter to that subgoal. "All" chip always visible at the left to reset. Active filter also auto-tags new todos added while a filter is active (Area and/or Subgoal pre-filled, still editable). A todo with no area/subgoal is always visible when "All" is selected.
   - **Todo add form:** area + subgoal pickers added to the add form (and inline edit form). Area is optional. Subgoal is optional and only shown if an Area is selected. If a chip filter is active when the user starts typing, area/subgoal are pre-filled.
   - **Hashtag auto-tag:** if a user types `#Hyrox` anywhere in a todo title, ADDo automatically resolves it to the matching Subgoal and tags the todo. The `#tag` is stripped from the display title but stored for search/sync.
   - **Settings entry point:** Areas are managed from a dedicated screen accessible from Settings (not a main tab — they're configuration, not daily-use UI).
8. **Calendar linking** — iCloud (EventKit) + Google Calendar API, area mapping, hashtag routing, planned-vs-actual time tracking.
8b. **Day capacity planning — meetings + todos** — ⚠️ NEEDS PLANNING. When a linked calendar contains events with meeting links (Microsoft Teams, Google Meet, Zoom — detected via URL patterns in event description/location), ADDo treats those as fixed, non-shuffleable time blocks distinct from todo time. The goal: give the user a full-day capacity picture so they can plan their actual available working hours.
   - **Meeting detection:** parse calendar event description + location fields for known meeting URL patterns (`teams.microsoft.com`, `meet.google.com`, `zoom.us`, etc.). Events with a match = meetings. Events without = time blocks (already handled by Area linking in F8).
   - **Day capacity view:** show total declared working hours (user-set, e.g. 8h/10h/12h) broken into: meeting time (fixed, from calendar) + todo time (from session) + unaccounted buffer. E.g. "10h day · 2h in meetings · 4h of todos → 4h free."
   - **Session planning integration:** when setting up a session, if there are upcoming meetings in the calendar window, subtract them from available todo time automatically. E.g. 4h session starting at 10:00 with a 12:00–14:00 meeting = only 2h of actual todo-able time before the meeting, then 2h after.
   - **Visualisation:** TBD — could be a timeline strip, a capacity bar, or a simple text breakdown. Needs design before building.
   - **Prerequisite:** Feature 8 (calendar linking) must be live first.
   - **Out of scope for now:** travel time buffers, recurring meetings, declined meetings. One thing at a time.

9. **Integrations** — Apple Reminders (EventKit), Notion (official API). Bidirectional via hashtag parsing (`#todo`, `#time:30m`, `#area:health`). No LLM needed.
10. **Analytics / Session History** — retrospective, screen-time style. Per-Area estimate accuracy, session history, usage patterns. Opt-in visit, never shoved in user's face.
4b. **Completion notes + todo spawning** — when tapping "Done" on a roulette task, an optional small text field appears before moving to the next roll. Not mandatory — just there if you have something to capture (outcome, decision, next thought). Three parts:
   - **Part A — Completion note:** Free-text note attached to the session roll record. Stored in `session_rolls.note` (add column via migration). Shown in Session Summary alongside the task. Empty by default, never prompted — only appears when the user taps a small note icon on the Done button area.
   - **Part B — Note → new todo:** After writing a completion note, a lightweight "Add as task" button appears inline. Tapping it creates a new todo in the Task Pool pre-filled with the note as the title (editable). Inherits the Area of the completed task by default (user can change). No AI parsing — manual and intentional.
   - **Part C — Obsidian sync:** Completion notes (with task title, area, timestamp) push into the user's Obsidian vault — appended to a daily note or a dedicated ADDo log page. Lives inside the Obsidian integration (Feature 12). Part A and B ship independently of Part C.
   - **Schema change:** `session_rolls` needs a nullable `note TEXT` column. Migration required before building Part A.
   - **Design principle:** the note is a gift to your future self, not a report card. Never required, never prompted more than once, never shown to anyone else.

11. **macOS focus widget** — a persistent always-on-top floating mini-window (top-right corner) that shows the current roulette task, estimated time, and elapsed time, with Done/Skip buttons so the user never has to switch to the main app. Built as a separate small Electron app connected to the same Supabase backend via Realtime. Prerequisite: active session state must be persisted to Supabase in real-time during a session (currently in-memory only). macOS only. Post-MVP.
12. **Obsidian integration** — deferred to v5, desktop only.

## v1 bugs we're fixing along the way
- Delete buttons decrement `total_work_time` (the *goal*) instead of task time — slowly destroys work goal as you edit tasks. [Code/main.py:178,190](todo-roulette/Code/main.py#L178)
- Two chained `st.button("...") or st.button("...")` in break flow — only the first button is ever reachable. [Code/main.py:218](todo-roulette/Code/main.py#L218)
- Meal times collected but never surfaced during work screen — dead feature, cut entirely.

## Repo
- New repo, name TBD. Current `todo-roulette` is Streamlit-locked and not salvageable for native.
