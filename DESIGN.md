# Cooking App — Design Document

**Status:** v1 design, locked 2026-05-02
**Owner:** Florian
**Audience:** Florian (and his dad, helping with dev tooling)

---

## 1. What we're building

A real-time collaborative cooking app for friends. The "main cook" creates a kitchen room, friends join with a code, and everyone works through a recipe together — checking off ingredients while shopping, and checking off cooking steps in the kitchen. The main cook can delegate specific tasks to specific people. All check-offs sync live across everyone's phones.

Recipes get imported as a photo or PDF and parsed by Claude into a structured, sectioned checklist. Cooks can ask Claude follow-up cooking questions in-app, with awareness of what they're currently making.

---

## 2. v1 scope (what's in, what's out)

> **STATUS UPDATE (2026-06-20): v1 is complete and shipped to TestFlight. The project is pivoting to a COMMERCIAL product.** v1 was built for a friends-only trust model (anonymous, no auth, public storage, no cost controls). Going commercial reorders the roadmap — see §11 for the v2 "commercial foundation" plan. The v1 scope below is preserved as the historical record of what shipped; it is no longer the active fence.

### In scope for v1
- iOS only (testing on iPhone via TestFlight)
- Anonymous use — name + room code, no signup
- Single-session kitchens (no recipe history, no past kitchens)
- Recipe input: photo or PDF
- Claude-parsed sectioned task checklist + ingredient/shopping list
- Real-time sync of check-offs and edits across all cooks
- Task delegation with in-app banner notifications
- Main cook can edit recipe live; can appoint a sous chef
- Context-aware "ask Claude" button
- Up to ~10 cooks per kitchen

### Deferred to v2 (do not build in v1)
- Android version
- User accounts and signup
- Recipe history / saved recipes
- Video recipe parsing (TikTok/Reels/etc.)
- Push notifications (in-app banners only for v1)

If a feature isn't in the v1 list above, it's not in v1. We'll revisit after v1 ships.

---

## 3. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Mobile framework | **React Native** with **Expo (managed workflow)** | Easiest path for a beginner targeting iOS first and Android later. Expo handles iOS build/signing/TestFlight via EAS Build. Single codebase for both platforms. |
| Language | **TypeScript** | Catches bugs at write-time instead of runtime. Worth the small learning overhead. |
| Backend | **Supabase** | Postgres database + realtime websockets + file storage + serverless functions, all in one product. Florian's dad uses it. |
| AI | **Claude API** (`claude-opus-4-7` for parsing, `claude-haiku-4-5-20251001` for ask-Claude chat) | Opus gives best parsing quality on photos/PDFs. Haiku is cheaper and fast enough for chat. |
| Distribution | **TestFlight** via Florian's dad's Apple Developer account | Already paid for; built-in to iOS; up to 100 testers. |

### Why not other things
- **Not Firebase:** Supabase is roughly equivalent and Florian has a family resource for it.
- **Not bare React Native:** Expo abstracts away most of the iOS native build pain. We can "eject" later if needed.
- **Not direct Claude API calls from the app:** API keys would be embedded in the app bundle and extractable. We'll proxy through a Supabase Edge Function (more on this below).

---

## 4. Architecture

```
┌─────────────────┐         ┌────────────────────────────┐
│   iOS app       │ ←─────→ │   Supabase                 │
│   (Expo / RN)   │ realtime│   - Postgres (data)        │
│                 │ ←─────→ │   - Realtime (live sync)   │
│                 │  https  │   - Storage (recipe files) │
│                 │ ←─────→ │   - Edge Functions ────────┼──→ Claude API
└─────────────────┘         └────────────────────────────┘
```

**Why an Edge Function in front of Claude:** Mobile app bundles can be unpacked, so any API key embedded in the app is effectively public. The Edge Function holds the Claude API key as a secret, validates the request came from a real cook in a real kitchen, and forwards it to Claude. The app never sees the Claude key.

---

## 5. Database schema (Supabase / Postgres)

```
kitchens
  id              uuid (pk)
  code            text (6-char, unique, e.g. "PEAR42")
  status          enum: active | ended
  main_cook_id    uuid (fk → cooks.id, nullable until first cook joins)
  sous_chef_id    uuid (fk → cooks.id, nullable)
  created_at      timestamptz
  ended_at        timestamptz (nullable)

cooks
  id              uuid (pk)
  kitchen_id      uuid (fk → kitchens.id)
  name            text
  device_id       text (locally generated UUID, used to recognize returning cook)
  joined_at       timestamptz
  last_seen_at    timestamptz

recipes                                            -- shipped in migration 20260507154055
  id              uuid (pk)
  kitchen_id      uuid (fk → kitchens.id, on delete cascade)
  title           text                              (default '')
  source_path     text (path inside the recipe-uploads Storage bucket; null for manual)
  source_type     check: photo | pdf | manual
  status          check: parsing | review | active | failed (default 'review')
  parse_error     text (filled when Claude parse failed)
  parsed_at       timestamptz (when parse completed)
  created_at      timestamptz

recipe_sections
  id              uuid (pk)
  recipe_id       uuid (fk → recipes.id, on delete cascade)
  order_index     int (0, 1, 2... within recipe)
  title           text (e.g. "Prep")

tasks
  id              uuid (pk)
  recipe_id       uuid (fk → recipes.id, on delete cascade) -- denormalized
  section_id      uuid (fk → recipe_sections.id, on delete cascade)
  order_index     int (0, 1, 2... per-section)
  description     text (e.g. "Chop carrots into 1cm cubes")
  assigned_to     uuid (fk → cooks.id, nullable)
  assigned_by     uuid (fk → cooks.id, nullable — for delegation banner attribution)
  completed_at    timestamptz (nullable)
  completed_by    uuid (fk → cooks.id, nullable)

ingredients
  id              uuid (pk)
  recipe_id       uuid (fk → recipes.id, on delete cascade)
  order_index     int (0, 1, 2... within recipe)
  name            text (e.g. "carrots")
  quantity        text (e.g. "2 large" — keep as text, recipes are messy)
  assigned_to     uuid (fk → cooks.id, nullable)
  assigned_by     uuid (fk → cooks.id, nullable)
  checked_at      timestamptz (nullable)
  checked_by      uuid (fk → cooks.id, nullable)

-- Storage bucket: recipe-uploads (public). Path convention: <kitchen_id>/<random_hex>.<ext>.

chat_messages
  id              uuid (pk)
  kitchen_id      uuid (fk → kitchens.id)
  cook_id         uuid (fk → cooks.id)
  role            enum: user | assistant
  content         text
  context_task_id uuid (fk → tasks.id, nullable — what step they were on when asking)
  created_at      timestamptz
```

### Row Level Security (RLS) — important
Supabase tables are open to the public internet by default. We must enable RLS so that a cook can only read/write data for kitchens they're actually in. Rough policy: a cook is identified by their `device_id` (stored in their phone's local storage), and they can only touch rows where `kitchen_id` matches a kitchen their `device_id` is a member of.

---

## 6. Screens & UX flow

