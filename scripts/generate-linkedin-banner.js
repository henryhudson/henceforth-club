const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

const W = 1584;
const H = 396;

const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');

// ─── Background ───────────────────────────────────────────────────────────────
ctx.fillStyle = '#06080a';
ctx.fillRect(0, 0, W, H);

// Subtle grid lines — 48px spacing, ~3.5% opacity
ctx.strokeStyle = 'rgba(90, 120, 155, 0.038)';
ctx.lineWidth = 1;
for (let x = 0; x <= W; x += 48) {
  ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
}
for (let y = 0; y <= H; y += 48) {
  ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
}

// Very large ambient glow behind icons area — blue-grey, barely visible
const ambientGrad = ctx.createRadialGradient(W * 0.58, H * 0.5, 0, W * 0.58, H * 0.5, 500);
ambientGrad.addColorStop(0, 'rgba(50, 80, 130, 0.06)');
ambientGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
ctx.fillStyle = ambientGrad;
ctx.fillRect(0, 0, W, H);

// Left edge vignette — softens the left where profile photo covers
const leftVig = ctx.createLinearGradient(0, 0, 220, 0);
leftVig.addColorStop(0, 'rgba(6, 8, 10, 0.6)');
leftVig.addColorStop(1, 'rgba(6, 8, 10, 0)');
ctx.fillStyle = leftVig;
ctx.fillRect(0, 0, 220, H);

// ─── Icon layout ─────────────────────────────────────────────────────────────
// Icons shifted right to avoid LinkedIn profile photo (covers bottom-left ~110x110px)
const ICON_SIZE = 152;
const RADIUS = Math.round(ICON_SIZE * 0.225);
const GAP = 88;
const TOTAL_W = ICON_SIZE * 3 + GAP * 2;

// Center the group, then push right by 100px
const GROUP_CENTER_X = W / 2 + 100;
const START_X = GROUP_CENTER_X - TOTAL_W / 2;

// Vertical: icons occupy most of height, label below, small top margin
const LABEL_HEIGHT = 28;
const ICON_Y = Math.round((H - ICON_SIZE - LABEL_HEIGHT) / 2);

const apps = [
  {
    file: 'dadeckofcards.png',
    name: 'Deck of Cards',
    accent: '#5eead4',
    glowRgba: [94, 234, 212],
  },
  {
    file: 'henceforth.png',
    name: 'Henceforth',
    accent: '#fbbf24',
    glowRgba: [251, 191, 36],
  },
  {
    file: 'hansard.png',
    name: 'Hansard',
    accent: '#3da87a',
    glowRgba: [61, 168, 122],
  },
];

function glow(rgba, alpha) {
  return `rgba(${rgba[0]}, ${rgba[1]}, ${rgba[2]}, ${alpha})`;
}

function roundedRectPath(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

async function main() {
  for (let i = 0; i < apps.length; i++) {
    const app = apps[i];
    const ix = START_X + i * (ICON_SIZE + GAP);
    const cx = ix + ICON_SIZE / 2;
    const cy = ICON_Y + ICON_SIZE / 2;

    // Wide outer glow — large diffuse halo
    const g1 = ctx.createRadialGradient(cx, cy, 0, cx, cy, 220);
    g1.addColorStop(0, glow(app.glowRgba, 0.22));
    g1.addColorStop(0.4, glow(app.glowRgba, 0.10));
    g1.addColorStop(1, glow(app.glowRgba, 0));
    ctx.fillStyle = g1;
    ctx.fillRect(cx - 220, cy - 220, 440, 440);

    // Tight inner glow — bright core behind icon
    const g2 = ctx.createRadialGradient(cx, cy, 0, cx, cy, ICON_SIZE * 0.7);
    g2.addColorStop(0, glow(app.glowRgba, 0.26));
    g2.addColorStop(1, glow(app.glowRgba, 0));
    ctx.fillStyle = g2;
    ctx.fillRect(cx - ICON_SIZE, cy - ICON_SIZE, ICON_SIZE * 2, ICON_SIZE * 2);

    // Draw icon clipped to rounded rect
    const img = await loadImage(path.join('/Users/henryhudson/Programming/Main/henceforth-club/public/icons', app.file));
    ctx.save();
    roundedRectPath(ix, ICON_Y, ICON_SIZE, ICON_SIZE, RADIUS);
    ctx.clip();
    ctx.drawImage(img, ix, ICON_Y, ICON_SIZE, ICON_SIZE);
    ctx.restore();

    // Icon border — subtle white rim
    ctx.save();
    roundedRectPath(ix, ICON_Y, ICON_SIZE, ICON_SIZE, RADIUS);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.10)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // Inset top highlight — very subtle gloss
    ctx.save();
    const topGloss = ctx.createLinearGradient(ix, ICON_Y, ix, ICON_Y + ICON_SIZE * 0.35);
    topGloss.addColorStop(0, 'rgba(255, 255, 255, 0.06)');
    topGloss.addColorStop(1, 'rgba(255, 255, 255, 0)');
    roundedRectPath(ix, ICON_Y, ICON_SIZE, ICON_SIZE, RADIUS);
    ctx.fillStyle = topGloss;
    ctx.fill();
    ctx.restore();

    // App name label
    const labelY = ICON_Y + ICON_SIZE + 24;
    ctx.save();
    ctx.font = '400 15px "Courier New", Courier, monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = app.accent;
    ctx.globalAlpha = 0.92;
    ctx.fillText(app.name.toUpperCase(), cx, labelY);
    ctx.restore();
  }

  // ─── Subtle branding — bottom-right corner ────────────────────────────────
  ctx.save();
  ctx.font = '400 11px "Courier New", Courier, monospace';
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(160, 180, 200, 0.25)';
  ctx.fillText('henceforth.club', W - 24, H - 16);
  ctx.restore();

  // ─── Save ─────────────────────────────────────────────────────────────────
  const outPath = '/Users/henryhudson/Programming/Main/henceforth-club/public/linkedin-banner.png';
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outPath, buffer);

  // Compute actual icon positions for verification
  console.log(`Written: ${outPath}`);
  console.log(`Canvas: ${W}x${H}`);
  console.log(`Icons total width: ${TOTAL_W}, start_x: ${START_X.toFixed(0)}, group_center: ${GROUP_CENTER_X}`);
  console.log(`Icon Y: ${ICON_Y}, Label Y: ${ICON_Y + ICON_SIZE + 22}`);
  for (let i = 0; i < 3; i++) {
    const ix = START_X + i * (ICON_SIZE + GAP);
    console.log(`  Icon ${i}: x=${ix.toFixed(0)}, center=${(ix + ICON_SIZE/2).toFixed(0)}`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
