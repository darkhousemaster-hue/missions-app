---
title: "MiSSiONS Settings Manual"
subtitle: "For administrators with the GM password"
lang: en
manifest: settings-en
---

# Welcome

This manual covers every screen behind the **Settings** door of the
MiSSiONS app. It's organised in three parts:

- **Part 1, Administration.** The bits that aren't tied to a game type:
  the password gate, the public URL, security, updates, the QR
  template you print for player access, and the collage + profanity
  options.
- **Part 2, MiSSiONS configuration.** Locations, modes, missions, and
  the rules players see in-game. This is the bulk of day-to-day work.
- **Part 3, Rail Adventure configuration.** A separate game type with its
  own modes, GPS-targeted missions, hints, and special missions.

Rail Adventure is intentionally split out, it shares the settings shell but
has its own logic (GPS targets, hint sequences, special missions) that
doesn't apply to MiSSiONS games. If you only ever run one of the two,
you can skip the other part.

The password to enter settings is held by whoever installed the app
and should not be shared casually, anyone with it can change every
rule, mission, and the password itself. The default after a fresh
install is `admin1898`; change it on the Security tab as soon as
possible.

> The screenshots in this manual were captured on a clean demo
> database seeded with three locations (Altstadt, Stadtpark,
> Hauptbahnhof), six missions, and a Rail Adventure mode with three
> missions. Your real installation will look the same but show your
> own data.

::part:1:Administration

# The password gate

::shot:adm-01-gate

Tap the cog icon in the top-right of the landing screen. You'll see
the password gate above. Type the GM password and press **Unlock**
(or hit Enter). Wrong password? The field shakes and a red error
appears beneath. Press **Back** to return to the landing screen.

Every settings tab sits behind this gate, so anyone you don't trust
with full admin access shouldn't have the password.

# General

::shot:adm-02-general

**Public URL.** The address players use to reach your game. When you
run `start-tunnel-windows.bat`, the bundled Cloudflare quick tunnel
prints a URL like `https://abc-def-ghi.trycloudflare.com`. Click
**Detect** and the app finds that URL automatically. You can also
paste it manually if you host the app some other way.

**End-of-game message.** When a game's timer runs out, this message
is shown to every player. Type it once per language, the **🌐 Auto**
button fills in the empty languages from whichever language you
started in. Save before leaving the tab.

# Security

::shot:adm-03-security

Change the GM password. Type your current password, then the new one
twice. The new password takes effect immediately and applies to every
operator on every device, make sure you have a way to communicate
it out before changing it.

# Updates

::shot:adm-04-updates

The app can update itself directly from GitHub. Set the **GitHub
repository URL** once (e.g. `https://github.com/you/missions-app`);
the **Version** field shows the currently installed version. Press
**Update now** and the app runs `git pull && npm install --production`
and restarts itself. Output appears in the box below so you can confirm
what changed.

**Be careful with this in the middle of a live game**, the restart
will briefly drop every player's connection. They reconnect
automatically, but it's still disruptive. Update between sessions, not
during them.

# QR template

::shot:adm-05-template

For locations where you print physical access cards (a folded sheet
with your branding plus a QR code), upload your template PNG here and
drag the orange QR marker to where the code should land. Pick a paper
size first, A4 by default. **Save position** persists the marker, and
**Delete template** clears the upload. When a GM creates a new game,
the QR is rendered onto this template at the position you set.

# Collage

The end-of-game **photo collage** (the MP4 slideshow the GM renders
after a game) has its own settings tab. Here you tune the **timing** —
how long each photo holds on screen and the crossfade between photos —
and the title card. The defaults are sensible; change them only if the
finished slideshow feels too fast or too slow. These values apply to
every collage rendered from then on.

# Profanity filter

Team names are checked against a built-in multi-language bad-word list
when players join, so groups can't enter slurs or obscenities. This
tab has an **enable toggle** (on by default) and a **custom words**
box where you can add your own banned terms (one per line), merged
with the built-in list. Turn the filter off only for a closed, trusted
group.

::part:2:MiSSiONS configuration

# Locations

::shot:m-01-locations

A **location** is a physical place where games take place. The seeded
demo has three: Altstadt, Stadtpark and Hauptbahnhof. Each location
has its own mission library, when a GM starts a game at "Altstadt",
players get Altstadt's missions plus any **Pool** missions (missions
tied to no specific location).

Use the **+ Location** button (top of the list) to add a new one.
Click **Edit** on a card to change name or rules. **Delete** removes
the location and **all its missions**, confirm carefully.

