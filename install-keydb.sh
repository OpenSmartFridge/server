#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="/opt/KeyDB"
CONFIG_DIR="/etc/keydb"
DATA_DIR="/var/lib/keydb"
LOG_DIR="/var/log/keydb"
SERVICE_USER="keydb"
BIND_ADDR="0.0.0.0"
PORT="6379"

apt update
apt install -y build-essential nasm autotools-dev autoconf \
    libjemalloc-dev tcl tcl-dev uuid-dev libcurl4-openssl-dev \
    libssl-dev git

if [ -d "$INSTALL_DIR" ]; then
    echo "Verzeichnis $INSTALL_DIR existiert bereits, überspringe Klonen."
else
    git clone https://github.com/Snapchat/KeyDB.git "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"
make -j"$(nproc)"
make install

if ! id "$SERVICE_USER" &>/dev/null; then
    useradd --system --no-create-home --shell /usr/sbin/nologin "$SERVICE_USER"
fi

mkdir -p "$CONFIG_DIR" "$DATA_DIR" "$LOG_DIR"
chown -R "$SERVICE_USER:$SERVICE_USER" "$DATA_DIR" "$LOG_DIR"

cat > "$CONFIG_DIR/keydb.conf" <<EOF
bind ${BIND_ADDR}
port ${PORT}
protected-mode yes
daemonize no
pidfile /run/keydb/keydb-server.pid
logfile ${LOG_DIR}/keydb-server.log
dir ${DATA_DIR}

active-replica yes
multi-master yes
EOF

chown "$SERVICE_USER:$SERVICE_USER" "$CONFIG_DIR/keydb.conf"
chmod 640 "$CONFIG_DIR/keydb.conf"

mkdir -p /run/keydb
chown "$SERVICE_USER:$SERVICE_USER" /run/keydb

cat > /etc/systemd/system/keydb.service <<EOF
[Unit]
Description=KeyDB - A Multithreaded Fork of Redis
After=network.target

[Service]
Type=simple
User=${SERVICE_USER}
Group=${SERVICE_USER}
RuntimeDirectory=keydb
ExecStart=/usr/local/bin/keydb-server ${CONFIG_DIR}/keydb.conf
Restart=always
RestartSec=3
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now keydb.service

sleep 1
systemctl status keydb.service --no-pager
keydb-cli -h 127.0.0.1 -p "$PORT" ping