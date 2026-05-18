# Working with Claude on this project

## Project at a glance

**CookCrew** — a real-time collaborative cooking app for friends. Main cook creates a "kitchen" room, others join via 6-character code (anonymous, name only), Claude parses a recipe photo/PDF into a sectioned task checklist + shopping list. Tasks can be delegated. All check-offs sync live across devices.

**Source-of-truth docs in this folder — read these before doing real work:**
- [DESIGN.md](DESIGN.md) — architecture, schema, screen flows, **the v1 scope (§2)**, and the phased build plan (§9). When in doubt about *what* to build or *whether* something is in scope, this is the answer.
- [WIREFRAMES.md](WIREFRAMES.md) — visual identity (CookCrew brand, earth-tone palette, typography), iPhone-only sizing (§0), and screen-by-screen UI specs. When in doubt about *how something should look*, this is the answer.
- `wireframes/` — exported wireframe images, when they exist.

If a request conflicts with either doc, flag the conflict before coding. Do not silently expand scope — DESIGN.md §2 lists what is explicitly **deferred to v2**; treat that list as a fence.

## Current status

- ✅ **Phase 0 (environment setup):** Xcode, Node, Expo project, Supabase project (under Florian's org, free tier), Anthropic API key — all done.
- ✅ **Phase 1a (UI):** Landing → Create/Join → Lobby + People sheet in `cooking-app/src/`. Visual identity per DESIGN.md §12 (Geist, ink primary, terracotta accent, 10-color avatar palette).
- ✅ **Phase 1b (backend):** Supabase project linked at `supabase/`. Tables `kitchens`, `cooks` with RLS. Four edge functions (`create-kitchen`, `join-kitchen`, `leave-kitchen`, `end-kitchen`) deployed with `--no-verify-jwt`. App wired through `@supabase/supabase-js`; cook list updates via a single realtime channel per kitchen. Persistent `device_id` in iOS Keychain via `expo-secure-store` + `react-native-get-random-values` polyfill.
- ✅ **Phase 2 (recipe import + parse + review):** Tables `recipes`, `recipe_sections`, `tasks`, `ingredients` with RLS. Public Storage bucket `recipe-uploads`. Three edge functions: `parse-recipe` (Claude Opus 4.7 + structured outputs + prompt caching), `update-recipe` (one function with discriminated `action` field — `set_title`, `add/update/delete_ingredient`, `add/update/delete_task`, `move_task` for drag-and-drop, `start_cooking`), `create-manual-recipe`. Screens: `RecipeImportScreen` (photo / library / PDF), `RecipeReviewScreen` (variant C, fully editable inline + drag-and-drop reordering with cross-section moves and optimistic UI).
- ✅ **Phase 3 (cooking view + realtime task sync):** `CookingScreen` rebuilt with Cook / Shop / Mine / Ask tab bar; Cook + Shop interactive, Mine + Ask placeholders for Phase 4 / 5. Recipe state (`recipe`, `sections`, `tasks`, `ingredients`) hoisted into `KitchenProvider`; review state stays local until the host taps Start cooking, which pre-populates the provider via `setRecipe` so Cooking renders without waiting for a realtime tick. Two realtime channels per device — `kitchen:<id>` (cooks, kitchens, recipes filtered by `kitchen_id`) and `recipe:<id>` (tasks, ingredients filtered by `recipe_id`) — split this way to keep one channel per table per the existing rule. New `toggle-checkbox` edge function (kitchen-membership gated, `kind=task|ingredient`) handles check/uncheck; client uses optimistic updates with revert-on-error. Lobby auto-navigates all cooks to Cooking when `recipe.status` flips to `active`. Migration `20260507224036_replica_identity_full.sql` sets `replica identity full` on `cooks` / `tasks` / `ingredients` / `recipes` so DELETE realtime events include filterable columns (was breaking the host's cook list when someone left). JoinKitchenScreen got the same avatar preview + 10-color picker as CreateKitchen. RecipeReview's Start-cooking button moved from absolute-positioned overlay to a flex sibling under the FlatList — last "+ add task" was being covered.
- ✅ **Phase 4 (delegation):** Right-side **assignee chip / "+ assign" / "+ take" affordance** on every task and ingredient row doubles as the display *and* the tap target — no separate action sheet. Tap on the checkbox still = instant toggle. Host taps the chip → `AssignSheet` opens with the cook list + "Remove assignment". Non-host taps "+ take" → instant claim-self (no sheet). Non-hosts cannot give back, reassign, or modify others' assignments by design. New `assign-checkbox` edge function mirrors `toggle-checkbox`: `{ kind, id, assignTo }`. Auth: host = unrestricted; non-host = `assignTo === self.id && row.assigned_to === null` only. Migration `20260508065049_assigned_by.sql` adds `assigned_by` to `tasks` + `ingredients` so the in-app `DelegationBanner` can render "[name] gave you: …" with the assigner's avatar. Banner slides in from top using `useSafeAreaInsets()` for offset (absolute children of `SafeAreaView` don't respect padding), auto-dismisses at 4s, tap → jumps to Mine tab. **Mine tab** now groups tasks under section headers in recipe order (sorted by `(section_order, order_index)`), with a separate **To buy** list above. Empty + all-done states wired. **Race-condition fix on optimistic mutations:** `KitchenProvider` keeps per-row counters (`pendingTasksRef`, `pendingIngredientsRef`) and skips realtime UPDATEs for rows with `count > 0`. Decrement runs on an 800ms delay to absorb late realtime echoes that arrive ~200–400ms after the POST response. Toggle/assign mutators no longer apply the POST response to state — the optimistic state is authoritative during the pending window, realtime reconciles after. Without this, rapid-tapping the same checkbox would flicker (stale POST response or realtime echo clobbering a fresher optimistic).
- ✅ **Phase 5 (Ask Claude):** `AskTab` (`src/screens/AskTab.tsx`) replaces the placeholder — chat bubbles (user right, Claude left in terracotta tint), composer with auto-scroll, thinking indicator, "Include recipe context" toggle. Non-streaming: edge function returns the assistant message once Claude finishes, both rows persisted in `chat_messages`. New table `chat_messages` (migration `20260511112054_chat_messages.sql`) with `replica identity full`; shared per kitchen — every cook sees every Q+A via realtime on the existing `kitchen:<id>` channel. New edge function `ask-claude` calls **Haiku 4.5** with the persona as a cacheable system block + the recipe context (title, ingredients, steps with completion state) as a second block when the toggle is on. When the toggle is off, chat history is also dropped so prior recipe-grounded answers don't leak the recipe back in. **"You're on" chip** above the composer is auto-derived from the first uncompleted task in recipe order (not last-tapped) and the persona explicitly tells Claude not to over-anchor on it. When context is off and the user asks something recipe-specific, the persona prompts Claude to name the toggle ("Turn on 'Include recipe context' below the message box…") instead of pretending no recipe exists.
- ✅ **Phase 6 (sous chef + section editing + host live-edit during cooking):** Scope trimmed for v1 — disconnect detection + auto-promotion (DESIGN.md §9 original Phase 6.B) was **flagged for v2** since it's hard to test reliably and the failure mode (recipe locked if head chef drops) is recoverable by rejoin. What shipped: **(A) Sous chef.** Migration `20260511141019_sous_chef.sql` adds the long-spec'd `kitchens.sous_chef_id` column. New edge function `set-sous-chef` (head-chef-only). PeopleSheet renders tappable cook tiles with an explicit "tap to make sous chef" sub-line, an `ink`-border + "head chef" chip on the host, a `steelSoft`-border + chef-hat badge + "sous chef" chip on the sous chef. **Sous chef has delegate powers** (matches `head chef` for assign-checkbox auth — `canManage = isHost || isSousChef`) but **not** recipe-edit, end-kitchen, or appoint-sous-chef. The "host" label was renamed to "head chef" everywhere user-facing. **(D) Section editing.** `update-recipe` gains `add_section` / `update_section` / `delete_section` actions (cascade to tasks via FK). RecipeReview screen: tap header to rename, long-press to delete (with task-count warning), "+ add section" at the bottom. Same set of gestures works on the Cook tab during cooking (head-chef only). Migration `20260511141842_recipe_sections_replica.sql` sets `replica identity full` on `recipe_sections` so DELETE realtime events carry filter columns, and the recipe channel subscribes to that table. **(C) Host live-edit during cooking.** Long-press a task on Cook tab (head-chef only) → EditModal with description + Delete. Long-press an ingredient on Shop tab → same. "+ add task" per section, "+ add ingredient" at the bottom of the Shop list (both host-only). New provider method `dispatchRecipe(action)` calls `update-recipe` and applies the response to provider state.
- ✅ **Phase 7 (polish + TestFlight):** **Tutorial sheet** — `HowItWorksSheet` opens from the "how does this work?" link on Landing, 3 short paragraphs (one recipe / drop a recipe in / split the work). **Empty + celebration states** — sticky sage banner above the bottom tab bar when all tasks (or all ingredients) are checked off, with a Switch-to-Cook link on Shop and a Wrap-up CTA on Cook (head chef only). Banners are dismissible via X and re-arm when completion drops below 100%. **Wrap-up flow** — terracotta "Done?" pill next to the recipe title on Cook tab (host-only) opens `WrapUpSheet` with stats row (tasks done / items bought / cooks), heads-up warning if tasks remain, "End kitchen" + "Keep cooking" buttons. Joined cooks now see "[head chef] wrapped up the kitchen. Hope it was tasty!" with the head chef's actual name instead of a generic alert. **App icon + splash** — terracotta chef-hat-over-crossed-utensils mark on cream `#F7F5F0`, baked over the cream for the iOS icon, transparent for the splash (Expo composites over `splash.backgroundColor`). `app.json` updates: `name: "CookCrew"` (was `cooking-app`), `supportsTablet: false`, `bundleIdentifier: com.cookcrew.app`, `infoPlist.ITSAppUsesNonExemptEncryption: false` (suppresses the export-compliance prompt on every build). **EAS + TestFlight** — Expo project `b4803840-dc8c-4064-acf4-21a2471996ed` under `@nickzett84`. `eas.json` has dev / preview / production profiles with Supabase env vars mirrored from `.env.local` (the production env also has `autoIncrement: true` so iOS buildNumber bumps each upload). Apple Developer team is Florian's (`PPG8Z67MX3`); Nick is an App Manager. **App Store Connect API key** registered with EAS for fully-automated submits — the `.p8` lives in 1Password, only the key ID + issuer ID + the EAS-cached credential are needed for subsequent builds. Distribution certificate + provisioning profile were generated once under Florian's account (cert + profile valid through May 2027) and now live on EAS's servers; future builds reuse them with no Apple ID prompt. **OTA updates** wired (`runtimeVersion: { policy: "appVersion" }` + `updates.url`) so JS-only fixes ship via `eas update --branch production --message "..."` in ~30s instead of a 30-min rebuild. **Realtime resilience** — `KitchenProvider` listens for `AppState` change to `'active'` and refetches the active recipe + cook list via REST. Without this, a cook who backgrounded their phone on cellular right when the host tapped Start cooking would miss the `recipes` UPDATE event and stay stuck on the Lobby forever (real bug from the first TestFlight test with Florian on cellular). Pattern: any time you rely on a realtime event to drive a screen transition, also refetch on AppState foreground.

### v2 deferrals

Tracked here so they don't get forgotten. Ignore unless you're explicitly working on them.

- **Disconnect detection + sous-chef auto-promotion deferred to v2.** Original DESIGN.md §6 specced this; we trimmed it during Phase 6 (see decision log). For v1, sous chef is appointed manually and has delegate powers, but isn't auto-promoted if the head chef drops. If the head chef loses connection, the recipe is locked until they reconnect — recoverable but not graceful. Revisit if testing surfaces real pain.
- **Force-quit-and-reopen loses kitchen session.** The `device_id` is persisted in Keychain so the server still remembers the cook, but the app doesn't auto-rejoin on launch — the cook is sent back to Landing and has to re-enter the code. Surfaced during the first TestFlight test. Not a blocker, but worth a "rejoin your last kitchen?" flow in v2.

### Dev server + testing

- Default: `cd "/Users/nzettelmeyer/Documents/Claude Cooking App/cooking-app" && npx expo start`. Then press `i` to launch the iOS simulator, or scan the QR with the iPhone Camera app (same Wi-Fi as the Mac) to open in Expo Go.
- Add `-c` to clear Metro cache after a native dependency change or `babel.config.js` edit. Don't add it otherwise — first launch with cache cleared is ~3× slower.
- **Two simulators for realtime testing:** open a second device via Simulator app menu → File → Open Simulator → pick a *different* model (e.g. iPhone 15 Pro Max if the first is iPhone 15 Pro). Click the new sim to make it foreground, then in the Expo terminal press `shift+i` for the picker → select the new device → Enter. App installs on both, both share Metro + Supabase, realtime fans out between them.
- If `shift+i` doesn't see the new sim, restart Expo.

## Backend layout

- Supabase project ref: `qoqhedgwqtzztkclotjg` (under Florian's org, free tier). The CLI command prefix is `npx supabase` (the standalone `supabase` binary isn't installed on this machine).
- `supabase/migrations/` — committed SQL migrations. Apply with `npx supabase db push` from the project root (auto-prompts y/n). Current migrations (in order): init phase 1 (kitchens + cooks), grant select to anon, grant service_role on phase 1 tables, recipes phase 2 (recipes + sections + tasks + ingredients + Storage bucket), `replica identity full` on cooks/tasks/ingredients/recipes so DELETE realtime events carry filter columns, `assigned_by` columns on tasks + ingredients for delegation banner attribution, `chat_messages` table for the shared Ask Claude thread, `kitchens.sous_chef_id` column, `replica identity full` on recipe_sections.
- `supabase/functions/` — edge function source. `_shared/` holds the admin client, CORS helper, validators, JSON response helpers, kitchen-code generator. Deploy a function with: `npx supabase functions deploy <name> --no-verify-jwt --project-ref qoqhedgwqtzztkclotjg`. **Always include `--no-verify-jwt`** — the new Supabase `sb_publishable_*` / `sb_secret_*` key format isn't a JWT and the gateway rejects it as `UNAUTHORIZED_INVALID_JWT_FORMAT`. Per-function security comes from input validation + `device_id` membership check inside each function. Functions: `create-kitchen`, `join-kitchen`, `leave-kitchen`, `end-kitchen`, `parse-recipe`, `update-recipe`, `create-manual-recipe`, `toggle-checkbox`, `assign-checkbox`, `ask-claude`, `set-sous-chef`.
- `supabase/secrets` — set via `supabase secrets set --project-ref qoqhedgwqtzztkclotjg KEY=value`. Currently set: `ANTHROPIC_API_KEY` (used by `parse-recipe`). Setting secrets requires Owner or Administrator role on the org — Developer is not enough.
- `cooking-app/.env.local` — `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Gitignored. For EAS production builds, mirror these into `eas.json`'s `build.production.env` later.
- `cooking-app/babel.config.js` — required by `react-native-reanimated` v4 (drag-and-drop on the Recipe Review screen). The plugin name is `react-native-worklets/plugin` and must be the last plugin.
- `cooking-app/App.tsx` — root is wrapped in `<GestureHandlerRootView>` (also for the drag library). Imports `react-native-get-random-values` at the top so `crypto.getRandomValues` is available before any module that uses it.
- Client architecture: `src/lib/api.ts` (typed wrappers for all edge functions + recipe action types), `src/lib/KitchenProvider.tsx` (kitchen + recipe + cook list + chat state, two realtime channels, optimistic toggle/assign actions, `dispatchRecipe` for live recipe edits, `askClaude`, `setSousChef`), `src/lib/uploads.ts` (Storage upload helper for recipe images/PDFs), `src/lib/deviceId.ts` (Keychain-backed identity). RecipeReview keeps its draft state local while editing; on Start cooking the result gets handed to the provider via `setRecipe` and lives there for the rest of the session. Delegation UI lives in `src/components/AssignChip.tsx`, `src/components/AssignSheet.tsx`, and `src/components/DelegationBanner.tsx`; Ask Claude lives in `src/screens/AskTab.tsx`.
- **Optimistic mutation race pattern** (used by `toggleTask`, `toggleIngredient`, `assignTask`, `assignIngredient`): each mutation increments `pendingTasksRef` / `pendingIngredientsRef` (per-row counter Map); realtime UPDATE events for rows with `count > 0` are *skipped*; decrement runs on an 800ms delay to absorb late realtime echoes; the mutator does NOT apply the POST response to state (local optimistic + realtime is the truth). Without this, rapid taps flicker because stale POST responses and realtime echoes overwrite a fresher optimistic. Any new optimistic action on a row-keyed table should follow the same shape.

## Who's building this

The user is **Nick** (Florian's son), a first-time app builder with no coding background. Florian (his dad) is available as a resource for dev tooling. Defaults:
- Explain shell commands *before* running them, not after.
- Don't assume familiarity with developer tooling — call out prerequisites.
- Lean on managed services over custom infra.
- **Re-paste the Expo dev-server command in every message that asks Nick to test on a device.** He can't easily scroll back through prior turns to find it. The command is `cd "/Users/nzettelmeyer/Documents/Claude Cooking App/cooking-app" && npx expo start` (add `-c` only after native dependency changes).

## Stack

- **App:** Expo / React Native, written in TypeScript, built and shipped via EAS to TestFlight (Florian's existing Apple Developer account).
- **Backend:** Supabase (Postgres + Realtime + Storage + Edge Functions). **No Supabase Auth in v1** — kitchens are anonymous, cooks identified by name + a locally-generated `device_id`. Auth is deferred to v2.
- **AI:** Claude API (Anthropic). Models: `claude-opus-4-7` for recipe parsing (quality matters on messy photos), `claude-haiku-4-5-20251001` for the in-kitchen "Ask Claude" chat (cheaper, plenty smart).
- **Dev machine:** Mac (macOS 26.x).

## Operating principles

1. **Don't assume. Surface tradeoffs.** If you're uncertain whether the user
   wants approach A or B, ask once before writing 200 lines of A.
2. **Minimum code that solves the problem.** No speculative abstractions, no
   "while I'm here" cleanups, no error handling for cases that can't happen.
3. **Touch only what you must.** Clean up your own mess, not the codebase's.
4. **Define success before you start.** "Done" means a verified outcome, not
   "code compiled."

## Working with Claude Code

Claude does most of the typing in this project. That doesn't mean you stop
thinking — your job shifts from writer to reviewer.

- **Read the actual diffs** before accepting large changes. Claude's
  summaries can be subtly wrong about what changed.
- **Verify API claims.** APIs change. If Claude says "use this library
  like this," and the snippet doesn't compile, the current docs are the
  source of truth, not Claude's training data.
- **Don't merge code you can't read.** If you don't understand it, ask for
  an explanation; if you still don't, ask for a simpler version.
- **Two failed fixes on the same bug = re-frame the problem.** If Claude
  has tried twice and the bug persists, the problem statement is probably
  wrong. Re-describe it from scratch.

## TypeScript

- **Keep `strict: true` in `tsconfig.json`.** It turns on the checks that
  make TypeScript actually useful.
- **Avoid `any`.** It silently disables type-checking for that variable.
  If Claude reaches for `any`, ask for a real type.
- **Be strict at boundaries** (API responses, form input, navigation
  params). Loose inside a single function is fine; at the boundary,
  precise types catch real bugs.

## Design doc discipline

DESIGN.md and WIREFRAMES.md are the source of truth for intent. CLAUDE.md and
conversation context are not enough — they get lost.

- **Every meaningful change updates the relevant doc.** New feature, behavior
  change, schema migration, or dependency added → DESIGN.md. UI/visual change
  → WIREFRAMES.md. The phase status near the top of CLAUDE.md gets updated
  when a phase completes.
- **Architectural decisions get logged in a decisions table** (one row per
  decision: what was decided, the alternatives considered, the reason). When
  the decision later turns out wrong, edit the row — don't quietly reverse
  course.
- **If a chunk of work doesn't fit in the doc, the chunk is too vague.**
  Define it before coding.
- **v1 scope is locked.** DESIGN.md §2 lists what's deferred to v2 (accounts,
  recipe history, video parsing, Android, push notifications, multi-recipe
  kitchens, timer integration). If a request would build any of those, flag it
  and confirm before proceeding.

## Git workflow

- **Never push directly to main.** Every change goes through a PR, even small
  ones. Branch name describes the chunk: `claude/auth-screen`, not `claude/fix`.
- **One concern per PR.** If you find yourself writing two unrelated commit
  messages, that's two PRs.
- **Delete branches after merge.** No long-lived feature branches.
- **Don't bypass safety checks.** No `--no-verify`, no `--force-push` to main,
  no `git reset --hard` on uncommitted work without explicit OK.

## Before merging any PR

1. Run `/simplify` (parallel review for reuse, quality, efficiency). Fix what's
   real; ignore false positives.
2. Run `/review` (code review of the PR). Same rule.
3. Test the actual behavior on a real device, not just the simulator and not
   just `npm test`. Type-checking is not feature-checking.

## Tests

- **Start with pure logic, not UI.** Functions that take input and return
  output are cheap to test and catch real bugs. UI tests in React Native are
  expensive and brittle — defer until the app is stable.
- **Run tests in CI on every PR.** A failing test that nobody sees is worse
  than no test. GitHub Actions on PR + push to main is the minimum.
- **When a bug surfaces, write the test that would have caught it** before
  fixing it.

## Secrets and the Claude API

The app calls the Claude API to parse recipe text from images and PDFs.
This needs care:

- **API keys never go in the client bundle.** Anything in the app's IPA
  can be extracted — including environment variables prefixed with
  `EXPO_PUBLIC_`. A leaked Claude API key can be used by anyone, billed to
  your account, until you rotate it.
- **All Claude API calls go through a Supabase edge function** that holds
  the key as a Supabase secret (`supabase secrets set ANTHROPIC_API_KEY=...`).
  The app sends the image/PDF to your edge function; the edge function
  calls Anthropic and returns the result.
- **Set a monthly spend limit in the Anthropic console** before you start
  testing. A bug in a retry loop can burn through credits fast.
- **Same rule for any other server-side keys** (Stripe secret, OpenAI,
  Google Maps server keys). Publishable keys (Supabase anon key, Stripe
  publishable key) are fine in the bundle by design.

## Supabase

- **Row-Level Security on every table from day one.** Adding it later is
  painful and easy to get wrong. Default-deny, then write policies that
  allow the specific paths you want.
- **Migrations live in `supabase/migrations/` and are committed to git.**
  Apply via the SQL editor or `supabase db push`. Never edit the schema
  through the dashboard without writing the migration first — production and
  source of truth must match.
- **Server-side enforcement of permissions, even if the UI also enforces
  them.** A tampered client should not be able to escalate. Edge functions
  re-validate the caller's identity and authorization.
- **Generic error messages to clients.** "Invalid request" beats "user X is
  not in household Y."
- **Don't open two realtime channels on the same Postgres table from one
  device.** It crashes React Native on screen unmount in ways that are very
  hard to debug. Extend the existing channel hook instead.

## Expo / EAS

- **Two kinds of changes:** JS-only changes ship via `eas update` (OTA, takes
  seconds). Native changes (new packages with native code, `app.json` native
  fields, version bumps) require `eas build` and a fresh TestFlight install.
- **OTA version label.** Maintain a hardcoded `OTA_VERSION` string surfaced
  somewhere visible in the app (e.g. Settings footer). **Bump it BEFORE you
  run `eas update`** — otherwise you can't tell on-device which bundle landed.
- **EAS Build does not see `.env.local`.** Anything the production bundle
  needs at runtime (Supabase URL, publishable key) must go in `eas.json`'s
  `build.production.env`. The publishable Supabase key is safe to embed —
  RLS is what gates access.
- **Use `expo-secure-store` (iOS Keychain) for refresh tokens**, not
  AsyncStorage. AsyncStorage is plaintext on disk.
- **iOS permission strings.** Every permission your app uses (camera,
  photos, document picker, microphone, location) needs a usage-description
  string in `app.json` explaining *why*. Without it, the app crashes the
  first time it asks for the permission. Most Expo plugins add these for
  you (e.g. `expo-camera` adds `NSCameraUsageDescription`), but verify in
  `app.json` after installing each plugin.
- **Test on a real device before declaring a feature done.** Simulator
  behavior diverges from device behavior in subtle ways (push notifications,
  camera, deep links).

## Mac-specific

- **Keep your project path free of spaces.** `~/code/myapp` is fine.
  `~/Dropbox/My Project/myapp` will break Xcode build phases and CocoaPods
  in ways that take an evening to diagnose. If you must have spaces, expect
  to patch a few build scripts.
  - **This project is at `~/Documents/Claude Cooking App/cooking-app/`** — the
    parent path has spaces. The Expo dev server (`npx expo start`) works fine
    here, but expect grief at the EAS build / CocoaPods stage. Quote paths in
    every shell command (`cd "..."`). When we hit the first build failure
    that traces back to the space, consider moving the project to
    `~/code/cookcrew/` and updating this note.
- **CocoaPods + Ruby compatibility issues** show up as opaque encoding
  errors. If `pod install` fails with `Encoding::CompatibilityError`, set
  `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` in your shell.

## Things to flag, not silently work around

- A failing test or pre-commit hook → investigate the root cause; do not skip.
- An unfamiliar file or branch you don't recognize → ask before deleting; it
  may be in-progress work.
- A request that would be hard to undo (force-push, dropping a table, deleting
  a branch) → confirm explicitly before doing it.
- A bug whose fix is "add a try/catch and move on" → find the real cause first.

## Communication

- Brief is good. One-sentence updates beat paragraphs.
- Don't narrate your thought process — say what changed and what's next.
- When you finish a task, say what was done and what (if anything) is still
  open. No trailing summaries beyond that.

## When stuck

- Read the actual code before guessing.
- Two failed attempts at the same approach = stop and rethink.
- It's better to ask than to ship something the user has to revert.
