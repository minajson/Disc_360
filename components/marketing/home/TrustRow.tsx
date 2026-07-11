const markers = [
  { value: "24", label: "forced-choice scenarios" },
  { value: "13", label: "behavioral archetypes" },
  { value: "~7 min", label: "to a complete profile" },
  { value: "Named or anonymous", label: "team reporting, your choice" },
];

export function TrustRow() {
  return (
    <section aria-label="Platform facts" className="rule-t rule-b bg-mineral">
      <div className="mx-auto grid w-full max-w-7xl grid-cols-2 gap-x-8 gap-y-6 px-5 py-8 sm:px-8 lg:grid-cols-4">
        {markers.map((marker) => (
          <div key={marker.label} className="flex flex-col gap-1">
            <span className="font-display text-2xl font-semibold tracking-tight text-ink">
              {marker.value}
            </span>
            <span className="text-sm text-slate">{marker.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
