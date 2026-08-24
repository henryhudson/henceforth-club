#!/bin/zsh
# mini-health — a synthetic check of the BUILD MACHINE itself.
#
# Why this exists (2026-07-28). For three days every repository's continuous
# integration was red and nothing said why. The signals we had were all
# indirect: red runs that died at a simulator step, and a website monitor
# whose alerts turned out to be about its own host. The machine was never
# watched directly, so a load average of 467 and a swap file at 93% went
# unnoticed from Sunday to Tuesday, through a ship day.
#
# The three signals that actually failed — load, swap, and whether the machine
# can still fork a process — were checked by nothing. This checks them.
#
# Runs every 10 minutes (launchd: club.henceforth.mini-health) ON THE MINI.
# Emails hnryhdsn@gmail.com only on a state CHANGE — one when it goes bad, one
# when it recovers, and one when it goes bad and corrects itself within a
# single pass (see self-correction below) — reusing the daily-reviews Gmail
# app password, exactly as text-monitor.sh does.
#
# Install:
#   cp scripts/ops/mini-health.sh  ~/Programming/Main\ Projects/.mini-health/
#   cp scripts/ops/club.henceforth.mini-health.plist ~/Library/LaunchAgents/
#   launchctl load ~/Library/LaunchAgents/club.henceforth.mini-health.plist
set -u

DIR="${0:a:h}"
STATE_FILE="$DIR/state"
LOG="$DIR/mini-health.log"
PASS_FILE="$HOME/.config/daily-reviews/gmail-app-password"
ADDRESS="hnryhdsn@gmail.com"

# Thresholds, sized against the actual hardware: Macmini9,1 (M1, 2020),
# 8 cores, 8 GiB RAM, 8 GiB swap. A healthy Xcode build peaks somewhere near
# 16-24 on an 8-core box, so 40 is unambiguous rather than merely busy.
# The observed failure sat at 467.
LOAD_CEILING=40
DISK_FREE_FLOOR_GB=20

# SWAP IS NOT A STANDALONE ALARM, and calibrating it taught that the hard way:
# a healthy laptop measured 81% swap consumed while doing nothing unusual.
# macOS keeps swap heavily populated as a matter of course, so high usage alone
# says almost nothing — an alert on it would manufacture exactly the nightly
# false-alarm noise this monitor exists to end. It fires only ALONGSIDE an
# elevated load, which together mean the machine is paging rather than working.
# The observed failure was 93% swap at load 467; the healthy control was 81% at
# load 2.
SWAP_PCT_CEILING=90
SWAP_COMPANION_LOAD=15
# `ps ax` enumerating the process table is the cheapest honest fork test.
# During the 2026-07-28 failure it took over ten minutes and twice exited 1,
# while sysctl reads answered instantly — that divergence IS the symptom.
FORK_TIMEOUT_SECONDS=20

log() { print -r -- "$(date '+%Y-%m-%d %H:%M:%S') $1" >> "$LOG" }

# Temp + rename, so a short write on a full disk cannot leave a truncated state.
write_state() { print -r -- "$1" > "$STATE_FILE.tmp" && mv -f "$STATE_FILE.tmp" "$STATE_FILE" }

# ── the checks ───────────────────────────────────────────────────────────────
# Each prints a one-line reason when unhealthy, or nothing when fine.

check_load() {
  local one
  one=${$(sysctl -n vm.loadavg)[2]}          # { 1min 5min 15min }
  [[ -n "$one" ]] || { print -r -- "load average unreadable"; return }
  # zsh has no float compare in (( )) against a string reliably; use awk.
  awk -v l="$one" -v c="$LOAD_CEILING" 'BEGIN { exit !(l > c) }' \
    && print -r -- "load average is ${one} (ceiling ${LOAD_CEILING}, 8 cores) — the machine is not keeping up"
}

