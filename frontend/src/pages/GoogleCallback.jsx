import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Header from "../components/Navbar";
import Footer from "../components/Footer";

const GoogleCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [error, setError] = useState(null);

  useEffect(() => {
    const processCallback = () => {
      const token = searchParams.get("token");
      const userParam = searchParams.get("user");
      const errorParam = searchParams.get("error");

      if (errorParam) {
        setError(decodeURIComponent(errorParam));
        return;
      }

      if (!token || !userParam) {
        setError("Invalid authentication response. Please try logging in again.");
        return;
      }

      try {
        const user = JSON.parse(decodeURIComponent(userParam));

        // Store auth details
        localStorage.setItem("token", token);
        localStorage.setItem("user", JSON.stringify(user));

        // Redirect based on userType
        setTimeout(() => {
          if (user.userType === "seller") {
            navigate("/seller-dashboard", { replace: true });
          } else {
            navigate("/farmer-dashboard", { replace: true });
          }
        }, 1000);
      } catch (err) {
        console.error("Failed to parse user payload:", err);
        setError("Failed to process account data. Please try again.");
      }
    };

    processCallback();
  }, [searchParams, navigate]);

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-gray-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 mt-16">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg overflow-hidden p-8 text-center">
          {error ? (
            <div>
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Authentication Failed
              </h2>
              <p className="text-sm text-gray-600 mb-6">{error}</p>
              <button
                onClick={() => navigate("/login", { replace: true })}
                className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none"
              >
                Back to Sign In
              </button>
            </div>
          ) : (
            <div>
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-spin">
                <svg
                  className="w-8 h-8"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
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
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Authenticating with Google...
              </h2>
              <p className="text-sm text-gray-500">
                Please wait while we verify your account and redirect you.
              </p>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </>
  );
};

export default GoogleCallback;

