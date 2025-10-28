// API Configuration
const API_URL = "http://localhost:5000/api";

// Helper function to get auth headers
const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

// Mock data for backward compatibility (will be replaced with API calls)
let mockProducts = [
  {
    id: "1",
    name: "Fresh Organic Tomatoes",
    description:
      "Farm fresh organic tomatoes grown without pesticides. Perfect for salads and cooking.",
    price: 40,
    stock: 50,
    category: "vegetables",
    seller: "Krishna Farms",
    imageUrl:
      "https://images.unsplash.com/photo-1561136594-7f68413baa99?w=800&auto=format&fit=crop",
    unitType: "kg",
    rating: 4.8,
    reviews: 24,
  },
  {
    id: "2",
    name: "Basmati Rice Premium Quality",
    description:
      "Premium quality Basmati rice with aromatic flavor. Ideal for biryani and pulao.",
    price: 120,
    stock: 100,
    category: "grains",
    seller: "Sharma Agro Products",
    imageUrl:
      "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=800&auto=format&fit=crop",
    unitType: "kg",
    rating: 4.6,
    reviews: 52,
  },
  {
    id: "3",
    name: "Organic Farm Fresh Milk",
    description:
      "100% organic cow milk from grass-fed cows. No hormones or antibiotics.",
    price: 60,
    stock: 20,
    category: "dairy",
    seller: "Green Valley Dairy",
    imageUrl:
      "https://images.unsplash.com/photo-1563636619-e9143da7973b?w=800&auto=format&fit=crop",
    unitType: "liter",
    rating: 4.9,
    reviews: 38,
  },
  {
    id: "4",
    name: "Garden Hoe Tool",
    description:
      "Durable garden hoe with wooden handle. Essential tool for any farmer.",
    price: 350,
    stock: 15,
    category: "tools",
    seller: "Farmer Tools Co.",
    imageUrl:
      "https://images.unsplash.com/photo-1617576683096-00fc8eecb3af?w=800&auto=format&fit=crop",
    unitType: "piece",
    rating: 4.5,
    reviews: 17,
  },
  {
    id: "5",
    name: "Organic Wheat Flour",
    description:
      "Stone-ground organic wheat flour. Perfect for baking bread and chapatis.",
    price: 80,
    stock: 40,
    category: "grains",
    seller: "Nature's Best Grains",
    imageUrl:
      "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&auto=format&fit=crop",
    unitType: "kg",
    rating: 4.7,
    reviews: 29,
  },
  {
    id: "6",
    name: "Bio-Organic Fertilizer",
    description:
      "Chemical-free organic fertilizer that improves soil health and crop yield.",
    price: 450,
    stock: 30,
    category: "fertilizers",
    seller: "Green Earth Products",
    imageUrl:
      "https://images.unsplash.com/photo-1589928379052-78c80d5d7d9d?w=800&auto=format&fit=crop",
    unitType: "kg",
    rating: 4.8,
    reviews: 42,
  },
];

