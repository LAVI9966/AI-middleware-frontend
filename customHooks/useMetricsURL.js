import { useCallback } from "react";
import { useQueryParams } from "./useQueryParams";
import { METRICS_TIME_RANGE_OPTIONS } from "@/utils/enums";

export const useMetricsURL = () => {
  const { setParams } = useQueryParams();

  const updateURLParams = useCallback(
    (newParams) => {
      setParams(newParams, { replace: true });
    },
    [setParams]
  );

  // Map an underlying range code (e.g. 2/4/6) to its display label.
  const getTimeRangeLabel = useCallback((range) => {
    return METRICS_TIME_RANGE_OPTIONS.find((option) => option.range === range)?.label || "Select Range";
  }, []);

  return {
    updateURLParams,
    getTimeRangeLabel,
  };
};
