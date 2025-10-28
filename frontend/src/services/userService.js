// Mock user data - in a real app, this would be fetched from an API
const mockUser = {
  id: "user123",
  name: "Rajesh Kumar",
  email: "rajesh.kumar@example.com",
  phone: "9876543210",
  address: {
    street: "123 Village Road",
    city: "Jaipur",
    state: "Rajasthan",
    pincode: "302001"
  },
  role: "farmer", // Can be 'farmer', 'seller', or 'both'
  memberSince: "2023-01-15"
};

/**
 * Fetch the current user's profile
 * @returns {Promise<Object>} User profile data
 */
export const getUserProfile = async () => {
  // Simulate API call delay
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({...mockUser});
    }, 800);
  });
};

/**
 * Update user profile information
 * @param {Object} updatedProfile - The updated profile data
 * @returns {Promise<Object>} Updated user profile
 */
export const updateUserProfile = async (updatedProfile) => {
  // Simulate API call delay
  return new Promise((resolve) => {
    setTimeout(() => {
      // In a real app, this would send data to the server
      // Here we just return the updated profile
      resolve({...updatedProfile});
    }, 1000);
  });
};

/**
 * Get user's purchase history
 * @returns {Promise<Array>} Array of past orders
 */
export const getUserOrders = async () => {
  // Simulate API call delay
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([
        {
          id: "order1",
          date: "2025-05-01T10:30:00",
          total: 720.00,
          status: "delivered",
          items: [
            { id: "1", name: "Fresh Organic Tomatoes", quantity: 3, price: 40 },
            { id: "2", name: "Basmati Rice Premium Quality", quantity: 5, price: 120 }
          ]
        },
        {
          id: "order2",
          date: "2025-04-15T14:20:00",
          total: 450.00,
          status: "processing",
          items: [
            { id: "6", name: "Bio-Organic Fertilizer", quantity: 1, price: 450 }
          ]
        }
      ]);
    }, 800);
  });
};