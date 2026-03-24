import axios from "@/utils/interceptor";
import { toast } from "react-toastify";
const URL = process.env.NEXT_PUBLIC_SERVER_URL;

// Integration Management APIs
export const createIntegrationApi = async (data, type) => {
  try {
    const response = await axios.post(`${URL}/api/embed/`, data);
    if (type == "rag_embed") {
      toast.success("Rag Embed created successfully");
    } else {
      toast.success("GTWY Embed created successfully");
    }
    return response?.data;
  } catch (error) {
    toast.error(error?.response?.data?.message);
    console.error(error);
    return error;
  }
};

export const getAllIntegrationApi = async () => {
  try {
    const response = await axios.get(`${URL}/api/embed/`);
    return response.data;
  } catch (error) {
    console.error(error);
    return error;
  }
};

export const updateIntegrationData = async (dataToSend) => {
  try {
    const response = await axios.put(`${URL}/api/embed/`, { folder_id: dataToSend?.folder_id, ...dataToSend });
    return response;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

export const generateAffiliateEmbedTokenApi = async (data) => {
  try {
    const response = await axios.post(`${URL}/api/utils/affiliate/embed-token`, data);
    return response?.data;
  } catch (error) {
    console.error(error);
    return error;
  }
};

export const generateGtwyAccessTokenApi = async () => {
  try {
    const response = await axios.post(`${URL}/api/utils/token`, {
      type: "embed",
    });
    return response;
  } catch (error) {
    console.error(error);
    return error;
  }
};

export const generateEmbedTokenApi = async (data) => {
  try {
    const response = await axios.post(`${URL}/api/utils/token`, {
      type: "embed_preview",
      ...data,
    });
    return response;
  } catch (error) {
    console.error(error);
    return error;
  }
};

export const generateRagEmbedTokenApi = async (data) => {
  try {
    const response = await axios.post(`${URL}/api/utils/token`, {
      type: "rag_embed_preview",
      ...data,
    });
    return response;
  } catch (error) {
    console.error(error);
    return error;
  }
};

export const generateChatbotTokenApi = async (data) => {
  try {
    const response = await axios.post(`${URL}/api/utils/token`, {
      type: "chatbot_embed_preview",
      ...data,
    });
    return response;
  } catch (error) {
    console.error(error);
    return error;
  }
};
