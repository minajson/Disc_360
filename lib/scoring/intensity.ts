import {
  DIMENSION_KEY,
  DIMENSIONS,
  type Dimension,
  type DiscScores,
  type IntensityBand,
} from "@/lib/types";

/** Band labels shown in the UI. */
export const intensityLabels: Record<IntensityBand, string> = {
  LOW: "Reserved",
  MODERATE: "Situational",
  HIGH: "Pronounced",
  VERY_HIGH: "Signature",
};

/**
 * Intensity band for a normalized 0–100 score.
 * Bands: 0–35 LOW, 36–55 MODERATE, 56–75 HIGH, 76–100 VERY_HIGH.
 */
export function segmentIntensity(score: number): IntensityBand {
  if (score <= 35) return "LOW";
  if (score <= 55) return "MODERATE";
  if (score <= 75) return "HIGH";
  return "VERY_HIGH";
}

/** Per-dimension intensity map for a normalized score set. */
export function segmentAllIntensities(
  normalized: DiscScores,
): Record<Dimension, IntensityBand> {
  return Object.fromEntries(
    DIMENSIONS.map((dim) => [
      dim,
      segmentIntensity(normalized[DIMENSION_KEY[dim]]),
    ]),
  ) as Record<Dimension, IntensityBand>;
}
