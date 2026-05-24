#!/usr/bin/env bash
# Bootstraps python-venv/ with the WhisperX runtime that ships inside the app.
# Idempotent: skips work if the venv already has whisperx installed.
set -euo pipefail

cd "$(dirname "$0")/.."

VENV_DIR="python-venv"
REQ_FILE="python/requirements.txt"
STAMP="$VENV_DIR/.scribe-bootstrap-ok"

if [ -f "$STAMP" ] && [ "$REQ_FILE" -ot "$STAMP" ]; then
  echo "python-venv: up to date, skipping."
  exit 0
fi

find_python() {
  for candidate in python3.12 python3.11 python3; do
    if command -v "$candidate" >/dev/null 2>&1; then
      version=$("$candidate" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
      case "$version" in
        3.11|3.12) echo "$candidate"; return 0 ;;
      esac
    fi
  done
  return 1
}

PY=$(find_python || true)
if [ -z "$PY" ]; then
  echo "ERROR: need Python 3.11 or 3.12 to build the WhisperX sidecar." >&2
  echo "Install one (e.g. via pyenv) and retry: pyenv install 3.12.11" >&2
  exit 1
fi

echo "python-venv: using $($PY --version)"

if [ ! -d "$VENV_DIR" ]; then
  "$PY" -m venv "$VENV_DIR"
fi

# shellcheck source=/dev/null
source "$VENV_DIR/bin/activate"

python -m pip install --upgrade pip wheel
python -m pip install -r "$REQ_FILE"

touch "$STAMP"
echo "python-venv: ready."
