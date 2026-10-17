
import type { DocumentItem, FileKind } from "../types/documentSearch";
import type { DocumentItem as ApiDocumentItem } from "../services/documentSearchService";

export const PERSONAL_NAMES = ["John", "Tom", "Emily", "Priya"];

export const PROFESSIONAL_DEPTS = [
  "Accounts",
  "HR",
  "IT",
  "Finance",
];

export const KIND_LABEL: Record<FileKind, string> = {
  pdf: "PDF",
  image: "IMG",
  other: "FILE",
};

export const formatDateForApi = (date: string): string => {
  if (!date) return "";

  const [year, month, day] = date.split("-");
  return `${day}-${month}-${year}`;
};

export const getFileKind = (fileName: string): FileKind => {
  const extension = fileName.split(".").pop()?.toLowerCase();

  if (extension === "pdf") return "pdf";

  if (["png", "jpg", "jpeg", "gif", "webp"].includes(extension ?? "")) {
    return "image";
  }

  return "other";
};

export const getDocumentName = (doc: ApiDocumentItem): string => {
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

export const mapDocument = (doc: ApiDocumentItem): DocumentItem => {
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
