
import { useState } from 'react';
import type { FormEvent } from 'react';
import * as yup from 'yup';

import { createUserSchema } from '../validations/createUser.validation';

// Bootstrap must load BEFORE our own CSS so our overrides win.
import 'bootstrap/dist/css/bootstrap.min.css';
import './CreateUser.css';

const CreateUser = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [errors, setErrors] = useState<{
    username?: string;
    password?: string;
  }>({});

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitted(false);
    setErrors({});

    try {
      await createUserSchema.validate(
        { username, password },
        { abortEarly: false }
      );

      // Static screen: connect your create-user API here later.
      setSubmitted(true);
      setUsername('');
      setPassword('');
      setShowPassword(false);
      setErrors({});
    } catch (error) {
      if (error instanceof yup.ValidationError) {
        const validationErrors: {
          username?: string;
          password?: string;
        } = {};

        error.inner.forEach((validationError) => {
          const field = validationError.path;

          if (
            (field === 'username' || field === 'password') &&
            !validationErrors[field]
          ) {
            validationErrors[field] = validationError.message;
          }
        });

        setErrors(validationErrors);
      }
    }
  };

  const handleChange = (field: 'username' | 'password') => {
    setSubmitted(false);
    setErrors((prev) => ({
      ...prev,
      [field]: undefined,
    }));
  };

  return (
    <div className="admin-page min-vh-100 d-flex align-items-center justify-content-center p-3">
      <div className="admin-card p-4 p-sm-5">
        <h1 className="admin-title mb-2">Create user</h1>

        <p className="admin-subtitle mb-4">
          Add a new user by choosing a username and password.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          {/* Username */}
          <div className="mb-3">
            <label htmlFor="username" className="admin-label form-label">
              Username
            </label>

            <input
              type="text"
              id="username"
              name="username"
              className="admin-input form-control form-control-lg py-3"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                handleChange('username');
              }}
              placeholder="e.g. nitin"
              autoComplete="username"
              autoFocus
              aria-invalid={!!errors.username}
              aria-describedby={
                errors.username ? 'username-error' : undefined
              }
            />

            {errors.username && (
              <div
                id="username-error"
                className="text-danger small mt-1"
                role="alert"
              >
                {errors.username}
              </div>
            )}
          </div>

          {/* Password */}
          <div className="mb-4">
            <label htmlFor="password" className="admin-label form-label">
              Password
            </label>

            <div className="admin-password-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                className="admin-input form-control form-control-lg py-3"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  handleChange('password');
                }}
                placeholder="Enter password"
                autoComplete="new-password"
                aria-invalid={!!errors.password}
                aria-describedby={
                  errors.password ? 'password-error' : undefined
                }
              />

              <button
                type="button"
                className="admin-toggle btn btn-link"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>

            {errors.password && (
              <div
                id="password-error"
                className="text-danger small mt-1"
                role="alert"
              >
                {errors.password}
              </div>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-admin btn-lg w-100 py-3"
          >
            Create user
          </button>

          {submitted && (
            <div className="alert alert-success py-2 mt-3 mb-0" role="alert">
              User created successfully.
            </div>
          )}
        </form>

        <p className="admin-footer text-center small mt-4 mb-0">
          Admin access only
        </p>
      </div>
    </div>
  );
};

export default CreateUser;
