import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { Writable } from "node:stream";
import pg from "pg";
import { hashPassword } from "../auth";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  if (!input.isTTY) throw new Error("Run this script in an interactive terminal.");
  const reader = createInterface({ input, output });
  try {
    const name = (await reader.question("Administrator name: ")).trim();
    const email = (await reader.question("Administrator email: ")).trim().toLowerCase();
    reader.close();
    const muted = new Writable({
      write(_chunk, _encoding, callback) {
        callback();
      },
    });
    const privateReader = createInterface({ input, output: muted, terminal: true });
    output.write("Password (at least 14 characters): ");
    const password = await privateReader.question("");
    privateReader.close();
    output.write("\n");
    if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || password.length < 14)
      throw new Error("Provide a name, valid email, and password of at least 14 characters.");
    const hash = await hashPassword(password);
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    try {
      await client.connect();
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO app_users(email,name,password_hash,role)
         VALUES($1,$2,$3,'admin')
         ON CONFLICT(email) DO UPDATE SET name=EXCLUDED.name,password_hash=EXCLUDED.password_hash,
           failed_logins=0,locked_until=NULL,updated_at=NOW()`,
        [email, name, hash],
      );
      await client.query(
        "DELETE FROM app_sessions WHERE user_id=(SELECT id FROM app_users WHERE email=$1)",
        [email],
      );
      await client.query("COMMIT");
      console.log("Administrator account saved.");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      await client.end();
    }
  } finally {
    reader.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
