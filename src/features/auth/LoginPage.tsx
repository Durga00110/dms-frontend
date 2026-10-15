import React, { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import './LoginPage.css';

/* ---------------------------------------------------------------------------
   API CONFIG: copy these from the Postman collection. Nothing here is invented.
   --------------------------------------------------------------------------- */
const PLACEHOLDER = 'FILL_FROM_POSTMAN';
const API_BASE_URL = PLACEHOLDER;
const REQUEST_OTP = { method: 'POST', path: PLACEHOLDER };
const VERIFY_OTP = { method: 'POST', path: PLACEHOLDER }; // the "OTP validation" request
const FIELDS = { mobile: PLACEHOLDER, otp: PLACEHOLDER }; // request body keys
const TOKEN_PATH = PLACEHOLDER; // where the token sits in the validation response, e.g. "data.token"

const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;
// The token is saved here. Send it with every later request, using the header
// name/format shown in the Postman collection's Auth tab.
const TOKEN_KEY = 'auth_token';

const isConfigured = (value: string) => value !== PLACEHOLDER;

/* ---------------------------------------------------------------------------
   Zod schemas (assignment 6.4: validate form data, payloads and responses)
   --------------------------------------------------------------------------- */
const mobileSchema = z.string().regex(/^[0-9]{10}$/, 'Enter a valid 10-digit mobile number.');
const otpSchema = z.string().regex(new RegExp(`^[0-9]{${OTP_LENGTH}}$`), `Enter the ${OTP_LENGTH}-digit code.`);
const payloadSchema = z.record(z.string(), z.string().min(1));
const responseSchema = z.record(z.string(), z.unknown());
const tokenSchema = z.string().min(1, 'The server did not return a token.');

const firstIssue = (error: z.ZodError) => error.issues[0]?.message ?? 'Invalid input.';

/* ---------------------------------------------------------------------------
   API helper
   --------------------------------------------------------------------------- */
async function callApi(
    endpoint: { method: string; path: string },
    body: Record<string, string>
): Promise<Record<string, unknown>> {
    if (!isConfigured(API_BASE_URL) || !isConfigured(endpoint.path)) {
        throw new Error('API details are not set. Copy them from the Postman collection into the config block.');
    }

    // validate the outgoing payload before sending it
    const payload = payloadSchema.safeParse(body);
    if (!payload.success) throw new Error(firstIssue(payload.error));

    let res: Response;
    try {
        res = await fetch(`${API_BASE_URL}${endpoint.path}`, {
            method: endpoint.method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload.data),
        });
    } catch {
        throw new Error('Network error. Check your connection and try again.');
    }

    let data: any = null;
    try {
        data = await res.json();
    } catch {
        /* empty or non-JSON body */
    }

    if (!res.ok) {
        const err: any = new Error(data?.message || data?.error || `Request failed (${res.status})`);
        err.status = res.status;
        throw err;
    }

    // validate the response shape instead of trusting it
    const parsed = responseSchema.safeParse(data ?? {});
    if (!parsed.success) throw new Error('Unexpected response from the server.');
    return parsed.data;
}

const getByPath = (obj: unknown, path: string): unknown =>
    path.split('.').reduce<any>((acc, key) => (acc == null ? undefined : acc[key]), obj);

/* ---------------------------------------------------------------------------
   Component
   --------------------------------------------------------------------------- */
