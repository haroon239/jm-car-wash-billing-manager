import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticate, createSession, sessionAgeSeconds, sessionCookie } from "@/server/auth";

const schema = z.object({ email: z.email(), password: z.string().min(1).max(1024) });

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin)
    return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success)
    return NextResponse.json({ message: "Enter a valid email and password." }, { status: 400 });
  try {
    const user = await authenticate(body.data.email, body.data.password);
    if (!user)
      return NextResponse.json(
        { message: "Invalid credentials or account temporarily locked." },
        { status: 401 },
      );
    const token = await createSession(user.id);
    const response = NextResponse.json({ name: user.name, role: user.role });
    response.cookies.set(sessionCookie, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: sessionAgeSeconds,
    });
    return response;
  } catch (error) {
    console.error("Login failed", error);
    return NextResponse.json({ message: "Sign in is temporarily unavailable." }, { status: 503 });
  }
}
