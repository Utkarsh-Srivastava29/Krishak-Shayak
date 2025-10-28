import axios from "axios";

// API Base URL - configured via environment variables
export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
// console.log("Using API URL:", API_URL);

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add token to requests if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Auth services
export const authService = {
  register: async (userData) => {
    try {
      const response = await api.post("/auth/register", userData);
      if (response.data.token) {
        localStorage.setItem("token", response.data.token);
      }
      return response.data;
    } catch (error) {
      console.error("Registration error:", error);
      throw error;
    }
  },

  login: async (email, password, rememberMe) => {
    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        email,
        password,
      });

      // Log the entire response to debug
      console.log("Full login response:", response);

      if (response.data.token) {
        localStorage.setItem("token", response.data.token);

        if (response.data.user) {
          // Store user data in localStorage or sessionStorage based on rememberMe
          if (rememberMe) {
            localStorage.setItem("user", JSON.stringify(response.data.user));
          } else {
            sessionStorage.setItem("user", JSON.stringify(response.data.user));
          }
        }
      }

      return response.data;
    } catch (error) {
      console.error("Login error in service:", error);
      throw error;
    }
  },

  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    sessionStorage.removeItem("user");
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
};

export default api;
