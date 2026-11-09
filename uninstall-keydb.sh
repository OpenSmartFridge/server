#!/usr/bin/env bash
set -euo pipefail

systemctl stop keydb.service 2>/dev/null || true
systemctl disable keydb.service 2>/dev/null || true
rm -f /etc/systemd/system/keydb.service
systemctl daemon-reload
systemctl reset-failed 2>/dev/null || true

rm -f /usr/local/bin/keydb-server
rm -f /usr/local/bin/keydb-cli
rm -f /usr/local/bin/keydb-benchmark
rm -f /usr/local/bin/keydb-check-aof
rm -f /usr/local/bin/keydb-check-rdb
rm -f /usr/local/bin/keydb-sentinel

rm -rf /opt/KeyDB
rm -rf /etc/keydb
rm -rf /var/lib/keydb
rm -rf /var/log/keydb
rm -rf /run/keydb

if id "keydb" &>/dev/null; then
    userdel keydb
fi