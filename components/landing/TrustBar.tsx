import { PageContainer } from "@/components/layout/PageContainer";
import { Stat } from "@/components/ui/Stat";

const stats = [
  { value: "4", label: "Behavioral dimensions" },
  { value: "13", label: "Distinct archetypes" },
  { value: "24", label: "Forced-choice decisions" },
  { value: "~7 min", label: "To a full profile" },
];

export function TrustBar() {
  return (
    <section className="border-y border-line bg-midnight-900/60">
      <PageContainer className="grid grid-cols-2 gap-8 py-10 sm:grid-cols-4">
        {stats.map((stat) => (
          <Stat key={stat.label} value={stat.value} label={stat.label} />
        ))}
      </PageContainer>
    </section>
  );
}
