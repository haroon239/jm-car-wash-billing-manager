import { NextRequest, NextResponse } from "next/server";
import { deleteSession, sessionCookie } from "@/server/auth";

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin)
    return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  await deleteSession(request.cookies.get(sessionCookie)?.value);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookie, "", { path: "/", maxAge: 0 });
  return response;
}
