import { AlertTriangle } from 'lucide-react';

export default function ActionDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger = false,
  reason,
  reasonLabel = 'Motivo',
  reasonPlaceholder = 'Describe el motivo',
  onReasonChange,
  onCancel,
  onConfirm,
}) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal-panel action-dialog" role="dialog" aria-modal="true" aria-labelledby="action-dialog-title">
        <div className={danger ? 'dialog-icon danger' : 'dialog-icon'}>
          <AlertTriangle size={22} />
        </div>
        <div>
          <h2 id="action-dialog-title">{title}</h2>
          {message ? <p>{message}</p> : null}
        </div>
        {onReasonChange ? (
          <label className="dialog-reason">
            {reasonLabel}
            <textarea value={reason} onChange={(event) => onReasonChange(event.target.value)} placeholder={reasonPlaceholder} rows={4} autoFocus />
          </label>
        ) : null}
        <div className="form-actions">
          <button className="outline-button" type="button" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button className={danger ? 'primary-button compact danger-button' : 'primary-button compact'} type="button" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
