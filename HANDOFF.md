# missions-app — handoff

Snapshot of the project as of **v2.0.0** (the redesign + handbook release,
shipped from the v1.3.0-dev sprint) on top of the previously shipped
**v1.2.2** for the next person (or next Claude session) picking this up.
Skim this first; it shortens onboarding from a day to about an hour.

If something here disagrees with the code, the code wins. Update this file
when you change behaviour worth knowing about.

---

## 1. What this is

A self-hosted browser-based outdoor game webapp with two play modes:

- **MiSSiONS** — fixed scavenger-hunt missions at a chosen location. Players
  submit photos/videos; GM reviews each one. No GPS. No PvP.
- **CityRush** — linear GPS-gated route with optional special missions and
  the **caught-on-camera freeze** mechanic (Team A photographs Team B; if the
  photo is accepted, the GM freezes Team B). Freeze is CityRush-only.

GM uses `gm.html` on a **desktop/laptop** (desktop-first since v1.3.0-dev).
Players join from their phones via QR code or join URL. SQLite for state,
Socket.IO for realtime. Cloudflare quick tunnel (bundled `cloudflared.exe`)
gives the GM a public HTTPS URL without configuring a real domain.

A code-activated **third game type** (Foxtrail / crumbs.gg-style self-paced
tour) is spec'd in [`FUTURE.md`](FUTURE.md) but **not yet implemented**.

---

## 2. Current state (as of this handoff)

- **Last shipped tag**: `v1.2.2` (in-app updater fix + auto-release workflow fix).
- **Last shipped feature**: `v1.2.1` (per-location/CR-mode language allow-list + in-app manual downloads).
- **Working tree**: local `main` is 13 commits ahead of the remote, version
  bumped to `1.3.0-dev`. These commits are the UI/UX redesign sprint.
  **None have been pushed yet** — they're sitting on the user's machine for review.
- **Rollback point**: annotated tag `Pre-Redesign` (commit `72c2888`).
  Roll back the redesign at any time with:

  ```bash
  git reset --hard Pre-Redesign
  ```

The redesign sprint is **partially complete**. Mockup-vs-live status as of
this handoff:

| Direction | Status |
|---|---|
| Warm dark background + softer orange tokens | ✓ shipped |
| Status palette discipline (orange = action only) | ✓ mostly — `.cr-frozen-tag` and a couple of inline rules still need a final sweep |
| Display font (Big Shoulders Stencil) on wordmarks | ✓ landing + settings gate + topbars |
| Team color stripes on GM dashboard chips | ✓ shipped (derived from team ID hash) |
| GM dashboard desktop-first layout | ✓ shipped (380px rail @ 1280+, 320px @ 1024, stacked < 900px) |
| Language-tabbed editors (Add Mission, CR Mission) | ✓ shipped |
| CityRush map picker (Leaflet) | ✓ shipped |
| iOS-style toggles, segmented controls, steppers | ✓ shipped in modals |
| Check-pills for allow-flag groups | ✓ shipped (Location + CR-mode editors) |
| Mission cards: hairline borders + breathing room | ✓ shipped |
| Topbar icon swap (emoji → stroked SVG line icons) | ✓ shipped (player + CR + GM dashboard) |
| Mission card media-type icons → SVG | ✓ shipped (camera/video/house) |
| Landing page polish | ✓ shipped |
| **Game-select screen polish** | ✗ not yet — top candidate for next pass |
| **CityRush player mission tiles** | ✗ not yet — still emoji-heavy |
| **Camera/capture flow** | ✗ not yet — large emoji buttons in the capture modal |

---

## 3. How to run

### Local dev

```bash
npm install
PORT=3001 node server.js
# open http://localhost:3001/gm.html
```

Production / customer install on a Pi:

```bash
./setup-pi.sh         # systemd unit + node + cloudflared
./update.sh           # pulls latest main + reinstalls deps
```

The bundled `start-tunnel-windows.bat` (Windows dev) prints a Cloudflare
quick-tunnel HTTPS URL and writes it to `tunnel-url.txt`. The GM presses
"Detect" in Settings → General to pick it up.

### Default GM password

`admin1898` — used by the capture scripts. Change immediately in production
via Settings → Security.

