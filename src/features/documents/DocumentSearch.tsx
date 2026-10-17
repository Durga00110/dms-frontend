import { useState, useEffect } from "react";
import type { KeyboardEvent, FormEvent } from "react";

import "bootstrap/dist/css/bootstrap.min.css";
import "./DocumentSearch.css";

import { useSearchDocuments } from "../../hooks/useSearchDocuments";
import { useTagSuggestions } from "../../hooks/useTagSuggestions";
import type { SearchDocumentPayload } from "../../services/documentSearchService";
import Pagination from "./Pagination";

import type {
  DocumentItem,
  SearchFormProps,
  TagInputProps,
  ResultsListProps,
  PreviewModalProps,
} from "../../types/documentSearch";

import {
  PERSONAL_NAMES,
  PROFESSIONAL_DEPTS,
  KIND_LABEL,
  formatDateForApi,
  mapDocument,
} from "../../utils/documentSearch.utils";

/* ---------------------------------------------------------------------------
   TagInput
--------------------------------------------------------------------------- */


const TagInput = ({ id, value, onChange }: TagInputProps) => {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);

  // Suggestions come from the API based on what the user types
  const { data: fetched = [], isFetching } = useTagSuggestions(text, focused);

  const add = (raw: string) => {
    const tag = raw.trim();
    setText("");

    if (
      !tag ||
      value.some((item) => item.toLowerCase() === tag.toLowerCase())
    ) {
      return;
    }

    onChange([...value, tag]);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(text);
    } else if (e.key === "Backspace" && !text && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  const shown = text.trim()
    ? fetched
        .filter(
          (item) =>
            !value.some(
              (selected) => selected.toLowerCase() === item.toLowerCase(),
            ),
        )
        .slice(0, 6)
    : [];

  return (
    <div className="srch-tags-wrap">
      <div className={`srch-tags${focused ? " srch-tags--focus" : ""}`}>
        {value.map((tag) => (
          <span key={tag} className="srch-chip">
            {tag}
            <button
              type="button"
              className="srch-chip-x"
              aria-label={`Remove tag ${tag}`}
              onClick={() => onChange(value.filter((item) => item !== tag))}
            >
              &times;
            </button>
          </span>
        ))}

        <input
          id={id}
          className="srch-tag-input"
          value={text}
          autoComplete="off"
          placeholder={
            value.length ? "Add another tag" : "Type a tag and press Enter"
          }
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            add(text);
          }}
        />
      </div>

      {focused && text.trim() && (shown.length > 0 || isFetching) && (
        <div
          className="srch-suggestions"
          role="listbox"
          aria-label="Matching tags"
        >
          {shown.map((item) => (
            <button
              key={item}
              type="button"
              role="option"
              aria-selected="false"
              className="srch-suggestion"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => add(item)}
            >
              {item}
            </button>
          ))}

          {isFetching && shown.length === 0 && (
            <div className="srch-muted-sm px-2 py-1">Searching tags...</div>
          )}
        </div>
      )}
    </div>
  );
};

/* ---------------------------------------------------------------------------
   SearchForm
--------------------------------------------------------------------------- */

const SearchForm = ({ onSearch, onReset, isPending }: SearchFormProps) => {
  const [major, setMajor] = useState("");
  const [minor, setMinor] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const minorOptions =
    major === "Personal"
      ? PERSONAL_NAMES
      : major === "Professional"
        ? PROFESSIONAL_DEPTS
        : [];

  const reset = () => {
    setMajor("");
    setMinor("");
    setTags([]);
    setFromDate("");
    setToDate("");
    onReset();
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const payload: SearchDocumentPayload = {
      major_head: major,
      minor_head: minor,
      from_date: formatDateForApi(fromDate),
      to_date: formatDateForApi(toDate),
      tags: tags.length
        ? tags.map((tag) => ({ tag_name: tag }))
        : [{ tag_name: "" }, { tag_name: "" }],
      uploaded_by: "",
      start: 0,
      length: 10,
      filterId: "",
      search: {
        value: "",
      },
    };

    onSearch(payload);
  };

  return (
    <form className="srch-card" onSubmit={handleSubmit} noValidate>
      <div className="srch-fields">
        <div className="srch-field">
          <label htmlFor="srchMajor" className="srch-label form-label">
            Category
          </label>

          <select
            id="srchMajor"
            className="srch-input form-control"
            value={major}
            onChange={(e) => {
              setMajor(e.target.value);
              setMinor("");
            }}
          >
            <option value="">All categories</option>
            <option value="Personal">Personal</option>
            <option value="Professional">Professional</option>
          </select>
        </div>

        <div className="srch-field">
          <label htmlFor="srchMinor" className="srch-label form-label">
            Subcategory
          </label>

          <select
            id="srchMinor"
            className="srch-input form-control"
            value={minor}
            disabled={!major}
            onChange={(e) => setMinor(e.target.value)}
          >
            <option value="">
              {major ? "Any" : "Choose a category first"}
            </option>

            {minorOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div className="srch-field srch-field--full">
          <label htmlFor="srchTags" className="srch-label form-label">
            Tags
          </label>

          <TagInput id="srchTags" value={tags} onChange={setTags} />
        </div>

        <div className="srch-field">
          <label htmlFor="srchFrom" className="srch-label form-label">
            From date
          </label>

          <input
            id="srchFrom"
            type="date"
            className="srch-input form-control"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>

        <div className="srch-field">
          <label htmlFor="srchTo" className="srch-label form-label">
            To date
          </label>

          <input
            id="srchTo"
            type="date"
            className="srch-input form-control"
            value={toDate}
            min={fromDate || undefined}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
      </div>

      <div className="srch-form-actions">
        <button
          type="button"
          className="btn btn-srch-outline"
          onClick={reset}
          disabled={isPending}
        >
          Reset
        </button>

        <button
          type="submit"
          className="btn btn-srch-primary"
          disabled={isPending}
        >
          {isPending ? "Searching..." : "Search"}
        </button>
      </div>
    </form>
  );
};

/* ---------------------------------------------------------------------------
   ResultsList
--------------------------------------------------------------------------- */

const handleDownload = async (url: string, fileName: string) => {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error("Failed to download file");
    }

    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = fileName || "document";
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error("Download failed:", error);
    alert(
      "Unable to download this file. The server may not allow cross-origin downloads.",
    );
  }
};

