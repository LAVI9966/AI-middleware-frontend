"use client";
import { use, useEffect, useState, useMemo } from "react";
import Protected from "@/components/Protected";
import { useCustomSelector } from "@/customHooks/customSelector";
import { useSearchParams } from "next/navigation";

// Custom hooks
import { useMetricsData } from "@/customHooks/useMetricsData";
import { useRequestActivity } from "@/customHooks/useRequestActivity";
import { useMetricsURL } from "@/customHooks/useMetricsURL";
import { useThemeManager } from "@/customHooks/useThemeManager";
import { METRICS_TIME_RANGE_OPTIONS } from "@/utils/enums";

// Components
import MetricsFilters from "@/components/metrics/MetricsFilters";
import MetricsChart from "@/components/metrics/MetricsChart";
import RequestActivityCard from "@/components/metrics/RequestActivityCard";
import TokenUsageOverview from "@/components/metrics/TokenUsageOverview";

export const runtime = "edge";

// Range codes supported by the dashboard - kept in sync with
// METRICS_TIME_RANGE_OPTIONS itself (single source of truth) rather than a
// separately hand-maintained list, so a new preset added there is
// automatically accepted from the URL without a second edit here.
const RANGE_CODES = METRICS_TIME_RANGE_OPTIONS.map((option) => option.range);
const DEFAULT_RANGE = 6;
const CUSTOM_RANGE = 10;

const parseValidDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

// Multi-select filters are persisted as comma-joined ids in the URL.
const parseIdList = (value) => (value ? value.split(",").filter(Boolean) : []);
const toParam = (list) => (list && list.length ? list.join(",") : null);

