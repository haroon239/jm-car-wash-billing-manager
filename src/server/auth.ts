import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { requireDatabase } from "./config/database";

const scrypt = promisify(scryptCallback);
export const sessionCookie = "jmcw_session";
export const sessionAgeSeconds = 60 * 60 * 12;

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt.toString("hex")}:${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const parts = stored.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = Buffer.from(parts[1], "hex");
  const expected = Buffer.from(parts[2], "hex");
  if (salt.length !== 16 || expected.length !== 64) return false;
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;
  return timingSafeEqual(actual, expected);
}

export function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function authenticate(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const db = requireDatabase();
  const result = await db.query(
    `SELECT id,name,email,role,password_hash,failed_logins,locked_until
     FROM app_users WHERE email=$1 AND is_active=TRUE`,
    [normalizedEmail],
  );
  const user = result.rows[0];
  // Do the same expensive hash operation for unknown accounts.
  const valid = user
    ? await verifyPassword(password, user.password_hash)
    : await hashPassword(password).then(() => false);
  if (!user || (user.locked_until && new Date(user.locked_until) > new Date())) return null;
  if (!valid) {
    await db.query(
      `UPDATE app_users SET failed_logins=failed_logins+1,
       locked_until=CASE WHEN failed_logins+1>=5 THEN NOW()+INTERVAL '15 minutes' ELSE NULL END
       WHERE id=$1`,
      [user.id],
    );
    return null;
  }
  await db.query("UPDATE app_users SET failed_logins=0,locked_until=NULL WHERE id=$1", [user.id]);
  return {
    id: Number(user.id),
    name: user.name as string,
    email: user.email as string,
    role: user.role as "admin",
  };
}

export async function createSession(userId: number) {
  const token = randomBytes(32).toString("base64url");
  await requireDatabase().query(
    `INSERT INTO app_sessions(token_hash,user_id,expires_at)
     VALUES($1,$2,NOW()+INTERVAL '12 hours')`,
    [tokenHash(token), userId],
  );
  return token;
}

export async function getSessionUser(token: string | undefined) {
  if (!token || token.length > 128) return null;
  const result = await requireDatabase().query(
    `SELECT u.id,u.name,u.email,u.role FROM app_sessions s
     JOIN app_users u ON u.id=s.user_id
     WHERE s.token_hash=$1 AND s.expires_at>NOW() AND u.is_active=TRUE`,
    [tokenHash(token)],
  );
  return result.rows[0] ?? null;
}

export async function deleteSession(token: string | undefined) {
  if (token)
    await requireDatabase().query("DELETE FROM app_sessions WHERE token_hash=$1", [
      tokenHash(token),
    ]);
}

export async function changePassword(
  token: string | undefined,
  currentPassword: string,
  newPassword: string,
) {
  if (!token || token.length > 128) return false;
  const client = await requireDatabase().connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT u.id,u.password_hash FROM app_sessions s
       JOIN app_users u ON u.id=s.user_id
       WHERE s.token_hash=$1 AND s.expires_at>NOW() AND u.is_active=TRUE AND u.role='admin'
       FOR UPDATE OF u`,
      [tokenHash(token)],
    );
    const user = result.rows[0];
    if (!user || !(await verifyPassword(currentPassword, user.password_hash))) {
      await client.query("ROLLBACK");
      return false;
    }
    if (await verifyPassword(newPassword, user.password_hash)) {
      await client.query("ROLLBACK");
      throw Object.assign(new Error("Choose a password different from the current one."), {
        status: 400,
      });
    }
    await client.query(
      "UPDATE app_users SET password_hash=$2,failed_logins=0,locked_until=NULL,updated_at=NOW() WHERE id=$1",
      [user.id, await hashPassword(newPassword)],
    );
    await client.query("DELETE FROM app_sessions WHERE user_id=$1", [user.id]);
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
