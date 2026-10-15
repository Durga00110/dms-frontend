import React, { useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import './DocumentUpload.css';

/* ---------------------------------------------------------------------------
   Install once:  npm install @tanstack/react-query zod
   --------------------------------------------------------------------------- */

/* ---------------------------------------------------------------------------
   API CONFIG: copy these from the Postman collection. Nothing here is invented.
   major_head and minor_head are the key names given in the assignment PDF.
   --------------------------------------------------------------------------- */
const PLACEHOLDER = 'FILL_FROM_POSTMAN';
const API_BASE_URL = PLACEHOLDER;
const TOKEN_KEY = 'auth_token'; // saved by LoginPage after OTP validation

// Header that carries the token (see the Auth tab in Postman), e.g. name "Authorization", prefix "Bearer ".
const AUTH_HEADER = { name: PLACEHOLDER, prefix: '' };

type Endpoint = { method: string; path: string };

const ENDPOINTS: Record<'listTags' | 'saveTag' | 'upload', Endpoint> = {
    listTags: { method: 'GET', path: PLACEHOLDER }, // existing tags
    saveTag: { method: 'POST', path: PLACEHOLDER }, // saves a newly created tag
    upload: { method: 'POST', path: PLACEHOLDER }, // multipart file upload
};

// Names (Personal) or departments (Professional). Adjust to how Postman passes the category
// (query string, path segment or body) and return the matching { method, path }.
const minorHeadEndpoint = (_major: 'Personal' | 'Professional'): Endpoint => ({
    method: 'GET',
    path: PLACEHOLDER,
});

// Multipart field names for the upload request.
const FIELDS = {
    date: PLACEHOLDER,
    majorHead: 'major_head',
    minorHead: 'minor_head',
    tags: PLACEHOLDER, // tags are appended once per tag; change to JSON/comma text if Postman shows that
    remarks: PLACEHOLDER,
    file: PLACEHOLDER,
};
const SAVE_TAG_FIELD = PLACEHOLDER; // body key for the tag name in the "save tag" request

// How the list responses look. Leave a value empty when the API returns plain strings / a bare array.
const RESPONSE = {
    tagsListPath: '', // e.g. "data.tags" when the array is nested
    tagNameKey: '', // e.g. "name" when tags are objects
    minorListPath: '',
    optionLabelKey: '', // key shown in the dropdown
    optionValueKey: '', // key sent to the API; empty = send the label
};

// UI rules for the file (not API details). Adjust to the assignment's requirements.
const MAX_FILE_MB = 10;
const ACCEPT = 'image/*,application/pdf';
const MAX_TAG_LENGTH = 30;

const isConfigured = (value: string) => value !== PLACEHOLDER;

/* ---------------------------------------------------------------------------
   Types + Zod schemas (assignment 6.4: validate form data, payloads, responses)
   --------------------------------------------------------------------------- */
type MajorHead = 'Personal' | 'Professional';
type Option = { label: string; value: string };

interface FormValues {
    date: string;
    major: '' | MajorHead;
    minor: string;
    tags: string[];
    remarks: string;
    file: File | null;
}

interface RecentUpload {
    id: string;
    fileName: string;
    category: string;
    name: string;
    date: string;
    tags: string[];
    status: 'uploading' | 'done';
}

type Notice = { kind: 'success' | 'danger'; text: string } | null;

const EMPTY_FORM: FormValues = { date: '', major: '', minor: '', tags: [], remarks: '', file: null };

const isAllowedType = (type: string) => type === 'application/pdf' || type.startsWith('image/');

const fileSchema = z.any().superRefine((value, ctx) => {
    if (!(value instanceof File)) {
        ctx.addIssue({ code: 'custom', message: 'Choose an image or PDF file.' });
        return;
    }
    if (!isAllowedType(value.type)) {
        ctx.addIssue({ code: 'custom', message: 'Only images and PDF files are allowed.' });
    } else if (value.size === 0) {
        ctx.addIssue({ code: 'custom', message: 'This file is empty.' });
    } else if (value.size > MAX_FILE_MB * 1024 * 1024) {
        ctx.addIssue({ code: 'custom', message: `File must be ${MAX_FILE_MB} MB or smaller.` });
    }
});

const formSchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Select the document date.'),
    major: z.string().refine((v) => v === 'Personal' || v === 'Professional', 'Select a category.'),
    minor: z.string().min(1, 'Select an option.'),
    tags: z
        .array(z.string().min(1).max(MAX_TAG_LENGTH, `Tags can be up to ${MAX_TAG_LENGTH} characters.`))
        .max(20, 'Use 20 tags or fewer.'),
    remarks: z.string().max(500, 'Remarks can be up to 500 characters.'),
    file: fileSchema,
});