::shot:m-02-locations-add

The Add Location dialog:

- **Name**: what the GM sees when picking a location.
- **Min. location MiSSiONS**: when starting a game, the engine
  guarantees this many missions are pulled from this location (the
  rest come from the pool). Use it to make sure games always feel
  location-appropriate.
- **Allow photo / video / indoor**: whether missions of those kinds
  can be selected from this location. Turning off "indoor" is useful
  for outdoor-only locations where the weather is reliable.

# Modes and the mission library

::shot:m-03-missions

The mission library is split by **mode** (the top bar, MiSSiONS,
ADVANCED, etc.) and by **location** (the dropdown). A mission belongs
to exactly one mode and either one location or to the global Pool.

**Mode tabs.** Each mode is a separate mission library tied to a
ruleset and a timer. Click **+ Mode** to add one. Click ✎ to edit a
mode's name, ruleset or default duration. The first mode ("MiSSiONS",
id 1) cannot be deleted, that's the safe default.

**Location filter.** "All" shows everything in the current mode; pick
a location to see just its missions; **Pool** shows only mode-wide
missions with no location.

**Bulk actions.** Tick the checkboxes on missions, then use the
toolbar that appears: **Copy to mode…** to duplicate missions into
another mode, or **Export** to download a JSON file you can import
elsewhere.

**Import.** The **⬆ Import** button reads a JSON file with the same
shape Export produces, handy for moving missions between
installations.

::shot:m-04-mission-add

Each mission has five language fields for its name, description, and
task. Don't try to fill all five yourself, write one language
properly, then click **🌐 Auto** at the top of the name section to
fill the rest automatically. Edit afterwards if the translation needs
polish.

- **Location**: restricts the mission to one location (or leave it
  on Pool for any).
- **Mode**: usually pre-selected to whatever mode you were viewing.
- **Media type**: photo or video. Players will be locked into that
  format when they submit.
- **Points**: how many points the team gets when you approve their
  submission. Penalties for late uploads are subtracted from this.
- **Also indoor**: set when the mission can be done inside (rain
  backup missions). Locations that have "allow indoor" off will skip
  these even if they're in the mode.

The **Description** and **Task** tabs:

- **Description** is the story/context shown above the camera button.
- **Task** is the explicit "do this" instruction, keep it short.

Click **Save** when you're done. The mission appears in the list
immediately.

# Rules

::shot:m-05-rules

A **ruleset** is a list of rules shown to players in the in-game
Rules modal. The seeded **Standard** ruleset cannot be deleted, but
you can add others (e.g. a family-friendly variant) and assign
different rules to different modes.

For each rule line you can use the placeholders `[photo]`, `[video]`,
`[indoor]`, they expand to small icons in the player view. Drag
rules up and down to reorder; the 🌐 button on a rule auto-translates
it; the ⎘ button copies a rule to another ruleset. Press **Save**
when done, unsaved edits are highlighted.

::part:3:Rail Adventure configuration

Rail Adventure is a separate game type. A mode here can run in the
**Rail Adventure** format (the default): the team's tasks are split
into **Missions** (no GPS, done anywhere) and **Checkpoints** (GPS
targets they walk to), and players alternate between the two with each
task GM-accepted before the next. The settings panel mirrors the
MiSSiONS layout but adds per-mission fields for coordinates, hint
sequences, the Mission/Checkpoint placement, and special missions.
Modes and missions configured here are **only** offered when the GM
starts a Rail Adventure game, they don't appear in MiSSiONS games and
vice versa.

# Rail Adventure modes

::shot:cr-01-modes-empty

The Rail Adventure tab works like the MiSSiONS tab: a row of mode tabs at
the top, then the missions belonging to the active mode below. Click
**+ Mode** at the right of the mode bar to create a new Rail Adventure
mode.

::shot:cr-02-mode-add

A Rail Adventure mode carries its own:

- **Name**: what the GM picks from the dropdown when starting a
  game.
- **⚡ Rail Adventure** toggle: **on by default**. On = the
  Mission/Checkpoint alternation format described above. Off = a plain
  ordered list with no split (legacy behaviour). Leave it on unless
  you specifically want the old linear style.
- **Ruleset**: the same ruleset list as MiSSiONS, but the rules
  apply to this mode's games.
- **Allowed media**: photo, video, or both. Affects which media-type
  missions are allowed in this mode.
