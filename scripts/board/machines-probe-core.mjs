// Pure parsing for machines-probe.mjs: every function here turns captured
// command output into numbers and is unit-tested against real captures.
// Nothing in this file reads a disk, opens a socket or tells the time.

const KIB = 1024;
const MIB = 1024 ** 2;
const GIB = 1024 ** 3;

/** One decimal place, the precision every number in a machine block carries. */
export const round1 = (n) => Math.round(n * 10) / 10;

const UNIT_BYTES = { B: 1, K: KIB, M: MIB, G: GIB, T: 1024 ** 4 };

/** "5120.00M" or "56.1G" as a byte count. */
export function parseSized(value, unit) {
  const scale = UNIT_BYTES[unit.toUpperCase()];
  if (!scale) throw new Error(`unknown size unit "${unit}"`);
  return Number(value) * scale;
}

/** `df -k <volume>`: the last line is the volume, and its second, third and
 *  fourth columns are size, used and available in 1024-byte blocks.
 *  usedPct is the share of the volume that is not available, the number that
 *  says how much headroom is left; df's own Capacity column divides by used
 *  plus available and rounds up, so it reads a point higher. */
export function parseDf(text) {
  const line = String(text).trim().split("\n").filter((l) => l.trim()).at(-1);
  const cols = (line ?? "").trim().split(/\s+/);
  const [blocks, used, avail] = [cols[1], cols[2], cols[3]].map(Number);
  if (![blocks, used, avail].every(Number.isFinite) || blocks <= 0) {
    throw new Error(`df: cannot read a volume line from "${line ?? ""}"`);
  }
  return {
    sizeGiB: round1((blocks * KIB) / GIB),
    freeGiB: round1((avail * KIB) / GIB),
    usedPct: round1(100 * (1 - avail / blocks)),
  };
}

/** `sysctl vm.swapusage`: "vm.swapusage: total = 5120.00M  used = 3678.06M  free = 1441.94M  (encrypted)". */
export function parseSwap(text) {
  const m = /total\s*=\s*([\d.]+)([KMGTB])\s+used\s*=\s*([\d.]+)([KMGTB])/i.exec(String(text));
  if (!m) throw new Error(`swapusage: cannot read "${String(text).trim()}"`);
  return {
    totalMiB: round1(parseSized(m[1], m[2]) / MIB),
    usedMiB: round1(parseSized(m[3], m[4]) / MIB),
  };
}

/** The "up ..." clause of `uptime`, in days. macOS writes any of
 *  "4 days, 15:14", "15:10", "1 day, 2 hrs", "23 mins", "2 secs". */
function uptimeDaysOf(clause) {
  let days = 0;
  for (const part of clause.split(",").map((p) => p.trim()).filter(Boolean)) {
    let m;
    if ((m = /^(\d+)\s+days?$/.exec(part))) days += Number(m[1]);
    else if ((m = /^(\d+):(\d+)$/.exec(part))) days += Number(m[1]) / 24 + Number(m[2]) / 1440;
    else if ((m = /^(\d+)\s+hrs?$/.exec(part))) days += Number(m[1]) / 24;
    else if ((m = /^(\d+)\s+mins?$/.exec(part))) days += Number(m[1]) / 1440;
    else if ((m = /^(\d+)\s+secs?$/.exec(part))) days += Number(m[1]) / 86400;
    else throw new Error(`uptime: cannot read "${part}"`);
  }
  return days;
}

/** `uptime`: "17:01  up 4 days, 15:14, 3 users, load averages: 2.94 2.87 2.41". */
export function parseUptime(text) {
  const s = String(text).trim();
  const load = /load averages?:\s*([\d.]+)/.exec(s);
  const up = /\bup\s+(.+?),\s+\d+\s+users?/.exec(s);
  if (!load || !up) throw new Error(`uptime: cannot read "${s}"`);
  return { load1: round1(Number(load[1])), uptimeDays: round1(uptimeDaysOf(up[1])) };
}

/** `sysctl -n hw.memsize`: bytes. */
export function parseMemsize(text) {
  const bytes = Number(String(text).trim());
  if (!Number.isFinite(bytes) || bytes <= 0) throw new Error(`hw.memsize: cannot read "${String(text).trim()}"`);
  return round1(bytes / GIB);
}