const optionSchema = z.object({ label: z.string().min(1), value: z.string().min(1) });

/* ---------------------------------------------------------------------------
   API helpers
   --------------------------------------------------------------------------- */
class ApiError extends Error {
    status: number;
    constructor(message: string, status = 0) {
        super(message);
        this.status = status;
    }
}

async function apiFetch(endpoint: Endpoint, body?: { json?: unknown; form?: FormData }): Promise<unknown> {
    if (![API_BASE_URL, endpoint.path, AUTH_HEADER.name].every(isConfigured)) {
        throw new ApiError('API details are not set. Copy them from the Postman collection into the config block.');
    }
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) throw new ApiError('Your session has ended. Sign in again.', 401);

    const headers: Record<string, string> = { [AUTH_HEADER.name]: `${AUTH_HEADER.prefix}${token}` };
    let payload: BodyInit | undefined;
    if (body?.form) {
        payload = body.form; // the browser sets the multipart boundary itself
    } else if (body?.json !== undefined) {
        headers['Content-Type'] = 'application/json';
        payload = JSON.stringify(body.json);
    }

    let res: Response;
    try {
        res = await fetch(`${API_BASE_URL}${endpoint.path}`, { method: endpoint.method, headers, body: payload });
    } catch {
        throw new ApiError('Network error. Check your connection and try again.');
    }

    let data: any = null;
    try {
        data = await res.json();
    } catch {
        /* empty or non-JSON body */
    }
    if (!res.ok) {
        throw new ApiError(data?.message || data?.error || `Request failed (${res.status})`, res.status);
    }
    return data;
}

const getByPath = (obj: unknown, path: string): unknown =>
    path.split('.').reduce<any>((acc, key) => (acc == null ? undefined : acc[key]), obj);

function toOptions(data: unknown, listPath: string, labelKey: string, valueKey = ''): Option[] {
    const raw = listPath ? getByPath(data, listPath) : data;
    const list = z.array(z.unknown()).safeParse(raw);
    if (!list.success) throw new Error('Unexpected list format from the server. Check the list path in the config block.');

    const options = list.data.map((item) => {
        if (typeof item === 'string') return { label: item, value: item };
        if (item && typeof item === 'object') {
            const rec = item as Record<string, unknown>;
            const label = labelKey ? rec[labelKey] : undefined;
            const value = valueKey ? rec[valueKey] : label;
            return { label: String(label ?? ''), value: String(value ?? '') };
        }
        return { label: '', value: '' };
    });

    const parsed = z.array(optionSchema).safeParse(options);
    if (!parsed.success) throw new Error('Unexpected option format. Set the label key in the config block.');
    return parsed.data;
}

const fetchTags = async (): Promise<string[]> =>
    toOptions(await apiFetch(ENDPOINTS.listTags), RESPONSE.tagsListPath, RESPONSE.tagNameKey).map((o) => o.label);

const fetchMinorOptions = async (major: MajorHead): Promise<Option[]> =>
    toOptions(
        await apiFetch(minorHeadEndpoint(major)),
        RESPONSE.minorListPath,
        RESPONSE.optionLabelKey,
        RESPONSE.optionValueKey
    );

async function uploadDocument(values: FormValues): Promise<unknown> {
    if (!Object.values(FIELDS).every(isConfigured)) {
        throw new ApiError('Upload field names are not set. Copy them from the Postman collection into the config block.');
    }
    const parsed = formSchema.safeParse(values);
    if (!parsed.success || !values.file) throw new ApiError('The form is not valid.');

    const form = new FormData();
    form.append(FIELDS.date, values.date);
    form.append(FIELDS.majorHead, values.major);
    form.append(FIELDS.minorHead, values.minor);
    values.tags.forEach((tag) => form.append(FIELDS.tags, tag));
    form.append(FIELDS.remarks, values.remarks);
    form.append(FIELDS.file, values.file);
    return apiFetch(ENDPOINTS.upload, { form });
}

/* ---------------------------------------------------------------------------
   Query setup
   --------------------------------------------------------------------------- */
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
            retry: (count, error) => error instanceof ApiError && error.status >= 500 && count < 2,
        },
    },
});

const TAGS_KEY = ['tags'];
const RECENT_KEY = ['recent-uploads'];

