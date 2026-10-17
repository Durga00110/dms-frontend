
import * as yup from 'yup';

export const mobileNumberSchema = yup.object({
  mobileNumber: yup
    .string()
    .required('Mobile number is required')
    .matches(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
});

export const verificationCodeSchema = yup.object({
  verificationCode: yup
    .string()
    .required('Verification code is required')
    .matches(/^\d+$/, 'Verification code must contain only digits'),
});
