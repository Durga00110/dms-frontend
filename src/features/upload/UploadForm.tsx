import { useRef, useState } from 'react';
import type { ChangeEvent, DragEvent, FormEvent, KeyboardEvent } from 'react';
import './UploadForm.css';
import type { TagInputProps, FileDropzoneProps } from '../../types/uploadForm.types';
import { FiFileText } from 'react-icons/fi';

// Adjust the path to wherever you saved the service.
import { uploadDocument } from '../../services/documentUploadService';
import {
  FIELD_IDS,
  FIELD_ORDER,
  MAX_FILE_MB,
  MAX_REMARKS,
  validateUploadField,
  validateUploadForm,
} from '../../validations/UploadForm.validation';
import type {
  FieldErrors,
  FieldName,
  UploadFormValues as FormValues,
} from '../../validations/UploadForm.validation';

/* ---------------------------------------------------------------------------
   Sample data stands in for real options and recent uploads until those
   endpoints are wired up.
   --------------------------------------------------------------------------- */

const TAG_SUGGESTIONS = ['invoice', 'contract', 'receipt', 'id-proof', 'report', 'tax'];
const PERSONAL_NAMES = ['John', 'Tom', 'Emily', 'Priya'];
const PROFESSIONAL_DEPTS = ['Accounts', 'HR', 'IT', 'Finance'];

const ACCEPT = 'image/*,application/pdf';

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

type Touched = Partial<Record<FieldName, boolean>>;

const FieldError = ({ id, message }: { id: string; message?: string }) =>
  message ? (
    <div id={id} className="invalid-feedback d-block" role="alert">
      {message}
    </div>
  ) : null;

/* ---------------------------------------------------------------------------
   TagInput: chips + suggestions
   --------------------------------------------------------------------------- */

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
   Page
   --------------------------------------------------------------------------- */
