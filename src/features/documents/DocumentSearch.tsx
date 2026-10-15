import React, { useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { z } from 'zod';
import 'bootstrap/dist/css/bootstrap.min.css'; // remove if you already import Bootstrap in main.tsx / index.tsx
import './DocumentSearch.css';

/* ---------------------------------------------------------------------------
   Install once:  npm install @tanstack/react-query @tanstack/react-virtual zod fflate

   File placement: keep this file in src/ and the worker at src/workers/zip.worker.ts.
   If you put this file elsewhere, fix the relative path in buildZipInWorker().
   --------------------------------------------------------------------------- */

/* ---------------------------------------------------------------------------
   API CONFIG: copy these from the Postman collection. Nothing here is invented.
   Use the same base URL, token key and auth header as in DocumentUpload.tsx.
   --------------------------------------------------------------------------- */
const PLACEHOLDER = 'FILL_FROM_POSTMAN';
const API_BASE_URL = PLACEHOLDER;
const TOKEN_KEY = 'auth_token'; // saved by LoginPage after OTP validation
const AUTH_HEADER = { name: PLACEHOLDER, prefix: '' }; // e.g. name "Authorization", prefix "Bearer "

type Endpoint = { method: string; path: string };

const ENDPOINTS: Record<'search' | 'listTags', Endpoint> = {
    search: { method: PLACEHOLDER, path: PLACEHOLDER },
    listTags: { method: 'GET', path: PLACEHOLDER },
};

// Switch to match the Postman search request: filters in a JSON body or in the query string.
const SEARCH_SENT_AS: 'json' | 'query' = 'json';

// Names (Personal) or departments (Professional), same request the upload form uses.
const minorHeadEndpoint = (_major: 'Personal' | 'Professional'): Endpoint => ({
    method: 'GET',
    path: PLACEHOLDER,
});

// Delete request. Leave as FILL_FROM_POSTMAN if the collection has no delete request:
// the Delete button then stays hidden and no endpoint is invented.
const deleteEndpoint = (_id: string): Endpoint => ({ method: PLACEHOLDER, path: PLACEHOLDER });
const CAN_DELETE = isConfiguredEndpoint(deleteEndpoint(''));

// Filter names the search request expects. major_head / minor_head come from the assignment PDF.
const FILTER_FIELDS = {
    major: 'major_head',
    minor: 'minor_head',
    tags: PLACEHOLDER,
    fromDate: PLACEHOLDER,
    toDate: PLACEHOLDER,
};

// Where each document field sits in the search response. Leave '' for plain / bare values.
const DOC_KEYS = {
    listPath: '', // e.g. "data" when the array is nested; '' when the response is a bare array
    id: PLACEHOLDER,
    name: PLACEHOLDER,
    major: 'major_head',
    minor: 'minor_head',
    date: PLACEHOLDER,
    tags: PLACEHOLDER, // array of strings / objects, or a comma-separated string
    tagNameKey: '', // key holding the tag text when tags are objects
    fileUrl: PLACEHOLDER, // URL or path of the file; used for preview and download
    fileType: '', // optional key with the MIME type; otherwise it is read from the file name
};
const TAG_LIST = { listPath: '', nameKey: '' }; // shape of the "list tags" response
const MINOR_LIST = { listPath: '', labelKey: '', valueKey: '' }; // shape of the name / department response

// Send the token on file requests. Set to false if Postman shows public or pre-signed file URLs.
const SEND_AUTH_ON_FILE_REQUESTS = true;

// UI limits (not API details).
const MAX_CACHED_DOCS = 2000;
const MAX_CACHE_ENTRIES = 8;
const ZIP_CONFIRM_COUNT = 200;
const ZIP_CONCURRENCY = 4;
const DEMO_COUNT = 1200;
const UNSUPPORTED_MESSAGE = 'Preview is not available for this file type. Download the file to open it.';

function isConfigured(value: string) {
    return value !== PLACEHOLDER;
}
function isConfiguredEndpoint(ep: Endpoint) {
    return isConfigured(ep.method) && isConfigured(ep.path);
}

/* ---------------------------------------------------------------------------
   Types + Zod schemas (6.4)
   --------------------------------------------------------------------------- */
type MajorHead = 'Personal' | 'Professional';
type FileKind = 'image' | 'pdf' | 'other';

const documentSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    major: z.string(),
    minor: z.string(),
    date: z.string(),
    tags: z.array(z.string()),
    fileUrl: z.string(),
    mime: z.string(),
    kind: z.enum(['image', 'pdf', 'other']),
});
type DocumentItem = z.infer<typeof documentSchema>;

const dateOrEmpty = z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Use a valid date.');
const filtersSchema = z
    .object({
        major: z.string().refine((v) => v === '' || v === 'Personal' || v === 'Professional', 'Choose a valid category.'),
        minor: z.string(),
        tags: z.array(z.string().trim().min(1)).max(20, 'Use 20 tags or fewer.'),
        fromDate: dateOrEmpty,
        toDate: dateOrEmpty,
    })
    .refine((f) => !f.fromDate || !f.toDate || f.fromDate <= f.toDate, {
        message: 'From date must be on or before To date.',
        path: ['toDate'],
    });
type Filters = z.infer<typeof filtersSchema>;

const EMPTY_FILTERS: Filters = { major: '', minor: '', tags: [], fromDate: '', toDate: '' };

const optionSchema = z.object({ label: z.string().min(1), value: z.string().min(1) });
type Option = z.infer<typeof optionSchema>;

interface SearchResult {
    documents: DocumentItem[];
    skipped: number;
    fromCache: boolean;
    cachedAt?: number;
}

type Notice = { kind: 'success' | 'danger' | 'warning'; text: string } | null;

