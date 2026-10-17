import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/reception", "/doctor", "/settings"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const path = request.nextUrl.pathname;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    const needsAuth = PROTECTED_PREFIXES.some((p) => path.startsWith(p));
    if (needsAuth) return NextResponse.redirect(new URL("/login", request.url));
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
  const needsAuth = PROTECTED_PREFIXES.some((p) => path.startsWith(p));

  // 1. If not logged in, send to login
  if (needsAuth && !user) {
    const login = new URL("/login", request.url);
    const safeNext = path.startsWith("/") && !path.startsWith("//") ? path : "/reception";
    login.searchParams.set("next", safeNext);
    return NextResponse.redirect(login);
  }

  // 2. If logged in, check routes
  if (user) {
    // Fetch the user's role
    const { data: staff } = await supabase
      .from("clinic_staff")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
      
    const isOwner = staff?.role === "owner";

    // If logged in and visiting /login, send to dashboard
    if (path === "/login") {
      const dest = staff?.role === "doctor" ? "/doctor" : "/reception";
      return NextResponse.redirect(new URL(dest, request.url));
    }

    // SECURITY LOCK: If they try to access /settings but are not an owner, block them.
    if (path.startsWith("/settings") && !isOwner) {
      return NextResponse.redirect(new URL("/reception", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};