interface LoginPageProps {
    onLoggedIn?: (token: string) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLoggedIn }) => {
    const [step, setStep] = useState<'phone' | 'otp'>('phone');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [otpInvalid, setOtpInvalid] = useState(false);
    const [secondsLeft, setSecondsLeft] = useState(0);
    const boxes = useRef<Array<HTMLInputElement | null>>([]);

    const phoneValid = mobileSchema.safeParse(phoneNumber).success;
    const otpValue = otp.join('');

    // resend countdown
    useEffect(() => {
        if (secondsLeft <= 0) return;
        const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
        return () => clearTimeout(t);
    }, [secondsLeft]);

    useEffect(() => {
        if (step === 'otp') boxes.current[0]?.focus();
    }, [step]);

    const handleSendOtp = async (e?: React.FormEvent) => {
        e?.preventDefault();
        const check = mobileSchema.safeParse(phoneNumber);
        if (!check.success) {
            setError(firstIssue(check.error));
            return;
        }
        setLoading(true);
        setError('');
        try {
            await callApi(REQUEST_OTP, { [FIELDS.mobile]: check.data });
            setOtp(Array(OTP_LENGTH).fill(''));
            setOtpInvalid(false);
            setStep('otp');
            setSecondsLeft(RESEND_SECONDS);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async (e?: React.FormEvent) => {
        e?.preventDefault();
        const check = otpSchema.safeParse(otpValue);
        if (!check.success) {
            setError(firstIssue(check.error));
            return;
        }
        setLoading(true);
        setError('');
        setOtpInvalid(false);
        try {
            const data = await callApi(VERIFY_OTP, {
                [FIELDS.mobile]: phoneNumber,
                [FIELDS.otp]: check.data,
            });
            if (!isConfigured(TOKEN_PATH)) {
                throw new Error('TOKEN_PATH is not set. Copy it from the Postman validation response.');
            }
            const token = tokenSchema.safeParse(getByPath(data, TOKEN_PATH));
            if (!token.success) throw new Error(firstIssue(token.error));

            localStorage.setItem(TOKEN_KEY, token.data);
            onLoggedIn?.(token.data);
            
        } catch (err) {
            const status = (err as any).status;
            if ([400, 401, 403, 422].includes(status)) {
                setError("That code didn't work. Check the digits or request a new one.");
                setOtpInvalid(true);
                setOtp(Array(OTP_LENGTH).fill(''));
                boxes.current[0]?.focus();
            } else {
                setError((err as Error).message);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleOtpChange = (i: number, raw: string) => {
        const digits = raw.replace(/\D/g, '');
        setError('');
        setOtpInvalid(false);
        if (digits.length > 1) {
            // paste or autofill
            const next = Array(OTP_LENGTH).fill('');
            digits.slice(0, OTP_LENGTH).split('').forEach((d, idx) => (next[idx] = d));
            setOtp(next);
            boxes.current[Math.min(digits.length, OTP_LENGTH - 1)]?.focus();
            return;
        }
        const next = [...otp];
        next[i] = digits;
        setOtp(next);
        if (digits && i < OTP_LENGTH - 1) boxes.current[i + 1]?.focus();
    };

    const handleOtpKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !otp[i] && i > 0) boxes.current[i - 1]?.focus();
        if (e.key === 'ArrowLeft') boxes.current[i - 1]?.focus();
        if (e.key === 'ArrowRight') boxes.current[i + 1]?.focus();
    };

    return (
        <div className="login-bg d-flex align-items-center justify-content-center p-3">
            <div className="card login-card border-0 shadow-lg w-100">
                <div className="card-body p-4 p-sm-5">
                    {/* Header */}
                    <div className="text-center mb-4">
                        <div className="login-badge d-inline-flex align-items-center justify-content-center mb-3">
                            <span className="fs-2" role="img" aria-label={step === 'phone' ? 'phone' : 'lock'}>
                                {step === 'phone' ? '📱' : '🔐'}
                            </span>
                        </div>
                        <h2 className="fw-bold mb-1">{step === 'phone' ? 'Welcome back' : 'Check your messages'}</h2>
                        <p className="text-muted mb-0">
                            {step === 'phone' ? (
                                'Enter your mobile number to get a otp.'
                            ) : (
                                <>
                                    We sent a {OTP_LENGTH}-digit code to <strong className="text-dark">+91 {phoneNumber}</strong>
                                </>
                            )}
                        </p>
                    </div>

                    {/* Progress */}
                    <div className="progress login-progress mb-4" aria-hidden="true">
                        <div className="progress-bar login-progress-bar" style={{ width: step === 'phone' ? '50%' : '100%' }} />
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="alert alert-danger d-flex align-items-start py-2 small" role="alert">
                            <span className="me-2">⚠️</span>
                            <span>{error}</span>
                        </div>
                    )}

                    {step === 'phone' ? (
                        <form onSubmit={handleSendOtp} noValidate>
                            <label htmlFor="phoneNumber" className="form-label fw-semibold">
                                Mobile number
                            </label>
                            <div className="input-group input-group-lg mb-4">
                                <span className="input-group-text bg-light fw-semibold text-primary">+91</span>
                                <input
                                    type="tel"
                                    inputMode="numeric"
                                    className={`form-control ${phoneNumber && !phoneValid ? 'is-invalid' : ''} ${phoneValid ? 'is-valid' : ''}`}
                                    id="phoneNumber"
                                    value={phoneNumber}
                                    maxLength={10}
                                    autoComplete="tel-national"
                                    autoFocus
                                    placeholder="98765 43210"
                                    onChange={(e) => {
                                        setPhoneNumber(e.target.value.replace(/\D/g, ''));
                                        setError('');
                                    }}
                                />
                                <div className="invalid-feedback">Enter a 10-digit mobile number.</div>
                            </div>

                            <button type="submit" className="btn btn-gradient btn-lg w-100" disabled={loading || !phoneValid}>
                                {loading ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                                        Sending code...
                                    </>
                                ) : (
                                    'Send OTP'
                                )}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleVerifyOtp} noValidate>
                            <div
                                className={`otp-row mb-4 ${otpInvalid ? 'login-shake' : ''}`}
                                key={otpInvalid ? 'bad' : 'ok'}
                                role="group"
                                aria-label="One-time password"
                            >
                                {otp.map((digit, i) => (
                                    <input
                                        key={i}
                                        ref={(el) => {
                                            boxes.current[i] = el;
                                        }}
                                        type="text"
                                        inputMode="numeric"
                                        autoComplete={i === 0 ? 'one-time-code' : 'off'}
                                        className={`form-control otp-input ${digit ? 'otp-input--filled' : ''} ${otpInvalid ? 'is-invalid' : ''}`}
                                        value={digit}
                                        maxLength={OTP_LENGTH}
                                        disabled={loading}
                                        aria-label={`Digit ${i + 1}`}
                                        onChange={(e) => handleOtpChange(i, e.target.value)}
                                        onKeyDown={(e) => handleOtpKeyDown(i, e)}
                                        onFocus={(e) => e.target.select()}
                                    />
                                ))}
                            </div>

                            <button
                                type="submit"
                                className="btn btn-gradient btn-lg w-100"
                                disabled={loading || otpValue.length !== OTP_LENGTH}
                            >
                                {loading ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                                        Verifying...
                                    </>
                                ) : (
                                    'Verify and sign in'
                                )}
                            </button>

                            <div className="d-flex justify-content-between align-items-center mt-4 small">
                                <button
                                    type="button"
                                    className="btn btn-link login-link p-0"
                                    onClick={() => {
                                        setStep('phone');
                                        setError('');
                                    }}
                                >
                                    ← Change number
                                </button>
                                {secondsLeft > 0 ? (
                                    <span className="text-muted">
                                        Resend in <strong>{secondsLeft}s</strong>
                                    </span>
                                ) : (
                                    <button type="button" className="btn btn-link login-link p-0" onClick={() => handleSendOtp()} disabled={loading}>
                                        Send a new code
                                    </button>
                                )}
                            </div>
                        </form>
                    )}

                    {/* {!isConfigured(API_BASE_URL) && (
                        <div className="alert alert-warning small mt-4 mb-0">
                            Setup needed: add the endpoint details from the Postman collection to the config block in LoginPage.tsx.
                        </div>
                    )} */}
                </div>
            </div>
        </div>
    );
};

export default LoginPage;