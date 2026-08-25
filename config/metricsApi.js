import axios from "@/utils/interceptor";

const URL = process.env.NEXT_PUBLIC_SERVER_URL;

// Metrics and Analytics APIs
export const getMetricsDataApi = async ({
  apikey_id,
  service,
  model,
  thread_id,
  bridge_id,
  version_id,
  range,
  factor,
  start_date,
  end_date,
}) => {
  try {
    const response = await axios.post(`${URL}/api/metrics`, {
      apikey_id,
      service,
      model,
      thread_id,
      bridge_id,
      version_id,
      range,
      factor,
      start_date,
      end_date,
    });
    return response.data?.data || [];
  } catch (error) {
    console.error(error);
    return error;
  }
};

// Real success vs failed request counts per time bucket, sourced from
// conversation_logs (same table the Agent Analytics page uses) - not the
// Timescale rollups, which never track failures. bridge_id/model/service are
// optional multi-select filters (array or single value); there is no
// apikey_id filter here because conversation_logs has no apikey_id column.
// Also returns `by_agent`: real per-agent input/output token totals from the
// same source, for the Models table's token breakdown columns.
export const getRequestsActivityApi = async ({ bridge_id, model, service, start_date, end_date }) => {
  try {
    const response = await axios.post(`${URL}/api/metrics/requests-activity`, {
      bridge_id,
      model,
      service,
      start_date,
      end_date,
    });
    return {
      data: response.data?.data || [],
      byAgent: response.data?.by_agent || [],
    };
  } catch (error) {
    console.error(error);
    return { data: [], byAgent: [] };
  }
};

// User Feedback and Analytics APIs
export const userFeedbackCount = async ({ bridge_id, user_feedback }) => {
  try {
    const response = await axios.get(`${URL}/api/v1/agentConfig/userfeedbackcount/${bridge_id}`, {
      params: {
        user_feedback,
      },
    });
    return response;
  } catch (error) {
    console.error(error);
    return error;
  }
};

// Fine-tuning Data APIs
export const downloadFineTuneData = async (bridge_id, threadIds, status = [0]) => {
  const response = await axios.post(`${URL}/api/v1/config/getFineTuneData/${bridge_id}`, {
    thread_ids: threadIds,
    user_feedback: status,
  });
  return response?.data;
};
