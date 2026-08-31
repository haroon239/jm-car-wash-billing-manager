import type { CompanySettings } from "../types/domain";
type Props = {
  settings: CompanySettings;
  isSaving: boolean;
  onChange: (value: CompanySettings) => void;
  onSave: () => void;
};
export function SettingsPage({ settings, isSaving, onChange, onSave }: Props) {
  const field = (key: Exclude<keyof CompanySettings, "vatRate">, value: string) =>
    onChange({ ...settings, [key]: value });
  return (
    <section className="panel section-panel settings-card">
      <div className="panel-head">
        <div>
          <h2>Company information</h2>
          <p>This information appears on every generated invoice.</p>
        </div>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave();
        }}
      >
        <label>
          <span>Company name</span>
          <input
            required
            value={settings.companyName}
            onChange={(e) => field("companyName", e.target.value)}
          />
        </label>
        <label>
          <span>Tax Registration Number (TRN)</span>
          <input
            value={settings.trn}
            onChange={(e) => field("trn", e.target.value)}
            placeholder="15-digit UAE TRN"
          />
        </label>
        <label>
          <span>Company mobile</span>
          <input
            required
            value={settings.phone}
            onChange={(e) => field("phone", e.target.value)}
            placeholder="+971 52 8843059"
          />
        </label>
        <label>
          <span>Company emails</span>
          <input
            required
            type="email"
            value={settings.email}
            onChange={(e) => field("email", e.target.value)}
            placeholder="jmcarwashandcleaning@gmail.com"
          />
        </label>
        <label>
          <span>Business address</span>
          <input
            required
            value={settings.address}
            onChange={(e) => field("address", e.target.value)}
          />
        </label>
        <label>
          <span>Invoice prefix</span>
          <input
            required
            value={settings.invoicePrefix}
            onChange={(e) => field("invoicePrefix", e.target.value.toUpperCase())}
          />
        </label>
        <button type="submit" className="primary" disabled={isSaving}>
          {isSaving ? "Saving…" : "Save settings"}
        </button>
      </form>
    </section>
  );
}
