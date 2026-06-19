#!/usr/bin/env bash
# Turnkey launcher for an unattended session run.
#  - keeps the Mac awake (caffeinate) so cron fires at 4am
#  - logs everything to a timestamped file you can review later
#  - auto-restarts if the process ever crashes
#
# Usage:  ./run.sh         (start it Sunday night; leave the lid OPEN + plugged in)
# Stop:   Ctrl+C
#
# NOTE: a MacBook still sleeps when you CLOSE the lid, even with caffeinate.
# Keep the lid open and the charger plugged in.

cd "$(dirname "$0")" || exit 1
mkdir -p logs
LOG="logs/scanner-$(date +%Y%m%d-%H%M%S).log"
echo "Scanner launcher. Logging to: $LOG"
echo "Leave this window open. Lid OPEN, charger plugged in. Ctrl+C to stop."
echo

# caffeinate flags: -d display, -i idle, -m disk, -s system, -u declare user active.
# The loop relaunches node if it exits for any reason.
while true; do
  caffeinate -dimsu node src/index.js 2>&1 | tee -a "$LOG"
  echo "[launcher] scanner exited $(date '+%Y-%m-%d %H:%M:%S'). Restarting in 10s..." | tee -a "$LOG"
  sleep 10
done
