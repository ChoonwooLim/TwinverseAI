#!/usr/bin/env bash
# Lucifer 변환 스크립트와 systemd 유닛을 twinverse-ai 로 배포한다.
# 사용: bash scripts/lucifer/deploy.sh
set -euo pipefail

HOST=stevenlim@192.168.219.117
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "== 스크립트 전송 =="
ssh "$HOST" "mkdir -p ~/lucifer"
scp "$DIR"/convert.py "$DIR"/converters.py "$DIR"/test_convert.py "$HOST":~/lucifer/

echo "== 테스트 =="
ssh "$HOST" "cd ~/lucifer && python3 -m unittest test_convert 2>&1 | tail -3"

echo "== systemd 유닛 설치 =="
scp "$DIR"/lucifer-convert.service "$DIR"/lucifer-convert.timer "$HOST":/tmp/
ssh "$HOST" "
  sudo mv /tmp/lucifer-convert.service /tmp/lucifer-convert.timer /etc/systemd/system/
  sudo systemctl daemon-reload
  sudo systemctl enable --now lucifer-convert.timer
  systemctl status lucifer-convert.timer --no-pager | head -5
"

echo "== 완료 =="
