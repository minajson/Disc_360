import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { requireOnboarded } from "@/lib/auth/guards";
import { mediaUrl } from "@/lib/utils/media";
import { Eyebrow } from "@/components/ui/Eyebrow";

export const metadata: Metadata = { title: "Profile preview" };

/** Client-facing view of the coach profile, exactly as participants see it. */
export default async function CoachProfilePreviewPage() {
  const { supabase, user, profile } = await requireOnboarded();
  const { data: coach } = await supabase
    .from("coach_profiles")
    .select("*")
    .eq("profile_id", user.id)
    .maybeSingle();

  const photo = mediaUrl(coach?.photo_path);
  const banner = mediaUrl(coach?.banner_path);
  const logo = mediaUrl(coach?.logo_path);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-10 sm:px-8">
      <div className="flex items-baseline justify-between gap-4">
        <Eyebrow>Client-facing preview</Eyebrow>
        <Link href="/app/coach/profile" className="text-sm text-slate hover:text-ink">
          ← Back to editing
        </Link>
      </div>

      <article className="paper-card overflow-hidden p-0">
        {banner ? (
          <div className="relative aspect-[3/1] w-full">
            <Image src={banner} alt="" fill className="object-cover" sizes="768px" unoptimized />
          </div>
        ) : null}
        <div className="flex flex-col gap-5 p-8">
          <div className="flex flex-wrap items-center gap-5">
            {photo ? (
              <Image
                src={photo}
                alt={`Portrait of ${profile.full_name}`}
                width={96}
                height={96}
                className="size-24 rounded-full border-2 border-paper object-cover shadow-md"
                unoptimized
              />
            ) : (
              <span className="flex size-24 items-center justify-center rounded-full bg-sage/40">
                <svg viewBox="0 0 24 24" className="size-10" fill="none" stroke="var(--color-botanical)" strokeWidth="1.5" aria-hidden>
                  <circle cx="12" cy="8.5" r="3.5" />
                  <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
                </svg>
              </span>
            )}
            <div className="flex min-w-0 flex-col gap-0.5">
              <h1 className="font-display text-h3 font-semibold">{profile.full_name}</h1>
              {coach?.title ? <p className="text-sm text-slate">{coach.title}</p> : null}
              {coach?.organization ? (
                <p className="font-mono text-xs text-faint">{coach.organization}</p>
              ) : null}
              {coach?.location ? (
                <p className="font-mono text-xs text-faint">{coach.location}</p>
              ) : null}
            </div>
            {logo ? (
              <Image src={logo} alt="" width={120} height={48} className="ml-auto max-h-12 w-auto object-contain" unoptimized />
            ) : null}
          </div>

          {coach?.bio ? (
            <p className="max-w-xl text-sm leading-relaxed text-slate">{coach.bio}</p>
          ) : null}

          <div className="grid gap-5 sm:grid-cols-3">
            {(
              [
                { label: "Credentials", items: (coach?.credentials ?? []) as string[] },
                { label: "Expertise", items: (coach?.expertise ?? []) as string[] },
                { label: "Specialities", items: (coach?.specialties ?? []) as string[] },
              ] as const
            ).map((group) =>
              group.items.length > 0 ? (
                <div key={group.label} className="flex flex-col gap-1.5">
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
                    {group.label}
                  </span>
                  <ul className="flex flex-col gap-1">
                    {group.items.map((item) => (
                      <li key={item} className="text-sm text-slate">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null,
            )}
          </div>

          <div className="flex flex-wrap gap-4 rule-t pt-4 font-mono text-xs text-faint">
            {coach?.years_experience ? <span>{coach.years_experience} yrs experience</span> : null}
            {coach?.website ? (
              <a href={coach.website} target="_blank" rel="noreferrer" className="hover:text-ink">
                Website
              </a>
            ) : null}
            {coach?.linkedin ? (
              <a href={coach.linkedin} target="_blank" rel="noreferrer" className="hover:text-ink">
                LinkedIn
              </a>
            ) : null}
          </div>
        </div>
      </article>
    </div>
  );
}
