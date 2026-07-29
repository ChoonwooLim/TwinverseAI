#!/usr/bin/env bash
# Lucifer 변환 스크립트와 systemd 유닛을 twinverse-ai 로 배포한다.
# 사용: bash scripts/lucifer/deploy.sh
set -euo pipefail

HOST=stevenlim@192.168.219.117
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "== 스크립트 전송 =="
ssh "$HOST" "mkdir -p ~/lucifer"
scp "$DIR"/convert.py "$DIR"/converters.py "$DIR"/test_convert.py \
    "$DIR"/mirror.py "$DIR"/session_parse.py "$DIR"/session_index.py "$DIR"/test_mirror.py \
    "$HOST":~/lucifer/

echo "== 테스트 =="
ssh "$HOST" "cd ~/lucifer && python3 -m unittest test_convert test_mirror 2>&1 | tail -4"

echo "== systemd 유닛 설치 =="
scp "$DIR"/lucifer-convert.service "$DIR"/lucifer-convert.timer \
    "$DIR"/lucifer-mirror.service "$DIR"/lucifer-mirror.timer "$HOST":/tmp/
ssh "$HOST" "
  sudo mv /tmp/lucifer-convert.service /tmp/lucifer-convert.timer \
          /tmp/lucifer-mirror.service /tmp/lucifer-mirror.timer /etc/systemd/system/
  sudo systemctl daemon-reload
  sudo systemctl enable --now lucifer-convert.timer lucifer-mirror.timer
  systemctl list-timers lucifer-convert.timer lucifer-mirror.timer --no-pager
"

echo "== 완료 =="
