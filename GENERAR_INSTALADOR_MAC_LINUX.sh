#!/usr/bin/env bash
set -e
echo "========================================================"
echo "  GENERANDO INSTALADOR DE ESCRITORIO PARA GENESIS APP"
echo "========================================================"

if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] Node.js no esta instalado. Instalalo desde https://nodejs.org"
  exit 1
fi

echo "[1/3] Instalando dependencias..."
npm install

echo "[2/3] Compilando aplicacion y generando instalador..."
OS_NAME="$(uname -s)"
if [ "$OS_NAME" = "Darwin" ]; then
  npm run dist:mac
else
  npm run dist:linux
fi

echo "========================================================"
echo "  LISTO! Instalador generado en la carpeta: dist/"
echo "========================================================"
