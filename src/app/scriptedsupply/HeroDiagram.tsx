"use client";

import { motion } from "motion/react";

export default function HeroDiagram() {
  const orange = "#e8731e";
  const cyan = "#5eead4";
  const green = "#7ee787";
  const muted = "#8b949e";
  const dim = "#2d3748";

  return (
    <div className="w-full max-w-3xl mx-auto">
      <svg
        viewBox="0 0 600 360"
        className="w-full h-auto"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <marker
            id="arrow-amber"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={orange} />
          </marker>
          <marker
            id="arrow-green"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={green} />
          </marker>
        </defs>

        {/* Three actor boxes */}
        {[
          { x: 60, label: "OFFICE", delay: 0.0 },
          { x: 250, label: "WAREHOUSE", delay: 0.15 },
          { x: 440, label: "CUSTOMER", delay: 0.3 },
        ].map((actor) => (
          <motion.g
            key={actor.label}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.7,
              delay: actor.delay,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <rect
              x={actor.x}
              y={60}
              width={110}
              height={42}
              rx={4}
              fill="#0a0e14"
              stroke={cyan}
              strokeWidth={1.4}
            />
            <text
              x={actor.x + 55}
              y={86}
              textAnchor="middle"
              fontSize={13}
              fontWeight={700}
              fill={green}
              fontFamily="var(--font-space-mono), monospace"
            >
              {actor.label}
            </text>
          </motion.g>
        ))}

        {/* Forward arrow: Office -> Warehouse (PO) */}
        <motion.line
          x1={170}
          y1={81}
          x2={250}
          y2={81}
          stroke={orange}
          strokeWidth={1.6}
          markerEnd="url(#arrow-amber)"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6, ease: "easeOut" }}
        />
        <motion.text
          x={210}
          y={72}
          textAnchor="middle"
          fontSize={11}
          fontWeight={600}
          fill={orange}
          fontFamily="var(--font-space-mono), monospace"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.9 }}
        >
          PO
        </motion.text>

        {/* Forward arrow: Warehouse -> Customer (Delivery) */}
        <motion.line
          x1={360}
          y1={81}
          x2={440}
          y2={81}
          stroke={orange}
          strokeWidth={1.6}
          markerEnd="url(#arrow-amber)"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.85, ease: "easeOut" }}
        />
        <motion.text
          x={400}
          y={72}
          textAnchor="middle"
          fontSize={11}
          fontWeight={600}
          fill={orange}
          fontFamily="var(--font-space-mono), monospace"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 1.15 }}
        >
          DELIVERY
        </motion.text>

        {/* Return arc: Customer -> Office (Payment) */}
        <motion.path
          d="M 495 105 C 495 200, 115 200, 115 105"
          fill="none"
          stroke={green}
          strokeWidth={1.6}
          markerEnd="url(#arrow-green)"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.9, delay: 1.1, ease: "easeOut" }}
        />
        <motion.text
          x={305}
          y={195}
          textAnchor="middle"
          fontSize={11}
          fontWeight={600}
          fill={green}
          fontFamily="var(--font-space-mono), monospace"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 1.6 }}
        >
          PAYMENT
        </motion.text>

        {/* Dashed verticals connecting actors to chain */}
        {[115, 305, 495].map((x, i) => (
          <motion.line
            key={x}
            x1={x}
            y1={102}
            x2={x}
            y2={235}
            stroke={orange}
            strokeWidth={0.8}
            strokeDasharray="3 4"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.5 }}
            transition={{ duration: 0.5, delay: 1.9 + i * 0.08 }}
          />
        ))}

        {/* Chain band */}
        <motion.rect
          x={30}
          y={235}
          width={540}
          height={28}
          rx={2}
          fill={orange}
          initial={{ opacity: 0, scaleX: 0.6 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ duration: 0.7, delay: 2.0, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformOrigin: "300px 249px" }}
        />
        <motion.text
          x={300}
          y={253}
          textAnchor="middle"
          fontSize={13}
          fontWeight={700}
          fill="#06080a"
          fontFamily="var(--font-space-mono), monospace"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 2.4 }}
        >
          BITCOIN SV — CANONICAL TRUTH
        </motion.text>

        {/* Bottom caption */}
        <motion.text
          x={300}
          y={295}
          textAnchor="middle"
          fontSize={11}
          fill={muted}
          fontFamily="var(--font-space-mono), monospace"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 2.7 }}
        >
          every state transition above is a single Bitcoin SV transaction
        </motion.text>
        <motion.text
          x={300}
          y={312}
          textAnchor="middle"
          fontSize={11}
          fill={muted}
          fontFamily="var(--font-space-mono), monospace"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 2.9 }}
        >
          enforced by Script, atomic by construction
        </motion.text>

        {/* Background corner brackets — subtle terminal frame */}
        {[
          { x: 8, y: 8, path: "M 0 16 L 0 0 L 16 0" },
          { x: 584, y: 8, path: "M 0 0 L 16 0 L 16 16" },
          { x: 8, y: 336, path: "M 0 0 L 0 16 L 16 16" },
          { x: 584, y: 336, path: "M 0 16 L 16 16 L 16 0" },
        ].map((c, i) => (
          <motion.path
            key={i}
            d={c.path}
            transform={`translate(${c.x}, ${c.y})`}
            stroke={dim}
            strokeWidth={1}
            fill="none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.0 }}
          />
        ))}
      </svg>
    </div>
  );
}
