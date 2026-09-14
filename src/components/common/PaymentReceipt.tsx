import { useState } from "react";
import type { CompanySettings } from "../../types/domain";
import { receiptNumber, type ReceiptData } from "../../utils/receiptPdf";

export function PaymentReceipt({
  receipt,
  company,
  onClose,
}: {
  receipt: ReceiptData;
  company: CompanySettings;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [prepared, setPrepared] = useState(false);
  const number = receiptNumber(receipt.paymentGroup);
  const phone = receipt.phone.replace(/\D/g, "");
  const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(`Dear ${receipt.customerName}, we have received your car wash payment of AED ${receipt.amount.toFixed(2)}. Balance remaining for the bills listed on receipt ${number}: AED ${receipt.balance.toFixed(2)}. Thank you. ${company.companyName}`)}`;
  async function download(share: boolean) {
    if (share && !phone) {
      setError("Please add the customer's WhatsApp number first.");
      return;
    }
    // Open during the click gesture, before PDF preparation, to avoid popup blocking.
    const chat = share ? window.open(whatsappUrl, "_blank") : null;
    if (chat) chat.opener = null;
    setBusy(true);
    setError("");
    try {
      const { createReceiptPdf } = await import("../../utils/receiptPdf");
      const pdf = createReceiptPdf(receipt, company);
      const fileName = `${receipt.customerName.replace(/[<>:"/\\|?*]/g, "-")} - JM Car Wash - ${number}.pdf`;
      pdf.save(fileName);
      if (share) {
        setPrepared(true);
        if (!chat) setError("Your browser blocked WhatsApp. Use Open customer chat below.");
      }
    } catch (failure) {
      if (!(failure instanceof Error && failure.name === "AbortError"))
        setError("Unable to prepare receipt. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="customer-modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <span className="ready">PAYMENT RECEIVED</span>
            <h2>Payment receipt</h2>
            <p>
              {receipt.customerName} · {number}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close receipt">
            ×
          </button>
        </div>
        <div className="customer-form receipt-form">
          <p>
            <strong>AED {receipt.amount.toFixed(2)} received</strong> via{" "}
            {receipt.method === "cash" ? "Cash" : "Online"}.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Bill</th>
                  <th>Received</th>
                  <th>Remaining</th>
                </tr>
              </thead>
              <tbody>
                {receipt.allocations.map((allocation) => (
                  <tr key={allocation.invoiceNumber}>
                    <td>{allocation.invoiceNumber}</td>
                    <td>AED {allocation.amount.toFixed(2)}</td>
                    <td>AED {allocation.balance.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Balance remaining for the bills listed above:{" "}
            <strong>AED {receipt.balance.toFixed(2)}</strong>
          </p>
          <small>
            Share on WhatsApp downloads the receipt and opens {receipt.customerName}'s chat. In
            WhatsApp, choose Attach → Document, select the downloaded receipt, then send.
          </small>
          {prepared && (
            <p role="status">
              Receipt downloaded. Attach it in the customer's WhatsApp chat to finish sending.
            </p>
          )}
          {error && <p role="alert">{error}</p>}
          <div className="form-actions">
            <button className="secondary" disabled={busy} onClick={() => void download(false)}>
              Download receipt
            </button>
            <button
              className="whatsapp"
              disabled={busy || !phone}
              onClick={() => void download(true)}
            >
              {busy ? "Preparing receipt…" : "Share on WhatsApp"}
            </button>
            <button
              className="whatsapp"
              disabled={!phone || busy}
              onClick={() => window.open(whatsappUrl, "_blank", "noopener,noreferrer")}
            >
              Open customer chat
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
