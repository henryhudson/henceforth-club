// Render the /hansard constituency morph animation to a PNG frame sequence
// matching ConstituencyMorph.tsx exactly. Intended for stitching with
// ffmpeg + the UK national anthem into a Twitter-ready MP4.
//
// Usage: node scripts/generate-hansard-video.js
// Then:  ffmpeg ... (see scripts/hansard-video-README or run script output)

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

// ─── Output config ───────────────────────────────────────────────────
const W = 1080;
const H = 1080;
const FPS = 30;
const CYCLE_MS = 10000;
const TOTAL_FRAMES = (CYCLE_MS / 1000) * FPS; // 300 frames = one full loop
const OUT_DIR = path.join(__dirname, '.frames');

// ─── Load SEATS array from hansard/page.tsx ──────────────────────────
const pageSrc = fs.readFileSync(
  path.join(__dirname, '..', 'src/app/hansard/page.tsx'),
  'utf-8'
);
const seatsMatch = pageSrc.match(/const SEATS:[^=]+=\s*(\[[\s\S]+?\]);/);
if (!seatsMatch) throw new Error('Could not locate SEATS in hansard/page.tsx');
const SEATS = JSON.parse(seatsMatch[1]);
console.log(`Loaded ${SEATS.length} seats`);

// ─── Map projection (ported from ConstituencyMorph.tsx) ──────────────
const minLon = -8, maxLon = 2;
const minLat = 49.8, maxLat = 60.2;
const lonRange = maxLon - minLon;
const latRange = maxLat - minLat;

const mapPositions = SEATS.map(([lon, lat]) => ({
  x: (lon - minLon) / lonRange,
  y: (maxLat - lat) / latRange,
}));

// ─── Pie chart positions — wedges with merged "Others" ─────────────
// Big parties get their own wedges; parties below TINY_THRESHOLD are
// merged into a single "Others" wedge wide enough to avoid overlap
// with its neighbour (Ind). Within the Others wedge, dots keep each
// tiny party's actual colour so every party is still visible — you
// just lose the individual wedge boundaries for the smallest groups.
//
// Why 10? Adjacent wedges must sum to ≥ 42° at innerR=0.06 for their
// innermost dots to clear each other. Leaving any party with ≤ 9
// seats as its own wedge puts it next to another tiny one and fails.
const TINY_THRESHOLD = 10;

const partyCounts = new Map();
for (const [, , colour] of SEATS) {
  partyCounts.set(colour, (partyCounts.get(colour) || 0) + 1);
}
const sortedParties = [...partyCounts.entries()].sort((a, b) => b[1] - a[1]);
const total = SEATS.length;

const dotSpacing = 0.022;
const innerR = 0.06;

// Build wedge list — big parties individually, tiny parties as one group
const bigParties = sortedParties.filter(([, n]) => n >= TINY_THRESHOLD);
const tinyParties = sortedParties.filter(([, n]) => n < TINY_THRESHOLD);
const othersCount = tinyParties.reduce((s, [, n]) => s + n, 0);

const wedges = bigParties.map(([colour, count]) => ({
  kind: 'party',
  colour,
  count,
}));
if (othersCount > 0) {
  wedges.push({ kind: 'others', tiny: tinyParties, count: othersCount });
}

// Assign each wedge an angular range (clockwise from 12 o'clock)
let cumAngle = -Math.PI / 2;
for (const w of wedges) {
  w.startAngle = cumAngle;
  w.sweep = (w.count / total) * Math.PI * 2;
  w.endAngle = cumAngle + w.sweep;
  cumAngle = w.endAngle;
}

// Seat-index queues per colour so we can assign original indices
const partyQueues = new Map();
for (const [colour] of sortedParties) partyQueues.set(colour, []);
for (let i = 0; i < SEATS.length; i++) {
  partyQueues.get(SEATS[i][2]).push(i);
}

// Pack each wedge with concentric arcs (the original algorithm, now
// safe because every wedge is wide enough thanks to the Others merge).
const piePositions = new Array(SEATS.length);
for (const w of wedges) {
  // Seat order within this wedge
  let seatOrder;
  if (w.kind === 'party') {
    seatOrder = partyQueues.get(w.colour);
  } else {
    // Others: concatenate tiny-party queues in sorted order so each
    // tiny party's seats cluster together within the wedge
    seatOrder = [];
    for (const [colour] of w.tiny) seatOrder.push(...partyQueues.get(colour));
  }

  let placed = 0;
  let ring = 0;
  while (placed < w.count) {
    const r = innerR + ring * dotSpacing;
    const arcLen = r * w.sweep;
    const dotsOnRing = Math.max(1, Math.floor(arcLen / dotSpacing));
    const toPlace = Math.min(dotsOnRing, w.count - placed);
    for (let j = 0; j < toPlace; j++) {
      const origIdx = seatOrder[placed];
      const angle = w.startAngle + w.sweep * ((j + 0.5) / dotsOnRing);
      piePositions[origIdx] = {
        x: 0.5 + r * Math.cos(angle),
        y: 0.5 + r * Math.sin(angle),
      };
      placed++;
    }
    ring++;
  }
}

// ─── Render loop ─────────────────────────────────────────────────────
function ease(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const f of fs.readdirSync(OUT_DIR)) {
  if (f.endsWith('.png')) fs.unlinkSync(path.join(OUT_DIR, f));
}

