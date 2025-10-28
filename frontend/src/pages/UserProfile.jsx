import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { getUserProfile, updateUserProfile } from "../services/userService";

const UserProfile = () => {
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    phone: "",
    address: {
      street: "",
      city: "",
      state: "",
      pincode: ""
    }
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  
  useEffect(() => {
    const loadProfile = async () => {
      setIsLoading(true);
      try {
        const userData = await getUserProfile();
        setProfile(userData);
      } catch (error) {
        console.error("Failed to load profile:", error);
        setMessage({ 
          type: "error", 
          text: "Failed to load your profile information. Please try again." 
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    loadProfile();
  }, []);
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith("address.")) {
      const addressField = name.split(".")[1];
      setProfile({
        ...profile,
        address: {
          ...profile.address,
          [addressField]: value
        }
      });
    } else {
      setProfile({
        ...profile,
        [name]: value
      });
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      await updateUserProfile(profile);
      setIsEditing(false);
      setMessage({ type: "success", text: "Profile updated successfully!" });
    } catch (error) {
      console.error("Failed to update profile:", error);
      setMessage({ 
        type: "error", 
        text: "Failed to update your profile. Please try again." 
      });
    } finally {
      setIsSaving(false);
      
      // Clear message after 5 seconds
      setTimeout(() => {
        setMessage({ type: "", text: "" });
      }, 5000);
    }
  };
  
  if (isLoading) {
    return (
      <div>
        <Navbar />
        <div className="container mx-auto px-4 py-16 flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
        </div>
        <Footer />
      </div>
    );
  }
  
  return (
    <div className="bg-gray-50 min-h-screen">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6">My Account</h1>
        
        {message.text && (
          <div className={`p-4 mb-6 rounded-md ${message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            {message.text}
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Left Sidebar */}
          <div className="md:col-span-1">
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <nav className="divide-y divide-gray-200">
                <Link to="/profile" className="block px-6 py-4 bg-gray-50">
                  <div className="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="font-medium text-gray-800">My Profile</span>
                  </div>
                </Link>
                <Link to="/orders" className="block px-6 py-4 hover:bg-gray-50">
                  <div className="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                    <span className="text-gray-800">My Orders</span>
                  </div>
                </Link>
                
                {/* If the user is also a seller */}
                <Link to="/marketplace/seller" className="block px-6 py-4 hover:bg-gray-50">
                  <div className="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <span className="text-gray-800">Seller Dashboard</span>
                  </div>
                </Link>
                
                <button className="block w-full text-left px-6 py-4 hover:bg-gray-50">
                  <div className="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span className="text-gray-800">Logout</span>
                  </div>
                </button>
              </nav>
            </div>
          </div>
          
          {/* Main Content */}
          <div className="md:col-span-3">
            <div className="bg-white rounded-lg shadow-md overflow-hidden p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">Personal Information</h2>
                {!isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="text-green-600 hover:text-green-800 flex items-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit
                  </button>
                )}
              </div>
              
              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-gray-700 font-medium mb-2" htmlFor="name">
                      Full Name
                    </label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      value={profile.name}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className={`w-full px-4 py-2 border rounded-lg ${
                        isEditing
                          ? "border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500"
                          : "bg-gray-50 border-gray-200"
                      }`}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-gray-700 font-medium mb-2" htmlFor="email">
                      Email Address
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      value={profile.email}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className={`w-full px-4 py-2 border rounded-lg ${
                        isEditing
                          ? "border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500"
                          : "bg-gray-50 border-gray-200"
                      }`}
                    />
                  </div>
                </div>
                
                <div className="mb-6">
                  <label className="block text-gray-700 font-medium mb-2" htmlFor="phone">
                    Phone Number
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={profile.phone}
                    onChange={handleChange}
                    disabled={!isEditing}
                    className={`w-full px-4 py-2 border rounded-lg ${
                      isEditing
                        ? "border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500"
                        : "bg-gray-50 border-gray-200"
                    }`}
                  />
                </div>
                
                <h2 className="text-xl font-semibold mb-4 mt-8">Address</h2>
                
                <div className="mb-6">
                  <label className="block text-gray-700 font-medium mb-2" htmlFor="address.street">
                    Street Address
                  </label>
                  <input
                    id="address.street"
                    name="address.street"
                    type="text"
                    value={profile.address.street}
                    onChange={handleChange}
                    disabled={!isEditing}
                    className={`w-full px-4 py-2 border rounded-lg ${
                      isEditing
                        ? "border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500"
                        : "bg-gray-50 border-gray-200"
                    }`}
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  <div>
                    <label className="block text-gray-700 font-medium mb-2" htmlFor="address.city">
                      City
                    </label>
                    <input
                      id="address.city"
                      name="address.city"
                      type="text"
                      value={profile.address.city}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className={`w-full px-4 py-2 border rounded-lg ${
                        isEditing
                          ? "border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500"
                          : "bg-gray-50 border-gray-200"
                      }`}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-gray-700 font-medium mb-2" htmlFor="address.state">
                      State
                    </label>
                    <input
                      id="address.state"
                      name="address.state"
                      type="text"
                      value={profile.address.state}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className={`w-full px-4 py-2 border rounded-lg ${
                        isEditing
                          ? "border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500"
                          : "bg-gray-50 border-gray-200"
                      }`}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-gray-700 font-medium mb-2" htmlFor="address.pincode">
                      PIN Code
                    </label>
                    <input
                      id="address.pincode"
                      name="address.pincode"
                      type="text"
                      value={profile.address.pincode}
                      onChange={handleChange}
                      disabled={!isEditing}
                      className={`w-full px-4 py-2 border rounded-lg ${
                        isEditing
                          ? "border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500"
                          : "bg-gray-50 border-gray-200"
                      }`}
                    />
                  </div>
                </div>
                
                {isEditing && (
                  <div className="flex justify-end mt-8">
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2 text-gray-600 hover:text-gray-800 mr-4"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center"
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <>
                          <span className="mr-2 animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></span>
                          Saving...
                        </>
                      ) : (
                        "Save Changes"
                      )}
                    </button>
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  );
};

export default UserProfile;