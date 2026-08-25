import { useState, useCallback } from "react";
import { getMetricsDataApi } from "@/config/index";
import { METRICS_FACTOR_OPTIONS } from "@/utils/enums";

const resolveServiceName = (serviceKey, services = []) =>
  Array.isArray(services) ? services.find((svc) => svc?.value === serviceKey)?.displayName || serviceKey : serviceKey;

// Duration (in hours) of each preset in the 0-indexed frontend range scheme,
// mirroring the intervals buildWhereClause applies on the backend
// (1h,3h,6h,12h,1d,2d,7d,14d,30d). Used to compute an equal-length
// "previous period" window for the delta-vs-previous-period comparison.
const RANGE_DURATION_HOURS = [1, 3, 6, 12, 24, 48, 168, 336, 720];

// Resolves the currently selected preset/custom range to an explicit
// {start, end} window - needed by any endpoint (like Request Activity) that
// takes explicit dates rather than a backend-side range code.
export const computeCurrentWindow = (range, customStartDate, customEndDate) => {
  if (range === 10 && customStartDate && customEndDate) {
    return { start: new Date(customStartDate), end: new Date(customEndDate) };
  }
  const durationMs = (RANGE_DURATION_HOURS[range] ?? 168) * 60 * 60 * 1000;
  return { start: new Date(Date.now() - durationMs), end: new Date() };
};

// Returns the immediately-preceding window of equal length to the currently
// selected range/custom dates, e.g. "Last 7 Days" -> the 7 days before that.
export const computePreviousWindow = (range, customStartDate, customEndDate) => {
  let currentStart;
  let durationMs;

  if (range === 10 && customStartDate && customEndDate) {
    currentStart = new Date(customStartDate);
    durationMs = new Date(customEndDate).getTime() - currentStart.getTime();
  } else {
    durationMs = (RANGE_DURATION_HOURS[range] ?? 168) * 60 * 60 * 1000;
    currentStart = new Date(Date.now() - durationMs);
  }

  if (!Number.isFinite(durationMs) || durationMs <= 0) return null;

  const prevEnd = currentStart;
  const prevStart = new Date(currentStart.getTime() - durationMs);
  return { prevStart, prevEnd };
};

