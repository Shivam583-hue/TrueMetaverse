import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import {
  button,
  cx,
  errorClass,
  modalActionsClass,
  modalBackdropClass,
  modalPanelClass,
} from "../lib/ui";

export default function ConfirmDialog({
  title,
  children,
  confirmLabel,
  busyLabel,
  cancelLabel = "Cancel",
  danger = false,
  busy = false,
  error,
  onConfirm,
  onCancel,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  busyLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (danger) cancelRef.current?.focus();
    else confirmRef.current?.focus();
  }, [danger]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  return (
    <div
      className={modalBackdropClass}
      onClick={() => !busy && onCancel()}
      role="presentation"
    >
      <div
        className={cx(
          modalPanelClass,
          "max-w-[420px] border-alert/25",
          danger && "border-alert/40",
        )}
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
      >
        <div className="mb-4 flex items-center gap-3">
          <span
            className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full border border-alert/35 bg-alert/10 font-pixel text-xs text-alert"
            aria-hidden="true"
          >
            {danger ? "!" : "?"}
          </span>
          <h2 id="confirm-title" className="font-pixel text-[0.95rem]">
            {title}
          </h2>
        </div>

        <div className="[&_p]:m-0 [&_p]:text-sm [&_p]:leading-6 [&_p]:text-fog">
          {children}
        </div>

        {error && (
          <p className={errorClass} role="alert">
            {error}
          </p>
        )}

        <div className={modalActionsClass}>
          <button
            ref={cancelRef}
            type="button"
            className={button.ghost}
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={danger ? button.dangerSolid : button.primary}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? (busyLabel ?? confirmLabel) : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
