import axios from "axios";
import { API_URL } from "./api";

/** Agriculture news from the backend (the NewsData.io key stays on the server). */
export const getAgriNews = async (lang = "en") => {
  const { data } = await axios.get(`${API_URL}/news`, { params: { lang } });
  return data;
};
