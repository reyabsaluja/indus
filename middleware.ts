import { type CookieOptions, createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { getPublicSupabaseConfig } from "@/lib/supabase/config";

const PROTECTED_ROUTES = ["/dashboard", "/company", "/search", "/crypto", "/reports", "/settings"];

export function shouldBypassMiddleware(pathname: string): boolean {
	return pathname === "/api/health";
}

export function isProtectedRoute(pathname: string): boolean {
	return PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
}

export async function middleware(request: NextRequest) {
	if (shouldBypassMiddleware(request.nextUrl.pathname)) {
		return NextResponse.next({ request });
	}

	let supabaseResponse = NextResponse.next({
		request,
	});
	const { url, anonKey } = getPublicSupabaseConfig();

	const supabase = createServerClient(url, anonKey, {
		cookies: {
			getAll() {
				return request.cookies.getAll();
			},
			setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
				cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
				supabaseResponse = NextResponse.next({
					request,
				});
				cookiesToSet.forEach(({ name, value, options }) =>
					supabaseResponse.cookies.set(name, value, options),
				);
			},
		},
	});

	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (isProtectedRoute(request.nextUrl.pathname) && !user) {
		return NextResponse.redirect(new URL("/auth", request.url));
	}

	if (request.nextUrl.pathname.startsWith("/auth") && user) {
		return NextResponse.redirect(new URL("/dashboard", request.url));
	}

	return supabaseResponse;
}

export const config = {
	matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