/* ---------------------------------------------------------------------------
   API helpers
   --------------------------------------------------------------------------- */
class ApiError extends Error {
    status: number;
    network: boolean;
    constructor(message: string, status = 0, network = false) {
        super(message);
        this.status = status;
        this.network = network;
    }
}

const messageOf = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.');

function authHeaders(): Record<string, string> {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) throw new ApiError('Your session has ended. Sign in again.', 401);
    if (!isConfigured(AUTH_HEADER.name)) {
        throw new ApiError('API details are not set. Copy them from the Postman collection into the config block.');
    }
    return { [AUTH_HEADER.name]: `${AUTH_HEADER.prefix}${token}` };
}

async function apiFetch(endpoint: Endpoint, opts?: { json?: unknown; query?: URLSearchParams; signal?: AbortSignal }) {
    if (!isConfigured(API_BASE_URL) || !isConfiguredEndpoint(endpoint)) {
        throw new ApiError('API details are not set. Copy them from the Postman collection into the config block.');
    }
    const headers = authHeaders();
    let body: BodyInit | undefined;
    if (opts?.json !== undefined) {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(opts.json);
    }
    const qs = opts?.query && [...opts.query.keys()].length ? `?${opts.query.toString()}` : '';

    let res: Response;
    try {
        res = await fetch(`${API_BASE_URL}${endpoint.path}${qs}`, { method: endpoint.method, headers, body, signal: opts?.signal });
    } catch (e) {
        if ((e as Error)?.name === 'AbortError') throw e;
        throw new ApiError('Network error. Check your connection and try again.', 0, true);
    }

    let data: any = null;
    try {
        data = await res.json();
    } catch {
        /* empty or non-JSON body */
    }
    if (!res.ok) throw new ApiError(data?.message || data?.error || `Request failed (${res.status})`, res.status);
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
    toOptions(await apiFetch(ENDPOINTS.listTags), TAG_LIST.listPath, TAG_LIST.nameKey).map((o) => o.label);

const fetchMinorOptions = async (major: MajorHead): Promise<Option[]> =>
    toOptions(await apiFetch(minorHeadEndpoint(major)), MINOR_LIST.listPath, MINOR_LIST.labelKey, MINOR_LIST.valueKey);

/* ----- file type helpers ----- */
const IMAGE_EXT: Record<string, string> = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp', svg: 'image/svg+xml',
};

function detectType(name: string, fileUrl: string, hint: string): { kind: FileKind; mime: string } {
    const hinted = hint.toLowerCase();
    if (hinted === 'application/pdf') return { kind: 'pdf', mime: hinted };
    if (hinted.startsWith('image/')) return { kind: 'image', mime: hinted };
    const ext = (s: string) => s.split('?')[0].split('#')[0].split('.').pop()?.toLowerCase() ?? '';
    for (const e of [ext(name), ext(fileUrl)]) {
        if (e === 'pdf') return { kind: 'pdf', mime: 'application/pdf' };
        if (IMAGE_EXT[e]) return { kind: 'image', mime: IMAGE_EXT[e] };
    }
    return { kind: 'other', mime: hinted || 'application/octet-stream' };
}

function fileNameFor(doc: DocumentItem): string {
    if (/\.[A-Za-z0-9]{2,5}$/.test(doc.name)) return doc.name;
    const ext = doc.kind === 'pdf' ? '.pdf' : doc.mime.startsWith('image/') ? `.${doc.mime.split('/')[1].replace('jpeg', 'jpg').replace('svg+xml', 'svg')}` : '';
    return `${doc.name}${ext}`;
}

function toTags(raw: unknown): string[] {
    if (Array.isArray(raw)) {
        return raw
            .map((t) => (typeof t === 'string' ? t : t && typeof t === 'object' && DOC_KEYS.tagNameKey ? String((t as any)[DOC_KEYS.tagNameKey] ?? '') : ''))
            .map((t) => t.trim())
            .filter(Boolean);
    }
    if (typeof raw === 'string') return raw.split(',').map((t) => t.trim()).filter(Boolean);
    return [];
}

function mapDocuments(data: unknown): { documents: DocumentItem[]; skipped: number } {
    const required = [DOC_KEYS.id, DOC_KEYS.name, DOC_KEYS.major, DOC_KEYS.minor, DOC_KEYS.date, DOC_KEYS.tags, DOC_KEYS.fileUrl];
    if (!required.every(isConfigured)) {
        throw new ApiError('Response field names are not set. Copy them from the Postman search response into DOC_KEYS.');
    }
    const raw = DOC_KEYS.listPath ? getByPath(data, DOC_KEYS.listPath) : data;
    const list = z.array(z.unknown()).safeParse(raw);
    if (!list.success) throw new Error('Unexpected search response. Check DOC_KEYS.listPath against the Postman response.');

    const documents: DocumentItem[] = [];
    let skipped = 0;
    for (const row of list.data) {
        const r = (row && typeof row === 'object' ? row : {}) as Record<string, unknown>;
        const name = String(r[DOC_KEYS.name] ?? '');
        const fileUrl = String(r[DOC_KEYS.fileUrl] ?? '');
        const { kind, mime } = detectType(name, fileUrl, DOC_KEYS.fileType ? String(r[DOC_KEYS.fileType] ?? '') : '');
        const parsed = documentSchema.safeParse({
            id: String(r[DOC_KEYS.id] ?? ''),
            name,
            major: String(r[DOC_KEYS.major] ?? ''),
            minor: String(r[DOC_KEYS.minor] ?? ''),
            date: String(r[DOC_KEYS.date] ?? ''),
            tags: toTags(r[DOC_KEYS.tags]),
            fileUrl,
            mime,
            kind,
        });
        if (parsed.success) documents.push(parsed.data);
        else skipped++;
    }
    return { documents, skipped };
}

