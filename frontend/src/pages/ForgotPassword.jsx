import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FaEnvelope, FaArrowLeft } from "react-icons/fa";
import { MdError, MdCheckCircle } from "react-icons/md";
import Header from "../components/Navbar";
import Footer from "../components/Footer";
import { authService } from "../services/api";

const ForgotPassword = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email.trim()) {
      setError(t("login.emailRequired"));
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(t("login.emailInvalid"));
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      await authService.forgotPassword(email);
      setIsSubmitted(true);
    } catch (err) {
      console.error("Forgot password error:", err);
      const message =
        err.response?.data?.message ||
        "Failed to send reset link. Please try again.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-gray-100 py-12 px-4 sm:px-6 lg:px-8 mt-16">
        {/* Background decorative elements matching Login page */}
        <div className="fixed top-20 right-20 w-64 h-64 bg-yellow-200 rounded-full opacity-20 blur-3xl -z-10"></div>
        <div className="fixed bottom-20 left-20 w-96 h-96 bg-green-200 rounded-full opacity-20 blur-3xl -z-10"></div>
        <div className="fixed top-40 left-40 w-32 h-32 bg-green-300 rounded-full opacity-10 blur-2xl -z-10"></div>
        <div className="fixed bottom-40 right-32 w-48 h-48 bg-yellow-100 rounded-full opacity-15 blur-2xl -z-10"></div>

        <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg overflow-hidden transition-all duration-300">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-green-700 to-green-600 py-4 px-6 text-center">
            <h2 className="text-2xl font-bold text-white">
              {t("forgotPassword.title", "Forgot Password")}
            </h2>
            <p className="mt-1 text-sm text-yellow-200">
              {t(
                "forgotPassword.subtitle",
                "Reset your Krishak Shayak password"
              )}
            </p>
          </div>

          <div className="px-6 py-8">
            {/* Top Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center text-green-600 shadow-inner">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-10 w-10 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                  />
                </svg>
              </div>
            </div>

            {isSubmitted ? (
              <div className="space-y-6 text-center">
                <div className="bg-green-50 border border-green-300 rounded-lg p-5">
                  <MdCheckCircle className="h-10 w-10 text-green-600 mx-auto mb-3" />
                  <h3 className="text-base font-semibold text-green-900 mb-2">
                    {t(
                      "forgotPassword.emailSentTitle",
                      "Reset Link Dispatched"
                    )}
                  </h3>
                  <p className="text-sm text-green-800 leading-relaxed">
                    {t(
                      "forgotPassword.genericSuccess",
                      "If an account exists with this email, a password reset link has been sent."
                    )}
                  </p>
                  <p className="text-xs text-gray-500 mt-3">
                    {t(
                      "forgotPassword.expiryNotice",
                      "Please check your inbox and spam folder. The link is valid for 15 minutes."
                    )}
                  </p>
                </div>

                <div className="pt-2">
                  <Link
                    to="/login"
                    className="inline-flex items-center text-sm font-medium text-green-600 hover:text-green-700 hover:underline"
                  >
                    <FaArrowLeft className="mr-2 h-3.5 w-3.5" />
                    {t("forgotPassword.backToLogin", "Back to Sign In")}
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <p className="text-sm text-gray-600 text-center">
                  {t(
                    "forgotPassword.instructions",
                    "Enter your registered email address and we'll send you a link to reset your password."
                  )}
                </p>

                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-700"
                  >
                    {t("login.emailLabel", "Email Address")}
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <FaEnvelope className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="email"
                      name="email"
                      id="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (error) setError("");
                      }}
                      className={`block w-full pl-10 pr-3 py-2.5 border ${
                        error ? "border-red-500" : "border-gray-300"
                      } rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 text-sm`}
                      placeholder="example@email.com"
                    />
                    {error && (
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                        <MdError className="h-5 w-5 text-red-500" />
                      </div>
                    )}
                  </div>
                  {error && (
                    <p className="mt-1 text-sm text-red-600">{error}</p>
                  )}
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors ${
                      isSubmitting ? "opacity-75 cursor-not-allowed" : ""
                    }`}
                  >
                    {isSubmitting ? (
                      <>
                        <svg
                          className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        {t("forgotPassword.sending", "Sending Link...")}
                      </>
                    ) : (
                      t("forgotPassword.submitBtn", "Send Reset Link")
                    )}
                  </button>
                </div>

                <div className="text-center pt-2">
                  <Link
                    to="/login"
                    className="inline-flex items-center text-sm font-medium text-green-600 hover:text-green-700 hover:underline"
                  >
                    <FaArrowLeft className="mr-2 h-3.5 w-3.5" />
                    {t("forgotPassword.backToLogin", "Back to Sign In")}
                  </Link>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default ForgotPassword;

