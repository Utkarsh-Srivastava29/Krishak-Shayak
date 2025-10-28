// Create a test file: c:\Users\Lavish Shakya\Desktop\Krishak Shayak\client\src\testBackend.js
import axios from 'axios';

// Define your backend URL
const API_URL = 'http://localhost:5000/api/auth';

// Test function
async function testBackendConnection() {
  try {
    console.log('Testing connection to backend...');
    const response = await axios.get(API_URL);
    console.log('Connection successful:', response.data);
    return true;
  } catch (error) {
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.log('Server responded with error:', error.response.status, error.response.data);
    } else if (error.request) {
      // The request was made but no response was received
      console.log('No response received from server. Server might be down or URL incorrect.');
    } else {
      // Something happened in setting up the request that triggered an Error
      console.log('Error setting up request:', error.message);
    }
    return false;
  }
}

// Run the test
testBackendConnection()
  .then(success => {
    if (success) {
      console.log('Backend connection test successful.');
    } else {
      console.log('Backend connection test failed.');
    }
  });