async function searchRequest(filters: Filters): Promise<{ documents: DocumentItem[]; skipped: number }> {
    if (!Object.values(FILTER_FIELDS).every(isConfigured)) {
        throw new ApiError('Search field names are not set. Copy them from the Postman collection into FILTER_FIELDS.');
    }
    const checked = filtersSchema.parse(filters);
    const values: Record<string, string | string[]> = {};
    if (checked.major) values[FILTER_FIELDS.major] = checked.major;
    if (checked.minor) values[FILTER_FIELDS.minor] = checked.minor;
    if (checked.tags.length) values[FILTER_FIELDS.tags] = checked.tags;
    if (checked.fromDate) values[FILTER_FIELDS.fromDate] = checked.fromDate;
    if (checked.toDate) values[FILTER_FIELDS.toDate] = checked.toDate;

    let data: unknown;
    if (SEARCH_SENT_AS === 'query') {
        const query = new URLSearchParams();
        Object.entries(values).forEach(([k, v]) => (Array.isArray(v) ? v.forEach((x) => query.append(k, x)) : query.append(k, v)));
        data = await apiFetch(ENDPOINTS.search, { query });
    } else {
        data = await apiFetch(ENDPOINTS.search, { json: values });
    }
    return mapDocuments(data);
}

/* ----- authenticated file fetch (preview, download, ZIP) ----- */
async function fetchFileBlob(doc: DocumentItem, signal?: AbortSignal): Promise<Blob> {
    if (!doc.fileUrl) throw new ApiError('This record has no file attached.');
    const isAbsolute = /^https?:\/\//i.test(doc.fileUrl);
    if (!isAbsolute && !isConfigured(API_BASE_URL)) {
        throw new ApiError('API details are not set. Copy them from the Postman collection into the config block.');
    }
    const url = isAbsolute ? doc.fileUrl : `${API_BASE_URL}${doc.fileUrl}`;
    const headers = SEND_AUTH_ON_FILE_REQUESTS ? authHeaders() : {};

    let res: Response;
    try {
        res = await fetch(url, { headers, signal });
    } catch (e) {
        if ((e as Error)?.name === 'AbortError') throw e;
        throw new ApiError('Network error while fetching the file.', 0, true);
    }
    if (!res.ok) throw new ApiError(`The server could not return this file (${res.status}).`, res.status);
    const blob = await res.blob();
    return blob.type && blob.type !== 'application/octet-stream' ? blob : new Blob([blob], { type: doc.mime });
}

function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/* ----- ZIP in a Web Worker (6.3) ----- */
const workerReplySchema = z.union([z.object({ archive: z.instanceof(Uint8Array) }), z.object({ error: z.string() })]);

function buildZipInWorker(files: { name: string; data: ArrayBuffer }[], signal: AbortSignal): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
        const worker = new Worker(new URL('./workers/zip.worker.ts', import.meta.url), { type: 'module' });
        const finish = () => {
            worker.terminate();
            signal.removeEventListener('abort', onAbort);
        };
        const onAbort = () => {
            finish();
            reject(new DOMException('Cancelled', 'AbortError'));
        };
        signal.addEventListener('abort', onAbort);

        worker.onmessage = (event) => {
            finish();
            const reply = workerReplySchema.safeParse(event.data);
            if (!reply.success) return reject(new Error('The ZIP worker sent an unexpected reply.'));
            if ('error' in reply.data) return reject(new Error(reply.data.error));
            resolve(reply.data.archive);
        };
        worker.onerror = (event) => {
            finish();
            reject(new Error(event.message || 'The ZIP worker failed.'));
        };
        worker.onmessageerror = () => {
            finish();
            reject(new Error('The ZIP worker sent data that could not be read.'));
        };
        // transfer the buffers instead of copying them
        worker.postMessage({ files }, files.map((f) => f.data));
    });
}

/* ----- offline cache in LocalStorage (6.5) ----- */
const CACHE_KEY = 'dms_search_cache_v1';
const cacheEntrySchema = z.object({ key: z.string(), savedAt: z.number(), documents: z.array(documentSchema) });
type CacheEntry = z.infer<typeof cacheEntrySchema>;

const filtersKey = (f: Filters) =>
    JSON.stringify({ ...f, tags: f.tags.map((t) => t.toLowerCase()).sort() });

function loadCache(): CacheEntry[] {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return [];
        const parsed = z.array(cacheEntrySchema).safeParse(JSON.parse(raw));
        if (!parsed.success) {
            localStorage.removeItem(CACHE_KEY); // malformed: start clean
            return [];
        }
        return parsed.data;
    } catch {
        try {
            localStorage.removeItem(CACHE_KEY);
        } catch {
            /* storage unavailable */
        }
        return [];
    }
}

function storeCache(entries: CacheEntry[]) {
    let list = entries;
    for (;;) {
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(list));
            return;
        } catch {
            // most likely the storage limit: drop the oldest entry and try again
            if (list.length <= 1) {
                try {
                    localStorage.removeItem(CACHE_KEY);
                } catch {
                    /* ignore */
                }
                return;
            }
            list = list.slice(0, -1);
        }
    }
}

function saveCache(filters: Filters, documents: DocumentItem[]) {
    const key = filtersKey(filters);
    const entry: CacheEntry = { key, savedAt: Date.now(), documents: documents.slice(0, MAX_CACHED_DOCS) };
    storeCache([entry, ...loadCache().filter((e) => e.key !== key)].slice(0, MAX_CACHE_ENTRIES));
}

