import axios from "axios";
import { API_URL, getToken } from "./api";

/**
 * Crop recommendations for a place. Sends the token when signed in so the
 * backend can use the farmer's saved state, irrigation and soil.
 */
export const getCropRecommendations = async (location, lang = "en") => {
  const token = getToken();
  const { data } = await axios.get(`${API_URL}/crops/recommendations`, {
    params: { ...(location ? { location } : {}), lang },
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return data;
};
