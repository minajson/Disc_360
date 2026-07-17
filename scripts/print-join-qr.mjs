#!/usr/bin/env node
/**
 * Prints the exact payload encoded in each team's JOIN QR code, resolved the
 * same way the running app resolves it.
 *
 * Usage:
 *   node scripts/print-join-qr.mjs                  # uses .env.local
 *   SITE_URL=https://x.trycloudflare.com node scripts/print-join-qr.mjs
 *
 * The point is to prove what a phone will actually receive before anyone
 * projects a QR at a room. It reads the live invite_token from the database
 * and applies the real SITE_URL precedence, so a stale or local base URL is
 * visible here rather than discovered by a participant who cannot join.
 */

import { readFileSync } from "node:fs";
import { classifyBaseUrl, buildJoinUrl } from "../lib/utils/site-url.ts";

/** Minimal .env reader — process env always wins, matching Next.js. */
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — cannot read teams.",
  );
  process.exit(1);
}

// Which variable actually supplied the base URL. NEXT_PUBLIC_* is frozen into
// the bundle at build time; the unprefixed SITE_URL is read at runtime and
// therefore wins.
const source = process.env.SITE_URL
  ? "SITE_URL"
  : process.env.NEXT_PUBLIC_SITE_URL
    ? "NEXT_PUBLIC_SITE_URL"
    : "none (defaulted to http://localhost:3000)";

const base = classifyBaseUrl(
  process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL,
);

const response = await fetch(
  `${supabaseUrl}/rest/v1/teams?select=name,team_code,invite_token,join_enabled,archived_at&order=name`,
  { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
);
if (!response.ok) {
  console.error(`Supabase read failed: ${response.status} ${response.statusText}`);
  process.exit(1);
}

const teams = (await response.json()).filter((team) => !team.archived_at);

if (teams.length === 0) {
  console.log("No live teams — create a team before generating a join QR.");
  process.exit(0);
}

for (const team of teams) {
  console.log("TEAM JOIN QR PAYLOAD");
  console.log(`Team: ${team.name}`);
  console.log("Source: Team dashboard · Team settings · Presentation screen");
  console.log(`Payload: ${buildJoinUrl(base, team.invite_token)}`);
  console.log(`Environment source: ${source}`);
  console.log(`Local URL detected: ${base.isLocal}`);
  console.log(`Join enabled: ${team.join_enabled}`);
  console.log(`Team code (scan-free fallback): ${team.team_code}`);
  console.log("");
}

if (base.isLocal) {
  console.log(
    [
      "WARNING — this base URL is local. These payloads are NOT scannable from",
      "a phone: the QR would resolve to the phone's own loopback address.",
      "The app surfaces the same warning and withholds the share-ready QR.",
      "",
      "For a real second-device test, re-run with a public HTTPS base:",
      "  SITE_URL=https://<your-tunnel-or-deployment> node scripts/print-join-qr.mjs",
    ].join("\n"),
  );
}
