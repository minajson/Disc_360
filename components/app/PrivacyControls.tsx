"use client";

import {
  cancelAccountDeletion,
  requestAccountDeletion,
} from "@/lib/actions/settings";

export function PrivacyControls({
  deletionRequestedAt,
}: {
  deletionRequestedAt: string | null;
}) {
  return (
    <div className="paper-card flex flex-col gap-5 p-7 sm:p-8">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-base font-semibold">Your data</h2>
        <p className="max-w-lg text-xs leading-relaxed text-slate">
          Export everything your account owns, or request deletion. Deletion
          removes personal data and anonymizes any team aggregates your
          profile contributed to — it is fulfilled by our team and confirmed
          by email.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <a
          href="/app/settings/export"
          download
          className="inline-flex min-h-11 items-center rounded-full border border-hairline-strong px-6 text-sm font-medium text-ink transition-colors hover:border-botanical hover:text-botanical"
        >
          Export my data (JSON)
        </a>

        {deletionRequestedAt ? (
          <form
            action={cancelAccountDeletion}
            className="flex flex-wrap items-center gap-3"
          >
            <span className="text-sm text-disc-d">
              Deletion requested{" "}
              {new Date(deletionRequestedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
              .
            </span>
            <button
              type="submit"
              className="rounded-full border border-hairline px-5 py-2.5 text-sm text-slate transition-colors hover:border-botanical hover:text-botanical"
            >
              Cancel request
            </button>
          </form>
        ) : (
          <form
            action={requestAccountDeletion}
            onSubmit={(event) => {
              if (
                !window.confirm(
                  "Request deletion of your account and personal data? You can cancel the request until it is fulfilled.",
                )
              ) {
                event.preventDefault();
              }
            }}
          >
            <button
              type="submit"
              className="rounded-full border border-disc-d/40 px-6 py-2.5 text-sm text-disc-d transition-colors hover:bg-disc-d-soft"
            >
              Request account deletion
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
