import { useEffect, useMemo, useState } from "react";
import type { Invoice } from "../types/domain";
import { formatInvoiceStatus } from "../utils/display";
export function InvoicesPage({
  refreshKey,
  areaId,
  buildingId,
  onView,
  onPaid,
  onEdit,
}: {
  refreshKey: string;
  areaId: number | null;
  buildingId: number | null;
  onView: (i: Invoice) => void;
  onPaid: (i: Invoice) => void;
  onEdit: (i: Invoice) => void;
}) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => setPage(1), [areaId, buildingId, pageSize, status]);

  useEffect(() => {
    const controller = new AbortController();
    const parameters = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (search) parameters.set("search", search);
    if (status) parameters.set("status", status);
    if (areaId !== null) parameters.set("areaId", String(areaId));
    if (buildingId !== null) parameters.set("buildingId", String(buildingId));
    setLoading(true);
    fetch(`/api/invoices/paged?${parameters}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load invoices");
        return response.json();
      })
      .then((result) => {
        setInvoices(
          result.items.map((invoice: Invoice) => ({
            ...invoice,
            id: Number(invoice.id),
            customerId: Number(invoice.customerId),
            total: Number(invoice.total),
            paidAmount: Number(invoice.paidAmount),
            balance: Number(invoice.balance),
            revisionNumber: Number(invoice.revisionNumber),
          })),
        );
        setTotal(Number(result.total));
        setTotalPages(Number(result.totalPages));
        if (Number(result.page) !== page) setPage(Number(result.page));
      })
      .catch((error) => {
        if (error instanceof Error && error.name !== "AbortError") setInvoices([]);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [areaId, buildingId, page, pageSize, refreshKey, search, status]);

  const pageNumbers = useMemo(() => {
    const start = Math.max(1, Math.min(page - 2, totalPages - 4));
    return Array.from({ length: Math.min(5, totalPages) }, (_, index) => start + index);
  }, [page, totalPages]);
  const firstItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastItem = Math.min(page * pageSize, total);

  return (
    <section className="panel section-panel">
      <div className="panel-head">
        <div>
          <h2>Generated invoices</h2>
          <p>{total} invoices in the current location view</p>
        </div>
      </div>
      <div className="invoice-list-toolbar">
        <input
          type="search"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Search invoice, customer or plate"
          aria-label="Search invoices"
        />
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="sent">Sent</option>
          <option value="partially_paid">Partially paid</option>
          <option value="partially_overdue">Partially overdue</option>
          <option value="overdue">Overdue</option>
          <option value="paid">Paid</option>
        </select>
        <select
          value={pageSize}
          onChange={(event) => setPageSize(Number(event.target.value))}
          aria-label="Invoices per page"
        >
          <option value={20}>20 per page</option>
          <option value={50}>50 per page</option>
          <option value={100}>100 per page</option>
        </select>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Customer</th>
              <th>Due date</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {!loading &&
              invoices.map((i) => (
                <tr key={i.id}>
                  <td>
                    <strong>{i.invoiceNumber}</strong>
                    <small>{new Date(i.issueDate).toLocaleDateString("en-GB")}</small>
                    {i.revisionNumber > 0 && <small>Revision {i.revisionNumber}</small>}
                  </td>
                  <td>
                    {i.customerName}
                    <small>{i.plateNumber}</small>
                  </td>
                  <td>{new Date(i.dueDate).toLocaleDateString("en-GB")}</td>
                  <td>
                    <strong>AED {i.total.toFixed(2)}</strong>
                    {i.paidAmount > 0 && (
                      <small>
                        Paid {i.paidAmount.toFixed(2)} · Balance {i.balance.toFixed(2)}
                      </small>
                    )}
                  </td>
                  <td>
                    <i className={`status ${i.status}`}>{formatInvoiceStatus(i.status)}</i>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="send-button" onClick={() => onView(i)}>
                        View PDF
                      </button>
                      {i.status !== "paid" && (
                        <button className="edit-button" onClick={() => onEdit(i)}>
                          Edit
                        </button>
                      )}
                      {i.status !== "paid" && (
                        <button className="paid-button" onClick={() => onPaid(i)}>
                          Record payment
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {loading && <div className="empty-state">Loading invoices...</div>}
        {!loading && invoices.length === 0 && (
          <div className="empty-state">No invoices match the selected filters.</div>
        )}
      </div>
      {!loading && total > 0 && (
        <div className="pagination-bar">
          <p>
            Showing {firstItem}–{lastItem} of {total}
          </p>
          <div>
            <button disabled={page === 1} onClick={() => setPage((current) => current - 1)}>
              Previous
            </button>
            {pageNumbers.map((pageNumber) => (
              <button
                key={pageNumber}
                className={pageNumber === page ? "active" : ""}
                onClick={() => setPage(pageNumber)}
                aria-current={pageNumber === page ? "page" : undefined}
              >
                {pageNumber}
              </button>
            ))}
            <button
              disabled={page === totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
