# Mockups — UI/UX redesign concepts

Static HTML mockups produced for the design critique. **These are not part
of the app.** Nothing under this folder is loaded by `server.js`, the
public/ static mount, or any build step. Treat them as a visual sketchbook.

## Files

| File | Purpose | Frame |
|---|---|---|
| `index.html` | Concept board — all screens side-by-side via iframes | mixed |
| `01-player-home.html` | Player MiSSiONS home (mission list + camera CTA) | phone |
| `02-gm-dashboard.html` | GM dashboard, mobile/tablet fallback (< 900px) | phone |
| `03-add-mission-modal.html` | Add MiSSiON modal with language-tabbed editor | phone |
| `04-gm-landing.html` | GM landing — wordmark + location grid + CityRush tile | desktop |
| `05-gm-game-select.html` | GM game-select — new-game form card + recent games | desktop |
| `06-gm-new-game.html` | GM new-game · QR display + join URL | desktop |
| `07-gm-dashboard-desktop.html` | GM dashboard, desktop layout (1024+) with right panel | desktop |
| `08-gm-settings.html` | GM settings — two-level sidebar (App / Games) + form panel | desktop |
| `09-player-join.html` | Player join — selfie + team name + language pick | phone |
| `10-cityrush-player.html` | CityRush player — mini map + linear stop + hints + bottom nav | phone |
| `11-map-picker.html` | Map picker modal with **Use current location** (working geo demo) | desktop modal |
| `12-add-cr-mission.html` | Add CityRush mission — mini map + GPS + answer + hint reveals | phone |
| `_shared.css` | Brand tokens + reusable phone / desktop frame + components |

## How to view

Just open `mockups/index.html` in any modern browser. No server required:

```bash
# macOS
open mockups/index.html

# Windows
start mockups\index.html

# Linux
xdg-open mockups/index.html
```

(Some browsers block cross-origin iframe content from `file://` URLs. If
`index.html` looks blank, open the per-screen files directly — they all
render standalone.)

For a quick local server if you want all three to load reliably:

```bash
npx --yes http-server mockups -p 5173 -c-1
# then visit http://localhost:5173
```

## Coverage

Pages live in `public/`:

- `gm.html` (5 screens + N modals) → **04, 05, 06, 07, 08, 11, 12** (and **03** for the MiSSiONS add modal). Same patterns extend to the other modals (Edit / Add CR Mode / Submission review / Freeze / Broadcast / Export — not separately mocked).
- `play.html` (MiSSiONS player) → **01**.
- `cityrush.html` (CityRush player) → **10**.
- `join.html` (pre-game team join) → **09**.

The dashboard exists in two frames: **07** (desktop, default in v1.3.0+) and **02** (mobile fallback under 900px). The other modals not separately mocked re-use the patterns from **03** (lang tabs, segmented controls, toggle rows, steppers) and **11** (the modal-card frame).

## What's being proposed

Brand identity preserved. Five design moves:

1. **Status palette discipline.** Orange = action you need to take.
   Green = done. Grey = neutral metadata. Today orange is overloaded
   (team chip border, points pill, location pill, mode highlight) which
   removes its signal value.
2. **Team color stripes** as the identity carrier on the GM dashboard.
   Each team gets a real colour; chips and detail panels show a 4px
   coloured edge. No more two-orange-chips-that-look-the-same.
3. **One icon family.** Stroked line icons, 1.5px, rounded caps,
   throughout. No mixing of emoji + SVG + text labels for the same
   concept.
4. **Language-tabbed editors.** The Add MiSSiON / Add CityRush Mission
   modals today stack five language inputs vertically per field
   (description, task, name, hint, answer). The redesign shows a
   `[DE ✓] [EN ✓] [FR] [IT ✓] [ES]` pill row with checkmarks
   indicating "this language is filled in"; only one language renders
   below.
5. **Type restraint.** The distressed stencil display sans is reserved
   for the wordmark and top-level section titles only. Everything else
   uses a clean grotesque (Inter). Today the display font appears on
   mode tabs and modal headers, which causes font fatigue.

These match the priority recommendations in the design critique.

## Tokens (see `_shared.css`)

| Token | Value | Notes |
|---|---|---|
| `--bg` | `#0F0E0D` | Warm near-black, not pure |
| `--surface` | `#1A1817` | Card surface |
| `--orange` | `#E85F1E` | Action-required only |
| `--green` | `#4ADE80` | Done / accepted |
| `--display` | Big Shoulders Stencil Display | Top-level titles only |
| `--body` | Inter | Everything else |
| `--mono` | JetBrains Mono | Timers, scores, IDs |

## Iterating

These are HTML/CSS, so edit them directly. Change `--orange` to test a
different accent. Tweak `--phone-w` to render at a different device
size. The point is to discuss the direction with real-feeling pixels
before committing to a refactor of `public/gm.html` etc.

When the team agrees on a direction, the next step is to port the
tokens and components into the real app's `public/css/app.css` and
gradually refactor the existing screens — not to lift this code
wholesale.
