import { test } from "node:test";
import assert from "node:assert/strict";
import { customerSchema } from "./customer.schema";
const customer = {
  name: "Nadeem",
  phone: "923001234567",
  plateNumber: "ABC123",
  planId: 1,
  areaId: 1,
  buildingId: 1,
  vehicles: [{ plateNumber: "ABC123" }],
  planStartDate: "2026-08-13",
  contractEndDate: null,
  washesPerCycle: 4,
  agreedPrice: 99,
  billingType: "monthly",
  autoInvoice: true,
  nextInvoiceDate: "2026-09-13",
};
test("valid historical contract dates are accepted", () => {
  assert.equal(customerSchema.safeParse(customer).success, true);
});
test("contract and billing dates cannot precede start", () => {
  assert.equal(
    customerSchema.safeParse({ ...customer, contractEndDate: "2026-08-12" }).success,
    false,
  );
  assert.equal(
    customerSchema.safeParse({ ...customer, nextInvoiceDate: "2026-08-12" }).success,
    false,
  );
});
test("automatic billing requires a date and cannot be manual", () => {
  assert.equal(customerSchema.safeParse({ ...customer, nextInvoiceDate: null }).success, false);
  assert.equal(customerSchema.safeParse({ ...customer, billingType: "manual" }).success, false);
});
test("duplicate vehicle numbers and fractional cents are rejected", () => {
  assert.equal(
    customerSchema.safeParse({
      ...customer,
      vehicles: [{ plateNumber: "abc123" }, { plateNumber: "ABC123" }],
    }).success,
    false,
  );
  assert.equal(customerSchema.safeParse({ ...customer, agreedPrice: 99.999 }).success, false);
});
