import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getCartItems } from "../services/marketplaceService";
import { authService } from "../services/api"; // Import authService

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();

  // Load cart count (can be called from event listener too)
  const loadCartCount = async () => {
    try {
      const items = await getCartItems();
      setCartCount(items.length);
    } catch (error) {
      console.error("Failed to load cart count:", error);
    }
  };

  useEffect(() => {
    // Check if user is authenticated
    const checkAuthStatus = () => {
      const token = localStorage.getItem("token");
      const currentUser = authService.getCurrentUser();

      if (token && currentUser) {
        setIsAuthenticated(true);
        setUser(currentUser);
      } else {
        setIsAuthenticated(false);
        setUser(null);
      }
    };

    // Initial load
    loadCartCount();
    checkAuthStatus();

    // Listen for cart updates from other components
    const onCartUpdated = () => loadCartCount();
    window.addEventListener("cartUpdated", onCartUpdated);

    return () => {
      window.removeEventListener("cartUpdated", onCartUpdated);
    };
  }, [location]);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const toggleProfile = () => {
    setIsProfileOpen(!isProfileOpen);
  };

  const handleLogout = () => {
    authService.logout();
    setIsAuthenticated(false);
    setUser(null);
    navigate("/");
  };

  return (
    <nav className="bg-green-700 shadow-md sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-4">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-8 w-8 text-yellow-400"
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
            <span className="text-white font-bold text-xl">Krishak Shayak</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            <Link
              to="/"
              className="text-white hover:text-yellow-300 transition"
            >
              Home
            </Link>
            <Link
              to="/marketplace"
              className="text-white hover:text-yellow-300 transition"
            >
              Market Place
            </Link>
            <Link
              to="/market-price"
              className="text-white hover:text-yellow-300 transition"
            >
              Market Price
            </Link>
            <Link
              to="/weather"
              className="text-white hover:text-yellow-300 transition"
            >
              Weather
            </Link>
            <Link
              to="/govt-schemes"
              className="text-white hover:text-yellow-300 transition"
            >
              Govt Schemes
            </Link>

            {/* Show dashboard links based on user type */}
            {isAuthenticated && user?.userType === "seller" && (
              <Link
                to="/seller-dashboard"
                className="text-white hover:text-yellow-300 transition"
              >
                Dashboard
              </Link>
            )}
            {isAuthenticated && user?.userType === "buyer" && (
              <Link
                to="/farmer-dashboard"
                className="text-white hover:text-yellow-300 transition"
              >
                Dashboard
              </Link>
            )}
          </div>

          {/* User & Cart Menu */}
          <div className="flex items-center space-x-4">
            {/* Show either login/register buttons or user info & logout button */}
            <div className="hidden md:flex items-center space-x-3">
              {!isAuthenticated ? (
                // Not authenticated - show login/register buttons
                <>
                  <Link
                    to="/login"
                    className="flex items-center bg-yellow-400 hover:bg-yellow-500 text-green-800 font-medium py-1.5 px-4 rounded transition-colors"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 mr-1.5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M3 3a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V3zm1 4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1V8a1 1 0 00-1-1H4zm7 4a1 1 0 11-2 0 1 1 0 012 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Login
                  </Link>
                  <Link
                    to="/register"
                    className="flex items-center text-white hover:text-yellow-300 transition-colors"
                  >
                    Register
                  </Link>
                </>
              ) : (
                // Authenticated - show user info & logout button
                <div className="flex items-center">
                  <div className="relative">
                    <button
                      onClick={toggleProfile}
                      className="flex items-center text-white hover:text-yellow-300 transition-colors focus:outline-none"
                    >
                      <span className="mr-2">{user?.name}</span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>

                    {/* Dropdown menu */}
                    {isProfileOpen && (
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
                        {user?.userType === "seller" && (
                          <Link
                            to="/seller-dashboard"
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            onClick={() => setIsProfileOpen(false)}
                          >
                            Seller Dashboard
                          </Link>
                        )}
                        {user?.userType === "buyer" && (
                          <Link
                            to="/farmer-dashboard"
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            onClick={() => setIsProfileOpen(false)}
                          >
                            Dashboard
                          </Link>
                        )}

                        <button
                          onClick={() => {
                            handleLogout();
                            setIsProfileOpen(false);
                          }}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          Logout
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <Link
              to="/cart"
              className="relative text-white hover:text-yellow-300"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-yellow-400 text-green-800 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                  {cartCount}
                </span>
              )}
            </Link>

            {/* Mobile menu button */}
            <button
              onClick={toggleMenu}
              className="md:hidden text-white hover:text-yellow-300 focus:outline-none"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {isMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-green-600">
            <Link
              to="/"
              className="block py-2 text-white hover:bg-green-600 px-4 rounded"
              onClick={() => setIsMenuOpen(false)}
            >
              Home
            </Link>
            <Link
              to="/marketplace"
              className="block py-2 text-white hover:bg-green-600 px-4 rounded"
              onClick={() => setIsMenuOpen(false)}
            >
              Market Place
            </Link>
            <Link
              to="/market-price"
              className="block py-2 text-white hover:bg-green-600 px-4 rounded"
              onClick={() => setIsMenuOpen(false)}
            >
              Market Price
            </Link>
            <Link
              to="/weather"
              className="block py-2 text-white hover:bg-green-600 px-4 rounded"
              onClick={() => setIsMenuOpen(false)}
            >
              Weather
            </Link>
            <Link
              to="/govt-schemes"
              className="block py-2 text-white hover:bg-green-600 px-4 rounded"
              onClick={() => setIsMenuOpen(false)}
            >
              Govt Schemes
            </Link>

            {/* Show dashboard links based on user type */}
            {isAuthenticated && user?.userType === "seller" && (
              <Link
                to="/seller-dashboard"
                className="block py-2 text-white hover:bg-green-600 px-4 rounded"
                onClick={() => setIsMenuOpen(false)}
              >
                Dashboard
              </Link>
            )}
            {isAuthenticated && user?.userType === "buyer" && (
              <Link
                to="/farmer-dashboard"
                className="block py-2 text-white hover:bg-green-600 px-4 rounded"
                onClick={() => setIsMenuOpen(false)}
              >
                Dashboard
              </Link>
            )}

            <div className="border-t border-green-600 my-2"></div>

            {!isAuthenticated ? (
              // Not authenticated - show login/register options
              <>
                <Link
                  to="/login"
                  className="flex items-center py-2 text-white hover:bg-green-600 px-4 rounded"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 mr-1.5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M3 3a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V3zm1 4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1V8a1 1 0 00-1-1H4zm7 4a1 1 0 11-2 0 1 1 0 012 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Login
                </Link>
                <Link
                  to="/register"
                  className="block py-2 text-white hover:bg-green-600 px-4 rounded"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Register
                </Link>
              </>
            ) : (
              // Authenticated - show profile & logout options
              <>
                {user && (
                  <div className="px-4 py-2 text-white font-medium">
                    Hello, {user.name}
                  </div>
                )}

                <button
                  onClick={() => {
                    handleLogout();
                    setIsMenuOpen(false);
                  }}
                  className="block w-full text-left py-2 text-white hover:bg-green-600 px-4 rounded"
                >
                  Logout
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