### Smoke-test the server boots

```bash
DB_PATH="$(mktemp -d)/m.db" UPLOAD_DIR="$(mktemp -d)/up" PORT=0 \
  node -e "require('./server.js'); setTimeout(()=>process.exit(0),1500);"
```

Both `DB_PATH` and `UPLOAD_DIR` are env-overridable (added in v1.2.0) so
test runs never touch production data.

---

## 4. Repo layout

```
server.js              Express + Socket.IO entry. ~1300 LOC. All API
                       routes inline. /api/update at the top handles
                       in-app updates (git pull + npm ci with ENOTEMPTY
                       recovery — v1.2.2 fix).
db/database.js         SQLite (node:sqlite) layer. Schema, migrations,
                       all helpers. Default DB at data/missions.db; the
                       env-overridable DB_PATH points elsewhere for tests.
                       Exports `_db` for ad-hoc prepared statements.
lib/collage.js         Game-media export: streamZip() + generateCollage()
                       (ffmpeg-static via fluent-ffmpeg). v1.2.0 feature.
public/
  gm.html              Single-file GM app. ~4500 LOC. Landing → game
                       select → dashboard → settings. The whole admin
                       UI lives here. Big inline <script> at the top.
  play.html            MiSSiONS player view. Mobile-first.
  cityrush.html        CityRush player view. Mobile-first. Includes
                       Leaflet (player map).
  join.html            Pre-game team join screen.
  css/app.css          Shared tokens + components. Source of truth for
                       the new design tokens (--bg, --orange, --display,
                       etc). v1.3.0-dev brought the warm dark palette.
  manuals/             Auto-deployed PDF manuals (v1.2.1 feature):
                       GM_Manual-de.pdf, GM_Manual-en.pdf,
                       SETTINGS_Manual-de.pdf, SETTINGS_Manual-en.pdf.
                       Served by the static mount. Updated by the
                       handbook/scripts/build-pdfs.mjs script.
assets/
  logo.png             ADVENTUREROOMS logo (used on landing + join + GM).
  fonts/
    Inter-Bold.ttf     Bundled font for the collage title cards (ffmpeg
                       drawtext needs a file path, not a system font).
handbook/              Out-of-band tooling. Manuals + screenshot capture.
                       Not loaded by server.js. See §8 below.
mockups/               Static HTML mockups produced during the design
                       critique. Reference only — not loaded by the app.
data/                  SQLite DB + WAL files (gitignored).
uploads/               Player media + the collage MP4 output (gitignored).
```

### Files NOT to edit when touching the redesign

- `.github/workflows/release.yml` — fixed in v1.2.2 to trigger on
  version-changed; don't add tag-existence checks back.
- `cloudflared.exe` — vendored binary, leave alone.
- Any `data/` or `uploads/` content.

---

## 5. Data model (SQLite)

All tables auto-migrate on boot via `try { db.exec("ALTER TABLE …") } catch {}`.
Schema additions are append-only and idempotent.

| Table | Purpose |
|---|---|
| `settings`              | Key/value: password_hash, public_url, timeout_text_de/en/fr/it/es, github_url, version, qr template path. |
| `locations`             | MiSSiONS locations. **`allowed_langs`** column (v1.2.1) carries the per-location language allow-list. |
| `modes`                 | MiSSiONS modes (ruleset, timer_default). |
| `missions`              | MiSSiONS mission library. 5 lang columns each for name/description/task. |
| `rulesets` + `rule…`    | Rulesets + their ordered rules. |
| `games`                 | Game instances. `collage_path` + `collage_generated_at` (v1.2.0). |
| `teams`                 | One row per team in a game. `selfie_path`, `gps_anchor_key`. **Teams currently don't store a color** — the GM dashboard derives one from `teamColor(t)` (hash of team.id into a fixed palette of 8 hues). If you ever need true persistence, add a `color` column. |
| `team_missions`         | MiSSiONS assignments + submission state per (team, mission). |
| `cr_modes`              | CityRush modes. `allowed_langs` (v1.2.1) for player language restriction. |
| `cr_missions`           | CR mission library. `media_required`, `has_answer`, `is_special`, `repeat_minutes`, GPS columns. |
| `cr_game_links`         | Which CR mode a CR game uses. |
| `cr_submissions`        | Per-team CR upload state. |
| `cr_team_progress`      | Linear progress through CR missions per team. |
| `cr_special_progress`   | Independent state for special missions (cooldown tracking). |
| `cr_arrivals`           | Per-team arrival events at CR mission targets. |
| `cr_hints` + `cr_team_hints` | Multi-step hint reveals per mission, claimed per team. |
| `team_freezes`          | The PvP freeze ledger. One row per (game, freezer, frozen) pair, `until_ms` epoch. CityRush-only at the UI level. |
| `messages`              | Chat between GM and teams; broadcast messages are stored with team_id = NULL. |