const mapAspect = (latRange / lonRange) * 1.6;
const fitW = mapAspect > 1 ? W / mapAspect : W;
const fitH = mapAspect > 1 ? H : H * mapAspect;
const mapOffX = (W - fitW) / 2;
const mapOffY = (H - fitH) / 2;
const dotR = Math.min(W, H) * 0.008; // slightly larger than web for readability

// ─── Glow sprites (one per unique party colour) ──────────────────────
// Drawn with globalCompositeOperation = 'lighter' in the map phase so
// stacked dots (dense urban constituencies) build an additive bloom
// that keeps brightening past single-pixel alpha saturation.
const hexToRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const glowR = dotR * 3.2;
const glowSize = Math.ceil(glowR * 2 + 2);
const glowOffset = glowSize / 2;
const glowSprites = new Map();
for (const [colour] of sortedParties) {
  const sprite = createCanvas(glowSize, glowSize);
  const sctx = sprite.getContext('2d');
  const [r, g, b] = hexToRgb(colour);
  const grad = sctx.createRadialGradient(
    glowOffset, glowOffset, 0,
    glowOffset, glowOffset, glowR
  );
  grad.addColorStop(0.0, `rgba(${r},${g},${b},0.30)`);
  grad.addColorStop(0.35, `rgba(${r},${g},${b},0.12)`);
  grad.addColorStop(1.0, `rgba(${r},${g},${b},0)`);
  sctx.fillStyle = grad;
  sctx.fillRect(0, 0, glowSize, glowSize);
  glowSprites.set(colour, sprite);
}

const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');

// Pre-compute grid line coords (same every frame)
const gridLines = { vert: [], horiz: [] };
for (let x = 0; x <= W; x += 48) gridLines.vert.push(x);
for (let y = 0; y <= H; y += 48) gridLines.horiz.push(y);

for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
  // Dark background — matches site `#06080a`
  ctx.fillStyle = '#06080a';
  ctx.fillRect(0, 0, W, H);

  // Ambient cyan-blue glow behind the animation
  const glow = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.55);
  glow.addColorStop(0, 'rgba(50, 100, 140, 0.10)');
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Subtle grid (same style as LinkedIn banner script)
  ctx.strokeStyle = 'rgba(90, 120, 155, 0.045)';
  ctx.lineWidth = 1;
  for (const x of gridLines.vert) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (const y of gridLines.horiz) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // Morph factor: 0 = map, 1 = pie
  const now = (frame / FPS) * 1000;
  const cycleT = (now % CYCLE_MS) / CYCLE_MS;
  let morphT;
  if (cycleT < 0.4) morphT = 0;
  else if (cycleT < 0.6) morphT = ease((cycleT - 0.4) / 0.2);
  else if (cycleT < 0.8) morphT = 1;
  else morphT = 1 - ease((cycleT - 0.8) / 0.2);

  // Glow pass — additive 'lighter' blend, faded by morph progress.
  // Single dots give a faint halo; dense clusters bloom visibly.
  const glowStrength = Math.max(0, 1 - morphT);
  if (glowStrength > 0.02) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = glowStrength;
    for (let i = 0; i < SEATS.length; i++) {
      const mx = mapOffX + mapPositions[i].x * fitW;
      const my = mapOffY + mapPositions[i].y * fitH;
      const px = piePositions[i].x * W;
      const py = piePositions[i].y * H;
      const x = mx + (px - mx) * morphT;
      const y = my + (py - my) * morphT;
      ctx.drawImage(glowSprites.get(SEATS[i][2]), x - glowOffset, y - glowOffset);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  // Sharp dot pass — alpha blend keeps single dots crisp and
  // party-coloured; stacked overlaps already brighten to saturation.
  ctx.globalAlpha = 0.78;
  for (let i = 0; i < SEATS.length; i++) {
    const mx = mapOffX + mapPositions[i].x * fitW;
    const my = mapOffY + mapPositions[i].y * fitH;
    const px = piePositions[i].x * W;
    const py = piePositions[i].y * H;
    const x = mx + (px - mx) * morphT;
    const y = my + (py - my) * morphT;
    ctx.beginPath();
    ctx.arc(x, y, dotR, 0, Math.PI * 2);
    ctx.fillStyle = SEATS[i][2];
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Small corner label — site attribution
  ctx.font = '18px "Space Mono", monospace';
  ctx.fillStyle = 'rgba(94, 234, 212, 0.55)';
  ctx.textAlign = 'left';
  ctx.fillText('henceforth.club/hansard', 32, H - 32);
  ctx.textAlign = 'right';
  ctx.fillText('650 seats', W - 32, H - 32);

  const name = `frame_${String(frame).padStart(4, '0')}.png`;
  fs.writeFileSync(path.join(OUT_DIR, name), canvas.toBuffer('image/png'));

  if ((frame + 1) % 30 === 0) {
    process.stdout.write(`  rendered ${frame + 1}/${TOTAL_FRAMES}\n`);
  }
}

console.log(`\n✓ ${TOTAL_FRAMES} frames written to ${OUT_DIR}`);
console.log('\nNext: run ffmpeg to combine frames + anthem audio:');
console.log('  bash scripts/render-hansard-video.sh');