// Mock shops data
let mockShops = [
  {
    id: "shop1",
    name: "Krishna Farms",
    description:
      "Premium organic farm products directly from our fields. We specialize in pesticide-free vegetables and fresh dairy products.",
    location: "Jaipur, Rajasthan",
    bannerImage:
      "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=1200&auto=format&fit=crop",
    verified: true,
    rating: 4.8,
    reviewsCount: 156,
    productsCount: 12,
    totalSales: 450,
    followers: 289,
    memberSince: "2023",
    categories: ["vegetables", "dairy", "grains"],
    contactInfo: {
      phone: "+91 9876543210",
      email: "contact@krishnafarms.com",
    },
  },
  {
    id: "shop2",
    name: "Sharma Agro Products",
    description:
      "Your trusted source for high-quality grains and pulses. Family-owned business with 25 years of experience.",
    location: "Delhi, India",
    bannerImage:
      "https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=1200&auto=format&fit=crop",
    verified: true,
    rating: 4.6,
    reviewsCount: 203,
    productsCount: 8,
    totalSales: 680,
    followers: 412,
    memberSince: "2022",
    categories: ["grains", "pulses"],
    contactInfo: {
      phone: "+91 9876543211",
      email: "info@sharmaagro.com",
    },
  },
  {
    id: "shop3",
    name: "Green Valley Dairy",
    description:
      "Fresh dairy products from grass-fed cows. Committed to quality and natural farming practices.",
    location: "Punjab, India",
    bannerImage:
      "https://images.unsplash.com/photo-1500595046743-cd271d694d30?w=1200&auto=format&fit=crop",
    verified: true,
    rating: 4.9,
    reviewsCount: 98,
    productsCount: 6,
    totalSales: 320,
    followers: 245,
    memberSince: "2023",
    categories: ["dairy"],
    contactInfo: {
      phone: "+91 9876543212",
      email: "contact@greenvalleydairy.com",
    },
  },
  {
    id: "shop4",
    name: "Farmer Tools Co.",
    description:
      "Complete range of agricultural tools and equipment. Quality products for modern farming.",
    location: "Mumbai, Maharashtra",
    bannerImage:
      "https://images.unsplash.com/photo-1589923188900-85dae523342b?w=1200&auto=format&fit=crop",
    verified: false,
    rating: 4.5,
    reviewsCount: 67,
    productsCount: 15,
    totalSales: 210,
    followers: 178,
    memberSince: "2024",
    categories: ["tools", "equipment"],
    contactInfo: {
      phone: "+91 9876543213",
      email: "sales@farmertools.com",
    },
  },
  {
    id: "shop5",
    name: "Nature's Best Grains",
    description:
      "Organic and stone-ground grains for healthy living. Traditional methods meet modern quality standards.",
    location: "Bangalore, Karnataka",
    bannerImage:
      "https://images.unsplash.com/photo-1566385101042-1a0aa0c1268c?w=1200&auto=format&fit=crop",
    verified: true,
    rating: 4.7,
    reviewsCount: 134,
    productsCount: 10,
    totalSales: 390,
    followers: 312,
    memberSince: "2023",
    categories: ["grains", "flour"],
    contactInfo: {
      phone: "+91 9876543214",
      email: "hello@naturesbestgrains.com",
    },
  },
  {
    id: "shop6",
    name: "Green Earth Products",
    description:
      "Eco-friendly fertilizers and organic farming solutions. Building a sustainable future for agriculture.",
    location: "Hyderabad, Telangana",
    bannerImage:
      "https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?w=1200&auto=format&fit=crop",
    verified: true,
    rating: 4.8,
    reviewsCount: 189,
    productsCount: 14,
    totalSales: 520,
    followers: 456,
    memberSince: "2022",
    categories: ["fertilizers", "seeds"],
    contactInfo: {
      phone: "+91 9876543215",
      email: "support@greenearthproducts.com",
    },
  },
];

// Map products to their respective shops
const productShopMapping = {
  1: "shop1", // Krishna Farms
  2: "shop2", // Sharma Agro Products
  3: "shop3", // Green Valley Dairy
  4: "shop4", // Farmer Tools Co.
  5: "shop5", // Nature's Best Grains
  6: "shop6", // Green Earth Products
};

// Mock cart data
let mockCart = [];

// Mock orders data
const mockOrders = [
  {
    id: "order1",
    date: "2025-05-01T10:30:00",
    subtotal: 680.0,
    total: 720.0,
    status: "delivered",
    items: [
      {
        id: "1",
        name: "Fresh Organic Tomatoes",
        quantity: 3,
        price: 40,
        image:
          "https://images.unsplash.com/photo-1561136594-7f68413baa99?w=800&auto=format&fit=crop",
      },
      {
        id: "2",
        name: "Basmati Rice Premium Quality",
        quantity: 5,
        price: 120,
        image:
          "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=800&auto=format&fit=crop",
      },
    ],
    shipping: {
      name: "Rajesh Kumar",
      address: "123 Village Road",
      city: "Jaipur",
      state: "Rajasthan",
      pincode: "302001",
      phone: "9876543210",
      cost: 40,
    },
    paymentMethod: "Cash on Delivery",
    paymentStatus: "Paid",
  },
  {
    id: "order2",
    date: "2025-04-15T14:20:00",
    subtotal: 450.0,
    total: 450.0,
    status: "processing",
    items: [
      {
        id: "6",
        name: "Bio-Organic Fertilizer",
        quantity: 1,
        price: 450,
        image:
          "https://images.unsplash.com/photo-1589928379052-78c80d5d7d9d?w=800&auto=format&fit=crop",
      },
    ],
    shipping: {
      name: "Rajesh Kumar",
      address: "123 Village Road",
      city: "Jaipur",
      state: "Rajasthan",
      pincode: "302001",
      phone: "9876543210",
      cost: 0,
    },
    paymentMethod: "UPI",
    paymentStatus: "Paid",
  },
];

