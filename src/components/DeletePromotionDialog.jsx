import { useRef, useState } from "react";
import Modal from "./Modal.jsx";

export default function DeletePromotionDialog({ promotion, onDelete, onClose }) {
  const deleting = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function confirmDelete() {
    if (deleting.current) return;
    deleting.current = true;
    setPending(true);
    setError("");
    try {
      await onDelete(promotion._id);
    } catch (failure) {
      const message = typeof failure?.data === "string" ? failure.data : failure?.data?.message;
      setError(message || failure?.message || "Promotion could not be deleted. Please try again.");
    } finally {
      deleting.current = false;
      setPending(false);
    }
  }

  return (
    <Modal title="Delete Promotion" onClose={() => !deleting.current && onClose()} closeDisabled={pending}>
      <div className="delete-confirm">
        <p>Delete <strong>{promotion.name || promotion.headline}</strong>?</p>
        <p>This cannot be undone. The offer will be removed from the storefront. Existing orders keep their discounts.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="delete-confirm-actions">
          <button className="promotion-action" type="button" disabled={pending} onClick={onClose}>Cancel</button>
          <button className="primary-button danger-action" type="button" disabled={pending} onClick={confirmDelete}>
            {pending ? "Deleting…" : "Delete Promotion"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
