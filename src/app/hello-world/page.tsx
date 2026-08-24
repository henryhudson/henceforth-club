"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const BLOCK_HEIGHT = 24;
const GAME_WIDTH = 300;
const GAME_HEIGHT = 400;
const COLORS = [
  "#5eead4", "#7ee787", "#fbbf24", "#f87171",
  "#a78bfa", "#fb923c", "#38bdf8", "#e879f9",
];

interface Block {
  x: number;
  width: number;
  color: string;
}

export default function HelloWorldPage() {
  const [gameState, setGameState] = useState<"idle" | "playing" | "over">("idle");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [moving, setMoving] = useState({ x: 0, width: 80, direction: 1 });
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const animRef = useRef<number>(0);
  const speedRef = useRef(2);

  const startGame = useCallback(() => {
    setBlocks([{ x: (GAME_WIDTH - 80) / 2, width: 80, color: COLORS[0] }]);
    setMoving({ x: 0, width: 80, direction: 1 });
    setScore(0);
    speedRef.current = 2;
    setGameState("playing");
  }, []);

  // Animate the moving block
  useEffect(() => {
    if (gameState !== "playing") return;

    function tick() {
      setMoving((prev) => {
        let newX = prev.x + prev.direction * speedRef.current;
        let newDir = prev.direction;

        if (newX + prev.width > GAME_WIDTH) {
          newX = GAME_WIDTH - prev.width;
          newDir = -1;
        }
        if (newX < 0) {
          newX = 0;
          newDir = 1;
        }

        return { ...prev, x: newX, direction: newDir };
      });
      animRef.current = requestAnimationFrame(tick);
    }

    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [gameState]);

  const dropBlock = useCallback(() => {
    if (gameState !== "playing") return;

    setBlocks((prev) => {
      const lastBlock = prev[prev.length - 1];
      const newX = moving.x;
      const newWidth = moving.width;

      // Calculate overlap
      const overlapStart = Math.max(lastBlock.x, newX);
      const overlapEnd = Math.min(lastBlock.x + lastBlock.width, newX + newWidth);
      const overlapWidth = overlapEnd - overlapStart;

      if (overlapWidth <= 0) {
        // Missed completely
        setGameState("over");
        setHighScore((h) => Math.max(h, prev.length - 1));
        return prev;
      }

      const newBlock: Block = {
        x: overlapStart,
        width: overlapWidth,
        color: COLORS[prev.length % COLORS.length],
      };

      const newBlocks = [...prev, newBlock];
      const newScore = newBlocks.length - 1;
      setScore(newScore);

      // Speed up every 5 blocks
      speedRef.current = 2 + Math.floor(newScore / 5) * 0.5;

      // Set up next moving block
      setMoving({
        x: 0,
        width: overlapWidth,
        direction: 1,
      });

      return newBlocks;
    });
  }, [gameState, moving]);

  // Keyboard and touch controls
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.code === "Space" || e.key === "Enter") {
        e.preventDefault();
        if (gameState === "playing") dropBlock();
        else startGame();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [gameState, dropBlock, startGame]);

  const visibleBlocks = blocks.slice(-Math.floor(GAME_HEIGHT / BLOCK_HEIGHT));

  return (
    <div className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-6 text-center">
        <p className="text-xs tracking-widest text-accent-club uppercase">
          Secret page
        </p>
        <h1 className="mt-6 text-4xl sm:text-5xl text-foreground font-bold">
          Stack Attack
        </h1>
        <p className="mt-4 text-muted text-sm">
          Stack blocks as high as you can. A game about stacks, naturally.
        </p>

        {/* Game area */}
        <div className="mt-10 inline-block">
          <div
            className="relative rounded-xl border border-card-border bg-terminal-bg overflow-hidden cursor-pointer"
            style={{ width: GAME_WIDTH, height: GAME_HEIGHT }}
            onClick={() => {
              if (gameState === "playing") dropBlock();
              else startGame();
            }}
          >
            {/* Stacked blocks */}
            {visibleBlocks.map((block, i) => (
              <div
                key={i}
                className="absolute"
                style={{
                  left: block.x,
                  bottom: i * BLOCK_HEIGHT,
                  width: block.width,
                  height: BLOCK_HEIGHT,
                  backgroundColor: block.color,
                  opacity: 0.85,
                  borderRadius: 2,
                  boxShadow: `0 0 10px ${block.color}33`,
                }}
              />
            ))}

            {/* Moving block */}
            {gameState === "playing" && (
              <div
                className="absolute"
                style={{
                  left: moving.x,
                  bottom: blocks.length * BLOCK_HEIGHT,
                  width: moving.width,
                  height: BLOCK_HEIGHT,
                  backgroundColor: COLORS[blocks.length % COLORS.length],
                  opacity: 0.9,
                  borderRadius: 2,
                  boxShadow: `0 0 15px ${COLORS[blocks.length % COLORS.length]}55`,
                }}
              />
            )}

            {/* Idle / Game Over overlay */}
            {gameState !== "playing" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
                {gameState === "over" && (
                  <>
                    <p className="text-accent-warm text-2xl font-bold">{score}</p>
                    <p className="text-muted text-xs mt-1">
                      {score >= 20 ? "FORTH master!" : score >= 10 ? "Nice stack!" : "Keep stacking!"}
                    </p>
                  </>
                )}
                <p className="mt-4 text-foreground text-sm">
                  {gameState === "idle" ? "Click to play" : "Click to retry"}
                </p>
                <p className="mt-1 text-muted/40 text-xs">
                  or press space
                </p>
              </div>
            )}
          </div>

          {/* Score bar */}
          <div className="mt-4 flex justify-between text-xs text-muted/50" style={{ width: GAME_WIDTH }}>
            <span>Score: {score}</span>
            <span>Best: {highScore}</span>
          </div>
        </div>

        <p className="mt-12 text-xs text-muted/30">
          You found the secret page. Well done.
          <br />
          Try the Konami code on any page for another surprise.
        </p>
      </div>
    </div>
  );
}