// Product related API functions
export const getAllProducts = async () => {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 800));
  return [...mockProducts];
};

export const getProductById = async (id) => {
  await new Promise((resolve) => setTimeout(resolve, 500));
  const product = mockProducts.find((p) => p.id === id);
  if (!product) throw new Error("Product not found");
  return { ...product };
};

export const getProductsByCategory = async (category) => {
  await new Promise((resolve) => setTimeout(resolve, 800));
  return mockProducts.filter((p) => p.category === category);
};

export const searchProducts = async (query) => {
  await new Promise((resolve) => setTimeout(resolve, 800));
  const lowercaseQuery = query.toLowerCase();
  return mockProducts.filter(
    (p) =>
      p.name.toLowerCase().includes(lowercaseQuery) ||
      p.description.toLowerCase().includes(lowercaseQuery) ||
      p.category.toLowerCase().includes(lowercaseQuery)
  );
};

/**
 * Fetch product by ID
 */
export const fetchProductById = async (id) => {
  // Simulate API call delay
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const product = mockProducts.find((product) => product.id === id);
      if (product) {
        resolve(product);
      } else {
        reject(new Error("Product not found"));
      }
    }, 800);
  });
};

// Cart related functions
export const getCartItems = async () => {
  await new Promise((resolve) => setTimeout(resolve, 500));
  return [...mockCart];
};

export const addToCart = async (productId, quantity = 1) => {
  await new Promise((resolve) => setTimeout(resolve, 500));

  // First try to find in mock products
  let product = mockProducts.find(
    (p) => p.id === productId || p._id === productId
  );

  // If not found in mock, try to fetch from API
  if (!product) {
    try {
      const response = await fetch(`${API_URL}/products/${productId}`, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        product = await response.json();
      }
    } catch (error) {
      console.error("Error fetching product from API:", error);
    }
  }

  if (!product) {
    console.error("Product not found with ID:", productId);
    throw new Error("Product not found");
  }

  const cartItem = mockCart.find((item) => item.productId === productId);
  if (cartItem) {
    // If item already in cart, update the quantity
    cartItem.quantity += quantity;
  } else {
    // Extract seller name if seller is an object
    let sellerName = "Unknown Seller";
    if (typeof product.seller === "object" && product.seller !== null) {
      sellerName =
        product.seller.shopName || product.seller.name || "Unknown Seller";
    } else if (typeof product.seller === "string") {
      sellerName = product.seller;
    }

    // Otherwise, add new item to cart
    const newCartItem = {
      productId,
      quantity,
      name: product.name,
      price: product.price,
      image: product.imageUrl || product.image, // Use 'image' key to match ShoppingCart expectation
      imageUrl: product.imageUrl || product.image, // Keep imageUrl for compatibility
      seller: sellerName,
    };

    console.log("Adding item to cart:", newCartItem);
    mockCart.push(newCartItem);
  }

  console.log("Current cart:", mockCart);
  return [...mockCart];
};

/**
 * Update cart item quantity
 */
export const updateCartItemQuantity = async (productId, quantity) => {
  // Simulate API call delay
  return new Promise((resolve) => {
    setTimeout(() => {
      mockCart = mockCart.map((item) =>
        item.productId === productId ? { ...item, quantity } : item
      );
      resolve(true);
    }, 500);
  });
};

/**
 * Remove item from cart
 */
export const removeFromCart = async (productId) => {
  // Simulate API call delay
  return new Promise((resolve) => {
    setTimeout(() => {
      mockCart = mockCart.filter((item) => item.productId !== productId);
      resolve(true);
    }, 500);
  });
};

/**
 * Clear cart
 */
