
import type { SearchDocumentPayload } from "../services/documentSearchService";

export type FileKind = "pdf" | "image" | "other";

export interface DocumentItem {
  id: string;
  name: string;
  major: string;
  minor: string;
  date: string;
  tags: string[];
  kind: FileKind;
  fileUrl: string;
}

export interface SearchFormProps {
  onSearch: (payload: SearchDocumentPayload) => void;
  onReset: () => void;
  isPending: boolean;
}

export interface TagInputProps {
  id: string;
  value: string[];
  onChange: (tags: string[]) => void;
}

export interface ResultsListProps {
  docs: DocumentItem[];
  total: number;
  onPreview: (doc: DocumentItem) => void;
}

export interface PreviewModalProps {
  doc: DocumentItem;
  onClose: () => void;
}
