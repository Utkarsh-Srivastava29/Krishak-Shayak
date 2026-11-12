import { API_URL, getToken } from "./api";

const request = async (path, { method = "GET", body } = {}) => {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Request failed");
  return data;
};

/** Long-term memory the assistant keeps about the signed-in farmer. */
export const getMemories = () => request("/memory").then((d) => d.memories);
export const addMemory = (memory) => request("/memory", { method: "POST", body: memory });
export const updateMemory = (id, changes) => request(`/memory/${id}`, { method: "PATCH", body: changes });
export const deleteMemory = (id) => request(`/memory/${id}`, { method: "DELETE" });
export const deleteAllMemories = () => request("/memory", { method: "DELETE" });

/** Proactive alerts (weather, prices, schemes) for the signed-in farmer. */
export const getNotifications = () => request("/notifications");
export const markNotificationRead = (id) => request(`/notifications/${id}/read`, { method: "PATCH" });
