const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');

const SIZE = 1024;
const TARGET_HEIGHT_RATIO = 0.75;

async function main() {
  const src = await loadImage(
    '/Users/henryhudson/Programming/Main/DaDeckOfCards/DaDeckOfCards/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png'
  );

  // ─── Measure the card in the source image ─────────────────────────────────
  const measure = createCanvas(src.width, src.height);
  const mctx = measure.getContext('2d');
  mctx.drawImage(src, 0, 0);
  const data = mctx.getImageData(0, 0, src.width, src.height).data;

  let minX = 9999, maxX = 0, minY = 9999, maxY = 0;
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const i = (y * src.width + x) * 4;
      if (data[i] > 230 && data[i + 1] > 230 && data[i + 2] > 230) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const cardW = maxX - minX + 1;
  const cardH = maxY - minY + 1;

  // ─── Background colours and divider (measured from source) ─────────────────
  // Scan left edge to find all colour transitions
  const greenR = 51, greenG = 184, greenB = 51;
  const goldR = 209, goldG = 166, goldB = 38;
  const blueR = 56, blueG = 115, blueB = 217;
  const divTop = 479;  // includes 1px green-to-gold transition
  const divBot = 503;  // includes 1px gold-to-blue transition

  console.log(`Source card: ${cardW}x${cardH} at (${minX},${minY})`);
  console.log(`Background: green=rgb(${greenR},${greenG},${greenB}), blue=rgb(${blueR},${blueG},${blueB}), gold=rgb(${goldR},${goldG},${goldB})`);
  console.log(`Divider: y=${divTop} to ${divBot}`);

  // ─── Extract card with padding for rounded corners ────────────────────────
  const pad = 20; // extra pixels around card for anti-aliased edges
  const extractX = Math.max(0, minX - pad);
  const extractY = Math.max(0, minY - pad);
  const extractW = Math.min(src.width - extractX, cardW + pad * 2);
  const extractH = Math.min(src.height - extractY, cardH + pad * 2);

  const cardCanvas = createCanvas(extractW, extractH);
  const cardCtx = cardCanvas.getContext('2d');
  cardCtx.drawImage(src, extractX, extractY, extractW, extractH, 0, 0, extractW, extractH);

  // Make background pixels transparent so card composites cleanly
  const cardData = cardCtx.getImageData(0, 0, extractW, extractH);
  const cd = cardData.data;
  for (let y = 0; y < extractH; y++) {
    for (let x = 0; x < extractW; x++) {
      const i = (y * extractW + x) * 4;
      const r = cd[i], g = cd[i + 1], b = cd[i + 2];
      // If pixel is clearly green, blue, or gold background → make transparent
      const isGreen = g > 120 && r < 100 && b < 100;
      const isBlue = b > 150 && r < 100 && g < 160;
      const isGold = r > 150 && g > 100 && b < 80;
      if (isGreen || isBlue || isGold) {
        cd[i + 3] = 0; // fully transparent
      }
    }
  }
  cardCtx.putImageData(cardData, 0, 0);

  // ─── Build output ─────────────────────────────────────────────────────────
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');

  // Draw background
  ctx.fillStyle = `rgb(${greenR},${greenG},${greenB})`;
  ctx.fillRect(0, 0, SIZE, divTop);

  ctx.fillStyle = `rgb(${goldR},${goldG},${goldB})`;
  ctx.fillRect(0, divTop, SIZE, divBot - divTop + 1);

  ctx.fillStyle = `rgb(${blueR},${blueG},${blueB})`;
  ctx.fillRect(0, divBot + 1, SIZE, SIZE - divBot - 1);

  // Scale card to 88% of icon height
  const newCardH = SIZE * TARGET_HEIGHT_RATIO;
  const scale = newCardH / cardH;
  const newExtractW = extractW * scale;
  const newExtractH = extractH * scale;
  const destX = (SIZE - newExtractW) / 2;
  const destY = (SIZE - newExtractH) / 2;

  ctx.drawImage(cardCanvas, 0, 0, extractW, extractH, destX, destY, newExtractW, newExtractH);

  // ─── Save ─────────────────────────────────────────────────────────────────
  const outPath = '/Users/henryhudson/Programming/Main/henceforth-club/public/icons/dadeckofcards.png';
  fs.writeFileSync(outPath, canvas.toBuffer('image/png'));

  const newCardW = cardW * scale;
  console.log(`\nOutput: ${outPath}`);
  console.log(`Card scaled: ${cardW}x${cardH} → ${Math.round(newCardW)}x${Math.round(newCardH)} (${(TARGET_HEIGHT_RATIO * 100).toFixed(0)}% of ${SIZE})`);
}

main().catch(err => { console.error(err); process.exit(1); });
