
import * as yup from 'yup';

export const createUserSchema = yup.object({
  username: yup
    .string()
    .trim()
    .required('Username is required')
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must not exceed 30 characters'),

  password: yup
    .string()
    .required('Password is required')
    .min(8, 'Password must be at least 8 characters'),
});

export type CreateUserFormValues = yup.InferType<
  typeof createUserSchema
>;
