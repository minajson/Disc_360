import { DIMENSION_KEY, DIMENSIONS, type Dimension, type DiscScores } from "@/lib/types";

const VIEW = 48;
const CENTER = VIEW / 2;
const RADIUS = 20;

const AXIS: Record<Dimension, { x: number; y: number }> = {
  D: { x: 0, y: -1 },
  I: { x: 1, y: 0 },
  S: { x: 0, y: 1 },
  C: { x: -1, y: 0 },
};

interface ResultGlyphProps {
  scores: DiscScores;
  /** Rendered size in px. */
  size?: number;
  className?: string;
}

/**
 * Tiny DISC kite glyph for history rows and rosters. Server-safe SVG.
 * Swap-point contract: scores in, glyph out.
 */
export function ResultGlyph({ scores, size = 40, className }: ResultGlyphProps) {
  const points = DIMENSIONS.map((dim) => {
    const value = Math.max(0.08, scores[DIMENSION_KEY[dim]] / 100);
    const unit = AXIS[dim];
    return `${CENTER + unit.x * RADIUS * value},${CENTER + unit.y * RADIUS * value}`;
  }).join(" ");

  return (
    <svg
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      width={size}
      height={size}
      aria-hidden
      className={className}
    >
      <polygon
        points={`${CENTER},${CENTER - RADIUS} ${CENTER + RADIUS},${CENTER} ${CENTER},${CENTER + RADIUS} ${CENTER - RADIUS},${CENTER}`}
        fill="none"
        stroke="var(--color-hairline)"
        strokeWidth="1"
      />
      <polygon
        points={points}
        fill="var(--color-teal)"
        fillOpacity="0.22"
        stroke="var(--color-botanical)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
