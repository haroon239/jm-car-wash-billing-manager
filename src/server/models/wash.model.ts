import { requireDatabase } from "../config/database";

export async function findCustomerWashes(customerId: number) {
  return (
    await requireDatabase().query(
      `SELECT wr.id,wr.customer_id AS "customerId",wr.vehicle_id AS "vehicleId",
        v.plate_number AS "plateNumber",wr.washed_at AS "washedAt",wr.note,
        wr.recorded_by AS "recordedBy"
       FROM wash_records wr
       LEFT JOIN vehicles v ON v.id=wr.vehicle_id
       WHERE wr.customer_id=$1
       ORDER BY wr.washed_at DESC,wr.id DESC`,
      [customerId],
    )
  ).rows;
}

export async function createWash(
  customerId: number,
  input: { vehicleId?: number | null; washedAt: string; note: string },
) {
  const client = await requireDatabase().connect();
  try {
    await client.query("BEGIN");
    const customer = await client.query(
      "SELECT id FROM customers WHERE id=$1 AND deleted_at IS NULL",
      [customerId],
    );
    if (!customer.rowCount)
      throw Object.assign(new Error("Active customer not found"), { status: 404 });
    if (input.vehicleId) {
      const vehicle = await client.query("SELECT id FROM vehicles WHERE id=$1 AND customer_id=$2", [
        input.vehicleId,
        customerId,
      ]);
      if (!vehicle.rowCount)
        throw Object.assign(new Error("Vehicle does not belong to this customer"), { status: 400 });
    }
    const result = await client.query(
      `INSERT INTO wash_records(customer_id,vehicle_id,washed_at,note)
       VALUES($1,$2,$3,NULLIF($4,''))
       RETURNING id,customer_id AS "customerId",vehicle_id AS "vehicleId",
         washed_at AS "washedAt",note,recorded_by AS "recordedBy"`,
      [customerId, input.vehicleId ?? null, input.washedAt, input.note],
    );
    await client.query(
      `INSERT INTO customer_activities(customer_id,activity_type,title,details)
       VALUES($1,'car_washed','Car wash recorded',$2)`,
      [customerId, input.note || "Completed wash added to the service history."],
    );
    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteWash(customerId: number, washId: number) {
  return (
    await requireDatabase().query(
      `DELETE FROM wash_records WHERE id=$1 AND customer_id=$2 RETURNING id`,
      [washId, customerId],
    )
  ).rows[0];
}
