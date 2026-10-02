# AdventureTrail

A self-guided, game-master-less story trail. Teams redeem a key, walk a city,
unlock stations by answering what they found there (or by GPS), and follow a
continuous story with ARG artefacts along the way.

This is an **experiment**. It is built so it can be removed in five minutes
without touching MiSSiONS or Rail Adventure.

---

## How it is isolated

Everything lives behind four hard boundaries.

| Boundary | Rule |
|---|---|
| **Files** | All server code is in `at/`. Two pages, `public/at-studio.html` and `public/at-play.html`. The only other touch is three marked blocks in `public/gm.html` that hang the studio in the settings sidebar. |
| **Database** | Every table is prefixed `at_`. No AdventureTrail column is ever added to an existing table. |
| **Routes** | Everything is under `/api/at/*`. No existing route is modified. |
| **Uploads** | Everything lands in `uploads/at/`. |

The dependency only ever points one way: `server.js` hands this module what it
needs (`db`, `io`, `upload`, `UPLOAD_DIR`, `isGmAuthed`). This module never
reaches back into server internals, and nothing in MiSSiONS imports from `at/`.

The mount in `server.js` is wrapped in a `try/catch`, so a half-deleted or
broken module logs a line and the rest of the app still boots.

## Turning it off

```
AT_ENABLED=0
```

in the environment. The routes are never mounted and the two pages 404. The
tables stay, so nothing is lost.

## Removing it for good

1. Delete the folder `at/`.
2. Delete `public/at-studio.html` and `public/at-play.html`.
3. In `server.js`, delete the block marked `── AdventureTrail ──`. It is six
   lines and touches nothing else.
4. In `public/gm.html`, delete the three blocks marked
   `AdventureTrail · experimental`: the sidebar button, the `stab-advtrail`
   panel, and the lazy-load hook in `switchSettingsTab`. About a dozen lines.
5. Delete `uploads/at/`.
6. Drop the tables, if you want the space back:

```sql
DROP TABLE IF EXISTS at_run_progress;
DROP TABLE IF EXISTS at_runs;
DROP TABLE IF EXISTS at_keys;
DROP TABLE IF EXISTS at_assets;
DROP TABLE IF EXISTS at_hints;
DROP TABLE IF EXISTS at_edges;
DROP TABLE IF EXISTS at_nodes;
DROP TABLE IF EXISTS at_trails;
```

Step 6 is optional. Leaving the tables costs nothing and keeps the door open.

`public/js/dialog.js` stays. It belongs to the main app, which uses it on every
screen; AdventureTrail only borrows it.

## The test key

`1898` always works and never runs out. Every redemption starts a fresh run on
the trail being edited, or else the newest live one, so a trail can be walked
again and again without minting anything. Real keys stay single use: redeeming
one twice returns the same run, which is what lets a team reload mid-trail.

## What is here

- `db.js` schema and data layer. Creates its own tables on first require.
- `routes.js` the Express router, mounted once.
- `samples/` two 3D objects (a chest, a key) a manager can pick to try AR,
  and the script that builds them (`node at/samples/build-samples.js`).
- `public/at-studio.html` the trail editor (GM-gated).
- `public/at-play.html` the player app.

## Design decisions worth knowing before changing anything

- **The answer is the primary key to a station**, not a QR code. A team can
  only know what is carved on the facade by standing in front of it, so the
  answer proves arrival with no permission, no battery and nothing on the wall
  to sticker over. GPS and QR are alternatives per station, not the default.
- **GPS is pulled, never watched.** iOS suspends JavaScript and closes the
  socket when the screen locks, so a background watch is impossible. Position
  is read when the team taps, with the screen on, and several samples are taken
  before judging.
- **Nothing a human must review can block progress.** There is no game master.
  Photos are collected for the ending, never gating.
- **Hints release themselves** on time at the post, and the last one resolves.
- **A Peilung owns nothing.** No trigger, no answer, no radius, no coordinates.
  It reads the location of the next connected node, so moving a station moves
  every bearing that leads to it and there is nothing to keep in sync by hand.
  Its inspector offers only the two things it actually has.
- **Only a station or a riddle is solvable.** Every other kind is created with
  no trigger, because a start, a story beat or an ending is walked past rather
  than answered.

See `C:\projects\story-trail\research\FINDINGS.md` for the research these came
from.
