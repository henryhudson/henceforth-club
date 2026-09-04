// The machines probe: one read of Henry's two Macs, printed as one JSON array.
//
// Who calls it. The /hh morning routine, at step 1.8, runs
//   node scripts/board/machines-probe.mjs > "$CLAUDE_JOB_DIR/tmp/machines-$(date +%F).json"
// and pastes the array verbatim into that day's content/board/reports/<date>.json
// as `machines`, so the Morning Edition prints its small square and the week
// has a series to trend. The /whh weekly review runs the same command for a
// fresh read on the day, then folds the week of daily blocks (whh-aggregate.mjs,
// machinesWeek) into retro.machines for the Weekly Edition.
//
// The reading baselines. The laptop below 15 GiB free on /System/Volumes/Data
// is a finding: an archive session needs room, and its space hogs are
// CoreSimulator, the simulator runtime disk images, DerivedData, Archives and
// the caches. The mini is an M1 with 8 GiB, undersized by design, where load
// with no CPU means swap thrash; it should show three runner listeners, and its
// hogs are the runner work trees and the .xcresult bundles they keep. Anything
// that reclaims space is recommended in the edition as an exact command and is
// never run by the routine. This probe reads; it deletes and changes nothing.
//
// Shape, one block per machine (numbers to one decimal):
//   { host, readAt, data: { sizeGiB, freeGiB, usedPct }, swap: { totalMiB, usedMiB },
//     memoryGiB, load1, uptimeDays, consumers: [{ label, path, gib }] largest first,
//     runtimes: { count, gib } (laptop), runners and xcresults: { count, gib } (mini) }
// A machine that cannot be read yields { host, readAt, error } so the daily can
// still be written. Parsing is pure and tested in machines-probe-core.mjs.

import { execFile } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { LAPTOP_CONSUMERS, laptopBlock, miniBlock, splitSections } from "./machines-probe-core.mjs";

const MINI = "henryhudson@henrys-mac-mini.local";
const SSH_CONNECT_SECONDS = 15;
const COMMAND_MS = 5 * 60 * 1000;

/** Runs a command and resolves its stdout. A non-zero exit with output still
 *  resolves: du reports the folders it may not enter and exits 1, and the
 *  sizes it did read are the answer. */
function capture(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: COMMAND_MS, maxBuffer: 64 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err && !stdout) reject(new Error(`${cmd} ${args.join(" ")}: ${(stderr || err.message).trim()}`));
      else resolve(stdout);
    });
  });
}

async function readLaptop() {
  const readAt = new Date().toISOString();
  try {
    const home = homedir();
    const paths = Object.values(LAPTOP_CONSUMERS).map((rel) => join(home, rel));
    const [df, swap, uptime, memsize, du, runtimes] = await Promise.all([
      capture("df", ["-k", "/System/Volumes/Data"]),
      capture("sysctl", ["vm.swapusage"]),
      capture("uptime", []),
      capture("sysctl", ["-n", "hw.memsize"]),
      capture("du", ["-sk", ...paths]),
      capture("xcrun", ["simctl", "runtime", "list"]),
    ]);
    return laptopBlock({ readAt, df, swap, uptime, memsize, du, runtimes });
  } catch (e) {
    return { host: "laptop", readAt, error: e.message };
  }
}

// One remote script, one connection: each read is fenced by a marker line
// that the parser cuts on. Non-interactive shells on the mini lack
// /opt/homebrew/bin, so only system commands are used.
const MINI_SCRIPT = [
  "echo @@df; df -k /System/Volumes/Data",
  "echo @@swap; sysctl vm.swapusage",
  "echo @@uptime; uptime",
  "echo @@memsize; sysctl -n hw.memsize",
  "echo @@work; du -sk ~/actions-runner*/_work 2>/dev/null",
  "echo @@xcresult; find ~/actions-runner*/_work -type d -name '*.xcresult' -prune -exec du -sk {} + 2>/dev/null",
  "echo @@runners; pgrep -fl Runner.Listener | wc -l",
  "echo @@home; echo $HOME",
].join("; ");

async function readMini() {
  const readAt = new Date().toISOString();
  try {
    const out = await capture("ssh", [
      "-o", `ConnectTimeout=${SSH_CONNECT_SECONDS}`,
      "-o", "BatchMode=yes",
      MINI,
      MINI_SCRIPT,
    ]);
    return miniBlock({ readAt, sections: splitSections(out) });
  } catch (e) {
    return { host: "mini", readAt, error: e.message };
  }
}

const blocks = await Promise.all([readLaptop(), readMini()]);
process.stdout.write(`${JSON.stringify(blocks, null, 2)}\n`);
