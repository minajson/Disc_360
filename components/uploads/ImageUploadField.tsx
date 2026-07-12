"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils/cn";
import { mediaUrl } from "@/lib/utils/media";
import { removeMedia, uploadMedia } from "@/lib/actions/uploads";

interface ImageUploadFieldProps {
  /** Storage kind — determines the folder and policy. */
  kind: string;
  /** Hidden-input name the parent form persists. */
  name: string;
  label: string;
  hint: string;
  ratio: "1:1" | "16:9" | "auto";
  /** Currently stored path (from the database). */
  initialPath: string | null;
}

/**
 * Real image upload with preview-before-save: pick a file, review the crop
 * frame, confirm to upload; the stored path travels with the parent form.
 */
export function ImageUploadField({
  kind,
  name,
  label,
  hint,
  ratio,
  initialPath,
}: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [path, setPath] = useState<string | null>(initialPath);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  const frameClass = cn(
    "relative overflow-hidden rounded-2xl border border-hairline bg-sand",
    ratio === "1:1" && "size-32",
    ratio === "16:9" && "aspect-video w-full max-w-xs",
    ratio === "auto" && "flex h-20 w-40 items-center justify-center bg-paper",
  );

  const choose = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setError(null);
    if (!file) return;
    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const confirmUpload = () => {
    if (!pendingFile) return;
    const formData = new FormData();
    formData.set("file", pendingFile);
    startTransition(async () => {
      const result = await uploadMedia(kind, formData);
      if (!result.ok || !result.path) {
        setError(result.error ?? "Upload failed.");
        return;
      }
      if (path) void removeMedia(path); // replace: clean up the previous file
      setPath(result.path);
      setPendingFile(null);
      setPreviewUrl(null);
    });
  };

  const remove = () => {
    startTransition(async () => {
      if (path) await removeMedia(path);
      setPath(null);
      setPendingFile(null);
      setPreviewUrl(null);
      if (inputRef.current) inputRef.current.value = "";
    });
  };

  const shownUrl = previewUrl ?? mediaUrl(path);

  return (
    <div className="flex flex-col gap-2.5">
      <input type="hidden" name={name} value={path ?? ""} />
      <span className="text-sm font-medium text-ink">{label}</span>

      <div className="flex flex-wrap items-start gap-4">
        <div className={frameClass}>
          {shownUrl ? (
            <Image src={shownUrl} alt="" fill className="object-cover" sizes="320px" unoptimized />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="size-8" fill="none" stroke="var(--color-slate)" strokeWidth="1.5" strokeLinejoin="round" aria-hidden>
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <circle cx="9" cy="10" r="1.6" />
                <path d="m5 18 5-5 3 3 3.5-3.5L21 17" />
              </svg>
            </span>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <p className="max-w-xs text-xs leading-relaxed text-slate">{hint}</p>
          <div className="flex flex-wrap gap-2">
            <label className="cursor-pointer rounded-full border border-hairline bg-paper px-4 py-1.5 text-xs text-slate transition-colors hover:border-botanical hover:text-botanical">
              {path || pendingFile ? "Choose different image" : "Choose image"}
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={choose}
                className="sr-only"
              />
            </label>
            {pendingFile ? (
              <button
                type="button"
                onClick={confirmUpload}
                disabled={busy}
                className="rounded-full bg-botanical px-4 py-1.5 text-xs font-medium text-mineral transition-colors hover:bg-botanical-deep disabled:opacity-50"
              >
                {busy ? "Uploading…" : "Use this image"}
              </button>
            ) : null}
            {path && !pendingFile ? (
              <button
                type="button"
                onClick={remove}
                disabled={busy}
                className="rounded-full border border-hairline px-4 py-1.5 text-xs text-slate transition-colors hover:border-disc-d hover:text-disc-d disabled:opacity-50"
              >
                Remove
              </button>
            ) : null}
          </div>
          {pendingFile ? (
            <p className="text-xs text-disc-i">
              Preview shown — confirm to upload, or choose a different image.
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="text-xs text-disc-d">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
