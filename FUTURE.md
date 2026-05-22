# MiSSiONS — Future feature backlog

Ideas + half-spec'd features that are NOT in the current sprint. Keep them
here so they don't get lost. When a feature gets picked up, move it into
TODO.md (or straight to a versioned commit) and delete it from here.

---

## Code-activated self-paced tour mode (Foxtrail / crumbs.gg style)

**One-line pitch:** a third game type alongside MiSSiONS and CityRush:
a phone-only, code-activated, GM-less tour the customer buys on the store
and starts whenever they want.

### Why it's a good fit for this codebase

CityRush already handles:
- Linear missions with GPS targets
- Multi-language content, auto-translate
- Hints (GPS-side + task-side)
- Answer-based auto-acceptance (the `has_answer` / `answers` fields)
- Mission ordering / progress per team

The new mode is largely "CityRush with no GM, with a code gate, and with a
cleaner self-paced finish flow."

### Player experience

1. Customer buys "Old Town Zürich Tour" on your store, gets a 6-8 char code
   (printed on a card, in an email, or QR on a scratch sticker).
2. They open `tour.html` (or scan a QR that prefills the code) and type or
   scan it.
3. Code redeems server-side. Server validates: code exists, not yet redeemed
   OR within a per-tour grace window.
4. Player picks language (from the tour's allowed_langs list).
5. Tour intro screen: name, expected duration, "Start" button.
6. They walk the linear sequence of missions, exactly as CityRush works.
   Photo/video/answer auto-accept on the device. No GM review.
7. Finish screen: score + souvenir collage (re-use the v1.2.0 collage
   builder) + share button for social.

### GM/admin side

- New "Tours" settings tab (or 3rd Games sub-tab):
  - Define a tour (set of missions, name, default duration, allowed_langs)
  - Generate a batch of codes ("Generate 50 codes for SKU TOUR-ZURICH-01")
  - Export the batch as CSV (one column: code) for the store integration
  - Analytics: codes sold / codes redeemed / completion rate / abandon points
- No live dashboard during play — players are autonomous.

### Data model sketch

```sql
CREATE TABLE tours (
  id INTEGER PRIMARY KEY,
  name TEXT,
  allowed_langs TEXT DEFAULT 'de,en,fr,it,es',
  timer_default INTEGER DEFAULT 90,    -- soft target, not enforced
  ruleset_id INTEGER,
  created_at INTEGER
);

CREATE TABLE tour_missions (  -- effectively a copy of cr_missions scoped to tour_id
  id INTEGER PRIMARY KEY,
  tour_id INTEGER,
  order_index INTEGER,
  name_de TEXT, name_en TEXT, ... (the usual 5-lang fields)
  -- lat, lng, radius, hints, answer columns same as cr_missions
);

CREATE TABLE tour_codes (
  id INTEGER PRIMARY KEY,
  tour_id INTEGER,
  code TEXT UNIQUE,          -- e.g. "ZURI-TR1K-D8MX"
  sku TEXT,                  -- product SKU from your store
  batch_id TEXT,             -- which generation batch this came from
  status TEXT DEFAULT 'unused',  -- unused | redeemed | revoked
  redeemed_at INTEGER,
  redeemed_session TEXT
);

CREATE TABLE tour_runs (
  id INTEGER PRIMARY KEY,
  code_id INTEGER,
  session_key TEXT,          -- player's anonymous device key
  lang TEXT,
  current_mission_id INTEGER,
  score INTEGER DEFAULT 0,
  started_at INTEGER,
  completed_at INTEGER
);

CREATE TABLE tour_run_progress (
  run_id INTEGER,
  mission_id INTEGER,
  status TEXT,               -- pending | done | skipped
  completed_at INTEGER,
  PRIMARY KEY (run_id, mission_id)
);
```

### New endpoints

- `POST /api/tours/redeem`           — code → tour_run_id
- `GET  /api/tours/runs/:id`         — current state
- `POST /api/tours/runs/:id/answer`  — submit answer, server validates, returns next mission
- `POST /api/tours/runs/:id/arrival` — GPS arrival event
- `POST /api/tours/runs/:id/finish`  — explicit finish, returns score + collage URL
- Admin: `POST /api/tours/codes/generate`, `GET /api/tours/:id/analytics`

### Store integration

Three options, ordered by complexity:

1. **Physical scratch cards / printed inserts** — pre-generate a batch,
   stock them in your shop or via a partner. Zero integration.
2. **Stripe Checkout** — webhook fires on payment, server generates a code,
   emails the buyer. Half a day of glue code.
3. **Shopify / WooCommerce digital product** — same pattern, plugin or
   webhook. Half a day.

### Effort estimate

- Foundational DB + redeem flow: 1-2 days
- Self-paced player UI (`public/tour.html`): 1-2 days
- Admin / code batch UI: 1 day
- Store integration (one path): 0.5-1 day
- Polish, i18n, tests: 1 day

**Total: 4-7 focused dev-days for a sellable v0.1.**

What makes it bigger if you go premium:
- Offline mode (IndexedDB + service worker): +1-2 days
- Multiplayer self-paced (1 code, family of 4): +1 day
- Achievements / streaks / leaderboards: +1+ days

### Open questions for the customer

- Single code = single device, or single code = N devices on same tour run?
- Code expiry: never, or N days after first redemption?
- Refund policy: revocable codes?
- Languages: tour-level allow-list (like CR mode) or global?
- Souvenir media: photos opt-in for the collage, or always saved?

---
