const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const SEARCH_DOCUMENT_URL =
  `${API_BASE_URL}/searchDocumentEntry`;

export interface DocumentTag {
  tag_name: string;
}

export interface SearchDocumentPayload {
  major_head: string;
  minor_head: string;
  from_date: string;
  to_date: string;
  tags: DocumentTag[];
  uploaded_by: string;
  start: number;
  length: number;
  filterId: string;
  search: {
    value: string;
  };
}

export interface DocumentItem {
  document_id: number;
  major_head: string;
  minor_head: string;
  file_url: string;
  document_date?: string;
  document_remarks?: string;
  tags?: DocumentTag[];
  uploaded_by?: string;
  [key: string]: unknown;
}

export interface SearchDocumentResponse {
  status: boolean;
  data: DocumentItem[];
  recordsTotal: number;
  recordsFiltered: number;
}

interface SearchDocumentParams {
  payload: SearchDocumentPayload;
  token: string;
}

export const searchDocuments = async ({
  payload,
  token,
}: SearchDocumentParams): Promise<SearchDocumentResponse> => {
  const response = await fetch(SEARCH_DOCUMENT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      token,
    },
    body: JSON.stringify(payload),
  });

  const result: SearchDocumentResponse = await response.json();

  if (!response.ok || result.status === false) {
    throw new Error('Failed to search documents');
  }

  return result;
};
