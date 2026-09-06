import { NextResponse, type NextRequest } from "next/server";

/** UX redirect only. API RBAC and client session verification remain the authorization gates. */
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/admin/login") return NextResponse.next();
  if (!request.cookies.has("thread_refresh"))
    return NextResponse.redirect(new URL("/admin/login", request.url));
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*"] };
