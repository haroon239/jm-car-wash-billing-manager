import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { changePassword, sessionCookie } from "@/server/auth";

const schema = z.object({
  currentPassword: z.string().min(1).max(1024),
  newPassword: z.string().min(14).max(1024),
});

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin)
    return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { message: "Enter your current password and a new password of at least 14 characters." },
      { status: 400 },
    );
  try {
    const changed = await changePassword(
      request.cookies.get(sessionCookie)?.value,
      parsed.data.currentPassword,
      parsed.data.newPassword,
    );
    if (!changed)
      return NextResponse.json(
        { message: "Current password is incorrect. Please try again." },
        { status: 401 },
      );
    const response = NextResponse.json({ ok: true });
    response.cookies.set(sessionCookie, "", { path: "/", maxAge: 0 });
    return response;
  } catch (error) {
    if (error instanceof Error && "status" in error && error.status === 400)
      return NextResponse.json({ message: error.message }, { status: 400 });
    console.error("Password change failed", error);
    return NextResponse.json(
      { message: "Could not change password. Please try again." },
      { status: 503 },
    );
  }
}
