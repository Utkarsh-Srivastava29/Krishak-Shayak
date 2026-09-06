import { useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FaLock, FaEye, FaEyeSlash, FaArrowLeft } from "react-icons/fa";
import { MdError, MdCheckCircle } from "react-icons/md";
import Header from "../components/Navbar";
import Footer from "../components/Footer";
import { authService } from "../services/api";

const ResetPassword = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const validate = () => {
    const newErrors = {};

    if (!password) {
      newErrors.password = t(
        "resetPassword.passwordRequired",
        "New password is required"
      );
    } else if (password.length < 6) {
      newErrors.password = t(
        "resetPassword.passwordMinLength",
        "Password must be at least 6 characters"
      );
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = t(
        "resetPassword.confirmRequired",
        "Please confirm your new password"
      );
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = t(
        "resetPassword.passwordMismatch",
        "Passwords do not match"
      );
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      await authService.resetPassword(token, password);
      setIsSuccess(true);
      setTimeout(() => {
        navigate("/login", { replace: true });
      }, 3500);
    } catch (err) {
      console.error("Reset password error:", err);
      const message =
        err.response?.data?.message ||
        "Password reset link is invalid or has expired.";
      setErrors({ submit: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-gray-100 py-12 px-4 sm:px-6 lg:px-8 mt-16">
        {/* Background decorative elements */}
        <div className="fixed top-20 right-20 w-64 h-64 bg-yellow-200 rounded-full opacity-20 blur-3xl -z-10"></div>
        <div className="fixed bottom-20 left-20 w-96 h-96 bg-green-200 rounded-full opacity-20 blur-3xl -z-10"></div>
        <div className="fixed top-40 left-40 w-32 h-32 bg-green-300 rounded-full opacity-10 blur-2xl -z-10"></div>
        <div className="fixed bottom-40 right-32 w-48 h-48 bg-yellow-100 rounded-full opacity-15 blur-2xl -z-10"></div>

        <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg overflow-hidden transition-all duration-300">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-green-700 to-green-600 py-4 px-6 text-center">
            <h2 className="text-2xl font-bold text-white">
              {t("resetPassword.title", "Create New Password")}
            </h2>
            <p className="mt-1 text-sm text-yellow-200">
              {t(
                "resetPassword.subtitle",
                "Your new password must be at least 6 characters"
              )}
            </p>
          </div>

          <div className="px-6 py-8">
            {/* Top Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center text-green-600 shadow-inner">
                <FaLock className="h-9 w-9 text-green-600" />
              </div>
            </div>

            {isSuccess ? (
              <div className="space-y-6 text-center">
                <div className="bg-green-50 border border-green-300 rounded-lg p-5">
                  <MdCheckCircle className="h-12 w-12 text-green-600 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-green-900 mb-2">
                    {t(
                      "resetPassword.successTitle",
                      "Password Reset Successful!"
                    )}
                  </h3>
                  <p className="text-sm text-green-800 leading-relaxed">
                    {t(
                      "resetPassword.successDesc",
                      "Your password has been updated. You will be redirected to the sign-in page shortly."
                    )}
                  </p>
                </div>

                <div className="pt-2">
                  <Link
                    to="/login"
                    className="w-full inline-flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none"
                  >
                    {t("resetPassword.signInNow", "Sign In with New Password")}
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {errors.submit && (
                  <div className="bg-red-50 border border-red-300 rounded-md p-3.5 flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-sm text-red-600">
                      <MdError className="h-5 w-5 flex-shrink-0" />
                      <span>{errors.submit}</span>
                    </div>
                    <Link
                      to="/forgot-password"
                      className="text-xs text-red-700 font-medium hover:underline self-start pl-7"
                    >
                      {t(
                        "resetPassword.requestNewLink",
                        "Request a new reset link →"
                      )}
                    </Link>
                  </div>
                )}

                {/* New Password */}
                <div>
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-gray-700"
                  >
                    {t("resetPassword.newPasswordLabel", "New Password")}
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <FaLock className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      id="password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (errors.password) {
                          setErrors({ ...errors, password: null });
                        }
                      }}
                      className={`block w-full pl-10 pr-10 py-2.5 border ${
                        errors.password ? "border-red-500" : "border-gray-300"
                      } rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 text-sm`}
                      placeholder="••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                    >
                      {showPassword ? (
                        <FaEyeSlash className="h-4 w-4" />
                      ) : (
                        <FaEye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.password}
                    </p>
                  )}
                </div>

                {/* Confirm Password */}
                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="block text-sm font-medium text-gray-700"
                  >
                    {t(
                      "resetPassword.confirmPasswordLabel",
                      "Confirm New Password"
                    )}
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <FaLock className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      name="confirmPassword"
                      id="confirmPassword"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (errors.confirmPassword) {
                          setErrors({ ...errors, confirmPassword: null });
                        }
                      }}
                      className={`block w-full pl-10 pr-10 py-2.5 border ${
                        errors.confirmPassword
                          ? "border-red-500"
                          : "border-gray-300"
                      } rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 text-sm`}
                      placeholder="••••••"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                    >
                      {showConfirmPassword ? (
                        <FaEyeSlash className="h-4 w-4" />
                      ) : (
                        <FaEye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.confirmPassword}
                    </p>
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
                        {t("resetPassword.resetting", "Updating Password...")}
                      </>
                    ) : (
                      t("resetPassword.submitBtn", "Reset Password")
                    )}
                  </button>
                </div>

                <div className="text-center pt-2">
                  <Link
                    to="/login"
                    className="inline-flex items-center text-sm font-medium text-green-600 hover:text-green-700 hover:underline"
                  >
                    <FaArrowLeft className="mr-2 h-3.5 w-3.5" />
                    {t("resetPassword.backToLogin", "Back to Sign In")}
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

export default ResetPassword;

