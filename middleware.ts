import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PROTECTED_PREFIXES = ["/app", "/onboarding", "/wellbeing"];

/**
 * Public entry points inside an otherwise protected prefix.
 *
 * A Wellbeing Pulse join link is scanned off a printed code by someone who may
 * not have an account yet, so it has to resolve before sign-in. Everything
 * else under /wellbeing requires an authenticated participant.
 */
const PUBLIC_EXCEPTIONS = ["/wellbeing/join"];
const AUTH_PAGES = ["/sign-in", "/sign-up", "/forgot-password"];

/** Refreshes the Supabase session cookie and protects authenticated routes. */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Never run logic between client creation and getUser() — token refresh.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isProtected =
    PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix)) &&
    !PUBLIC_EXCEPTIONS.some((prefix) => pathname.startsWith(prefix));
  const isAuthPage = AUTH_PAGES.some((page) => pathname.startsWith(page));

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    // Preserve the query string too. A Wellbeing Pulse link carries the team
    // it was issued for in `?team=`, and dropping it on the way through
    // sign-in would land the participant in an unattributed solo attempt.
    const target = `${pathname}${request.nextUrl.search}`;
    url.search = "";
    url.searchParams.set("next", target);
    return NextResponse.redirect(url);
  }

  if (user && isAuthPage) {
    // An already-authenticated visitor on an auth page still has an INTENT.
    //
    // Someone who scanned a Wellbeing Pulse code and tapped "I already have an
    // account" arrives here with the campaign in `?next=`. Sending them to
    // /app discards it and drops them on the DISC360 dashboard — the exact
    // outcome the whole join fix exists to prevent, reached by a different
    // door.
    //
    // Only a safe relative path is honoured. `//host` is rejected because the
    // browser reads it as protocol-relative and it would become an open
    // redirect off this origin.
    const requested = request.nextUrl.searchParams.get("next");
    const safe = requested && requested.startsWith("/") && !requested.startsWith("//");
    const url = request.nextUrl.clone();
    if (safe) return NextResponse.redirect(new URL(requested, request.nextUrl.origin));
    url.pathname = "/app";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except static assets and images
    "/((?!_next/static|_next/image|favicon.ico|media/|.*\\.(?:svg|png|jpg|jpeg|webp|woff2?)$).*)",
  ],
};