const ResultsList = ({ docs, total, onPreview }: ResultsListProps) => (
  <div className="srch-table" role="table" aria-label="Search results">
    <div className="srch-grid srch-head" role="row">
      <div role="columnheader">Document</div>
      <div role="columnheader">Category</div>
      <div role="columnheader">Date</div>
      <div role="columnheader">Tags</div>
      <div role="columnheader" className="srch-col-end">
        Actions
      </div>
    </div>

    {docs.map((doc) => (
      <div key={doc.id} className="srch-grid srch-row" role="row">
        <div role="cell" className="srch-cell srch-cell--name">
          <span
            className={`srch-type srch-type--${doc.kind}`}
            aria-hidden="true"
          >
            {KIND_LABEL[doc.kind]}
          </span>

          <span className="srch-name" title={doc.name}>
            {doc.name}
          </span>
        </div>

        <div role="cell" className="srch-cell" data-label="Category">
          <div>{doc.major}</div>
          <div className="srch-muted-sm">{doc.minor}</div>
        </div>

        <div role="cell" className="srch-cell" data-label="Date">
          {doc.date}
        </div>

        <div
          role="cell"
          className="srch-cell srch-cell--tags"
          data-label="Tags"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            fill="currentColor"
            className="bi bi-bookmark-fill"
            viewBox="0 0 16 16"
          >
            <path d="M2 2v13.5a.5.5 0 0 0 .74.439L8 13.069l5.26 2.87A.5.5 0 0 0 14 15.5V2a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2" />
          </svg>
        </div>

        <div role="cell" className="srch-cell srch-row-actions">
          <button
            type="button"
            className="btn btn-srch-soft btn-sm"
            onClick={() => onPreview(doc)}
          >
            Preview
          </button>

          {doc.fileUrl && (
            <button
              type="button"
              className="btn btn-srch-outline btn-sm"
              onClick={() => handleDownload(doc.fileUrl, doc.name)}
            >
              Download
            </button>
          )}
        </div>
      </div>
    ))}
  </div>
);

/* ---------------------------------------------------------------------------
   PreviewModal
--------------------------------------------------------------------------- */


