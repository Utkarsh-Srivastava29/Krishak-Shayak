import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FaEnvelope, FaLock, FaShieldAlt } from "react-icons/fa";
import { MdError, MdCheckCircle } from "react-icons/md";
import Header from "../components/Navbar";
import Footer from "../components/Footer";
import { authService, API_URL } from "../services/api";

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();

  // Authentication mode: 'login' | 'otp'
  const [authStep, setAuthStep] = useState("login");
  const [sessionId, setSessionId] = useState("");
  const [emailPreview, setEmailPreview] = useState("");

  // Login form state (prefilled if user selected Remember Me previously)
  const [rememberMe, setRememberMe] = useState(() => {
    return localStorage.getItem("rememberMe") === "true";
  });
  const [formData, setFormData] = useState(() => ({
    email:
      localStorage.getItem("rememberMe") === "true"
        ? localStorage.getItem("rememberedEmail") || ""
        : "",
    password: "",
  }));
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // OTP state (6 separate digits)
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [otpSubmitting, setOtpSubmitting] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [resendStatus, setResendStatus] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpInputsRef = useRef([]);

  // Check URL query parameters on mount (e.g. from Google OAuth error or 2FA redirect)
  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam) {
      setErrors({ submit: decodeURIComponent(errorParam) });
    }

    const twoFactor = searchParams.get("twoFactor");
    const sessionParam = searchParams.get("sessionId");
    if (twoFactor === "true" && sessionParam) {
      setSessionId(sessionParam);
      setAuthStep("otp");
      setResendCooldown(60);
    }
  }, [searchParams]);

  // Resend cooldown timer countdown
  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Focus first OTP input when switching to OTP step
  useEffect(() => {
    if (authStep === "otp" && otpInputsRef.current[0]) {
      otpInputsRef.current[0].focus();
    }
  }, [authStep]);

  // Handle credentials form change
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });

    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: null,
      });
    }
  };

  // Validate credentials
  const validate = () => {
    const newErrors = {};

    if (!formData.email.trim()) {
      newErrors.email = t("login.emailRequired");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = t("login.emailInvalid");
    }

    if (!formData.password) {
      newErrors.password = t("login.passwordRequired");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle Remember Me checkbox toggle
  const handleRememberMeToggle = (e) => {
    const isChecked = e.target.checked;
    setRememberMe(isChecked);
    localStorage.setItem("rememberMe", isChecked ? "true" : "false");
    if (!isChecked) {
      localStorage.removeItem("rememberedEmail");
    }
  };

  // Handle login submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    // Persist remembered email if checked
    if (rememberMe) {
      localStorage.setItem("rememberMe", "true");
      localStorage.setItem("rememberedEmail", formData.email);
    } else {
      localStorage.setItem("rememberMe", "false");
      localStorage.removeItem("rememberedEmail");
    }

    try {
      const response = await authService.login(
        formData.email,
        formData.password,
        rememberMe
      );

      // Scenario A: 2FA required
      if (response && response.requiresTwoFactor) {
        setSessionId(response.sessionId);
        setEmailPreview(response.emailPreview || formData.email);
        setAuthStep("otp");
        setResendCooldown(60);
        return;
      }

      // Scenario B: Direct login (JWT issued)
      if (response && response.user && response.user.userType) {
        if (response.user.userType === "seller") {
          navigate("/seller-dashboard");
        } else {
          navigate("/farmer-dashboard");
        }
      } else {
        throw new Error("Invalid response format from server");
      }
    } catch (error) {
      console.error("Login error:", error);

      let errorMessage;
      if (error.response) {
        if (error.response.status === 429) {
          const retryAfter = error.response.headers["retry-after"];
          errorMessage = retryAfter
            ? `Too many login attempts. Please try again in ${Math.ceil(
                Number(retryAfter)
              )} seconds.`
            : error.response.data.message ||
              "Too many login attempts. Please try again later.";
        } else {
          errorMessage =
            error.response.data.message ||
            "Server error: " + error.response.status;
        }
      } else if (error.request) {
        errorMessage = t("login.noResponse");
      } else {
        errorMessage = error.message;
      }

      setErrors({ submit: errorMessage });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Trigger Google OAuth flow
  const handleGoogleLogin = () => {
    window.location.href = `${API_URL}/auth/google`;
  };

  // Handle single digit change in OTP inputs
  const handleOtpChange = (index, value) => {
    // Only accept numeric characters
    if (value && !/^\d+$/.test(value)) return;

    const newOtp = [...otp];
    // If user typed a single character
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    setOtpError("");

    // Auto-advance to next input
    if (value && index < 5 && otpInputsRef.current[index + 1]) {
      otpInputsRef.current[index + 1].focus();
    }
  };

  // Handle backspace navigation in OTP
  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      if (otpInputsRef.current[index - 1]) {
        otpInputsRef.current[index - 1].focus();
      }
    }
  };

  // Handle paste in OTP inputs
  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").trim();
    if (/^\d{6}$/.test(pastedData)) {
      const digits = pastedData.split("");
      setOtp(digits);
      setOtpError("");
      if (otpInputsRef.current[5]) {
        otpInputsRef.current[5].focus();
      }
    }
  };

  // Handle OTP verification submission
  const handleOtpSubmit = async (e) => {
    e?.preventDefault();

    const fullOtp = otp.join("");
    if (fullOtp.length !== 6) {
      setOtpError(t("login.otpRequired"));
      return;
    }

    setOtpSubmitting(true);
    setOtpError("");

    try {
      const response = await authService.verifyOtp(sessionId, fullOtp, rememberMe);

      if (response && response.user && response.user.userType) {
        if (response.user.userType === "seller") {
          navigate("/seller-dashboard");
        } else {
          navigate("/farmer-dashboard");
        }
      } else {
        navigate("/farmer-dashboard");
      }
    } catch (error) {
      console.error("OTP verification error:", error);

      const errorMsg =
        error.response?.data?.message ||
        "Verification failed. Please check your code and try again.";
      setOtpError(errorMsg);

      // If session expired or too many attempts, offer quick path back
      if (
        error.response?.data?.errorType === "SESSION_EXPIRED" ||
        error.response?.data?.errorType === "TOO_MANY_ATTEMPTS"
      ) {
        setTimeout(() => {
          setAuthStep("login");
          setOtp(["", "", "", "", "", ""]);
        }, 3000);
      }
    } finally {
      setOtpSubmitting(false);
    }
  };

  // Handle Resend OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;

    setResendStatus("Sending code...");
    setOtpError("");

    try {
      const response = await authService.resendOtp(sessionId);
      setResendStatus(t("login.otpSentSuccess"));
      setResendCooldown(60);
      setOtp(["", "", "", "", "", ""]);
      if (otpInputsRef.current[0]) {
        otpInputsRef.current[0].focus();
      }

      setTimeout(() => setResendStatus(""), 4000);
    } catch (error) {
      console.error("Resend OTP error:", error);
      const msg =
        error.response?.data?.message || "Failed to resend code. Please try again.";
      setOtpError(msg);
      setResendStatus("");
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
          {/* Card Header */}
          <div className="bg-gradient-to-r from-green-700 to-green-600 py-4 px-6 text-center">
            <h2 className="text-2xl font-bold text-white">
              {authStep === "otp" ? t("login.otpTitle") : t("login.title")}
            </h2>
            <p className="mt-1 text-sm text-yellow-200">
              {authStep === "otp"
                ? `${t("login.otpSubtitle")} ${emailPreview || ""}`
                : t("login.subtitle")}
            </p>
          </div>

          <div className="px-6 py-8">
            {/* STEP 1: Standard Credentials & Google Sign-In */}
            {authStep === "login" && (
              <>
                {/* Farm illustration */}
                <div className="flex justify-center mb-5">
                  <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-11 w-11 text-green-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                      />
                    </svg>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                      <label
                        htmlFor="email"
                      className="block text-sm font-medium text-gray-700"
                    >
                      {t("login.emailLabel")}
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FaEnvelope className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="email"
                        name="email"
                        id="email"
                        value={formData.email}
                        onChange={handleChange}
                        className={`block w-full pl-10 pr-3 py-2 border ${
                          errors.email ? "border-red-500" : "border-gray-300"
                        } rounded-md shadow-sm focus:ring-green-500 focus:border-green-500`}
                        placeholder="example@email.com"
                      />
                      {errors.email && (
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                          <MdError className="h-5 w-5 text-red-500" />
                        </div>
                      )}
                    </div>
                    {errors.email && (
                      <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="password"
                      className="block text-sm font-medium text-gray-700"
                    >
                      {t("login.passwordLabel")}
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FaLock className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="password"
                        name="password"
                        id="password"
                        value={formData.password}
                        onChange={handleChange}
                        className={`block w-full pl-10 pr-3 py-2 border ${
                          errors.password ? "border-red-500" : "border-gray-300"
                        } rounded-md shadow-sm focus:ring-green-500 focus:border-green-500`}
                        placeholder="••••••"
                      />
                      {errors.password && (
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                          <MdError className="h-5 w-5 text-red-500" />
                        </div>
                      )}
                    </div>
                    {errors.password && (
                      <p className="mt-1 text-sm text-red-600">
                        {errors.password}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <input
                        id="remember-me"
                        name="remember-me"
                        type="checkbox"
                        checked={rememberMe}
                        onChange={handleRememberMeToggle}
                        className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded cursor-pointer"
                      />
                      <label
                        htmlFor="remember-me"
                        className="ml-2 block text-sm text-gray-700"
                      >
                        {t("login.rememberMe")}
                      </label>
                    </div>

                    <div className="text-sm">
                      <Link
                        to="/forgot-password"
                        className="font-medium text-green-600 hover:text-green-500"
                      >
                        {t("login.forgotPassword")}
                      </Link>
                    </div>
                  </div>

                  {errors.submit && (
                    <div className="bg-red-50 border border-red-300 rounded-md p-3">
                      <p className="text-sm text-red-600">{errors.submit}</p>
                    </div>
                  )}

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
                          {t("login.signingIn")}
                        </>
                      ) : (
                        t("login.signIn")
                      )}
                    </button>
                  </div>
                </form>

                {/* Social Login Divider */}
                <div className="mt-6">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-300"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-white text-gray-500">
                        {t("login.orContinueWith")}
                      </span>
                    </div>
                  </div>

                  {/* Continue with Google button */}
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={handleGoogleLogin}
                      className="w-full inline-flex justify-center items-center py-2.5 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
                    >
                      {/* Official Google 'G' icon */}
                      <svg
                        className="h-5 w-5 mr-3"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          fill="#4285F4"
                        />
                        <path
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          fill="#34A853"
                        />
                        <path
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                          fill="#FBBC05"
                        />
                        <path
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                          fill="#EA4335"
                        />
                      </svg>
                      {t("login.continueWithGoogle")}
                    </button>
                  </div>
                </div>

                <div className="mt-6 text-center">
                  <p className="text-sm text-gray-600">
                    {t("login.noAccount")}{" "}
                    <Link
                      to="/register"
                      className="font-medium text-green-600 hover:text-green-500"
                    >
                      {t("login.registerNow")}
                    </Link>
                  </p>
                </div>
              </>
            )}

            {/* STEP 2: Two-Factor Authentication (OTP Verification) */}
            {authStep === "otp" && (
              <div className="space-y-6">
                {/* Shield security icon */}
                <div className="flex justify-center">
                  <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-green-600 shadow-inner">
                    <FaShieldAlt className="h-8 w-8" />
                  </div>
                </div>

                <div className="text-center">
                  <p className="text-sm text-gray-600">
                    We sent a 6-digit code to{" "}
                    <span className="font-semibold text-gray-800">
                      {emailPreview}
                    </span>
                  </p>
                </div>

                {/* 6 Digit Input Boxes */}
                <form onSubmit={handleOtpSubmit} className="space-y-6">
                  <div
                    className="flex justify-between gap-2 sm:gap-3"
                    onPaste={handleOtpPaste}
                  >
                    {otp.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={(el) => (otpInputsRef.current[idx] = el)}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(idx, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                        className={`w-12 h-13 sm:w-13 sm:h-14 text-center text-xl sm:text-2xl font-bold rounded-lg border-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 transition-all ${
                          otpError
                            ? "border-red-400 bg-red-50 text-red-900"
                            : digit
                            ? "border-green-600 bg-green-50 text-green-900"
                            : "border-gray-300 bg-white text-gray-900"
                        }`}
                      />
                    ))}
                  </div>

                  {otpError && (
                    <div className="bg-red-50 border border-red-300 rounded-md p-3 flex items-center gap-2 text-sm text-red-600">
                      <MdError className="h-5 w-5 flex-shrink-0" />
                      <span>{otpError}</span>
                    </div>
                  )}

                  {resendStatus && (
                    <div className="bg-green-50 border border-green-300 rounded-md p-3 flex items-center gap-2 text-sm text-green-700">
                      <MdCheckCircle className="h-5 w-5 flex-shrink-0" />
                      <span>{resendStatus}</span>
                    </div>
                  )}

                  <div>
                    <button
                      type="submit"
                      disabled={otpSubmitting || otp.join("").length !== 6}
                      className={`w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors ${
                        otpSubmitting || otp.join("").length !== 6
                          ? "opacity-60 cursor-not-allowed"
                          : ""
                      }`}
                    >
                      {otpSubmitting ? (
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
                          {t("login.verifying")}
                        </>
                      ) : (
                        t("login.verifyAndLogin")
                      )}
                    </button>
                  </div>
                </form>

                {/* Resend & Back Navigation */}
                <div className="flex flex-col items-center gap-3 pt-2">
                  <button
                    type="button"
                    disabled={resendCooldown > 0}
                    onClick={handleResendOtp}
                    className={`text-sm font-medium ${
                      resendCooldown > 0
                        ? "text-gray-400 cursor-not-allowed"
                        : "text-green-600 hover:text-green-700 hover:underline"
                    }`}
                  >
                    {resendCooldown > 0
                      ? t("login.resendIn", { seconds: resendCooldown })
                      : t("login.resendCode")}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAuthStep("login");
                      setOtp(["", "", "", "", "", ""]);
                      setOtpError("");
                    }}
                    className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    ← {t("login.backToSignIn")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default Login;
