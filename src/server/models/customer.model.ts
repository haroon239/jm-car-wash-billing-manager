import { requireDatabase } from "../config/database";
import type { CustomerInput } from "../validators/customer.schema";

export async function findCustomers(view: "active" | "archived" | "all") {
  const condition =
    view === "all"
      ? "TRUE"
      : view === "archived"
        ? "c.deleted_at IS NOT NULL"
        : "c.deleted_at IS NULL";
  return (
    await requireDatabase().query(`
    SELECT c.id, c.name, c.phone, c.email, c.plan_start_date AS "customerSince",
      c.plate_number AS "plateNumber",
      c.building_no AS "buildingNo",c.flat_no AS "flatNo",c.room_no AS "roomNo",
      c.parking_no AS "parkingNo",
      c.area_id AS "areaId",c.building_id AS "buildingId",
      a.name AS "areaName",b.name AS "buildingName",prop.name AS "propertyName",
      COALESCE(vehicle_rows.vehicles,'[]'::JSON) AS vehicles,
      c.plan_start_date AS "planStartDate",c.contract_end_date AS "contractEndDate",
      c.washes_per_cycle AS "washesPerCycle",
      COALESCE(wash_totals.completed,0) AS "washesCompleted",
      c.status, c.deleted_at AS "archivedAt",
      p.name AS plan, c.agreed_price AS price, c.billing_type AS "billingType",
      c.auto_invoice AS "autoInvoice", c.next_invoice_date AS "nextInvoiceDate",
      current_invoice.status AS "invoiceStatus",
      current_invoice.due_date AS "invoiceDueDate"
    FROM customers c
    LEFT JOIN plans p ON p.id=c.plan_id
    JOIN areas a ON a.id=c.area_id
    JOIN properties prop ON prop.id=a.property_id
    JOIN buildings b ON b.id=c.building_id
    LEFT JOIN LATERAL (
      SELECT JSON_AGG(
        JSON_BUILD_OBJECT(
          'id',v.id,'plateNumber',v.plate_number,'makeModel',COALESCE(v.make_model,''),
          'parkingNumber',COALESCE(v.parking_number,''),'isPrimary',v.is_primary
        ) ORDER BY v.is_primary DESC,v.id
      ) AS vehicles
      FROM vehicles v WHERE v.customer_id=c.id
    ) vehicle_rows ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::INTEGER AS completed
      FROM wash_records wr
      WHERE wr.customer_id=c.id
        AND wr.washed_at::DATE >= c.plan_start_date
        AND (c.next_invoice_date IS NULL OR wr.washed_at::DATE < c.next_invoice_date)
    ) wash_totals ON TRUE
    LEFT JOIN LATERAL (
      SELECT i.status, i.due_date
      FROM invoices i
      WHERE i.customer_id = c.id
      ORDER BY
        CASE i.status
          WHEN 'overdue' THEN 1
          WHEN 'partially_overdue' THEN 1
          WHEN 'pending' THEN 2
          WHEN 'sent' THEN 3
          WHEN 'partially_paid' THEN 3
          ELSE 4
        END,
        i.billing_period DESC,
        i.id DESC
      LIMIT 1
    ) current_invoice ON TRUE
    WHERE ${condition} ORDER BY c.created_at DESC
  `)
  ).rows;
}

