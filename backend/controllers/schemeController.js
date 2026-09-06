const axios = require("axios");
const Papa = require("papaparse");

const SCHEMES_SHEET_URL = process.env.SCHEMES_SHEET_URL;

// @desc    Get all government schemes from Google Sheets CSV
// @route   GET /api/schemes
// @access  Public
exports.getAllSchemes = async (req, res) => {
  try {
    if (!SCHEMES_SHEET_URL) {
      return res
        .status(500)
        .json({ message: "SCHEMES_SHEET_URL not configured on server" });
    }

    const response = await axios.get(SCHEMES_SHEET_URL);

    // Parse CSV to JSON
    const parsed = Papa.parse(response.data, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) =>
        header.trim().toLowerCase().replace(/\s+/g, "_"),
    });

    // Transform data
    const schemes = parsed.data.map((scheme, index) => ({
      id: parseInt(scheme.id) || index + 1,
      name: scheme.name || "",
      department: scheme.department || "",
      launch_date: scheme.launch_date || "Not known",
      description: scheme.description || "",
      eligibility: scheme.eligibility || "",
      benefits: scheme.benefits || "",
      official_link: scheme.official_link || "",
    }));

    res.json(schemes);
  } catch (error) {
    console.error("Schemes API error:", error.message);
    res.status(500).json({
      message: "Failed to load government schemes",
      error: error.message,
    });
  }
};
