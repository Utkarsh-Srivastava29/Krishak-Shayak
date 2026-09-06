import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FaUser,
  FaEnvelope,
  FaLock,
  FaPhone,
  FaMapMarkerAlt,
  FaIdCard,
  FaSeedling,
  FaShoppingBasket,
} from "react-icons/fa";
import { MdError, MdCheckCircle } from "react-icons/md";
import { useTranslation } from "react-i18next";
import "./styles/animations.css";
import Header from "../components/Navbar";
import Footer from "../components/Footer";
import authService from "../services/authService";

const Register = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    userType: "seller", // Changed from "farmer" to "seller"
    address: "",
    aadharNumber: "",
    shopName: "",
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formStep, setFormStep] = useState(1);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [formSuccess, setFormSuccess] = useState(false);

  // Animation effect for smooth transitions
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [formStep]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: null,
      });
    }

    // Calculate password strength
    if (name === "password") {
      const strength = calculatePasswordStrength(value);
      setPasswordStrength(strength);
    }
  };

  const calculatePasswordStrength = (password) => {
    let strength = 0;
    if (password.length >= 8) strength += 1;
    if (/[A-Z]/.test(password)) strength += 1;
    if (/[0-9]/.test(password)) strength += 1;
    if (/[^A-Za-z0-9]/.test(password)) strength += 1;
    return strength;
  };

  const getPasswordStrengthLabel = () => {
    switch (passwordStrength) {
      case 0:
        return t("register.strengthWeak");
      case 1:
        return t("register.strengthFair");
      case 2:
        return t("register.strengthGood");
      case 3:
        return t("register.strengthStrong");
      case 4:
        return t("register.strengthVeryStrong");
      default:
        return t("register.strengthWeak");
    }
  };

  const getPasswordStrengthColor = () => {
    switch (passwordStrength) {
      case 0:
        return "bg-red-500";
      case 1:
        return "bg-orange-500";
      case 2:
        return "bg-yellow-500";
      case 3:
        return "bg-green-500";
      case 4:
        return "bg-green-600";
      default:
        return "bg-gray-300";
    }
  }; // Fixed missing bracket and extra bracket

  const validateStep1 = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = t("register.nameRequired");
    }

    if (!formData.email.trim()) {
      newErrors.email = t("register.emailRequired");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = t("register.emailInvalid");
    }

    if (!formData.phone.trim()) {
      newErrors.phone = t("register.phoneRequired");
    } else if (!/^\d{10}$/.test(formData.phone.trim())) {
      newErrors.phone = t("register.phone10Digits");
    }

    if (!formData.password) {
      newErrors.password = t("register.passwordRequired");
    } else if (formData.password.length < 6) {
      newErrors.password = t("register.passwordMinLength");
    }

    if (formData.confirmPassword !== formData.password) {
      newErrors.confirmPassword = t("register.passwordMismatch");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors = {};

    if (!formData.address.trim()) {
      newErrors.address = t("register.addressRequired");
    }

    if (formData.userType === "seller") {
      if (!formData.shopName.trim()) {
        newErrors.shopName = t("register.shopNameRequired");
      }

      if (!formData.aadharNumber.trim()) {
        newErrors.aadharNumber = t("register.aadharRequired");
      } else if (!/^\d{12}$/.test(formData.aadharNumber.trim())) {
        newErrors.aadharNumber = t("register.aadharInvalid");
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (validateStep1()) {
      setFormStep(2);
      window.scrollTo(0, 0);
    }
  };

  const prevStep = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setFormStep(1);
  };

  // Update your handleSubmit function with additional logging
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    if (formStep === 1) {
      nextStep();
      return;
    }

    if (!validateStep2()) {
      console.log("Validation failed for step 2");
      return;
    }

    setIsSubmitting(true);

    // Create the user data object and log it
    const userData = {
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      password: formData.password,
      userType: formData.userType,
      address: formData.address,
    };

    // Add seller-specific fields
    if (formData.userType === "seller") {
      userData.aadharNumber = formData.aadharNumber;
      userData.shopName = formData.shopName;
    }

    console.log("Attempting to register with data:", userData);

    try {
      // Call the register API
      console.log("Calling authService.register...");
      const response = await authService.register(userData);

      console.log("Registration successful:", response);

      // Show success animation
      setFormSuccess(true);

      // Redirect after showing success message
      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } catch (error) {
      console.error("Registration error:", error);

      // Get more detailed error information
      console.log("Error response:", error.response);
      console.log("Error request:", error.request);
      console.log("Error message:", error.message);

      // Get error message from response if available
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Registration failed. Please try again.";

      setErrors({
        ...errors,
        submit: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (formSuccess) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-gray-100 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 success-animation">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100">
                <MdCheckCircle className="h-10 w-10 text-green-600" />
              </div>
              <h2 className="mt-4 text-2xl font-bold text-gray-900">
                {t("register.successTitle")}
              </h2>
              <p className="mt-2 text-gray-600">
                {t("register.successMessage")}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                {t("register.redirecting")}
              </p>
            </div>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-gray-100 py-12 px-4 sm:px-6 lg:px-8 mt-16">
        {/* Decorative elements in the background */}
        <div className="fixed top-20 right-20 w-64 h-64 bg-yellow-200 rounded-full opacity-20 blur-3xl -z-10 pointer-events-none"></div>
        <div className="fixed bottom-20 left-20 w-96 h-96 bg-green-200 rounded-full opacity-20 blur-3xl -z-10 pointer-events-none"></div>
        <div className="fixed top-40 left-40 w-32 h-32 bg-green-300 rounded-full opacity-10 blur-2xl -z-10 pointer-events-none"></div>
        <div className="fixed bottom-40 right-32 w-48 h-48 bg-yellow-100 rounded-full opacity-15 blur-2xl -z-10 pointer-events-none"></div>

        {/* Your existing form and content remains the same */}
        <div className="max-w-md mx-auto bg-white rounded-lg shadow-xl overflow-hidden transform transition-all">
          <div className="bg-gradient-to-r from-green-700 to-green-600 py-6 px-6">
            <h2 className="text-center text-2xl font-bold text-white">
              {t("register.title")}
            </h2>
            <p className="mt-2 text-center text-sm text-yellow-200">
              {t("register.subtitle")}
            </p>
          </div>

          <div className="px-6 py-8">
            {/* Progress indicator */}
            <div className="mb-8">
              <div className="flex items-center justify-between">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                      formStep >= 1 ? "bg-green-600 text-white" : "bg-gray-300"
                    }`}
                  >
                    1
                  </div>
                  <span className="text-xs mt-1 font-medium">{t("register.stepAccount")}</span>
                </div>

                <div
                  className={`flex-1 h-1 mx-2 transition-all duration-500 ${
                    formStep >= 2 ? "bg-green-600" : "bg-gray-300"
                  }`}
                ></div>

                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                      formStep >= 2 ? "bg-green-600 text-white" : "bg-gray-300"
                    }`}
                  >
                    2
                  </div>
                  <span className="text-xs mt-1 font-medium">{t("register.stepDetails")}</span>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {formStep === 1 && (
                <div className="space-y-6 fade-in-animation">
                  {/* Step 1: Basic Information */}
                  <div>
                    <label
                      htmlFor="name"
                      className="block text-sm font-medium text-gray-700"
                    >
                      {t("register.nameLabel")}
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FaUser className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        name="name"
                        id="name"
                        value={formData.name}
                        onChange={handleChange}
                        className={`block w-full pl-10 pr-3 py-2 border ${
                          errors.name
                            ? "border-red-500"
                            : formData.name
                            ? "border-green-500"
                            : "border-gray-300"
                        } rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 transition-colors`}
                        placeholder={t("register.namePlaceholder")}
                      />
                      {errors.name ? (
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                          <MdError className="h-5 w-5 text-red-500" />
                        </div>
                      ) : formData.name ? (
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                          <MdCheckCircle className="h-5 w-5 text-green-500" />
                        </div>
                      ) : null}
                    </div>
                    {errors.name && (
                      <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="email"
                        className="block text-sm font-medium text-gray-700"
                      >
                        {t("register.emailLabel")}
                      </label>
                      <div className="mt-1 relative rounded-md shadow-sm">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <FaEnvelope className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          type="email"
                          name="email"
                          id="email"
                          value={formData.email}
                          onChange={handleChange}
                          className={`block w-full pl-10 pr-3 py-2 border ${
                            errors.email
                              ? "border-red-500"
                              : formData.email
                              ? "border-green-500"
                              : "border-gray-300"
                          } rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 transition-colors`}
                          placeholder={t("register.emailPlaceholder")}
                        />
                        {errors.email ? (
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                            <MdError className="h-5 w-5 text-red-500" />
                          </div>
                        ) : formData.email ? (
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                            <MdCheckCircle className="h-5 w-5 text-green-500" />
                          </div>
                        ) : null}
                      </div>
                      {errors.email && (
                        <p className="mt-1 text-sm text-red-600">
                          {errors.email}
                        </p>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="phone"
                        className="block text-sm font-medium text-gray-700"
                      >
                        {t("register.phoneLabel")}
                      </label>
                      <div className="mt-1 relative rounded-md shadow-sm">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <FaPhone className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          type="tel"
                          name="phone"
                          id="phone"
                          value={formData.phone}
                          onChange={handleChange}
                          className={`block w-full pl-10 pr-3 py-2 border ${
                            errors.phone
                              ? "border-red-500"
                              : formData.phone
                              ? "border-green-500"
                              : "border-gray-300"
                          } rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 transition-colors`}
                          placeholder={t("register.phonePlaceholder")}
                        />
                        {errors.phone ? (
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                            <MdError className="h-5 w-5 text-red-500" />
                          </div>
                        ) : formData.phone ? (
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                            <MdCheckCircle className="h-5 w-5 text-green-500" />
                          </div>
                        ) : null}
                      </div>
                      {errors.phone && (
                        <p className="mt-1 text-sm text-red-600">
                          {errors.phone}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="password"
                      className="block text-sm font-medium text-gray-700"
                    >
                      {t("register.passwordLabel")}
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FaLock className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="password"
                        name="password"
                        id="password"
                        value={formData.password}
                        onChange={handleChange}
                        className={`block w-full pl-10 pr-3 py-2 border ${
                          errors.password
                            ? "border-red-500"
                            : formData.password
                            ? "border-green-500"
                            : "border-gray-300"
                        } rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 transition-colors`}
                        placeholder="••••••"
                      />
                      {errors.password ? (
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                          <MdError className="h-5 w-5 text-red-500" />
                        </div>
                      ) : formData.password ? (
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                          <MdCheckCircle className="h-5 w-5 text-green-500" />
                        </div>
                      ) : null}
                    </div>
                    {errors.password && (
                      <p className="mt-1 text-sm text-red-600">
                        {errors.password}
                      </p>
                    )}

                    {/* Password strength indicator */}
                    {formData.password && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs text-gray-500">
                            {t("register.passwordStrength")}
                          </p>
                          <p
                            className={`text-xs font-medium ${
                              passwordStrength >= 3
                                ? "text-green-600"
                                : passwordStrength >= 2
                                ? "text-yellow-600"
                                : "text-red-600"
                            }`}
                          >
                            {getPasswordStrengthLabel()}
                          </p>
                        </div>
                        <div className="h-1.5 w-full bg-gray-200 rounded-full">
                          <div
                            className={`h-1.5 rounded-full transition-all duration-300 ${getPasswordStrengthColor()}`}
                            style={{
                              width: `${(passwordStrength / 4) * 100}%`,
                            }}
                          ></div>
                        </div>
                        <div className="mt-2 text-xs text-gray-500 grid grid-cols-2 gap-1">
                          <p
                            className={
                              formData.password.length >= 8
                                ? "text-green-600"
                                : ""
                            }
                          >
                            • {t("register.rule8Chars")}
                          </p>
                          <p
                            className={
                              /[A-Z]/.test(formData.password)
                                ? "text-green-600"
                                : ""
                            }
                          >
                            • {t("register.ruleUppercase")}
                          </p>
                          <p
                            className={
                              /[0-9]/.test(formData.password)
                                ? "text-green-600"
                                : ""
                            }
                          >
                            • {t("register.ruleNumber")}
                          </p>
                          <p
                            className={
                              /[^A-Za-z0-9]/.test(formData.password)
                                ? "text-green-600"
                                : ""
                            }
                          >
                            • {t("register.ruleSpecial")}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="confirmPassword"
                      className="block text-sm font-medium text-gray-700"
                    >
                      {t("register.confirmPasswordLabel")}
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FaLock className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="password"
                        name="confirmPassword"
                        id="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        className={`block w-full pl-10 pr-3 py-2 border ${
                          errors.confirmPassword
                            ? "border-red-500"
                            : formData.confirmPassword &&
                              formData.confirmPassword === formData.password
                            ? "border-green-500"
                            : "border-gray-300"
                        } rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 transition-colors`}
                        placeholder="••••••"
                      />
                      {errors.confirmPassword ? (
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                          <MdError className="h-5 w-5 text-red-500" />
                        </div>
                      ) : formData.confirmPassword &&
                        formData.confirmPassword === formData.password ? (
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                          <MdCheckCircle className="h-5 w-5 text-green-500" />
                        </div>
                      ) : null}
                    </div>
                    {errors.confirmPassword && (
                      <p className="mt-1 text-sm text-red-600">
                        {errors.confirmPassword}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {formStep === 2 && (
                <div className="space-y-6 fade-in-animation">
                  {/* Step 2: Additional Details */}
                  <div>
                    <label
                      htmlFor="userType"
                      className="block text-sm font-medium text-gray-700 mb-3"
                    >
                      {t("register.iAmA")}
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <div
                        className={`border rounded-lg p-4 text-center cursor-pointer transition-all hover:shadow-md ${
                          formData.userType === "seller"
                            ? "bg-green-50 border-green-500 ring-2 ring-green-500 shadow-md"
                            : "border-gray-300 hover:bg-gray-50"
                        }`}
                        onClick={() =>
                          handleChange({
                            target: { name: "userType", value: "seller" },
                          })
                        }
                      >
                        <div className="mx-auto w-16 h-16 flex items-center justify-center rounded-full bg-green-100 mb-3 transform transition hover:scale-110">
                          <FaSeedling className="h-8 w-8 text-green-600" />
                        </div>
                        <div className="font-medium text-lg mb-1">{t("register.seller")}</div>
                        <p className="text-sm text-gray-500">
                          {t("register.sellerDesc")}
                        </p>
                      </div>

                      <div
                        className={`border rounded-lg p-4 text-center cursor-pointer transition-all hover:shadow-md ${
                          formData.userType === "buyer"
                            ? "bg-green-50 border-green-500 ring-2 ring-green-500 shadow-md"
                            : "border-gray-300 hover:bg-gray-50"
                        }`}
                        onClick={() =>
                          handleChange({
                            target: { name: "userType", value: "buyer" },
                          })
                        }
                      >
                        <div className="mx-auto w-16 h-16 flex items-center justify-center rounded-full bg-green-100 mb-3 transform transition hover:scale-110">
                          <FaShoppingBasket className="h-8 w-8 text-green-600" />
                        </div>
                        <div className="font-medium text-lg mb-1">{t("register.buyer")}</div>
                        <p className="text-sm text-gray-500">
                          {t("register.buyerDesc")}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="address"
                      className="block text-sm font-medium text-gray-700"
                    >
                      {t("register.addressLabel")}
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute top-3 left-3 flex items-start pointer-events-none">
                        <FaMapMarkerAlt className="h-5 w-5 text-gray-400" />
                      </div>
                      <textarea
                        name="address"
                        id="address"
                        rows="3"
                        value={formData.address}
                        onChange={handleChange}
                        className={`block w-full pl-10 pr-3 py-2 border ${
                          errors.address
                            ? "border-red-500"
                            : formData.address
                            ? "border-green-500"
                            : "border-gray-300"
                        } rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 transition-colors`}
                        placeholder={t("register.addressPlaceholder")}
                      ></textarea>
                      {errors.address ? (
                        <div className="absolute top-2 right-3">
                          <MdError className="h-5 w-5 text-red-500" />
                        </div>
                      ) : formData.address ? (
                        <div className="absolute top-2 right-3">
                          <MdCheckCircle className="h-5 w-5 text-green-500" />
                        </div>
                      ) : null}
                    </div>
                    {errors.address && (
                      <p className="mt-1 text-sm text-red-600">
                        {errors.address}
                      </p>
                    )}
                  </div>

                  {formData.userType === "seller" && (
                    <>
                      <div className="fade-in-animation">
                        <label
                          htmlFor="shopName"
                          className="block text-sm font-medium text-gray-700"
                        >
                          {t("register.shopNameLabel")}
                        </label>
                        <div className="mt-1 relative rounded-md shadow-sm">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <FaShoppingBasket className="h-5 w-5 text-gray-400" />
                          </div>
                          <input
                            type="text"
                            name="shopName"
                            id="shopName"
                            value={formData.shopName}
                            onChange={handleChange}
                            className={`block w-full pl-10 pr-3 py-2 border ${
                              errors.shopName
                                ? "border-red-500"
                                : formData.shopName
                                ? "border-green-500"
                                : "border-gray-300"
                            } rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 transition-colors`}
                            placeholder={t("register.shopNamePlaceholder")}
                          />
                          {errors.shopName ? (
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                              <MdError className="h-5 w-5 text-red-500" />
                            </div>
                          ) : formData.shopName ? (
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                              <MdCheckCircle className="h-5 w-5 text-green-500" />
                            </div>
                          ) : null}
                        </div>
                        {errors.shopName && (
                          <p className="mt-1 text-sm text-red-600">
                            {errors.shopName}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-gray-500">
                          {t("register.shopNameHint")}
                        </p>
                      </div>

                      <div className="fade-in-animation">
                        <label
                          htmlFor="aadharNumber"
                          className="block text-sm font-medium text-gray-700"
                        >
                          {t("register.aadharLabel")}
                        </label>
                        <div className="mt-1 relative rounded-md shadow-sm">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <FaIdCard className="h-5 w-5 text-gray-400" />
                          </div>
                          <input
                            type="text"
                            name="aadharNumber"
                            id="aadharNumber"
                            value={formData.aadharNumber}
                            onChange={handleChange}
                            className={`block w-full pl-10 pr-3 py-2 border ${
                              errors.aadharNumber
                                ? "border-red-500"
                                : formData.aadharNumber
                                ? "border-green-500"
                                : "border-gray-300"
                            } rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 transition-colors`}
                            placeholder="123456789012"
                            maxLength="12"
                          />
                          {errors.aadharNumber ? (
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                              <MdError className="h-5 w-5 text-red-500" />
                            </div>
                          ) : formData.aadharNumber ? (
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                              <MdCheckCircle className="h-5 w-5 text-green-500" />
                            </div>
                          ) : null}
                        </div>
                        {errors.aadharNumber && (
                          <p className="mt-1 text-sm text-red-600">
                            {errors.aadharNumber}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-gray-500">
                          {t("register.aadharHint")}
                        </p>
                      </div>
                    </>
                  )}

                  {errors.submit && (
                    <div className="bg-red-50 border border-red-300 rounded-md p-3">
                      <p className="text-sm text-red-600">{errors.submit}</p>
                    </div>
                  )}
                </div>
              )}
            </form>

              <div className="flex items-center justify-between pt-4">
                {formStep === 2 ? (
                  <>
                    <button
                      type="button"
                      onClick={prevStep}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 mr-1"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 19l-7-7 7-7"
                        />
                      </svg>
                      {t("register.back")}
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className="inline-flex items-center justify-center px-6 py-2.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors disabled:opacity-75 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <>
                          <svg
                            className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                          {t("register.processing")}
                        </>
                      ) : (
                        <>
                          {t("register.register")}
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5 ml-1"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="w-full inline-flex items-center justify-center px-6 py-2.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors disabled:opacity-75 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <svg
                          className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        {t("register.processing")}
                      </>
                    ) : (
                      <>
                        {t("register.continue")}
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5 ml-1"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </>
                    )}
                  </button>
                )}
              </div>

            <div className="mt-8 border-t border-gray-200 pt-6">
              <p className="text-center text-sm text-gray-600 mb-6">
                {t("register.alreadyHaveAccount")}{" "}
                <Link
                  to="/login"
                  className="font-medium text-green-600 hover:text-green-500 transition-colors"
                >
                  {t("register.loginHere")}
                </Link>
              </p>

              {/* Social registration options */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">
                    {t("register.orRegisterWith")}
                  </span>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <svg
                    className="h-5 w-5 text-blue-600"
                    aria-hidden="true"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M22.675 0H1.325C.593 0 0 .593 0 1.325v21.351C0 23.407.593 24 1.325 24H12.82v-9.294H9.692v-3.622h3.128V8.413c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12V24h6.116c.73 0 1.323-.593 1.323-1.325V1.325C24 .593 23.407 0 22.675 0z" />
                  </svg>
                </button>

                <button
                  type="button"
                  className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <svg
                    className="h-5 w-5 text-red-600"
                    aria-hidden="true"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default Register;
