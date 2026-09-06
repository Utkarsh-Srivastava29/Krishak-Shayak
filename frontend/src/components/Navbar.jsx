import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getCartItems } from "../services/marketplaceService";
import { authService } from "../services/api";

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const toggleLanguage = () => {
    const next = i18n.language === 'en' ? 'hi' : 'en';
    i18n.changeLanguage(next);
  };

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
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
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
            <img
              src="/favicon/favicon.png"
              alt="Krishak Shayak Logo"
              className="h-8 w-8 rounded-full object-cover"
            />
            <span className="text-white font-bold text-xl">Krishak Shayak</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            <Link to="/" className="text-white hover:text-yellow-300 transition">{t('navbar.home')}</Link>
            <Link to="/marketplace" className="text-white hover:text-yellow-300 transition">{t('navbar.marketplace')}</Link>
            <Link to="/market-price" className="text-white hover:text-yellow-300 transition">{t('navbar.marketPrice')}</Link>
            <Link to="/weather" className="text-white hover:text-yellow-300 transition">{t('navbar.weather')}</Link>
            <Link to="/govt-schemes" className="text-white hover:text-yellow-300 transition">{t('navbar.govtSchemes')}</Link>
            {isAuthenticated && user?.userType === "seller" && (
              <Link to="/seller-dashboard" className="text-white hover:text-yellow-300 transition">{t('navbar.dashboard')}</Link>
            )}
            {isAuthenticated && user?.userType === "buyer" && (
              <Link to="/farmer-dashboard" className="text-white hover:text-yellow-300 transition">{t('navbar.dashboard')}</Link>
            )}
          </div>

          {/* User & Cart Menu */}
          <div className="flex items-center space-x-4">
            {/* Language Toggle */}
            <button
              onClick={toggleLanguage}
              className="hidden md:flex items-center gap-1 bg-white bg-opacity-20 hover:bg-opacity-30 text-white text-sm font-semibold px-3 py-1.5 rounded-full transition-all border border-white border-opacity-30"
              title="Switch Language"
            >
              <span>{i18n.language === 'en' ? '🇮🇳 हिंदी' : '🇬🇧 English'}</span>
            </button>

            {/* Show either login/register buttons or user info & logout button */}
            <div className="hidden md:flex items-center space-x-3">
              {!isAuthenticated ? (
                <>
                  <Link
                    to="/login"
                    className="flex items-center bg-yellow-400 hover:bg-yellow-500 text-green-800 font-medium py-1.5 px-4 rounded transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V3zm1 4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1V8a1 1 0 00-1-1H4zm7 4a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" />
                    </svg>
                    {t('navbar.login')}
                  </Link>
                  <Link to="/register" className="flex items-center text-white hover:text-yellow-300 transition-colors">
                    {t('navbar.register')}
                  </Link>
                </>
              ) : (
                <div className="flex items-center">
                  <div className="relative">
                    <button
                      onClick={toggleProfile}
                      className="flex items-center text-white hover:text-yellow-300 transition-colors focus:outline-none"
                    >
                      <span className="mr-2">{user?.name}</span>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                      </svg>
                    </button>
                    {isProfileOpen && (
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
                        {user?.userType === "seller" && (
                          <Link to="/seller-dashboard" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" onClick={() => setIsProfileOpen(false)}>
                            {t('navbar.sellerDashboard')}
                          </Link>
                        )}
                        {user?.userType === "buyer" && (
                          <Link to="/farmer-dashboard" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" onClick={() => setIsProfileOpen(false)}>
                            {t('navbar.dashboard')}
                          </Link>
                        )}
                        <button
                          onClick={() => { handleLogout(); setIsProfileOpen(false); }}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          {t('navbar.logout')}
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
            <Link to="/" className="block py-2 text-white hover:bg-green-600 px-4 rounded" onClick={() => setIsMenuOpen(false)}>{t('navbar.home')}</Link>
            <Link to="/marketplace" className="block py-2 text-white hover:bg-green-600 px-4 rounded" onClick={() => setIsMenuOpen(false)}>{t('navbar.marketplace')}</Link>
            <Link to="/market-price" className="block py-2 text-white hover:bg-green-600 px-4 rounded" onClick={() => setIsMenuOpen(false)}>{t('navbar.marketPrice')}</Link>
            <Link to="/weather" className="block py-2 text-white hover:bg-green-600 px-4 rounded" onClick={() => setIsMenuOpen(false)}>{t('navbar.weather')}</Link>
            <Link to="/govt-schemes" className="block py-2 text-white hover:bg-green-600 px-4 rounded" onClick={() => setIsMenuOpen(false)}>{t('navbar.govtSchemes')}</Link>

            {isAuthenticated && user?.userType === "seller" && (
              <Link to="/seller-dashboard" className="block py-2 text-white hover:bg-green-600 px-4 rounded" onClick={() => setIsMenuOpen(false)}>{t('navbar.dashboard')}</Link>
            )}
            {isAuthenticated && user?.userType === "buyer" && (
              <Link to="/farmer-dashboard" className="block py-2 text-white hover:bg-green-600 px-4 rounded" onClick={() => setIsMenuOpen(false)}>{t('navbar.dashboard')}</Link>
            )}

            <div className="border-t border-green-600 my-2"></div>

            {!isAuthenticated ? (
              <>
                <Link to="/login" className="flex items-center py-2 text-white hover:bg-green-600 px-4 rounded" onClick={() => setIsMenuOpen(false)}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V3zm1 4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1V8a1 1 0 00-1-1H4zm7 4a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" />
                  </svg>
                  {t('navbar.login')}
                </Link>
                <Link to="/register" className="block py-2 text-white hover:bg-green-600 px-4 rounded" onClick={() => setIsMenuOpen(false)}>
                  {t('navbar.register')}
                </Link>
              </>
            ) : (
              <>
                {user && (
                  <div className="px-4 py-2 text-white font-medium">Hello, {user.name}</div>
                )}
                <button
                  onClick={() => { handleLogout(); setIsMenuOpen(false); }}
                  className="block w-full text-left py-2 text-white hover:bg-green-600 px-4 rounded"
                >
                  {t('navbar.logout')}
                </button>
              </>
            )}

            {/* Mobile Language Toggle */}
            <div className="border-t border-green-600 my-2"></div>
            <button
              onClick={() => { toggleLanguage(); setIsMenuOpen(false); }}
              className="flex items-center gap-2 py-2 px-4 text-white hover:bg-green-600 rounded w-full"
            >
              <span>{i18n.language === 'en' ? '🇮🇳 हिंदी में देखें' : '🇬🇧 View in English'}</span>
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
