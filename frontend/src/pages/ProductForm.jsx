import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { getProductById, createProduct, updateProduct } from "../services/marketplaceService";

const ProductForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = Boolean(id);
  
  const [product, setProduct] = useState({
    name: "",
    description: "",
    price: "",
    stock: "",
    category: "",
    imageUrl: "",
    unitType: "kg", // kg, liter, piece
  });
  
  const [isLoading, setIsLoading] = useState(isEditMode);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  
  useEffect(() => {
    if (isEditMode) {
      const loadProduct = async () => {
        try {
          const productData = await getProductById(id);
          setProduct(productData);
          setImagePreview(productData.imageUrl);
        } catch (error) {
          console.error("Failed to load product:", error);
          setError("Failed to load product. Please try again.");
        } finally {
          setIsLoading(false);
        }
      };
      
      loadProduct();
    }
  }, [id, isEditMode]);
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setProduct({
      ...product,
      [name]: name === "price" || name === "stock" ? parseFloat(value) || "" : value
    });
  };
  
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProduct({
        ...product,
        imageFile: file
      });
      
      // Preview image
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");
    
    try {
      if (isEditMode) {
        await updateProduct(id, product);
      } else {
        await createProduct(product);
      }
      navigate("/marketplace/seller");
    } catch (error) {
      console.error("Failed to save product:", error);
      setError("Failed to save product. Please check your inputs and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const pageTitle = isEditMode ? "Edit Product" : "Add New Product";
  
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
      
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">{pageTitle}</h1>
          <Link
            to="/marketplace/seller"
            className="text-green-600 hover:text-green-800 flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </Link>
        </div>
        
        {error && (
          <div className="p-4 mb-6 rounded-md bg-red-50 text-red-700">
            {error}
          </div>
        )}
        
        <div className="bg-white rounded-lg shadow-md overflow-hidden p-6 mb-10">
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="md:col-span-2">
                <div className="mb-6">
                  <label className="block text-gray-700 font-medium mb-2" htmlFor="name">
                    Product Name *
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    value={product.name}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Enter product name"
                  />
                </div>
                
                <div className="mb-6">
                  <label className="block text-gray-700 font-medium mb-2" htmlFor="description">
                    Description *
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    required
                    value={product.description}
                    onChange={handleChange}
                    rows="4"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Describe your product"
                  ></textarea>
                </div>
                
                <div className="grid grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-gray-700 font-medium mb-2" htmlFor="price">
                      Price (₹) *
                    </label>
                    <input
                      id="price"
                      name="price"
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      value={product.price}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="0.00"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-gray-700 font-medium mb-2" htmlFor="stock">
                        Stock *
                      </label>
                      <input
                        id="stock"
                        name="stock"
                        type="number"
                        min="0"
                        required
                        value={product.stock}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                        placeholder="0"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-gray-700 font-medium mb-2" htmlFor="unitType">
                        Unit
                      </label>
                      <select
                        id="unitType"
                        name="unitType"
                        value={product.unitType}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      >
                        <option value="kg">kg</option>
                        <option value="liter">liter</option>
                        <option value="piece">piece</option>
                        <option value="quintal">quintal</option>
                        <option value="ton">ton</option>
                      </select>
                    </div>
                  </div>
                </div>
                
                <div className="mb-6">
                  <label className="block text-gray-700 font-medium mb-2" htmlFor="category">
                    Category *
                  </label>
                  <select
                    id="category"
                    name="category"
                    required
                    value={product.category}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">Select a category</option>
                    <option value="fruits">Fruits</option>
                    <option value="vegetables">Vegetables</option>
                    <option value="grains">Grains</option>
                    <option value="dairy">Dairy Products</option>
                    <option value="seeds">Seeds</option>
                    <option value="fertilizers">Fertilizers</option>
                    <option value="pesticides">Pesticides</option>
                    <option value="tools">Tools & Equipment</option>
                  </select>
                </div>
              </div>
              
              <div className="md:col-span-1">
                <div className="mb-6">
                  <label className="block text-gray-700 font-medium mb-2">
                    Product Image
                  </label>
                  <div className="mt-1 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-6">
                    {imagePreview ? (
                      <div className="relative w-full">
                        <img
                          src={imagePreview}
                          alt="Product preview"
                          className="mx-auto h-48 object-contain rounded"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setImagePreview(null);
                            setProduct({ ...product, imageFile: null, imageUrl: "" });
                          }}
                          className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1 text-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="text-sm text-gray-500">Upload a product image</p>
                      </div>
                    )}
                  </div>
                  <input
                    id="image"
                    name="image"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="sr-only"
                  />
                  <label
                    htmlFor="image"
                    className="mt-2 flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="-ml-1 mr-2 h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    {imagePreview ? "Change Image" : "Upload Image"}
                  </label>
                </div>
                
                <div className="px-4 py-3 bg-gray-50 text-xs rounded-md text-gray-500">
                  <p className="font-medium mb-1">Image Guidelines:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>JPEG, PNG or WebP format</li>
                    <li>Maximum file size: 5MB</li>
                    <li>High resolution recommended</li>
                    <li>Clear, well-lit product image</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div className="border-t border-gray-200 pt-6 mt-6 flex justify-end">
              <Link
                to="/marketplace/seller"
                className="px-4 py-2 text-gray-600 hover:text-gray-800 mr-4"
              >
                Cancel
              </Link>
              <button
                type="submit"
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <span className="mr-2 animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></span>
                    Saving...
                  </>
                ) : (
                  `${isEditMode ? 'Update' : 'Add'} Product`
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
      
      <Footer />
    </div>
  );
};

export default ProductForm;