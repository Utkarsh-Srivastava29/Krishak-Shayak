import { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { authService } from '../services/api';

// This component will check if the user is authenticated and has the right role
const ProtectedRoute = ({ children, requiredUserType }) => {
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Try to get user from local/session storage
        const currentUser = authService.getCurrentUser();
        
        setUser(currentUser);
      } catch (error) {
        console.error('Auth check error:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuth();
  }, []);
  
  if (isLoading) {
    // Show loading state
    return (
      <div className="min-h-screen flex justify-center items-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-green-500"></div>
      </div>
    );
  }
  
  // If not logged in, redirect to login
  if (!user) {
    console.log('User not authenticated, redirecting to login');
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  // If requiredUserType is specified, check user type
  if (requiredUserType && user.userType !== requiredUserType) {
    console.log(`User is not a ${requiredUserType}, redirecting`);
    
    // Redirect sellers to seller dashboard, buyers to marketplace
    if (user.userType === 'seller') {
      return <Navigate to="/seller-dashboard" replace />;
    } else {
      return <Navigate to="/marketplace" replace />;
    }
  }
  
  // User is authenticated and has the right user type (or no specific type required)
  return children;
};

export default ProtectedRoute;