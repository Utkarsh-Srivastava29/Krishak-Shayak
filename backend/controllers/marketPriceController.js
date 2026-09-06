const axios = require("axios");

const DATA_GOV_API_KEY =
  process.env.DATA_GOV_API_KEY ||
  "579b464db66ec23bdd00000193b99a55112f47fa73efacc0606e14af";

const DATA_GOV_RESOURCE_ID = "9ef84268-d588-465a-a308-a864a43d0070";

// @desc    Get commodity market prices from data.gov.in
// @route   GET /api/market-prices?state=<state>&district=<district>&market=<market>&commodity=<commodity>&variety=<variety>&grade=<grade>
// @access  Public
exports.getMarketPrices = async (req, res) => {
  try {
    const { state, district, market, commodity, variety, grade } = req.query;

    if (!state) {
      return res
        .status(400)
        .json({ message: "State query parameter is required" });
    }

    // Build the data.gov.in API URL
    let apiUrl = `https://api.data.gov.in/resource/${DATA_GOV_RESOURCE_ID}?api-key=${DATA_GOV_API_KEY}&format=json&limit=10000`;

    if (state) {
      apiUrl += `&filters[state.keyword]=${encodeURIComponent(state)}`;
    }
    if (district) {
      apiUrl += `&filters[district]=${encodeURIComponent(district)}`;
    }
    if (market) {
      apiUrl += `&filters[market]=${encodeURIComponent(market)}`;
    }
    if (commodity) {
      apiUrl += `&filters[commodity]=${encodeURIComponent(commodity)}`;
    }
    if (variety) {
      apiUrl += `&filters[variety]=${encodeURIComponent(variety)}`;
    }
    if (grade) {
      apiUrl += `&filters[grade]=${encodeURIComponent(grade)}`;
    }

    const response = await axios.get(apiUrl);

    if (!response.data.records || response.data.records.length === 0) {
      return res
        .status(404)
        .json({ message: "No data available for the selected criteria" });
    }

    res.json({
      count: response.data.records.length,
      records: response.data.records,
    });
  } catch (error) {
    console.error("Market price API error:", error.message);
    res.status(500).json({
      message: "Failed to fetch market prices",
      error: error.message,
    });
  }
};