export async function createCustomer(input: CustomerInput) {
  const {
    name,
    phone,
    email,
    plateNumber,
    planId,
    planStartDate,
    agreedPrice,
    billingType,
    autoInvoice,
    nextInvoiceDate,
    buildingNo,
    flatNo,
    roomNo,
    parkingNo,
    areaId,
    buildingId,
    contractEndDate,
    washesPerCycle,
    vehicles,
  } = input;
  const effectiveContractEndDate =
    billingType === "one_time" && !contractEndDate ? nextInvoiceDate : contractEndDate;
  const client = await requireDatabase().connect();
  try {
    await client.query("BEGIN");
    const location = await client.query(
      `SELECT 1 FROM buildings
       WHERE id=$1 AND area_id=$2 AND is_active=TRUE`,
      [buildingId, areaId],
    );
    if (!location.rowCount) throw new Error("Selected building does not belong to this area");
    const result = await client.query(
      `INSERT INTO customers (
        name,phone,email,plate_number,plan_id,plan_start_date,agreed_price,
        billing_type,auto_invoice,next_invoice_date,building_no,flat_no,parking_no,
        area_id,building_id,room_no,contract_end_date,washes_per_cycle
      ) VALUES (
        $1,$2,NULLIF($3,''),$4,$5,$6,$7,$8,$9,$10,
        NULLIF($11,''),NULLIF($12,''),NULLIF($13,''),$14,$15,NULLIF($16,''),$17,$18
      ) RETURNING *`,
      [
        name,
        phone,
        email,
        plateNumber,
        planId,
        planStartDate,
        agreedPrice,
        billingType,
        autoInvoice,
        autoInvoice && ["monthly", "weekly", "one_time"].includes(billingType)
          ? planStartDate
          : nextInvoiceDate,
        buildingNo,
        flatNo,
        parkingNo,
        areaId,
        buildingId,
        roomNo,
        effectiveContractEndDate,
        washesPerCycle,
      ],
    );
    const customerId = Number(result.rows[0].id);
    await client.query(
      `INSERT INTO customer_contracts(customer_id,plan_id,plan_start_date,contract_end_date,
        agreed_price,billing_type,washes_per_cycle,auto_invoice,status)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,'active')`,
      [
        customerId,
        planId,
        planStartDate,
        effectiveContractEndDate,
        agreedPrice,
        billingType,
        washesPerCycle,
        autoInvoice,
      ],
    );
    for (const [index, vehicle] of vehicles.entries()) {
      await client.query(
        `INSERT INTO vehicles(customer_id,plate_number,make_model,parking_number,is_primary)
         VALUES($1,$2,NULLIF($3,''),NULLIF($4,''),$5)`,
        [customerId, vehicle.plateNumber, vehicle.makeModel, vehicle.parkingNumber, index === 0],
      );
    }
    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateCustomer(id: number, input: CustomerInput) {
  const {
    name,
    phone,
    email,
    plateNumber,
    planId,
    planStartDate,
    agreedPrice,
    billingType,
    autoInvoice,
    nextInvoiceDate,
    buildingNo,
    flatNo,
    roomNo,
    parkingNo,
    areaId,
    buildingId,
    contractEndDate,
    washesPerCycle,
    vehicles,
  } = input;
  const effectiveContractEndDate =
    billingType === "one_time" && !contractEndDate ? nextInvoiceDate : contractEndDate;
  const client = await requireDatabase().connect();
  try {
    await client.query("BEGIN");
    const location = await client.query(
      `SELECT 1 FROM buildings
       WHERE id=$1 AND area_id=$2 AND is_active=TRUE`,
      [buildingId, areaId],
    );
    if (!location.rowCount) throw new Error("Selected building does not belong to this area");
    const result = await client.query(
      `UPDATE customers SET name=$1,phone=$2,email=NULLIF($3,''),plate_number=$4,plan_id=$5,
       plan_start_date=$6,agreed_price=$7,billing_type=$8,auto_invoice=$9,
       next_invoice_date=$10,building_no=NULLIF($11,''),flat_no=NULLIF($12,''),
       parking_no=NULLIF($13,''),area_id=$14,building_id=$15,room_no=NULLIF($16,''),
       contract_end_date=$17,washes_per_cycle=$18,updated_at=NOW()
       WHERE id=$19 AND deleted_at IS NULL RETURNING *`,
      [
        name,
        phone,
        email,
        plateNumber,
        planId,
        planStartDate,
        agreedPrice,
        billingType,
        autoInvoice,
        autoInvoice && billingType === "one_time" ? planStartDate : nextInvoiceDate,
        buildingNo,
        flatNo,
        parkingNo,
        areaId,
        buildingId,
        roomNo,
        effectiveContractEndDate,
        washesPerCycle,
        id,
      ],
    );
    if (!result.rowCount) {
      await client.query("ROLLBACK");
      return undefined;
    }
    await client.query(
      `UPDATE customer_contracts SET plan_id=$2,plan_start_date=$3::DATE,
        contract_end_date=$4::DATE,agreed_price=$5,billing_type=$6,
        washes_per_cycle=$7,auto_invoice=$8
       WHERE customer_id=$1 AND status='active'`,
      [
        id,
        planId,
        planStartDate,
        effectiveContractEndDate,
        agreedPrice,
        billingType,
        washesPerCycle,
        autoInvoice,
      ],
    );
    let billingSyncWarning = "";
    const currentBill = await client.query(
      `SELECT i.id,i.invoice_number,
        (SELECT COUNT(*) FROM invoices all_i WHERE all_i.customer_id=i.customer_id) AS invoice_count,
        COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id=i.id),0) AS paid
       FROM invoices i
       WHERE i.customer_id=$1
       ORDER BY i.billing_period DESC,i.id DESC
       LIMIT 1
       FOR UPDATE OF i`,
      [id],
    );
    if (currentBill.rowCount) {
      if (
        Number(currentBill.rows[0].invoice_count) === 1 &&
        Number(currentBill.rows[0].paid) === 0
      ) {
        const dueDate = nextInvoiceDate ?? planStartDate;
        await client.query(
          `UPDATE invoices SET issue_date=$1,billing_period=$1,
             billing_month=DATE_TRUNC('month',$1::DATE)::DATE,due_date=$2,
             subtotal=$3,total=$3,
             description=(SELECT name || ' Car Wash Plan' FROM plans WHERE id=$4),
             status=CASE WHEN $2::DATE < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dubai')::DATE
                         THEN 'overdue' ELSE 'pending' END,
             sent_at=NULL,reminder_sent_at=NULL
           WHERE id=$5`,
          [planStartDate, dueDate, agreedPrice, planId, currentBill.rows[0].id],
        );
      } else if (Number(currentBill.rows[0].paid) > 0) {
        billingSyncWarning = `Customer updated, but bill ${currentBill.rows[0].invoice_number} was not changed because it already has a payment receipt. Financial history remains unchanged.`;
      } else {
        billingSyncWarning =
          "Customer updated. Existing billing history was not rewritten because this customer has multiple bills. Future bills will use the new subscription dates.";
      }
    }
    await client.query("DELETE FROM vehicles WHERE customer_id=$1", [id]);
    for (const [index, vehicle] of vehicles.entries()) {
      await client.query(
        `INSERT INTO vehicles(customer_id,plate_number,make_model,parking_number,is_primary)
         VALUES($1,$2,NULLIF($3,''),NULLIF($4,''),$5)`,
        [id, vehicle.plateNumber, vehicle.makeModel, vehicle.parkingNumber, index === 0],
      );
    }
    await client.query("COMMIT");
    return { ...result.rows[0], billingSyncWarning };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function archiveCustomer(id: number) {
  return (
    await requireDatabase().query(
      "UPDATE customers SET deleted_at=NOW(),status='archived' WHERE id=$1 AND deleted_at IS NULL RETURNING id",
      [id],
    )
  ).rows[0];
}

export async function restoreCustomer(id: number) {
  return (
    await requireDatabase().query(
      "UPDATE customers SET deleted_at=NULL,status='active',updated_at=NOW() WHERE id=$1 AND deleted_at IS NOT NULL RETURNING id",
      [id],
    )
  ).rows[0];
}
