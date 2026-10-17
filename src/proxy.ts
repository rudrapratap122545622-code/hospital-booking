import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PAGE_PERMISSIONS: { prefix: string; permission: string }[] = [
  { prefix: "/reception", permission: "reception" },
  { prefix: "/appointments", permission: "appointments" },
  { prefix: "/doctor", permission: "doctor" },
  { prefix: "/settings", permission: "settings" },
];

const FALLBACK = "/book";

function landingPageFor(permissions: string[]): string {
  if (permissions.includes("reception")) return "/reception";
  if (permissions.includes("doctor")) return "/doctor";
  if (permissions.includes("appointments")) return "/appointments";
  if (permissions.includes("settings")) return "/settings";
  return FALLBACK;
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const path = request.nextUrl.pathname;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  // FIX: Fail closed. If env vars are missing, don't let them into the app.
  if (!url || !key) {
    const required = PAGE_PERMISSIONS.find((p) => path.startsWith(p.prefix));
    if (required) return NextResponse.redirect(new URL("/login", request.url));
    return response;
  }

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

  const { data: { user } } = await supabase.auth.getUser();
  const required = PAGE_PERMISSIONS.find((p) => path.startsWith(p.prefix));

  if (!required) {
    if (user && path === "/login") {
      const { data: staff } = await supabase
        .from("clinic_staff")
        .select("permissions")
        .eq("user_id", user.id)
        .maybeSingle();
      const landing = landingPageFor((staff?.permissions as string[] | null) ?? []);
      return NextResponse.redirect(new URL(landing, request.url));
    }
    return response;
  }

  if (!user) {
    const login = new URL("/login", request.url);
    // FIX: Prevent open redirect. Only allow internal paths.
    const safeNext = path.startsWith("/") && !path.startsWith("//") ? path : "/reception";
    login.searchParams.set("next", safeNext);
    return NextResponse.redirect(login);
  }

  const { data: staff } = await supabase
    .from("clinic_staff")
    .select("permissions, role")
    .eq("user_id", user.id)
    .maybeSingle();

  // Owners bypass permission checks
  if (staff?.role === "owner") return response;

  const permissions = (staff?.permissions as string[] | null) ?? [];

  if (!permissions.includes(required.permission)) {
    const landing = landingPageFor(permissions);
    if (path.startsWith(landing)) {
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