---

## 6. API surface

All routes live in `server.js`. Mutating routes (`POST`/`PUT`/`DELETE`) on
admin resources require `password` in the body and call `db.verifyPassword`.
Read endpoints are open — the assumption is the game ID itself is the
secret. If you need stricter auth, the place to start is §10.

Notable groups:

- `GET/POST/PUT/DELETE /api/locations` — locations CRUD
- `GET/POST/PUT/DELETE /api/missions` — MiSSiONS CRUD
- `GET/POST/PUT/DELETE /api/cr/modes` — CR mode CRUD
- `GET/POST/PUT/DELETE /api/cr/missions` — CR mission CRUD
- `POST /api/games` — create a game
- `POST /api/games/:id/teams` — join as a team
- `GET  /api/games/:id/teams/:tid` — team payload, **includes `allowed_langs`** (v1.2.1) so the player cycler can filter
- `POST /api/games/:id/teams/:tid/missions/:mid/upload` — submission
- `POST /api/submissions/:id/review` — accept / reject a MiSSiONS submission
- `POST /api/cr/submissions/:id/review` — accept / reject a CR submission
- `POST /api/games/:id/freeze` — freeze a team (CityRush-only)
- `GET  /api/games/:id/media.zip` — stream zip of all accepted media (v1.2.0)
- `POST /api/games/:id/collage` — kick off photo-collage render, returns `{job_id}`
- `GET  /api/games/:id/collage/status/:jobId` — poll render progress
- `GET  /api/games/:id/collage/file` — download the rendered MP4
- `POST /api/translate` — server-side proxy for the auto-translate buttons
- `POST /api/update` — in-app updater; v1.2.2 added ENOTEMPTY recovery (wipes `node_modules` and falls back to `npm install` when `npm ci` fails because the running server is holding `ffmpeg-static`'s binary open)

---

## 7. Front-end conventions

- Pages are single-file HTML with one giant inline `<script>`. No build
  step, no framework, no TypeScript. Don't add any.
- Translation pattern: `T` (player) / `GMT` (GM) objects keyed by lang. A
  small `t()` / `gmt()` helper does the lookup with fallback. Keep the
  five language dicts (`de`, `en`, `fr`, `it`, `es`) at exactly the same
  set of keys — the smoke test prints `de:N, en:N, …` and any drift is
  immediately visible.
- `data-tip="…"` + `applyTooltips()` is the translated tooltip system.
- Modals are template literals returned from helpers, then dropped into
  `#modal-content` and `#modal-overlay`'s `display='flex'`. Backticks
  inside HTML comments **terminate the template literal** — don't use
  them. (Bit me once during the redesign.)
- **Topbar icons** (added in v1.3.0-dev) live as inline SVG `<svg class="icon" viewBox="0 0 24 24">…</svg>`. They inherit `currentColor` so hover states paint the stroke automatically. `title` + `aria-label` on the button carry the screen-reader label.
- **Form components** (also v1.3.0-dev): `.segmented`, `.toggle` (+ `.toggle-row`), `.stepper`, `.check-pill`. Each pairs with a hidden `<input>` so existing save logic (which reads `.value` / `.checked`) keeps working unchanged. Helpers `selectSegment`, `toggleSwitch`, `toggleCheckPill`, `stepInput` live near the top of `gm.html`.
- **Language-tabbed editor** (v1.2.1): `langTabFields(prefix, type, values)` produces a `[DE ✓] [EN ✓] [FR] …` tabstrip + one visible panel at a time. All five inputs stay in the DOM under their original IDs (`m-name-de`, `m-desc-en`, etc) so the save flow is untouched. `refreshLangTickMarks(prefix)` updates the ✓ marks after auto-translate.

---

## 8. The handbook tooling

Out-of-band tooling that produces the four PDF manuals served from
`public/manuals/`. Lives entirely under `handbook/`:

```
handbook/
├── README.md                 detailed usage
├── content/                  markdown source for each manual
│   ├── settings-de.md / settings-en.md / gm-de.md / gm-en.md
├── pdf/                      built PDFs (gitignored)
├── screenshots/              per-manual screenshot folders (gitignored)
└── scripts/
    ├── _fixture.mjs          boots server with sandbox DB+UPLOAD_DIR,
                              seeds 3 locations + 6 missions + 1 CR mode
                              + 1 running game with 2 teams + 1 pending
                              submission. Used by all capture scripts.
    ├── capture-settings.mjs  walks every settings tab in DE+EN
    ├── capture-gm.mjs        walks GM dashboard flow in DE+EN
    ├── capture.mjs           legacy deterministic walk
    ├── stagehand-tour.mjs    AI-driven walkthrough (needs ANTHROPIC_API_KEY)
    └── build-pdfs.mjs        markdown → HTML → PDF + mirrors to public/manuals/
```

Full rebuild from scratch:

```bash
node handbook/scripts/capture-settings.mjs   # screenshots, DE + EN
node handbook/scripts/capture-gm.mjs         # screenshots, DE + EN
node handbook/scripts/build-pdfs.mjs         # renders + copies to public/manuals/
```

Each capture script uses Playwright + Chromium against a sandboxed
server (env-overridden `DB_PATH` / `UPLOAD_DIR`). The build script mirrors
every PDF into `public/manuals/` on each run so the in-app 📖 Manuals
button always serves the latest build.

The PDFs in the repo right now are from the **previous design** (v1.2.x).
They'll need a rebuild when the redesign sprint lands.

---

## 9. Known footguns

- **db.prepare isn't directly exported** — use `db._db.prepare(...)` for
  ad-hoc queries (added in v1.2.0 so the collage helper could write a
  UNION query without polluting the named-helper namespace). Prefer
  adding a named helper to `db/database.js` for anything reusable.
- **`deleteGame` is a manual cascade** — it deletes from many child
  tables in order. If you add a new `*_id REFERENCES games(id)` table,
  you have to remember to add a corresponding delete here.
- **`FIELD_ID_ALIASES` in CR auto-translate** — the CR description field
  uses id-prefix `cr-desc-*` but the API field name is `description`.
  The map at `autoTranslateCrField` line ~4140 reconciles them; if you
  rename a CR field, update this map.
- **Backticks in HTML comments inside JS template literals terminate
  the string** — bit me during the redesign. Either remove them or
  escape with `\\``.
- **CityRush map crash on null GPS coords**: `L.marker([null,null])`
  throws. There's a guard in `capture-gm.mjs`'s init script for tests;
  the live app should also filter null coords before creating markers
  (open task — special missions intentionally have null coords).
- **CityRush v2v + audio + image was once a 500**: confirmed fixed by
  Arcads upstream on 2026-04-14 but worth re-testing if you touch the
  collage / external-API pipeline.
- **In-app updater + ffmpeg-static**: `npm ci` would fail with ENOTEMPTY
  because the running server holds `ffmpeg-static/ffmpeg` open. v1.2.2
  added a fallback that wipes `node_modules` and retries with `npm install`.
  Don't undo that.
- **WAL visibility across processes**: SQLite writes go to the WAL file
  first. If your test process opens its own connection and the server
  is running in a child process, a `PRAGMA wal_checkpoint(FULL)` after
  the write makes the change visible immediately. See the smoke-test
  scripts in `handbook/scripts/`.

---

## 10. Security recommendations

These haven't shipped yet but were spec'd back at v1.1.x and are still
worth doing:

1. **Helmet + CSP** on Express.
2. **Rate-limiting** on `/api/*`, especially the GM login (`/api/settings` PUT) and chat send.
3. **Per-team auth tokens** — a leaked join URL today gives any device the team's identity. A short-lived token bound to the device's session would fix that without changing the player UX.
4. **CORS tightening** to just the tunnel host (currently `cors: { origin: '*' }`).
5. **Multer hardening** — MIME sniff + size cap per upload type.
6. **`/api/update` IP allow-list** or settings-password requirement (currently anyone who knows the path can trigger `git pull`).
7. **Error masking** — server currently leaks stack traces.
8. **`esc()` audit** — sweep every `innerHTML` to confirm user-supplied strings are escaped. Most are but a comprehensive pass hasn't happened.

---

## 11. Release workflow

`.github/workflows/release.yml` (fixed in v1.2.2):

- Triggers on **push to main**.
- Reads `package.json` version and compares to the previous commit's version.
- If unchanged → skips. If changed → uses `softprops/action-gh-release@v2` to create the tag (if missing) **and** the release in one shot.
- Don't add the old tag-existence check back; that was the bug we fixed.

To ship a new version:

```bash
# 1. Bump
node -e "let p=require('./package.json'); p.version='1.3.0'; require('fs').writeFileSync('./package.json', JSON.stringify(p,null,2)+'\n');"

# 2. Commit + push (the workflow creates the tag + release on remote)
git add package.json && git commit -m "v1.3.0: …"
git push origin main
```

If a manual fix is needed for an older release that didn't get a Releases-page entry (happens with the early v1.2.0 / v1.2.1 if you push the tag yourself before the workflow runs), do it from your machine with `gh`:

```bash
gh release create v1.2.0 --title "MiSSiONS v1.2.0" --notes-from-tag --latest=false
```

---

## 12. Where to edit what

| You want to… | Edit |
|---|---|
| Change a translation | The 5 lang dicts in `public/gm.html` (`GMT`) or `play.html` / `cityrush.html` (`T`). |
| Add a new GM setting | `public/gm.html` — add a tab button, a `#stab-*` content panel, route it via `switchSettingsTab`. Persist via `db.updateSettings()` from `server.js`. |
| Add a new column to a table | Append a `try { db.exec("ALTER TABLE …") } catch {}` in `db/database.js`. Update the helper that writes the row. |
| Change a button style | `public/css/app.css` (`.btn`, `.btn-primary`, …). |
| Add a new icon | Inline the SVG inside the button OR add it to the `ICONS` const at the top of `gm.html` (and `play.html` if it's player-side). Use `class="icon"`. |
| Tweak the dashboard layout | `#screen-dashboard` grid rules near the top of `gm.html` `<style>` block. |
| Regenerate the manuals | `node handbook/scripts/capture-settings.mjs && node handbook/scripts/capture-gm.mjs && node handbook/scripts/build-pdfs.mjs`. |
| Roll back the redesign | `git reset --hard Pre-Redesign`. Then `git push --force-with-lease` if you've already pushed (won't apply currently — nothing is pushed). |

---

## 13. Out of scope

The following are explicit "not happening unless asked":

- **No build step / no bundler / no framework / no TypeScript.** The
  single-file HTML+JS pattern is intentional. It's diff-friendly,
  hot-reloadable with `node --watch`, and the cognitive surface is
  small.
- **No tests.** There aren't any. Smoke tests via the capture scripts
  and the parity check (`new Function(scriptBody)`) catch most regressions.
- **No third-party analytics.** Player privacy is the implicit promise.
- **No SaaS hosting.** Self-hosted, customer-owned, no central control plane.

---

## 14. Pointers to other docs

- [`TODO.md`](TODO.md) — short outstanding items. Has a reminder block at the top to surface FUTURE.md after the redesign sprint.
- [`FUTURE.md`](FUTURE.md) — full spec for the code-activated tour mode (Foxtrail / crumbs.gg style). 4-7 dev-days for a sellable v0.1.
- [`README.md`](README.md) — user-facing intro.
- [`GITHUB_SETUP.md`](GITHUB_SETUP.md) — one-time GitHub setup for the in-app updater.
- [`handbook/README.md`](handbook/README.md) — how to use the manual-generation pipeline.
- [`mockups/README.md`](mockups/README.md) — the design-direction HTML mockups used during the redesign sprint.
