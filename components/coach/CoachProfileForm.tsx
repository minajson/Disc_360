"use client";

import { useActionState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/Button";
import { TextField, authInputClasses } from "@/components/auth/fields";
import { ImageUploadField } from "@/components/uploads/ImageUploadField";
import {
  saveCoachProfile,
  type CoachActionState,
} from "@/lib/actions/coach";

const initialState: CoachActionState = { status: "idle", message: "" };

export interface CoachProfileValues {
  full_name: string;
  email: string;
  title: string | null;
  organization: string | null;
  phone: string | null;
  location: string | null;
  bio: string;
  credentials: string[];
  expertise: string[];
  specialties: string[];
  years_experience: number | null;
  website: string | null;
  linkedin: string | null;
  photo_path: string | null;
  banner_path: string | null;
  logo_path: string | null;
  show_in_presentation: boolean;
}

export function CoachProfileForm({ profile }: { profile: CoachProfileValues }) {
  const [state, formAction, pending] = useActionState(saveCoachProfile, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      <section className="paper-card flex flex-col gap-5 p-7">
        <h2 className="font-display text-base font-semibold">Identity</h2>
        <ImageUploadField
          kind="coach-photo"
          name="photo_path"
          label="Profile photo"
          hint="1:1 square, recommended 800×800. JPG, PNG or WebP — shown to participants on join pages, presentations and reports."
          ratio="1:1"
          initialPath={profile.photo_path}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Full name" id="coach-name" name="full_name" defaultValue={profile.full_name} required />
          <TextField label="Professional title" id="coach-title" name="title" defaultValue={profile.title ?? ""} placeholder="e.g. Executive Coach" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField label="Organisation / company" id="coach-org" name="organization" defaultValue={profile.organization ?? ""} />
          <TextField label="Phone (optional)" id="coach-phone" name="phone" type="tel" defaultValue={profile.phone ?? ""} />
          <TextField label="Location (optional)" id="coach-location" name="location" defaultValue={profile.location ?? ""} />
        </div>
        <p className="font-mono text-xs text-faint">Email: {profile.email}</p>
      </section>

      <section className="paper-card flex flex-col gap-5 p-7">
        <h2 className="font-display text-base font-semibold">Professional background</h2>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="coach-bio" className="text-sm font-medium text-ink">
            Short biography
          </label>
          <textarea
            id="coach-bio"
            name="bio"
            rows={4}
            defaultValue={profile.bio}
            className={cn(authInputClasses, "resize-y")}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {(
            [
              { name: "credentials", label: "Credentials / certifications", value: profile.credentials },
              { name: "expertise", label: "Areas of expertise", value: profile.expertise },
              { name: "specialties", label: "Coaching specialities", value: profile.specialties },
            ] as const
          ).map((field) => (
            <div key={field.name} className="flex flex-col gap-1.5">
              <label htmlFor={`coach-${field.name}`} className="text-sm font-medium text-ink">
                {field.label}
              </label>
              <textarea
                id={`coach-${field.name}`}
                name={field.name}
                rows={3}
                defaultValue={field.value.join("\n")}
                placeholder="One per line"
                className={cn(authInputClasses, "resize-y text-xs")}
              />
            </div>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField
            label="Years of experience (optional)"
            id="coach-years"
            name="years_experience"
            type="number"
            min={0}
            max={80}
            defaultValue={profile.years_experience ?? undefined}
          />
          <TextField label="Website (optional)" id="coach-website" name="website" type="url" defaultValue={profile.website ?? ""} placeholder="https://…" />
          <TextField label="LinkedIn (optional)" id="coach-linkedin" name="linkedin" type="url" defaultValue={profile.linkedin ?? ""} placeholder="https://linkedin.com/in/…" />
        </div>
      </section>

      <section className="paper-card flex flex-col gap-5 p-7">
        <h2 className="font-display text-base font-semibold">Brand</h2>
        <ImageUploadField
          kind="coach-banner"
          name="banner_path"
          label="Banner / cover image (optional)"
          hint="16:9, recommended 1600×900 — shown on your workspace and client-facing profile."
          ratio="16:9"
          initialPath={profile.banner_path}
        />
        <ImageUploadField
          kind="coach-logo"
          name="logo_path"
          label="Brand / company logo (optional)"
          hint="Transparent PNG or WebP preferred — appears on reports and presentation credits."
          ratio="auto"
          initialPath={profile.logo_path}
        />
        <label className="flex items-start gap-3 text-sm text-slate">
          <input
            type="checkbox"
            name="show_in_presentation"
            defaultChecked={profile.show_in_presentation}
            className="mt-0.5 size-4 accent-[var(--color-botanical)]"
          />
          <span>Show my facilitator information in presentations and team reports</span>
        </label>
      </section>

      {state.status !== "idle" ? (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={cn("text-sm", state.status === "error" ? "text-disc-d" : "text-botanical")}
        >
          {state.message}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Saving…" : "Save profile"}
        </Button>
        <Link href="/app/coach/profile/preview" className="text-sm text-slate hover:text-ink">
          Preview client-facing profile →
        </Link>
      </div>
    </form>
  );
}
