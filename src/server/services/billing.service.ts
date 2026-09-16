import {
  createInvoice,
  advanceCustomerBilling,
  findCustomerBillingSchedule,
  findCustomersDueForInvoice,
  markPastDueInvoicesOverdue,
} from "../models/invoice.model";
import { findContractsEndingToday, stopCustomerContract } from "../models/contract.model";

const DUBAI_OFFSET_MS = 4 * 60 * 60 * 1000;
const RUN_MINUTE_AFTER_MIDNIGHT = 5;
const MAX_CATCH_UP_CYCLES = 120;

export const billingMaintenanceStatus: {
  running: boolean;
  lastStartedAt: string | null;
  lastCompletedAt: string | null;
  lastGeneratedCount: number;
  lastOverdueCount: number;
  lastError: string | null;
} = {
  running: false,
  lastStartedAt: null,
  lastCompletedAt: null,
  lastGeneratedCount: 0,
  lastOverdueCount: 0,
  lastError: null,
};

export async function runBillingMaintenance() {
  if (billingMaintenanceStatus.running) return;
  billingMaintenanceStatus.running = true;
  billingMaintenanceStatus.lastStartedAt = new Date().toISOString();
  let generatedCount = 0;
  try {
    for (let cycle = 0; cycle < MAX_CATCH_UP_CYCLES; cycle += 1) {
      const customers = await findCustomersDueForInvoice();
      if (!customers.length) break;

      for (const customer of customers) {
        const invoice = await createInvoice(Number(customer.id), {
          issueDate: customer.invoiceDate,
          billingPeriod: customer.invoiceDate,
          source: "automatic",
        });
        if (!invoice.wasExisting) generatedCount += 1;
        await advanceCustomerBilling(Number(customer.id), customer.billingType);
      }
    }

    for (const customer of await findContractsEndingToday()) {
      try {
        const endDate =
          customer.contractEndDate instanceof Date
            ? customer.contractEndDate.toISOString().slice(0, 10)
            : String(customer.contractEndDate).slice(0, 10);
        await stopCustomerContract(Number(customer.id), endDate, "Scheduled contract end reached.");
      } catch (error) {
        console.error(`Unable to finalize scheduled contract ${customer.id}`, error);
      }
    }

    const overdueCount = await markPastDueInvoicesOverdue();
    billingMaintenanceStatus.lastCompletedAt = new Date().toISOString();
    billingMaintenanceStatus.lastGeneratedCount = generatedCount;
    billingMaintenanceStatus.lastOverdueCount = overdueCount ?? 0;
    billingMaintenanceStatus.lastError = null;
    console.log(
      `Billing maintenance completed: ${generatedCount} invoice(s) generated, ${overdueCount ?? 0} marked overdue.`,
    );
  } catch (error) {
    billingMaintenanceStatus.lastError = error instanceof Error ? error.message : "Unknown error";
    throw error;
  } finally {
    billingMaintenanceStatus.running = false;
  }
}

export async function createNextCustomerInvoice(customerId: number) {
  const schedule = await findCustomerBillingSchedule(customerId);
  if (!schedule) throw Object.assign(new Error("Active customer not found"), { status: 404 });
  const dubaiToday = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" });
  const contractEnd = schedule.contractEndDate
    ? schedule.contractEndDate instanceof Date
      ? schedule.contractEndDate.toISOString().slice(0, 10)
      : String(schedule.contractEndDate).slice(0, 10)
    : null;
  if (contractEnd && contractEnd <= dubaiToday)
    throw Object.assign(
      new Error("This contract has ended. Its final bill is handled automatically."),
      {
        status: 409,
      },
    );

  if (
    (schedule.billingType !== "monthly" && schedule.billingType !== "weekly") ||
    !schedule.invoiceDate
  ) {
    return createInvoice(customerId);
  }

  const invoice = await createInvoice(customerId, {
    issueDate: schedule.invoiceDate,
    billingPeriod: schedule.invoiceDate,
    source: "manual",
  });
  await advanceCustomerBilling(customerId, schedule.billingType);
  return invoice;
}

function millisecondsUntilNextDubaiRun() {
  const now = Date.now();
  const dubaiNow = new Date(now + DUBAI_OFFSET_MS);
  const nextRunUtc =
    Date.UTC(
      dubaiNow.getUTCFullYear(),
      dubaiNow.getUTCMonth(),
      dubaiNow.getUTCDate() + 1,
      0,
      RUN_MINUTE_AFTER_MIDNIGHT,
    ) - DUBAI_OFFSET_MS;
  return Math.max(nextRunUtc - now, 1_000);
}

export function startBillingScheduler() {
  const scheduleNextRun = () => {
    const timer = setTimeout(async () => {
      try {
        await runBillingMaintenance();
      } catch (error) {
        console.error("Scheduled billing maintenance failed", error);
      } finally {
        scheduleNextRun();
      }
    }, millisecondsUntilNextDubaiRun());
    timer.unref();
  };

  void runBillingMaintenance().catch((error) =>
    console.error("Startup billing maintenance failed", error),
  );
  scheduleNextRun();
}
