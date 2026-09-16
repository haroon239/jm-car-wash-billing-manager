import { jsPDF } from "jspdf";
import type { CompanySettings } from "../types/domain";

export type ReceiptData = {
  customerName: string;
  phone: string;
  paymentGroup: string;
  amount: number;
  balance: number;
  method: string;
  paidAt: string;
  allocations: {
    invoiceNumber: string;
    amount: number;
    balance: number;
    billingPeriodStart?: string;
  }[];
};

export const receiptNumber = (group: string) =>
  `PAY-${group.slice(0, 13).replaceAll("-", "").toUpperCase()}`;

export function createReceiptPdf(receipt: ReceiptData, company: CompanySettings) {
  const pdf = new jsPDF();
  const money = (value: number) => `AED ${value.toFixed(2)}`;
  const text = (value: string | string[], x: number, y: number, size = 10, bold = false) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(size);
    pdf.setTextColor(24, 48, 61);
    pdf.text(value, x, y);
  };
  const heading = () => {
    pdf.setFillColor(8, 128, 123);
    pdf.roundedRect(15, 16, 17, 17, 4, 4, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(12);
    pdf.setFont("helvetica", "bold");
    pdf.text("JM", 20, 27);
    text(pdf.splitTextToSize(company.companyName, 155), 37, 21, 11, true);
    text(
      pdf.splitTextToSize(
        [company.address, `${company.phone} | ${company.email}`].filter(Boolean).join("\n"),
        155,
      ),
      37,
      34,
      8,
    );
    text("PAYMENT RECEIPT", 15, 54, 18, true);
    text(receiptNumber(receipt.paymentGroup), 15, 62, 9);
    pdf.setDrawColor(8, 128, 123);
    pdf.line(15, 68, 195, 68);
  };
  heading();
  text("RECEIVED FROM", 15, 79, 8, true);
  const nameLines = pdf.splitTextToSize(receipt.customerName, 90);
  text(nameLines, 15, 87, 12, true);
  text(receipt.phone, 15, 87 + nameLines.length * 6, 9);
  text("PAYMENT DETAILS", 120, 79, 8, true);
  text(
    new Date(receipt.paidAt).toLocaleString("en-GB", { timeZone: "Asia/Dubai" }) + " (UAE)",
    120,
    87,
    9,
  );
  text(`Method: ${receipt.method === "cash" ? "Cash" : "Online"}`, 120, 94, 10);
  let y = Math.max(108, 100 + nameLines.length * 6);
  const tableHead = () => {
    pdf.setFillColor(237, 247, 246);
    pdf.rect(15, y, 180, 10, "F");
    text("BILLING START", 18, y + 6, 8, true);
    text("BILL", 58, y + 6, 8, true);
    text("RECEIVED", 126, y + 6, 8, true);
    text("BALANCE", 165, y + 6, 8, true);
    y += 10;
  };
  tableHead();
  for (const allocation of receipt.allocations) {
    if (y > 242) {
      pdf.addPage();
      heading();
      y = 78;
      tableHead();
    }
    const date = allocation.billingPeriodStart?.slice(0, 10);
    text(
      date
        ? new Date(date + "T00:00:00Z").toLocaleDateString("en-GB", {
            timeZone: "UTC",
            day: "2-digit",
            month: "short",
            year: "numeric",
          })
        : "-",
      18,
      y + 9,
      9,
    );
    text(allocation.invoiceNumber, 58, y + 9, 9);
    text(money(allocation.amount), 126, y + 9, 9);
    text(money(allocation.balance), 165, y + 9, 9);
    y += 16;
    pdf.setDrawColor(224, 233, 237);
    pdf.line(15, y, 195, y);
  }
  if (y > 205) {
    pdf.addPage();
    heading();
    y = 78;
  }
  y += 12;
  pdf.setFillColor(8, 128, 123);
  pdf.roundedRect(15, y, 180, 22, 3, 3, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.text("TOTAL RECEIVED", 21, y + 14);
  pdf.text(money(receipt.amount), 189, y + 14, { align: "right" });
  y += 34;
  text(`Balance remaining: ${money(receipt.balance)}`, 15, y, 12, true);
  text("For the bills listed above. Other bills, if any, are not included.", 15, y + 8, 9);
  text("Thank you for your payment.", 15, y + 23, 11, true);
  for (let page = 1; page <= pdf.getNumberOfPages(); page++) {
    pdf.setPage(page);
    text(
      `JM Car Wash | Payment confirmation | Page ${page} of ${pdf.getNumberOfPages()}`,
      15,
      285,
      8,
    );
  }
  return pdf;
}
