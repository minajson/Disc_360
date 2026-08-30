import { z } from "zod";
import { requireTeamAdmin } from "@/lib/auth/guards";
import { loadCampaignIdentity, loadCampaignTally } from "@/lib/wellbeing/campaign-workspace";

/**
 * Live participation for one campaign, as a server-sent event stream.
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHY SSE AND NOT SUPABASE REALTIME.
 *
 * Supabase Realtime enforces RLS on every change it forwards, which is exactly
 * right and exactly why it cannot be used here. A facilitator has no read
 * access to participants' `wellbeing_sessions` rows — individual wellbeing data
 * is owner-only by design, and no facilitator role is ever going to be given
 * SELECT on it. A realtime channel would therefore deliver nothing, and the
 * only way to make it deliver something would be to widen the policy that
 * keeps a workforce's answers private. That trade is not available.
 *
 * So the aggregation happens on the server, where it is authorised, and what
 * crosses the wire is the AGGREGATE. This route emits five integers. There is
 * no name, no email, no profile id, no session id, no score, no answer and no
 * department in the payload — not filtered out of it, never in it, because
 * `loadCampaignTally` does not select any of those columns.
 *
 * WHY POLLING BEHIND THE STREAM.
 *
 * The facilitator's requirement is "it updates without me refreshing", and a
 * few seconds of latency on a completion counter is invisible in a room. A
 * database trigger plus a broadcast channel would shave that to milliseconds
 * and would need a new publication, a new channel authorisation surface and a
 * new way for aggregate data to leave the database. The cheap answer is the
 * safe one here.
 *
 * A tick that has not changed anything sends nothing but a comment heartbeat,
 * so an idle campaign costs one keep-alive line every few seconds and the
 * client's `onmessage` does not fire.
 * ─────────────────────────────────────────────────────────────────────
 */

/** How often the tally is re-read. */
const TICK_MS = 4000;

/**
 * How long one connection lives before the client is asked to reconnect.
 *
 * Serverless functions are not long-lived processes; a stream held open
 * indefinitely is a stream that will be terminated at an arbitrary moment by
 * the platform. Ending it deliberately and telling `EventSource` to come back
 * turns that into a reconnect the browser already knows how to perform.
 */
const SESSION_MS = 55_000;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const { teamId } = await params;
  if (!z.uuid().safeParse(teamId).success) {
    return new Response("Not found", { status: 404 });
  }

  // The same guard the campaign workspace uses. A participant, or an admin of
  // a different team, gets the redirect/refusal this guard already performs
  // before a single count is computed.
  await requireTeamAdmin(teamId);

  const { identity } = await loadCampaignIdentity(teamId);

  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | null = null;
  let closing: ReturnType<typeof setTimeout> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let last = "";
      let closed = false;

      const finish = () => {
        if (closed) return;
        closed = true;
        if (timer) clearInterval(timer);
        if (closing) clearTimeout(closing);
        try {
          controller.close();
        } catch {
          // Already closed by the client disconnecting first.
        }
      };

      const push = async (force: boolean) => {
        if (closed) return;
        try {
          const tally = await loadCampaignTally(
            teamId,
            identity.instrumentKey,
            identity.capacity,
          );
          const payload = JSON.stringify(tally);
          if (!force && payload === last) {
            // Nothing changed: a comment keeps proxies from closing the
            // connection without waking the client's message handler.
            controller.enqueue(encoder.encode(": keep-alive\n\n"));
            return;
          }
          last = payload;
          controller.enqueue(encoder.encode(`event: tally\ndata: ${payload}\n\n`));
        } catch {
          // A transient read failure is not worth tearing the stream down for;
          // the next tick will either succeed or the client will reconnect.
          try {
            controller.enqueue(encoder.encode(": error\n\n"));
          } catch {
            finish();
          }
        }
      };

      // The client renders server-computed figures first, so the opening frame
      // exists to prove the stream is live rather than to deliver news.
      await push(true);

      timer = setInterval(() => void push(false), TICK_MS);
      closing = setTimeout(finish, SESSION_MS);
      request.signal.addEventListener("abort", finish);
    },
    cancel() {
      if (timer) clearInterval(timer);
      if (closing) clearTimeout(closing);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      // Aggregate or not, this is one organisation's operational data.
      "Cache-Control": "private, no-store, no-transform",
      Connection: "keep-alive",
      // Some proxies buffer streamed responses until they are complete, which
      // turns a live panel into a panel that updates once, a minute late.
      "X-Accel-Buffering": "no",
    },
  });
}
