#!/bin/zsh
set -e
GAME_WORKTREE="$(cd "$(dirname "$0")" && pwd)"
GAME_GODOT="/private/tmp/s53-godot/Godot.app/Contents/MacOS/Godot"
if [[ ! -x "$GAME_GODOT" ]]; then
  print '找不到本地 Godot 4.7.2；這個啟動器目前只供本機研究版本使用。'
  exit 1
fi
exec "$GAME_GODOT" --path "$GAME_WORKTREE/art-direction/86-reference/probe-assets/s53-godot" --script mission.gd -- --collapse
