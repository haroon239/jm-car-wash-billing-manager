import { useEffect, useState } from "react";
import type { Invoice } from "../../types/domain";
import { canSendPaymentReminder } from "../../utils/reminderEligibility";

export const paymentReminderMessage =
  "Dear Valued Customer\nThis is friendly reminder that Your Car wash payment  is now due . kindly arrange the payment at your earliest convenience Thank you";

export function PaymentReminder({
  invoice,
  phone,
  onChange,
}: {
  invoice: Invoice;
  phone?: string;
  onChange?: (invoiceId: number, sentAt: string | null) => void;
}) {
  const [sentAt, setSentAt] = useState(invoice.reminderSentAt ?? null);
  const [opened, setOpened] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => setSentAt(invoice.reminderSentAt ?? null), [invoice.reminderSentAt]);
  if (!canSendPaymentReminder(invoice)) return null;
  const number = (phone ?? invoice.phone ?? "").replace(/\D/g, "");
  async function mark(sent: boolean) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/invoices/${invoice.id}/reminder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sent }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Unable to save reminder status.");
      setSentAt(result.reminderSentAt);
      onChange?.(invoice.id, result.reminderSentAt);
      setOpened(false);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="payment-reminder-actions">
      <button
        type="button"
        className="reminder-button"
        disabled={!number || busy}
        onClick={() => {
          window.open(
            `https://wa.me/${number}?text=${encodeURIComponent(paymentReminderMessage)}`,
            "_blank",
            "noopener,noreferrer",
          );
          setOpened(true);
        }}
      >
        {sentAt ? "Send reminder again" : "Send reminder"}
      </button>
      {opened && (
        <>
          <small>After sending in WhatsApp, confirm here:</small>
          <button
            type="button"
            className="paid-button"
            disabled={busy}
            onClick={() => void mark(true)}
          >
            Mark reminder as sent
          </button>
        </>
      )}
      {sentAt && (
        <>
          <small>
            ✓ Reminder sent · {new Date(sentAt).toLocaleString("en-GB", { timeZone: "Asia/Dubai" })}{" "}
            (UAE)
          </small>
          <button
            type="button"
            className="edit-button"
            disabled={busy}
            onClick={() => void mark(false)}
          >
            Mark reminder as unsent
          </button>
        </>
      )}
      {error && <small role="alert">{error}</small>}
    </div>
  );
}