const formatSize = (bytes: number) =>
    bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

/* ---------------------------------------------------------------------------
   Form
   --------------------------------------------------------------------------- */
const UploadForm: React.FC = () => {
    const qc = useQueryClient();
    const [form, setForm] = useState<FormValues>(EMPTY_FORM);
    const [tagInput, setTagInput] = useState('');
    const [tagFocused, setTagFocused] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [fileError, setFileError] = useState('');
    const [dragging, setDragging] = useState(false);
    const [previewUrl, setPreviewUrl] = useState('');
    const [notice, setNotice] = useState<Notice>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    /* ----- data ----- */
    const tagsQuery = useQuery({ queryKey: TAGS_KEY, queryFn: fetchTags, staleTime: 60_000 });
    const minorQuery = useQuery({
        queryKey: ['minor-options', form.major],
        queryFn: () => fetchMinorOptions(form.major as MajorHead),
        enabled: form.major !== '',
        staleTime: 5 * 60_000,
    });
    const recentQuery = useQuery<RecentUpload[]>({
        queryKey: RECENT_KEY,
        queryFn: async () => [],
        initialData: [],
        staleTime: Infinity,
        gcTime: Infinity,
    });

    const existingTags = tagsQuery.data ?? [];
    const minorOptions = minorQuery.data ?? [];
    const recent = recentQuery.data ?? [];

    /* ----- validation ----- */
    const validation = useMemo(() => formSchema.safeParse(form), [form]);
    const errors = useMemo(() => {
        const out: Partial<Record<keyof FormValues, string>> = {};
        if (!validation.success) {
            for (const issue of validation.error.issues) {
                const key = issue.path[0] as keyof FormValues | undefined;
                if (key && !out[key]) out[key] = issue.message;
            }
        }
        return out;
    }, [validation]);
    const showError = (key: keyof FormValues) => (submitted ? errors[key] : undefined);

    /* ----- notices ----- */
    useEffect(() => {
        if (notice?.kind !== 'success') return;
        const t = setTimeout(() => setNotice(null), 5000);
        return () => clearTimeout(t);
    }, [notice]);

    /* ----- image preview ----- */
    useEffect(() => {
        if (form.file && form.file.type.startsWith('image/')) {
            const url = URL.createObjectURL(form.file);
            setPreviewUrl(url);
            return () => URL.revokeObjectURL(url);
        }
        setPreviewUrl('');
    }, [form.file]);

    /* ----- optimistic: save a new tag ----- */
    const saveTagMutation = useMutation({
        mutationFn: async (tag: string) => {
            await apiFetch(ENDPOINTS.saveTag, { json: { [SAVE_TAG_FIELD]: tag } });
        },
        onMutate: async (tag: string) => {
            await qc.cancelQueries({ queryKey: TAGS_KEY });
            const previous = qc.getQueryData<string[]>(TAGS_KEY);
            qc.setQueryData<string[]>(TAGS_KEY, (old) => [...(old ?? []), tag]);
            return { previous };
        },
        onError: (error, tag, ctx) => {
            // roll back: restore the tag list and drop the chip that could not be saved
            qc.setQueryData<string[]>(TAGS_KEY, ctx?.previous);
            setForm((f) => ({ ...f, tags: f.tags.filter((t) => t !== tag) }));
            setNotice({ kind: 'danger', text: `Couldn't save the tag "${tag}". ${(error as Error).message}` });
        },
        onSettled: () => {
            void qc.invalidateQueries({ queryKey: TAGS_KEY });
        },
    });

    /* ----- optimistic: upload ----- */
    const uploadMutation = useMutation({
        mutationFn: (vars: { values: FormValues; minorLabel: string }) => uploadDocument(vars.values),
        onMutate: async (vars) => {
            await qc.cancelQueries({ queryKey: RECENT_KEY });
            const previous = qc.getQueryData<RecentUpload[]>(RECENT_KEY) ?? [];
            const tempId = `pending-${Date.now()}`;
            const pending: RecentUpload = {
                id: tempId,
                fileName: vars.values.file?.name ?? 'document',
                category: vars.values.major,
                name: vars.minorLabel,
                date: vars.values.date,
                tags: vars.values.tags,
                status: 'uploading',
            };
            qc.setQueryData<RecentUpload[]>(RECENT_KEY, [pending, ...previous]);

            // instant feedback: clear the form right away
            setForm(EMPTY_FORM);
            setTagInput('');
            setSubmitted(false);
            setFileError('');
            setNotice(null);
            return { previous, tempId, formSnapshot: vars.values };
        },
        onError: (error, _vars, ctx) => {
            // roll back: remove the pending row and put the user's input back
            if (ctx) {
                qc.setQueryData<RecentUpload[]>(RECENT_KEY, ctx.previous);
                setForm(ctx.formSnapshot);
            }
            setNotice({ kind: 'danger', text: `Upload failed, nothing was saved. ${(error as Error).message}` });
        },
        onSuccess: (_data, _vars, ctx) => {
            qc.setQueryData<RecentUpload[]>(RECENT_KEY, (old) =>
                (old ?? []).map((u) => (u.id === ctx?.tempId ? { ...u, status: 'done' } : u))
            );
            setNotice({ kind: 'success', text: 'Document uploaded.' });
        },
        onSettled: () => {
            // when the API has a "list documents" request, invalidate its query here so the server list refreshes
        },
    });

    /* ----- handlers ----- */
    const handleMajorChange = (value: string) => {
        // the second dropdown depends on the first, so clear it
        setForm((f) => ({ ...f, major: value as FormValues['major'], minor: '' }));
    };

    const addTag = (raw: string) => {
        const tag = raw.trim();
        if (!tag) return;
        if (tag.length > MAX_TAG_LENGTH) {
            setNotice({ kind: 'danger', text: `Tags can be up to ${MAX_TAG_LENGTH} characters.` });
            return;
        }
        if (form.tags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
            setTagInput('');
            return;
        }
        const existing = existingTags.find((t) => t.toLowerCase() === tag.toLowerCase());
        const finalTag = existing ?? tag;
        setForm((f) => ({ ...f, tags: [...f.tags, finalTag] }));
        setTagInput('');
        if (!existing) saveTagMutation.mutate(finalTag); // new tags are saved automatically
    };

    const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addTag(tagInput);
        } else if (e.key === 'Backspace' && !tagInput && form.tags.length) {
            setForm((f) => ({ ...f, tags: f.tags.slice(0, -1) }));
        }
    };

    const pickFile = (file: File | null) => {
        if (!file) return;
        const check = fileSchema.safeParse(file);
        if (!check.success) {
            setFileError(check.error.issues[0]?.message ?? 'This file cannot be used.');
            return;
        }
        setFileError('');
        setForm((f) => ({ ...f, file }));
    };

    const clearFile = () => {
        setForm((f) => ({ ...f, file: null }));
        setFileError('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleReset = () => {
        setForm(EMPTY_FORM);
        setTagInput('');
        setSubmitted(false);
        setFileError('');
        setNotice(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitted(true);
        setNotice(null);
        if (!validation.success) return;
        const minorLabel = minorOptions.find((o) => o.value === form.minor)?.label ?? form.minor;
        uploadMutation.mutate({ values: form, minorLabel });
    };

    const suggestions = useMemo(() => {
        const q = tagInput.trim().toLowerCase();
        return existingTags
            .filter((t) => !form.tags.some((s) => s.toLowerCase() === t.toLowerCase()))
            .filter((t) => !q || t.toLowerCase().includes(q))
            .slice(0, 8);
    }, [existingTags, form.tags, tagInput]);

    const minorLabel = form.major === 'Professional' ? 'Department' : 'Name';

    return (
        <div className="upload-page">
            <div className="upload-shell">
                <form className="card upload-card border-0 shadow-lg" onSubmit={handleSubmit} noValidate>
                    <div className="card-body p-4 p-md-5">
                        {/* Header */}
                        <div className="d-flex align-items-center gap-3 mb-4">
                            <div className="upload-badge d-flex align-items-center justify-content-center" aria-hidden="true">
                                <span className="fs-3">📄</span>
                            </div>
                            <div>
                                <h2 className="fw-bold mb-0 upload-title">Upload a document</h2>
                                <p className="text-muted mb-0 small">Add the details, then choose an image or PDF.</p>
                            </div>
                        </div>

                        {!isConfigured(API_BASE_URL) && (
                            <div className="alert alert-warning small">
                                Setup needed: add the endpoint details from the Postman collection to the config block in DocumentUpload.tsx.
                            </div>
                        )}

                        {notice && (
                            <div className={`alert alert-${notice.kind} d-flex align-items-start small`} role="alert">
                                <span className="me-2">{notice.kind === 'success' ? '✅' : '⚠️'}</span>
                                <span className="flex-grow-1">{notice.text}</span>
                                <button type="button" className="btn-close btn-sm" aria-label="Dismiss" onClick={() => setNotice(null)} />
                            </div>
                        )}

                        {/* 1. Document date */}
                        <div className="mb-4">
                            <label htmlFor="docDate" className="form-label fw-semibold">
                                Document date
                            </label>
                            <input
                                type="date"
                                id="docDate"
                                className={`form-control form-control-lg ${showError('date') ? 'is-invalid' : ''}`}
                                value={form.date}
                                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                            />
                            <div className="invalid-feedback">{showError('date')}</div>
                        </div>

                        {/* 2. Category (major_head) */}
                        <div className="mb-4">
                            <label htmlFor="majorHead" className="form-label fw-semibold">
                                Category
                            </label>
                            <select
                                id="majorHead"
                                className={`form-select form-select-lg ${showError('major') ? 'is-invalid' : ''}`}
                                value={form.major}
                                onChange={(e) => handleMajorChange(e.target.value)}
                            >
                                <option value="">Select a category</option>
                                <option value="Personal">Personal</option>
                                <option value="Professional">Professional</option>
                            </select>
                            <div className="invalid-feedback">{showError('major')}</div>
                        </div>

                        {/* 3. Name / department (minor_head) */}
                        <div className="mb-4">
                            <label htmlFor="minorHead" className="form-label fw-semibold">
                                {minorLabel}
                            </label>
                            <select
                                id="minorHead"
                                className={`form-select form-select-lg ${showError('minor') ? 'is-invalid' : ''}`}
                                value={form.minor}
                                disabled={!form.major || minorQuery.isLoading}
                                onChange={(e) => setForm((f) => ({ ...f, minor: e.target.value }))}
                            >
                                <option value="">
                                    {!form.major
                                        ? 'Select a category first'
                                        : minorQuery.isLoading
                                        ? 'Loading...'
                                        : `Select a ${minorLabel.toLowerCase()}`}
                                </option>
                                {minorOptions.map((o) => (
                                    <option key={o.value} value={o.value}>
                                        {o.label}
                                    </option>
                                ))}
                            </select>
                            <div className="invalid-feedback">{showError('minor')}</div>
                            {minorQuery.isError && (
                                <div className="upload-inline-error small mt-2">
                                    Couldn't load the options. {(minorQuery.error as Error).message}{' '}
                                    <button type="button" className="btn btn-link upload-link p-0 align-baseline" onClick={() => minorQuery.refetch()}>
                                        Try again
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* 4. Document tags */}
                        <div className="mb-4">
                            <label htmlFor="tagInput" className="form-label fw-semibold">
                                Document tags
                            </label>
                            <div className={`upload-tags form-control ${showError('tags') ? 'is-invalid' : ''} ${tagFocused ? 'upload-tags--focus' : ''}`}>
                                {form.tags.map((tag) => (
                                    <span key={tag} className="upload-chip">
                                        {tag}
                                        <button
                                            type="button"
                                            className="upload-chip-x"
                                            aria-label={`Remove tag ${tag}`}
                                            onClick={() => setForm((f) => ({ ...f, tags: f.tags.filter((t) => t !== tag) }))}
                                        >
                                            ×
                                        </button>
                                    </span>
                                ))}
                                <input
                                    id="tagInput"
                                    className="upload-tag-input"
                                    value={tagInput}
                                    placeholder={form.tags.length ? 'Add another tag' : 'Type a tag and press Enter'}
                                    autoComplete="off"
                                    onChange={(e) => setTagInput(e.target.value)}
                                    onKeyDown={handleTagKeyDown}
                                    onFocus={() => setTagFocused(true)}
                                    onBlur={() => {
                                        setTagFocused(false);
                                        addTag(tagInput);
                                    }}
                                />
                            </div>
                            <div className="invalid-feedback d-block">{showError('tags')}</div>

                            {tagFocused && suggestions.length > 0 && (
                                <div className="upload-suggestions" role="listbox" aria-label="Existing tags">
                                    {suggestions.map((t) => (
                                        <button
                                            key={t}
                                            type="button"
                                            role="option"
                                            aria-selected="false"
                                            className="upload-suggestion"
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={() => addTag(t)}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            )}
                            <div className="form-text">
                                {tagsQuery.isError
                                    ? `Couldn't load existing tags. ${(tagsQuery.error as Error).message}`
                                    : 'Pick an existing tag or type a new one; new tags are saved automatically.'}
                            </div>
                        </div>

                        {/* 5. Remarks */}
                        <div className="mb-4">
                            <label htmlFor="remarks" className="form-label fw-semibold">
                                Remarks
                            </label>
                            <textarea
                                id="remarks"
                                rows={3}
                                className={`form-control ${showError('remarks') ? 'is-invalid' : ''}`}
                                placeholder="Anything worth knowing about this document"
                                value={form.remarks}
                                onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
                            />
                            <div className="d-flex justify-content-between">
                                <div className="invalid-feedback d-block">{showError('remarks')}</div>
                                <div className="form-text ms-auto">{form.remarks.length}/500</div>
                            </div>
                        </div>

                        {/* 6. Image or PDF file */}
                        <div className="mb-4">
                            <span className="form-label fw-semibold d-block">Image or PDF file</span>
                            <input
                                ref={fileInputRef}
                                id="docFile"
                                type="file"
                                accept={ACCEPT}
                                className="upload-file-input"
                                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                            />
                            {form.file ? (
                                <div className="upload-file-card">
                                    {previewUrl ? (
                                        <img src={previewUrl} alt="Selected file preview" className="upload-thumb" />
                                    ) : (
                                        <div className="upload-thumb upload-thumb--pdf" aria-hidden="true">
                                            PDF
                                        </div>
                                    )}
                                    <div className="upload-file-meta">
                                        <div className="fw-semibold text-truncate">{form.file.name}</div>
                                        <div className="text-muted small">{formatSize(form.file.size)}</div>
                                    </div>
                                    <button type="button" className="btn btn-outline-secondary btn-sm" onClick={clearFile}>
                                        Remove
                                    </button>
                                </div>
                            ) : (
                                <label
                                    htmlFor="docFile"
                                    className={`upload-dropzone ${dragging ? 'upload-dropzone--active' : ''} ${
                                        fileError || showError('file') ? 'upload-dropzone--error' : ''
                                    }`}
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        setDragging(true);
                                    }}
                                    onDragLeave={() => setDragging(false)}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        setDragging(false);
                                        pickFile(e.dataTransfer.files?.[0] ?? null);
                                    }}
                                >
                                    <span className="upload-dropzone-icon" aria-hidden="true">
                                        ⬆️
                                    </span>
                                    <span className="fw-semibold">Drop a file here or browse</span>
                                    <span className="text-muted small">No file selected. Accepted: image/* and application/pdf, up to {MAX_FILE_MB} MB</span>
                                </label>
                            )}
                            {(fileError || showError('file')) && <div className="upload-inline-error small mt-2">{fileError || showError('file')}</div>}
                        </div>

                        {/* Actions */}
                        <div className="d-flex flex-column-reverse flex-sm-row gap-2 justify-content-sm-end">
                            <button type="button" className="btn btn-outline-secondary btn-lg" onClick={handleReset}>
                                Reset
                            </button>
                            <button type="submit" className="btn upload-btn-primary btn-lg">
                                Upload document
                            </button>
                        </div>
                    </div>
                </form>

                {/* Recent uploads (optimistic list) */}
                {recent.length > 0 && (
                    <section className="upload-recent" aria-label="Recent uploads">
                        <h3 className="h6 fw-bold mb-3">This session</h3>
                        <ul className="list-unstyled mb-0">
                            {recent.map((u) => (
                                <li key={u.id} className={`upload-recent-item ${u.status === 'uploading' ? 'upload-recent-item--pending' : ''}`}>
                                    <div className="flex-grow-1 min-w-0">
                                        <div className="fw-semibold text-truncate">{u.fileName}</div>
                                        <div className="small text-muted">
                                            {u.category}, {u.name}, {u.date}
                                        </div>
                                        {u.tags.length > 0 && (
                                            <div className="mt-1 d-flex flex-wrap gap-1">
                                                {u.tags.map((t) => (
                                                    <span key={t} className="badge upload-mini-tag">
                                                        {t}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    {u.status === 'uploading' ? (
                                        <span className="upload-status upload-status--pending">
                                            <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true" />
                                            Uploading
                                        </span>
                                    ) : (
                                        <span className="upload-status upload-status--done">Uploaded</span>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </section>
                )}
            </div>
        </div>
    );
};

/* The provider lives here so the file works on its own. If main.tsx already
   wraps the app in a QueryClientProvider, return <UploadForm /> directly. */
const DocumentUpload: React.FC = () => (
    <QueryClientProvider client={queryClient}>
        <UploadForm />
    </QueryClientProvider>
);

export default DocumentUpload;