import { useState } from "react";

type Receipt = {
  customerName: string;
  phone: string;
  paymentGroup: string;
  amount: number;
  balance: number;
  method: string;
  paidAt: string;
  allocations: { invoiceNumber: string; amount: number; balance: number }[];
};

export function PaymentReceipt({ receipt, onClose }: { receipt: Receipt; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const number = `PAY-${receipt.paymentGroup.slice(0, 13).replaceAll("-", "").toUpperCase()}`;
  async function download(share: boolean) {
    setBusy(true);
    setError("");
    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF();
      pdf.setFontSize(18);
      pdf.text("JM CAR WASH - PAYMENT RECEIPT", 15, 22);
      pdf.setFontSize(11);
      pdf.text(
        [
          `Receipt: ${number}`,
          `Customer: ${receipt.customerName}`,
          `Received: ${new Date(receipt.paidAt).toLocaleString("en-GB", { timeZone: "Asia/Dubai" })} (UAE)`,
          `Payment method: ${receipt.method === "cash" ? "Cash" : "Online"}`,
          "",
          "Payment applied to:",
          ...receipt.allocations.map(
            (allocation) =>
              `${allocation.invoiceNumber}: AED ${allocation.amount.toFixed(2)} received; balance AED ${allocation.balance.toFixed(2)}`,
          ),
          "",
          `Total received: AED ${receipt.amount.toFixed(2)}`,
          `Remaining balance through this bill: AED ${receipt.balance.toFixed(2)}`,
          "Thank you for your payment.",
        ],
        15,
        35,
        { maxWidth: 180 },
      );
      const fileName = `${receipt.customerName.replace(/[<>:"/\\|?*]/g, "-")} - JM Car Wash - ${number}.pdf`;
      const file = new File([pdf.output("blob")], fileName, { type: "application/pdf" });
      if (share && navigator.canShare?.({ files: [file] }))
        await navigator.share({ files: [file], title: number });
      else pdf.save(fileName);
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
        <div className="customer-form">
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
            Remaining balance through this bill: <strong>AED {receipt.balance.toFixed(2)}</strong>
          </p>
          <small>
            Older unpaid bills are settled first. On devices without file sharing, the PDF downloads
            for manual attachment in WhatsApp.
          </small>
          {error && <p role="alert">{error}</p>}
          <div className="form-actions">
            <button className="secondary" disabled={busy} onClick={() => void download(false)}>
              Download receipt
            </button>
            <button className="primary" disabled={busy} onClick={() => void download(true)}>
              Share receipt PDF
            </button>
            <button
              className="whatsapp"
              disabled={!receipt.phone}
              onClick={() =>
                window.open(
                  `https://wa.me/${receipt.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Dear ${receipt.customerName}, we have received your car wash payment of AED ${receipt.amount.toFixed(2)}. Remaining balance: AED ${receipt.balance.toFixed(2)}. Thank you. JM Car Wash`)}`,
                  "_blank",
                  "noopener,noreferrer",
                )
              }
            >
              Open WhatsApp
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
