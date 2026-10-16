import { useState, useEffect } from "react";
import type { KeyboardEvent, FormEvent } from "react";

import "bootstrap/dist/css/bootstrap.min.css";
import "./DocumentSearch.css";

import { useSearchDocuments } from "../../hooks/useSearchDocuments";
import type {
  DocumentItem as ApiDocumentItem,
  SearchDocumentPayload,
} from "../../services/documentService";

type FileKind = "pdf" | "image" | "other";

interface DocumentItem {
  id: string;
  name: string;
  major: string;
  minor: string;
  date: string;
  tags: string[];
  kind: FileKind;
  fileUrl: string;
}

interface SearchFormProps {
  onSearch: (payload: SearchDocumentPayload) => void;
  onReset: () => void;
  isPending: boolean;
}

const TAG_SUGGESTIONS = [
  "invoice",
  "contract",
  "receipt",
  "id-proof",
  "report",
  "tax",
];

const PERSONAL_NAMES = ["John", "Tom", "Emily", "Priya"];
const PROFESSIONAL_DEPTS = ["Accounts", "HR", "IT", "Finance"];

const KIND_LABEL: Record<FileKind, string> = {
  pdf: "PDF",
  image: "IMG",
  other: "FILE",
};

const formatDateForApi = (date: string) => {
  if (!date) return "";

  const [year, month, day] = date.split("-");
  return `${day}-${month}-${year}`;
};

const getFileKind = (fileName: string): FileKind => {
  const extension = fileName.split(".").pop()?.toLowerCase();

  if (extension === "pdf") return "pdf";

  if (["png", "jpg", "jpeg", "gif", "webp"].includes(extension ?? "")) {
    return "image";
  }

  return "other";
};

const getDocumentName = (doc: ApiDocumentItem): string => {
  const record = doc as ApiDocumentItem & {
    file_name?: string;
    document_name?: string;
    name?: string;
  };

  return (
    record.file_name ||
    record.document_name ||
    record.name ||
    doc.file_url?.split("/").pop()?.split("?")[0] ||
    `Document ${doc.document_id}`
  );
};

const mapDocument = (doc: ApiDocumentItem): DocumentItem => {
  const name = getDocumentName(doc);

  return {
    id: String(doc.document_id),
    name,
    major: doc.major_head || "",
    minor: doc.minor_head || "",
    date: doc.document_date || "",
    tags: Array.isArray(doc.tags)
      ? doc.tags.map((tag) => tag.tag_name).filter(Boolean)
      : [],
    kind: getFileKind(name),
    fileUrl: doc.file_url || "",
  };
};

/* ---------------------------------------------------------------------------
   TagInput
--------------------------------------------------------------------------- */

interface TagInputProps {
  id: string;
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions: string[];
}

const TagInput = ({ id, value, onChange, suggestions }: TagInputProps) => {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);

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

  const shown = suggestions
    .filter(
      (item) =>
        !value.some(
          (selected) => selected.toLowerCase() === item.toLowerCase(),
        ),
    )
    .filter(
      (item) =>
        !text.trim() || item.toLowerCase().includes(text.trim().toLowerCase()),
    )
    .slice(0, 6);

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

      {focused && shown.length > 0 && (
        <div
          className="srch-suggestions"
          role="listbox"
          aria-label="Existing tags"
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

          <TagInput
            id="srchTags"
            value={tags}
            onChange={setTags}
            suggestions={TAG_SUGGESTIONS}
          />
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

interface ResultsListProps {
  docs: DocumentItem[];
  total: number;
  onPreview: (doc: DocumentItem) => void;
}
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
          {doc.tags.map((tag) => (
            <span key={tag} className="srch-mini-tag">
              {tag}
            </span>
          ))}
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

    {docs.length === 0 ? (
      <div className="srch-foot">No documents found.</div>
    ) : (
      <div className="srch-foot">
        Showing {docs.length} of {total} records
      </div>
    )}
  </div>
);

/* ---------------------------------------------------------------------------
   PreviewModal
--------------------------------------------------------------------------- */

interface PreviewModalProps {
  doc: DocumentItem;
  onClose: () => void;
}

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

  const searchMutation = useSearchDocuments();

  const handleSearch = (payload: SearchDocumentPayload) => {
    const token = localStorage.getItem("token");

    if (!token) {
      setAuthError("Authentication token not found. Please log in again.");
      setDocs([]);
      setTotal(0);
      setHasSearched(false);
      return;
    }

    setAuthError("");
    setHasSearched(false);

    searchMutation.mutate(
      { payload, token },
      {
        onSuccess: (response) => {
          const results = response.data ?? [];

          setDocs(results.map(mapDocument));
          setTotal(response.recordsFiltered ?? 0);
          setHasSearched(true);
        },
      },
    );
  };

  const handleReset = () => {
    setDocs([]);
    setTotal(0);
    setHasSearched(false);
    setAuthError("");
    searchMutation.reset();
  };
  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      setAuthError("Authentication token not found. Please log in again.");
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

    setAuthError("");

    searchMutation.mutate(
      { payload: initialPayload, token },
      {
        onSuccess: (response) => {
          setDocs((response.data ?? []).map(mapDocument));
          setTotal(response.recordsFiltered ?? 0);
          setHasSearched(true);
        },
        onError: (error) => {
          console.error("Initial document search failed:", error);
        },
      },
    );

    // Run only when the component mounts.
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
            <ResultsList docs={docs} total={total} onPreview={setPreview} />
          ) : (
            <p className="srch-foot">
              Enter your filters and click Search to find documents.
            </p>
          )}
        </section>
      </div>

      {preview && (
        <PreviewModal doc={preview} onClose={() => setPreview(null)} />
      )}
    </div>
  );
};

export default DocumentSearch;
