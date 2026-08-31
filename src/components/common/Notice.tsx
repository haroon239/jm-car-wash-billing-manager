export type NoticeKind = "success" | "error";

export function Notice({
  message,
  kind,
  onClose,
}: {
  message: string;
  kind: NoticeKind;
  onClose: () => void;
}) {
  return message ? (
    <div className={`notice ${kind}`} role={kind === "error" ? "alert" : "status"}>
      <span>{kind === "error" ? "!" : "✓"}</span>
      {message}
      <button type="button" aria-label="Dismiss notification" onClick={onClose}>
        ×
      </button>
    </div>
  ) : null;
}
