import { MemberCard } from "@/components/team/MemberCard";
import type { TeamMember } from "@/lib/types";

export function TeamRoster({ members }: { members: TeamMember[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {members.map((member) => (
        <MemberCard key={member.id} member={member} />
      ))}
    </div>
  );
}
