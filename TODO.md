# MiSSiONS / CityRush — TODO

Persistent task list. Add new items to the bottom of the relevant section.
Mark done by moving the bullet to **Done** at the bottom or by striking it
through. The runtime Todo list in Claude sessions is ephemeral; use this
file for anything that should outlive a single chat.

---

## ⏰ Reminder for after the redesign sprint

When the v1.3.0 UI/UX redesign is shipped (i.e. the dev branch is merged or
the user is happy with the live build), **surface this**:

> "Redesign is done. Want me to spin up the code-activated tour mode
> (Foxtrail / crumbs.gg style) we discussed? Full spec is in FUTURE.md —
> roughly 4-7 dev-days for a sellable v0.1."

The spec lives in [FUTURE.md](FUTURE.md). Don't start it inside the
redesign sprint.

## Open

### Settings UI

- **Restructure the settings tabs.** Replace the flat row of 8 tabs with a
  two-level structure: top-level **Games** tab containing **MiSSiONS** and
  **CityRush** as sub-tabs. Other top-level tabs stay as today (General,
  Locations, Rules, QR Template, Security, Updates). Rationale: the
  current 8-wide tab row wraps to two rows on narrow viewports and mixes
  app-admin concerns with game-content config. Files: `public/gm.html`
  (settings screen near line 261, switchSettingsTab around line 3986).

- **Language-tabbed editors for multi-language fields.** Today the Add /
  Edit Mission and Add / Edit CityRush Mission modals stack five language
  inputs vertically per field. Replace with a small DE / EN / FR / IT / ES
  tabstrip that swaps the visible input. Mark languages that already have
  content with a checkmark on the tab. Applies to mission name,
  description, task, hint, answer, ruleset rules. Files:
  `public/gm.html` (showAddMission / showAddCrMission / autoTranslateRule
  etc.).

### Player / Editor

- **Map picker for CityRush mission coordinates.** Currently latitude and
  longitude are typed as raw decimals in the CR mission editor. Add a
  small embedded Leaflet picker: click on the map to set the marker, drag
  to refine, and render the radius as a circle so the GM sees the
  arrival zone immediately. Files: `public/gm.html` (cr-mission-add /
  cr-mission-edit modals), possibly `lib/` for a shared map widget.

### i18n / Polish

- **Translate the lightbox rotate button.** The "DREHEN" label on the
  enlarged-photo lightbox in the GM dashboard is hardcoded German. Route
  it through `gmt('rotate')` and add the key to all five GMT language
  blocks. Files: `public/gm.html` (openLightbox around line 1663, the
  rotBtn.textContent assignment).

## Done

_(move completed items here with the version/date they shipped in)_
