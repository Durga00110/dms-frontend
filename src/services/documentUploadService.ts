const BASE_URL = import.meta.env.VITE_API_BASE_URL;

export interface UploadDocumentInput {
  file: File;
  majorHead: string;
  minorHead: string;
  date: string; // YYYY-MM-DD, straight from <input type="date">
  remarks: string;
  tags: string[];
  userId: string;
  token: string;
}

export interface UploadDocumentResult {
  // The Postman entry has no saved response, so the shape is unknown.
  // Check a real response in Postman and replace this with the actual fields.
  [key: string]: unknown;
}

/** "2024-02-12" -> "12-02-2024" (the API expects DD-MM-YYYY) */
const toApiDate = (isoDate: string) => {
  const [y, m, d] = isoDate.split('-');
  return `${d}-${m}-${y}`;
};

export const uploadDocument = async ({
  file,
  majorHead,
  minorHead,
  date,
  remarks,
  tags,
  userId,
  token,
}: UploadDocumentInput): Promise<UploadDocumentResult> => {
  const payload = {
    major_head: majorHead,
    minor_head: minorHead,
    document_date: toApiDate(date),
    document_remarks: remarks,
    tags: tags.map((tag_name) => ({ tag_name })),
    user_id: userId,
  };

  const formData = new FormData();
  formData.append('file', file);
  formData.append('data', JSON.stringify(payload));

  // Do NOT set Content-Type: the browser adds the multipart boundary itself.
  const res = await fetch(`${BASE_URL}/saveDocumentEntry`, {
    method: 'POST',
    headers: { token },
    body: formData,
  });

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // response wasn't JSON
  }

  if (!res.ok) {
    const message =
      (body as { message?: string } | null)?.message ??
      `Upload failed (${res.status})`;
    throw new Error(message);
  }

  return (body ?? {}) as UploadDocumentResult;
};