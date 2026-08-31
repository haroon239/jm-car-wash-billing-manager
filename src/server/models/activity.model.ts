import { requireDatabase } from "../config/database";

export async function logCustomerActivity(
  customerId: number,
  activityType: string,
  title: string,
  details?: string,
) {
  await requireDatabase().query(
    `INSERT INTO customer_activities(customer_id,activity_type,title,details)
     VALUES($1,$2,$3,NULLIF($4,''))`,
    [customerId, activityType, title, details ?? ""],
  );
}

export async function findCustomerActivities(customerId: number) {
  return (
    await requireDatabase().query(
      `SELECT id,activity_type AS "activityType",title,details,actor,
        created_at AS "createdAt"
       FROM customer_activities
       WHERE customer_id=$1
       ORDER BY created_at DESC,id DESC`,
      [customerId],
    )
  ).rows;
}
