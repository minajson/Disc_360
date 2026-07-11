/** Stable index for day-rotating content (tips, prompts). */
export function dailyRotationIndex(): number {
  return Math.floor(Date.now() / 86_400_000);
}
