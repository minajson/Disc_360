/**
 * READ-ONLY audit of attempt/result team scoping (defect L).
 *
 * Reports, per attempt and result: id, user, team linkage, type, status —
 * and flags rows whose team linkage is ambiguous or inconsistent:
 *   - UNSCOPED: attempt/result has no team_id but its owner belongs to
 *     exactly one facilitator-led team running that product (candidate for
 *     a reviewed backfill — NOT changed automatically).
 *   - MISMATCH: a result's team_id differs from its session's team_id.
 * Never modifies data. Run with SUPABASE_URL/SUPABASE_SERVICE_KEY env, or
 * defaults to .env.local (hosted project).
 */
import { readFileSync, existsSync } from "node:fs";

const envFile = existsSync(".env.local")
  ? Object.fromEntries(
      readFileSync(".env.local", "utf8")
        .split("\n")
        .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
        .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
    )
  : {};
const URL_ = process.env.SUPABASE_URL ?? envFile.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY ?? envFile.SUPABASE_SERVICE_ROLE_KEY;
const h = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const get = async (path) => {
  const body = await fetch(`${URL_}/rest/v1/${path}`, { headers: h }).then((r) => r.json());
  if (!Array.isArray(body)) {
    console.error(`query failed (${path.split("?")[0]}):`, body?.message ?? body);
    if (/team_id/.test(body?.message ?? "")) {
      console.error("→ migration 00018 not applied to this database yet; audit runs post-migration.");
      process.exit(2);
    }
    return [];
  }
  return body;
};

const [discSessions, focusSessions, combinedSessions, discResults, focusResults, members, teams] =
  await Promise.all([
    get("assessment_sessions?select=id,profile_id,team_id,status"),
    get("focus_sessions?select=id,profile_id,team_id,status"),
    get("combined_sessions?select=id,profile_id,team_id,status"),
    get("assessment_results?select=id,profile_id,team_id,session_id"),
    get("focus_results?select=id,profile_id,team_id,session_id"),
    get("team_members?select=profile_id,team_id,role,teams(session_mode,assessment_type)"),
    get("teams?select=id,name,assessment_type,session_mode"),
  ]);

const teamName = new Map(teams.map((t) => [t.id, t.name]));
const facilitatedByProfile = new Map();
for (const m of members) {
  if (!m.profile_id || m.role === "team_admin") continue;
  if (m.teams?.session_mode !== "facilitator_led") continue;
  const list = facilitatedByProfile.get(m.profile_id) ?? [];
  list.push({ teamId: m.team_id, product: m.teams.assessment_type });
  facilitatedByProfile.set(m.profile_id, list);
}

const rows = [];
function auditAttempts(list, product, kind) {
  for (const a of list) {
    if (a.team_id) continue;
    const candidates = (facilitatedByProfile.get(a.profile_id) ?? []).filter(
      (t) => t.product === product,
    );
    if (candidates.length > 0) {
      rows.push({
        flag: "UNSCOPED",
        kind,
        id: a.id,
        user: a.profile_id,
        candidates: candidates.map((c) => `${teamName.get(c.teamId)} (${c.teamId.slice(0, 8)})`),
      });
    }
  }
}
auditAttempts(discSessions, "disc", "assessment_session");
auditAttempts(focusSessions, "focus", "focus_session");
auditAttempts(combinedSessions, "combined", "combined_session");

const sessionTeam = new Map(discSessions.map((s) => [s.id, s.team_id]));
for (const r of discResults) {
  const st = sessionTeam.get(r.session_id) ?? null;
  if ((r.team_id ?? null) !== st) {
    rows.push({ flag: "MISMATCH", kind: "assessment_result", id: r.id, resultTeam: r.team_id, sessionTeam: st });
  }
}
const focusSessionTeam = new Map(focusSessions.map((s) => [s.id, s.team_id]));
for (const r of focusResults) {
  const st = focusSessionTeam.get(r.session_id) ?? null;
  if ((r.team_id ?? null) !== st) {
    rows.push({ flag: "MISMATCH", kind: "focus_result", id: r.id, resultTeam: r.team_id, sessionTeam: st });
  }
}

console.log(`teams=${teams.length} disc_sessions=${discSessions.length} focus_sessions=${focusSessions.length} combined_sessions=${combinedSessions.length} disc_results=${discResults.length} focus_results=${focusResults.length}`);
if (rows.length === 0) {
  console.log("AUDIT CLEAN: no unscoped-with-candidate or mismatched rows.");
} else {
  console.log(`FLAGGED ROWS (${rows.length}) — review before any repair:`);
  for (const row of rows) console.log(JSON.stringify(row));
}
