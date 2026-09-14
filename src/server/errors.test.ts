import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { publicError } from "./errors";

test("duplicate phone explains how to resolve without exposing database details", () => {
  const result = publicError({
    code: "23505",
    constraint: "customers_phone_key",
    detail: "secret SQL",
  });
  assert.equal(result.status, 409);
  assert.match(result.message, /WhatsApp number.*already used/);
  assert.doesNotMatch(result.message, /secret|customers_phone_key/);
});
test("other duplicates and references have safe actionable messages", () => {
  assert.match(
    publicError({ code: "23505", constraint: "plans_name_key" }).message,
    /plan.*already exists/,
  );
  assert.equal(publicError({ code: "23503" }).status, 409);
  assert.doesNotMatch(publicError(new Error("password=secret")).message, /secret/);
});
test("validation identifies the field instead of displaying technical schema errors", () => {
  const result = z.object({ phone: z.string().regex(/^\d{7,15}$/) }).safeParse({ phone: "abc" });
  if (!result.success)
    assert.match(publicError(result.error).message, /WhatsApp number with its country code/);
});
