import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const CropGuide = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-green-800 mb-6">Crop Guide</h1>
        <p className="text-lg mb-8">This page will contain detailed information about different crops, their cultivation methods, and best practices.</p>
        
        {/* Placeholder content */}
        <div className="bg-white p-8 rounded-xl shadow-lg">
          <p className="text-gray-600">Coming soon...</p>
        </div>
      </div>
      
      <Footer />
    </div>
  );
};

export default CropGuide;