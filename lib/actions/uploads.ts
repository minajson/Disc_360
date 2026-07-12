"use server";

import { requireUser } from "@/lib/auth/guards";

/**
 * Real storage uploads to the public `media` bucket. Storage RLS restricts
 * writes to the caller's own folder (`<kind>/<uid>/…`); the DB stores only
 * the returned path — never base64.
 */

const ALLOWED_KINDS = new Set([
  "coach-photo",
  "coach-banner",
  "coach-logo",
  "team-cover",
  "org-logo",
  "org-cover",
]);

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const MAX_BYTES = 5 * 1024 * 1024;

export interface UploadResult {
  ok: boolean;
  path?: string;
  error?: string;
}

export async function uploadMedia(
  kind: string,
  formData: FormData,
): Promise<UploadResult> {
  if (!ALLOWED_KINDS.has(kind)) return { ok: false, error: "Unknown upload kind." };

  const { supabase, user } = await requireUser();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose an image file first." };
  }
  const extension = ALLOWED_TYPES[file.type];
  if (!extension) {
    return { ok: false, error: "Use a JPG, PNG or WebP image." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "Images must be 5 MB or smaller." };
  }

  const path = `${kind}/${user.id}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage
    .from("media")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) return { ok: false, error: "Upload failed — please try again." };

  return { ok: true, path };
}

export async function removeMedia(path: string): Promise<UploadResult> {
  const { supabase, user } = await requireUser();
  // Owner check mirrors the storage policy: <kind>/<uid>/<file>
  const segments = path.split("/");
  if (segments.length !== 3 || segments[1] !== user.id || !ALLOWED_KINDS.has(segments[0] ?? "")) {
    return { ok: false, error: "You can only remove your own uploads." };
  }
  const { error } = await supabase.storage.from("media").remove([path]);
  if (error) return { ok: false, error: "Could not remove the file." };
  return { ok: true };
}
