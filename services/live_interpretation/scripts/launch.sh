#!/usr/bin/env bash
# Resolve CUDA runtime wheels inside the private venv before CTranslate2 starts.
set -Eeuo pipefail

INSTALL_DIR="/srv/live-interpretation"
PYTHON="$INSTALL_DIR/venv/bin/python"
cd "$INSTALL_DIR"

NVIDIA_LIBRARY_PATH="$("$PYTHON" -m app.cuda_paths)"

if [[ -z "$NVIDIA_LIBRARY_PATH" ]]; then
  echo "NVIDIA runtime library path resolution failed" >&2
  exit 1
fi
export LD_LIBRARY_PATH="$NVIDIA_LIBRARY_PATH${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"

exec "$INSTALL_DIR/venv/bin/uvicorn" app.main:app \
  --host 0.0.0.0 \
  --port 8201 \
  --workers 1 \
  --ws-max-size 65536 \
  --no-access-log \
  --log-level info
