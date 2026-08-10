#!/usr/bin/env bash
# Deploy from the repository to twinverse-ai. Secrets are read only from the
# pre-existing root-owned /etc/live-interpretation.env on the target host.
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
DEPLOY_HOST="${DEPLOY_HOST:-twinverse-ai}"
REMOTE_STAGE=".cache/live-interpretation-deploy"

if [[ ! "$DEPLOY_HOST" =~ ^[A-Za-z0-9._@:-]+$ ]]; then
  echo "DEPLOY_HOST contains unsupported characters" >&2
  exit 2
fi
for command_name in ssh rsync; do
  command -v "$command_name" >/dev/null || {
    echo "missing required command: $command_name" >&2
    exit 2
  }
done
if [[ -n "${PYTHON_BIN:-}" ]]; then
  LOCAL_PYTHON="$PYTHON_BIN"
elif command -v python3 >/dev/null; then
  LOCAL_PYTHON="python3"
else
  LOCAL_PYTHON="python"
fi
command -v "$LOCAL_PYTHON" >/dev/null || {
  echo "missing local Python interpreter: $LOCAL_PYTHON" >&2
  exit 2
}

echo "== local contract tests =="
(cd "$SERVICE_ROOT" && "$LOCAL_PYTHON" -m pytest -q)

echo "== stage service on $DEPLOY_HOST =="
ssh "$DEPLOY_HOST" "mkdir -p '$REMOTE_STAGE'"
rsync -az --delete \
  --exclude='venv/' \
  --exclude='__pycache__/' \
  --exclude='.pytest_cache/' \
  "$SERVICE_ROOT/" "$DEPLOY_HOST:$REMOTE_STAGE/"

echo "== install and restart =="
ssh "$DEPLOY_HOST" 'bash -s' <<'REMOTE_SCRIPT'
set -Eeuo pipefail

SOURCE_DIR="$HOME/.cache/live-interpretation-deploy"
INSTALL_DIR="/srv/live-interpretation"
ENV_FILE="/etc/live-interpretation.env"
UNIT_FILE="live-interpretation.service"

if ! sudo test -f "$ENV_FILE"; then
  echo "$ENV_FILE is required; create it with root:root ownership and mode 0600" >&2
  exit 3
fi
if [[ "$(sudo stat -c '%U:%G:%a' "$ENV_FILE")" != "root:root:600" ]]; then
  echo "$ENV_FILE must be owned by root:root with mode 0600" >&2
  exit 3
fi
if ! sudo grep -Eq '^INTERPRETATION_SERVICE_TOKEN=[A-Za-z0-9._~-]{32,512}$' "$ENV_FILE"; then
  echo "$ENV_FILE must define a URL-safe INTERPRETATION_SERVICE_TOKEN (32-512 chars)" >&2
  exit 3
fi

if ! id -u live-interpretation >/dev/null 2>&1; then
  sudo useradd --system --home-dir /nonexistent --shell /usr/sbin/nologin live-interpretation
fi
for gpu_group in video render; do
  if getent group "$gpu_group" >/dev/null; then
    sudo usermod -a -G "$gpu_group" live-interpretation
  fi
done

sudo install -d -o root -g root -m 0755 "$INSTALL_DIR"
sudo rsync -a --delete --exclude='venv/' "$SOURCE_DIR/" "$INSTALL_DIR/"
if [[ ! -x "$INSTALL_DIR/venv/bin/python" ]]; then
  sudo python3.12 -m venv "$INSTALL_DIR/venv"
fi
sudo "$INSTALL_DIR/venv/bin/python" -m pip install --upgrade pip wheel
sudo "$INSTALL_DIR/venv/bin/python" -m pip install -r "$INSTALL_DIR/requirements.txt"
sudo "$INSTALL_DIR/venv/bin/python" -m compileall -q "$INSTALL_DIR/app"
sudo chmod 0755 "$INSTALL_DIR/scripts/launch.sh"
sudo install -o root -g root -m 0644 \
  "$INSTALL_DIR/systemd/$UNIT_FILE" "/etc/systemd/system/$UNIT_FILE"
sudo systemctl daemon-reload
sudo systemctl enable "$UNIT_FILE" >/dev/null
sudo systemctl restart "$UNIT_FILE"

for _ in $(seq 1 120); do
  if curl --fail --silent --show-error http://127.0.0.1:8201/ready >/dev/null; then
    echo "live-interpretation is ready on port 8201"
    exit 0
  fi
  sleep 5
done

echo "readiness timed out" >&2
sudo systemctl status "$UNIT_FILE" --no-pager >&2 || true
sudo journalctl -u "$UNIT_FILE" -n 50 --no-pager >&2 || true
exit 4
REMOTE_SCRIPT
