// The Satoshi loop, materialised. Two actors plus the network:
//   ① Alice → Bob   tx hex over a side channel (solid orange)
//   ② Bob → Net    broadcast (solid warm)
//   ③ Net → Bob    block + Merkle proof (dashed warm)
//   ④ Bob → Alice  HFReceiptBundle over a side channel (dashed warm)
//   ⑤ Alice        verifies the proof locally against her own SPV
//                  headers, never touching the network.
//
// Solid arrows = forward causality (something is sent); dashed arrows =
// verification artifacts coming back. Theme tokens load via Tailwind so
// the diagram inherits the cream .paper palette.

export function ReceiptLoop() {
  return (
    <figure className="my-10">
      <svg
        viewBox="0 0 720 400"
        xmlns="http://www.w3.org/2000/svg"
        className="h-auto w-full"
        role="img"
        aria-label="The Satoshi receipt loop. Alice sends a transaction over a side channel; Bob broadcasts and receives a Merkle proof; Bob returns a receipt bundle; Alice verifies it locally against her own SPV headers."
      >
        <defs>
          <marker
            id="arr-orange"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto"
          >
            <path d="M0,0 L10,5 L0,10 z" className="fill-accent-orange" />
          </marker>
          <marker
            id="arr-warm"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto"
          >
            <path d="M0,0 L10,5 L0,10 z" className="fill-accent-warm" />
          </marker>
        </defs>

        {/* Alice */}
        <g>
          <rect
            x="60"
            y="130"
            width="140"
            height="80"
            rx="10"
            className="fill-card-bg stroke-card-border-hover"
            strokeWidth="1.5"
          />
          <text
            x="130"
            y="168"
            textAnchor="middle"
            className="fill-foreground text-[15px] font-bold"
          >
            Alice
          </text>
          <text
            x="130"
            y="188"
            textAnchor="middle"
            className="fill-muted text-[10px]"
          >
            signer · offline
          </text>
        </g>

        {/* Bob */}
        <g>
          <rect
            x="520"
            y="130"
            width="140"
            height="80"
            rx="10"
            className="fill-card-bg stroke-card-border-hover"
            strokeWidth="1.5"
          />
          <text
            x="590"
            y="168"
            textAnchor="middle"
            className="fill-foreground text-[15px] font-bold"
          >
            Bob
          </text>
          <text
            x="590"
            y="188"
            textAnchor="middle"
            className="fill-muted text-[10px]"
          >
            broadcaster · online
          </text>
        </g>

        {/* Network */}
        <g>
          <rect
            x="520"
            y="290"
            width="140"
            height="64"
            rx="10"
            className="fill-card-bg stroke-card-border-hover"
            strokeWidth="1.5"
            strokeDasharray="5 4"
          />
          <text
            x="590"
            y="318"
            textAnchor="middle"
            className="fill-foreground text-[12px] font-bold"
          >
            Bitcoin network
          </text>
          <text
            x="590"
            y="338"
            textAnchor="middle"
            className="fill-muted text-[10px]"
          >
            miners · headers
          </text>
        </g>

        {/* ① tx hex Alice → Bob */}
        <line
          x1="200"
          y1="100"
          x2="520"
          y2="100"
          className="stroke-accent-orange"
          strokeWidth="2.5"
          markerEnd="url(#arr-orange)"
        />
        <text
          x="360"
          y="80"
          textAnchor="middle"
          className="fill-foreground text-[12px] font-semibold"
        >
          ① tx hex
        </text>
        <text
          x="360"
          y="116"
          textAnchor="middle"
          className="fill-muted text-[10px]"
        >
          AirDrop · USB · QR · paper
        </text>

        {/* ② broadcast Bob → Net */}
        <line
          x1="580"
          y1="210"
          x2="580"
          y2="290"
          className="stroke-accent-warm"
          strokeWidth="2.5"
          markerEnd="url(#arr-warm)"
        />
        <text
          x="572"
          y="252"
          textAnchor="end"
          className="fill-foreground text-[11px] font-semibold"
        >
          ② broadcast
        </text>

        {/* ③ block + proof Net → Bob */}
        <line
          x1="610"
          y1="290"
          x2="610"
          y2="210"
          className="stroke-accent-warm"
          strokeWidth="2"
          strokeDasharray="6 4"
          markerEnd="url(#arr-warm)"
        />
        <text
          x="620"
          y="252"
          className="fill-muted text-[10px]"
        >
          ③ block + proof
        </text>

        {/* ④ receipt bundle Bob → Alice */}
        <line
          x1="520"
          y1="240"
          x2="200"
          y2="240"
          className="stroke-accent-warm"
          strokeWidth="2"
          strokeDasharray="6 4"
          markerEnd="url(#arr-warm)"
        />
        <text
          x="360"
          y="232"
          textAnchor="middle"
          className="fill-foreground text-[12px] font-semibold"
        >
          ④ HFReceiptBundle
        </text>
        <text
          x="360"
          y="260"
          textAnchor="middle"
          className="fill-muted text-[10px]"
        >
          raw tx · TSC Merkle proof · header
        </text>

        {/* ⑤ Alice verifies locally */}
        <g>
          <rect
            x="60"
            y="290"
            width="140"
            height="64"
            rx="10"
            className="fill-accent-warm"
            opacity="0.18"
          />
          <rect
            x="60"
            y="290"
            width="140"
            height="64"
            rx="10"
            fill="none"
            className="stroke-accent-warm"
            strokeWidth="1.5"
          />
          <text
            x="130"
            y="318"
            textAnchor="middle"
            className="fill-foreground text-[12px] font-semibold"
          >
            ⑤ verify locally
          </text>
          <text
            x="130"
            y="338"
            textAnchor="middle"
            className="fill-muted text-[10px]"
          >
            SPV against own headers
          </text>
        </g>

        {/* Connector Alice → ⑤ */}
        <line
          x1="130"
          y1="210"
          x2="130"
          y2="290"
          className="stroke-card-border-hover"
          strokeWidth="1.5"
          strokeDasharray="3 3"
        />
      </svg>
      <figcaption className="mx-auto mt-3 max-w-prose px-4 text-center text-xs text-muted">
        Alice never has to contact the network herself. Bob broadcasts on her behalf and returns a signed bundle; Alice validates Merkle inclusion against her own local headers at the same height — no third-party trust.
      </figcaption>
    </figure>
  );
}
