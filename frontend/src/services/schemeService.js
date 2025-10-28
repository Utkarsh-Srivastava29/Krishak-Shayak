import axios from "axios";
import Papa from "papaparse";

// Google Sheets published CSV URL from environment variable
const GOOGLE_SHEETS_URL = import.meta.env.VITE_SCHEMES_SHEET_URL;

export const getAllSchemes = async () => {
  try {
    const response = await axios.get(GOOGLE_SHEETS_URL);

    // Parse CSV to JSON
    const parsed = Papa.parse(response.data, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) =>
        header.trim().toLowerCase().replace(/\s+/g, "_"),
    });

    // Transform data and maintain the order from the sheet
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

    // Return schemes in the same order as the sheet (no sorting)
    return schemes;
  } catch (error) {
    console.error("Error fetching schemes from Google Sheets:", error);
    throw new Error(
      "Failed to load government schemes. Please try again later."
    );
  }
};

export const getSchemeById = async (id) => {
  try {
    const schemes = await getAllSchemes();
    return schemes.find((scheme) => scheme.id === parseInt(id));
  } catch (error) {
    console.error("Error fetching scheme:", error);
    throw error;
  }
};
