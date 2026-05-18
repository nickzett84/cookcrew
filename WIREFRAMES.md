# CookCrew — Wireframe Spec

A spec doc for generating CookCrew's v1 wireframes. Designed to be pasted into Claude design, Figma, or any AI design tool, and to also work as a brief for manual design work.

If you're using a tool that takes one screen at a time, copy the **Platform**, **Visual Identity**, and **Universal Patterns** sections at the top, then paste each screen section as a separate prompt.

---

## 0. Platform & sizing — read this first

**This is an iOS (iPhone) app. All screens are vertical mobile layouts. No tablet, no desktop, no responsive web variants in v1.**

- **Target device:** iPhone — design in portrait. No horizontal scrolling.
- **Orientation:** portrait only.
- **Safe areas:** assume iOS notch / Dynamic Island at the top (~50 px) and home-indicator area at the bottom (~30 px). Don't put critical content under those zones.
- **Status bar:** assume the iOS system status bar (time, battery, signal) is visible at the top — design content to start *below* it.
- **Layout approach:** mobile-first stacking. Single column, generous vertical spacing. Buttons full-width with horizontal padding. Lists scroll vertically.
- **Don't generate:** sidebars, multi-column desktop layouts, hover states, or anything mouse-driven. Everything is touch.

If a design tool generates desktop or tablet-sized mockups, that's wrong — re-prompt explicitly with "iPhone, 393×852, portrait."

---

## 1. Visual identity

> **Resolved tokens live in [`cooking-app/src/theme/`](cooking-app/src/theme/).** This section is the spec; if the two ever drift, the theme files are what ships and this section gets updated to match. Decision log: `DESIGN.md` §12.

### Mood
Homey, warm, simple, uncluttered. Like a well-loved kitchen — not a sterile tech app. The exploration in `CookCrew Handoff.md` resolved the look as a **clean modern mid-fi** treatment: no hand-drawn wobble, calm geometric shapes, generous whitespace, terracotta + sage as accents over off-white paper. **Inviting and adult.**

### Color palette
Earth tones over warm off-white. Terracotta is reserved as an *accent* (host indicator, links, dashed "claim" chips) — primary buttons are filled `ink` for a more premium read.

| Token | Use | Hex |
|---|---|---|
| `paper` | App background | `#F7F5F0` |
| `surface` | Cards, sheets | `#EFEBE2` |
| `fill` | Input/card fill | `#E5E0D5` |
| `fillSoft` | Hover / pressed | `#F0EBDF` |
| `ink` | Primary text & primary buttons | `#1F1B16` |
| `inkSoft` | Secondary text | `#5C544A` |
| `inkFaint` | Tertiary / disabled | `#9A9285` |
| `lineSoft` | Subtle dividers | `#D4CDBE` |
| `accent` | Terracotta — host, links, accent CTAs | `#C2532A` |
| `accentSoft` | Terracotta tint backgrounds | `#F0DBCD` |
| `sage` | Success / done / "ok" | `#5A7A4A` |
| `sageSoft` | Sage tint backgrounds | `#D5DDC8` |
| `ochre` | Warning / pending | `#B58233` |
| `steel` | Information / secondary | `#3F5765` |

Avoid: pure white, neon colors, gradients.

### Avatar palette (cooks)
Each cook picks a color at create/join time. The palette is 10 earth-tone variants, distinct enough to read at a glance in the avatar stack and the People grid. Index 0 (warm tan, `#E6CDA8`) is the host's default. Defined in `src/theme/colors.ts` as `cookPalette`.

```
#E6CDA8  #CDD9BE  #E3C7BE  #D2DBE0  #EBD7A0
#D7C0CC  #F0C9B0  #C9D4B6  #D8C8B0  #B5C9C5
```

### Typography
**Geist** for everything (display, body, UI). **Geist Mono** for codes (room code, timestamps). Loaded via `@expo-google-fonts/geist` + `@expo-google-fonts/geist-mono` in `App.tsx`. The font keys exposed to the app are:

| Token | Font family string |
|---|---|
| `display` | `Geist_600SemiBold` |
| `body` | `Geist_400Regular` |
| `bodyMed` | `Geist_500Medium` |
| `mono` | `GeistMono_500Medium` |

Stick to regular / medium / semibold. Avoid bold.

