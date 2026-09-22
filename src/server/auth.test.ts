import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, tokenHash, verifyPassword } from "./auth";

test("password hashes use unique salts and verify only the matching password", async () => {
  const first = await hashPassword("a strong and unique password");
  const second = await hashPassword("a strong and unique password");
  assert.notEqual(first, second);
  assert.equal(await verifyPassword("a strong and unique password", first), true);
  assert.equal(await verifyPassword("a different password", first), false);
  assert.equal(await verifyPassword("anything", "malformed"), false);
});

test("session tokens are stored by one-way hash", () => {
  assert.equal(tokenHash("secret").length, 64);
  assert.notEqual(tokenHash("secret"), "secret");
});
