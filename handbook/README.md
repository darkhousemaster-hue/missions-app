# missions-app handbook generator

Tooling for capturing annotated screenshots of the running app and producing
finished user manuals as PDFs. Lives outside `public/` so it never ships to
players.

## Layout

```
handbook/
├── README.md                 this file
├── content/                  markdown source for each manual
│   ├── settings-de.md        settings manual (German)
│   ├── settings-en.md        settings manual (English)
│   ├── gm-de.md              GM manual without settings access (German)
│   └── gm-en.md              GM manual without settings access (English)
├── pdf/                      built PDFs (gitignored, plus debug HTML)
│   ├── settings-de.pdf
│   ├── settings-en.pdf
│   ├── gm-de.pdf
│   └── gm-en.pdf
├── screenshots/              raw PNG output + per-set manifest.json
│   ├── settings-de/  settings-en/  gm-de/  gm-en/
└── scripts/
    ├── _fixture.mjs          boots server with sandbox DB + seeds demo data
    ├── capture-settings.mjs  walks every settings tab in both languages
    ├── capture-gm.mjs        walks the GM dashboard flow in both languages
    ├── capture.mjs           legacy deterministic walkthrough (still works)
    ├── stagehand-tour.mjs    AI-driven (Stagehand + Claude) walkthrough
    └── build-pdfs.mjs        markdown → HTML → PDF
```

## Producing the four manuals

```bash
# 1) capture everything (boots a sandboxed server in /tmp — never touches
#    the real DB; default password 'admin1898' is used to unlock settings)
node handbook/scripts/capture-settings.mjs
node handbook/scripts/capture-gm.mjs

# 2) render the PDFs
node handbook/scripts/build-pdfs.mjs

# done — open handbook/pdf/*.pdf
```

Each capture script boots `node server.js` with `DB_PATH` and `UPLOAD_DIR`
pointed at a fresh temp dir, seeds 3 locations + 6 missions + a CityRush
mode + a running game with 2 teams, walks every screen, and writes the
PNGs along with a `manifest.json` that the PDF builder reads.

To capture just one language: `node ... capture-settings.mjs --lang=en`.
To watch the browser run: `... --headed`.

## Editing the manuals

The markdown lives in `handbook/content/`. Each file has a small YAML
front-matter block:

```yaml
---
title:    "MiSSiONS — Settings Manual"
subtitle: "For administrators with the GM password"
lang:     en
manifest: settings-en      ← maps to handbook/screenshots/<manifest>/manifest.json
---
```

The custom directive `::shot:NAME` (on its own line, no whitespace) expands
to the matching screenshot with its caption. The caption comes from the
`desc` field in the capture script's shot list — edit the captions there
if you want them to change everywhere at once.

After editing markdown, re-run only the PDF build:

```bash
node handbook/scripts/build-pdfs.mjs              # all four
node handbook/scripts/build-pdfs.mjs settings-en  # just one
```

## Adding a new screen to a manual

1. Open the right capture script (`capture-settings.mjs` or `capture-gm.mjs`).
2. Append an entry to `SHOTS` (or to the GM script's snap sequence) with a
   unique name and a description in both languages.
3. Re-run the capture script.
4. In the matching markdown file, drop `::shot:<your-name>` where you want
   the screenshot to appear, then write prose around it.
5. Re-build the PDFs.

## Prerequisites

Installed globally on this machine (not in `package.json`):

- `playwright`
- `@playwright/mcp`  (used by Claude Code as an MCP server)
- `@browserbasehq/stagehand`

Browsers: `chromium` (downloaded by `npx playwright install chromium`).

Verify with:
```bash
node -e "require('playwright')" && echo OK
node -e "require('@browserbasehq/stagehand')" && echo OK
```

If `require()` fails inside a project that has its own `node_modules`, the
scripts add `C:/Users/darkh/AppData/Roaming/npm/node_modules` to `NODE_PATH`
before importing — no missions-app package install is needed.

## Quick start

### Deterministic screenshots (no API key needed)
```bash
node handbook/scripts/capture.mjs              # headless, default viewport
node handbook/scripts/capture.mjs --headed     # watch it run
node handbook/scripts/capture.mjs --viewport=1440,900   # desktop
node handbook/scripts/capture.mjs --base=http://localhost:3000   # use a server you already have running
```

The script boots `node server.js` on a free port, walks the screens listed in
`SHOTS` (top of `capture.mjs`), saves PNGs to `handbook/screenshots/`, writes
a `manifest.json` next to them, then tears the server down.

### Stagehand walkthrough (needs Claude API key)
```bash
# PowerShell
$env:ANTHROPIC_API_KEY="sk-ant-..."
node handbook/scripts/stagehand-tour.mjs

# Bash
ANTHROPIC_API_KEY=sk-ant-... node handbook/scripts/stagehand-tour.mjs
```

Stagehand interprets natural-language instructions (`page.act("click the
settings tab")`) — use this when the right selector is unstable or you want
the model to discover the UI itself.

## Adding a new screen

1. Open `handbook/scripts/capture.mjs`.
2. Append an entry to `SHOTS`:
   ```js
   { name: '05-cityrush-mission-open',
     path: '/cityrush.html',
     desc: 'CityRush mission detail popup',
     setup: async (page) => {
       await page.waitForLoadState('networkidle');
       await page.click('text=Open Mission');
     } },
   ```
3. Re-run `node handbook/scripts/capture.mjs`.

Use the `setup` hook for anything that needs interaction before the snap.

## Where the handbook itself goes

Not generated yet. When you ask Claude to "write the handbook", it should:

1. Read `handbook/screenshots/manifest.json`.
2. Open each PNG to see the UI.
3. Write the handbook to `handbook/HANDBOOK.md` (or wherever you point it),
   embedding screenshots with relative paths and writing prose around each.

The `manifest.json` shape is:
```json
[
  { "name": "01-landing-gm",
    "path": "/gm.html",
    "desc": "Gamemaster landing — mode + location picker",
    "file": "screenshots/01-landing-gm.png" }
]
```

The `desc` field is your prompt scaffolding for the handbook section — make
it as descriptive as you want.

## MCP usage from inside Claude Code

Once `~/.claude.json` has the `playwright` MCP server registered (already
done), restart Claude Code. New tools appear named `mcp__playwright__*` —
Claude can drive the browser interactively without invoking these scripts.

The scripts here are still useful for **reproducible** capture runs you want
to fire off without paying for AI tokens.

## .gitignore

`handbook/screenshots/` is binary output — keep it out of the repo unless
you want versioned screenshots. Sample line for `.gitignore`:
```
handbook/screenshots/
```
