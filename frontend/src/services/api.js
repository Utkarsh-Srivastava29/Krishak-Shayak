import axios from "axios";

// API Base URL - configured via environment variables
export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5001/api";

// Helper to retrieve the current token from either storage location
export const getToken = () => {
  return localStorage.getItem("token") || sessionStorage.getItem("token");
};

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add token to requests if available (supports both localStorage and sessionStorage)
api.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Helper to store authentication state based on rememberMe
const saveAuthState = (token, user, rememberMe) => {
  if (token) {
    if (rememberMe) {
      localStorage.setItem("token", token);
      sessionStorage.removeItem("token");
    } else {
      sessionStorage.setItem("token", token);
      localStorage.removeItem("token");
    }
  }

  if (user) {
    if (rememberMe) {
      localStorage.setItem("user", JSON.stringify(user));
      sessionStorage.removeItem("user");
    } else {
      sessionStorage.setItem("user", JSON.stringify(user));
      localStorage.removeItem("user");
    }
  }
};

// Auth services
export const authService = {
  register: async (userData) => {
    try {
      const response = await api.post("/auth/register", userData);
      if (response.data.token) {
        // By default, registration persists to localStorage
        localStorage.setItem("token", response.data.token);
      }
      return response.data;
    } catch (error) {
      console.error("Registration error:", error);
      throw error;
    }
  },

  login: async (email, password, rememberMe = false) => {
    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        email,
        password,
        rememberMe,
      });

      // If login completed directly (no 2FA required)
      if (response.data.token) {
        saveAuthState(response.data.token, response.data.user, rememberMe);
      }

      return response.data;
    } catch (error) {
      console.error("Login error in service:", error);
      throw error;
    }
  },

  // 2FA OTP verification
  verifyOtp: async (sessionId, otp, rememberMe = false) => {
    try {
      const response = await axios.post(`${API_URL}/auth/2fa/verify`, {
        sessionId,
        otp,
        rememberMe,
      });

      if (response.data.token) {
        saveAuthState(response.data.token, response.data.user, rememberMe);
      }

      return response.data;
    } catch (error) {
      console.error("OTP verification error:", error);
      throw error;
    }
  },

  // Resend 2FA OTP
  resendOtp: async (sessionId) => {
    try {
      const response = await axios.post(`${API_URL}/auth/2fa/resend`, {
        sessionId,
      });
      return response.data;
    } catch (error) {
      console.error("Resend OTP error:", error);
      throw error;
    }
  },

  // Request password reset link
  forgotPassword: async (email) => {
    try {
      const response = await axios.post(`${API_URL}/auth/forgot-password`, {
        email,
      });
      return response.data;
    } catch (error) {
      console.error("Forgot password error:", error);
      throw error;
    }
  },

  // Reset password using token
  resetPassword: async (token, password) => {
    try {
      const response = await axios.post(
        `${API_URL}/auth/reset-password/${token}`,
        { password }
      );
      return response.data;
    } catch (error) {
      console.error("Reset password error:", error);
      throw error;
    }
  },

  logout: async () => {
    try {
      await api.post("/auth/logout").catch(() => {});
    } finally {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      sessionStorage.removeItem("token");
      sessionStorage.removeItem("user");
    }
  },

  getCurrentUser: () => {
    const userFromLocal = localStorage.getItem("user");
    const userFromSession = sessionStorage.getItem("user");

    if (userFromLocal) {
      try {
        return JSON.parse(userFromLocal);
      } catch (e) {
        console.error("Error parsing user from localStorage:", e);
        return null;
      }
    }

    if (userFromSession) {
      try {
        return JSON.parse(userFromSession);
      } catch (e) {
        console.error("Error parsing user from sessionStorage:", e);
        return null;
      }
    }

    return null;
  },

  getUserProfile: async () => {
    try {
      const response = await api.get("/auth/profile");
      return response.data;
    } catch (error) {
      console.error("Error fetching user profile:", error);
      throw error;
    }
  },

  getMe: async () => {
    try {
      const response = await api.get("/auth/me");
      return response.data;
    } catch (error) {
      console.error("Error in getMe:", error);
      throw error;
    }
  },
};

export default api;