function Page({ params }) {
  const resolvedParams = use(params);
  const searchParams = useSearchParams();
  const orgId = resolvedParams?.org_id;

  // State management
  const [factor, setFactor] = useState(parseInt(searchParams.get("factor")) || 0);
  const [customStartDate, setCustomStartDate] = useState(() => parseValidDate(searchParams.get("start_date")));
  const [customEndDate, setCustomEndDate] = useState(() => parseValidDate(searchParams.get("end_date")));
  const [range, setRange] = useState(() => {
    const value = parseInt(searchParams.get("range"));
    if (!RANGE_CODES.includes(value)) return DEFAULT_RANGE;
    if (value === CUSTOM_RANGE) {
      const hasValidDates =
        parseValidDate(searchParams.get("start_date")) && parseValidDate(searchParams.get("end_date"));
      return hasValidDates ? value : DEFAULT_RANGE;
    }
    return value;
  });
  // Multi-select filters: each is an array of ids. An empty array means "All".
  const [selectedBridgeIds, setSelectedBridgeIds] = useState(() => parseIdList(searchParams.get("bridge_ids")));
  const [selectedApikeyIds, setSelectedApikeyIds] = useState(() => parseIdList(searchParams.get("apikey_ids")));
  const [selectedModels, setSelectedModels] = useState(() => parseIdList(searchParams.get("models")));
  const [selectedServices, setSelectedServices] = useState(() => parseIdList(searchParams.get("services")));
  const [refreshNonce, setRefreshNonce] = useState(0);

  // Custom hooks
  const { allBridges, apikeyData, services } = useCustomSelector((state) => ({
    allBridges: state.bridgeReducer.org[orgId]?.orgs || [],
    apikeyData: state?.apiKeysReducer?.apikeys?.[orgId] || [],
    services: state?.serviceReducer?.services || [],
  }));

  // allBridges (from the agent-list API) already excludes embed agents by
  // construction (they're created under a different user_id context even
  // though they share the org, and intentionally don't belong in the main
  // Agents list/Metrics) - it still carries soft-deleted/archived agents with
  // no filtering applied. "Total Agents" (and the Agent filter) now covers
  // BOTH real agent types together - regular API agents and chatbots - since
  // both are genuinely active agents in the org; only the soft-deleted/
  // archived exclusion (agents/page.js filteredUnArchivedBridges) still
  // applies here, matching the real Agents page's own visibility definition.
  const visibleBridges = useMemo(
    () => allBridges.filter((b) => (b.status === 1 || b.status === undefined) && !b.deletedAt),
    [allBridges]
  );

  const isChatbot = (b) => (b.bridgeType || "").toLowerCase() === "chatbot";
  const apiAgentCount = useMemo(() => visibleBridges.filter((b) => !isChatbot(b)).length, [visibleBridges]);
  const chatbotCount = useMemo(() => visibleBridges.filter(isChatbot).length, [visibleBridges]);

  const { rawData, modelOptions, agentModelBreakdown, loading, headlineStats, fetchMetricsData } = useMetricsData(
    orgId,
    allBridges,
    apikeyData,
    services
  );
  const {
    data: requestActivityData,
    agentTokenBreakdown,
    loading: requestActivityLoading,
    fetchRequestActivity,
  } = useRequestActivity();
  const { updateURLParams } = useMetricsURL();
  const { actualTheme } = useThemeManager();

  // Effects
  useEffect(() => {
    fetchMetricsData({
      factor,
      range,
      bridge: selectedBridgeIds,
      apikey: selectedApikeyIds,
      model: selectedModels,
      service: selectedServices,
      customStartDate,
      customEndDate,
    });
    fetchRequestActivity({
      range,
      bridge: selectedBridgeIds,
      model: selectedModels,
      service: selectedServices,
      customStartDate,
      customEndDate,
    });
  }, [
    factor,
    range,
    selectedBridgeIds,
    selectedApikeyIds,
    selectedModels,
    selectedServices,
    customStartDate,
    customEndDate,
    refreshNonce,
    fetchMetricsData,
    fetchRequestActivity,
  ]);

  const handleRefresh = () => setRefreshNonce((n) => n + 1);

  // Event handlers
  const handleFactorChange = (index) => {
    setFactor(index);
    updateURLParams({ factor: index });
  };

  const handleTimeRangeChange = (rangeCode) => {
    setRange(rangeCode);
    setCustomStartDate(null);
    setCustomEndDate(null);
    updateURLParams({ range: rangeCode, start_date: null, end_date: null });
  };

  const handleCustomRangeApply = (startDate, endDate) => {
    setRange(CUSTOM_RANGE);
    setCustomStartDate(startDate);
    setCustomEndDate(endDate);
    updateURLParams({
      range: CUSTOM_RANGE,
      start_date: startDate.toISOString().slice(0, 10),
      end_date: endDate.toISOString().slice(0, 10),
    });
  };

  const handleBridgeChange = (ids) => {
    setSelectedBridgeIds(ids);
    updateURLParams({ bridge_ids: toParam(ids) });
  };

  const handleApikeyChange = (ids) => {
    setSelectedApikeyIds(ids);
    updateURLParams({ apikey_ids: toParam(ids) });
  };

  const handleModelChange = (ids) => {
    setSelectedModels(ids);
    updateURLParams({ models: toParam(ids) });
  };

  const handleServiceChange = (ids) => {
    setSelectedServices(ids);
    updateURLParams({ services: toParam(ids) });
  };

  return (
    <div className="p-10 min-h-screen">
      {/* Page Header */}
      <header className="mb-8" data-testid="metrics-dashboard-header">
        <h1 className="text-3xl font-bold text-base-content">Metrics</h1>
      </header>

      {/* Filters */}
      <MetricsFilters
        range={range}
        customStartDate={customStartDate}
        customEndDate={customEndDate}
        selectedBridgeIds={selectedBridgeIds}
        selectedApikeyIds={selectedApikeyIds}
        selectedModels={selectedModels}
        selectedServices={selectedServices}
        allBridges={visibleBridges}
        apikeyData={apikeyData}
        modelOptions={modelOptions}
        services={services}
        loading={loading || requestActivityLoading}
        onBridgeChange={handleBridgeChange}
        onApikeyChange={handleApikeyChange}
        onModelChange={handleModelChange}
        onServiceChange={handleServiceChange}
        onTimeRangeChange={handleTimeRangeChange}
        onCustomRangeApply={handleCustomRangeApply}
        onRefresh={handleRefresh}
        exportProps={{
          orgId,
          factor,
          range,
          customStartDate,
          customEndDate,
          selectedBridgeIds,
          selectedApikeyIds,
          selectedModels,
          selectedServices,
          allBridges,
          apikeyData,
          services,
        }}
      />

      {/* Main grid: chart on the left, Agents count + Request Activity in the sidebar */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4 items-stretch">
        <div className="bg-base-100 shadow-md rounded-lg p-6 min-w-0" data-testid="metrics-visualization-container">
          <MetricsChart
            rawData={rawData}
            currentTheme={actualTheme}
            factor={factor}
            range={range}
            onFactorChange={handleFactorChange}
            headlineStats={headlineStats}
            loading={loading}
          />
        </div>

        <div className="flex flex-col gap-4 h-full">
          <div className="bg-base-100 shadow-md rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold tracking-wide text-base-content/50 uppercase">
                Total Agents
              </span>
              <span className="text-xl font-bold text-base-content">{visibleBridges.length}</span>
            </div>
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-base-300">
              <span className="text-[11px] text-base-content/50">API Agents</span>
              <span className="text-sm font-semibold text-base-content">{apiAgentCount}</span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[11px] text-base-content/50">Chatbots</span>
              <span className="text-sm font-semibold text-base-content">{chatbotCount}</span>
            </div>
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-base-300">
              <span className="text-[11px] text-base-content/50">Active</span>
              <span className="text-sm font-semibold text-base-content">
                {visibleBridges.filter((b) => b.bridge_status !== 0).length}
              </span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[11px] text-base-content/50">Paused</span>
              <span className="text-sm font-semibold text-base-content">
                {visibleBridges.filter((b) => b.bridge_status === 0).length}
              </span>
            </div>
          </div>

          {/* Real successful vs failed request activity, from conversation_logs */}
          <RequestActivityCard data={requestActivityData} />
        </div>
      </div>

      {/* Token Usage Overview */}
      <div data-testid="token-usage-overview-container" className="mt-4">
        <TokenUsageOverview
          rawData={rawData}
          factor={factor}
          agentModelBreakdown={agentModelBreakdown}
          agentTokenBreakdown={agentTokenBreakdown}
        />
      </div>
    </div>
  );
}

export default Protected(Page);
