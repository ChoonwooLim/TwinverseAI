#!/usr/bin/env bash
# Resolve CUDA runtime wheels inside the private venv before CTranslate2 starts.
set -Eeuo pipefail

INSTALL_DIR="/srv/live-interpretation"
PYTHON="$INSTALL_DIR/venv/bin/python"

NVIDIA_LIBRARY_PATH="$($PYTHON - <<'PY'
from importlib import import_module
from pathlib import Path

paths = []
for package_name in ("nvidia.cublas.lib", "nvidia.cudnn.lib"):
    package = import_module(package_name)
    if package.__file__ is None:
        raise SystemExit(f"unable to resolve {package_name} library root")
    library_dir = Path(package.__file__).resolve().parent
    if not library_dir.is_dir():
        raise SystemExit(f"missing runtime library directory for {package_name}")
    paths.append(str(library_dir))
print(":".join(paths))
PY
)"

if [[ -z "$NVIDIA_LIBRARY_PATH" ]]; then
  echo "NVIDIA runtime library path resolution failed" >&2
  exit 1
fi
export LD_LIBRARY_PATH="$NVIDIA_LIBRARY_PATH${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"

exec "$INSTALL_DIR/venv/bin/uvicorn" app.main:app \
  --host 0.0.0.0 \
  --port 8201 \
  --workers 1 \
  --no-access-log \
  --log-level info
