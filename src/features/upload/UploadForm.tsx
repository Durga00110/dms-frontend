import { useRef, useState } from 'react';
import type { ChangeEvent, DragEvent, KeyboardEvent } from 'react';

// Bootstrap must load BEFORE our own CSS so our overrides win.
import 'bootstrap/dist/css/bootstrap.min.css';
import './UploadForm.css';

/* ---------------------------------------------------------------------------
   Static UI only: no API calls, no validation, no react-query.
   Sample data below stands in for real options and uploads.
   --------------------------------------------------------------------------- */

interface RecentUpload {
  id: string;
  fileName: string;
  category: string;
  name: string;
  date: string;
  tags: string[];
  status: 'uploading' | 'done';
}

const SAMPLE_UPLOADS: RecentUpload[] = [
  { id: '1', fileName: 'Work Order RMC.pdf', category: 'Professional', name: 'Accounts', date: '12 Feb 2024', tags: ['RMC', '2024', 'work_order'], status: 'uploading' },
  { id: '2', fileName: 'Aadhaar Card.png', category: 'Personal', name: 'Tom', date: '03 Jan 2024', tags: ['id-proof'], status: 'done' },
];

const TAG_SUGGESTIONS = ['invoice', 'contract', 'receipt', 'id-proof', 'report', 'tax'];
const PERSONAL_NAMES = ['John', 'Tom', 'Emily', 'Priya'];
const PROFESSIONAL_DEPTS = ['Accounts', 'HR', 'IT', 'Finance'];

const MAX_REMARKS = 500;
const MAX_FILE_MB = 10;
const ACCEPT = 'image/*,application/pdf';

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

/* ---------------------------------------------------------------------------
   TagInput: chips + suggestions
   --------------------------------------------------------------------------- */
interface TagInputProps {
  id: string;
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions: string[];
}

