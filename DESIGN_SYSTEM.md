# ADDo Design System

Visual reference: dark-mode app screenshots shared by Anna (habit challenge app with lime green accent).
Translation: light mode, orange accent, same shape language and spacing generosity.

Builder must follow this file for every screen. Do not invent styles. If something isn't specified here, ask Lead before making a choice.

---

## Colour

```
Background         #F7F6F3   warm off-white, never pure white
Surface (card)     #FFFFFF   white cards on warm background
Surface alt        #F0EEE9   slightly deeper warm for nested surfaces

Text primary       #1A1A1A   near-black
Text secondary     #6B7280   muted grey for descriptions, captions
Text disabled      #B0AAAA   greyed out

Accent             #F97316   orange — primary interactive colour
Accent light       #FFF0E6   very light orange tint, for selected pill backgrounds
Accent dark        #EA6C0A   pressed/hover state of orange

Destructive        #EF4444   delete, error
Border             #E5E3DE   subtle warm divider / card border (use sparingly)
```

---

## Typography

System font stack: `SF Pro` (iOS) · `Roboto` (Android) · `system-ui` (web).
No custom font in v2.0 — keep it native and fast.

```
Display      32px  bold (700)     screen titles, big numbers
Heading      22px  bold (700)     section headers
Subheading   17px  semibold (600) card titles, task names
Body         15px  regular (400)  descriptions, notes
Caption      13px  regular (400)  timestamps, secondary labels, tags
```

All text left-aligned unless it's a standalone centred screen (onboarding, empty state).

---

## Spacing scale

Use only these values. Do not invent intermediate sizes.

```
4   xs    tight label gaps
8   sm    between related elements (icon + label)
12  md    between list items, between tag chips
16  lg    card internal padding, section gaps
20  xl    screen horizontal margin (applied to everything)
24  2xl   between major sections
32  3xl   between screen-level sections
```

**Screen horizontal margin: 20px on both sides. Always. No edge-to-edge content.**

---

## Border radius

```
4    tags inside tags (very small)
8    small chips, badges
12   input fields, small cards
16   standard cards, modals
28   buttons (full pill shape — matches reference screenshots exactly)
999  duration pill selectors (fully round)
```

---

## Cards

```
background:     Surface (#FFFFFF)
border-radius:  16
padding:        16 all sides
shadow:         0 2px 8px rgba(0,0,0,0.06)   — subtle, not heavy
border:         none (shadow does the elevation work)
gap between cards: 12
```

---

## Buttons

**Primary (orange pill):**
```
background:     Accent (#F97316)
text:           #FFFFFF  bold 17px
border-radius:  28 (pill)
height:         52
horizontal padding: 24
width:          full width within screen margins
pressed state:  Accent dark (#EA6C0A)
```

**Secondary (ghost):**
```
background:     #F0EEE9
text:           Text primary (#1A1A1A)  semibold 17px
border-radius:  28
height:         52
```

**Disabled:**
```
background:     #E5E3DE
text:           Text disabled (#B0AAAA)
no interaction
```

---

## Duration pill selectors

Used in: Task Pool (add task), This Session picker.
Reference: the "14 days · 15h per week" tag chips from the reference screenshots.

```
Unselected:
  background:     Surface alt (#F0EEE9)
  text:           Text secondary (#6B7280)  caption 13px
  border-radius:  999
  padding:        6 14 (vertical horizontal)

Selected:
  background:     Accent light (#FFF0E6)
  text:           Accent (#F97316)  caption 13px  semibold
  border:         1px solid Accent (#F97316)
  border-radius:  999
```

Displayed as a horizontal scrollable row if they overflow, or wrap to second line.

**Default duration set for Task Pool:**
5 min · 15 min · 30 min · 45 min · 60 min · 90 min

Nothing pre-selected on a new task. User must tap one.

---

## Input fields

```
background:     Surface (#FFFFFF)
border:         1px solid Border (#E5E3DE)
border-radius:  12
padding:        14 16
font:           Body 15px
placeholder:    Text disabled (#B0AAAA)
focus border:   Accent (#F97316)
height:         auto (grows with content for notes; fixed 48 for single-line)
```

---

## Task Pool layout

### Screen structure (top → bottom)

1. **Add task area** — always visible at top, not in a modal
   - Title input (single line, full width)
   - Duration pills row (5 / 15 / 30 / 45 / 60 / 90)
   - Bucket selector (Must · Want · Later — three pill toggles, one must be selected)
   - Add button (primary orange pill, full width) — disabled until title + duration both filled
   - Divider below

2. **Three bucket sections** — all visible simultaneously below the add area, never behind a tab
   - On web (wide): three columns side by side
   - On mobile (narrow): three stacked sections, full-width, scroll as one page
   - Each section has a header label ("Must" / "Want" / "Later") + running time total in caption
   - Tasks listed as cards inside each section
   - Empty state: short encouraging line, no icon needed ("Nothing here yet")

### Task card
```
Card (white, 16 radius, subtle shadow)
  Task name — Subheading
  Duration — Caption, Text secondary, right-aligned or below name
  Delete / move buttons — appear on swipe (mobile) or on hover (web), not always visible
```

---

## Bucket selector (in add-task area)

Three pill toggles in a row, exactly one always selected:

```
Must   |  Want  |  Later
```

Same selected/unselected style as duration pills but larger (body size, not caption).
Default selection: Must (since that's the most common starting point).

---

## Icons

Use `@expo/vector-icons` (Feather or Ionicons set — clean, rounded, minimal).
Icon size: 20 for inline, 24 for standalone.
Icon colour: Text secondary by default, Accent when active.
No filled icons except for the active/selected state — outline style throughout.

---

## Navigation

Bottom tab bar — 4 tabs:
```
Tasks        Session       Quests        Settings
check-square  play-circle   star          settings
(Feather icons, size 22)
```
Tab bar style:
```
background:     Surface (#FFFFFF)
border-top:     none
shadow:         0 -2px 8px rgba(0,0,0,0.04)
active icon+label:    Accent (#F97316)
inactive icon+label:  Text secondary (#6B7280)
label:          Caption 11px
height:         60 (+ safe area inset on iOS)
```

Screen headers: white background, Heading weight title, back arrow in Accent colour.

---

## What we do NOT do

- No drop shadows heavier than `0 2px 8px rgba(0,0,0,0.06)`
- No gradients
- No full-bleed images
- No animation beyond: opacity fade (200ms) on mount, scale (150ms) on button press
- No emojis in UI chrome (only in content if the user adds them)
- No streak counters, XP bars, level badges, or score displays — ever
- No red/warning colours unless something is genuinely broken (not for "you skipped a task")
