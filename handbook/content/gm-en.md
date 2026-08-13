---
title: "MiSSiONS Gamemaster Manual"
subtitle: "For operators running live games"
lang: en
manifest: gm-en
---

# Welcome, Gamemaster

This manual is for you if you **run live games**: greet teams, hand
them their access code, approve their photos and videos, send
broadcasts when something needs everyone's attention, freeze
caught-on-camera teams, and end the game when the clock runs out.

It's split in two parts because the app supports two distinct game
types:

- **Part 1, MiSSiONS games.** The classic mode: you start a game at
  a physical location, players join, work through a curated list of
  photo/video missions, and you approve their uploads.
- **Part 2, Rail Adventure games.** A mode built around two kinds of
  task: **Missions** (do them anywhere, no GPS) and **Checkpoints**
  (GPS targets players physically walk to). Players alternate between
  the two — a Mission, then a Checkpoint, then a Mission… — and each
  one must be GM-accepted before the next can be attempted. The
  dashboard looks similar but adds a map, GPS arrival signals, and
  special missions.

If you only ever run one of the two, you can skip the other part,
they don't overlap and each game stays in its own mode.

You do **not** need the settings password for any of this. Everything
in this manual works without it. If something on the screen needs an
admin to fix it, the manual will say so, your job is to operate, not
configure.

