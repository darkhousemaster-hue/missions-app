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
- **Part 2, Rail Adventure games.** A GPS-driven mode where players
  physically walk to map markers, arrive at each target, and complete
  the task there. The dashboard looks similar but adds a map, GPS
  arrival signals, and special missions.

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
  / cog / language icons on the right. The 🎬 button is greyed out
  during play and lights up after the game ends, see *Exporting
  the game's photos and videos* below.
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

If a player accidentally uploaded a selfie or a chat photo instead
of the mission photo, you'll see it on the mission card too, just
reject with "wrong upload" and the team can retry.

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

Rail Adventure is the GPS-driven game type. Instead of doing missions at a
single location, players physically walk between targets on a map,
arrive within a set radius, then complete the task there. Everything
you know from MiSSiONS still applies, the dashboard, the team
chips, the chat, the broadcast, the freeze tool, the lightbox, but
the game starts differently and there's an extra **map** tab.

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

Each Rail Adventure mission card looks similar to a MiSSiONS card with a
few extra bits:

- A **sequence number** on the left (`1`, `2`, `3`…), Rail Adventure
  missions are ordered, and players unlock them one at a time. A
  team must arrive at mission 1 before mission 2 is even visible.
- A **⭐** prefix on **special missions**, these don't follow the
  sequence; players can do them any time from a separate tray.
- A **❔ status** when the team hasn't arrived yet, replaced by the
  actual task and an Accept/Reject UI once they're on site and have
  submitted media or an answer.

Acceptance, rejection, lightbox, and rotate all work exactly like
in MiSSiONS, see the m-04 through m-07 shots in Part 1.

# The map panel

::shot:cr-05-map

Switch the right panel to **🗺️** to see the live map. Markers are
the mission targets, the order they're walked. Team-position dots
appear as they move (assuming they granted location permission in
their player view).

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
   remember.
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

**A Rail Adventure team can't see the next mission.**
They probably haven't physically arrived within the radius of the
current target. Check the map panel, their dot should be inside the
target circle. If it is and the mission still hasn't unlocked, their
location accuracy may be too poor; have them step into the open and
wait a few seconds.

**Players say they can't see missions in their language.**
Each player picks their own language on the join screen. If it's
wrong on their device, they tap the 🌐 button in their player view,
not on the GM dashboard.

**Can I run two games at the same location simultaneously?**
Yes, the dashboard for each is independent. Just make sure each
team joins the correct game ID.
