import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { getOrderById } from "../services/marketplaceService";

const OrderDetail = () => {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadOrder = async () => {
      setIsLoading(true);
      try {
        const orderData = await getOrderById(id);
        setOrder(orderData);
      } catch (error) {
        console.error("Failed to load order details:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadOrder();
  }, [id]);
  
  const formatDate = (dateString) => {
    const options = { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString('en-IN', options);
  };
  
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(amount);
  };
  
  const getStatusColor = (status) => {
    switch(status) {
      case 'processing':
        return 'bg-blue-100 text-blue-700';
      case 'shipped':
        return 'bg-yellow-100 text-yellow-700';
      case 'delivered':
        return 'bg-green-100 text-green-700';
      case 'cancelled':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
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
  
  if (!order) {
    return (
      <div>
        <Navbar />
        <div className="container mx-auto px-4 py-16 max-w-4xl">
          <div className="bg-red-50 text-red-700 p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-2">Order Not Found</h2>
            <p>We couldn't find the order you're looking for. It may have been removed or you may have entered an incorrect order ID.</p>
            <Link to="/orders" className="mt-4 inline-flex items-center text-green-600 hover:text-green-800">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to My Orders
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex flex-col md:flex-row items-center justify-between mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Order #{id}</h1>
          
          <div className="mt-4 md:mt-0">
            <Link to="/orders" className="flex items-center text-green-600 hover:text-green-800">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to My Orders
            </Link>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex flex-col md:flex-row justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-2">Order Information</h2>
              <p className="text-gray-600">
                <span className="font-medium">Date Placed:</span> {formatDate(order.date)}
              </p>
              <p className="text-gray-600">
                <span className="font-medium">Order Total:</span> {formatCurrency(order.total)}
              </p>
            </div>
            <div className="mt-4 md:mt-0">
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.status)}`}>
                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
              </span>
            </div>
          </div>
          
          <hr className="my-6" />
          
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Items</h2>
          
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-4 px-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-12 w-12 flex-shrink-0">
                          <img 
                            src={item.image || `https://via.placeholder.com/100?text=${item.name}`} 
                            alt={item.name}
                            className="h-full w-full object-cover rounded-md"
                          />
                        </div>
                        <div className="ml-4">
                          <Link 
                            to={`/marketplace/${item.id}`}
                            className="text-gray-800 font-medium hover:text-green-600"
                          >
                            {item.name}
                          </Link>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 whitespace-nowrap text-gray-600">
                      {formatCurrency(item.price)}
                    </td>
                    <td className="py-4 px-4 whitespace-nowrap text-gray-600">
                      {item.quantity}
                    </td>
                    <td className="py-4 px-4 whitespace-nowrap font-medium text-gray-800">
                      {formatCurrency(item.price * item.quantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Shipping Information</h2>
            <p className="text-gray-600 mb-1">{order.shipping?.name || "Customer Name"}</p>
            <p className="text-gray-600 mb-1">{order.shipping?.address || "123 Street Address"}</p>
            <p className="text-gray-600 mb-1">
              {order.shipping?.city || "City"}, {order.shipping?.state || "State"} {order.shipping?.pincode || "Pincode"}
            </p>
            <p className="text-gray-600">Phone: {order.shipping?.phone || "9876543210"}</p>
          </div>
          
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Payment Summary</h2>
            
            <div className="flex justify-between py-2">
              <span className="text-gray-600">Subtotal</span>
              <span className="text-gray-800">{formatCurrency(order.subtotal || (order.total - (order.shipping?.cost || 0)))}</span>
            </div>
            
            <div className="flex justify-between py-2">
              <span className="text-gray-600">Shipping</span>
              <span className="text-gray-800">{formatCurrency(order.shipping?.cost || 0)}</span>
            </div>
            
            <hr className="my-2" />
            
            <div className="flex justify-between py-2">
              <span className="text-gray-800 font-medium">Total</span>
              <span className="text-green-600 font-bold">{formatCurrency(order.total)}</span>
            </div>
            
            <div className="mt-4 pt-4 border-t">
              <p className="text-gray-600">
                <span className="font-medium">Payment Method:</span> {order.paymentMethod || "Cash on Delivery"}
              </p>
              <p className="text-gray-600">
                <span className="font-medium">Payment Status:</span> {order.paymentStatus || "Paid"}
              </p>
            </div>
          </div>
        </div>
        
        {order.status === 'delivered' && (
          <div className="mt-6 text-center">
            <Link
              to="/marketplace"
              className="inline-block bg-green-600 hover:bg-green-700 text-white py-2 px-6 rounded-lg font-medium"
            >
              Buy Again
            </Link>
          </div>
        )}
      </div>
      
      <Footer />
    </div>
  );
};

export default OrderDetail;