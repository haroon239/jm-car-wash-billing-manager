import { useState } from "react";
import type { CompanySettings } from "../types/domain";
type Props = {
  settings: CompanySettings;
  isSaving: boolean;
  onChange: (value: CompanySettings) => void;
  onSave: () => void;
};
export function SettingsPage({ settings, isSaving, onChange, onSave }: Props) {
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupMessage, setBackupMessage] = useState("");
  const [backupPassword, setBackupPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [showAccountPasswords, setShowAccountPasswords] = useState(false);
  const [showBackupPassword, setShowBackupPassword] = useState(false);
  const field = (key: Exclude<keyof CompanySettings, "vatRate">, value: string) =>
    onChange({ ...settings, [key]: value });
  async function downloadBackup() {
    setIsBackingUp(true);
    setBackupMessage("");
    try {
      const response = await fetch("/api/backup", {
        method: "POST",
        cache: "no-store",
        headers: { "x-backup-secret": backupPassword },
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.message ?? "Unable to create backup");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const fileName =
        disposition.match(/filename="([^"]+)"/)?.[1] ??
        `JM-Car-Wash-Backup-${new Date().toISOString().slice(0, 10)}.json`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
      setBackupMessage("Complete backup downloaded. Keep this file in a safe folder.");
    } catch (error) {
      setBackupMessage(error instanceof Error ? error.message : "Unable to create backup.");
    } finally {
      setIsBackingUp(false);
    }
  }
  async function submitPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordMessage("");
    if (newPassword !== confirmPassword) {
      setPasswordMessage("New passwords do not match.");
      return;
    }
    setChangingPassword(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message ?? "Could not change password.");
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      window.location.assign("/login");
    } catch (error) {
      setPasswordMessage(error instanceof Error ? error.message : "Could not change password.");
    } finally {
      setChangingPassword(false);
    }
  }
  return (
    <>
      <section className="panel section-panel settings-card">
        <div className="panel-head">
          <div>
            <h2>Company information</h2>
            <p>This information appears on every generated bill.</p>
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
            <span>Bill number prefix</span>
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
      <section className="panel section-panel password-card">
        <div>
          <h2>Change password</h2>
          <p>Changing your password signs out all devices. Sign in again with the new password.</p>
        </div>
        <form onSubmit={(event) => void submitPassword(event)}>
          <label>
            Current password
            <input
              type={showAccountPasswords ? "text" : "password"}
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </label>
          <label>
            New password
            <input
              type={showAccountPasswords ? "text" : "password"}
              autoComplete="new-password"
              minLength={14}
              required
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </label>
          <label>
            Confirm new password
            <input
              type={showAccountPasswords ? "text" : "password"}
              autoComplete="new-password"
              minLength={14}
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </label>
          <label className="show-password-control">
            <input
              type="checkbox"
              checked={showAccountPasswords}
              onChange={(event) => setShowAccountPasswords(event.target.checked)}
            />
            Show passwords
          </label>
          {passwordMessage && (
            <p role="alert" className="password-error">
              {passwordMessage}
            </p>
          )}
          <button className="primary" type="submit" disabled={changingPassword}>
            {changingPassword ? "Changing…" : "Change password"}
          </button>
        </form>
      </section>
      <section className="panel section-panel backup-card">
        <div>
          <h2>Computer backup</h2>
          <p>
            Download a complete dated copy of customers, contracts, bills, payments, washes,
            locations, plans and company settings.
          </p>
          <small>This file contains private customer data. Store it in a protected folder.</small>
        </div>
        <input
          type={showBackupPassword ? "text" : "password"}
          value={backupPassword}
          onChange={(event) => setBackupPassword(event.target.value)}
          placeholder="Backup password"
          autoComplete="off"
          aria-label="Backup password"
        />
        <label className="show-password-control backup-show-password">
          <input
            type="checkbox"
            checked={showBackupPassword}
            onChange={(event) => setShowBackupPassword(event.target.checked)}
          />
          Show password
        </label>
        <button
          className="primary"
          disabled={isBackingUp || !backupPassword}
          onClick={() => void downloadBackup()}
        >
          {isBackingUp ? "Preparing backup…" : "Download full backup"}
        </button>
        {backupMessage && <p className="backup-message">{backupMessage}</p>}
      </section>
    </>
  );
}
