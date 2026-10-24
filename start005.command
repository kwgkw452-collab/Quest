#!/bin/bash

GAME_DIR="$(cd "$(dirname "$0")" && pwd -P)" || exit 1
cd "$GAME_DIR" || exit 1
PORT=8000
SERVER_PID=""

pause_on_error() {
  read -r -p "Enterキーで閉じます..." _
}

port_is_used() {
  lsof -nP -t -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1
}

cleanup() {
  if [[ -n "$SERVER_PID" ]]; then
    kill "$SERVER_PID" >/dev/null 2>&1
    wait "$SERVER_PID" >/dev/null 2>&1
  fi
}

for required in dev.html dev/dev-checkpoints.js dev/dev-jump-manager.js dev/dev-jump-ui.js engine/stories/S005.js data/s005-communication.js; do
  if [[ ! -f "$GAME_DIR/$required" ]]; then
    echo "必要なゲームファイルがありません: $required"
    pause_on_error
    exit 1
  fi
done

for candidate in {8000..8010}; do
  PORT="$candidate"
  if ! port_is_used; then
    break
  fi
done

if port_is_used; then
  echo "利用可能なポートが見つかりませんでした（8000〜8010）。"
  pause_on_error
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 が見つかりません。"
  pause_on_error
  exit 1
fi

trap cleanup EXIT INT TERM
python3 -m http.server "$PORT" --bind 127.0.0.1 >/tmp/eigo-de-quest-start005-"$$".log 2>&1 &
SERVER_PID=$!
URL="http://localhost:${PORT}/dev.html?jump=S005"

ready=0
for (( attempt=0; attempt<40; attempt++ )); do
  if curl --noproxy '*' --silent --fail --max-time 1 "http://localhost:${PORT}/dev.html" >/dev/null; then
    ready=1
    break
  fi
  sleep 0.25
done

if [[ "$ready" != 1 ]]; then
  echo "S005用Webサーバーを起動できませんでした。"
  pause_on_error
  exit 1
fi

if ! open -a "Google Chrome" "$URL"; then
  echo "Google Chromeを開けませんでした。"
  pause_on_error
  exit 1
fi

echo "S005を開きました: $URL"
echo "このTerminalを閉じるかCtrl+Cを押すと、今回起動したサーバーだけを終了します。"
wait "$SERVER_PID"