function readCache(filters: Filters): CacheEntry | undefined {
    const key = filtersKey(filters);
    return loadCache().find((e) => e.key === key);
}

function removeFromCache(id: string) {
    const entries = loadCache();
    if (!entries.length) return;
    storeCache(entries.map((e) => ({ ...e, documents: e.documents.filter((d) => d.id !== id) })));
}

async function runSearch(filters: Filters): Promise<SearchResult> {
    try {
        const { documents, skipped } = await searchRequest(filters);
        saveCache(filters, documents);
        return { documents, skipped, fromCache: false };
    } catch (e) {
        if (e instanceof ApiError && e.network) {
            const cached = readCache(filters);
            if (cached) return { documents: cached.documents, skipped: 0, fromCache: true, cachedAt: cached.savedAt };
        }
        throw e;
    }
}

/* ----- demo data for testing virtualization with 1,000+ rows ----- */
function makeDemoDocuments(count: number): DocumentItem[] {
    const people = ['John', 'Tom', 'Emily', 'Priya', 'Arjun'];
    const depts = ['Accounts', 'HR', 'IT', 'Finance'];
    const tags = ['invoice', 'contract', 'receipt', 'id-proof', 'report', 'tax'];
    return Array.from({ length: count }, (_, i) => {
        const personal = i % 2 === 0;
        const pdf = i % 3 !== 0;
        const day = String((i % 28) + 1).padStart(2, '0');
        const month = String((i % 12) + 1).padStart(2, '0');
        return {
            id: `demo-${i}`,
            name: `Demo document ${i + 1}${pdf ? '.pdf' : i % 5 === 0 ? '.docx' : '.png'}`,
            major: personal ? 'Personal' : 'Professional',
            minor: personal ? people[i % people.length] : depts[i % depts.length],
            date: `2026-${month}-${day}`,
            tags: [tags[i % tags.length], tags[(i * 7 + 1) % tags.length]].filter((t, idx, arr) => arr.indexOf(t) === idx),
            fileUrl: '',
            mime: pdf ? 'application/pdf' : i % 5 === 0 ? 'application/octet-stream' : 'image/png',
            kind: (pdf ? 'pdf' : i % 5 === 0 ? 'other' : 'image') as FileKind,
        };
    });
}

const formatDate = (value: string) => {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value || 'No date' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

/* ---------------------------------------------------------------------------
   Query client
   --------------------------------------------------------------------------- */
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
            retry: (count, error) => error instanceof ApiError && error.status >= 500 && count < 2,
        },
    },
});

const DOCS_KEY = 'documents';
const TAGS_KEY = ['tags'];

/* ---------------------------------------------------------------------------
   Tag input (chips + suggestions from existing tags)
   --------------------------------------------------------------------------- */
const TagInput: React.FC<{ id: string; value: string[]; onChange: (v: string[]) => void; suggestions: string[] }> = ({
    id,
    value,
    onChange,
    suggestions,
}) => {
    const [text, setText] = useState('');
    const [focused, setFocused] = useState(false);

    const add = (raw: string) => {
        const tag = raw.trim();
        setText('');
        if (!tag || value.some((t) => t.toLowerCase() === tag.toLowerCase())) return;
        onChange([...value, suggestions.find((s) => s.toLowerCase() === tag.toLowerCase()) ?? tag]);
    };

    const shown = suggestions
        .filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()))
        .filter((s) => !text.trim() || s.toLowerCase().includes(text.trim().toLowerCase()))
        .slice(0, 8);

    return (
        <>
            <div className={`srch-tags form-control ${focused ? 'srch-tags--focus' : ''}`}>
                {value.map((tag) => (
                    <span key={tag} className="srch-chip">
                        {tag}
                        <button type="button" className="srch-chip-x" aria-label={`Remove tag ${tag}`} onClick={() => onChange(value.filter((t) => t !== tag))}>
                            ×
                        </button>
                    </span>
                ))}
                <input
                    id={id}
                    className="srch-tag-input"
                    value={text}
                    autoComplete="off"
                    placeholder={value.length ? 'Add another tag' : 'Type a tag and press Enter'}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ',') {
                            e.preventDefault();
                            add(text);
                        } else if (e.key === 'Backspace' && !text && value.length) {
                            onChange(value.slice(0, -1));
                        }
                    }}
                    onFocus={() => setFocused(true)}
                    onBlur={() => {
                        setFocused(false);
                        add(text);
                    }}
                />
            </div>
            {focused && shown.length > 0 && (
                <div className="srch-suggestions" role="listbox" aria-label="Existing tags">
                    {shown.map((s) => (
                        <button key={s} type="button" role="option" aria-selected="false" className="srch-suggestion" onMouseDown={(e) => e.preventDefault()} onClick={() => add(s)}>
                            {s}
                        </button>
                    ))}
                </div>
            )}
        </>
    );
};

/* ---------------------------------------------------------------------------
   Reusable search form
   --------------------------------------------------------------------------- */
interface SearchFormProps {
    busy: boolean;
    onSearch: (filters: Filters) => void;
    onReset: () => void;
}

