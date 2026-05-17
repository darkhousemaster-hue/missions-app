# missions-app — handoff

Snapshot of the project as of **v1.1.7** for the next person (or next Claude
session) picking this up. Skim this first; it shortens onboarding from a
day to about an hour.

---

## 1. What this is

A self-hosted browser-based outdoor game webapp with two play modes:

- **MiSSiONS** — fixed scavenger-hunt missions at a chosen location. Players
  submit photos/videos; GM reviews each one.
- **CityRush** — linear GPS-gated route with optional special missions and
  team freezes (catch-the-other-team mechanic).

GM uses `gm.html` on a laptop; players join from their phones via QR code.
SQLite for state, Socket.IO for realtime.

---

## 2. Run it

```sh
npm install
node server.js                  # listens on :3001
# or
npm run dev                     # node --watch server.js
```

Players need to reach the box over HTTPS for the camera/GPS APIs. The
included `start-tunnel-windows.bat` spins up a Cloudflare quick tunnel via
the bundled `cloudflared.exe` and writes the public URL into `tunnel-url.txt`;
the GM settings page reads that and offers a "Detect" button to populate
the public URL for QR codes.

Default GM password (after a fresh `data/missions.db`): `admin1898`.
**Change it via Settings → Security on first run.**

Node 22+ required (uses the built-in `node:sqlite`).

---

## 3. Repo layout

```
server.js                  # all HTTP + Socket.IO routes (~1200 loc)
db/database.js             # SQLite schema + migrations + helpers (~900 loc)
public/
  gm.html                  # GM dashboard + settings (~3700 loc, monolith)
  play.html                # MiSSiONS player view (~950 loc)
  cityrush.html            # CityRush player view (~2500 loc)
  join.html                # /join.html?game=XXXX landing page (~250 loc)
  css/app.css              # shared styles
  assets/                  # logo + favicon
data/                      # SQLite DB lives here (gitignored)
uploads/                   # per-game media + cr_hints/ + templates/
start-tunnel-windows.bat   # cloudflared tunnel + url capture
setup-pi.sh                # Raspberry Pi install
```

Everything is intentionally vanilla — **no build step, no framework**.
Pages are single-file HTML+JS that talk to the Express API and Socket.IO.
This is the project's biggest deliberate choice; preserve it.

---

## 4. Data model (SQLite, WAL mode)

| Table                  | Purpose                                                                 |
|------------------------|-------------------------------------------------------------------------|
| `settings`             | k/v including `password_hash`, `public_url`, timeout text per language  |
| `rulesets`             | named rule lists (JSON) attached to a mode                              |
| `modes`                | mission modes; FK to `rulesets`                                         |
| `locations`            | physical mission locations + per-location allow_photo/video/indoor      |
| `missions`             | regular missions (location + mode scoped)                               |
| `games`                | one row per game session                                                |
| `game_missions`        | which missions were drawn for a game                                    |
| `teams`                | per-game teams. Now incl. `selfie_path`                                 |
| `team_missions`        | per-team mission state (pending/accepted/rejected, media)               |
| `messages`             | chat (team-targeted if `team_id` set; broadcast if NULL)                |
| **CityRush:**          |                                                                         |
| `cr_modes`             | CityRush "tour" definitions + allow_photo/video, ruleset, timer_default |
| `cr_missions`          | CR missions. `is_special=1` means parallel/always-available             |
| `cr_game_links`        | links a game to its cr_mode                                             |
| `cr_team_progress`     | linear mission_index per team                                           |
| `cr_mission_progress`  | per-(team, mission) skip/done log used by GM dashboard                  |
| `cr_special_progress`  | per-(team, special-mission) last_attempt + completed_count (cooldown)   |
| `cr_arrivals`          | sticky team-wide GPS arrivals so any teammate's arrival unlocks all     |
| `cr_hints`             | revealed-one-at-a-time hints. `hint_type` = 'gps' or 'answer'           |
| `cr_team_hints`        | per-team counters: `hints_used` (answer) + `gps_hints_used` (gps)       |
| `cr_submissions`       | media uploaded by a team awaiting GM review                             |
| `cr_team_captures`     | legacy team-photo capture (UI now hidden)                               |
| `team_gps`             | last known position per team                                            |
| `team_freezes`         | freezer→frozen log, UNIQUE per (game,freezer,frozen) — one-shot rule    |

Schema is defined in `db/database.js` at the top. **All later changes go in
as `ALTER TABLE … try/catch` migrations** further down the file; never
modify the original `CREATE` block (existing DBs already have those
columns). Pattern is established — copy it.

Foreign keys are enabled (`PRAGMA foreign_keys = ON`), but only some tables
have explicit `ON DELETE CASCADE`. `db.deleteGame()` does manual cleanup of
the rest — when you add a new game-scoped table, **add it to that helper too**
or game deletion leaves orphans (see commit `cr_submissions` history for
the precedent).

---

## 5. API surface (rough)

