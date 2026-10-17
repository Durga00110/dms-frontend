
import type { ChangeEvent } from "react";
import "./Pagination.css";

export type PaginationProps = {
  currentPage: number;
  total: number;
  pageSize: number;
  isPending: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
};

const Pagination = ({
  currentPage,
  total,
  pageSize,
  isPending,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const firstRecord =
    total === 0 ? 0 : (currentPage - 1) * pageSize + 1;

  const lastRecord = Math.min(currentPage * pageSize, total);

  // Display a compact range for large result sets.
  const getPages = (): (number | "...")[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, "...", totalPages];
    }

    if (currentPage >= totalPages - 3) {
      return [
        1,
        "...",
        totalPages - 4,
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
        totalPages,
      ];
    }

    return [
      1,
      "...",
      currentPage - 1,
      currentPage,
      currentPage + 1,
      "...",
      totalPages,
    ];
  };

  const handleSizeChange = (e: ChangeEvent<HTMLSelectElement>) => {
    onPageSizeChange(Number(e.target.value));
  };

  if (total === 0) return null;

  return (
    <nav className="srch-pagination" aria-label="Document pagination">
      <div className="srch-pagination-info" aria-live="polite">
        Showing <strong>{firstRecord}–{lastRecord}</strong> of{" "}
        <strong>{total}</strong> documents
      </div>

      <div className="srch-pagination-controls">
        <label htmlFor="srchPageSize">Rows per page</label>

        <select
          id="srchPageSize"
          className="srch-page-size"
          value={pageSize}
          onChange={handleSizeChange}
          disabled={isPending}
        >
          {[10, 25, 50, 100].map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>

        <button
          type="button"
          className="srch-page-btn"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1 || isPending}
        >
          Previous
        </button>

        {getPages().map((page, index) =>
          page === "..." ? (
            <span
              key={`ellipsis-${index}`}
              className="srch-page-ellipsis"
              aria-hidden="true"
            >
              …
            </span>
          ) : (
            <button
              key={page}
              type="button"
              className={`srch-page-btn ${
                currentPage === page ? "active" : ""
              }`}
              aria-label={`Page ${page}`}
              aria-current={currentPage === page ? "page" : undefined}
              disabled={isPending}
              onClick={() => onPageChange(page)}
            >
              {page}
            </button>
          ),
        )}

        <button
          type="button"
          className="srch-page-btn"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages || isPending}
        >
          Next
        </button>
      </div>
    </nav>
  );
};

export default Pagination;