const SearchForm: React.FC<SearchFormProps> = ({ busy, onSearch, onReset }) => {
    const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
    const [submitted, setSubmitted] = useState(false);

    const tagsQuery = useQuery({ queryKey: TAGS_KEY, queryFn: fetchTags, staleTime: 60_000 });
    const minorQuery = useQuery({
        queryKey: ['minor-options', filters.major],
        queryFn: () => fetchMinorOptions(filters.major as MajorHead),
        enabled: filters.major !== '',
        staleTime: 5 * 60_000,
    });

    const validation = useMemo(() => filtersSchema.safeParse(filters), [filters]);
    const errors = useMemo(() => {
        const out: Partial<Record<keyof Filters, string>> = {};
        if (!validation.success) {
            for (const issue of validation.error.issues) {
                const key = issue.path[0] as keyof Filters | undefined;
                if (key && !out[key]) out[key] = issue.message;
            }
        }
        return out;
    }, [validation]);

    const minorLabel = filters.major === 'Professional' ? 'Department' : filters.major === 'Personal' ? 'Name' : 'Name / department';

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitted(true);
        if (validation.success) onSearch(validation.data);
    };

    const reset = () => {
        setFilters(EMPTY_FILTERS);
        setSubmitted(false);
        onReset();
    };

    return (
        <form className="card srch-card border-0 shadow-sm" onSubmit={submit} noValidate>
            <div className="card-body p-3 p-md-4">
                <div className="row g-3">
                    <div className="col-12 col-md-6">
                        <label htmlFor="srchMajor" className="form-label fw-semibold">Category</label>
                        <select
                            id="srchMajor"
                            className="form-select"
                            value={filters.major}
                            onChange={(e) => setFilters((f) => ({ ...f, major: e.target.value as Filters['major'], minor: '' }))}
                        >
                            <option value="">All categories</option>
                            <option value="Personal">Personal</option>
                            <option value="Professional">Professional</option>
                        </select>
                    </div>

                    <div className="col-12 col-md-6">
                        <label htmlFor="srchMinor" className="form-label fw-semibold">Subcategory</label>
                        <select
                            id="srchMinor"
                            className="form-select"
                            value={filters.minor}
                            disabled={!filters.major || minorQuery.isLoading}
                            onChange={(e) => setFilters((f) => ({ ...f, minor: e.target.value }))}
                        >
                            <option value="">
                                {!filters.major ? 'Choose a category first' : minorQuery.isLoading ? 'Loading...' : `Any ${minorLabel.toLowerCase()}`}
                            </option>
                            {(minorQuery.data ?? []).map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                        </select>
                        {minorQuery.isError && <div className="srch-inline-error small mt-1">Couldn't load the options. {messageOf(minorQuery.error)}</div>}
                    </div>

                    <div className="col-12">
                        <label htmlFor="srchTags" className="form-label fw-semibold">Tags</label>
                        <TagInput id="srchTags" value={filters.tags} onChange={(tags) => setFilters((f) => ({ ...f, tags }))} suggestions={tagsQuery.data ?? []} />
                        {submitted && errors.tags && <div className="srch-inline-error small mt-1">{errors.tags}</div>}
                    </div>

                    <div className="col-12 col-sm-6">
                        <label htmlFor="srchFrom" className="form-label fw-semibold">From date</label>
                        <input id="srchFrom" type="date" className="form-control" value={filters.fromDate} onChange={(e) => setFilters((f) => ({ ...f, fromDate: e.target.value }))} />
                    </div>
                    <div className="col-12 col-sm-6">
                        <label htmlFor="srchTo" className="form-label fw-semibold">To date</label>
                        <input
                            id="srchTo"
                            type="date"
                            className={`form-control ${errors.toDate ? 'is-invalid' : ''}`}
                            value={filters.toDate}
                            min={filters.fromDate || undefined}
                            onChange={(e) => setFilters((f) => ({ ...f, toDate: e.target.value }))}
                        />
                        <div className="invalid-feedback">{errors.toDate}</div>
                    </div>
                </div>

                <div className="d-flex flex-column-reverse flex-sm-row gap-2 justify-content-sm-end mt-4">
                    <button type="button" className="btn btn-outline-secondary" onClick={reset} disabled={busy}>Reset</button>
                    <button type="submit" className="btn srch-btn-primary" disabled={busy || !validation.success}>
                        {busy ? (
                            <>
                                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                                Searching...
                            </>
                        ) : (
                            'Search'
                        )}
                    </button>
                </div>
            </div>
        </form>
    );
};

/* ---------------------------------------------------------------------------
   Virtualized results (6.2): only the visible rows exist in the DOM
   --------------------------------------------------------------------------- */
interface ResultsListProps {
    docs: DocumentItem[];
    busyIds: Record<string, boolean>;
    canDelete: boolean;
    onPreview: (doc: DocumentItem) => void;
    onDownload: (doc: DocumentItem) => void;
    onDelete: (doc: DocumentItem) => void;
}

const ResultsList: React.FC<ResultsListProps> = ({ docs, busyIds, canDelete, onPreview, onDownload, onDelete }) => {
    const parentRef = useRef<HTMLDivElement | null>(null);
    const virtualizer = useVirtualizer({
        count: docs.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 84,
        overscan: 8,
    });
    const items = virtualizer.getVirtualItems();

    useEffect(() => {
        if (parentRef.current) parentRef.current.scrollTop = 0; // new results start at the top
    }, [docs]);

    return (
        <div className="srch-table" role="table" aria-label="Search results" aria-rowcount={docs.length + 1}>
            <div className="srch-grid srch-head" role="row">
                <div role="columnheader">Document</div>
                <div role="columnheader">Category</div>
                <div role="columnheader">Date</div>
                <div role="columnheader">Tags</div>
                <div role="columnheader" className="text-end">Actions</div>
            </div>

            <div ref={parentRef} className="srch-scroll">
                <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
                    {items.map((v) => {
                        const doc = docs[v.index];
                        const busy = !!busyIds[doc.id];
                        return (
                            <div
                                key={v.key}
                                data-index={v.index}
                                ref={virtualizer.measureElement}
                                className="srch-row"
                                style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${v.start}px)` }}
                                role="row"
                                aria-rowindex={v.index + 2}
                            >
                                <div className="srch-grid">
                                    <div role="cell" className="srch-cell srch-cell--name">
                                        <span className={`srch-type srch-type--${doc.kind}`} aria-hidden="true">
                                            {doc.kind === 'pdf' ? 'PDF' : doc.kind === 'image' ? 'IMG' : 'FILE'}
                                        </span>
                                        <span className="text-truncate fw-semibold" title={doc.name}>{doc.name}</span>
                                    </div>
                                    <div role="cell" className="srch-cell" data-label="Category">
                                        <div>{doc.major || 'None'}</div>
                                        <div className="small text-muted">{doc.minor}</div>
                                    </div>
                                    <div role="cell" className="srch-cell" data-label="Date">{formatDate(doc.date)}</div>
                                    <div role="cell" className="srch-cell srch-cell--tags" data-label="Tags">
                                        {doc.tags.length ? doc.tags.map((t) => <span key={t} className="srch-mini-tag">{t}</span>) : <span className="text-muted small">No tags</span>}
                                    </div>
                                    <div role="cell" className="srch-cell srch-actions">
                                        <button type="button" className="btn btn-sm srch-btn-soft" onClick={() => onPreview(doc)} disabled={!doc.fileUrl} title={doc.fileUrl ? 'Preview' : 'No file attached'}>
                                            Preview
                                        </button>
                                        <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => onDownload(doc)} disabled={!doc.fileUrl || busy} title={doc.fileUrl ? 'Download' : 'No file attached'}>
                                            {busy ? <span className="spinner-border spinner-border-sm" role="status" aria-label="Downloading" /> : 'Download'}
                                        </button>
                                        {canDelete && (
                                            <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => onDelete(doc)}>Delete</button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
            <div className="srch-foot small text-muted">Rendering {items.length} of {docs.length.toLocaleString()} rows</div>
        </div>
    );
};

/* ---------------------------------------------------------------------------
   Preview modal
   --------------------------------------------------------------------------- */
const PreviewModal: React.FC<{ doc: DocumentItem; onClose: () => void }> = ({ doc, onClose }) => {
    const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; url?: string; message?: string }>({ status: 'loading' });
    const [attempt, setAttempt] = useState(0);
    const closeRef = useRef<HTMLButtonElement | null>(null);

    useEffect(() => {
        closeRef.current?.focus();
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        document.addEventListener('keydown', onKey);
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = previous;
        };
    }, [onClose]);

    useEffect(() => {
        if (doc.kind === 'other') return;
        const controller = new AbortController();
        let objectUrl = '';
        setState({ status: 'loading' });
        fetchFileBlob(doc, controller.signal)
            .then((blob) => {
                objectUrl = URL.createObjectURL(blob);
                setState({ status: 'ready', url: objectUrl });
            })
            .catch((e) => {
                if ((e as Error)?.name !== 'AbortError') setState({ status: 'error', message: messageOf(e) });
            });
        return () => {
            controller.abort();
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [doc, attempt]);

    return (
        <>
            <div className="modal-backdrop show" onClick={onClose} />
            <div className="modal d-block srch-modal" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="srchPreviewTitle" onClick={onClose}>
                <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable" onClick={(e) => e.stopPropagation()}>
                    <div className="modal-content border-0">
                        <div className="modal-header">
                            <h2 className="modal-title h6 text-truncate" id="srchPreviewTitle">{doc.name}</h2>
                            <button ref={closeRef} type="button" className="btn-close" aria-label="Close preview" onClick={onClose} />
                        </div>
                        <div className="modal-body srch-preview-body">
                            {doc.kind === 'other' ? (
                                <div className="srch-preview-msg" role="status">
                                    <div className="fs-1" aria-hidden="true">📎</div>
                                    <p className="mb-0">{UNSUPPORTED_MESSAGE}</p>
                                </div>
                            ) : state.status === 'loading' ? (
                                <div className="srch-preview-msg" role="status">
                                    <span className="spinner-border" aria-hidden="true" />
                                    <p className="mb-0">Loading preview...</p>
                                </div>
                            ) : state.status === 'error' ? (
                                <div className="srch-preview-msg" role="alert">
                                    <p className="mb-2 srch-inline-error">Couldn't load the preview. {state.message}</p>
                                    <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setAttempt((n) => n + 1)}>Try again</button>
                                </div>
                            ) : doc.kind === 'image' ? (
                                <img src={state.url} alt={doc.name} className="srch-preview-img" />
                            ) : (
                                <iframe src={state.url} title={`PDF preview of ${doc.name}`} className="srch-preview-frame" />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

/* ---------------------------------------------------------------------------
   Page
   --------------------------------------------------------------------------- */
type ZipState = { phase: 'idle' | 'fetching' | 'zipping'; done: number; total: number };

const SearchPage: React.FC = () => {
    const qc = useQueryClient();
    const [submitted, setSubmitted] = useState<Filters | null>(null);
    const [demo, setDemo] = useState<DocumentItem[] | null>(null);
    const [preview, setPreview] = useState<DocumentItem | null>(null);
    const [notice, setNotice] = useState<Notice>(null);
    const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});
    const [zip, setZip] = useState<ZipState>({ phase: 'idle', done: 0, total: 0 });
    const [online, setOnline] = useState(() => navigator.onLine);
    const zipAbort = useRef<AbortController | null>(null);

    useEffect(() => {
        const up = () => setOnline(true);
        const down = () => setOnline(false);
        window.addEventListener('online', up);
        window.addEventListener('offline', down);
        return () => {
            window.removeEventListener('online', up);
            window.removeEventListener('offline', down);
        };
    }, []);

    useEffect(() => {
        if (notice?.kind !== 'success') return;
        const t = setTimeout(() => setNotice(null), 5000);
        return () => clearTimeout(t);
    }, [notice]);

    useEffect(() => () => zipAbort.current?.abort(), []);

    const resultsQuery = useQuery({
        queryKey: [DOCS_KEY, submitted],
        queryFn: () => runSearch(submitted as Filters),
        enabled: submitted !== null && demo === null,
        staleTime: 30_000,
    });

    const result = resultsQuery.data;
    const docs: DocumentItem[] = demo ?? result?.documents ?? [];
    const searching = resultsQuery.isFetching && !demo;

    /* ----- optimistic delete with rollback (6.1) ----- */
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            await apiFetch(deleteEndpoint(id));
        },
        onMutate: async (id: string) => {
            // 1. stop in-flight searches for every filter combination
            await qc.cancelQueries({ queryKey: [DOCS_KEY] });
            // 2. snapshot every cached search, not just the active one
            const snapshots = qc.getQueriesData<SearchResult>({ queryKey: [DOCS_KEY] });
            // 3. remove the row everywhere immediately
            qc.setQueriesData<SearchResult>({ queryKey: [DOCS_KEY] }, (old) =>
                old ? { ...old, documents: old.documents.filter((d) => d.id !== id) } : old
            );
            return { snapshots };
        },
        onError: (error, _id, ctx) => {
            // 4. restore every snapshot
            ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data));
            setNotice({ kind: 'danger', text: `Couldn't delete the document, so it was put back. ${messageOf(error)}` });
        },
        onSuccess: (_data, id) => {
            removeFromCache(id);
            setNotice({ kind: 'success', text: 'Document deleted.' });
        },
        onSettled: () => {
            // 5. refetch to match the server
            void qc.invalidateQueries({ queryKey: [DOCS_KEY] });
        },
    });

    /* ----- handlers ----- */
    const handleSearch = (filters: Filters) => {
        setDemo(null);
        setNotice(null);
        if (submitted && filtersKey(submitted) === filtersKey(filters)) void resultsQuery.refetch();
        setSubmitted(filters);
    };

    const handleReset = () => {
        setSubmitted(null);
        setDemo(null);
        setNotice(null);
    };

    const downloadOne = async (doc: DocumentItem) => {
        setBusyIds((b) => ({ ...b, [doc.id]: true }));
        try {
            triggerDownload(await fetchFileBlob(doc), fileNameFor(doc));
        } catch (e) {
            setNotice({ kind: 'danger', text: `Couldn't download "${doc.name}". ${messageOf(e)}` });
        } finally {
            setBusyIds((b) => {
                const { [doc.id]: _omit, ...rest } = b;
                return rest;
            });
        }
    };

    const confirmDelete = (doc: DocumentItem) => {
        if (window.confirm(`Delete "${doc.name}"? This cannot be undone.`)) deleteMutation.mutate(doc.id);
    };

    const downloadAllAsZip = async () => {
        const targets = docs.filter((d) => d.fileUrl);
        if (!targets.length) return;
        if (targets.length > ZIP_CONFIRM_COUNT && !window.confirm(`This will download ${targets.length} files into one ZIP. It may take a while and use a lot of memory. Continue?`)) return;

        const controller = new AbortController();
        zipAbort.current = controller;
        setNotice(null);
        setZip({ phase: 'fetching', done: 0, total: targets.length });

        const files: { name: string; data: ArrayBuffer }[] = [];
        const failed: string[] = [];
        let next = 0;

        // files are fetched only now, after the user asked for the ZIP, a few at a time
        const lane = async () => {
            while (next < targets.length && !controller.signal.aborted) {
                const doc = targets[next++];
                try {
                    const blob = await fetchFileBlob(doc, controller.signal);
                    files.push({ name: fileNameFor(doc), data: await blob.arrayBuffer() });
                } catch (e) {
                    if (controller.signal.aborted) return;
                    failed.push(doc.name);
                }
                setZip((z) => ({ ...z, done: z.done + 1 }));
            }
        };

        try {
            await Promise.all(Array.from({ length: Math.min(ZIP_CONCURRENCY, targets.length) }, lane));
            if (controller.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
            if (!files.length) throw new Error('None of the files could be downloaded.');

            setZip((z) => ({ ...z, phase: 'zipping' }));
            const archive = await buildZipInWorker(files, controller.signal);
            const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
            triggerDownload(new Blob([Uint8Array.from(archive).buffer as ArrayBuffer], { type: 'application/zip' }), `documents-${stamp}.zip`);

            setNotice(
                failed.length
                    ? { kind: 'warning', text: `ZIP downloaded with ${files.length} files. ${failed.length} could not be fetched: ${failed.slice(0, 5).join(', ')}${failed.length > 5 ? ', and more' : ''}.` }
                    : { kind: 'success', text: `ZIP downloaded with ${files.length} files.` }
            );
        } catch (e) {
            if ((e as Error)?.name === 'AbortError') setNotice({ kind: 'warning', text: 'ZIP download cancelled.' });
            else setNotice({ kind: 'danger', text: `Couldn't build the ZIP. ${messageOf(e)}` });
        } finally {
            setZip({ phase: 'idle', done: 0, total: 0 });
            zipAbort.current = null;
        }
    };

    const zipBusy = zip.phase !== 'idle';
    const downloadable = docs.filter((d) => d.fileUrl).length;

    return (
        <div className="srch-page">
            <div className="srch-shell">
                <header className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-4">
                    <div>
                        <h1 className="h3 fw-bold mb-1 srch-title">Find documents</h1>
                        <p className="text-muted mb-0 small">Filter by category, tags and date, then preview or download.</p>
                    </div>
                    <span className={`srch-net ${online ? 'srch-net--on' : 'srch-net--off'}`}>
                        <span className="srch-net-dot" aria-hidden="true" />
                        {online ? 'Online' : 'Offline'}
                    </span>
                </header>

                {!isConfigured(API_BASE_URL) && (
                    <div className="alert alert-warning small">Setup needed: add the endpoint details from the Postman collection to the config block in DocumentSearch.tsx.</div>
                )}

                <SearchForm busy={searching} onSearch={handleSearch} onReset={handleReset} />

                {/* status area */}
                <div className="mt-4">
                    {notice && (
                        <div className={`alert alert-${notice.kind} d-flex align-items-start small`} role="alert">
                            <span className="flex-grow-1">{notice.text}</span>
                            <button type="button" className="btn-close btn-sm" aria-label="Dismiss" onClick={() => setNotice(null)} />
                        </div>
                    )}

                    {!demo && result?.fromCache && (
                        <div className="alert alert-warning d-flex flex-wrap align-items-center gap-2 small" role="status">
                            <span className="flex-grow-1">
                                <strong>Offline results.</strong> You're seeing results saved on {result.cachedAt ? new Date(result.cachedAt).toLocaleString() : 'an earlier visit'}, so they may be out of date.
                            </span>
                            <button type="button" className="btn btn-sm btn-outline-dark" onClick={() => resultsQuery.refetch()} disabled={searching}>
                                Retry search
                            </button>
                        </div>
                    )}

                    {!demo && result && result.skipped > 0 && (
                        <div className="alert alert-warning small" role="status">
                            {result.skipped} {result.skipped === 1 ? 'record was' : 'records were'} hidden because the server sent data in an unexpected format.
                        </div>
                    )}

                    {demo && (
                        <div className="alert alert-info d-flex flex-wrap align-items-center gap-2 small" role="status">
                            <span className="flex-grow-1"><strong>Demo data.</strong> {demo.length.toLocaleString()} sample records for testing the list. They are not from the server.</span>
                            <button type="button" className="btn btn-sm btn-outline-dark" onClick={() => setDemo(null)}>Exit demo</button>
                        </div>
                    )}

                    {!demo && resultsQuery.isError && (
                        <div className="alert alert-danger d-flex flex-wrap align-items-center gap-2 small" role="alert">
                            <span className="flex-grow-1">Search failed. {messageOf(resultsQuery.error)}</span>
                            <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => resultsQuery.refetch()}>Try again</button>
                        </div>
                    )}
                </div>

                {/* results */}
                {!demo && !submitted && (
                    <div className="srch-empty">
                        <div className="srch-empty-icon" aria-hidden="true">🔎</div>
                        <p className="fw-semibold mb-1">Ready when you are</p>
                        <p className="text-muted small mb-3">Choose filters and press Search. Leave them empty to see everything.</p>
                        <button type="button" className="btn btn-sm btn-link srch-link" onClick={() => setDemo(makeDemoDocuments(DEMO_COUNT))}>
                            Load {DEMO_COUNT.toLocaleString()} demo records to test the list
                        </button>
                    </div>
                )}

                {!demo && submitted && searching && docs.length === 0 && (
                    <div className="srch-empty" role="status">
                        <span className="spinner-border mb-3" aria-hidden="true" />
                        <p className="mb-0">Searching...</p>
                    </div>
                )}

                {!demo && submitted && !searching && !resultsQuery.isError && result && docs.length === 0 && (
                    <div className="srch-empty">
                        <div className="srch-empty-icon" aria-hidden="true">📭</div>
                        <p className="fw-semibold mb-1">No documents match these filters</p>
                        <p className="text-muted small mb-3">Try a wider date range or remove a tag.</p>
                        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={handleReset}>Clear filters</button>
                    </div>
                )}

                {docs.length > 0 && (
                    <section className="srch-results" aria-label="Results">
                        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
                            <h2 className="h6 fw-bold mb-0">
                                {docs.length.toLocaleString()} {docs.length === 1 ? 'document' : 'documents'}
                            </h2>
                            <div className="d-flex align-items-center gap-2">
                                {zipBusy && (
                                    <>
                                        <span className="small text-muted" role="status">
                                            {zip.phase === 'fetching' ? `Fetching files ${zip.done} of ${zip.total}` : 'Building ZIP...'}
                                        </span>
                                        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => zipAbort.current?.abort()}>Cancel</button>
                                    </>
                                )}
                                <button type="button" className="btn btn-sm srch-btn-primary" onClick={downloadAllAsZip} disabled={zipBusy || downloadable === 0}>
                                    {zipBusy ? <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" /> : null}
                                    Download all as ZIP{downloadable ? ` (${downloadable.toLocaleString()})` : ''}
                                </button>
                            </div>
                        </div>
                        {zipBusy && zip.phase === 'fetching' && (
                            <div className="progress srch-progress mb-3" aria-hidden="true">
                                <div className="progress-bar srch-progress-bar" style={{ width: `${zip.total ? (zip.done / zip.total) * 100 : 0}%` }} />
                            </div>
                        )}

                        <ResultsList
                            docs={docs}
                            busyIds={busyIds}
                            canDelete={CAN_DELETE && !demo}
                            onPreview={setPreview}
                            onDownload={downloadOne}
                            onDelete={confirmDelete}
                        />
                    </section>
                )}
            </div>

            {preview && <PreviewModal doc={preview} onClose={() => setPreview(null)} />}
        </div>
    );
};

/* The provider lives here so the file works on its own. If main.tsx already
   wraps the app in a QueryClientProvider, return <SearchPage /> directly. */
const DocumentSearch: React.FC = () => (
    <QueryClientProvider client={queryClient}>
        <SearchPage />
    </QueryClientProvider>
);

export default DocumentSearch;