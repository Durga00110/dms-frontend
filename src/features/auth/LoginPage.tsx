import { useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  generateOtp,
  verifyOtp,
  getErrorMessage,
} from '../../services/authService';

// Bootstrap must load BEFORE our own CSS so our overrides win.
import 'bootstrap/dist/css/bootstrap.min.css';
import './LoginPage.css';

const LoginPage = () => {
  const [mobileNumber, setMobileNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [start, setStart] = useState('request');
  const navigate = useNavigate();

  const sendOtpMutation = useMutation({
    mutationFn: generateOtp,
  });

  const verifyOtpMutation = useMutation({
    mutationFn: verifyOtp,
     onSuccess: () => {
      navigate('/search', { replace: true });
    },
  });

  const handleSendCode = (e: FormEvent) => {
    e.preventDefault();
    console.log('Sending OTP to mobile number:', mobileNumber);
    sendOtpMutation.mutate({ mobile_number: mobileNumber });
  };

  const handleVerifyCode = (e: FormEvent) => {
    e.preventDefault();
    console.log('Verifying code:', verificationCode);
    verifyOtpMutation.mutate({
      mobile_number: mobileNumber,
      otp: verificationCode,
    });
  };

  // Step 2 appears once the OTP has been sent successfully
  const otpSent = sendOtpMutation.isSuccess;

  return (
    <div className="login-page min-vh-100 d-flex align-items-center justify-content-center p-3">
      <div className="login-card p-4 p-sm-5">
        {/* Logo */}
        <div className="login-logo d-flex align-items-center justify-content-center mb-4">
          A
        </div>

        {/* Heading */}
        <h1 className="login-title mb-2">Welcome back</h1>
        <p className="login-subtitle mb-4">
          {otpSent
            ? `Enter the code we sent to ${mobileNumber}.`
            : "Enter your mobile number and we'll send you a one-time code."}
        </p>

        {/* Step 1: Mobile number */}
        <form onSubmit={handleSendCode} noValidate>
          <div className="mb-3">
            <label
              htmlFor="mobileNumber"
              className="login-label form-label"
            >
              Mobile number
            </label>
            <input
              type="tel"
              id="mobileNumber"
              name="mobileNumber"
              className="login-input form-control form-control-lg py-3"
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value)}
              placeholder="98765 43210"
              autoComplete="tel"
              inputMode="numeric"
              disabled={sendOtpMutation.isPending}
            />
          </div>

          <button
            type="submit"
            className="btn btn-brand btn-lg w-100 py-3"
            disabled={sendOtpMutation.isPending || !mobileNumber.trim()}
          >
            {sendOtpMutation.isPending ? (
              <>
                <span
                  className="spinner-border spinner-border-sm login-spinner"
                  role="status"
                  aria-hidden="true"
                />
                Sending...
              </>
            ) : otpSent ? (
              'Resend code'
            ) : (
              'Send code'
            )}
          </button>

          {sendOtpMutation.isSuccess && (
            <div className="alert alert-success py-2 mt-3 mb-0" role="alert">
              Verification code sent successfully.
            </div>
          )}

          {sendOtpMutation.isError && (
            <div className="alert alert-danger py-2 mt-3 mb-0" role="alert">
              {getErrorMessage(sendOtpMutation.error)}
            </div>
          )}
        </form>

        {/* Step 2: Verification code */}
        {otpSent && (
          <form onSubmit={handleVerifyCode} className="mt-4" noValidate>
            <div className="mb-3">
              <label
                htmlFor="verificationCode"
                className="login-label form-label"
              >
                Verification code
              </label>
              <input
                type="text"
                id="verificationCode"
                name="verificationCode"
                className="login-input form-control form-control-lg py-3"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="Enter verification code"
                autoComplete="one-time-code"
                inputMode="numeric"
                disabled={verifyOtpMutation.isPending}
              />
            </div>

            <button
              type="submit"
              className="btn btn-brand btn-lg w-100 py-3"
              disabled={
                verifyOtpMutation.isPending || !verificationCode.trim()
              }
            >
              {verifyOtpMutation.isPending ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm login-spinner"
                    role="status"
                    aria-hidden="true"
                  />
                  Verifying...
                </>
              ) : (
                'Verify code'
              )}
            </button>

            {verifyOtpMutation.isError && (
              <div className="alert alert-danger py-2 mt-3 mb-0" role="alert">
                {getErrorMessage(verifyOtpMutation.error)}
              </div>
            )}

            {verifyOtpMutation.isSuccess && (
              <div className="alert alert-success py-2 mt-3 mb-0" role="alert">
                Verified successfully.
              </div>
            )}
          </form>
        )}

        {/* Footer */}
        <p className="login-footer text-center small mt-4 mb-0">
          Secured with one-time passcode
        </p>
      </div>
    </div>
  );
};

export default LoginPage;