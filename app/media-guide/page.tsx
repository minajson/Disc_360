import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/db/server";
import { mediaRegistry, type MediaEntry } from "@/data/media-registry";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = {
  title: "Media guide",
  robots: { index: false, follow: false },
};

const typeStyles: Record<MediaEntry["type"], string> = {
  image: "bg-disc-c-soft text-disc-c",
  video: "bg-disc-d-soft text-disc-d",
  logo: "bg-disc-i-soft text-disc-i",
  icon: "bg-disc-i-soft text-disc-i",
  avatar: "bg-disc-s-soft text-disc-s",
};

const statusStyles: Record<MediaEntry["status"], string> = {
  placeholder: "bg-disc-i-soft text-disc-i",
  ready: "bg-disc-s-soft text-disc-s",
  missing: "bg-disc-d-soft text-disc-d",
};

function Preview({ entry }: { entry: MediaEntry }) {
  return (
    <div
      aria-hidden
      className="relative flex h-20 w-32 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-hairline bg-sand"
    >
      <div className="absolute -left-4 top-0 h-full w-2/3 rounded-full bg-sage/70 blur-xl" />
      {entry.type === "video" ? (
        <span className="relative flex size-8 items-center justify-center rounded-full border border-ink/15 bg-paper/80">
          <svg viewBox="0 0 16 16" className="ml-0.5 size-3" fill="var(--color-ink)">
            <path d="M4 2.5v11l9-5.5-9-5.5Z" />
          </svg>
        </span>
      ) : entry.type === "logo" || entry.type === "icon" ? (
        <svg viewBox="0 0 24 24" className="relative size-8">
          <polygon points="12,3 21,12 12,21 3,12" fill="var(--color-sage)" stroke="var(--color-botanical)" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      ) : entry.type === "avatar" ? (
        <span className="relative flex size-10 items-center justify-center rounded-full border border-ink/15 bg-paper/80">
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="var(--color-slate)" strokeWidth="1.5">
            <circle cx="12" cy="8.5" r="3.5" />
            <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
          </svg>
        </span>
      ) : (
        <svg viewBox="0 0 24 24" className="relative size-7" fill="none" stroke="var(--color-slate)" strokeWidth="1.5" strokeLinejoin="round">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="9" cy="10" r="1.6" />
          <path d="m5 18 5-5 3 3 3.5-3.5L21 17" />
        </svg>
      )}
    </div>
  );
}

/** Dev/super-admin-only inventory of every replaceable visual asset. */
export default async function MediaGuidePage() {
  if (process.env.NODE_ENV !== "development") {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: profile } = user
      ? await supabase.from("profiles").select("is_super_admin").eq("id", user.id).single()
      : { data: null };
    if (!profile?.is_super_admin) notFound();
  }

  const counts = {
    total: mediaRegistry.length,
    placeholder: mediaRegistry.filter((entry) => entry.status === "placeholder").length,
    ready: mediaRegistry.filter((entry) => entry.status === "ready").length,
    missing: mediaRegistry.filter((entry) => entry.status === "missing").length,
  };

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex h-[72px] w-full max-w-7xl items-center justify-between px-5 sm:px-8">
        <BrandLogo />
        <span className="rounded-full bg-ink px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-mineral">
          Media guide
        </span>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-10 sm:px-8">
        <div className="flex flex-col gap-2">
          <Eyebrow>Media audit</Eyebrow>
          <h1 className="font-display text-h2 font-semibold">
            {counts.total} replaceable visual assets
          </h1>
          <p className="max-w-2xl text-sm text-slate">
            Every media slot in DISC360 with its spec and replacement path.
            {" "}{counts.placeholder} placeholder · {counts.ready} ready · {counts.missing} missing.
            Mirrored in MEDIA_AUDIT.md.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {mediaRegistry.map((entry) => (
            <article
              key={entry.id}
              data-media-entry={entry.id}
              className="paper-card flex flex-wrap items-start gap-5 p-5"
            >
              <Preview entry={entry} />
              <div className="flex min-w-0 flex-1 basis-72 flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-ink">{entry.id}</span>
                  <span className={cn("rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wide", typeStyles[entry.type])}>
                    {entry.type}
                  </span>
                  <span className={cn("rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wide", statusStyles[entry.status])}>
                    {entry.status}
                  </span>
                </div>
                <span className="text-sm font-medium text-ink">{entry.purpose}</span>
                <span className="text-xs text-slate">
                  {entry.route} · {entry.section}
                </span>
                <span className="text-xs leading-relaxed text-slate">
                  “{entry.suggestedContent}”
                </span>
              </div>
              <dl className="grid shrink-0 basis-64 grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-[11px]">
                <dt className="text-faint">Size</dt>
                <dd className="text-ink">{entry.dimensions}</dd>
                <dt className="text-faint">Ratio</dt>
                <dd className="text-ink">{entry.ratio}</dd>
                {entry.video ? (
                  <>
                    <dt className="text-faint">Video</dt>
                    <dd className="text-ink">
                      {entry.video.duration} · autoplay {entry.video.autoplay ? "yes" : "no"} · audio{" "}
                      {entry.video.audio ? "yes" : "no"}
                    </dd>
                  </>
                ) : null}
                {entry.transparent ? (
                  <>
                    <dt className="text-faint">BG</dt>
                    <dd className="text-ink">transparent</dd>
                  </>
                ) : null}
                <dt className="text-faint">Replace</dt>
                <dd className="break-words text-slate">{entry.replacementPath}</dd>
              </dl>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
