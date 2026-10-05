import { X } from "lucide-react";

export default function Modal({ title, children, onClose, closeDisabled = false }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <section className="modal">
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="icon-button" type="button" onClick={onClose} disabled={closeDisabled} title="Close"><X size={18} /></button>
        </div>
        {children}
      </section>
    </div>
  );
}