### Screen 1: Landing
- "Create a Kitchen" (big button)
- "Join a Kitchen" (big button)

### Screen 2a: Create Kitchen
- "What's your name?" → text field
- Tap "Create" → kitchen created, you become main cook, shown the room code
- Auto-advance to Screen 4 (Recipe Import)

### Screen 2b: Join Kitchen
- "Room code" → 6-char text field
- "Your name" → text field
- Tap "Join" → enter the kitchen, advance to Screen 5 (Cooking View, but recipe may still be loading)

### Screen 3: Kitchen Lobby (main cook only, before recipe imported)
- Shows the room code prominently
- Lists who's joined so far (real-time updates as people arrive)
- "Import Recipe" button

### Screen 4: Recipe Import (main cook only)
- "Take a photo" / "Choose photo from library" / "Choose PDF"
- Upload spinner while file goes to Supabase Storage
- "Parsing recipe..." spinner while Edge Function calls Claude
- Falls through to Screen 4b on success

### Screen 4b: Recipe Review (main cook only)
- Editable recipe title
- Editable list of ingredients (add, remove, change quantity)
- Editable list of sections, each with editable tasks
- "Looks good — start cooking!" button → recipe goes `active`, all cooks now see it

### Screen 5: Cooking View (main screen)
Tabs at the bottom:
- **Cook** — sectioned task checklist (everyone sees this)
- **Shop** — ingredient list with check-offs
- **Mine** — just the tasks/ingredients delegated to me
- **Ask** — Claude chat

Top of screen always shows: kitchen name, who's in the kitchen (small avatars), and a "leave kitchen" button.

### Cook tab specifics
- Sections shown in order, but not locked (any task can be checked off any time)
- Each task row: checkbox, description, "assigned to: [name]" badge if delegated
- Tap a task to open a small action sheet:
  - Check / uncheck
  - Delegate to... (main cook only; opens cook list)
  - Take this task (any cook — claims it for themselves)
- Long-press on a task (main cook only) → edit description, delete task, add a new task after this one
- "+" button at bottom of each section to add a new task
- "+ Section" at bottom to add a new section

### Delegation banner
When a task gets delegated *to you*, a banner slides in from the top of the screen for ~4 seconds: "Florian assigned you: chop the carrots." Tapping it jumps to that task in the Mine tab.

### Ask tab
- Free-form chat with Claude
- Below the input, a small toggle: "Include context: [current recipe + last viewed task]"
- Default ON — sends the recipe + most recently tapped task to Claude as context

### Head chef + sous chef (v1 shipped behavior)
- Top bar avatars → People sheet. Head chef sees every non-host cook tile as tappable ("tap to make sous chef" sub-line).
- Tap a cook → confirm in alert → that cook becomes sous chef. Tile gets a steelSoft (pale blue) border and a chef-hat mini-badge on their avatar. Head chef's tile has a dark ink border.
- **Sous chef has delegate powers** — same `assign-checkbox` auth as head chef (`canManage = isHost || isSousChef`). Can assign, unassign, reassign tasks/ingredients.
- **Sous chef cannot** edit the recipe (live-edit during cooking is host-only), end the kitchen, or appoint another sous chef. The chef-hat icon stays steel-blue to match the metaphor: line lieutenant, not head chef.
- v1 internal labels: "host" was renamed "head chef" everywhere user-facing. Internal identifiers (`isHost`, `main_cook_id`) keep their original names.
- **v2:** Automatic promotion if head chef disconnects (>60s heartbeat staleness). Spec'd in §11 #8.

---

## 7. Claude integration

### Recipe parsing prompt (sent to Edge Function, then Claude)
The Edge Function calls Claude with the photo/PDF attached and a prompt roughly like:

```
You are parsing a recipe for a collaborative cooking app. The user will
cook this with friends, and the app will turn your output into a delegated
task checklist.

Output JSON only, with this shape:
{
  "title": "...",
  "ingredients": [
    { "name": "carrots", "quantity": "2 large" },
    ...
  ],
  "sections": [
    {
      "title": "Prep",
      "tasks": [
        "Chop carrots into 1cm cubes",
        "Preheat oven to 350°F",
        ...
      ]
    },
    {
      "title": "Cook",
      "tasks": [...]
    }
  ]
}

Rules:
- Group tasks into sections by *cooking phase*. Tasks within a section
  should be doable in parallel by different cooks. Tasks in later
  sections depend on earlier sections being done.
- Each task should be a single concrete action a person can do without
  needing to consult anyone else.
- Be specific: "Chop 2 carrots into 1cm cubes" not "Chop vegetables".
- If a step has multiple sub-actions, split them into separate tasks.
```

We'll use **structured output** (JSON mode) so we can parse the result reliably.

### Ask Claude prompt (chat)
System prompt includes the full recipe JSON + the description of the most recently tapped task. User question gets appended. Use Haiku — it's plenty smart for "how do I julienne a carrot?" and ~10x cheaper than Opus.

### Prompt caching
The recipe JSON gets sent on *every* chat turn. We'll use Anthropic's prompt caching to avoid paying for those tokens repeatedly during a single cooking session. Big cost saver.

---

## 8. Real-time sync

Supabase Realtime works by subscribing to Postgres table changes over a websocket. The app subscribes to:
- `tasks` where `section_id` is in this kitchen's recipe → updates checkboxes live
- `ingredients` where `recipe_id` is this kitchen's recipe → updates shopping checkboxes live
- `cooks` where `kitchen_id` is this kitchen → updates the cook list live
- `chat_messages` where `kitchen_id` is this kitchen → updates Ask Claude tab live (so other cooks can see questions/answers if they want)

When you tap a checkbox, the app updates the row in Postgres. Supabase pushes that change to every other subscribed device within ~100ms. Their UI updates automatically.

**Optimistic updates:** when you tap a checkbox, update the UI *immediately* without waiting for the server. If the server rejects it (rare), revert. Keeps the app feeling snappy.

---

## 9. Build phases

We'll build in chunks. Each phase is a working app you can test before moving on. Don't move to the next phase until the current one works.

**Status as of 2026-06-19:** All v1 phases (0–7) shipped, plus two rounds of post-TestFlight polish (paste-recipe-text import, code-input polish, prominent hang-tight banner, CodeChip on Recipe Import/Review, invite-UX consolidation). OTA pipeline now correctly wired (channel discipline learned the hard way on the first OTA round — see decision log 2026-06-18). CLAUDE.md "Current status" is the live tracker; this file shows the per-phase scope.

