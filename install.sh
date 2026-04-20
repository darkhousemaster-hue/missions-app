#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
#  MISSIONS App — Raspberry Pi Installer
#  AdventureRooms
# ─────────────────────────────────────────────────────────────────────────────

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$SCRIPT_DIR"
PORT=${MISSIONS_PORT:-3001}
SERVICE_NAME="missions-app"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BOLD='\033[1m'; NC='\033[0m'
info()    { echo -e "${GREEN}[✓]${NC} $1"; }
warn()    { echo -e "${YELLOW}[!]${NC} $1"; }
heading() { echo -e "\n${BOLD}${RED}━━  $1  ━━${NC}\n"; }

echo -e "${RED}"
cat << 'EOF'
  __  __ ___ ____ ____ ___ ___  _  _ ____ 
  |\/| | (__  [__  | |  |  |  \ |\ | [__  
  |  | | ___] ___] | |  |  |__/ | \| ___] 
EOF
echo -e "${NC}  AdventureRooms Outdoor Game App\n"

# ─── Check Node.js ─────────────────────────────────────────────────────────────
heading "Checking Prerequisites"

if ! command -v node &>/dev/null; then
  warn "Node.js not found. Installing via NodeSource…"
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

NODE_VER=$(node -v)
info "Node.js $NODE_VER found"

if ! command -v npm &>/dev/null; then
  echo "npm not found. Exiting."; exit 1
fi
info "npm $(npm -v) found"

# FFmpeg (for video collage)
if command -v ffmpeg &>/dev/null; then
  info "FFmpeg $(ffmpeg -version 2>&1 | head -1 | awk '{print $3}') found"
else
  warn "FFmpeg not found. Installing…"
  sudo apt-get install -y ffmpeg
fi

# ─── Install dependencies ──────────────────────────────────────────────────────
heading "Installing Node Dependencies"
cd "$APP_DIR"
npm install --production
info "Dependencies installed"

# ─── Create required dirs ──────────────────────────────────────────────────────
mkdir -p "$APP_DIR/uploads" "$APP_DIR/data"
info "Upload and data directories created"

# ─── Port check ────────────────────────────────────────────────────────────────
heading "Port Configuration"
if ss -tlnp | grep -q ":${PORT} "; then
  warn "Port $PORT is in use. Trying $((PORT+1))…"
  PORT=$((PORT+1))
fi
info "Using port $PORT"

# ─── Systemd service ───────────────────────────────────────────────────────────
heading "Setting Up System Service"

sudo tee /etc/systemd/system/${SERVICE_NAME}.service > /dev/null << EOF
[Unit]
Description=MISSIONS App (AdventureRooms)
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=$USER
WorkingDirectory=${APP_DIR}
Environment=PORT=${PORT}
ExecStart=/usr/bin/node ${APP_DIR}/server.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=${SERVICE_NAME}

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable ${SERVICE_NAME}
sudo systemctl restart ${SERVICE_NAME}
info "Service '${SERVICE_NAME}' installed and started"

# ─── Cloudflare Tunnel setup ───────────────────────────────────────────────────
heading "Internet Access via Cloudflare Tunnel"

if command -v cloudflared &>/dev/null; then
  info "cloudflared already installed"
else
  warn "cloudflared not found. Installing…"
  ARCH=$(dpkg --print-architecture)
  if [ "$ARCH" = "armhf" ] || [ "$ARCH" = "arm" ]; then
    CF_ARCH="arm"
  elif [ "$ARCH" = "arm64" ] || [ "$ARCH" = "aarch64" ]; then
    CF_ARCH="arm64"
  else
    CF_ARCH="amd64"
  fi

  curl -L "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${CF_ARCH}.deb" -o /tmp/cloudflared.deb
  sudo dpkg -i /tmp/cloudflared.deb && rm /tmp/cloudflared.deb
  info "cloudflared installed"
fi

# Create quick-tunnel script
cat > "$APP_DIR/start-tunnel.sh" << TUNNEL_EOF
#!/bin/bash
# Quick Cloudflare Tunnel — generates a temporary public URL
# Copy the https URL shown below into MISSIONS Settings → Public URL

echo ""
echo "  Starting Cloudflare Tunnel for MISSIONS on port ${PORT}"
echo "  The URL shown below is your public URL for QR codes."
echo "  Copy it into the MISSIONS settings → 'Public URL'"
echo ""
cloudflared tunnel --url http://localhost:${PORT}
TUNNEL_EOF
chmod +x "$APP_DIR/start-tunnel.sh"
info "Tunnel script created at start-tunnel.sh"

# ─── Status ────────────────────────────────────────────────────────────────────
heading "Installation Complete!"
echo ""
echo -e "  ${BOLD}Local access:${NC}     http://$(hostname -I | awk '{print $1}'):${PORT}/gm.html"
echo -e "  ${BOLD}Gamemaster URL:${NC}   http://localhost:${PORT}/gm.html"
echo ""
echo -e "  ${YELLOW}To get a public internet URL, run:${NC}"
echo -e "  ${BOLD}  ./start-tunnel.sh${NC}"
echo -e "  Then copy the https URL into Settings → Public URL"
echo ""
echo -e "  ${BOLD}Logs:${NC}             sudo journalctl -u ${SERVICE_NAME} -f"
echo -e "  ${BOLD}Restart:${NC}          sudo systemctl restart ${SERVICE_NAME}"
echo ""
