import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// page prefix → permission required
const PAGE_PERMISSIONS: { prefix: string; permission: string }[] = [
  { prefix: "/reception", permission: "reception" },
  { prefix: "/appointments", permission: "appointments" },
  { prefix: "/doctor", permission: "doctor" },
  { prefix: "/settings", permission: "settings" },
];

// where to send a signed-in user who has no pages at all
const FALLBACK = "/book";

function landingPageFor(permissions: string[]): string {
  // Order matters — first match wins
  if (permissions.includes("reception")) return "/reception";
  if (permissions.includes("doctor")) return "/doctor";
  if (permissions.includes("appointments")) return "/appointments";
  if (permissions.includes("settings")) return "/settings";
  return FALLBACK;
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // Which page does this URL require?
  const required = PAGE_PERMISSIONS.find((p) => path.startsWith(p.prefix));

  // Not a protected page → let it through
  if (!required) {
    // Except: if a signed-in user hits /login, send them to their landing page
    if (user && path === "/login") {
      const { data: staff } = await supabase
        .from("clinic_staff")
        .select("permissions")
        .eq("user_id", user.id)
        .maybeSingle();
      const landing = landingPageFor(
        (staff?.permissions as string[] | null) ?? []
      );
      return NextResponse.redirect(new URL(landing, request.url));
    }
    return response;
  }

  // Protected page — must be signed in
  if (!user) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", path);
    return NextResponse.redirect(login);
  }

  // Signed in — must have the right permission
  const { data: staff } = await supabase
    .from("clinic_staff")
    .select("permissions")
    .eq("user_id", user.id)
    .maybeSingle();

  const permissions = (staff?.permissions as string[] | null) ?? [];

  if (!permissions.includes(required.permission)) {
    // Not allowed here — send them to a page they CAN see
    const landing = landingPageFor(permissions);
    if (path.startsWith(landing)) {
      // They're already on their only allowed page and still lack permission.
      // Send to fallback to avoid a redirect loop.
      return NextResponse.redirect(new URL(FALLBACK, request.url));
    }
    return NextResponse.redirect(new URL(landing, request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};