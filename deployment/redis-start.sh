#!/bin/sh
set -eu
case "$REDIS_PASSWORD" in ''|*[!a-fA-F0-9]*) echo 'Use a random hex Redis password' >&2; exit 1;; esac
[ "${#REDIS_PASSWORD}" -ge 64 ] || exit 1
umask 077
printf 'bind 0.0.0.0\nprotected-mode yes\nappendonly yes\nrequirepass %s\n' "$REDIS_PASSWORD" >/tmp/noteora-redis.conf
exec redis-server /tmp/noteora-redis.conf