### Iconography
- Rounded line icons, ~1.5 px stroke
- Slightly imperfect feel preferred over geometric perfection
- Recommended: Phosphor Icons (regular weight) or Lucide

### Photography / illustration
None in v1. Keep it text + icons + recipe imagery (user-uploaded). Don't add stock food photos.

### Spacing & corners
- Generous padding (16–24 px around content)
- Rounded corners on everything: 12 px for cards, 16 px for buttons, full pill for tags
- Tap targets minimum 44 × 44 px

---

## 2. Universal patterns

### Top bar (cooking screens only — and the Lobby)
- Left: kitchen name in `display` weight
- Right: small avatars of cooks in the kitchen (circular, first letter of each name on tinted background) — tap to open the People sheet
- Below: 1 px `lineSoft` divider

### Bottom tab bar (cooking screens only)
Four tabs, icon + label, active tab in `ink`.
1. **Cook** — checkmark/list icon
2. **Shop** — shopping basket icon
3. **Mine** — bookmark or person icon
4. **Ask** — sparkle / chat-bubble icon

### Buttons
- **Primary:** filled `ink` (#1F1B16), `paper` text, 16 px rounded, 52 px tall, full-width on key screens
- **Secondary:** outlined `ink` (1 px), `ink` text, same shape
- **Tertiary / inline:** text-only in `accent` (terracotta), no border
- **Sage variant:** filled sage for success-toned actions ("Wrap it up", "Join Sunday Pasta")
- **Disabled:** `fill` background, `inkFaint` text — not pressable

### Inputs
- Cream surface with soft tan border
- 56 px tall
- Label floats above when filled, or sits inside as placeholder when empty
- 12 px rounded corners

### Checkboxes (the most-used component in this app)
- Circular, 24 px diameter
- Unchecked: empty with soft tan border
- Checked: filled sage green with cream checkmark
- Animated subtle "pop" on check
- Strikethrough text on the task/ingredient when checked, with reduced opacity

### Modals & sheets
- Bottom sheets preferred over full-screen modals
- Cream background, drag handle at top
- 16 px rounded top corners

### Toasts / banners
- Slide in from top
- Cream background, terracotta left border (or sage if success)
- Auto-dismiss after ~4 seconds

---

## 3. Screen specs

The flow, in order of when a user encounters each screen.

---

### Screen 1 — Landing

**Purpose:** Entry point. Two choices: start a kitchen, or join one.

**Layout (top to bottom):**
- Logo "CookCrew" in serif, large, centered, ~30% from top of screen
- Subtle tagline below in body font, muted brown: *"Cook together, not alone."*
- Big primary button: **"Create a Kitchen"**
- Big secondary (outlined) button below: **"Join a Kitchen"**
- Small terracotta text link at the bottom: *"How does this work?"* (opens an info sheet)

**Empty/loading/error states:** none — this is the simplest screen.

**Interactions:**
- Create → Screen 2a
- Join → Screen 2b
- How does this work? → bottom sheet with 3 short paragraphs explaining the app

---

### Screen 2a — Create Kitchen (your name)

**Purpose:** Main cook enters their name before kitchen is created.

**Layout:**
- Back arrow top-left
- Heading: *"What should we call you?"* (serif, large)
- Body sub-text: *"This is how others in your kitchen will see you."*
- Single text input, placeholder: *"Your name"*
- Primary button: **"Create Kitchen"** (disabled until name has at least 2 characters)

**States:**
- Default: button disabled, muted
- Name typed: button active terracotta
- Loading after tap: button shows spinner, text becomes *"Creating..."*
- Error (network): inline error below input — *"Couldn't create kitchen. Check your connection and try again."*

**Interactions:**
- Create Kitchen → Screen 3 (Lobby)

---

### Screen 2b — Join Kitchen (code + name)

**Purpose:** A non-main cook enters the room code and their name.

**Layout:**
- Back arrow top-left
- Heading: *"Join a kitchen"* (serif)
- Two inputs stacked:
  1. **"Kitchen code"** — large, 6 character display (think OTP-style boxes if possible, otherwise just a single input with monospace font)
  2. **"Your name"** — standard text input
- Primary button: **"Join"** (disabled until both fields valid)

**States:**
- Wrong code: inline error below code field — *"We can't find that kitchen. Check the code with the host."*
- Kitchen full: *"This kitchen is full (10 cooks max)."*
- Loading: spinner in button

**Interactions:**
- Join → Screen 5 (Cooking View; lands on Cook tab even if no recipe is up yet — show empty state)

---

### Screen 3 — Kitchen Lobby (main cook only, before recipe imported)

**Purpose:** Show the room code prominently and let the main cook see who's joined while they decide what to cook.

**Layout (top to bottom):**
- Top bar with kitchen name placeholder (something like "Your kitchen") and the People avatars (just main cook for now)
- Big section: **Room code** — displayed huge, monospace, with a small "tap to copy" icon next to it
- Helper text below code: *"Share this with your friends so they can join."*
- Section: **"In your kitchen"** — list of cook chips with names and avatars (just main cook initially, fills in real-time as people join)
- Bottom: primary button **"Import a recipe"**
- Secondary text link: *"Type a recipe by hand"*
- Tertiary text link at the very bottom (small, muted brown, with a subtle terracotta tint): *"End this kitchen"*

**States:**
- Solo (just you): cook list shows just you. Helper text under cook list: *"Waiting for friends to join..."*
- Friends joining: real-time animation — new chip slides in with their name

**Interactions:**
- Tap room code → copy to clipboard, show small toast *"Copied!"*
- Import a recipe → Screen 4
- Type a recipe by hand → Screen 4b but blank (skip parsing)
- End this kitchen → confirmation bottom sheet:
  - Heading: *"End this kitchen?"*
  - Body: *"Anyone who joined will be sent back to the start."* (or, if solo: *"You can always start a new one."*)
  - Primary destructive button: **"End kitchen"** (muted brick red)
  - Secondary button: **"Never mind"**
  - On confirm → kitchen marked `ended` in DB, all cooks return to Landing, joined cooks see a brief toast: *"The host ended this kitchen."*

---

### Screen 4 — Recipe Import (main cook only)

**Purpose:** Pick a photo or PDF of the recipe.

**Layout:**
- Back arrow top-left
- Heading: *"What are we cooking?"*
- Three large stacked option cards:
  1. **"Take a photo"** — camera icon, *"Snap your cookbook page"*
  2. **"Choose from photo library"** — image icon, *"Pick a photo you already have"*
  3. **"Upload a PDF"** — doc icon, *"For digital recipes"*
- Smaller text link at bottom: *"Type it out instead"*

**States:**
- During upload: full-screen overlay with sage spinner and text — *"Uploading your recipe..."*
- During Claude parsing: same overlay, text changes — *"Reading the recipe..."* with rotating fun status messages every 3 seconds:
  - *"Checking the ingredients..."*
  - *"Figuring out who does what..."*
  - *"Almost ready..."*
- Parse failure: bottom sheet — *"We had trouble reading that. Try a clearer photo, or type it out."* with retry / type-by-hand buttons.

**Interactions:**
- Each option opens iOS native picker (camera, photo library, files app)
- After successful parse → Screen 4b

---

### Screen 4b — Recipe Review (main cook only)

**Purpose:** Main cook reviews and edits Claude's parsed recipe before going live.

**Layout:**
- Back arrow top-left, "Save changes" auto-applied (no explicit save button)
- Editable recipe **title** at top, large serif, tap to edit
- Section: **"Ingredients"** with a small "+ Add ingredient" button
  - Each row: ingredient name + quantity, tap to edit, swipe-left to delete
- Section: **"Steps"** with sections grouped under their headers
  - Each section header is editable; **"+ Add section"** at the bottom
  - Each task in a section is editable, swipe-left to delete, drag handle to reorder
  - **"+ Add task"** at the end of each section
- Sticky bottom button: **"Looks good — start cooking!"** (primary terracotta)

**States:**
- All edits save automatically (subtle "Saved" toast)
- Empty section: shows a placeholder *"No tasks yet — tap '+' to add one."*

**Interactions:**
- Looks good → Screen 5 (Cook tab); recipe goes live for all cooks

---

### Screen 5 — Cooking View, Cook tab (everyone)

**Purpose:** The main screen. Shows the sectioned task checklist that everyone collaborates on.

**Layout:**
- Top bar (universal pattern — kitchen name on left, cook avatars on right)
- **Top-right action (main cook only):** small terracotta text button **"Done?"** — opens the wrap-up sheet (see Screen 11)
- Recipe title in serif, just below the top bar
- Subtle progress indicator under the title — thin sage progress bar plus tiny text *"7 of 14 done"*
- List of sections in order:
  - **Section header** — section title in medium-weight body font, terracotta tint
  - **Tasks** under each section, each row:
    - Circular checkbox on the left
    - Task description (body text)
    - On the right: **assignee chip** if delegated (small pill with cook's first name + tinted color)
- Bottom tab bar (universal)

**States:**
- Recipe not yet ready (joined before main cook started): friendly empty state — *"Hang tight. The chef is still getting the recipe ready."* with a small chef-hat illustration if available
- All tasks in a section completed: section header gets a sage check next to it, slightly muted appearance
- **All tasks across the recipe completed (100%):** sticky celebratory banner appears above the bottom tab bar — sage background with a small confetti accent and the text *"Everything's checked off!"*, plus a primary button **"Wrap up the kitchen"** (opens Screen 11). The banner is dismissible (tap an X) in case people want to keep the kitchen open for chatting/lingering.

**Interactions:**
- Tap a task row → action sheet from bottom with options:
  - Check / uncheck
  - **"Take this task"** (claims for self)
  - **"Delegate to..."** (main cook only — opens cook list)
  - **"Edit"** / **"Delete"** (main cook only)
- Long-press on empty space below a section's last task → **"Add a task here"**
- Pull-to-refresh: subtle, but doesn't really do anything since updates are realtime — mostly placebo for users who want it
- Tap **"Done?"** in top-right (main cook only) → opens Screen 11

---

### Screen 6 — Cooking View, Shop tab

**Purpose:** Shopping list with delegations.

**Layout:**
- Same top bar as Cook tab
- Heading "Shopping" in serif
- Subhead with progress: *"4 of 12 checked"*
- List of ingredients, each row:
  - Circular checkbox
  - Ingredient name + quantity (e.g., "Carrots — 2 large")
  - Assignee chip on right if delegated
- "Add an ingredient" link at the bottom (main cook only)
- Bottom tab bar

**States:**
- Empty (no ingredients yet): unlikely but possible if recipe parsed weirdly. Placeholder: *"No ingredients yet. The chef can add some."*
- All checked: celebratory state — *"Got everything! Let's cook."* with a sage check, plus a big subtle "Switch to Cook tab" link

**Interactions:** same delegation/edit flow as Cook tab.

---

### Screen 7 — Cooking View, Mine tab

**Purpose:** Filter to just things assigned to me — both shopping items and cooking tasks.

**Layout:**
- Same top bar
- Heading: *"Your tasks"*
- Two collapsed sections:
  - **"To buy"** (shopping items assigned to me)
  - **"To do"** (cooking tasks assigned to me)
- Each item rendered same as in Cook/Shop tabs (with checkbox)
- Bottom tab bar

**States:**
- Nothing assigned: friendly empty state — *"Nothing on your plate yet. Pitch in by tapping any task in the Cook or Shop tab."*
- Everything done: *"You're a beast. Help out somewhere else?"*

**Interactions:** same checkboxes; no delegate option (they're already yours).

---

### Screen 8 — Cooking View, Ask tab

**Purpose:** Ask Claude cooking questions, with context of the current recipe.

**Layout:**
- Same top bar
- Chat-style message thread:
  - User messages: cream bubble aligned right
  - Claude messages: terracotta-tinted bubble aligned left, with a small Claude/chef icon
- Message composer at bottom:
  - Text input
  - Small toggle below the input: *"Include context (current recipe)"* — on by default
  - Send button (terracotta paper-plane icon)

**States:**
- Empty thread: subtle prompt suggestions floating mid-screen:
  - *"How do I tell if my chicken is done?"*
  - *"What can I substitute for buttermilk?"*
  - *"How fine should I dice an onion?"*
- Loading response: animated three-dot indicator in Claude's bubble
- Error: red-tinted bubble — *"Couldn't reach Claude. Try again."*

**Interactions:**
- Tap a suggested prompt → fills it in and sends
- Tap toggle → stops sending recipe context (sometimes the user just wants generic help)

---

### Screen 9 — Delegation banner (overlay, not a separate screen)

**Purpose:** Notify a cook when something is assigned to them.

**Layout:**
- Slides in from top of any screen
- Cream background, terracotta left border
- Avatar of the assigner on the left
- Text: *"[Name] gave you: [task description]"*
- Auto-dismiss after 4 seconds, or tap to jump to Mine tab

---

### Screen 10 — People sheet (modal)

**Purpose:** Show who's in the kitchen, manage roles (main cook only).

**Layout:**
- Bottom sheet, drag handle at top
- Heading: *"In the kitchen"*
- List of cooks:
  - Avatar + name
  - Badge next to name: 👑 main cook, 🧑‍🍳 sous chef (if applicable)
  - Last seen indicator if disconnected
- Main cook only: tap a cook → small action menu:
  - **"Make sous chef"** (or "Remove sous chef" if already assigned)
  - **"Remove from kitchen"** (with confirm)
- Bottom: secondary button **"Leave kitchen"** (everyone) / **"End kitchen"** (main cook)

**Interactions:**
- Sous chef appointment shows a sage toast confirmation: *"[Name] is now your sous chef."*
- Leaving kitchen → confirmation modal → back to Landing

---

### Screen 11 — Wrap up kitchen (main cook only)

**Purpose:** Mark the recipe as complete and end the cooking session for everyone. Reached either by tapping **"Done?"** in the top bar of the cooking view, by tapping **"Wrap up the kitchen"** in the all-checked celebration banner (Screen 5), or by tapping **"End kitchen"** in the People sheet (Screen 10).

**Layout:** bottom sheet, drag handle at top.
- Heading: *"All done?"* (serif)
- Sub-text: *"This will end the kitchen for everyone. We'll save a quick summary you can show off."* (the "summary" line is aspirational — for v1 we'll just show a basic stat screen; recipe history is v2)
- Small stat row, three pills laid out horizontally:
  - 🍳 *"X tasks done"*
  - 🛒 *"Y items bought"*
  - 👥 *"Z cooks"*
- Primary destructive button: **"End kitchen"** (terracotta — destructive but celebratory, not harsh red here)
- Secondary button: **"Keep cooking"** (closes the sheet, returns to wherever the user was)

**States:**
- Some tasks still unchecked: show a subtle warning above the buttons — *"Heads up: 3 tasks aren't checked off yet."* Doesn't block, just nudges.
- All tasks checked: stat row gets a sage tint as a celebratory cue.

**Interactions:**
- End kitchen → kitchen marked `ended` in DB. All cooks (including main cook) are returned to the Landing screen with a sage toast: *"Nice work! Kitchen wrapped."* Other cooks see a similar toast: *"[Main cook's name] wrapped up the kitchen. Hope it was tasty!"*
- Keep cooking → sheet dismisses, no state change.

---

## 4. Special: empty / first-time / edge cases

A summary list so the design tool catches all the states:

- **Loading kitchen creation** (button spinner)
- **Loading recipe parse** (full-screen overlay with rotating status messages)
- **No friends joined yet** (lobby empty state)
- **Recipe not yet ready** (Cook tab empty state for non-main cooks)
- **All tasks complete in a section** (subtle muted appearance + sage check)
- **All shopping done** (celebratory state)
- **Nothing assigned to me** (friendly empty state on Mine tab)
- **Network error** (inline messages, retry buttons)
- **Recipe parse failure** (try again or type by hand)
- **Main cook disconnected with sous chef** (toast: *"[Sous chef] is now the main cook."*)
- **Main cook disconnected without sous chef** (banner at top: *"The chef is offline. Recipe is locked until they're back."*)
- **Main cook abandoned the kitchen from Lobby** (Screen 3) before importing a recipe — joined cooks see toast: *"The host ended this kitchen."* and return to Landing
- **Main cook wrapped up the kitchen** from Screen 11 — all cooks see toast and return to Landing
- **All tasks 100% checked** — sticky celebratory banner appears in Cook tab with "Wrap up the kitchen" CTA

---

## 5. App icon (separate prompt)

Not a screen, but worth specifying. App icon should:
- Use the same color palette
- Feel like a hand-drawn paper recipe-card / chef-hat hybrid
- Work at iOS icon sizes (small, square, rounded by iOS automatically)
- One simple recognizable shape — not text-heavy
- Suggested concept: a stylized chef's hat in terracotta on cream, OR a small pot icon with a wooden spoon

---

*End of spec. Use any section as a standalone prompt; the visual identity at the top should accompany whatever screen you're generating to keep style consistent.*
