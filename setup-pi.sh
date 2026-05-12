#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
#  MiSSiONS App - Raspberry Pi Setup Script
#  Run this once after cloning the repo onto your Pi
#  Safe to run alongside Pi Media Hub - uses a different port
# ─────────────────────────────────────────────────────────────────────────────
set -e

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVICE_NAME="missions-app"
PORT=${MISSIONS_PORT:-3001}

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BOLD='\033[1m'; NC='\033[0m'
ok()   { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; }

echo -e "\n${BOLD}${RED}  MiSSiONS App - Pi Setup${NC}\n"

# ── Check if port is already in use by another app ──────────────────────────
if ss -tlnp 2>/dev/null | grep -q ":${PORT} "; then
    warn "Port ${PORT} is in use. Trying $((PORT+1))..."
    PORT=$((PORT+1))
    if ss -tlnp 2>/dev/null | grep -q ":${PORT} "; then
        PORT=$((PORT+2))
    fi
fi
ok "Will use port ${PORT}"

# ── Node.js ──────────────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
    warn "Node.js not found. Installing v22..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi
NODE_VER=$(node -v)
ok "Node.js ${NODE_VER}"

# ── FFmpeg (for video collage feature) ───────────────────────────────────────
if ! command -v ffmpeg &>/dev/null; then
    warn "FFmpeg not found. Installing..."
    sudo apt-get install -y ffmpeg
fi
ok "FFmpeg $(ffmpeg -version 2>&1 | head -1 | awk '{print $3}')"

# ── npm install ───────────────────────────────────────────────────────────────
cd "$APP_DIR"
ok "Installing dependencies..."
npm install --production
ok "Dependencies installed"

# ── Create required directories ───────────────────────────────────────────────
mkdir -p "$APP_DIR/uploads" "$APP_DIR/data"
ok "Directories ready"

# ── Systemd service ───────────────────────────────────────────────────────────
sudo tee /etc/systemd/system/${SERVICE_NAME}.service > /dev/null << EOF
[Unit]
Description=MiSSiONS App (AdventureRooms)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${USER}
WorkingDirectory=${APP_DIR}
Environment=PORT=${PORT}
ExecStart=/usr/bin/node ${APP_DIR}/server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${SERVICE_NAME}

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable "${SERVICE_NAME}"
sudo systemctl restart "${SERVICE_NAME}"
ok "Service '${SERVICE_NAME}' started on port ${PORT}"

# ── Cloudflare Tunnel ─────────────────────────────────────────────────────────
if ! command -v cloudflared &>/dev/null; then
    warn "cloudflared not found. Installing..."
    ARCH=$(dpkg --print-architecture)
    case "$ARCH" in
        arm64|aarch64) CF_ARCH="arm64" ;;
        armhf|armv7l)  CF_ARCH="arm" ;;
        *)              CF_ARCH="amd64" ;;
    esac
    curl -L "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${CF_ARCH}.deb" \
         -o /tmp/cloudflared.deb
    sudo dpkg -i /tmp/cloudflared.deb && rm /tmp/cloudflared.deb
    ok "cloudflared installed"
else
    ok "cloudflared already installed"
fi

# ── Create tunnel start script ────────────────────────────────────────────────
cat > "$APP_DIR/start-tunnel.sh" << EOF
#!/bin/bash
# Start Cloudflare tunnel for MiSSiONS on port ${PORT}
# Copy the https://xxx.trycloudflare.com URL into Settings → Public URL
echo ""
echo "  MiSSiONS Tunnel starting on port ${PORT}"
echo "  Copy the https:// URL into Settings → General → Public URL"
echo ""
cloudflared tunnel --url http://localhost:${PORT} 2>&1 | tee >(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' | head -1 > "${APP_DIR}/tunnel-url.txt")
EOF
chmod +x "$APP_DIR/start-tunnel.sh"
ok "Tunnel script created"

# ── Create update script ───────────────────────────────────────────────────────
cat > "$APP_DIR/update.sh" << EOF
#!/bin/bash
# Pull latest code from GitHub and restart the service
set -e
APP_DIR="\$(cd "\$(dirname "\$0")" && pwd)"
echo "[update] Pulling from GitHub..."
cd "\$APP_DIR"
if [ -n "\$(git status --porcelain --untracked-files=no)" ]; then
  echo "[update] Local tracked changes detected; saving them to git stash..."
  git stash push -m "missions-app auto-update \$(date -Is)"
fi
git fetch --prune origin main
if git rev-parse --verify main >/dev/null 2>&1; then
  git checkout main
else
  git checkout -B main origin/main
fi
git merge --ff-only origin/main
echo "[update] Installing dependencies..."
if [ -f package-lock.json ]; then
  npm ci --omit=dev
else
  npm install --omit=dev
fi
echo "[update] Restarting service..."
sudo systemctl restart ${SERVICE_NAME}
echo "[update] Done! Check logs: sudo journalctl -u ${SERVICE_NAME} -f"
EOF
chmod +x "$APP_DIR/update.sh"
ok "Update script created (run ./update.sh to pull latest from GitHub)"

echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  ${BOLD}Setup complete!${NC}"
echo ""
echo -e "  ${GREEN}Local:${NC}      http://$(hostname -I | awk '{print $1}'):${PORT}/gm.html"
echo -e "  ${GREEN}Update:${NC}     ./update.sh"
echo -e "  ${GREEN}Tunnel:${NC}     ./start-tunnel.sh"
echo -e "  ${GREEN}Logs:${NC}       sudo journalctl -u ${SERVICE_NAME} -f"
echo -e "  ${GREEN}Restart:${NC}    sudo systemctl restart ${SERVICE_NAME}"
echo ""
