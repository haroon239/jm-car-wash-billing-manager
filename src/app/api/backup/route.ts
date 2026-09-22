import { timingSafeEqual } from "node:crypto";
import { createFullBackup } from "@/server/models/backup.model";
import { publicError } from "@/server/errors";
import { env } from "@/server/config/env";
import { getSessionUser, sessionCookie } from "@/server/auth";
import { cookies } from "next/headers";

export const runtime = "nodejs";

function matchesSecret(value: string) {
  if (!env.backupSecret) return false;
  const supplied = Buffer.from(value);
  const expected = Buffer.from(env.backupSecret);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser((await cookies()).get(sessionCookie)?.value);
    if (user?.role !== "admin")
      return Response.json({ message: "Please sign in as an administrator." }, { status: 401 });
    if (!env.backupSecret)
      return Response.json({ message: "Backup password is not configured." }, { status: 503 });
    if (!matchesSecret(request.headers.get("x-backup-secret") ?? ""))
      return Response.json({ message: "Incorrect backup password." }, { status: 401 });
    const backup = await createFullBackup();
    const date = backup.generatedAt.slice(0, 10);
    return new Response(JSON.stringify(backup, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="JM-Car-Wash-Backup-${date}.json"`,
        "Cache-Control": "no-store, private",
      },
    });
  } catch (error) {
    const result = publicError(error);
    return Response.json({ message: result.message }, { status: result.status });
  }
}
