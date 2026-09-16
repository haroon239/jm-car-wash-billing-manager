import { requireDatabase } from "../config/database";

export async function findLocations() {
  return (
    await requireDatabase().query(`
      SELECT prop.id AS "propertyId",prop.name AS "propertyName",
        a.id AS "areaId",a.name AS "areaName",
        b.id AS "buildingId",b.name AS "buildingName",
        COUNT(DISTINCT c.id) FILTER (
          WHERE c.deleted_at IS NULL AND c.status='active'
            AND c.plan_start_date <= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dubai')::DATE
            AND (c.contract_end_date IS NULL OR c.contract_end_date > (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dubai')::DATE)
        )::INTEGER AS "activeCustomers",
        COALESCE(SUM(
          CASE
            WHEN c.deleted_at IS NULL AND c.status='active' AND c.billing_type='monthly'
              AND c.plan_start_date <= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dubai')::DATE
              AND (c.contract_end_date IS NULL OR c.contract_end_date > (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dubai')::DATE)
              THEN c.agreed_price
            WHEN c.deleted_at IS NULL AND c.status='active' AND c.billing_type='weekly'
              AND c.plan_start_date <= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dubai')::DATE
              AND (c.contract_end_date IS NULL OR c.contract_end_date > (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dubai')::DATE)
              THEN c.agreed_price * 52.0 / 12.0
            ELSE 0
          END
        ),0) AS "expectedRevenue",
        COALESCE(invoice_totals.invoiced,0) AS invoiced,
        COALESCE(invoice_totals.collected,0) AS collected,
        COALESCE(invoice_totals.outstanding,0) AS outstanding,
        COALESCE(invoice_totals.overdue,0) AS overdue
      FROM properties prop
      JOIN areas a ON a.property_id=prop.id AND a.is_active=TRUE
      JOIN buildings b ON b.area_id=a.id AND b.is_active=TRUE
      LEFT JOIN customers c ON c.building_id=b.id
      LEFT JOIN LATERAL (
        SELECT
          SUM(i.total) AS invoiced,
          SUM(COALESCE(pay.paid,0)) AS collected,
          SUM(GREATEST(i.total-COALESCE(pay.paid,0),0)) AS outstanding,
          SUM(
            CASE WHEN i.status IN ('overdue','partially_overdue')
              THEN GREATEST(i.total-COALESCE(pay.paid,0),0) ELSE 0 END
          ) AS overdue
        FROM invoices i
        JOIN customers ic ON ic.id=i.customer_id
        LEFT JOIN LATERAL (
          SELECT SUM(p.amount) AS paid FROM payments p WHERE p.invoice_id=i.id
        ) pay ON TRUE
        WHERE ic.building_id=b.id
          AND i.due_date <= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dubai')::DATE
      ) invoice_totals ON TRUE
      GROUP BY prop.id,prop.name,a.id,a.name,b.id,b.name,
        invoice_totals.invoiced,invoice_totals.collected,
        invoice_totals.outstanding,invoice_totals.overdue
      ORDER BY prop.name,a.name,b.name
    `)
  ).rows;
}

export async function createArea(propertyId: number, name: string) {
  return (
    await requireDatabase().query(
      `INSERT INTO areas(property_id,name) VALUES($1,$2)
       ON CONFLICT(property_id,name) DO UPDATE SET is_active=TRUE
       RETURNING id,property_id AS "propertyId",name`,
      [propertyId, name],
    )
  ).rows[0];
}

export async function createBuilding(areaId: number, name: string) {
  return (
    await requireDatabase().query(
      `INSERT INTO buildings(area_id,name) VALUES($1,$2)
       ON CONFLICT(area_id,name) DO UPDATE SET is_active=TRUE
       RETURNING id,area_id AS "areaId",name`,
      [areaId, name],
    )
  ).rows[0];
}

export async function updateBuilding(id: number, areaId: number, name: string) {
  return (
    await requireDatabase().query(
      `UPDATE buildings
       SET area_id=$2,name=$3
       WHERE id=$1 AND is_active=TRUE
       RETURNING id,area_id AS "areaId",name`,
      [id, areaId, name],
    )
  ).rows[0];
}

export async function archiveBuilding(id: number) {
  const customerCount = Number(
    (
      await requireDatabase().query(
        `SELECT COUNT(*) AS count FROM customers
         WHERE building_id=$1 AND deleted_at IS NULL`,
        [id],
      )
    ).rows[0].count,
  );
  if (customerCount > 0) {
    const error = new Error(
      `Move or archive the ${customerCount} active customer${customerCount === 1 ? "" : "s"} before archiving this building.`,
    ) as Error & { status: number };
    error.status = 409;
    throw error;
  }
  return (
    await requireDatabase().query(
      `UPDATE buildings SET is_active=FALSE
       WHERE id=$1 AND is_active=TRUE RETURNING id`,
      [id],
    )
  ).rows[0];
}
