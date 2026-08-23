/**
 * The headline figures.
 *
 * Median leads and the mean sits beside it as a secondary reading, because a
 * mean alone flattens the shape that matters on a 0–12 count. Nothing here is
 * a composite: there is no "wellbeing index", because no validated definition
 * of one exists.
 */
export function StatRow({
  stats,
}: {
  stats: { label: string; value: string; note?: string }[];
}) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
      {stats.map((stat) => (
        <div key={stat.label} className="flex flex-col gap-1">
          <dt className="text-[11px] tracking-[0.12em] text-faint uppercase">{stat.label}</dt>
          <dd className="font-display text-[clamp(1.6rem,4vw,2.1rem)] leading-none font-semibold text-ink tabular-nums">
            {stat.value}
          </dd>
          {stat.note && <p className="text-xs text-slate">{stat.note}</p>}
        </div>
      ))}
    </dl>
  );
}
