# Uploading MiSSiONS to GitHub

## First time (Windows PC)

### 1. Install Git for Windows
Download from https://git-scm.com/download/win — use all default options.

### 2. Create a GitHub account
Go to https://github.com and sign up if you don't have one.

### 3. Create a new repository on GitHub
- Click the **＋** button → **New repository**
- Name it: `missions-app`
- Set to **Private** (recommended — it contains your game data structure)
- **Do NOT** tick "Add README" or any other files
- Click **Create repository**

### 4. Open PowerShell in your app folder
```powershell
cd C:\projects\missions-app
```

### 5. Initialize and push
```powershell
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOURUSERNAME/missions-app.git
git push -u origin main
```
Replace `YOURUSERNAME` with your GitHub username.

If asked for login: use your GitHub username and a **Personal Access Token** (not your password).
To create a token: GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token. Tick `repo` scope. Copy the token and use it as your password.

---

## Installing on Raspberry Pi

### 1. SSH into your Pi
```bash
ssh pi@YOUR_PI_IP
```

### 2. Clone the repo
```bash
cd /home/pi
git clone https://github.com/YOURUSERNAME/missions-app.git
cd missions-app
```

### 3. Run the setup script
```bash
chmod +x setup-pi.sh
./setup-pi.sh
```
This installs Node.js, npm packages, cloudflared, creates the systemd service, and creates the update script. It auto-detects a free port so it won't clash with Pi Media Hub.

### 4. Start the tunnel
```bash
./start-tunnel.sh
```
Copy the `https://xxx.trycloudflare.com` URL into **Settings → General → Public URL**.

---

## Updating the app later

### On Windows — commit and push changes:
```powershell
cd C:\projects\missions-app
git add .
git commit -m "Update: describe what changed"
git push
```

### On Pi — pull and restart:
```bash
cd /home/pi/missions-app
./update.sh
```
Or from anywhere:
```bash
/home/pi/missions-app/update.sh
```

---

## Important: what's NOT pushed to GitHub
The `.gitignore` excludes:
- `node_modules/` — reinstalled by `npm install`
- `data/` and `*.db` — your game database (stays on Pi, not shared)
- `uploads/` — player photos and videos
- `tunnel-url.txt` — temporary tunnel URL

This means your players' data stays on the Pi and is never on GitHub.
