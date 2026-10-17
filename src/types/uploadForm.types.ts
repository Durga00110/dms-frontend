
import type { ChangeEvent, DragEvent, FormEvent, KeyboardEvent } from 'react';

/** Props for the tag input component. */
export interface TagInputProps {
  id: string;
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions: string[];
}

/** Props for the file dropzone component. */
export interface FileDropzoneProps {
  file: File | null;
  onChange: (file: File | null) => void;
}

/** Values required to validate the upload form. */
export interface UploadFormValues {
  date: string;
  major: string;
  minor: string;
  file: File | null;
}

/** Payload passed to the document upload service. */
export interface UploadDocumentPayload {
  file: File;
  majorHead: string;
  minorHead: string;
  date: string;
  remarks: string;
  tags: string[];
  userId: string;
  token: string;
}

/** Constants and input-related types used by form handlers. */
export type UploadInputChangeEvent = ChangeEvent<HTMLInputElement>;
export type UploadFileDropEvent = DragEvent<HTMLLabelElement>;
export type UploadFormSubmitEvent = FormEvent<HTMLFormElement>;
export type UploadTagKeyboardEvent = KeyboardEvent<HTMLInputElement>;