/** The "Total Disk Images: 7 (56.1G)" line of `xcrun simctl runtime list`;
 *  null when the listing carries no such line, so the block omits the field
 *  rather than reporting zero runtimes it never counted. */
export function parseRuntimeTotal(text) {
  const m = /Total Disk Images:\s*(\d+)\s*\(([\d.]+)\s*([KMGTB])/i.exec(String(text));
  return m ? { count: Number(m[1]), gib: round1(parseSized(m[2], m[3]) / GIB) } : null;
}

/** `du -sk` lines, "<kib>\t<path>", in the order given; anything else
 *  (a permission complaint that reached stdout, a blank) is dropped. */
export function parseDuLines(text) {
  return String(text)
    .split("\n")
    .map((line) => /^\s*(\d+)\s+(.+?)\s*$/.exec(line))
    .filter(Boolean)
    .map((m) => ({ path: m[2], kib: Number(m[1]) }));
}

/** The consumers as the block carries them: labelled, in GiB, largest first. */
export function consumersOf(entries, labelOf) {
  return entries
    .map((e) => ({ label: labelOf(e.path), path: e.path, gib: round1((e.kib * KIB) / GIB) }))
    .sort((a, b) => b.gib - a.gib);
}

/** A count and total of a set of du entries (the .xcresult bundles). */
export function bundleTotal(entries) {
  const kib = entries.reduce((sum, e) => sum + e.kib, 0);
  return { count: entries.length, gib: round1((kib * KIB) / GIB) };
}

/** `pgrep ... | wc -l` as a count. */
export function parseCount(text) {
  const n = Number(String(text).trim());
  if (!Number.isInteger(n) || n < 0) throw new Error(`count: cannot read "${String(text).trim()}"`);
  return n;
}

/** The one remote script's output, cut at its "@@name" marker lines into a
 *  map of section name to the text beneath it. */
export function splitSections(text) {
  const out = {};
  let current = null;
  const lines = String(text).split("\n");
  if (lines.at(-1) === "") lines.pop(); // the trailing newline is not an empty line
  for (const line of lines) {
    const m = /^@@(\w+)\s*$/.exec(line);
    if (m) {
      current = m[1];
      out[current] = "";
    } else if (current !== null) {
      out[current] += `${line}\n`;
    }
  }
  return out;
}

/** The four laptop consumers, keyed by the label the block prints. */
export const LAPTOP_CONSUMERS = {
  CoreSimulator: "Library/Developer/CoreSimulator",
  DerivedData: "Library/Developer/Xcode/DerivedData",
  Archives: "Library/Developer/Xcode/Archives",
  Caches: "Library/Caches",
};

function laptopLabel(path) {
  const hit = Object.entries(LAPTOP_CONSUMERS).find(([, suffix]) => path.endsWith(suffix));
  return hit ? hit[0] : path;
}

/** The laptop's block from its captured command output. Throws on any
 *  unreadable capture; the caller turns that into an error block. */
export function laptopBlock({ readAt, df, swap, uptime, memsize, du, runtimes }) {
  const rt = parseRuntimeTotal(runtimes);
  return {
    host: "laptop",
    readAt,
    data: parseDf(df),
    swap: parseSwap(swap),
    memoryGiB: parseMemsize(memsize),
    ...parseUptime(uptime),
    consumers: consumersOf(parseDuLines(du), laptopLabel),
    ...(rt ? { runtimes: rt } : {}),
  };
}

/** The mini's block from the sections of its one remote script. The runner
 *  work trees are labelled by their runner directory ("actions-runner-cards"). */
export function miniBlock({ readAt, sections }) {
  const need = (name) => {
    if (!(name in sections)) throw new Error(`the remote read carried no "${name}" section`);
    return sections[name];
  };
  const home = (sections.home ?? "").trim();
  const label = (path) => {
    const rel = home && path.startsWith(`${home}/`) ? path.slice(home.length + 1) : path;
    return rel.replace(/\/_work$/, "");
  };
  return {
    host: "mini",
    readAt,
    data: parseDf(need("df")),
    swap: parseSwap(need("swap")),
    memoryGiB: parseMemsize(need("memsize")),
    ...parseUptime(need("uptime")),
    runners: parseCount(need("runners")),
    consumers: consumersOf(parseDuLines(need("work")), label),
    xcresults: bundleTotal(parseDuLines(sections.xcresult ?? "")),
  };
}
