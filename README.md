# MISSIONS — AdventureRooms Outdoor Game App

A real-time web app for running outdoor escape/mission games. Gamemaster controls the game; players join via QR code.

---

## Quick Start (Raspberry Pi)

```bash
# 1. Copy the missions-app folder to your Pi, then:
cd missions-app
chmod +x install.sh
./install.sh

# 2. Start the public tunnel (in a separate terminal):
./start-tunnel.sh

# 3. Open the Gamemaster panel:
http://localhost:3001/gm.html
```

---


## Default Password

The settings password is: **`admin1898`**

Change it immediately in **Settings → Security** after first login.

---

## Named Cloudflare Tunnel URL (Optional)

The free quick tunnel (`cloudflared tunnel --url ...`) gives you a **random URL that changes every time** you restart it. For a **permanent, named URL**:

1. Create a free account at [cloudflare.com](https://cloudflare.com)
2. Add your domain (or use a free Cloudflare subdomain)
3. Install cloudflared and run:
   ```
   cloudflared login
   cloudflared tunnel create missions
   cloudflared tunnel route dns missions your-subdomain.yourdomain.com
   cloudflared tunnel run --url http://localhost:3001 missions
   ```
4. Your permanent URL will always be `https://your-subdomain.yourdomain.com`

This means your QR codes never change between sessions.

---
## Architecture

| Component | Detail |
|-----------|--------|
| Server | Node.js + Express on port **3001** (won't conflict with Media Hub) |
| Database | SQLite (file: `data/missions.db`) |
| Real-time | Socket.io (timer sync, chat, notifications) |
| Uploads | Stored in `uploads/<gameId>/` |
| Tunnel | Cloudflare Tunnel (free, no port-forwarding needed) |
| Video Collage | FFmpeg |

---

## First-Time Setup

1. Navigate to `http://<pi-ip>:3001/gm.html`
2. Set a settings password (first time only)
3. Go to **Settings → Locations** — create your locations
4. Go to **Settings → Missions** — add missions (location-specific or pool)
5. Go to **Settings → General** — paste your Cloudflare tunnel URL
6. Go to **Settings → Rules** — write the rules (supports `[photo]` and `[video]` placeholders)

---

## Internet Access (Cloudflare Tunnel)

The app runs on your Pi. To make it accessible from anywhere (player phones on 4G, etc.):

```bash
./start-tunnel.sh
```

This outputs a URL like `https://abc123.trycloudflare.com`. Copy it into:
**Settings → General → Public URL**

This URL is embedded in QR codes so players can join from any network.

> **Persistent tunnel (optional):** For a fixed URL, create a free Cloudflare account and set up a named tunnel. See: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/

---

## Game Flow

### Gamemaster
1. Open `http://<pi-ip>:3001/gm.html`
2. Select a location → Create New Game
3. QR code is displayed — print or show to players
4. Click **Open Dashboard**
5. Start the timer when ready
6. Monitor teams, review submissions, chat

### Players
1. Scan QR code with phone
2. Enter a team name
3. Play! Complete missions by taking photos/videos
4. Submit each mission for review
5. Receive acceptance or rejection notifications

---

## Missions

- **Location missions** — Only appear at a specific location
- **Pool missions** — Appear at any location
- Set `min_location_missions` per location to guarantee location-specific content
- Set `max_missions` per location to cap the total number

---

## Multi-Language Support

The app supports **English, German, and French**. Players can toggle language in-game. Rules and mission descriptions can be entered in all three languages in Settings.

Placeholders in rules:
- `[photo]` → replaced with 📷
- `[video]` → replaced with 🎬

---

## Media & Collage

- Photos: JPEG, up to 100MB per file
- Videos: MP4, up to 200MB per file
- Accepted media stored in `uploads/<gameId>/`
- After game ends, gamemaster can request a **video collage** (requires FFmpeg)
- All game data auto-deleted after **72 hours**

---

## Multiple Simultaneous Games

Multiple locations can run independent games at the same time. Each game gets a unique 8-character ID. They don't interfere with each other.

---

## Service Management

```bash
# View logs
sudo journalctl -u missions-app -f

# Restart
sudo systemctl restart missions-app

# Stop
sudo systemctl stop missions-app

# Change port (edit service file)
sudo nano /etc/systemd/system/missions-app.service
# Change: Environment=PORT=3001
sudo systemctl daemon-reload && sudo systemctl restart missions-app
```

---

## File Structure

```
missions-app/
├── server.js          — Express server, routes, Socket.io
├── db/database.js     — SQLite database layer
├── public/
│   ├── gm.html        — Gamemaster dashboard
│   ├── join.html      — Player join screen (QR lands here)
│   ├── play.html      — Player game screen
│   ├── css/app.css    — Shared styles
│   └── assets/logo.png
├── uploads/           — Player submitted media (auto-cleaned)
├── data/              — SQLite database
├── install.sh         — One-shot installer
└── start-tunnel.sh    — Generated by installer
```
