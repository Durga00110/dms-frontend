
import { useEffect } from "react";

interface ErrorSnackbarProps {
  message: string;
  show: boolean;
  onClose: () => void;
}

export default function ErrorSnackbar({
  message,
  show,
  onClose,
}: ErrorSnackbarProps) {
  useEffect(() => {
    if (!show) return;

    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [show, onClose]);

  if (!show) return null;

  return (
    <div
      className="toast show text-bg-danger border-0 position-fixed top-0 end-0 m-3"
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      style={{ zIndex: 9999, minWidth: "300px" }}
    >
      <div className="d-flex">
        <div className="toast-body">
          <strong>Error:</strong> {message}
        </div>

        <button
          type="button"
          className="btn-close btn-close-white me-2 m-auto"
          aria-label="Close"
          onClick={onClose}
        />
      </div>
    </div>
  );
}
