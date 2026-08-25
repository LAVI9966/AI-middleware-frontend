import { useState, useCallback } from "react";
import { getRequestsActivityApi } from "@/config/index";
import { computeCurrentWindow } from "./useMetricsData";

// Real success/failed request counts over time (POST /api/metrics/requests-activity),
// sourced from conversation_logs - independent of the Timescale-backed useMetricsData
// hook above, since failure tracking only exists in the conversation_logs pipeline.
// Also returns a real per-agent input/output token breakdown from the same source,
// keyed by bridge_id for the Models table to look up directly.
export const useRequestActivity = () => {
  const [data, setData] = useState([]);
  const [agentTokenBreakdown, setAgentTokenBreakdown] = useState({});
  const [loading, setLoading] = useState(false);

  const fetchRequestActivity = useCallback(
    async ({ range, bridge, model, service, customStartDate, customEndDate }) => {
      setLoading(true);
      try {
        const { start, end } = computeCurrentWindow(range, customStartDate, customEndDate);
        const asFilterValue = (value) =>
          Array.isArray(value) ? (value.length ? value : undefined) : value || undefined;
        const { data: rows, byAgent } = await getRequestsActivityApi({
          bridge_id: asFilterValue(bridge),
          model: asFilterValue(model),
          service: asFilterValue(service),
          start_date: start,
          end_date: end,
        });
        setData(Array.isArray(rows) ? rows : []);
        const breakdown = {};
        (Array.isArray(byAgent) ? byAgent : []).forEach((row) => {
          if (!row.bridge_id) return;
          breakdown[row.bridge_id] = {
            inputTokens: Number(row.input_tokens) || 0,
            outputTokens: Number(row.output_tokens) || 0,
          };
        });
        setAgentTokenBreakdown(breakdown);
      } catch (error) {
        console.error("Error fetching request activity:", error);
        setData([]);
        setAgentTokenBreakdown({});
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { data, agentTokenBreakdown, loading, fetchRequestActivity };
};
