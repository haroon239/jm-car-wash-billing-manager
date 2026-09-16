import type { Metadata } from "next";
import "../styles.css";

export const metadata: Metadata = {
  title: "JM Car Wash — Billing Manager",
  description: "Customer, subscription, bill and payment management for JM Car Wash.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
