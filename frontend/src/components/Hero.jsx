import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

const Hero = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <section className="relative bg-green-700 text-white">
      <div
        className="absolute inset-0 opacity-30 bg-cover bg-center"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?ixlib=rb-4.0.3&auto=format&fit=crop&w=1470&q=80')",
        }}
      ></div>
      <div className="container mx-auto px-4 py-16 md:py-24 relative z-10">
        <div className="max-w-3xl">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            {t('hero.title')}
          </h1>
          <p className="text-xl mb-8">
            {t('hero.subtitle')}
          </p>
          <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
            <button
              onClick={() => navigate("/market-price")}
              className="bg-yellow-500 hover:bg-yellow-600 text-green-900 font-bold py-3 px-6 rounded-lg shadow-lg transition transform hover:scale-105"
            >
              {t('hero.checkPrices')}
            </button>
            <button
              onClick={() => navigate("/marketplace")}
              className="bg-white hover:bg-gray-100 text-green-800 font-bold py-3 px-6 rounded-lg shadow-lg transition transform hover:scale-105"
            >
              {t('hero.farmersShop')}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
