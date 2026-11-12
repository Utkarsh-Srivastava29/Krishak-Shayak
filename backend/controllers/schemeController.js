const { fetchSchemes } = require("../services/schemeDataService");
const { translateFields } = require("../services/translationService");

const TRANSLATED_FIELDS = ["name", "department", "description", "eligibility", "benefits"];

// @desc    Get all government schemes from Google Sheets CSV
// @route   GET /api/schemes?lang=<en|hi>
// @access  Public
// The sheet is English-only; lang=hi returns Hindi translations (cached),
// falling back to English per scheme when translation is unavailable.
exports.getAllSchemes = async (req, res) => {
  try {
    const schemes = await fetchSchemes();
    if (req.query.lang === "hi") {
      return res.json(await translateFields(schemes, TRANSLATED_FIELDS));
    }
    res.json(schemes);
  } catch (error) {
    console.error("Schemes API error:", error.message);
    res.status(500).json({
      message: "Failed to load government schemes",
      error: error.message,
    });
  }
};
