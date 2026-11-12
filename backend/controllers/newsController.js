const { getAgriNews } = require("../services/newsService");

// @desc    Agriculture news (Hindi or English)
// @route   GET /api/news?lang=<en|hi>
// @access  Public
exports.getNews = async (req, res) => {
  try {
    res.json(await getAgriNews({ lang: req.query.lang === "hi" ? "hi" : "en" }));
  } catch (error) {
    const status = error.statusCode || 500;
    console.error("News error:", error.message);
    res.status(status).json({ message: status === 503 ? error.message : "Failed to load news" });
  }
};
