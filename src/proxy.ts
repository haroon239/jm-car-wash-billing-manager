import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, sessionCookie } from "./server/auth";

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path === "/login" || path.startsWith("/api/auth/") || path === "/api/cron/billing")
    return NextResponse.next();

  if (request.method !== "GET" && request.method !== "HEAD") {
    const origin = request.headers.get("origin");
    if (!origin || origin !== request.nextUrl.origin)
      return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  }

  try {
    const user = await getSessionUser(request.cookies.get(sessionCookie)?.value);
    if (user?.role === "admin") return NextResponse.next();
  } catch (error) {
    console.error("Authentication check failed", error);
    if (path.startsWith("/api/"))
      return NextResponse.json(
        { message: "Authentication temporarily unavailable." },
        { status: 503 },
      );
    return new NextResponse("Authentication temporarily unavailable.", { status: 503 });
  }
  if (path.startsWith("/api/"))
    return NextResponse.json({ message: "Please sign in." }, { status: 401 });
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = { matcher: ["/", "/api/:path*"] };
