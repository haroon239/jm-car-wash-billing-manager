import { requireDatabase } from "../config/database";
import type { PlanInput } from "../validators/plan.schema";

const returning = `id,name,price,washes_per_month AS "washesPerMonth"`;

export async function findPlans() {
  return (
    await requireDatabase().query(
      `SELECT ${returning} FROM plans WHERE is_active=TRUE ORDER BY price`,
    )
  ).rows;
}
export async function createPlan(input: PlanInput) {
  return (
    await requireDatabase().query(
      `INSERT INTO plans (name,price,washes_per_month) VALUES ($1,$2,$3) RETURNING ${returning}`,
      [input.name, input.price, input.washesPerMonth],
    )
  ).rows[0];
}
export async function updatePlan(id: number, input: PlanInput) {
  return (
    await requireDatabase().query(
      `UPDATE plans SET name=$1,price=$2,washes_per_month=$3 WHERE id=$4 AND is_active=TRUE RETURNING ${returning}`,
      [input.name, input.price, input.washesPerMonth, id],
    )
  ).rows[0];
}
export async function deactivatePlan(id: number) {
  return (
    await requireDatabase().query(
      "UPDATE plans SET is_active=FALSE WHERE id=$1 AND is_active=TRUE RETURNING id",
      [id],
    )
  ).rows[0];
}
