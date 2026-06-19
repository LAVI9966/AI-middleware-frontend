import axios from "@/utils/interceptor";

const URL = process.env.NEXT_PUBLIC_SERVER_URL;

export const getAgentAnalyticsApi = async (bridge_id, queryParams = {}) => {
  try {
    const response = await axios.get(`${URL}/api/analytics/agent/${encodeURIComponent(bridge_id)}`, {
      params: queryParams,
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching agent analytics:", error);
    throw error;
  }
};

export const getAgentAnalyticsFiltersApi = async (bridge_id) => {
  try {
    const response = await axios.get(`${URL}/api/analytics/agent/${encodeURIComponent(bridge_id)}/filters`);
    return response.data;
  } catch (error) {
    console.error("Error fetching agent analytics filters:", error);
    throw error;
  }
};
