
import type { FormEvent } from 'react';

/** Login form state. */
export interface LoginFormValues {
  mobileNumber: string;
  verificationCode: string;
}

/** Payload used when requesting an OTP. */
export interface GenerateOtpPayload {
  mobile_number: string;
}

/** Payload used when verifying an OTP. */
export interface VerifyOtpPayload {
  mobile_number: string;
  otp: string;
}

/** Login page step. */
export type LoginStep = 'request' | 'verify';

/** Form submission event. */
export type LoginFormSubmitEvent = FormEvent<HTMLFormElement>;
