#!/usr/bin/env bash
set -euo pipefail

CTID="$1"
CONF="/etc/pve/lxc/${CTID}.conf"

cat >> "$CONF" <<EOF
lxc.cgroup2.devices.allow: c 10:200 rwm
lxc.mount.entry: /dev/net/tun dev/net/tun none bind,create=file
EOF

pct restart "$CTID"
pct exec "$CTID" -- bash -c "curl -fsSL https://tailscale.com/install.sh | sh && tailscale up"