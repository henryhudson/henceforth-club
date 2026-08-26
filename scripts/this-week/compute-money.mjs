// The week's public money, taken from the written answers themselves.
//
//   node scripts/this-week/compute-money.mjs 2026-08-19 2026-08-26
//
// Prints a JSON array of {amount, department, purpose}, largest sum first, for
// the wrapper to inject at overview.money. The editorial pass never writes
// these: every figure is quoted from a minister's own answer, which is what
// lets the sheet keep claiming every figure is checked against the record.
const [START, END] = process.argv.slice(2);
if (!START || !END) {
  console.error("usage: compute-money.mjs <START> <END>");
  process.exit(2);
}

const strip = (h) =>
  (h || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const get = async (u) => {
  const r = await fetch(u, { headers: { accept: "application/json" } });
  return r.ok ? r.json() : { results: [] };
};

const SHORT = {
  "Department of Health and Social Care": "Health",
  "Department for Education": "Education",
  "Ministry of Defence": "Defence",
  "Department for Transport": "Transport",
  "Department for Work and Pensions": "Work and Pensions",
  "HM Treasury": "Treasury",
  "Home Office": "Home Office",
  "Department for Energy Security and Net Zero": "Energy",
  "Ministry of Housing, Communities and Local Government": "Housing",
};

const SCALE = { billion: 1e9, bn: 1e9, million: 1e6, m: 1e6, thousand: 1e3, k: 1e3 };
const MONEY = /£\s?[\d,.]+(?:\s?(?:billion|million|thousand|bn|m|k))?/gi;
const magnitude = (a) => {
  const m = a.match(/£\s?([\d,.]+)\s?(billion|million|thousand|bn|m|k)?/i);
  if (!m) return 0;
  return parseFloat(m[1].replace(/,/g, "")) * (SCALE[(m[2] || "").toLowerCase()] ?? 1);
};
// "£3.7bn" reads as shouting in a newspaper column; spell the scale out.
const tidyAmount = (a) =>
  a.replace(/\s+/g, " ").replace(/\bbn\b/i, " billion").replace(/(\d)\s?m\b/i, "$1 million").replace(/\s+/g, " ").trim();

const clip = (text, max = 130) => {
  const t = text.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
};

let rows = [];
for (const house of ["Commons", "Lords"]) {
  let skip = 0, total = Infinity;
  while (skip < total && skip < 400) {
    const p = await get(
      `https://questions-statements-api.parliament.uk/api/writtenquestions/questions?answeredWhenFrom=${START}&answeredWhenTo=${END}&house=${house}&expandMember=true&skip=${skip}&take=100`,
    );
    total = p.totalResults ?? 0;
    rows = rows.concat((p.results ?? []).map((x) => x.value));
    skip += 100;
    if (!p.results?.length) break;
  }
}

// The list endpoint TRUNCATES answerText at ~300 characters, which clips
// sentences mid-figure. Any answer that mentions money is re-fetched in full.
const withMoney = rows.filter((v) => /£/.test(strip(v.answerText)));
const full = new Map();
for (const v of withMoney) {
  const one = await get(`https://questions-statements-api.parliament.uk/api/writtenquestions/questions/${v.id}`);
  full.set(v.id, strip(one.value?.answerText) || strip(v.answerText));
}

const found = [];
for (const v of withMoney) {
  // Departments routinely omit the space after a full stop, so split on that too.
  for (const sentence of (full.get(v.id) ?? "").split(/(?<=\.)\s+|(?<=[a-z)])\.(?=[A-Z])/)) {
    const hits = sentence.match(MONEY);
    if (!hits) continue;
    // A sentence naming several sums is reported once, at its largest.
    const biggest = hits.slice().sort((a, b) => magnitude(b) - magnitude(a))[0];
    if (magnitude(biggest) < 1e6) continue; // below a million is housekeeping, not policy
    found.push({
      amount: tidyAmount(biggest),
      department: SHORT[v.answeringBodyName] ?? v.answeringBodyName,
      purpose: clip(sentence),
      sort: magnitude(biggest),
      // One grouped answer reaches several headings, and departments re-word
      // the same commitment across answers, so one sum per department per week.
      key: `${biggest}|${SHORT[v.answeringBodyName] ?? v.answeringBodyName}`,
    });
  }
}

const seen = new Set();
const items = found
  .sort((a, b) => b.sort - a.sort)
  .filter((f) => (seen.has(f.key) ? false : seen.add(f.key)))
  // Five keeps the column the same height as a two-leg lead; more than that
  // and the sheet opens a hole under the story.
  .slice(0, 5)
  .map(({ amount, department, purpose }) => ({ amount, department, purpose }));

process.stdout.write(JSON.stringify(items));
