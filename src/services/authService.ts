import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ---------- Token storage ----------
const TOKEN_KEY = 'token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token: string) => localStorage.setItem(TOKEN_KEY, token);
export const setUser = (user_id: string) => localStorage.setItem(user_id, user_id )
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

// Attach the token to every outgoing request.
// Change `Bearer` if your backend expects a different scheme or header name.
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// endpoint constants for the API requests
const REQUEST_OTP_URL = '/generateOTP';
const VERIFY_OTP_URL = '/validateOTP';

// Update the property names to match your API request bodies.
export interface GenerateOtpPayload {
  mobile_number: string;
}

export interface VerifyOtpPayload {
  mobile_number: string;
  otp: string;
}

// Shape of every API response:
//   success -> { status: true,  data: <payload> }
//   failure -> { status: false, data: "<message>" }
export type ApiResponse<T> =
  | { status: true | 'true'; data: T }
  | { status: false | 'false'; data: string };

// Adjust these to match the `data` payload of your successful responses.
export interface GenerateOtpData {
  message?: string;
  [key: string]: unknown;
}

export interface VerifyOtpData {
  token?: string;
  accessToken?: string;
  user?: Record<string, unknown>;
  [key: string]: unknown;
}

// Error thrown when the API replies with status: false.
export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

const DEFAULT_ERROR = 'Invalid Otp. Please try again.';

const isFailure = (res: ApiResponse<unknown>) =>
  res.status === false || res.status === 'false';

// Unwraps the response: returns `data` on success, throws ApiError on status: false.
// Throwing means React Query's onError / isError / error handle it for us.
const unwrap = <T>(res: ApiResponse<T>): T => {
  if (isFailure(res)) {
    throw new ApiError(
      typeof res.data === 'string' && res.data ? res.data : DEFAULT_ERROR
    );
  }
  return res.data as T;
};

// Turns any thrown value into a user-friendly message.
export const getErrorMessage = (error: unknown): string => {
  // status: false from a 200 response (thrown by unwrap)
  if (error instanceof ApiError) return error.message;

  if (axios.isAxiosError(error)) {
    // Server replied with an error status (4xx/5xx), possibly in our { status, data } format
    const body = error.response?.data as Partial<ApiResponse<unknown>> | undefined;
    if (body && typeof body.data === 'string' && body.data) return body.data;

    // Request was sent but no response came back
    if (!error.response) return 'Network error. Check your connection and try again.';
  }

  return DEFAULT_ERROR;
};

export const generateOtp = async (
  payload: GenerateOtpPayload
): Promise<GenerateOtpData> => {
  const response = await api.post<ApiResponse<GenerateOtpData>>(
    REQUEST_OTP_URL,
    payload
  );

  return unwrap(response.data);
};

export const verifyOtp = async (
  payload: VerifyOtpPayload
): Promise<VerifyOtpData> => {
  const response = await api.post<ApiResponse<VerifyOtpData>>(
    VERIFY_OTP_URL,
    payload
  );

  const data = unwrap(response.data);
  if (typeof data.user_id === 'string') setUser(data.user_id);
  // Save the token so the request interceptor can send it from now on
  const token = data.token ?? data.accessToken;

  if (token) setToken(token);
  return data;
};

export default api;