> Screenshots show a demo game with two teams ("Team Rot" / "Team
> Grün" for MiSSiONS; "Team Blau" / "Team Gelb" for Rail Adventure). Your
> real games will look the same with your own team names and
> missions.

::part:1:Running MiSSiONS games

# The landing screen

::shot:m-01-landing

This is where every session starts. You see one tile per location plus
a tile for Rail Adventure at the bottom. Tap the location your group will
play in, the app remembers your choice for next time.

The header buttons:

- **Version** (top-left, tiny), which build of the app is installed.
- **DE / EN** (top-right), cycles the GM interface language (covered
  in Part 1 below).
- **⚙ Settings**: opens the password gate. If you don't have the
  password, leave it alone.

# Picking a mode and starting a game

::shot:m-02-game-select

Tapping a location lands you here. The list at the bottom shows
games already created here (most recent first), each one with its
ID, creation date, status (waiting / playing / ended), and how many
teams joined. Tap **Open** on any of them to jump into its dashboard
handy when you accidentally navigated away.

To start a new game:

1. Pick a **mode** from the dropdown. The mode decides which mission
   library, ruleset, and timer the game uses. "MiSSiONS" is the
   default; admins may have added others (e.g. ADVANCED).
2. Tap **+ New game**.

The app creates the game, picks the right mix of missions for the
location, and shows you a **Dashboard open →** button plus a QR code
modal you can show or print for players to join.

# The dashboard

::shot:m-03-dashboard

Your command center for a running game. Four areas:

- **Top bar**: game ID, the **start/pause timer**, and the QR / 🎬
  / 🔔 / cog / language icons on the right. The 🎬 button is greyed
  out during play and lights up after the game ends, see *Exporting
  the game's photos and videos* below. The **🔔 bell** toggles the
  **submission sound** — a short chime plays every time any team
  submits something for review (both MiSSiONS and Rail Adventure), so
  you don't have to keep staring at the screen. Tap it to mute/unmute;
  the choice is remembered on your device.
- **Team chips**: one per team that joined, with current score. A
  **🔔** on a chip means there's something pending for that team,
  usually a submission to review.
- **Main area** (left), selected team's mission cards, or the team
  list if no team is selected.
- **Right panel**: Chat and Broadcast tabs. (Rail Adventure games add a
  third map tab here, see Part 2.)

The timer starts at the configured duration (60 minutes by default).
Tap **▶ Start** to begin counting down. Tap **⏸ Pause** to stop
the clock for everyone. Pause is for **technical difficulties or
emergencies only** (server hiccup, lost network, real-world
incident); do not use it for casual breaks. **Restart** sets the
timer back to full.

> **Nothing counts until you press Start.** While the clock hasn't
> been started, teams can look around their app, but every attempt to
> hand something in is refused with a "the time hasn't started yet,
> please wait" notice — photos, videos, typed answers, scans and
> drawings alike. If a team tells you their upload won't go through,
> check the timer first: that's almost always the reason.

# Reviewing a team's submissions

::shot:m-04-team-detail

Tap a team chip to open their detail view in the main area. Each
mission they were given becomes a card. Cards with a pending upload
(like "Fountain selfie" above) light up with an orange border and
show:

- A **preview thumbnail** of what the team uploaded.
- An **Accept** (✓) and a **Reject** (✗) button.
- The mission's name, description, and task for reference.

Tap **Accept** to award the mission's points. The team gets a 👍
toast and a green checkmark on their copy of the mission.

Tap **Reject** to refuse. A dialog asks for a reason (covered next).

## Enlarging an image

::shot:m-05-lightbox

Tap the thumbnail itself to open the lightbox, the image fills the
screen so you can actually judge whether the team did the task. Two
controls float in the top-right:

- **↻ Drehen / Rotate**: rotates the image 90° clockwise per click.
  Most useful for photos taken in portrait but stored in landscape,
  or vice versa. The rotation only affects what you see, it doesn't
  alter the saved file.
- **✕**: closes the lightbox. You can also tap the dark backdrop.

::shot:m-06-lightbox-rot

The same photo after one **↻ Drehen / Rotate** click. Keep tapping to
rotate further (180°, 270°, back to 0°). Once you've decided, close
the lightbox and use Accept or Reject on the card.

For videos, the lightbox shows a player instead of a still image,
no rotate button needed since video carries its own orientation
metadata.

## Rejecting

::shot:m-07-reject-modal

If you tap **Reject**, this small dialog opens. Type a short reason
**the team sees this text** in their player chat, so be honest and
specific. Examples that work: "Too dark, please retake near the
lamppost", "Wrong fountain, try the one outside the church", "Half
the team is missing".

Press **Reject & notify** to confirm. The team gets a 👎 toast, the
upload is deleted from storage, and the mission becomes available
to upload again.

Your reason is also **posted into that team's chat**, tagged with the
mission it belongs to. That matters in practice: the toast disappears
after a few seconds, and a team that was walking or filming often
misses it. In the chat it stays readable, and — because the mission
name is on it — a team with several rejections can still tell which
one you meant. You don't have to repeat yourself in a separate chat
message; it's already there.

If a player accidentally uploaded a selfie or a chat photo instead
of the mission photo, you'll see it on the mission card too, just
reject with "wrong upload" and the team can retry.

## Deleting a team

In a team's detail view, next to **❄ Freeze**, there's a **🗑 Delete**
button. It permanently removes that team and everything tied to it —
progress, submissions, chat, GPS, rankings entry. Use it for the
**empty/ghost teams** that sometimes get left behind when a join
half-fails, or a duplicate someone created by mistake.

It asks for confirmation first because **it can't be undone**. Don't
use it on a team that's actively playing — there's no recovery and
they'd have to re-join from scratch.

# Broadcasting to everyone

::shot:m-08-broadcast

Switch the right panel to **Broadcast**. Type a message and tap
**📢 Send to all**. Every team's chat window gets the message at
once with a small "Broadcast" tag so they know it's not aimed only
at them.

Use it for things like:

- "5 minutes to game end, head back to the meeting point!"
- "Quick rain shower, feel free to step into a doorway."
- "Server hiccup, timer paused for two minutes, sorry for that."

Individual feedback belongs in the **Chat** tab; broadcast is for
everyone.

# Per-team chat

::shot:m-09-chat

The default tab in the right panel is **Chat**, scoped to whichever
team is currently selected in the main area. Type a message, hit
Enter or **Send**, and the team sees it in their player chat.

When a team writes to you, their chat tab badge lights up with an
orange dot. Switch to the team that wrote, read the message, reply.
The dot is per-team, you can have unread messages from one team
while another team's chat is in front of you.

# Guided tutorials (🎓)

The **🎓** button sits on the landing screen and again in the
dashboard top bar. It opens a short list of guided tours that walk you
through the interface with **coach marks** — a highlight around the
thing being explained, plus a caption, one step at a time.

Use the tours when you're new to the app, or when someone hands the
GM role over to you mid-season. They're read-only walkthroughs: you
can leave at any step with **Close**, and nothing you do inside a tour
changes a real game.

One tour explains the inside of a running game. Because it needs a
team to point at, it quietly creates a **demo team**, shows you the
review flow on it, and **deletes that team again** when the tour ends.
If you abort halfway through, the demo team may stay behind — it's
named "Demo", and you can remove it with 🗑 Delete like any other.

The tours don't need the settings password.

# The update notice: what a new version brings

When a newer version is available, the app greets you with an
**⬆ Update available** dialog. Next to the version numbers there's a
collapsible **What's new in …** block listing what the update
contains, sorted into **Added**, **Changed** and **Fixed**, with the
number of entries next to the title.

Open it before you decide. It's the difference between "some update"
and "this one fixes the thing that annoyed us on Saturday". Installing
the update itself needs the GM password, and the app refuses while any
game is still running or waiting — finish your games first.

# Things you can't do without the password

::shot:m-10-settings-gate

This is what you see if you tap the **⚙** cog and don't have the GM
password. Anything behind this door is admin-only:

- Adding/removing locations or missions
- Editing rules
- Changing the QR template or the GM password
- Updating the app

If you find a mission with wrong info or a rule that should change,
note it down and ask whoever runs your installation to update it
between sessions.

::part:2:Running Rail Adventure games

Rail Adventure splits a team's work into two kinds of task:

- **Missions** — done anywhere, no GPS needed. Players see these
  first.
- **Checkpoints** — GPS targets. The team physically walks to the
  spot and completes the task within a set radius.

Players **alternate**: a Mission, then a Checkpoint, then a Mission,
and so on. Crucially, **each task must be accepted by you before the
next one can be attempted** — if a team submits a photo for a
Mission, they can read the next Checkpoint but cannot complete it
until you've accepted (or rejected) that Mission. Checkpoints stay
locked until the team has finished a Mission, and vice-versa.

Everything you know from MiSSiONS still applies — the dashboard, the
team chips, chat, broadcast, the freeze tool, the lightbox — but the
game starts differently and there's an extra **map** tab.

> "Rail Adventure" is now **on by default** when you create a new
> mode (it's a toggle in the mode editor, settings-side). A mode with
> it switched off behaves like a plain ordered list with no
> Mission/Checkpoint split.

# Starting a Rail Adventure game

::shot:cr-01-landing

Tap the **Rail Adventure** tile at the bottom of the landing screen
instead of one of the regular locations. The tile shows a runner
icon and a count of available Rail Adventure modes underneath.

::shot:cr-02-game-select

The game-select screen for Rail Adventure works like the MiSSiONS one,
but the dropdown is the **Rail Adventure mode** picker (Altstadt-Tour in
this demo) instead of the mode-per-location picker. Pick a mode,
tap **+ New game**, and the app generates the QR + dashboard.

# The Rail Adventure dashboard

::shot:cr-03-dashboard

The dashboard layout is identical to MiSSiONS, team chips at the
top, mission cards in the main area when you select a team, the
chat / broadcast / map panel on the right. The Chat and Broadcast
tabs work exactly the same way they do for MiSSiONS games.

The differences are all in the **mission cards** and the **🗺️
map** tab.

# A Rail Adventure team's missions

::shot:cr-04-team-detail

A Rail Adventure team's detail view is split into **two columns**:

- **⚡ Missions** — the no-GPS tasks.
- **📍 Checkpoints** — the GPS targets.

This mirrors what the players see, so you can follow along. Each card
works like a MiSSiONS card (name, task, points, status pill, and the
Accept ✓ / Reject ✗ buttons once there's a submission to review).

A few Rail-Adventure-specific things:

- **⭐ Special** missions sit with the Checkpoints column; they're not
  part of the alternation and can be done any time.
- A Checkpoint's task stays hidden until the team **physically
  arrives** within its radius — until then you (and they) only see the
  description.
- Because of the **alternation + acceptance rule**, accepting a card
  is what lets the team move on. If you leave a submission pending,
  that team is stuck until you act on it — so keep an eye on the 🔔
  pending badge.

Acceptance, rejection, lightbox, and rotate all work exactly like in
MiSSiONS — see the m-04 through m-07 shots in Part 1. **A photo or
video stays viewable after you accept it**: the thumbnail remains on
the card, tap it to reopen the lightbox.

**🎨 Draw missions** arrive here too. A team's finished drawing shows up
as an image submission — accept or reject it exactly like a photo. (If a
Draw mission was set to *not* need approval, it's auto-accepted and you
won't have to act on it; it still lands in the gallery and collage.)
Collaborative drawings come in as a single submission from the team even
though several players drew on it together.

**Cards that never reach you.** Some mission types are decided by the
app, not by you, and simply flip to done on the card:

- **Quiz** — the team types an answer. The app compares it against
  every accepted spelling the mission was given, in any language, and
  awards the points itself.
- **📷 Scan** — the team points their camera at a QR code or a printed
  image. Scanning can complete the mission, reveal a hidden task, or
  collect one of several fragments.
- **🧩 Puzzle** — solving it completes the mission.

You'll see these turn green without a review step. That's expected —
there's no upload to judge. If a team insists they solved one and the
card didn't move, the usual causes are the clock (see Part 1) or, for
a Scan, a code that's damaged or from a different game.

# The map panel

::shot:cr-05-map

Switch the right panel to **🗺️** to see the live map. Markers are
the Checkpoint targets. Team-position dots appear as they move
(assuming they granted location permission in their player view).

The markers are **colour-coded by state** rather than numbered, so you
can read the board at a glance: green for done, orange for waiting on
your review, and the neutral colour for still open. Numbers were
dropped on purpose — with the Mission/Checkpoint alternation, teams
don't walk a fixed order, so a number would have implied a sequence
that doesn't exist.

A frozen team is marked with an **❄ ice marker**, so you can see who's
currently sitting out without opening their card.

Special missions don't appear on the map, they have no fixed
location.

The map has a **fullscreen toggle** (top-right) to expand it into the
full main area; tap again to restore. Use fullscreen when you want
to see where every team is at once.

> Special missions intentionally have no GPS target. If you've
> configured one without coordinates, it lives in the player's ⭐
> tray, not on this map.

# Freezing a team that got caught on camera (Rail Adventure only)

::shot:cr-06-freeze

The **❄ Freeze** button is a Rail Adventure only PvP mechanic built
around getting caught on camera. The workflow:

1. Team A spots Team B somewhere on the route and takes a photo
   of them.
2. Team A submits that photo to you as a mission upload (or via
   chat, depending on how you've set it up).
3. You verify Team B is genuinely in the photo and accept the
   submission.
4. You open **Team A's** detail (the photographer, who is the
   freezer) and tap **❄ Freeze**. In the modal, pick **Team B** as
   the target and a duration (1, 3, 5 or 10 minutes), then confirm.

The currently-selected team in the main area is always the
**freezer**; the modal then picks which **other** team to freeze.
Don't get this backwards: opening Team B's detail first would mean
Team B becomes the freezer, which is the opposite of what you
want.

While frozen, Team B sees a "you're frozen, the GM will thaw you
in N minutes" overlay; their timer stops, they cannot upload
anything, and they cannot claim arrivals at map targets. Team A
has used their one freeze shot against Team B (see below).

This is the **only** legitimate use of the freeze button. Do not
use it as a neutral pause, a generic punishment, or a way to give
a team a break.

Why Rail Adventure only? In MiSSiONS games every team works through
their own list at a single location, so there's nothing to catch
each other doing. Rail Adventure teams share a route, which is why the
caught-on-camera mechanic exists in the first place.

A reminder on the modal direction: you open it from the freezer's
detail view (Team A in the story above). The modal then asks which
other team to freeze (Team B). The team whose detail you're on is
never the team that ends up frozen. Tap **Freeze** to confirm.
Teams thaw automatically when the timer expires, or you can
**Thaw** them early with the 🔥 button that replaces the freeze
button while a team is frozen.

Each team can freeze any rival **once per pair**: the picker greys
out rivals the freezer has already used their shot on. It's a
one-time weapon per pair, not a constant nuisance.

---

## End-of-game checklist (both modes)

When the timer hits zero (or you tap **End game** early), the app:

- Shows your end-of-game message to every player.
- Freezes the scoreboard / rankings.
- Marks the game as "ended" in the dashboard list.

Before walking away:

1. Take a screenshot of the **Rankings** in the right panel, handy
   for the prize ceremony if you don't trust the players to
   remember. A team that finished **all** its available missions
   shows a small green **🏁 time-left** figure under its score — how
   much was left on the clock when they finished. Use it as the
   tie-breaker when two teams end on the same points (more time left
   = faster = higher).
2. Reject or accept any leftover pending submissions, don't leave
   them hanging.
3. If a team had a bad-faith upload (off-topic, inappropriate), tap
   **Reject** with a reason, the upload is removed from storage.

You can leave the dashboard open and return later, ended games
stay in the game list under their location (or under Rail Adventure).

---

## Exporting the game's photos and videos

Once the game has ended, the **🎬** icon in the top-right of the
dashboard lights up. Click it to open the export panel:

- **📦 Download ZIP (all media)**: streams every accepted photo and
  video for every team straight to your browser as
  `missions-<game-id>.zip`. Inside, each team has its own folder
  containing the team selfie and every approved submission, named
  in acceptance order so the chronology is preserved. This is the
  archival deliverable, give it to the customer or stash it for
  your records.
- **🎬 Render photo collage**: kicks off a server-side render of a
  single MP4 slideshow. Each team gets a title card showing their
  name, followed by their accepted photos in order (about two
  seconds per photo). Videos are **not** in the collage, only in
  the zip, because re-encoding team videos into a slideshow makes
  for a much longer render. A progress bar shows render status;
  when done the MP4 downloads automatically.

A few practical notes:

- The render runs on the server. You can close the modal once it
  starts; reopening it later picks up where it left off if the
  render is still going.
- A typical game with 30–40 accepted photos renders in 30–60
  seconds.
- The export covers **accepted** media only. Rejected uploads are
  already deleted from storage at the moment of rejection, so they
  cannot resurface here.
- Rendering again replaces the previous collage. The zip is
  generated fresh on each download.

---

## Common questions

**A team says they uploaded a video but nothing shows up.**
Check the team's detail view, sometimes a video upload fails
silently due to a bad connection. Have them re-upload from inside
the mission card.

**The team's phone says "frozen" but I never froze them.**
A teammate may have triggered an automatic freeze (e.g. by trying to
submit twice in a row). The dashboard shows the active freeze and a
🔥 thaw button to release them.

**A team joined the wrong game.**
Each game has its own join URL/QR. If you handed them the wrong
code, end that game (or just ignore it) and have them re-join the
right one. There's no migration, they have to start over.

**A Rail Adventure team can't do the next task.**
Two common causes. (1) **Alternation** — they just finished a Mission,
so the next thing must be a Checkpoint (or vice-versa); the off-turn
column is locked on purpose. (2) **Waiting on you** — they submitted a
photo/video and it's still pending; nothing else unlocks until you
Accept or Reject it (watch the 🔔 badge). For a *Checkpoint*
specifically, they also have to be physically inside the target radius
— check the map panel; if their dot is in the circle and it still
won't unlock, their GPS accuracy is poor, so have them step into the
open and wait a few seconds.

**A team is stuck — can't skip a task they can't do.**
Missions and Checkpoints are **not skippable by default**. Skipping is
a per-mission option an admin turns on in the editor ("Skippable"). If
a task is genuinely impossible (closed venue, missing prop), accept a
best-effort attempt, or note it for the admin to mark skippable next
time.

**Players say they can't see missions in their language.**
Each player picks their own language on the join screen. If it's
wrong on their device, they tap the 🌐 button in their player view,
not on the GM dashboard.

**Can I run two games at the same location simultaneously?**
Yes, the dashboard for each is independent. Just make sure each
team joins the correct game ID.
