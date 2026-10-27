#!/usr/bin/env bash
# Arma el paquete de la Lambda en infra/.build/lambda: el código de zombie más
# numpy compilado para Lambda (Linux x86_64, Python 3.13). No necesita Docker.
set -euo pipefail
cd "$(dirname "$0")/.."
SALIDA=infra/.build/lambda

rm -rf "$SALIDA" && mkdir -p "$SALIDA"
uv pip install --quiet --target "$SALIDA" \
  --python-platform x86_64-manylinux_2_28 --python-version 3.13 --only-binary :all: \
  "numpy>=2.0"
cp -r backend/src/zombie "$SALIDA/"
find "$SALIDA" -name __pycache__ -prune -exec rm -rf {} +
echo "Paquete listo en $SALIDA ($(du -sh "$SALIDA" | cut -f1))"
