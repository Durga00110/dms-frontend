import * as yup from 'yup';

export const MAX_REMARKS = 500;
export const MAX_FILE_MB = 10;

/* ---------------------------------------------------------------------------
   Types
   --------------------------------------------------------------------------- */

export type UploadFormValues = {
  date: string;
  major: string;
  minor: string;
  tags: string[];
  remarks: string;
  file: File | null;
};

export type FieldName = keyof UploadFormValues;
export type FieldErrors = Partial<Record<FieldName, string>>;

// Order used to find the first invalid field on submit.
export const FIELD_ORDER: FieldName[] = ['date', 'major', 'minor', 'tags', 'remarks', 'file'];

// DOM ids of each field, used to focus the first invalid one.
export const FIELD_IDS: Record<FieldName, string> = {
  date: 'docDate',
  major: 'majorHead',
  minor: 'minorHead',
  tags: 'tagInput',
  remarks: 'remarks',
  file: 'docFile',
};

/* ---------------------------------------------------------------------------
   Schema
   --------------------------------------------------------------------------- */

export const uploadSchema = yup.object({
  date: yup.string().required('Please choose a document date.'),

  major: yup
    .string()
    .required('Please select a category.')
    .oneOf(['Personal', 'Professional'], 'Please select a valid category.'),

  minor: yup.string().when('major', ([major], schema) =>
    schema.required(
      major === 'Professional'
        ? 'Please select a department.'
        : major === 'Personal'
          ? 'Please select a name.'
          : 'Please select a name or department.',
    ),
  ),

  tags: yup.array().of(yup.string().required()).default([]),

  remarks: yup
    .string()
    .max(MAX_REMARKS, `Remarks must be ${MAX_REMARKS} characters or fewer.`)
    .default(''),

  file: yup
    .mixed<File>()
    .nullable()
    .required('Please choose a file to upload.')
    .test(
      'file-type',
      'Only images and PDF files are allowed.',
      (f) => !f || f.type === 'application/pdf' || f.type.startsWith('image/'),
    )
    .test(
      'file-size',
      `File must be ${MAX_FILE_MB} MB or smaller.`,
      (f) => !f || f.size <= MAX_FILE_MB * 1024 * 1024,
    ),
});

/* ---------------------------------------------------------------------------
   Helpers: return plain error messages so components never touch Yup directly
   --------------------------------------------------------------------------- */

/** Validate one field. Returns its error message, or undefined if valid. */
export const validateUploadField = async (
  name: FieldName,
  values: UploadFormValues,
): Promise<string | undefined> => {
  try {
    await uploadSchema.validateAt(name, values);
    return undefined;
  } catch (err) {
    if (err instanceof yup.ValidationError) return err.message;
    throw err;
  }
};

/** Validate the whole form. Returns the first error message per field. */
export const validateUploadForm = async (values: UploadFormValues): Promise<FieldErrors> => {
  try {
    await uploadSchema.validate(values, { abortEarly: false });
    return {};
  } catch (err) {
    if (!(err instanceof yup.ValidationError)) throw err;
    const errors: FieldErrors = {};
    err.inner.forEach((e) => {
      const key = e.path as FieldName | undefined;
      if (key && !errors[key]) errors[key] = e.message;
    });
    return errors;
  }
};