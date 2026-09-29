#!/bin/bash

GAME_DIR="$(cd "$(dirname "$0")" && pwd -P)" || exit 1
cd "$GAME_DIR" || exit 1
PORT=8000
set -o pipefail

pause_on_error() {
  read -r -p "Enterキーで閉じます..." _
}

port_pids() {
  lsof -nP -t -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | sort -u
}

# A matching page alone cannot identify the served folder. The listener must be
# a Python file server rooted in this folder, with the actual files matching.
same_project_server() {
  local pids pid server_cmd server_cwd path local_hash remote_hash
  pids="$(port_pids)"
  [[ -n "$pids" && "$pids" != *$'\n'* ]] || return 1
  pid="$pids"
  server_cmd="$(ps -ww -p "$pid" -o command= 2>/dev/null)" || return 1
  [[ "$server_cmd" == *" -m http.server "* ]] || return 1
  [[ "$server_cmd" != *"--directory"* ]] || return 1
  server_cwd="$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -n 1)"
  [[ -n "$server_cwd" ]] || return 1
  server_cwd="$(cd "$server_cwd" 2>/dev/null && pwd -P)" || return 1
  [[ "$server_cwd" == "$GAME_DIR" ]] || return 1

  for path in dev.html engine/stories/S005.js START-Eigo-DE-Quest.command; do
    [[ -f "$GAME_DIR/$path" ]] || return 1
    local_hash="$(shasum -a 256 "$GAME_DIR/$path" | awk '{print $1}')" || return 1
    remote_hash="$(curl --noproxy '*' --silent --fail --max-time 3 "http://localhost:${PORT}/$path" | shasum -a 256 | awk '{print $1}')" || return 1
    [[ "$local_hash" == "$remote_hash" ]] || return 1
  done
  return 0
}

port_is_used() {
  [[ -n "$(port_pids)" ]]
}

if [[ ! -f "$GAME_DIR/dev.html" ]]; then
  echo "このフォルダにdev.htmlがありません。正しいEigo DE Questフォルダから起動してください。"
  pause_on_error
  exit 1
fi

if port_is_used; then
  if same_project_server; then
    echo "既に起動中のこのEigo DE Questサーバーを利用します。"
    if ! open -a "Google Chrome" "http://localhost:8000/dev.html"; then
      echo "Google Chromeを開けませんでした。"
      pause_on_error
      exit 1
    fi
    exit 0
  fi
  FOUND_PORT=0
  for candidate in 8001 8002 8003 8004 8005 8006 8007 8008 8009 8010; do
    PORT="$candidate"
    if ! port_is_used; then
      FOUND_PORT=1
      break
    fi
  done
  if [[ "$FOUND_PORT" != 1 ]]; then
    echo "利用可能なポートが見つかりませんでした（8000〜8010）。"
    pause_on_error
    exit 1
  fi
  echo "8000番は使用中です。現在のプロジェクトを${PORT}番で起動します。"
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 が見つかりません。"
  pause_on_error
  exit 1
fi

URL="http://localhost:${PORT}/dev.html"
# Keep the server in the foreground. Ctrl+C in Terminal ends only this newly
# started server; an existing listener is never changed.
(
  ready=0
  for (( attempt=0; attempt<40; attempt++ )); do
    if same_project_server; then
      ready=1
      break
    fi
    sleep 0.25
  done
  if [[ "$ready" == 1 ]]; then
    if open -a "Google Chrome" "$URL"; then
      echo "Eigo DE Questを開きました: $URL"
      echo "このTerminalを開いている間、ゲームを利用できます。終了はCtrl+Cです。"
    else
      echo "Google Chromeを開けませんでした。"
    fi
  else
    echo "サーバーを確認できませんでした。別のフォルダやアプリの画面は開きません。"
  fi
) &
python3 -m http.server "$PORT" --bind 127.0.0.1
server_status=$?
if [[ "$server_status" -ne 0 && "$server_status" -ne 130 ]]; then
  echo "HTTPサーバーを起動できませんでした（ポート${PORT}）。"
  pause_on_error
fi
exit "$server_status"
