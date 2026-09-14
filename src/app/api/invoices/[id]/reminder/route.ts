import { z } from "zod";
import { route } from "@/server/http";
import { requireDatabase } from "@/server/config/database";
import { idSchema } from "@/server/validators/customer.schema";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const id = idSchema.parse((await context.params).id);
    const { sent } = z.object({ sent: z.boolean() }).parse(await request.json());
    const client = await requireDatabase().connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        `UPDATE invoices SET reminder_sent_at=CASE WHEN $2 THEN NOW() ELSE NULL END
         WHERE id=$1 AND (NOT $2 OR (due_date <= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Dubai')::DATE AND total > COALESCE((SELECT SUM(amount) FROM payments WHERE invoice_id=invoices.id),0)))
         RETURNING customer_id,reminder_sent_at AS "reminderSentAt"`,
        [id, sent],
      );
      if (!result.rowCount)
        throw Object.assign(
          new Error("Only unpaid bills due today or earlier can be marked reminder sent."),
          {
            status: 409,
          },
        );
      await client.query(
        `INSERT INTO customer_activities(customer_id,activity_type,title,details)
         VALUES($1,'payment_reminder',$2,$3)`,
        [
          result.rows[0].customer_id,
          sent ? "Payment reminder marked sent" : "Payment reminder marked unsent",
          `Invoice ID ${id}. Manually confirmed by owner.`,
        ],
      );
      await client.query("COMMIT");
      return { reminderSentAt: result.rows[0].reminderSentAt };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });
}
