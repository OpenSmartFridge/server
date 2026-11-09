#!/usr/bin/env bash
set -e

for port in 6380 6381 6382; do
  keydb-cli -p "$port" SHUTDOWN NOSAVE 2>/dev/null || true
done

sleep 1

for id in a b c; do
  rm -rf "/tmp/keydb-$id"
  mkdir -p "/tmp/keydb-$id"
done

for port in 6380 6381 6382; do
  case "$port" in
    6380) peers="6381 6382" ;;
    6381) peers="6380 6382" ;;
    6382) peers="6380 6381" ;;
  esac

  id=$(case "$port" in 6380) echo a ;; 6381) echo b ;; 6382) echo c ;; esac)

  keydb-server \
    --port "$port" \
    --bind 127.0.0.1 \
    --dir "/tmp/keydb-$id" \
    --appendonly yes \
    --active-replica yes \
    --multi-master yes \
    --replicaof 127.0.0.1 ${peers// / --replicaof 127.0.0.1 } \
    --daemonize yes \
    --pidfile "/tmp/keydb-$id/keydb.pid" \
    --logfile "/tmp/keydb-$id/keydb.log"
done