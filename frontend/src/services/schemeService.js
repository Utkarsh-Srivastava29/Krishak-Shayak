import axios from "axios";
import { API_URL } from "./api";

export const getAllSchemes = async () => {
  try {
    const response = await axios.get(`${API_URL}/schemes`);
    return response.data;
  } catch (error) {
    console.error("Error fetching schemes from backend:", error);
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