All under `/api`. Auth model: **GM password** for anything mutating
settings/modes/missions; **no team auth** for the team-scoped endpoints
(known security gap, see §10).

- Settings: `/setup-status`, `/settings*`, `/update`, `/version`, `/translate`
- Catalogue: `/modes`, `/rulesets`, `/locations`, `/missions`
- Games: `/games`, `/games/:id`, `/games/:id/qr`, `/games/:id/teams`
- Per-team: `/games/:gameId/teams/:teamId{,/selfie,/missions/:mId/upload}`,
  `/games/:gameId/chat`, `/games/:gameId/rankings`
- Submissions review (regular): `/submissions/:id/review`
- CityRush: `/cr/modes`, `/cr/missions`, `/cr/hints`, plus per-game
  `/games/:id/cr`, `/cr/progress`, `/cr/complete`, `/cr/skip`,
  `/cr/special/complete`, `/cr/arrival`, `/cr/answer`, `/cr/hint`,
  `/cr/submissions/:id/review`, `/cr/captures/:id/review`
- Freeze: `/games/:id/freeze`, `/thaw`, `/freezes`
- Pending counts (notif dot): `/games/:id/pending-counts`

Socket.IO rooms in use:
- `gm_<gameId>`     — only the GM joins via `socket.emit('join_gm', …)`
- `game_<gameId>`   — all players (broadcasts go here)
- `team_<teamId>`   — single team (DMs, freeze, review results, GPS targets)

Server emits, never trusts client room joining.

---

## 6. Front-end conventions

- **Single file per surface.** Don't split components out unless there's a
  pressing reason. Easier to grep, easier to ship.
- **i18n via a hand-written `T` (or `GMT`) object per file**, four language
  blocks (`de/en/fr/it`). User-facing strings should be added to all four
  blocks; the player-side helper is `t('key')`, the GM-side helper is
  `gmt('key')`. **Always include a fallback string in the JS call site**
  (`t('foo')||'Foo'`) so missing keys still render.
- `data-tip="cr-foo"` attributes opt elements into translated tooltips via
  `applyTooltips()`. Pattern is `tip-<data-tip-value>` in `GMT`.
- The chat layout uses a `position:fixed` overlay anchored to
  `window.visualViewport.height` — this dodges the Android-keyboard
  bug. If you ever break the chat input, look there first.
- The back-arrow uses an **inline SVG chevron** wrapped in
  `<span class="back-arrow">`. Earlier attempts with the `←` Unicode
  glyph mis-centered. Keep using the SVG; don't go back to the glyph.
- `esc(...)` escapes user-controlled text before embedding in template
  strings. Every `${userText}` in `innerHTML`/template strings must use it.
- Status pills, tile flags, etc. are all CSS — `.cr-tile.{done,current,
  pending,available,upcoming}` and `body.is-frozen` for the frozen visuals.

---

## 7. Recent feature history (1.1.x)

| Tag      | Headline                                                                   |
|----------|----------------------------------------------------------------------------|
| v1.1.0   | CityRush mode added                                                        |
| v1.1.1   | Hint bug fix                                                               |
| v1.1.2   | Special missions (parallel, cooldown-limited)                              |
| v1.1.3 ① | Player upload fix on remote tunnel                                         |
| v1.1.4 ① | In-app updater fix                                                         |
| v1.1.5 ① | CR GPS radius handling, completion order, two-team locking                 |
| v1.1.6   | i18n sweep (22 missing GM keys), CR/player toasts, freeze polish           |
| v1.1.7   | Broadcast chat labels, mission padding, back-arrow alignment               |

① shipped as commits between tags; no annotated tag was published for
those because the package.json bump and commit landed in the same release.

Tag and `package.json` version should always match the most recent commit
on `main`. The pattern is `git tag -a vX.Y.Z -m "vX.Y.Z: headline"`.

---

## 8. Local + release workflow

1. Edit files in place.
2. Smoke load the server module to catch syntax errors:
   ```sh
   node -e "process.env.PORT='0'; require('./db/database.js'); require('./server.js')" &
   sleep 2 && kill %1
   ```
3. Restart the running `node server.js` to pick up the change in a real game.
4. To ship:
   ```sh
   # bump version in package.json
   git add package.json public/* db/* server.js
   git commit -m "vX.Y.Z: headline"
   git tag -a vX.Y.Z -m "vX.Y.Z: headline"
   git push origin main
   git push origin vX.Y.Z
   ```
5. The GM's "Update Now" button in Settings → Updates calls
   `/api/update`, which runs `git pull && npm install --production` and
   restarts the process. Lives in `server.js` around the `app.post('/api/update', ...)`
   block. Password-gated.

---

## 9. Known footguns

These have bitten us before; flagged here so the next person doesn't
re-discover them:

- **`db.prepare` is not exported.** Several CR helpers used it directly
  inside `server.js` and silently broke deletion. Always go through a
  helper in `db/database.js`. If you need raw SQL, add a named export.