### Phase 0 — Prerequisites & setup
- Install Xcode (from Mac App Store — large download, do this first)
- Install Node.js (via [nodejs.org](https://nodejs.org) — pick LTS)
- Install Expo CLI (`npm install -g expo-cli`)
- Create Supabase account, create a new project
- Create Anthropic account, generate an API key
- Initialize the Expo project (`npx create-expo-app`)
- Install Expo Go on your iPhone (App Store) — for fast iteration during development
- Get Florian's iPhone connected to the Mac for testing

### Phase 1 — Empty kitchen
- Landing screen with two buttons
- "Create kitchen" generates a code, writes a row to `kitchens` table, takes you to the lobby
- "Join kitchen" reads the code, writes a row to `cooks` table, takes you to a placeholder cooking view
- Lobby shows the code and the list of cooks (real-time)
- **Test:** create a kitchen on your phone, have a friend join from theirs. See their name appear.

### Phase 2 — Recipe import + parsing
- Photo/PDF picker on main cook's import screen
- Upload to Supabase Storage
- Edge Function calls Claude, returns parsed JSON
- Write recipe + sections + tasks + ingredients to Postgres
- Recipe Review screen lets main cook edit before going live
- **Test:** snap a photo of a cookbook page, see it become a checklist.

### Phase 3 — Cook view + sync
- Cook tab displays sections + tasks
- Shop tab displays ingredients
- Tapping checkbox writes to DB; other devices see the update
- **Test:** cook checks off step on phone A, phone B shows the check appear within a second.

### Phase 4 — Delegation
- Main cook can long-press / tap menu to assign a task to a cook
- Mine tab filters to assigned-to-me tasks
- In-app banner on assignment
- Steal-task and undelegate logic
- **Test:** main cook delegates 3 tasks to 3 different friends; each friend sees only their own in Mine.

### Phase 5 — Ask Claude
- Chat tab with text input, shared thread across the kitchen
- Calls Edge Function → Claude (Haiku 4.5) with recipe context (opt-in via "Include recipe context" toggle, default on)
- **Non-streaming** in v1 — full response after a "Thinking…" indicator. Decision in §12 (2026-05-11).
- **Test:** ask "how do I tell if my chicken is done?" mid-cook.

### Phase 6 — Sous chef + edge cases (shipped, with one trim)
- ✅ Appoint sous chef UI (PeopleSheet, head-chef-only)
- ⏭ Disconnect detection + auto-promotion — **deferred to v2** (§11 #8). Decision in §12 (2026-05-12). Sous chef has delegate powers in v1 but isn't auto-promoted.
- ✅ Head chef live-edit recipe during cooking (add/remove/rename tasks, ingredients, sections)
- ✅ Section editing in Recipe Review (rename, add, delete with cascade-warning)
- **Tests:** host delegates → sous chef can reassign; host renames a section during cooking → all clients update; host long-presses a task → edits or deletes via EditModal.

### Phase 7 — Polish + TestFlight (shipped)
- Tutorial sheet on Landing ("how does this work?"); celebration banners + wrap-up flow on Cook/Shop tabs; "Done?" pill + `WrapUpSheet`.
- App icon + splash (terracotta chef-hat-and-crossed-utensils on cream paper).
- `eas.json` profiles, App Store Connect API key registered with EAS, distribution cert + provisioning profile generated under Florian's Apple team.
- OTA updates wired (`runtimeVersion: appVersion` policy + `updates.url`) so future JS-only fixes ship via `eas update` in ~30s.
- Realtime resilience: AppState foreground refetch in `KitchenProvider` so a backgrounded cook doesn't get stuck on the Lobby when the host taps Start cooking. (Caught during the first TestFlight test.)
- App is live on TestFlight as build #7+ at <https://appstoreconnect.apple.com/apps/6769146551/testflight/ios>.

---

## 10. Open questions / future considerations

- **Cost:** Claude API costs money per parse and per chat message. With prompt caching and Haiku for chat, a full cooking session is probably under 50 cents. Worth tracking in v1 just to know.
- **Photo quality:** if a recipe photo is blurry or low contrast, parsing quality drops. We should show the parsed result for review (already in design) so the main cook can fix mistakes.
- **Inappropriate use:** "Ask Claude" is open chat — someone could use it for non-cooking things. We can add a system prompt instruction to stay on-topic if it becomes an issue, but probably overkill for friends-only v1.
- **What if Claude misreads a recipe badly?** Main cook can edit anything during review. If it's hopeless, they can re-import or type the recipe by hand (we should make sure manual entry is possible from the Review screen).

---

## 11. v2 — commercial foundation (the active roadmap)

**Decided 2026-06-20:** CookCrew is going commercial. Model = **freemium** (free tier with a monthly cap on Claude-backed actions, paid unlock for unlimited). Launch = **iOS-first, polished** (build the full foundation incl. multi-recipe before going public; validate willingness-to-pay on iOS before investing in Android). See decision log §12 (2026-06-20).

Going commercial makes three things non-negotiable that the friends-only v1 skipped. They outrank the feature work:

- **Cost & abuse control.** v1 edge functions are unauthenticated — any client can run Opus parses + Haiku chat against our Anthropic key. Public, that's unbounded spend exposure. Must gate behind auth + per-user rate limits + a hard spend cap before launch. (Freemium metering doubles as this control.)
- **Security & privacy hardening.** v1 trust model is "friends won't sabotage you": public `recipe-uploads` bucket, `device_id` impersonation, trust-assuming RLS. Commercial requires private bucket + signed URLs, real identity, tighter RLS. (Several decision-log rows already flag these as "harden when we add auth.")
- **Legal / App Store.** Privacy policy + data-handling disclosures; **Apple mandates in-app account deletion** once accounts exist; charging = In-App Purchase.

### Build sequence (phases 8–13, each unblocks the next)

8. **Accounts.** Sign in with Apple via Supabase Auth + account deletion. Nuance: only the **host** (who consumes Claude parses) needs an account; guests joining a kitchen stay name-only, preserving the "tap a code and you're in" flow.
9. **Cost/abuse + metering.** Auth-gate every edge function (reverses the v1 `--no-verify-jwt` stance — real Supabase Auth gives real JWTs to verify), per-user usage counters + rate limits, private storage bucket + signed URLs, hard Anthropic spend cap/alerts.
10. **Freemium paywall.** RevenueCat + Apple IAP; free-tier limits enforced server-side via Phase 9 metering; paywall UI; privacy policy + terms.
11. **Recipe history / saved recipes.** Per-user saved recipes + re-cook flow (rides on accounts).
12. **Multi-recipe kitchens** (cooking 2+ dishes in one kitchen). Schema (kitchen → many recipes), provider, both realtime channels, and a recipe-switcher UI. Biggest *feature* rebuild; sequenced after the money/safety layer.
13. **Small wins (batch).** Rejoin-last-kitchen on launch; recipe scaling ("double it" — likely a Claude rescale round-trip since quantities are free-text); timer integration; iOS Share Extension (separate iOS target, requires `eas build`, not OTA-able).

### Operational prerequisites (not features, but block Phase 10)

The stack currently runs on **Florian's dad's accounts**. Before charging money:
- Apple Developer account in Nick's name (or an LLC) — App Store sales land in the account holder's bank.
- Supabase **paid** plan under Nick's own org (free tier won't carry paying users; don't put production billing on someone else's account).
- Nick's own Anthropic account with billing + spend caps.

## 11a. Phase 8 detail — Accounts (spec locked 2026-06-20)

**Progress (2026-06-20): Track B (code foundation, no Apple) DONE + on `main`, not yet OTA'd — rides the Apple rebuild.** Migration applied (`cooks.user_id`, `kitchens.owner_user_id`); `create-kitchen` stamps the account when a host token is present (anon still works, verified); `delete-account` deployed; client has the SecureStore-backed auth session, `AuthProvider`/`useAuth`, auth-aware `api.invoke`, and a Settings screen. **Remaining (Track A + rebuild):** Apple Developer + Supabase dashboard config, install `expo-apple-authentication`, implement `signInWithApple`, gate create on sign-in, `eas build` + TestFlight.

**Goal:** add real accounts for the **head chef only**; guests keep joining by code with a name. Establishes the durable identity that freemium metering (Phase 9) and history (Phase 11) build on. Scope is identity *only* — no rate limiting, metering, quota, or private-bucket work (those are Phase 9).

**Identity model after Phase 8:**
- Head chef (creates a kitchen) = Supabase Auth user (Sign in with Apple) **+** their `cooks` row. Must be signed in to create.
- Guest (joins by code) = `device_id` only, unchanged. No sign-in. `device_id` stays as the guest mechanism; auth is layered on top for hosts.
- Rationale: the host consumes the Claude spend (parsing) and is who we'll bill; guests cost ~nothing, so signup for them is pure friction. Side benefits: host can rejoin from any device, and we get a durable owner for history.

**Why only host needs auth (and guest reads stay anonymous):** guests have no JWT, so realtime reads must remain anon-readable. This is intentional and unchanged from v1 — the join-by-code flow is the product's magic. Full RLS hardening (Phase 9) tightens *host* paths; guest reads stay code-gated by design.

**Schema (one migration):**
- `cooks.user_id uuid references auth.users(id)` — nullable; set for hosts, null for guests.
- `kitchens.owner_user_id uuid references auth.users(id)` — nullable; the durable owner that "my kitchens"/history (Phase 11) keys off.
- RLS: keep guest read access open; add policies for an authenticated user to see/manage their own `owner_user_id` rows. Only what accounts need — full hardening is Phase 9.

**Edge functions:**
- `create-kitchen` now requires the host signed in: client sends the user access token, function verifies via `admin.auth.getUser(token)` (manual verification inside the function for consistent generic errors, matching the existing in-function security pattern), then stamps `kitchens.owner_user_id` + `cooks.user_id`. **First function to verify a real JWT** — begins reversing the v1 `--no-verify-jwt` stance (decision log 2026-06-20).
- `join-kitchen` / `leave-kitchen` / others: unchanged (guests stay anonymous).
- New `delete-account` (see below).

**Client:**
- `supabase.ts`: enable auth (`persistSession: true`, `autoRefreshToken: true`) with a **SecureStore (Keychain) storage adapter** for tokens (CLAUDE.md mandate).
- `expo-apple-authentication` native module → **forces a fresh `eas build` + TestFlight (not OTA-able)**. First non-OTA ship since launch.
- New `AuthProvider` holding the session, alongside `KitchenProvider`.
- Landing: "I'm cooking" checks for a session → if none, Sign in with Apple → then create. "I'm joining" untouched.
- Minimal Settings/Profile screen (reached from the Landing footer where the version label sits): who you're signed in as, Sign out, **Delete account**.

**Account deletion (Apple-mandated):** `delete-account` verifies the user, deletes the `auth.users` record, and **unlinks** their kitchens (`owner_user_id → null`, kitchen + recipe data preserved) — NOT a hard delete. Full "erase all my data" semantics deferred to Phase 11 when history makes "their data" a real surface (decision 2026-06-20). **Mid-cook guard:** if the user is in an active kitchen when they tap Delete account, block with a confirm ("You're in an active kitchen. End it first?") rather than yanking the session out from under co-cooks.

**Decisions locked 2026-06-20:** (1) account deletion *unlinks* past kitchens, doesn't delete them — invisible to users until Phase 11. (2) Existing anonymous TestFlight kitchens are **not migrated** — throwaway test data; new model applies going forward.

**Dashboard prerequisites (Nick/Florian, not code):** Apple Developer console — enable Sign in with Apple capability, create a Services ID + key, download the `.p8`. Supabase dashboard — enable Apple auth provider, paste the Apple credentials. Code can't be tested until these are done.

**Done =** a TestFlight build where: creating a kitchen requires Sign in with Apple; the session survives a force-quit; join-by-code still works name-only; deleting your account from Settings actually removes the auth user and unlinks kitchens.

## 11b. v3 — reach & scale (deferred past commercial launch)

1. **Android release.** Expo is already cross-platform; the work is testing + Play Store setup + re-homing iOS-only native bits (share extension). Fast-follow once iOS conversion is proven.
2. **Push notifications** (delegated tasks via real iOS notifications; in-app banners cover live cooking for now).
3. **Disconnect detection + sous-chef auto-promotion.** Trimmed from v1 Phase 6 — see decision log 2026-05-12. Needs client heartbeat (cooks update `last_seen_at` every ~15s) + a `claim-host` edge function any cook can call: it double-checks `head chef.last_seen_at` is stale, then atomically swaps `main_cook_id ← sous_chef_id` and clears `sous_chef_id`. UI flips on the realtime UPDATE.
4. **Video recipe parsing** (TikTok/Reels) — niche + technically heavy (transcript/frames).

---

## 12. Design decisions (decision log)

Architectural and visual decisions, with what was considered and why we picked. Edit a row when a decision changes — don't add a new one.

| Date | Decision | Alternatives | Why we picked |
|---|---|---|---|
| 2026-05-06 | **Room code is 6 characters** (uppercase, ambiguous letters I/O/Q/L/U and digits 0/1 excluded) | Prototype offered 4 chars to make typing fast | Smaller ambiguity space at 6 chars; 4 chars × 30 alphabet = ~810k combos and would collide as the user base grows. |
| 2026-05-06 | **Geist** is the only typeface (display + body + mono) | WIREFRAMES had originally specified Fraunces/DM Serif Display + Inter/Nunito Sans | Geist reads cleaner on small screens and the prototype landed there during exploration. Loaded via `@expo-google-fonts/geist` + `@expo-google-fonts/geist-mono` at app start. |
| 2026-05-06 | **Primary buttons are filled `ink` (#1F1B16); terracotta (#C2532A) is reserved for accents** (host indicator, links, dashed "claim" chips) | WIREFRAMES had originally specified filled terracotta for primary | Filled-ink primaries feel more premium and let terracotta read as truly accent — used sparingly, it pops. |
| 2026-05-06 | **Avatar color palette is 10 distinct earth-tones** | Prototype had 4 colors (cookA–cookD); kitchens cap at 10 cooks | At 10 cooks, repeats would cause visual collisions in the avatar stack and grid. The 10 colors live in `src/theme/colors.ts` as `cookPalette`. |
| 2026-05-06 | **"Done?" button stays top-right of the Cook tab** | Considered moving to Mine tab footer or long-press on kitchen name (handoff §9 flagged accidental-tap risk) | Discoverability beats safety here — wrap-up needs to be one tap from the main view. We can revisit if accidental-tap reports come in during testing. |
| 2026-05-06 | **Phase 1 split into 1a (UI only) and 1b (backend wiring)** | Build the full Phase 1 in one chunk | Lets us see and react to the visual end of Phase 1 (which depends entirely on resolved tokens) before introducing Supabase, schema migrations, RLS policies, and a realtime channel — each of which has its own failure modes. |
| 2026-05-06 | **People sheet uses built-in `Modal` (not `@gorhom/bottom-sheet`)** | A dedicated bottom-sheet library with drag-to-dismiss and snap points | Modal with `animationType="slide"` is good enough for v1 and avoids pulling in `react-native-reanimated` + `react-native-gesture-handler`. Can swap later if we need real drag gestures. |
| 2026-05-06 | **Identity in v1 = locally-generated `device_id`, no auth.** Anyone in possession of a device_id (and the kitchen code) can impersonate that cook server-side. | Sign in with Apple, magic-link email, anonymous Supabase Auth | Friends-only kitchens with no money or sensitive data. Adding auth is significant scope and was deferred to v2 (DESIGN.md §2). The `device_id` is generated once per install and stored in the iOS Keychain via `expo-secure-store` — not perfect, but matches the threat model of "your friends won't sabotage you." |
| 2026-05-07 | **Edge functions deployed with `--no-verify-jwt`.** Functions are publicly callable; no Authorization header required. | Have the gateway verify the publishable key as a JWT (default mode) | The new Supabase `sb_publishable_*` / `sb_secret_*` key format isn't a JWT, and the edge function gateway rejects it as `UNAUTHORIZED_INVALID_JWT_FORMAT` even though it's the correct key. Skipping the gateway-level check is fine because each function still validates inputs and the `device_id` carries the membership claim. |
| 2026-05-07 | **`service_role` needs explicit `GRANT` on new tables.** Migrations must include `grant all on <table> to service_role;`. | Rely on default Supabase grants | New Supabase projects on the new key format don't auto-grant `service_role` on user-created tables. Without the explicit GRANT, edge functions get `permission denied for table` even though they authenticate correctly. Codified in `supabase/migrations/20260507050706_grant_service_role.sql`. |
| 2026-05-07 | **`react-native-get-random-values` is required for `device_id` generation.** Imported at the top of `App.tsx` and `src/lib/supabase.ts`. Also required for the file-upload helper (`crypto.randomUUID` is *not* polyfilled — only `crypto.getRandomValues` is — so `src/lib/uploads.ts` builds a hex random string from `getRandomValues` directly instead of calling `randomUUID()`). | Use `expo-crypto` or a non-random fallback | `crypto.getRandomValues` isn't shipped in React Native by default; without the polyfill, `getOrCreateDeviceId()` throws and falls back to a session-only id, which would reset every app launch and break the cook's identity across restarts. |
| 2026-05-07 | **`parse-recipe` sends the photo/PDF to Claude via the Storage bucket's public URL** (not base64, not via the Files API). | Upload as base64 in the Messages API call; or upload to the Files API and reference by `file_id`. | The bucket is already public for v1 (knowing-the-kitchen-UUID is the credential), so the URL is reachable from Claude's vision endpoint. Base64 inflates request size 33% and makes us pre-download the file in the edge function. Files API is beta and adds a header dance. Public URL is shortest path. If we ever flip the bucket private (v2 with auth), switch to Files API with signed URLs. |
| 2026-05-07 | **`parse-recipe` uses Claude Opus 4.7 + structured outputs (`output_config.format` + JSON schema) + prompt caching on the system prompt.** | Free-form output then JSON parse; or tool-use with a single "save_recipe" tool; or Claude Sonnet for cost. | Structured outputs guarantee valid JSON without retry loops — a real failure mode of free-form-then-parse. Opus over Sonnet because parsing-from-image quality matters and a parse runs at most once per kitchen. Prompt caching makes the ~1.5K-token system prompt nearly free across kitchens. |
| 2026-05-07 | **All recipe edits flow through one `update-recipe` edge function with a discriminated `action` field.** Actions: `set_title`, `add/update/delete_ingredient`, `add/update/delete_task`, `move_task`, `start_cooking`. | Separate endpoints per action. | One function = shared auth check, one deploy, one place for the recipe-membership lookup. The discriminator gives us static-typing in the client via `RecipeAction` and a single `applyResult` re-sync path in the screen. Adding a new action is just another `case` arm. |
| 2026-05-07 | **Recipe Storage bucket (`recipe-uploads`) is public.** Path convention: `<kitchen_id>/<random_hex>.<ext>`. | Private bucket with signed URLs. | Mirrors the v1 trust model already documented above (knowing the kitchen UUID = membership). Photos of recipe pages aren't sensitive in friends-only context. Switching to private + signed URLs is a v2 hardening step. |
| 2026-05-07 | **Recipe Review uses drag-and-drop with optimistic UI for reordering steps; cross-section moves supported.** | Up/down arrow buttons (tried, felt laggy due to server roundtrip on every tap); drag within section only with a separate "move to section" picker. | Drag is the natural gesture and one motion handles both within-section and cross-section. Optimistic UI (apply locally first, server-persist in background, revert on error) makes drops feel instant. Built on `react-native-draggable-flatlist` + `react-native-gesture-handler` + `react-native-reanimated@4` (the worklets-plugin variant — `react-native-worklets/plugin` in `babel.config.js`). The drag-handle icon is on the right; long-press anywhere on the row also triggers drag. |
| 2026-05-07 | **`crypto.randomUUID` is NOT polyfilled by `react-native-get-random-values`.** Only `crypto.getRandomValues` is. | Add `uuid` package; or assume randomUUID works | Surface area of the polyfill matters — burned us once when `lib/uploads.ts` called `randomUUID` for filenames. Pattern: build random hex strings from `getRandomValues` directly when you need a unique identifier. |
| 2026-05-07 | **Setting Supabase secrets (e.g. `ANTHROPIC_API_KEY`) requires Owner or Administrator role on the org.** | Developer-level access | Tested it; Developer returns "Your account does not have the necessary privileges to access this endpoint." If a dev needs to set secrets, the org owner has to bump them. Document so we don't relearn. |
| 2026-05-07 | **Recipe state is hoisted into `KitchenProvider` at Start cooking time, not at parse time.** RecipeReview keeps its own local copy while editing; once the host taps Start cooking, the result is handed to the provider via `setRecipe` and lives there for the rest of the session. | Hoist on parse (provider also owns review state); or keep recipe state local to Cooking screen with its own fetch. | Review-screen edits are host-only and local in nature, so putting them in the provider would force unnecessary re-renders for non-hosts and complicate the editing UX. Hoisting at Start cooking is the natural seam — that's exactly when the recipe becomes shared state. The provider also pre-populates from the start_cooking response so the Cooking screen renders immediately, no realtime-tick delay. |
| 2026-05-07 | **Two realtime channels per device: `kitchen:<id>` (cooks, kitchens, recipes) and `recipe:<id>` (tasks, ingredients).** Each table is on exactly one channel. | One mega-channel for everything; or one channel per table. | The realtime filter syntax only supports `column=eq.value`, and the recipe-scoped tables filter by `recipe_id` which isn't known until the recipe is loaded. Splitting along that boundary lets each channel use a stable filter and lets us tear down + re-subscribe when recipe.id changes without disturbing the cook/kitchen subscription. The "no double-subscribe to the same table" rule still holds — each table has exactly one subscription. |
| 2026-05-07 | **`toggle-checkbox` is a single edge function with `kind: 'task' \| 'ingredient'`.** Mirrors the `update-recipe` discriminated-action pattern. Kitchen-membership gated, not host-only. | Two separate functions (`toggle-task`, `toggle-ingredient`); or fold into `update-recipe`. | One function = shared auth check, one deploy, less duplication. Folding into `update-recipe` would mix host-only (recipe edits) with anyone-in-kitchen (check-offs) auth rules in one place — cleaner to keep them separate. The discriminator is small and the action surface is narrow, so a discriminated union beats two near-identical files. |
| 2026-05-07 | **Optimistic check-off updates with revert-on-error, not server-confirm-then-update.** Tap → flip locally → fire request → on error, revert and alert. | Wait for server confirmation before flipping the UI. | Per DESIGN.md §8 — checkboxes are the most-used component and need to feel snappy. Server roundtrip is ~150–300ms, which reads as laggy. Realtime UPDATE confirms the server-authoritative state shortly after. Race conditions between optimistic local state and incoming realtime are bounded by "last write wins" — acceptable for v1's friends-only context. |
| 2026-05-07 | **`replica identity full` on `cooks` / `tasks` / `ingredients` / `recipes`.** Migration `20260507224036_replica_identity_full.sql`. | Default `replica identity default` (PK only on DELETE). | Postgres logical replication only includes the primary key in DELETE payloads by default. Supabase realtime filters like `kitchen_id=eq.<id>` evaluate against the payload — and silently drop the event if the filter column isn't there. Symptom we hit: a cook who left was still showing up in the host's cook list because the DELETE never reached the host's subscription. `replica identity full` makes Postgres include every column in DELETEs at a small write-amplification cost, which is fine at our scale. |
| 2026-05-11 | **Delegation tap target = the assignee chip itself, not a separate action sheet.** Tap checkbox = toggle (unchanged). Tap right-side chip = assign / take. Host gets a picker sheet (`AssignSheet`); non-host gets instant claim-self when the chip reads "+ take". | WIREFRAMES Screen 5's action-sheet pattern (Check / Take / Delegate as menu items); or a separate persistent delegate icon next to the chip. | The action-sheet pattern would have cost us the snappy single-tap toggle the rest of the app relies on, and forced two taps for every check. A persistent icon would clutter every row. Repurposing the chip as both display and tap target keeps rows visually quiet, makes delegation discoverable, and preserves the toggle. Action sheet becomes available for Phase 6 (Edit / Delete during cooking) if/when those land. |
| 2026-05-11 | **Non-host cooks can take an unassigned task/ingredient but cannot give it back, reassign, or unassign.** Only the host can modify existing assignments. | Allow non-host self-unassign ("give it back"); allow non-host reassign to anyone. | The "give it back" loop felt awkward in design review — once you've claimed something you should commit, and the host stays the single source of truth for who is doing what. Cuts UI complexity on the non-host side: the chip is non-interactive once a row is assigned. Edge function enforces it server-side (`assignTo === caller.id && row.assigned_to === null` is the only path for non-hosts). |
| 2026-05-11 | **`assign-checkbox` is a separate edge function from `update-recipe`, mirroring the `toggle-checkbox` shape.** Discriminated body: `{ kind: 'task'\|'ingredient', id, assignTo: string\|null }`. | Fold into `update-recipe` as new actions; or two functions (`assign-task`, `assign-ingredient`). | `update-recipe` is host-only (review-phase recipe edits). Assign is partially open to non-hosts (take-self only), so the auth model is different. Keeping the function separated keeps the auth check simple in each place. The discriminator on kind avoids two near-identical files. Same pattern we'd already established for `toggle-checkbox`. |
| 2026-05-11 | **`assigned_by` column on `tasks` + `ingredients`.** Migration `20260508065049_assigned_by.sql`. Set whenever `assigned_to` is non-null; cleared when unassigned. | Skip attribution; banner reads "You got assigned: …" with no name. | Banner reads much better with attribution ("Florian gave you: chop the carrots") and confirms intent — the recipient knows whose request this is, especially useful with larger crews. One column is cheap. The assign-checkbox function sets `assigned_by = caller.id` on every assign and nulls it on unassign. |
| 2026-05-11 | **Optimistic mutations don't apply the POST response; they trust local state + realtime.** Rows have a `pendingCount` ref; while count > 0 the realtime UPDATE handler skips that row. Decrement runs on an 800ms delay to absorb late echoes. Errors revert to the pre-optimistic value. | Apply POST response to state (which is what we did originally). | Two sources of stale-write flicker on rapid tap-tap-tap: (1) POST 1's response carrying the older row state arriving after POST 2's response, (2) realtime UPDATE-1 echo arriving 200-400ms after POST 1's HTTP response and clobbering the fresher optimistic. Trusting local optimistic + filtered realtime eliminates both: the server is authoritative across users via realtime *after* the pending window, and within the pending window the local optimistic is canonical. The 800ms delay is a tuned-by-feel window — enough to absorb echoes, short enough that subsequent updates from other cooks don't feel laggy. |
| 2026-05-11 | **`DelegationBanner` uses `useSafeAreaInsets()` to offset itself by `insets.top`.** | Position banner at `top: 0` inside the `SafeAreaView`. | Absolute children of `SafeAreaView` don't respect the padding the safe-area context applies — Yoga (like CSS) positions absolute children relative to the padding-box edge (i.e., at the outer border of the padding, not the content edge). Result: `top: 0` sat behind the iPhone dynamic island. Applying `top: insets.top` directly puts the banner where it should sit. |
| 2026-05-11 | **Ask Claude is non-streaming for v1.** Edge function does a full Anthropic call, persists both rows, then returns; the client sees the answer pop in after a "Thinking…" indicator. | Stream the response via SSE so the bubble fills in token by token (closer to the WIREFRAMES "streams response" wording). | React Native's stock `fetch()` doesn't expose response.body as a readable stream the way browsers do, so streaming would mean a polyfill or a custom event reader. Haiku 4.5 returns full answers in ~1–2s for cooking questions, which is short enough that a spinner reads as "fast" rather than "frozen". The added complexity for a sub-second perceived gain wasn't worth it in v1. Revisit in Phase 7 polish if real-world testing makes 2s feel laggy. |
| 2026-05-11 | **`ask-claude` is its own edge function, not folded into `update-recipe` or another action.** Auth: any kitchen member. Persists user + assistant rows in `chat_messages` so realtime can deliver them to every cook. | Add a `chat` action to an existing function; or call Anthropic from the client (with an embedded key); or use Anthropic's hosted prompt-management UI. | Same v1 trust pattern as the other functions — the API key stays in the edge function's env, never in the client bundle. Separate function = simple auth check (kitchen membership) and one place to evolve prompt + caching strategy. The shared chat thread maps cleanly to a table because realtime then broadcasts answers to every cook in the kitchen, which matches the "everyone in the kitchen sees the answers" UX in WIREFRAMES Screen 8. |
| 2026-05-11 | **Persona is a cacheable system block; recipe context is a second uncached block.** Caching only kicks in for prompts ≥4096 tokens on Haiku, but the cache hint is cheap and pays off whenever a long persona + recipe combo hits the threshold. | Put the recipe inside the cacheable block (more cache hits across turns in the same kitchen); or skip caching entirely. | Recipe is uncached because it changes during cooking — tasks get checked off, ingredients get checked off, the system prompt embeds those states. Re-caching every time would defeat the purpose. Persona is static across every call so it's safe to cache forever. |
| 2026-05-11 | **When the user turns off recipe context, also drop chat history before the new question.** | Always include the last N messages of history regardless. | Chat history in a recipe-grounded thread contains Claude's earlier answers that referenced the recipe. Feeding that history back when context is off would smuggle the recipe in through the side door — exactly what the toggle is meant to prevent. Dropping history when the toggle is off makes the toggle do what its label promises. |
| 2026-05-11 | **The Ask tab's "current step" is the first uncompleted task in recipe order, not the last task the user tapped.** The chip above the composer reads "You're on: …" (not "Asking about: …") and the persona explicitly tells Claude not to over-anchor on it. | Track the last-tapped task via a ref and pass that as context. | Tapping a task usually means *completing* it, so "last tapped" almost always points at a step the user just finished — wrong direction for context. Auto-deriving the next uncompleted task points at what they're about to do, which is what they're more likely to be asking about. The chip label and persona wording both make it clear the user can ask about any step, not just the one shown. |
| 2026-05-11 | **When context is off and the user asks a recipe-specific question, Claude names the toggle by its UI label** ("Turn on 'Include recipe context' below the message box…") rather than saying "I don't have a recipe loaded yet". | Always say "I don't have a recipe loaded." | The literal answer was technically correct but confusing — users who didn't realize they had a toggle would think the app was broken. Naming the toggle in the answer turns the confusion into a self-serve fix. Only kicks in for recipe-specific questions; generic cooking questions (substitutions, technique) are still answered without any toggle nag. |
| 2026-05-12 | **Disconnect detection + sous-chef auto-promotion deferred to v2.** Phase 6 ships sous chef as a manual appointment with delegate powers, but no heartbeat-based takeover. | Build heartbeat + `claim-host` edge function in v1 (the original DESIGN.md §6 plan). | Disconnect handling is the hardest piece of v1 to get right and the hardest to test (requires deliberately killing one client and waiting). The failure mode without it — recipe locked if the head chef drops — is annoying but recoverable: someone leaves and rejoins. Better to ship the manual sous chef with its delegate powers now, watch real cookouts, and revisit if it bites us. |
| 2026-05-12 | **Sous chef = head chef minus recipe edits.** Auth model: `canManage = isHost \|\| isSousChef` gates delegation (assign-checkbox). Recipe edits (update-recipe), end-kitchen, and appoint-sous-chef stay head-chef-only. | Sous chef is purely cosmetic until v2 ships disconnect-detection (chef-hat badge with no actual power); or sous chef = full head-chef equivalent. | Cosmetic-only made the appointment feel pointless. Full equivalence creates "two cooks editing the recipe at once" races. Splitting on delegation vs. recipe-editing matches the real-world kitchen metaphor — sous chef directs the line, head chef owns the menu — and the implementation cost is one line in the edge function plus an `isSousChef` flag in the provider. |
| 2026-05-12 | **"Host" renamed to "head chef" everywhere user-facing.** Internal type names (`isHost`, `main_cook_id`, etc.) stay as-is to avoid a sprawling rename. | Keep "host" as the user-facing label. | The app's kitchen metaphor is already thick (cooks, recipes, sous chef, etc.), so "host" felt borrowed from a different app genre. "Head chef" sits naturally next to "sous chef" and reinforces the metaphor. Internal identifiers stay on `host`/`main_cook_id` because changing them would churn ~30 files for zero user-visible benefit. |
| 2026-05-12 | **Head chef tile = `colors.ink` border; sous chef tile = `colors.steelSoft` border.** The chef-hat mini-badge on the sous chef avatar stays `colors.steel` for contrast against the pale tile border. | Use the terracotta accent for the sous chef border (what we shipped initially); use `colors.steel` (the dark variant) for both badge and border. | The first pass painted the sous chef border in the brand accent (`#C2532A` terracotta), which reads as a warning. The second pass with dark `steel` made the head chef (`ink`) and sous chef (`steel`) hard to tell apart — both dark. Landing on dark ink for head chef and pale `steelSoft` for sous chef gives clear visual separation while keeping terracotta reserved for warnings/CTAs as called for in WIREFRAMES §1. |
| 2026-05-12 | **Live recipe editing during cooking uses the same `update-recipe` actions as Review.** Provider exposes `dispatchRecipe(action)` which applies the response to provider state immediately. | Build separate "live-edit" actions; or only allow live-edit via realtime (no provider state mirror). | The Review-phase actions (`add_task`, `update_task`, `delete_task`, `move_task`, `add_section`, etc.) work just as well during cooking — no separate codepath needed. Applying the response to provider state gives the head chef instant feedback; realtime delivers the same changes to other cooks moments later. Idempotent: the realtime echo arrives, the row already matches, no flicker. |
| 2026-05-13 | **EAS authenticates Apple via an App Store Connect API Key, not via Apple ID + password on every build.** Apple ID login is needed once to generate the distribution certificate + provisioning profile; after that, EAS reuses the cached cert and the API key handles all submits. The `.p8` is the source of truth in 1Password; the key ID (`FHK8XRW28C`), issuer ID (`4fb78979-3b32-4d3c-9aff-0cd645f07eed`), and `ascAppId` (`6769146551`) live in `eas.json`. | Apple ID + 2FA on every build (the EAS default); or `EXPO_APPLE_APP_SPECIFIC_PASSWORD` env var. | Florian (Account Holder) being in the loop for every build doesn't scale and creates a coordination tax. App-specific passwords still require a human session and expire. The API key is stable, scoped to App Manager, stored once on EAS's servers, and gives Nick fully-automated `eas build` + `eas submit`. Apple's role model is also annoyingly bifurcated — "Developer" role in App Store Connect doesn't grant distribution-cert generation; we had to bump Nick to "App Manager" before this would work at all. |
| 2026-05-13 | **OTA updates use `runtimeVersion: { policy: "appVersion" }`.** Updates only target builds with the same `version` in `app.json`. | Specific runtimeVersion string per build; or `policy: "fingerprint"` (which hashes native deps). | `appVersion` matches the mental model "this OTA fix is for the 1.0.x line" — when we bump to 1.1.0 for a native-deps change, OTA updates stop reaching the older builds automatically. `fingerprint` is more precise but regenerates a hash on every native-dependency change, which is more bookkeeping than v1 needs and surprised us in early experiments. The trade is that you have to remember to bump `version` when shipping a native change; we'll wire a check into the release flow when it becomes a real risk. |
| 2026-05-14 | **`KitchenProvider` refetches recipe + cooks via REST when `AppState` transitions to `'active'`.** Implemented in the `AppState.addEventListener('change', ...)` hook in `KitchenProvider.tsx`. | Trust realtime to deliver every event; or wire reconnect callbacks on the Supabase channels themselves. | iOS aggressively tears down WebSocket connections when an app backgrounds — especially on cellular. Supabase realtime doesn't backfill missed events on reconnect, so a cook who backgrounded their phone right when the host tapped "Start cooking" would miss the `recipes` UPDATE and stay stuck on the Lobby forever. (Real bug we caught the moment the first TestFlight build hit Florian's phone.) Refetching on foreground is the smallest patch that covers the broadest class of "we missed an event" scenarios — works for backgrounding, brief network loss, and channel reconnects alike. Rule of thumb: any time a screen transition is gated on a realtime event, also refetch on AppState foreground. |
| 2026-06-16 | **`parse-recipe` accepts `sourceType: 'text'` with an inline `text` field** (up to 20k chars) as a fourth import path. Discriminated input: `{ sourcePath, sourceType: 'photo'\|'pdf' }` OR `{ text, sourceType: 'text' }`. Storage roundtrip is skipped for the text path. System prompt and error copy generalized from "image or PDF" to cover all three sources. | A separate `parse-recipe-text` edge function; or upload the text as a `.txt` to Storage and reuse the existing `sourcePath` path. | Real users had recipes in Apple Notes / emails / web pages they'd already copied — making them screenshot to use the photo path was silly when Claude can read text directly. A single function with a discriminated source type keeps auth + persistence + DB writes in one place; only the "what gets sent to Claude" branch changes. Skipping Storage avoids round-trip latency that adds nothing for text. |
| 2026-06-16 | **Invite UX consolidated to one card on the Lobby** ("Invite friends" with the code + "Copy code" / "Send by text" buttons side-by-side). PeopleSheet's "+ invite more" tile was removed. | Keep the dual-path (Lobby Copy button + PeopleSheet Share Sheet); or keep PeopleSheet as a separate "invite more" entry point. | Two paths for the same job felt inconsistent — neither felt like THE place to invite. Putting both actions visibly on the Lobby card makes the choice explicit (copy vs. send) and frees PeopleSheet to focus on its actual job (who's in the kitchen, sous chef appointment, end/leave). |
| 2026-06-18 | **OTA-capable iOS builds need a `channel` name in `eas.json`'s build profile** in addition to `expo-updates`, `runtimeVersion`, and `updates.url`. Production builds set `"channel": "production"`. A matching channel must also exist on the EAS dashboard (`eas channel:create production`) linked to the `production` branch. | Trust Expo's default channel routing (which we did initially); use a fingerprint-based runtime version that auto-routes. | First OTA after enabling `eas update` published successfully to the `production` branch but never reached the running TestFlight build — `expo-updates` queries EAS using the channel header baked into the build, and our build profile had no channel set. Symptom was confusing: `eas update` reported success, but the device never changed. Cost us a full rebuild + TestFlight resubmit cycle (build #7 → #8) before the OTA pipeline was usable. Now load-bearing across all future updates. Pattern documented in CLAUDE.md's Expo/EAS section. |
| 2026-06-20 | **CookCrew is going commercial.** v1 (friends-only, anonymous, shipped to TestFlight) is the historical baseline; v2 becomes the "commercial foundation" (§11). | Stay a free friends-only app; or open-source it. | Nick decided to take it to market. This reorders the whole roadmap: features stop being the priority and three table-stakes layers move to the top — cost/abuse control, security/privacy hardening, and legal/monetization. Several v1 "trust model" decisions (public bucket, `--no-verify-jwt`, `device_id` identity) were explicitly logged as "fine for friends, harden when commercial" — that time is now. |
| 2026-06-20 | **Monetization model = freemium** (free monthly cap on Claude-backed actions; paid unlock for unlimited). Enforced server-side via per-user usage metering. | Subscription-only; one-time purchase; ad-supported. | Freemium lets people try before paying and the per-user metering it requires *is* the cost/abuse control we need anyway (one mechanism, two jobs). One-time purchase was rejected — a flat fee doesn't cover the ongoing per-parse Claude cost for heavy users (margin risk). Billing via Apple IAP, likely through RevenueCat to keep receipt-validation off our backend. |
| 2026-06-20 | **Commercial launch is iOS-first and polished, not a lean MVP.** Build the full v2 foundation (incl. multi-recipe + small wins) before going public; Android is a v3 fast-follow. | Lean MVP (ship paywall + accounts only, validate willingness-to-pay, defer multi-recipe); or simultaneous iOS+Android launch. | Nick wants a strong first impression over a fast probe. Validate willingness-to-pay on one polished platform before paying the Android tax (testing + Play Store + re-homing iOS-only native bits). Multi-recipe is Nick's stated must-have, so it's in the v2 cut despite being the biggest feature rebuild — sequenced after the money/safety layer. |
| 2026-06-20 | **Going commercial reverses the v1 `--no-verify-jwt` stance (planned, Phase 9).** With real Supabase Auth (Sign in with Apple), edge functions can verify real JWTs again. | Keep functions open and rely solely on in-function `device_id` membership checks. | The `--no-verify-jwt` decision (2026-05-07) was forced by the non-JWT publishable-key format AND was acceptable only under the friends-only trust model. Real auth gives us real bearer tokens to verify at the gateway, closing the "anyone can call our Claude-backed functions" hole that's a hard launch-blocker commercially. This is planned work, not yet implemented — flagged here so the original row isn't read as still-current intent. |

For visual tokens (colors, typography, spacing, radii) the canonical source is `src/theme/`. WIREFRAMES.md §1 reflects the same values; if the two ever drift, treat `src/theme/` as authoritative for what ships and update WIREFRAMES.md to match.

---

## 13. Glossary (for first-time-builder Florian)

- **React Native:** framework for writing iOS + Android apps in JavaScript/TypeScript instead of Swift/Kotlin
- **Expo:** a layer on top of React Native that handles a lot of native build complexity for you
- **TypeScript:** JavaScript with types — catches typo-style bugs before you run the app
- **Supabase:** hosted Postgres database with extra features (realtime, auth, storage, serverless functions)
- **Edge Function:** small server-side script that runs on Supabase's servers — used here to safely call the Claude API
- **TestFlight:** Apple's official tool for distributing pre-release apps to a small group of testers
- **Realtime / websocket:** a persistent connection between the app and the server, so the server can push updates instantly instead of the app polling
- **RLS (Row Level Security):** database rules that control which rows a given user is allowed to see/modify
- **Optimistic update:** update the UI immediately when the user does something, then sync with the server in the background
- **Prompt caching:** Anthropic feature that lets you re-use part of a long prompt across multiple API calls at a discount
