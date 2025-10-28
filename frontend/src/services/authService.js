import axios from 'axios';

// Define the API base URL - adjust this to match your backend
const API_URL = 'http://localhost:5000/api/auth';

const authService = {
  register: async (userData) => {
    try {
      console.log('Sending registration data:', userData);
      const response = await axios.post(`${API_URL}/register`, userData);
      
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
      }
      
      console.log('Registration response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Registration error details:', error);
      throw error;
    }
  },
  
  login: async (email, password, rememberMe) => {
    try {
      const response = await axios.post(`${API_URL}/login`, { email, password });
      
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        
        if (rememberMe && response.data.user) {
          localStorage.setItem('user', JSON.stringify(response.data.user));
        } else if (response.data.user) {
          sessionStorage.setItem('user', JSON.stringify(response.data.user));
        }
      }
      
      return response.data;
    } catch (error) {
      console.error('Login error details:', error);
      throw error;
    }
  },
  
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('user');
  },
  
  getCurrentUser: () => {
    const userFromLocal = localStorage.getItem('user');
    const userFromSession = sessionStorage.getItem('user');
    
    if (userFromLocal) {
      try {
        return JSON.parse(userFromLocal);
      } catch (e) {
        console.error('Error parsing user from localStorage:', e);
      }
    }
    
    if (userFromSession) {
      try {
        return JSON.parse(userFromSession);
      } catch (e) {
        console.error('Error parsing user from sessionStorage:', e);
      }
    }
    
    return null;
  },
  
  getUserProfile: async () => {
    const token = localStorage.getItem('token');
    
    if (token) {
      try {
        const config = {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        };
        
        const response = await axios.get(`${API_URL}/profile`, config);
        return response.data;
      } catch (error) {
        console.error('Error getting user profile:', error);
        throw error;
      }
    }
    
    return null;
  }
};

export default authService;