- **Allowed languages**: which of the five languages players may use
  in this mode. Leave **all** ticked unless the content is only
  written in some — a single language would strand players in it with
  no switcher, so the player app treats "fewer than two" as "all".
- **Default duration (minutes)**: the timer the game starts with.

# Rail Adventure missions

::shot:cr-03-mission-add

A Rail Adventure mission has every field a MiSSiONS mission has, plus a
**placement** choice and the location-aware extras.

**Placement** (the segmented control in the editor) decides what kind
of task this is — when the mode has Rail Adventure on you get three
options:

- **⚡ Mission** — no GPS. Players can do it anywhere; these are the
  non-walking half of the alternation.
- **📍 Checkpoint** — a GPS target (this is the "in the route" option).
  The coordinate/radius/map fields below apply to it.
- **⭐ Special** — outside the alternation, playable any time (see
  below).

- **GPS coordinates + radius** (Checkpoints): where the target is, and
  how close (metres) players must get before the task unlocks. Use a
  small radius (15–25 m) in dense city blocks; bigger (40–60 m) in open
  parks.
- **Show on map**: whether the target marker is visible to players.
  Turn off for "find your way using only the hints" missions.
- **GPS hints**: revealed one by one as the team walks; useful when
  the marker is hidden or the area is large.
- **Task hints**: revealed one by one after arrival, when teams are
  stuck on the task itself.
- **Media required**: photo or video; mutually exclusive with the
  answer field below.
- **Timed**: when a team taps "Start", a countdown begins.
  Penalties kick in when it's exceeded; configure the penalty
  interval and points right below.
- **Skippable** (Extras): **off by default**. Off = players have no
  skip button and must complete the task. Turn it on only for tasks
  you're happy to let teams bypass for zero points (e.g. an optional
  detour). This applies per mission.

## Answer-mode missions

::shot:cr-04-mission-answer

Toggle **Has answer** to turn the mission into a "type the right
word" challenge. The **Answer(s)** field accepts a `|`-separated
list and ignores case and whitespace, so `Eule|Owl|Hibou|Civetta`
all match. This is mutually exclusive with photo/video, pick one
mode per mission.

## Special missions

::shot:cr-05-mission-special

Choosing the **⭐ Special** placement lifts the mission out of the
Mission/Checkpoint alternation. Special missions:

- Appear in the player's ⭐ tray, playable any time, in any order.
- Skip the GPS-arrival step entirely, even if you set coordinates.
- Use a **Cooldown** (minutes) to limit re-attempts: `0` means each
  team can only play it once; `5` means five minutes between
  attempts. A GM rejection clears the cooldown immediately.

Save when you're done. Players who already started a game won't see
new missions added mid-game, push them out before launch.

## Draw missions

Pick the **🎨 Draw** mission type to have players *draw* the task on
their phone instead of photographing or answering it. Write what they
should draw in the **Task** tab — that text is shown on the drawing page
when a player taps **Mission**.

Two switches control how it works:

- **Needs GM approval** — *on by default*. The finished drawing is sent
  to your normal review queue (it behaves like a photo: accept to award
  the points and add it to the gallery and final collage; reject to let
  the team draw again). Turn it **off** to award the points the instant a
  team submits — the drawing is still saved to the gallery.
- **Collaborative** — *off by default*. Off = one person draws on the
  team's phone. On = the starting device shows a **QR code**; teammates
  scan it to join a shared, fullscreen canvas and everyone draws together
  in real time. Only the person who started (the "master") gets the
  **Submit** and **Back** buttons.

A Draw mission can be a Mission, a Checkpoint, or a Special — the
placement rules above still apply.

---

## Tips for daily operation

- Use **Auto-translate** liberally on both MiSSiONS and Rail Adventure
  missions, getting all five languages right by hand is a chore the
  AI does well enough most of the time.
- **Pool missions** (MiSSiONS only) are **filler**, not a
  rain-backup. They're still outdoor missions, the difference is
  they're not tied to a specific location, so the engine can pull
  them into any game to round out a mode that would otherwise have
  too few location-specific missions. Use the **Also indoor** flag
  on individual missions if you want them playable in bad weather;
  that's a separate property from Pool.
- For Rail Adventure, **always test the radius on foot**, the GPS in a
  phone is rarely accurate to within 5 metres in a built-up area,
  and a too-tight radius leaves teams stuck.
- **Export your missions occasionally** as a backup. The JSON is
  small, human-readable, and you can re-import after a database
  wipe.
- **Don't update mid-session.** It works, but you'll lose face with
  whoever's playing.