check_swap() {
  # sysctl vm.swapusage: "total = 8192.00M  used = 7584.06M  free = 607.94M"
  local line total used pct one
  line=$(sysctl -n vm.swapusage)
  total=${${line#*total = }%%M*}
  used=${${line#*used = }%%M*}
  [[ -n "$total" && -n "$used" ]] || { print -r -- "swap usage unreadable"; return }
  pct=$(awk -v u="$used" -v t="$total" 'BEGIN { if (t <= 0) print 0; else printf "%.0f", 100*u/t }')
  (( pct > SWAP_PCT_CEILING )) || return
  # Only an alarm when the machine is also failing to keep up — see the note
  # on SWAP_PCT_CEILING above.
  one=${$(sysctl -n vm.loadavg)[2]}
  awk -v l="$one" -v c="$SWAP_COMPANION_LOAD" 'BEGIN { exit !(l > c) }' \
    && print -r -- "swap is ${pct}% consumed (${used}M of ${total}M) at load ${one} — the machine is paging, not working"
}

# Read the DATA volume, never `/`. `df -h /` reports the sealed system volume
# and showed a reassuring 44% on the morning the data volume was at 97% — that
# single misread cost a day of diagnosis on 2026-07-27.
check_disk() {
  local free_gb
  free_gb=$(df -g /System/Volumes/Data | awk 'NR==2 {print $4}')
  [[ -n "$free_gb" ]] || { print -r -- "disk free space unreadable"; return }
  (( free_gb < DISK_FREE_FLOOR_GB )) && \
    print -r -- "only ${free_gb} GiB free on /System/Volumes/Data (floor ${DISK_FREE_FLOOR_GB} GiB) — swap cannot grow and builds will fail to write"
}

# Can the machine still enumerate its own process table, promptly? This is the
# check that would have caught 2026-07-28 first: sysctl answered instantly
# while `ps ax` hung for minutes.
check_fork() {
  local start elapsed rc
  start=$SECONDS
  ( ps ax > /dev/null 2>&1 ) &
  local pid=$!
  local waited=0
  while (( waited < FORK_TIMEOUT_SECONDS )); do
    kill -0 $pid 2>/dev/null || break
    sleep 1
    (( waited++ ))
  done
  if kill -0 $pid 2>/dev/null; then
    kill -9 $pid 2>/dev/null
    print -r -- "the process table took longer than ${FORK_TIMEOUT_SECONDS}s to enumerate — the machine can barely fork"
    return
  fi
  wait $pid; rc=$?
  elapsed=$(( SECONDS - start ))
  (( rc != 0 )) && print -r -- "\`ps ax\` exited ${rc} after ${elapsed}s — the machine cannot enumerate its own processes"
}

run_pass() {
  local failures="" reason
  for c in check_load check_swap check_disk check_fork; do
    reason=$($c)
    [[ -n "$reason" ]] && failures+="$reason"$'\n'
  done
  print -rn -- "$failures"
}

# ── self-correction ──────────────────────────────────────────────────────────
# Added 2026-08-24, after the second load incident (849 that morning, 467 on
# 2026-07-28). When the machine is drowning, the build work already running is
# doomed — every job will crawl into its own timeout. Killing it is therefore
# not destructive: it turns runs that would die slowly into runs that die now,
# frees the memory whose paging IS the load, and the runners pick up the next
# job. It is also the only correction available without root: FileVault parks
# an unattended restart at the pre-boot unlock screen, and there is no
# passwordless sudo, so the reboot still needs a person at the machine.
#
# Exact process names only (pkill -x), so the runner listeners, the folklore
# worker, and this monitor can never match.
KILL_PATTERN='xcodebuild|swift-frontend|XCBBuildService|SourceKitService'
RECOVERY_WAIT_SECONDS=90

attempt_recovery() {
  local build sims
  build=$(pgrep -lx "$KILL_PATTERN" 2>/dev/null \
            | awk '{ n[$2]++ } END { for (p in n) printf "%d %s, ", n[p], p }')
  sims=$(pgrep -f CoreSimulator 2>/dev/null | wc -l | tr -d ' ')
  [[ -z "$build" && "$sims" == 0 ]] && return
  pkill -9 -x "$KILL_PATTERN" 2>/dev/null
  # A starved simctl can hang for minutes; detach it so it cannot wedge the
  # monitor. The three runners share one device set, so this shuts down every
  # simulator on the machine — intended: they are all doomed together.
  ( xcrun simctl shutdown all > /dev/null 2>&1 & )
  print -r -- "${build}${sims} simulator processes"
}

send_mail() {
  local subject=$1 body=$2
  [[ -r "$PASS_FILE" ]] || { log "ALERT UNSENT (no app password): $subject"; return 1 }
  {
    printf 'From: %s\r\nTo: %s\r\nSubject: %s\r\n' "$ADDRESS" "$ADDRESS" "$subject"
    printf 'Date: %s\r\n\r\n' "$(LC_ALL=C date '+%a, %d %b %Y %H:%M:%S %z')"
    printf '%s\n' "$body" | sed $'s/$/\r/'
  } | curl -s --ssl-reqd --url "smtps://smtp.gmail.com:465" \
        --user "$ADDRESS:$(cat "$PASS_FILE")" \
        --mail-from "$ADDRESS" --mail-rcpt "$ADDRESS" --upload-file - \
    || log "ALERT UNSENT (smtp failure): $subject"
}

# A degraded machine is noisy near a threshold, so confirm before alerting —
# the same thirty-second re-check the site monitor uses.
failures=$(run_pass)
if [[ -n "$failures" ]]; then
  sleep 30
  failures=$(run_pass)
fi

# Correct before alarming. Only a load or paging failure is something killing
# build work can fix — a full disk or an unreadable sensor is not. Re-measure
# after the kill and let the re-measurement decide which email goes out.
original_failures="$failures"
recovery_note="" killed=""
if print -r -- "$failures" | grep -qE '^(load average is|swap is)'; then
  killed=$(attempt_recovery)
  if [[ -n "$killed" ]]; then
    log "RECOVERY: killed ${killed}"
    sleep $RECOVERY_WAIT_SECONDS
    failures=$(run_pass)
    recovery_note=killed
  else
    log "RECOVERY: nothing to kill"
    recovery_note=nothing
  fi
fi

# Read the state TOTALLY: `cat` on an empty file exits 0, so a `|| print ok`
# fallback never fires and `previous` comes back empty, matching neither
# branch — that silently suppressed a recovery email on the site monitor in
# July. Anything not literally "fail" is ok.
previous=$(cat "$STATE_FILE" 2>/dev/null)
[[ "$previous" == fail ]] || previous=ok

if [[ -n "$failures" ]]; then
  write_state fail
  log "FAIL: ${failures//$'\n'/ · }"
  if [[ "$previous" == ok ]]; then
    case "$recovery_note" in
      killed)  correction="Self-correction was attempted first: the monitor killed the build pile-up
(${killed}) and re-measured ${RECOVERY_WAIT_SECONDS} seconds later — the numbers
above are AFTER that kill. A load average decays slowly, so if the kill was
enough after all, the all-clear email follows within ten minutes. If it does
not arrive, the machine needs the reboot." ;;
      nothing) correction="Self-correction found nothing to do: there was no build work to kill, so
this load is not runaway builds and only the reboot will clear it." ;;
      *)       correction="This is not a failure that killing build work can fix." ;;
    esac
    send_mail "The Mac mini is unhealthy — builds will fail" \
"The build machine's own health check failed twice, thirty seconds apart:

${failures}
This is the MACHINE, not any website or repository. While it is in this state
every continuous-integration run will start, crawl, and die on its own timeout,
and any red run you see is the machine rather than the code.

${correction}

Fix: reboot it. FileVault means an ordinary restart parks it at the pre-boot
unlock screen where nothing runs, so use a Terminal AT the machine:

    sudo fdesetup authrestart

Hardware, for context: Macmini9,1 (M1, 2020), 8 cores, 8 GiB RAM, 8 GiB swap,
running three GitHub Actions runners and Xcode simulators. If this recurs
often, the machine is under-provisioned rather than faulty.

  load ceiling ${LOAD_CEILING} · swap ceiling ${SWAP_PCT_CEILING}% · disk floor ${DISK_FREE_FLOOR_GB} GiB"
  fi
else
  write_state ok
  # Assign UNQUOTED first: inside double quotes `${$(...)[2]}` subscripts a
  # character rather than a word, which logged an empty load for one revision.
  ok_load=${$(sysctl -n vm.loadavg)[2]}
  ok_swap=$(sysctl -n vm.swapusage | sed 's/.*used = //; s/M.*//')
  ok_disk=$(df -g /System/Volumes/Data | awk 'NR==2 {print $4}')
  log "ok load=${ok_load} swap=${ok_swap}M diskfree=${ok_disk}G"
  if [[ "$previous" == fail ]]; then
    extra=""
    [[ "$recovery_note" == killed ]] && extra="

This followed the monitor killing the build pile-up (${killed}) — the
correction, not a coincidence. The killed jobs will show as red runs; re-run
them."
    send_mail "The Mac mini has recovered" \
"The build machine's health check is passing again.

  $(sysctl -n vm.loadavg)
  $(sysctl -n vm.swapusage)
  $(df -h /System/Volumes/Data | tail -1)
${extra}
Continuous integration should go green on the next run."
  elif [[ "$recovery_note" == killed ]]; then
    send_mail "The Mac mini went unhealthy and corrected itself" \
"The build machine's health check failed twice, thirty seconds apart:

${original_failures}
The monitor killed the build pile-up — ${killed} — and shut down every
simulator. ${RECOVERY_WAIT_SECONDS} seconds later the machine passed every
check:

  $(sysctl -n vm.loadavg)
  $(sysctl -n vm.swapusage)

No reboot was needed and nothing is required of you, except that the killed
jobs will show as red runs — re-run them."
  fi
fi