const PreviewModal = ({ doc, onClose }: PreviewModalProps) => (
  <div className="srch-overlay" onClick={onClose}>
    <div
      className="srch-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="srchPreviewTitle"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="srch-modal-head">
        <h2 className="srch-modal-title" id="srchPreviewTitle">
          {doc.name}
        </h2>

        <button
          type="button"
          className="srch-modal-close"
          aria-label="Close preview"
          onClick={onClose}
        >
          &times;
        </button>
      </div>

      <div className="srch-modal-body">
        {doc.fileUrl && doc.kind === "pdf" ? (
          <iframe
            src={doc.fileUrl}
            title={doc.name}
            style={{ width: "100%", height: "65vh", border: 0 }}
          />
        ) : doc.fileUrl && doc.kind === "image" ? (
          <img
            src={doc.fileUrl}
            alt={doc.name}
            style={{
              display: "block",
              maxWidth: "100%",
              maxHeight: "65vh",
              margin: "0 auto",
            }}
          />
        ) : (
          <div className="srch-preview-placeholder">
            <div className="srch-preview-icon" aria-hidden="true">
              {KIND_LABEL[doc.kind]}
            </div>

            <p className="srch-muted">
              Preview is not available for this file type.
            </p>

            {doc.fileUrl && (
              <a href={doc.fileUrl} target="_blank" rel="noreferrer">
                Open document
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  </div>
);

/* ---------------------------------------------------------------------------
   Page
--------------------------------------------------------------------------- */

const DocumentSearch = () => {
  const [preview, setPreview] = useState<DocumentItem | null>(null);
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const [authError, setAuthError] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [lastPayload, setLastPayload] =
    useState<SearchDocumentPayload | null>(null);

  const searchMutation = useSearchDocuments();

  // All API searches, including pagination, use this function.
  const runSearch = (
    payload: SearchDocumentPayload,
    page: number,
    size: number,
  ) => {
    const token = localStorage.getItem("token");

    if (!token) {
      setAuthError(
        "Authentication token not found. Please log in again.",
      );
      setDocs([]);
      setTotal(0);
      setHasSearched(false);
      return;
    }

    const requestPayload: SearchDocumentPayload = {
      ...payload,
      start: (page - 1) * size,
      length: size,
    };

    setAuthError("");
    setCurrentPage(page);

    console.log("Searching documents:", {
      start: requestPayload.start,
      length: requestPayload.length,
      page,
    });

    searchMutation.mutate(
      { payload: requestPayload, token },
      {
        onSuccess: (response) => {
          setDocs((response.data ?? []).map(mapDocument));

          // Use the total matching record count, not data.length.
          setTotal(response.recordsFiltered ?? 0);
          setHasSearched(true);
        },
        onError: (error) => {
          console.error("Document search failed:", error);
          setDocs([]);
          setHasSearched(false);
        },
      },
    );
  };

  // Submit filters and start from page 1.
  const handleSearch = (payload: SearchDocumentPayload) => {
    setLastPayload(payload);
    runSearch(payload, 1, pageSize);
  };

  // Load another page with the same filters.
  const handlePageChange = (page: number) => {
    const totalPages = Math.ceil(total / pageSize);

    if (
      !lastPayload ||
      searchMutation.isPending ||
      page < 1 ||
      page > totalPages ||
      page === currentPage
    ) {
      return;
    }

    runSearch(lastPayload, page, pageSize);
  };

  // Changing page size restarts pagination at page 1.
  const handlePageSizeChange = (size: number) => {
    setPageSize(size);

    if (lastPayload) {
      runSearch(lastPayload, 1, size);
    }
  };

  const handleReset = () => {
    setDocs([]);
    setTotal(0);
    setCurrentPage(1);
    setPageSize(10);
    setLastPayload(null);
    setHasSearched(false);
    setAuthError("");
    searchMutation.reset();
  };

  // Initial search on mount.
  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      setAuthError(
        "Authentication token not found. Please log in again.",
      );
      return;
    }

    const initialPayload: SearchDocumentPayload = {
      major_head: "",
      minor_head: "",
      from_date: "",
      to_date: "",
      tags: [{ tag_name: "" }, { tag_name: "" }],
      uploaded_by: "",
      start: 0,
      length: 10,
      filterId: "",
      search: {
        value: "",
      },
    };

    setLastPayload(initialPayload);

    searchMutation.mutate(
      { payload: initialPayload, token },
      {
        onSuccess: (response) => {
          setDocs((response.data ?? []).map(mapDocument));
          setTotal(response.recordsFiltered ?? 0);
          setCurrentPage(1);
          setHasSearched(true);
        },
        onError: (error) => {
          console.error("Initial document search failed:", error);
        },
      },
    );

    // Initial search only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="srch-page">
      <div className="srch-shell">
        <header className="srch-header">
          <div>
            <h1 className="srch-title">Find documents</h1>
            <p className="srch-subtitle">
              Filter by category, tags and date, then preview or download.
            </p>
          </div>
        </header>

        <SearchForm
          onSearch={handleSearch}
          onReset={handleReset}
          isPending={searchMutation.isPending}
        />

        {authError && (
          <p role="alert" className="text-danger mt-3">
            {authError}
          </p>
        )}

        {searchMutation.isError && (
          <p role="alert" className="text-danger mt-3">
            Search failed: {searchMutation.error.message}
          </p>
        )}

        <section className="srch-results" aria-label="Results">
          <div className="srch-results-bar d-flex justify-content-between align-items-center">
            <h2 className="srch-results-title mb-0">
              {hasSearched ? `${total} documents` : "Search results"}
            </h2>

            <button
              type="button"
              className="btn btn-primary"
              disabled={!hasSearched || total === 0}
            >
              <i className="bi bi-file-earmark-zip me-2"></i>
              Download All
            </button>
          </div>

          {searchMutation.isPending ? (
            <p className="srch-foot">Searching documents...</p>
          ) : hasSearched ? (
            <>
              <ResultsList
                docs={docs}
                total={total}
                onPreview={setPreview}
              />

              <Pagination
                currentPage={currentPage}
                total={total}
                pageSize={pageSize}
                isPending={searchMutation.isPending}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
              />
            </>
          ) : (
            <p className="srch-foot">
              Enter your filters and click Search to find documents.
            </p>
          )}
        </section>
      </div>

      {preview && (
        <PreviewModal
          doc={preview}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
};

export default DocumentSearch;
