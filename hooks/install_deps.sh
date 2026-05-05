#!/usr/bin/env bash
# Install Python dependencies for the mythoi plugin into the plugin's
# persistent data directory (kept out of the user's repo). Idempotent: only
# (re-)installs when requirements.txt has changed since the last run.
set -e

REQ_SRC="${CLAUDE_PLUGIN_ROOT}/requirements.txt"
REQ_CACHE="${CLAUDE_PLUGIN_DATA}/requirements.txt"
LIB_DIR="${CLAUDE_PLUGIN_DATA}/lib"

# Quick exit if the cache is fresh.
if [[ -f "$REQ_CACHE" ]] && diff -q "$REQ_SRC" "$REQ_CACHE" >/dev/null 2>&1; then
  exit 0
fi

PY="${MYTHOI_PYTHON:-python3}"
if ! command -v "$PY" >/dev/null 2>&1; then
  echo "[mythoi] Python interpreter '$PY' not found on PATH. Set MYTHOI_PYTHON or install Python 3.10+." >&2
  exit 1
fi

mkdir -p "$LIB_DIR"
echo "[mythoi] Installing Python dependencies to $LIB_DIR …" >&2
"$PY" -m pip install --quiet --upgrade --target "$LIB_DIR" -r "$REQ_SRC"
cp "$REQ_SRC" "$REQ_CACHE"
echo "[mythoi] Dependencies installed." >&2