- **Game deletion needs manual cascade** for `team_gps`, `cr_team_progress`,
  `cr_team_hints`, `cr_team_captures`, `cr_submissions`, `cr_game_links`,
  `team_freezes`. See `deleteGame` in `db/database.js`. Add new tables to
  this list when you create them.
- **Auto-translate field aliases.** The CR mission modal uses `cr-desc-*`
  textareas but the button calls `autoTranslateCrField('description')`.
  Aliases live in the `FIELD_ID_ALIASES` map in that function — extend it
  when you add another short id.
- **The narrow-viewport CSS forces `.topbar-btn { width:34px; }`** which
  can clip back-button labels. Back buttons override with
  `width:auto !important`. Repeat that pattern for any new wide-label
  topbar button.
- **Player files use shared session storage** keyed on `gameId` + `teamId`.
  Don't change those keys without a migration story.
- **The `back-arrow` SVG inherits `currentColor`** for stroke. If you
  recolour a back button, the arrow follows automatically.
- **Frozen state is sticky per-mission, not per-game.** Resetting requires
  bumping `arrivedAtMissionId = null` on advance. See `onNextMission` and
  `completeMission`.
- **`renderSpecialTiles` must be called from `crCycleLang`** so the
  language-switch repaints the special tile pills. Easy to forget when
  adding new render paths.

---

## 10. Security (not yet addressed)

Quick threat assessment from v1.1.7. Most of these are low-friction to fix
and don't affect gameplay. Targets for a **v1.2.0 "security pass"**:

| Risk                                          | Severity | Effort |
|-----------------------------------------------|----------|--------|
| XSS via user text fields (audit `esc()` use)  | High     | 15 min |
| No rate limiting on chat/freeze/arrival/etc.  | High     | 10 min |
| No per-team auth token (anyone can pose as team) | High  | 15 min |
| `cors: { origin: '*' }` on socket.io          | Medium   | 2 min  |
| No Helmet/CSP/HSTS headers                    | Medium   | 5 min  |
| Multer accepts any MIME, up to 200 MB         | Medium   | 5 min  |
| `/api/update` has no IP restriction (just password) | Medium | 10 min |
| Stack traces leak via 500 responses           | Low      | 3 min  |
| Settings + `/games/:id` returns full payload  | Low      | 5 min  |

A focused security PR landing all of A–G from the threat assessment is a
90-minute job and won't change any UX. None of this is blocking today's
gameplay, but the freeze + GPS APIs are sprayable without auth.

---

## 11. Skills + tooling installed (user-level)

The dev machine has these Claude Code skills at `~/.claude/skills/`:

- `ui-ux-pro-max` — design intelligence (67 styles, palettes, typography).
- `remotion-best-practices` — for programmatic React video creation, not
  relevant to this project but installed.

Recommended next install:

- `/plugin install context-engineering@context-engineering-marketplace`
  (after `/plugin marketplace add NeoLabHQ/context-engineering-kit`) —
  improves Claude's instruction following.

---

## 12. Things explicitly out of scope

So you don't go looking for them:

- **No build step.** Don't add webpack/vite. The single-file pages are a
  feature.
- **No TypeScript.** Same reason.
- **No tests** — game is play-tested manually by the team owner. A
  smoke-load (`node -e "require('./server.js')"`) is the only automated
  check.
- **No CI** — releases are hand-pushed by the maintainer.
- **No multi-tenant** — one instance = one game host. The setup pages
  assume the host owns the box.
- **No Capacitor / native wrapper** — purely PWA-ish over Cloudflare tunnel.

---

## 13. Quick "where do I edit X?" lookup

| You want to change…                             | Look in                                         |
|-------------------------------------------------|-------------------------------------------------|
| Anything the GM sees in the dashboard           | `public/gm.html`                                |
| Anything a player sees in regular missions      | `public/play.html`                              |
| Anything a player sees in CityRush              | `public/cityrush.html`                          |
| Schema, helpers, migrations                     | `db/database.js`                                |
| Routes, socket events, business logic           | `server.js`                                     |
| The QR/join landing                             | `public/join.html`                              |
| Shared styles (buttons, badges, chat, modals)   | `public/css/app.css`                            |
| Translations (player)                           | `T = { de:{}, en:{}, fr:{}, it:{} }` per file   |
| Translations (GM)                               | `GMT = { de:{}, en:{}, fr:{}, it:{} }` in gm   |
| Tooltips on settings                            | `data-tip="…"` + matching `tip-…` GMT keys     |
| Default radius / accuracy slack for arrival     | `checkArrival()` in `cityrush.html` (~line 1056)|
| GM map markers / freeze tags                    | `gm.html` near `_teamChipInner`                 |
| Hooks fired by the GM `Update Now` button       | `app.post('/api/update', …)` in `server.js`     |

---

*Last touched: v1.1.7 release. If you're picking this up, you've got most
of what you need — server-restart, then check `git log --oneline` to see
what shipped since this file was written.*
