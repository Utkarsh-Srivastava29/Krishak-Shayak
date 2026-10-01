const { fetchSchemes } = require("../services/schemeDataService");

// @desc    Get all government schemes from Google Sheets CSV
// @route   GET /api/schemes
// @access  Public
exports.getAllSchemes = async (req, res) => {
  try {
    const schemes = await fetchSchemes();
    res.json(schemes);
  } catch (error) {
    console.error("Schemes API error:", error.message);
    res.status(500).json({
      message: "Failed to load government schemes",
      error: error.message,
    });
  }
};