// Data conversion logic extracted from the main component
export const convertApiData = (
  apiData,
  factor = 0,
  range = 1,
  allBridges = [],
  apiKeys = [],
  services = [],
  customStartDate = null,
  customEndDate = null
) => {
  const currentFactor = METRICS_FACTOR_OPTIONS[factor] || "bridge_id";

  const uniqueEntries = {};

  // Process API data into unique entries
  apiData.forEach((entry) => {
    const entryDate = new Date(entry.created_at);

    // Round down to nearest 15 minutes for range < 5
    if (range < 5) {
      const minutes = Math.floor(entryDate.getMinutes() / 15) * 15;
      entryDate.setMinutes(minutes, 0, 0);
    }

    // Key depends on range
    const key =
      range < 5
        ? entryDate.toISOString().slice(0, 16) // YYYY-MM-DDTHH:mm
        : entryDate.toISOString().split("T")[0]; // YYYY-MM-DD

    const entryId = entry[currentFactor];
    const uniqueKey = `${key}+${entryId ?? ""}`;
    const latencyValue = entry.latency_sum != null ? Number(entry.latency_sum) : null;

    if (!uniqueEntries[uniqueKey]) {
      uniqueEntries[uniqueKey] = {
        date: entryDate,
        id: entryId,
        cost: entry.cost_sum || 0,
        tokens: entry.total_token_count || 0,
        successCount: entry.success_count || 0,
        latencyTotal: latencyValue || 0,
        latencyRows: latencyValue != null ? 1 : 0,
      };
    } else {
      uniqueEntries[uniqueKey].cost += entry.cost_sum || 0;
      uniqueEntries[uniqueKey].tokens += entry.total_token_count || 0;
      uniqueEntries[uniqueKey].successCount += entry.success_count || 0;
      uniqueEntries[uniqueKey].latencyTotal += latencyValue || 0;
      uniqueEntries[uniqueKey].latencyRows += latencyValue != null ? 1 : 0;
    }
  });

  let timePoints = [];
  let intervalMs = 24 * 60 * 60 * 1000;

  if (range === 10 && customStartDate && customEndDate) {
    const startDate = new Date(customStartDate);
    const endDate = new Date(customEndDate);
    const diffTime = Math.abs(endDate - startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    for (let i = 0; i <= diffDays; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      timePoints.push(new Date(date));
    }

    intervalMs = 24 * 60 * 60 * 1000;
  } else {
    const now = new Date();
    const roundedNow = new Date(now);
    roundedNow.setMinutes(Math.floor(now.getMinutes() / 15) * 15, 0, 0);

    switch (range) {
      case 0: // 1 hour → 15 min
        intervalMs = 15 * 60 * 1000;
        timePoints = Array.from({ length: 4 }, (_, i) => new Date(roundedNow.getTime() - i * intervalMs)).reverse();
        break;
      case 1: // 3 hours → 15 min
        intervalMs = 15 * 60 * 1000;
        timePoints = Array.from({ length: 12 }, (_, i) => new Date(roundedNow.getTime() - i * intervalMs)).reverse();
        break;
      case 2: // 6 hours → 30 min
        intervalMs = 15 * 60 * 1000;
        timePoints = Array.from({ length: 24 }, (_, i) => new Date(roundedNow.getTime() - i * intervalMs)).reverse();
        break;
      case 3: // 12 hours → 1 hour
        intervalMs = 15 * 60 * 1000;
        timePoints = Array.from({ length: 48 }, (_, i) => new Date(roundedNow.getTime() - i * intervalMs)).reverse();
        break;
      case 4: // 1 day → 2 hours
        intervalMs = 15 * 60 * 1000;
        timePoints = Array.from({ length: 96 }, (_, i) => new Date(roundedNow.getTime() - i * intervalMs)).reverse();
        break;
      case 5: // 2 days → 4 hours
        intervalMs = 24 * 60 * 60 * 1000;
        timePoints = Array.from({ length: 2 }, (_, i) => new Date(roundedNow.getTime() - i * intervalMs)).reverse();
        break;
      case 6: // 7 days
        intervalMs = 24 * 60 * 60 * 1000;
        timePoints = Array.from({ length: 7 }, (_, i) => new Date(roundedNow.getTime() - i * intervalMs)).reverse();
        break;
      case 7: // 14 days
        intervalMs = 24 * 60 * 60 * 1000;
        timePoints = Array.from({ length: 14 }, (_, i) => new Date(roundedNow.getTime() - i * intervalMs)).reverse();
        break;
      case 8: // 30 days
      default:
        intervalMs = 24 * 60 * 60 * 1000;
        timePoints = Array.from({ length: 30 }, (_, i) => new Date(roundedNow.getTime() - i * intervalMs)).reverse();
        break;
    }
  }

  // Initialize grouped data
  const groupedByDate = {};

  timePoints.forEach((date) => {
    const dateStr =
      range < 5
        ? new Intl.DateTimeFormat("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }).format(date)
        : new Intl.DateTimeFormat("en-US", {
            day: "numeric",
            month: "short",
          }).format(date);

    groupedByDate[dateStr] = {
      items: [],
      totalCost: 0,
      rawDate: new Date(date),
    };
  });

  // Fill grouped data from uniqueEntries
  Object.values(uniqueEntries).forEach((entry) => {
    const dateStr =
      range < 5
        ? new Intl.DateTimeFormat("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }).format(entry.date)
        : new Intl.DateTimeFormat("en-US", {
            day: "numeric",
            month: "short",
          }).format(entry.date);

    if (groupedByDate[dateStr]) {
      let name = "";
      // Resolved alongside name so the Models table can show the same
      // provider icon (openai/anthropic/...) the real Agents list shows -
      // only meaningful for Agent/Service groupings, where "which service"
      // is unambiguous; left undefined for API Key/Model groupings.
      let itemService;
      if (currentFactor === "bridge_id") {
        const bridge = allBridges.find((b) => b._id === entry.id);
        name = bridge ? bridge.name : `Bridge ${entry.id?.substring(0, 6)}`;
        itemService = bridge?.service;
      } else if (currentFactor === "apikey_id") {
        const apiKey = apiKeys.find((k) => k._id === entry.id);
        name = apiKey ? apiKey.name : `API Key ${entry.id?.substring(0, 6)}`;
      } else if (currentFactor === "service") {
        name = resolveServiceName(entry.id, services);
        itemService = entry.id;
      } else {
        name = entry.id || "Unknown Model";
      }

      const existingItemIndex = groupedByDate[dateStr].items.findIndex((item) => item.id === entry.id);

      if (existingItemIndex >= 0) {
        groupedByDate[dateStr].items[existingItemIndex].cost += entry.cost;
        groupedByDate[dateStr].items[existingItemIndex].tokens += entry.tokens;
        groupedByDate[dateStr].items[existingItemIndex].successCount += entry.successCount;
        groupedByDate[dateStr].items[existingItemIndex].latencyTotal += entry.latencyTotal;
        groupedByDate[dateStr].items[existingItemIndex].latencyRows += entry.latencyRows;
      } else {
        groupedByDate[dateStr].items.push({
          id: entry.id,
          name: name,
          service: itemService,
          cost: entry.cost,
          tokens: entry.tokens,
          successCount: entry.successCount,
          latencyTotal: entry.latencyTotal,
          latencyRows: entry.latencyRows,
        });
      }

      groupedByDate[dateStr].totalCost += entry.cost;
    }
  });

  return Object.keys(groupedByDate)
    .map((date) => ({
      period: date,
      date: groupedByDate[date].rawDate,
      totalCost: groupedByDate[date].totalCost,
      items: groupedByDate[date].items.length > 0 ? groupedByDate[date].items : [],
    }))
    .sort((a, b) => a.date - b.date);
};

// Aggregate data by factor function
export const aggregateDataByFactor = (rawData) => {
  const aggregated = {};

  rawData.forEach((period) => {
    period.items.forEach((item) => {
      const itemId = item.id;
      const itemName = item.name;

      if (!aggregated[itemId]) {
        aggregated[itemId] = {
          id: itemId,
          name: itemName,
          service: item.service,
          tokens: 0,
          cost: 0,
          successCount: 0,
          latencyTotal: 0,
          latencyRows: 0,
        };
      }

      aggregated[itemId].tokens += item.tokens;
      aggregated[itemId].cost += item.cost;
      aggregated[itemId].successCount += item.successCount;
      aggregated[itemId].latencyTotal += item.latencyTotal || 0;
      aggregated[itemId].latencyRows += item.latencyRows || 0;
    });
  });

  return Object.values(aggregated)
    .map((item) => ({
      ...item,
      avgLatency: item.latencyRows > 0 ? item.latencyTotal / item.latencyRows : 0,
    }))
    .sort((a, b) => b.tokens - a.tokens);
};

// Aggregate raw API rows (grouped by a dimension on the server) into a summary list.
export const aggregateMetricsByKey = (apiData, keyField, nameResolver = (id) => id) => {
  const aggregated = {};

  (Array.isArray(apiData) ? apiData : []).forEach((entry) => {
    const id = entry[keyField];
    if (id === null || id === undefined) return;

    if (!aggregated[id]) {
      aggregated[id] = {
        id,
        name: nameResolver(id),
        tokens: 0,
        cost: 0,
        successCount: 0,
      };
    }

    aggregated[id].tokens += entry.total_token_count || 0;
    aggregated[id].cost += entry.cost_sum || 0;
    aggregated[id].successCount += entry.success_count || 0;
  });

  return Object.values(aggregated).sort((a, b) => b.tokens - a.tokens);
};

// Per-agent breakdown of which models it used (and each model's tokens/cost),
// built from the SAME raw rows the main chart already fetches when grouped by
// Agent - the backend now carries a `model` column on every row in that case
// specifically so this doesn't need its own N-agents extra API calls.
export const buildAgentModelBreakdown = (apiData) => {
  const byAgent = {};
  (Array.isArray(apiData) ? apiData : []).forEach((entry) => {
    if (!entry.bridge_id || !entry.model) return;
    if (!byAgent[entry.bridge_id]) byAgent[entry.bridge_id] = {};
    const models = byAgent[entry.bridge_id];
    if (!models[entry.model]) models[entry.model] = { id: entry.model, name: entry.model, tokens: 0, cost: 0 };
    models[entry.model].tokens += entry.total_token_count || 0;
    models[entry.model].cost += entry.cost_sum || 0;
  });
  const result = {};
  Object.keys(byAgent).forEach((agentId) => {
    result[agentId] = Object.values(byAgent[agentId]).sort((a, b) => b.tokens - a.tokens);
  });
  return result;
};

// Per-service summary for the dashboard cards
export const aggregateByService = (apiData, services = []) =>
  aggregateMetricsByKey(apiData, "service", (id) => resolveServiceName(id, services));

// Unique model options for the model filter
export const getModelOptions = (apiData) => {
  const seen = new Set();
  const options = [];
  (Array.isArray(apiData) ? apiData : []).forEach((entry) => {
    if (entry.model && !seen.has(entry.model)) {
      seen.add(entry.model);
      options.push({ id: entry.model, name: entry.model });
    }
  });
  return options.sort((a, b) => a.name.localeCompare(b.name));
};

// Sum cost/tokens/successful-requests across a raw (pre-conversion) API rows
// array - used for the headline totals, current vs previous period.
const sumTotals = (apiData) =>
  (Array.isArray(apiData) ? apiData : []).reduce(
    (acc, entry) => ({
      cost: acc.cost + (entry.cost_sum || 0),
      tokens: acc.tokens + (entry.total_token_count || 0),
      requests: acc.requests + (entry.success_count || 0),
    }),
    { cost: 0, tokens: 0, requests: 0 }
  );

const EMPTY_HEADLINE_METRIC = { current: 0, previous: null, deltaPct: null };

// Custom hook for metrics data management
export const useMetricsData = (orgId, allBridges, apikeyData, services = []) => {
  const [rawData, setRawData] = useState([]);
  const [modelOptions, setModelOptions] = useState([]);
  const [agentModelBreakdown, setAgentModelBreakdown] = useState({});
  const [loading, setLoading] = useState(false);
  const [headlineStats, setHeadlineStats] = useState({
    cost: EMPTY_HEADLINE_METRIC,
    tokens: EMPTY_HEADLINE_METRIC,
    requests: EMPTY_HEADLINE_METRIC,
  });

  const fetchMetricsData = useCallback(
    async ({ factor, range, bridge, apikey, model, service, customStartDate, customEndDate }) => {
      setLoading(true);

      try {
        // Each filter accepts a single id (legacy) or an array (multi-select).
        // Empty arrays are sent as undefined so the backend applies no filter.
        const asFilterValue = (value) =>
          Array.isArray(value) ? (value.length ? value : undefined) : value || undefined;

        const requestBody = {
          range: range === 10 ? 10 : range + 1,
          factor: METRICS_FACTOR_OPTIONS[factor] || "bridge_id",
          org_id: orgId,
          apikey_id: asFilterValue(apikey),
          service: asFilterValue(service),
          model: asFilterValue(model),
          bridge_id: asFilterValue(bridge),
        };

        if (range === 10 && customStartDate && customEndDate) {
          requestBody.start_date = customStartDate;
          requestBody.end_date = customEndDate;
        }

        const isModelFactor = requestBody.factor === "model";

        // Named calls (instead of a positional array) so a result can never
        // be mis-assigned depending on which optional calls end up being made.
        const callMap = {
          main: getMetricsDataApi(requestBody),
        };

        // Model options (not needed when already grouping by model). Excludes
        // the model filter on itself - this call's job is to enumerate every
        // valid model given the OTHER filters, not to further restrict by
        // whichever model(s) happen to already be selected (that would make
        // the dropdown collapse to only ever showing what's already picked).
        if (!isModelFactor) {
          callMap.model = getMetricsDataApi({ ...requestBody, factor: "model", model: undefined });
        }

        // Previous period (delta-vs-previous-period): same filters, the
        // immediately-preceding window of equal length. Always requested as
        // an explicit custom range (range=10) so it's independent of whatever
        // preset/custom range the current period uses.
        const previousWindow = computePreviousWindow(range, customStartDate, customEndDate);
        if (previousWindow) {
          callMap.previous = getMetricsDataApi({
            ...requestBody,
            range: 10,
            start_date: previousWindow.prevStart,
            end_date: previousWindow.prevEnd,
          });
        }

        const callKeys = Object.keys(callMap);
        const results = await Promise.all(callKeys.map((key) => callMap[key]));
        const dataByKey = {};
        callKeys.forEach((key, index) => {
          dataByKey[key] = results[index];
        });

        setRawData(
          convertApiData(
            dataByKey.main,
            factor,
            range,
            allBridges,
            apikeyData,
            services,
            customStartDate,
            customEndDate
          )
        );
        if (dataByKey.model) setModelOptions(getModelOptions(dataByKey.model));
        setAgentModelBreakdown(requestBody.factor === "bridge_id" ? buildAgentModelBreakdown(dataByKey.main) : {});

        const currentTotals = sumTotals(dataByKey.main);
        const previousTotals = dataByKey.previous ? sumTotals(dataByKey.previous) : null;
        const deltaPct = (current, previous) => {
          if (previous === null) return null;
          if (previous === 0) return current > 0 ? 100 : null;
          return ((current - previous) / previous) * 100;
        };
        setHeadlineStats({
          cost: {
            current: currentTotals.cost,
            previous: previousTotals?.cost ?? null,
            deltaPct: deltaPct(currentTotals.cost, previousTotals?.cost ?? null),
          },
          tokens: {
            current: currentTotals.tokens,
            previous: previousTotals?.tokens ?? null,
            deltaPct: deltaPct(currentTotals.tokens, previousTotals?.tokens ?? null),
          },
          requests: {
            current: currentTotals.requests,
            previous: previousTotals?.requests ?? null,
            deltaPct: deltaPct(currentTotals.requests, previousTotals?.requests ?? null),
          },
        });
      } catch (error) {
        console.error("Error fetching metrics data:", error);
        setRawData([]);
      } finally {
        setLoading(false);
      }
    },
    [orgId, allBridges, apikeyData, services]
  );

  return {
    rawData,
    modelOptions,
    agentModelBreakdown,
    loading,
    headlineStats,
    fetchMetricsData,
  };
};