const UploadForm = () => {
  const [date, setDate] = useState('');
  const [major, setMajor] = useState('');
  const [minor, setMinor] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [remarks, setRemarks] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Touched>({});

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null); // server / auth errors only
  const [success, setSuccess] = useState<string | null>(null);

  const values: FormValues = { date, major, minor, tags, remarks, file };

  const minorOptions =
    major === 'Personal' ? PERSONAL_NAMES : major === 'Professional' ? PROFESSIONAL_DEPTS : [];
  const minorLabel = major === 'Professional' ? 'Department' : 'Name';

  /* ---- validation helpers ------------------------------------------------ */

  const setFieldError = (name: FieldName, message?: string) =>
    setFieldErrors((prev) => ({ ...prev, [name]: message }));

  // Validate a single field against the given (latest) values.
  const validateField = async (name: FieldName, next: FormValues) => {
    setFieldError(name, await validateUploadField(name, next));
  };

  // Update a field. Re-validate right away only once the user has already
  // interacted with it, so people aren't shown errors while still typing.
  const change = <K extends FieldName>(name: K, value: FormValues[K], extra?: Partial<FormValues>) => {
    const next = { ...values, ...extra, [name]: value } as FormValues;
    if (touched[name] || fieldErrors[name]) {
      void validateField(name, next);
    }
  };

  const blur = (name: FieldName) => {
    setTouched((prev) => ({ ...prev, [name]: true }));
    void validateField(name, values);
  };

  /* ---- field handlers ---------------------------------------------------- */

  const handleDate = (v: string) => {
    setDate(v);
    change('date', v);
  };

  const handleMajor = (v: string) => {
    setMajor(v);
    setMinor('');
    // The "minor" field depends on "major", so reset its error as well.
    setFieldError('minor', undefined);
    setTouched((prev) => ({ ...prev, minor: false }));
    change('major', v, { minor: '' });
  };

  const handleMinor = (v: string) => {
    setMinor(v);
    change('minor', v);
  };

  const handleRemarks = (v: string) => {
    setRemarks(v);
    change('remarks', v);
  };

  const handleFile = (f: File | null) => {
    setFile(f);
    setTouched((prev) => ({ ...prev, file: true }));
    void validateField('file', { ...values, file: f });
  };

  /* ---- reset ------------------------------------------------------------- */

  const clearFields = () => {
    setDate('');
    setMajor('');
    setMinor('');
    setTags([]);
    setRemarks('');
    setFile(null);
    setFieldErrors({});
    setTouched({});
  };

  const reset = () => {
    clearFields();
    setError(null);
    setSuccess(null);
  };

  /* ---- submit ------------------------------------------------------------ */

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const errors = await validateUploadForm(values);
    setFieldErrors(errors);
    setTouched({ date: true, major: true, minor: true, tags: true, remarks: true, file: true });

    const firstInvalid = FIELD_ORDER.find((name) => errors[name]);
    if (firstInvalid) {
      document.getElementById(FIELD_IDS[firstInvalid])?.focus();
      return;
    }

    // Adjust these two lines to wherever your login step stores them.
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('test_mdr');
    if (!token || !userId) {
      setError('You are not logged in. Please log in again.');
      return;
    }

    setSubmitting(true);
    try {
      await uploadDocument({
        file: file!,
        majorHead: major,
        minorHead: minor,
        date,
        remarks,
        tags,
        userId,
        token,
      });
      setSuccess('Document uploaded successfully.');
      clearFields();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const invalid = (name: FieldName) => (fieldErrors[name] ? ' is-invalid' : '');
  const describedBy = (name: FieldName) =>
    fieldErrors[name] ? `${FIELD_IDS[name]}-error` : undefined;

  return (
    <div className="upl-page">
      <div className="upl-shell">
        <form className="upl-card" onSubmit={handleSubmit} noValidate>
          {/* Header */}
          <div className="upl-header">
            <div className="upl-logo" aria-hidden="true">
              <FiFileText />
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
              className={`upl-input form-control${invalid('date')}`}
              value={date}
              disabled={submitting}
              aria-invalid={!!fieldErrors.date}
              aria-describedby={describedBy('date')}
              onChange={(e) => handleDate(e.target.value)}
              onBlur={() => blur('date')}
            />
            <FieldError id="docDate-error" message={fieldErrors.date} />
          </div>

          {/* 2. Category */}
          <div className="upl-field">
            <label htmlFor="majorHead" className="upl-label form-label">
              Category
            </label>
            <select
              id="majorHead"
              className={`upl-input form-control${invalid('major')}`}
              value={major}
              disabled={submitting}
              aria-invalid={!!fieldErrors.major}
              aria-describedby={describedBy('major')}
              onChange={(e) => handleMajor(e.target.value)}
              onBlur={() => blur('major')}
            >
              <option value="">Select a category</option>
              <option value="Personal">Personal</option>
              <option value="Professional">Professional</option>
            </select>
            <FieldError id="majorHead-error" message={fieldErrors.major} />
          </div>

          {/* 3. Name / department */}
          <div className="upl-field">
            <label htmlFor="minorHead" className="upl-label form-label">
              {minorLabel}
            </label>
            <select
              id="minorHead"
              className={`upl-input form-control${invalid('minor')}`}
              value={minor}
              disabled={!major || submitting}
              aria-invalid={!!fieldErrors.minor}
              aria-describedby={describedBy('minor')}
              onChange={(e) => handleMinor(e.target.value)}
              onBlur={() => blur('minor')}
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
            <FieldError id="minorHead-error" message={fieldErrors.minor} />
          </div>

          {/* 4. Tags */}
          <div className="upl-field">
            <label htmlFor="tagInput" className="upl-label form-label">
              Document tags
            </label>
            <TagInput id="tagInput" value={tags} onChange={setTags} suggestions={TAG_SUGGESTIONS} />
            <div className="upl-help">Pick an existing tag or type a new one.</div>
            <FieldError id="tagInput-error" message={fieldErrors.tags} />
          </div>

          {/* 5. Remarks */}
          <div className="upl-field">
            <label htmlFor="remarks" className="upl-label form-label">
              Remarks
            </label>
            <textarea
              id="remarks"
              rows={3}
              className={`upl-input form-control${invalid('remarks')}`}
              placeholder="Anything worth knowing about this document"
              value={remarks}
              disabled={submitting}
              aria-invalid={!!fieldErrors.remarks}
              aria-describedby={describedBy('remarks')}
              onChange={(e) => handleRemarks(e.target.value)}
              onBlur={() => blur('remarks')}
            />
            <div className="d-flex justify-content-between">
              <div>
                <FieldError id="remarks-error" message={fieldErrors.remarks} />
              </div>
              <div
                className={`upl-help upl-help--end${remarks.length > MAX_REMARKS ? ' text-danger' : ''}`}
              >
                {remarks.length}/{MAX_REMARKS}
              </div>
            </div>
          </div>

          {/* 6. File */}
          <div className="upl-field">
            <span className="upl-label form-label">Image or PDF file</span>
            <FileDropzone file={file} onChange={handleFile} />
            <FieldError id="docFile-error" message={fieldErrors.file} />
          </div>

          {/* Server / auth messages (Bootstrap alerts, so no new CSS is needed) */}
          {error && (
            <div className="alert alert-danger py-2" role="alert">
              {error}
            </div>
          )}
          {success && (
            <div className="alert alert-success py-2" role="status">
              {success}
            </div>
          )}

          {/* Actions */}
          <div className="upl-actions">
            <button
              type="button"
              className="btn btn-upl-outline"
              onClick={reset}
              disabled={submitting}
            >
              Reset
            </button>
            <button type="submit" className="btn btn-upl-primary" disabled={submitting}>
              {submitting ? 'Uploading...' : 'Upload document'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UploadForm;