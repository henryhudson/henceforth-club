// Byte-layout comparison for §6: a single 464-byte batched transaction
// versus eight separate 226-byte transactions totalling 1,808 bytes.
//
// The horizontal scale is real (0.38 px / byte), so the visible length
// ratio of the two bars *is* the byte ratio (464 : 1808 ≈ 0.26×). Each
// segment within a bar is also length-accurate against its byte cost
// (overhead 10B, input 148B, output 34B, change 34B). Theme tokens are
// loaded via Tailwind utility classes so the diagram inherits the cream
// .paper palette automatically.

export function TransactionGeometry() {
  const s = 0.38; // px per byte
  const oH = 10 * s;   // overhead
  const iN = 148 * s;  // p2pkh input
  const oP = 34 * s;   // p2pkh output
  const batchedW = oH + iN + 8 * oP + oP; // 1 input + 8 outputs + change + overhead
  const singleW = oH + iN + oP + oP;      // 1 input + 1 output  + change + overhead
  const gap = 5;

  return (
    <figure className="my-10">
      <svg
        viewBox="0 0 720 280"
        xmlns="http://www.w3.org/2000/svg"
        className="h-auto w-full"
        role="img"
        aria-label="Byte-layout comparison: a single 464-byte batched transaction versus eight separate 226-byte transactions totalling 1,808 bytes."
      >
        {/* Top: single batched tx */}
        <text x="0" y="22" className="fill-foreground text-[12px] font-semibold">
          Single batched transaction — 464 bytes
        </text>
        <text x="0" y="38" className="fill-muted text-[10px]">
          1 input + 8 outputs + change + overhead
        </text>
        <g transform="translate(0, 50)">
          <rect x="0" y="0" width={oH} height="28" className="fill-muted" opacity="0.5" />
          <rect x={oH} y="0" width={iN} height="28" className="fill-accent-orange" />
          {[...Array(8)].map((_, i) => (
            <rect
              key={i}
              x={oH + iN + i * oP}
              y="0"
              width={oP - 0.4}
              height="28"
              className="fill-accent-warm"
            />
          ))}
          <rect
            x={oH + iN + 8 * oP}
            y="0"
            width={oP}
            height="28"
            className="fill-accent-warm"
            opacity="0.5"
          />
          <text x={batchedW + 10} y="19" className="fill-foreground text-[11px] font-mono">
            464 B
          </text>
        </g>

        {/* Bottom: 8 separate txs */}
        <text x="0" y="122" className="fill-foreground text-[12px] font-semibold">
          Eight separate transactions — 1,808 bytes
        </text>
        <text x="0" y="138" className="fill-muted text-[10px]">
          1 input + 1 output + change + overhead, × 8
        </text>
        <g transform="translate(0, 150)">
          {[...Array(8)].map((_, i) => {
            const x0 = i * (singleW + gap);
            return (
              <g key={i} transform={`translate(${x0}, 0)`}>
                <rect x="0" y="0" width={oH} height="28" className="fill-muted" opacity="0.5" />
                <rect x={oH} y="0" width={iN} height="28" className="fill-accent-orange" />
                <rect x={oH + iN} y="0" width={oP - 0.4} height="28" className="fill-accent-warm" />
                <rect
                  x={oH + iN + oP}
                  y="0"
                  width={oP}
                  height="28"
                  className="fill-accent-warm"
                  opacity="0.5"
                />
              </g>
            );
          })}
          <text
            x={8 * (singleW + gap) + 10}
            y="19"
            className="fill-foreground text-[11px] font-mono"
          >
            1,808 B
          </text>
        </g>

        {/* Legend */}
        <g transform="translate(0, 230)">
          <rect width="14" height="14" className="fill-muted" opacity="0.5" />
          <text x="20" y="11" className="fill-foreground text-[10px]">
            overhead 10 B
          </text>

          <rect x="120" width="14" height="14" className="fill-accent-orange" />
          <text x="140" y="11" className="fill-foreground text-[10px]">
            input 148 B
          </text>

          <rect x="240" width="14" height="14" className="fill-accent-warm" />
          <text x="260" y="11" className="fill-foreground text-[10px]">
            output 34 B
          </text>

          <rect x="360" width="14" height="14" className="fill-accent-warm" opacity="0.5" />
          <text x="380" y="11" className="fill-foreground text-[10px]">
            change 34 B
          </text>
        </g>
      </svg>
      <figcaption className="mx-auto mt-3 max-w-prose px-4 text-center text-xs text-muted">
        Wire size at 0.38 px / byte — the visible length ratio is the byte ratio. The fixed cost (148-byte input + 10-byte overhead) is amortised across N outputs in the batched form; eight separate transactions pay it eight times.
      </figcaption>
    </figure>
  );
}
