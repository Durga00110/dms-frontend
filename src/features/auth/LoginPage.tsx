import { useState } from "react";
import type {
  LoginStep,
  LoginFormSubmitEvent,
} from "../../types/loginPage.types";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  generateOtp,
  verifyOtp,
  getErrorMessage,
} from "../../services/authService";
import {
  mobileNumberSchema,
  verificationCodeSchema,
} from "../../validations/loginPage.validation";
import * as yup from "yup";

// Bootstrap must load BEFORE our own CSS so our overrides win.
import "bootstrap/dist/css/bootstrap.min.css";
import "./LoginPage.css";

const LoginPage = () => {
  const [mobileNumber, setMobileNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [mobileError, setMobileError] = useState("");
  const [verificationCodeError, setVerificationCodeError] = useState("");
  const [start, setStart] = useState<LoginStep>("request");
  const navigate = useNavigate();

  const sendOtpMutation = useMutation({
    mutationFn: generateOtp,
    onSuccess: () => {
      setStart("verify");
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: verifyOtp,
    onSuccess: () => {
      navigate("/admin", { replace: true });
    },
  });

  const handleSendCode = async (e: LoginFormSubmitEvent) => {
    e.preventDefault();
    setMobileError("");

    try {
      await mobileNumberSchema.validate({ mobileNumber }, { abortEarly: true });

      sendOtpMutation.mutate({
        mobile_number: mobileNumber,
      });
    } catch (error) {
      if (error instanceof yup.ValidationError) {
        setMobileError(error.message);
      }
    }
  };

  const handleVerifyCode = async (e: LoginFormSubmitEvent) => {
    e.preventDefault();
    setVerificationCodeError("");

    try {
      await verificationCodeSchema.validate(
        { verificationCode },
        { abortEarly: true },
      );

      verifyOtpMutation.mutate({
        mobile_number: mobileNumber,
        otp: verificationCode,
      });
    } catch (error) {
      if (error instanceof yup.ValidationError) {
        setVerificationCodeError(error.message);
      }
    }
  };

  // Step 2 appears once the OTP has been sent successfully
  const otpSent = sendOtpMutation.isSuccess;

  return (
    <div className="login-page min-vh-100 d-flex align-items-center justify-content-center p-3">
      <div className="login-card p-4 p-sm-5">
        {start === "request" && (
          <>
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
                  required
                />
                {mobileError && (
                  <div className="text-danger small mt-1" role="alert">
                    {mobileError}
                  </div>
                )}
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
                  "Resend code"
                ) : (
                  "Send code"
                )}
              </button>

              {sendOtpMutation.isSuccess && (
                <div
                  className="alert alert-success py-2 mt-3 mb-0"
                  role="alert"
                >
                  Verification code sent successfully.
                </div>
              )}

              {sendOtpMutation.isError && (
                <div className="alert alert-danger py-2 mt-3 mb-0" role="alert">
                  {getErrorMessage(sendOtpMutation.error)}
                </div>
              )}
            </form>
          </>
        )}

        {/* Step 2: Verification code */}
        {start === "verify" && (
          <>
            <p className="login-subtitle mb-4">
              {otpSent
                ? `Enter the code we sent to ${mobileNumber}.`
                : "Enter your mobile number and we'll send you a one-time code."}
            </p>
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
                  onChange={(e) => {
                    setVerificationCode(e.target.value);
                    setVerificationCodeError("");
                  }}
                  placeholder="Enter verification code"
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  disabled={verifyOtpMutation.isPending}
                  required
                />
                {verificationCodeError && (
                  <div className="text-danger small mt-1" role="alert">
                    {verificationCodeError}
                  </div>
                )}
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
                  "Verify code"
                )}
              </button>

              {verifyOtpMutation.isError && (
                <div className="alert alert-danger py-2 mt-3 mb-0" role="alert">
                  {getErrorMessage(verifyOtpMutation.error)}
                </div>
              )}

              {verifyOtpMutation.isSuccess && (
                <div
                  className="alert alert-success py-2 mt-3 mb-0"
                  role="alert"
                >
                  Verified successfully.
                </div>
              )}
              <button
                type="button"
                className="btn secondary btn-link btn-sm mt-3"
                onClick={() => {
                  setStart("request");
                  setVerificationCode("");
                  setMobileError("");
                  setVerificationCodeError("");
                  sendOtpMutation.reset();
                  verifyOtpMutation.reset();
                }}
              >
                Edit mobile number
              </button>
            </form>
          </>
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