const TagInput = ({ id, value, onChange, suggestions }: TagInputProps) => {
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);

  const add = (raw: string) => {
    const tag = raw.trim();
    setText('');
    if (!tag || value.some((t) => t.toLowerCase() === tag.toLowerCase())) return;
    onChange([...value, tag]);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(text);
    } else if (e.key === 'Backspace' && !text && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  const shown = suggestions
    .filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()))
    .filter((s) => !text.trim() || s.toLowerCase().includes(text.trim().toLowerCase()))
    .slice(0, 6);

  return (
    <div className="upl-tags-wrap">
      <div className={`upl-tags${focused ? ' upl-tags--focus' : ''}`}>
        {value.map((tag) => (
          <span key={tag} className="upl-chip">
            {tag}
            <button
              type="button"
              className="upl-chip-x"
              aria-label={`Remove tag ${tag}`}
              onClick={() => onChange(value.filter((t) => t !== tag))}
            >
              &times;
            </button>
          </span>
        ))}
        <input
          id={id}
          className="upl-tag-input"
          value={text}
          autoComplete="off"
          placeholder={value.length ? 'Add another tag' : 'Type a tag and press Enter'}
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
        <div className="upl-suggestions" role="listbox" aria-label="Existing tags">
          {shown.map((s) => (
            <button
              key={s}
              type="button"
              role="option"
              aria-selected="false"
              className="upl-suggestion"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => add(s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/* ---------------------------------------------------------------------------
   FileDropzone: drop or browse, then shows the chosen file
   --------------------------------------------------------------------------- */
interface FileDropzoneProps {
  file: File | null;
  onChange: (file: File | null) => void;
}

const FileDropzone = ({ file, onChange }: FileDropzoneProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const handleInput = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.files?.[0] ?? null);
  };

  const handleDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragging(false);
    onChange(e.dataTransfer.files?.[0] ?? null);
  };

  const clear = () => {
    onChange(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const isPdf = file?.type === 'application/pdf';

  return (
    <>
      <input
        ref={inputRef}
        id="docFile"
        type="file"
        accept={ACCEPT}
        className="upl-file-input"
        onChange={handleInput}
      />

      {file ? (
        <div className="upl-file-card">
          <div className={`upl-file-badge${isPdf ? ' upl-file-badge--pdf' : ''}`} aria-hidden="true">
            {isPdf ? 'PDF' : 'IMG'}
          </div>
          <div className="upl-file-meta">
            <div className="upl-file-name">{file.name}</div>
            <div className="upl-muted-sm">{formatSize(file.size)}</div>
          </div>
          <button type="button" className="btn btn-upl-outline btn-sm" onClick={clear}>
            Remove
          </button>
        </div>
      ) : (
        <label
          htmlFor="docFile"
          className={`upl-dropzone${dragging ? ' upl-dropzone--active' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <span className="upl-dropzone-icon" aria-hidden="true">
            &uarr;
          </span>
          <span className="upl-dropzone-title">Drop a file here or browse</span>
          <span className="upl-muted-sm">
            Images and PDF files, up to {MAX_FILE_MB} MB
          </span>
        </label>
      )}
    </>
  );
};

/* ---------------------------------------------------------------------------
   RecentUploads: list of this session's uploads (static sample)
   --------------------------------------------------------------------------- */
const RecentUploads = ({ uploads }: { uploads: RecentUpload[] }) => (
  <section className="upl-recent" aria-label="Recent uploads">
    <h3 className="upl-recent-title">This session</h3>
    <ul className="upl-recent-list">
      {uploads.map((u) => (
        <li
          key={u.id}
          className={`upl-recent-item${u.status === 'uploading' ? ' upl-recent-item--pending' : ''}`}
        >
          <div className="upl-recent-info">
            <div className="upl-file-name">{u.fileName}</div>
            <div className="upl-muted-sm">
              {u.category}, {u.name}, {u.date}
            </div>
            {u.tags.length > 0 && (
              <div className="upl-recent-tags">
                {u.tags.map((t) => (
                  <span key={t} className="upl-mini-tag">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
          <span className={`upl-status upl-status--${u.status}`}>
            {u.status === 'uploading' ? 'Uploading' : 'Uploaded'}
          </span>
        </li>
      ))}
    </ul>
  </section>
);

/* ---------------------------------------------------------------------------
   Page
   --------------------------------------------------------------------------- */
const UploadForm = () => {
  const [date, setDate] = useState('');
  const [major, setMajor] = useState('');
  const [minor, setMinor] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [remarks, setRemarks] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const minorOptions =
    major === 'Personal' ? PERSONAL_NAMES : major === 'Professional' ? PROFESSIONAL_DEPTS : [];
  const minorLabel = major === 'Professional' ? 'Department' : 'Name';

  const reset = () => {
    setDate('');
    setMajor('');
    setMinor('');
    setTags([]);
    setRemarks('');
    setFile(null);
  };

  return (
    <div className="upl-page">
      <div className="upl-shell">
        <form className="upl-card" onSubmit={(e) => e.preventDefault()} noValidate>
          {/* Header */}
          <div className="upl-header">
            <div className="upl-logo" aria-hidden="true">
              A
            </div>
            <div>
              <h1 className="upl-title">Upload a document</h1>
              <p className="upl-subtitle">Add the details, then choose an image or PDF.</p>
            </div>
          </div>

          {/* 1. Document date */}
          <div className="upl-field">
            <label htmlFor="docDate" className="upl-label form-label">
              Document date
            </label>
            <input
              type="date"
              id="docDate"
              className="upl-input form-control"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {/* 2. Category */}
          <div className="upl-field">
            <label htmlFor="majorHead" className="upl-label form-label">
              Category
            </label>
            <select
              id="majorHead"
              className="upl-input form-control"
              value={major}
              onChange={(e) => {
                setMajor(e.target.value);
                setMinor('');
              }}
            >
              <option value="">Select a category</option>
              <option value="Personal">Personal</option>
              <option value="Professional">Professional</option>
            </select>
          </div>

          {/* 3. Name / department */}
          <div className="upl-field">
            <label htmlFor="minorHead" className="upl-label form-label">
              {minorLabel}
            </label>
            <select
              id="minorHead"
              className="upl-input form-control"
              value={minor}
              disabled={!major}
              onChange={(e) => setMinor(e.target.value)}
            >
              <option value="">
                {major ? `Select a ${minorLabel.toLowerCase()}` : 'Select a category first'}
              </option>
              {minorOptions.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Tags */}
          <div className="upl-field">
            <label htmlFor="tagInput" className="upl-label form-label">
              Document tags
            </label>
            <TagInput id="tagInput" value={tags} onChange={setTags} suggestions={TAG_SUGGESTIONS} />
            <div className="upl-help">
              Pick an existing tag or type a new one.
            </div>
          </div>

          {/* 5. Remarks */}
          <div className="upl-field">
            <label htmlFor="remarks" className="upl-label form-label">
              Remarks
            </label>
            <textarea
              id="remarks"
              rows={3}
              maxLength={MAX_REMARKS}
              className="upl-input form-control"
              placeholder="Anything worth knowing about this document"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
            <div className="upl-help upl-help--end">
              {remarks.length}/{MAX_REMARKS}
            </div>
          </div>

          {/* 6. File */}
          <div className="upl-field">
            <span className="upl-label form-label">Image or PDF file</span>
            <FileDropzone file={file} onChange={setFile} />
          </div>

          {/* Actions */}
          <div className="upl-actions">
            <button type="button" className="btn btn-upl-outline" onClick={reset}>
              Reset
            </button>
            <button type="submit" className="btn btn-upl-primary">
              Upload document
            </button>
          </div>
        </form>

        <RecentUploads uploads={SAMPLE_UPLOADS} />
      </div>
    </div>
  );
};

export default UploadForm;