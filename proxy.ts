import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function readAppMetadataIsActive(appMetadata: unknown): boolean | null {
  if (!appMetadata || typeof appMetadata !== "object") {
    return null;
  }

  const rawIsActive = (appMetadata as Record<string, unknown>).is_active;
  return typeof rawIsActive === "boolean" ? rawIsActive : null;
}

function applyProxyCookies(from: NextResponse, to: NextResponse): NextResponse {
  for (const cookie of from.cookies.getAll()) {
    to.cookies.set(cookie);
  }

  return to;
}

function isProtectedPath(pathname: string): boolean {
  return (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/check-in") ||
    pathname.startsWith("/api/events") ||
    pathname.startsWith("/api/guests") ||
    pathname.startsWith("/api/upload-csv") ||
    pathname.startsWith("/api/verify") ||
    pathname.startsWith("/api/dispatch") ||
    pathname.startsWith("/api/users") ||
    pathname.startsWith("/api/dashboard")
  );
}

export async function proxy(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    return NextResponse.next();
  }

  const response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const cookie of cookiesToSet) {
          request.cookies.set(cookie.name, cookie.value);
          response.cookies.set(cookie.name, cookie.value, cookie.options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  let userIsActive: boolean | null = null;

  if (user) {
    userIsActive = readAppMetadataIsActive(user.app_metadata);

    // Backward compatibility for accounts created before app_metadata.is_active.
    if (userIsActive === null) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("is_active")
        .eq("id", user.id)
        .maybeSingle();

      if (!profileError) {
        userIsActive = profile?.is_active ?? null;
      }
    }
  }

  if (user && userIsActive === false) {
    await supabase.auth.signOut();

    if (pathname.startsWith("/api/")) {
      return applyProxyCookies(
        response,
        NextResponse.json(
        {
          success: false,
          error: "Account suspended.",
        },
        { status: 403 },
      ));
    }

    if (pathname === "/suspended") {
      return response;
    }

    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/suspended";
    redirectUrl.search = "";
    return applyProxyCookies(response, NextResponse.redirect(redirectUrl));
  }

  if (pathname === "/login" && user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    redirectUrl.search = "";
    return applyProxyCookies(response, NextResponse.redirect(redirectUrl));
  }

  if (!isProtectedPath(pathname)) {
    return response;
  }

  if (!user) {
    if (pathname.startsWith("/api/")) {
      return applyProxyCookies(
        response,
        NextResponse.json(
        {
          success: false,
          error: "Unauthorized.",
        },
        { status: 401 },
      ));
    }

    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set(
      "next",
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
    return applyProxyCookies(response, NextResponse.redirect(redirectUrl));
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/check-in/:path*",
    "/api/events/:path*",
    "/api/guests/:path*",
    "/api/upload-csv",
    "/api/verify",
    "/api/dispatch",
    "/api/users/:path*",
    "/api/dashboard/:path*",
    "/login",
    "/suspended",
  ],
};
