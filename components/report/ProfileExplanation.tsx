import { dimensionMeta } from "@/data/dimension-meta";
import { displayArchetypeCode } from "@/lib/utils/display";
import {
  BALANCED_SPREAD,
  contrastingTendency,
  DIAGONAL_WINDOW,
  OPPOSITE,
  PURE_GAP,
  rankDimensions,
} from "@/lib/scoring/archetype";
import { DIMENSION_KEY, type ArchetypeCode, type Dimension, type DiscScores } from "@/lib/types";

/**
 * "Why this profile" — full scoring transparency on the DISC report.
 *
 * Everything shown here is recomputed from the participant's stored raw
 * tallies with the same published rules the scoring engine uses, so the
 * displayed profile is always justifiable to the person reading it: their
 * MOST/LEAST counts, the net and 0–100 score per dimension, and the exact
 * rule that selected their primary, secondary or balanced code — including
 * the opposite-pair substitution that produces SA instead of SD.
 */

interface ProfileExplanationProps {
  rawMost: DiscScores;
  rawLeast: DiscScores;
  net: DiscScores;
  normalized: DiscScores;
  primary: Dimension;
  secondary: Dimension | null;
  archetypeCode: ArchetypeCode;
  questionCount?: number;
}

export function ProfileExplanation({
  rawMost,
  rawLeast,
  net,
  normalized,
  primary,
  secondary,
  archetypeCode,
  questionCount = 24,
}: ProfileExplanationProps) {
  const ranked = rankDimensions(normalized);
  const contrasting = contrastingTendency(normalized);
  const score = (dim: Dimension) => normalized[DIMENSION_KEY[dim]];
  const [first, second, third] = ranked as [Dimension, Dimension, Dimension];
  const spread = score(first) - score(ranked[3]!);
  const gap = score(first) - score(second);

  const name = (dim: Dimension) => dimensionMeta[dim].label;
  const letter = (dim: Dimension) => dimensionMeta[dim].displayCode;

  // Replay the published selection rules against this profile's numbers.
  let reason: string;
  if (archetypeCode === "BAL") {
    reason = `Your four scores sit within ${spread} points of each other (${score(first)} down to ${score(ranked[3]!)}). When the spread is ${BALANCED_SPREAD} points or less, no single style dominates, so your profile reads as Balanced rather than forcing a letter.`;
  } else if (!secondary) {
    if (OPPOSITE[first] === second && score(second) - score(third) > DIAGONAL_WINDOW) {
      reason = `${name(first)} leads at ${score(first)}. The next-highest score is ${name(second)} (${score(second)}) — but ${name(first)} and ${name(second)} are behavioural opposites and never pair in a profile code. The third-ranked style, ${name(third)} (${score(third)}), is more than ${DIAGONAL_WINDOW} points behind ${name(second)}, so no substitute qualifies and your profile reads as pure ${letter(first)}.`;
    } else {
      reason = `${name(first)} leads at ${score(first)} — ${gap} points ahead of ${name(second)} (${score(second)}). A lead of ${PURE_GAP} points or more marks a clearly dominant style, so your profile reads as pure ${letter(first)}.`;
    }
  } else if (OPPOSITE[first] === second && secondary === third) {
    reason = `${name(first)} leads at ${score(first)}, and the next-highest score is ${name(second)} (${score(second)}). ${name(first)} and ${name(second)} are behavioural opposites — one is about pace and challenge, the other about steadiness — so they never pair in a profile code. Your third-ranked style, ${name(secondary)} (${score(secondary)}), sits within ${DIAGONAL_WINDOW} points of ${name(second)}, so it becomes your secondary instead. That is why your profile reads ${displayArchetypeCode(archetypeCode)} rather than ${letter(first)}${letter(second)}.`;
  } else {
    reason = `${name(first)} leads at ${score(first)}, with ${name(secondary)} close behind at ${score(secondary)} — a gap of ${gap} points, under the ${PURE_GAP}-point threshold for a pure style. The two combine into the blended profile ${displayArchetypeCode(archetypeCode)}, with ${name(first)} as the stronger voice.`;
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm leading-relaxed text-slate">{reason}</p>

      {/* the numbers, per dimension, strongest first */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead>
            <tr className="border-b border-hairline text-xs text-faint">
              <th scope="col" className="py-2 pr-3 font-medium">Dimension</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">MOST picks</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">LEAST picks</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Net</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Score</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((dim) => {
              const key = DIMENSION_KEY[dim];
              return (
                <tr key={dim} className="border-b border-hairline/60 last:border-0">
                  <td className="flex items-center gap-2.5 py-2.5 pr-3">
                    <span
                      aria-hidden
                      className="flex size-6 items-center justify-center rounded-full font-mono text-[11px] font-semibold text-mineral"
                      style={{ background: `var(--color-${dimensionMeta[dim].colorVar})` }}
                    >
                      {letter(dim)}
                    </span>
                    <span className="font-medium text-ink">
                      {name(dim)}
                      {dim === primary ? (
                        <span className="ml-1.5 font-mono text-[10px] uppercase text-teal">primary</span>
                      ) : dim === secondary ? (
                        <span className="ml-1.5 font-mono text-[10px] uppercase text-faint">secondary</span>
                      ) : dim === contrasting ? (
                        <span className="ml-1.5 font-mono text-[10px] uppercase text-faint">
                          strong contrasting tendency
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate">{rawMost[key]}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate">{rawLeast[key]}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate">
                    {net[key] > 0 ? `+${net[key]}` : net[key]}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold tabular-nums text-ink">
                    {normalized[key]}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* the published method */}
      <div className="flex flex-col gap-2 rounded-2xl bg-mineral p-5">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-teal">
          How the numbers are computed
        </span>
        <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm leading-relaxed text-slate">
          <li>
            Each of the {questionCount} scenarios adds one MOST pick to one dimension and one
            LEAST pick to another. Every scenario counts equally — there is no per-question
            weighting and no hidden lookup table.
          </li>
          <li>Net = MOST − LEAST per dimension (from −{questionCount} to +{questionCount}).</li>
          <li>
            Each net is scaled independently to 0–100, where 50 is neutral. Scores are an
            intensity per dimension, so they don&rsquo;t add up to 100.
          </li>
          <li>
            Profile rules: a spread of ≤ {BALANCED_SPREAD} points reads Balanced; a lead of ≥ {PURE_GAP}{" "}
            points reads as a pure style; otherwise the top two combine — except behavioural
            opposites (Dominant↔Stable, Influence↔Analytical), where the third style substitutes
            if within {DIAGONAL_WINDOW} points. Exact ties order D → I → S → A.
          </li>
        </ol>
        <p className="text-xs leading-relaxed text-faint">
          DISC360 reports behavioural preference, not certainty: no confidence score is computed,
          and the profile describes tendencies — not a clinical measure or a diagnosis.
        </p>
      </div>
    </div>
  );
}
