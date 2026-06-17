import { useState } from "react";
import { Link } from "react-router";
import { ChevronLeftIcon } from "../../icons";
import Label from "../form/Label";
import Input from "../form/input/InputField";
import Button from "../ui/button/Button";
import { authService } from "../../services/authService";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', isError: false });

  const validateEmail = () => {
    if (!email) {
      setEmailError("Email is required.");
      return false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      setEmailError("Please enter a valid email.");
      return false;
    }
    setEmailError("");
    return true;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateEmail()) return;

    setIsLoading(true);
    try {
      await authService.forgotPassword(email.trim());

      setIsSubmitted(true);
      setToast({
        show: true,
        message: `Password reset link sent to ${email} successfully!`,
        isError: false
      });

      setTimeout(() => {
        setToast({ show: false, message: '', isError: false });
      }, 3000);
    } catch {
      setToast({
        show: true,
        message: 'Failed to send reset link. Please try again later.',
        isError: true
      });

      setTimeout(() => {
        setToast({ show: false, message: '', isError: false });
      }, 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const closeToast = () => {
    setToast({ show: false, message: '', isError: false });
  };

  return (
    <div className="flex flex-col flex-1">
      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed top-4 right-4 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 min-w-[350px] max-w-[400px] transition-all duration-300 animate-slide-in">
          <div className="p-4">
            <div className="flex items-start gap-3">
              {/* Icon */}
              <div className="flex-shrink-0">
                <div className={`w-5 h-5 ${toast.isError ? 'bg-red-100' : 'bg-green-100'} rounded-full flex items-center justify-center`}>
                  <svg className={`w-3 h-3 ${toast.isError ? 'text-red-600' : 'text-green-600'}`} fill="currentColor" viewBox="0 0 20 20">
                    {toast.isError ? (
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    ) : (
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    )}
                  </svg>
                </div>
              </div>

              {/* Message Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  {toast.isError ? 'Error' : 'Email Sent Successfully!'}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {toast.message}
                </p>
              </div>

              {/* Close Button */}
              <button
                onClick={closeToast}
                className="flex-shrink-0 ml-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            {/* Animated Progress Bar */}
            <div className="mt-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 overflow-hidden">
              <div
                className={`${toast.isError ? 'bg-red-500' : 'bg-green-500'} h-1 rounded-full`}
                style={{
                  width: '100%',
                  animation: 'progressBar 3s linear forwards'
                }}
              ></div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col lg:justify-center flex-1 w-full max-w-md mx-auto">
        <div>
          {/* Back to Sign In Link */}
          <Link
            to="/signin"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 mb-6 transition-colors"
          >
            <ChevronLeftIcon className="w-4 h-4" />
            Back to Sign In
          </Link>

          <div className="mb-5 sm:mb-8">
            <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
              Forgot Password
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Enter your email address and we'll send you a link to reset your password.
            </p>
          </div>

          {!isSubmitted ? (
            <form onSubmit={handleSubmit}>
              <div className="space-y-6">
                <div>
                  <Label>
                    Email <span className="text-error-500">*</span>
                  </Label>
                  <Input
                    type="email"
                    placeholder="Enter your email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  {emailError && (
                    <p className="text-red-500 text-sm mt-2">{emailError}</p>
                  )}
                </div>

                <div>
                  <Button className="w-full" size="sm" disabled={isLoading}>
                    {isLoading ? 'Sending...' : 'Send Reset Link'}
                  </Button>
                </div>
              </div>
            </form>
          ) : (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Check your email
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  We've sent a password reset link to <strong>{email}</strong>
                </p>
              </div>
              <div className="pt-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Didn't receive the email? Check your spam folder or{" "}
                  <button
                    onClick={() => {
                      setIsSubmitted(false);
                      setEmail('');
                    }}
                    className="text-brand-500 hover:text-brand-600 dark:text-brand-400 font-medium"
                  >
                    try again
                  </button>
                </p>
              </div>
            </div>
          )}

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Remember your password?{" "}
              <Link
                to="/signin"
                className="text-brand-500 hover:text-brand-600 dark:text-brand-400 font-medium"
              >
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
