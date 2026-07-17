#!/usr/bin/env node
/**
 * One-time super-admin promotion for production.
 *
 * Use this when you would rather not rely on the allowlist trigger from
 * migration 00012 — for example to promote an address that was never
 * allowlisted, or to verify/repair state after the fact.
 *
 * Usage:
 *   node scripts/promote-super-admin.mjs minajjumbo@gmail.com
 *   node scripts/promote-super-admin.mjs minajjumbo@gmail.com --dry-run
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the
 * environment (or .env.local). Both are read here, in a Node process you run
 * yourself — the service-role key never reaches a browser, and nothing in this
 * file is imported by the app.
 *
 * Properties:
 *  - No password is set or known. The person must already have signed up.
 *  - Refuses to promote an account that has not confirmed its email, because
 *    an unconfirmed address proves nothing about who controls the mailbox.
 *  - Idempotent: an already-promoted account is reported and left alone, with
 *    no second audit row.
 *  - Writes an audit_logs row for the grant.
 */

import { readFileSync } from "node:fs";

const loadEnvFile = (path) => {
  let contents;
  try {
    contents = readFileSync(path, "utf8");
  } catch {
    return;
  }
  for (const line of contents.split("\n")) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
};

loadEnvFile(new URL("../.env.local", import.meta.url).pathname);

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const rawEmail = args.find((a) => !a.startsWith("--"));

if (!rawEmail) {
  console.error("Usage: node scripts/promote-super-admin.mjs <email> [--dry-run]");
  process.exit(1);
}

// Same normalization the migration uses: lower + trim.
const email = rawEmail.trim().toLowerCase();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Set them in the shell or .env.local. Never commit the service-role key.",
  );
  process.exit(1);
}

const rest = async (path, init = {}) => {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new Error(`${init.method ?? "GET"} ${path} → ${response.status} ${await response.text()}`);
  }
  return response.status === 204 ? null : response.json();
};

// auth.users is not exposed over PostgREST; the Admin API is.
const admin = async (path) => {
  const response = await fetch(`${url}/auth/v1/${path}`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  if (!response.ok) {
    throw new Error(`admin ${path} → ${response.status} ${await response.text()}`);
  }
  return response.json();
};

console.log(`Target: ${email}${dryRun ? "  (dry run)" : ""}`);

const found = await admin(`admin/users?filter=${encodeURIComponent(email)}`);
const user = (found.users ?? []).find(
  (candidate) => (candidate.email ?? "").trim().toLowerCase() === email,
);

if (!user) {
  console.error(
    `\nNo account for ${email}.\n` +
      "They must sign up (or sign in with Google/Microsoft) first — this script\n" +
      "only promotes an account that already exists.",
  );
  process.exit(1);
}

if (!user.email_confirmed_at) {
  console.error(
    `\nRefusing to promote ${email}: the address is not confirmed.\n` +
      "An unconfirmed address proves nothing about who controls the mailbox.\n" +
      "Have them confirm, then re-run.",
  );
  process.exit(1);
}

const profiles = await rest(`profiles?id=eq.${user.id}&select=id,email,is_super_admin`);
const profile = profiles[0];
if (!profile) {
  console.error(`\nAccount ${email} exists but has no profile row.`);
  process.exit(1);
}

if (profile.is_super_admin) {
  console.log("\nAlready a super admin — nothing to do. (Idempotent.)");
  process.exit(0);
}

if (dryRun) {
  console.log(`\nWould promote ${email} (profile ${user.id}). No changes made.`);
  process.exit(0);
}

await rest(`profiles?id=eq.${user.id}`, {
  method: "PATCH",
  headers: { Prefer: "return=minimal" },
  body: JSON.stringify({ is_super_admin: true }),
});

await rest("audit_logs", {
  method: "POST",
  headers: { Prefer: "return=minimal" },
  body: JSON.stringify({
    actor_id: user.id,
    action: "profile.super_admin_granted",
    entity_type: "profile",
    entity_id: user.id,
    metadata: { source: "promote_script", email },
  }),
});

console.log(`\nPromoted ${email} to super admin.`);
console.log("Audit: audit_logs action='profile.super_admin_granted' source='promote_script'");
console.log("They must sign out and back in for the new role to appear in their session.");
