#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
python3 -m pygbag --build .
python3 scripts/prepare_web_build.py
