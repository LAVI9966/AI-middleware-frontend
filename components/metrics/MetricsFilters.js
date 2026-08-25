import { memo, useMemo } from "react";
import TimeRangeFilter from "@/components/metrics/TimeRangeFilter";
import MultiSelectFilterDropdown from "@/components/metrics/MultiSelectFilterDropdown";
import ExportMetricsButton from "@/components/metrics/ExportMetricsButton";
import { RefreshIcon, LayoutGridIcon, BlocksIcon, SparklesIcon, KeyRoundIcon } from "@/components/Icons";
import { getApiKeyStatusClass, getIconOfService } from "@/utils/utility";

// Which agents use a given API key isn't a direct field on either object -
// both only carry it indirectly via version ids (same join ConnectedAgentsModal
// uses for the "connected agents" list on the API Keys settings page).
const countConnectedAgents = (apikey, allBridges) => {
  const versionIdSet = new Set(apikey.version_ids || []);
  if (!versionIdSet.size) return 0;
  return allBridges.reduce((count, bridge) => {
    const usesThisKey = (bridge.versions || []).some((versionId) => versionIdSet.has(versionId));
    return usesThisKey ? count + 1 : count;
  }, 0);
};

// Flat pill toolbar - matches the demo's filterbar: one row of pill buttons
// (icon + "Label: value" + chevron) instead of the old label-above/select-box
// grid. Group By now lives in the chart card header instead of here.
const MetricsFilters = memo(
  ({
    range,
    customStartDate,
    customEndDate,
    selectedBridgeIds = [],
    selectedApikeyIds = [],
    selectedModels = [],
    selectedServices = [],
    allBridges = [],
    apikeyData = [],
    modelOptions = [],
    services = [],
    loading,
    onBridgeChange,
    onApikeyChange,
    onModelChange,
    onServiceChange,
    onTimeRangeChange,
    onCustomRangeApply,
    onRefresh,
    exportProps,
  }) => {
    // Same provider icon the real Agents list page shows next to each agent's
    // name (getIconOfService, keyed off the agent's configured `service` -
    // openai/anthropic/google/etc.) - not a dedicated icon/avatar field.
    const bridgeOptions = allBridges.map((item) => ({
      id: item._id,
      name: item.name,
      iconNode: getIconOfService(item.service, 16, 16),
    }));
    // API keys shown by name + status only (never the masked key value), with
    // how many agents actually use each one - not just a flat name list.
    const apikeyOptions = useMemo(
      () =>
        apikeyData.map((item) => {
          const agentCount = countConnectedAgents(item, allBridges);
          return {
            id: item._id,
            name: item.name,
            dotClass: item.status ? getApiKeyStatusClass(item.status, "dot") : null,
            meta: `${item.status || "unknown"} - ${agentCount} agent${agentCount === 1 ? "" : "s"}`,
          };
        }),
      [apikeyData, allBridges]
    );
    const modelOptionsList = modelOptions.map((item) => ({ id: item.id, name: item.name }));
    const serviceOptions = services.map((item) => ({
      id: item.value,
      name: item.displayName || item.value,
      iconNode: getIconOfService(item.value, 16, 16),
    }));

    return (
      <div
        className="flex items-center gap-2 flex-wrap bg-base-100 border border-base-300 rounded-lg p-2 mb-6"
        data-testid="metrics-filterbar"
      >
        <TimeRangeFilter
          range={range}
          customStartDate={customStartDate}
          customEndDate={customEndDate}
          onPresetChange={onTimeRangeChange}
          onCustomRangeApply={onCustomRangeApply}
        />
        <MultiSelectFilterDropdown
          id="metrics-filter-agent"
          label="Agent"
          icon={<LayoutGridIcon className="w-3.5 h-3.5" />}
          options={bridgeOptions}
          selectedIds={selectedBridgeIds}
          onChange={onBridgeChange}
          searchable
        />
        <MultiSelectFilterDropdown
          id="metrics-filter-service"
          label="Service"
          icon={<BlocksIcon className="w-3.5 h-3.5" />}
          options={serviceOptions}
          selectedIds={selectedServices}
          onChange={onServiceChange}
          searchable
        />
        <MultiSelectFilterDropdown
          id="metrics-filter-model"
          label="Model"
          icon={<SparklesIcon className="w-3.5 h-3.5" />}
          options={modelOptionsList}
          selectedIds={selectedModels}
          onChange={onModelChange}
          searchable
        />
        <MultiSelectFilterDropdown
          id="metrics-filter-apikey"
          label="API Key"
          icon={<KeyRoundIcon className="w-3.5 h-3.5" />}
          options={apikeyOptions}
          selectedIds={selectedApikeyIds}
          onChange={onApikeyChange}
          searchable
        />

        <div className="flex-1" />

        <button
          type="button"
          title="Refresh"
          onClick={onRefresh}
          disabled={loading}
          className="w-9 h-9 rounded-lg border border-base-300 bg-base-100 flex items-center justify-center text-base-content/70 hover:bg-base-200 hover:text-base-content transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshIcon className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
        {exportProps && <ExportMetricsButton {...exportProps} />}
      </div>
    );
  }
);

MetricsFilters.displayName = "MetricsFilters";

export default MetricsFilters;