export const clearCart = async () => {
  // Simulate API call delay
  return new Promise((resolve) => {
    setTimeout(() => {
      mockCart = [];
      // Dispatch cart updated event
      window.dispatchEvent(new Event("cartUpdated"));
      resolve(true);
    }, 500);
  });
};

/**
 * Place order
 */
export const placeOrder = async (orderData) => {
  try {
    console.log("Placing order with data:", orderData);

    const response = await fetch(`${API_URL}/orders`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(orderData),
    });

    // Check if response is JSON
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      console.error("Server returned non-JSON response:", text);
      throw new Error("Server error: Expected JSON response");
    }

    const data = await response.json();

    if (!response.ok) {
      console.error("Order placement failed:", data);
      throw new Error(data.message || "Failed to place order");
    }

    console.log("Order placed successfully:", data);
    return data;
  } catch (error) {
    console.error("Error placing order:", error);
    throw error;
  }
};

/**
 * Get all orders for the authenticated user
 */
export const getMyOrders = async () => {
  try {
    const response = await fetch(`${API_URL}/orders/my-orders`, {
      method: "GET",
      headers: getAuthHeaders(),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to fetch orders");
    }

    return data.orders || [];
  } catch (error) {
    console.error("Error fetching orders:", error);
    // Return empty array instead of throwing to prevent UI crashes
    return [];
  }
};

/**
 * Get order by ID
 */
export const getOrderById = async (orderId) => {
  try {
    const response = await fetch(`${API_URL}/orders/${orderId}`, {
      method: "GET",
      headers: getAuthHeaders(),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to fetch order");
    }

    return data.order;
  } catch (error) {
    console.error("Error fetching order:", error);
    return null;
  }
};

/**
 * Get orders for seller's shop
 */
export const getSellerOrders = async () => {
  try {
    const response = await fetch(`${API_URL}/orders/seller/orders`, {
      method: "GET",
      headers: getAuthHeaders(),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to fetch seller orders");
    }

    return {
      orders: data.orders || [],
      groupedByCustomer: data.groupedByCustomer || [],
    };
  } catch (error) {
    console.error("Error fetching seller orders:", error);
    return {
      orders: [],
      groupedByCustomer: [],
    };
  }
};

/**
 * Update individual item status in an order (for sellers)
 */
export const updateItemStatus = async (orderId, itemIndex, status) => {
  try {
    const response = await fetch(
      `${API_URL}/orders/${orderId}/item/${itemIndex}/status`,
      {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ status }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to update item status");
    }

    return data;
  } catch (error) {
    console.error("Error updating item status:", error);
    throw error;
  }
};

// Add these lines to export the categories
export const categories = [
  "All",
  "vegetables",
  "fruits",
  "grains",
  "dairy",
  "tools",
  "seeds",
  "fertilizers",
];

// Add the fetchProducts function
export const fetchProducts = async (filters) => {
  // Simulate API call delay
  return new Promise((resolve) => {
    setTimeout(() => {
      let filteredProducts = [...mockProducts];

      // Apply category filter
      if (filters.category && filters.category !== "All") {
        filteredProducts = filteredProducts.filter(
          (product) => product.category === filters.category.toLowerCase()
        );
      }

      // Apply price filter
      filteredProducts = filteredProducts.filter(
        (product) =>
          product.price >= filters.minPrice && product.price <= filters.maxPrice
      );

      // Apply search filter
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        filteredProducts = filteredProducts.filter(
          (product) =>
            product.name.toLowerCase().includes(searchTerm) ||
            product.description.toLowerCase().includes(searchTerm)
        );
      }

      // Apply sorting
      switch (filters.sort) {
        case "price-low-high":
          filteredProducts.sort((a, b) => a.price - b.price);
          break;
        case "price-high-low":
          filteredProducts.sort((a, b) => b.price - a.price);
          break;
        case "rating":
          filteredProducts.sort((a, b) => b.rating - a.rating);
          break;
        // newest first is default
        default:
          // Assuming products with higher IDs are newer
          filteredProducts.sort((a, b) => b.id - a.id);
      }

      resolve(filteredProducts);
    }, 500);
  });
};

// getCartItems is already defined above

// Placeholder service functions for seller dashboard
export const getSellerProducts = async () => {
  try {
    const token = localStorage.getItem("token");

    const response = await fetch(`${API_URL}/products/my-products`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch seller products");
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching seller products:", error);
    throw error;
  }
};

export const deleteProduct = async (productId) => {
  try {
    const token = localStorage.getItem("token");

    const response = await fetch(`${API_URL}/products/${productId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to delete product");
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error deleting product:", error);
    throw error;
  }
};

// Add this function to your existing marketplaceService.js
export const addProduct = async (productData) => {
  try {
    const token = localStorage.getItem("token");

    // Map frontend field names to backend field names
    const mappedData = {
      name: productData.name,
      description: productData.description,
      price: productData.price,
      stock: productData.stock,
      category: productData.category,
      unitType: productData.unit || productData.unitType, // Map 'unit' to 'unitType'
      imageUrl: productData.image || productData.imageUrl || "", // Map 'image' to 'imageUrl'
    };

    const response = await fetch(`${API_URL}/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(mappedData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to add product");
    }

    return await response.json();
  } catch (error) {
    console.error("Error adding product:", error);
    throw error;
  }
};

// Update product function
export const updateProduct = async (productId, productData) => {
  try {
    const token = localStorage.getItem("token");

    // Map frontend field names to backend field names
    const mappedData = {
      name: productData.name,
      description: productData.description,
      price: productData.price,
      stock: productData.stock,
      category: productData.category,
      unitType: productData.unit || productData.unitType, // Map 'unit' to 'unitType'
      imageUrl: productData.image || productData.imageUrl || "", // Map 'image' to 'imageUrl'
    };

    const response = await fetch(`${API_URL}/products/${productId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(mappedData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to update product");
    }

    return await response.json();
  } catch (error) {
    console.error("Error updating product:", error);
    throw error;
  }
};

// Seller profile functions
export const getSellerProfile = async () => {
  try {
    const token = localStorage.getItem("token");

    const response = await fetch(`${API_URL}/seller/profile`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch seller profile");
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching seller profile:", error);
    throw error;
  }
};

export const updateSellerProfile = async (profileData) => {
  try {
    const token = localStorage.getItem("token");

    const response = await fetch(`${API_URL}/seller/profile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(profileData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to update seller profile");
    }

    return await response.json();
  } catch (error) {
    console.error("Error updating seller profile:", error);
    throw error;
  }
};

// Shop-related API functions
export const getAllShops = async () => {
  try {
    const response = await fetch(`${API_URL}/seller/shops`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      console.warn("API failed, falling back to mock data");
      // Fallback to mock data if API fails
      return [...mockShops];
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching shops, using mock data:", error);
    // Fallback to mock data on error
    return [...mockShops];
  }
};

export const getShopById = async (shopId) => {
  try {
    const response = await fetch(`${API_URL}/seller/shops/${shopId}`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      console.warn("API failed, falling back to mock data");
      // Fallback to mock data
      const shop = mockShops.find((s) => s.id === shopId);
      if (!shop) throw new Error("Shop not found");
      return { ...shop };
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching shop, using mock data:", error);
    // Fallback to mock data
    const shop = mockShops.find((s) => s.id === shopId);
    if (!shop) throw new Error("Shop not found");
    return { ...shop };
  }
};

export const getShopProducts = async (shopId) => {
  try {
    const response = await fetch(`${API_URL}/products/seller/${shopId}`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      console.warn("API failed, falling back to mock data");
      // Fallback to mock data
      const products = mockProducts.filter((p) => {
        const mappedShopId = productShopMapping[p.id];
        return mappedShopId === shopId;
      });
      return [...products];
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching shop products, using mock data:", error);
    // Fallback to mock data
    const products = mockProducts.filter((p) => {
      const mappedShopId = productShopMapping[p.id];
      return mappedShopId === shopId;
    });
    return [...products];
  }
};

export const searchShops = async (query) => {
  try {
    const response = await fetch(
      `${API_URL}/seller/shops?search=${encodeURIComponent(query)}`,
      {
        headers: getAuthHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error("Failed to search shops");
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error searching shops:", error);
    throw error;
  }
};
