import { memo, useMemo, useState } from "react";
import { aggregateDataByFactor } from "@/customHooks/useMetricsData";
import { METRICS_FACTOR_OPTIONS } from "@/utils/enums";
import { MoveDownIcon, ChevronDownIcon } from "@/components/Icons";
import { colorForId, formatTokensFull, formatCost } from "./metricsUtils";
import { getIconOfService } from "@/utils/utility";

const BASE_HEADERS = [
  { key: "name", label: "Agent (Models)", align: "left" },
  { key: "successCount", label: "Requests", align: "right" },
  { key: "tokens", label: "Tokens", align: "right" },
  { key: "avgLatency", label: "Avg Latency", align: "right" },
  { key: "cost", label: "Cost", align: "right" },
];
// Only shown when grouped by Agent - real input/output token totals per
// agent, from conversation_logs (see agentTokenBreakdown prop). Not sortable
// on their own key since they're a separate data source joined in by id,
// not a field on the aggregated row itself.
const TOKEN_SPLIT_HEADERS = [
  { key: "inputTokens", label: "Input", align: "right", sortable: false },
  { key: "outputTokens", label: "Output", align: "right", sortable: false },
];
const BASE_GRID_COLS = "1.9fr 0.9fr 0.9fr 0.9fr 0.9fr";
const AGENT_GRID_COLS = `${BASE_GRID_COLS} 0.8fr 0.8fr`;

// "(model)" for a single model, "(model +N)" for several - matches how the
// reference design tags each agent row with its model usage at a glance,
// without needing to expand.
const modelTag = (breakdown) => {
  if (!breakdown || breakdown.length === 0) return null;
  if (breakdown.length === 1) return breakdown[0].name;
  return `${breakdown[0].name} +${breakdown.length - 1}`;
};

// Models panel: an accordion list. Clicking an agent row expands its
// per-model breakdown instantly - no fetch needed, since the backend now
// carries a `model` column on every row when grouped by Agent, so the whole
// breakdown is already sitting in `agentModelBreakdown` from the same
// request that populated the table itself.
const TokenUsageOverview = memo(({ rawData, factor, agentModelBreakdown = {}, agentTokenBreakdown = {} }) => {
  const [sortKey, setSortKey] = useState("tokens");
  const [sortDir, setSortDir] = useState("desc");
  const [expandedId, setExpandedId] = useState(null);

  const isAgentGrouping = METRICS_FACTOR_OPTIONS[factor] === "bridge_id";
  const HEADERS = isAgentGrouping ? [...BASE_HEADERS, ...TOKEN_SPLIT_HEADERS] : BASE_HEADERS;
  const gridCols = isAgentGrouping ? AGENT_GRID_COLS : BASE_GRID_COLS;
  const aggregatedData = useMemo(() => aggregateDataByFactor(rawData), [rawData]);
  const maxTokens = aggregatedData.length > 0 ? Math.max(...aggregatedData.map((item) => item.tokens)) : 0;

  const sortedData = useMemo(() => {
    const sorted = [...aggregatedData];
    sorted.sort((a, b) => {
      if (sortKey === "name") {
        const result = String(a.name || "").localeCompare(String(b.name || ""));
        return sortDir === "asc" ? result : -result;
      }
      const valueA = Number(a[sortKey]) || 0;
      const valueB = Number(b[sortKey]) || 0;
      return sortDir === "asc" ? valueA - valueB : valueB - valueA;
    });
    return sorted;
  }, [aggregatedData, sortKey, sortDir]);

  const handleSort = (key, sortable = true) => {
    if (!sortable) return;
    if (sortKey === key) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  };

  const handleRowClick = (agentId) => {
    if (!isAgentGrouping) return;
    setExpandedId((prev) => (prev === agentId ? null : agentId));
  };

  if (aggregatedData.length === 0) {
    return (
      <div className="bg-base-100 shadow-md rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-base-300">
          <h2 className="text-[14.5px] font-bold text-base-content">Models</h2>
        </div>
        <div className="text-center py-8 text-base-content/60">No data available</div>
      </div>
    );
  }

  return (
    <div className="bg-base-100 shadow-md rounded-lg overflow-hidden" data-testid="token-usage-overview">
      <div className="px-5 py-4 border-b border-base-300">
        <h2 className="text-[14.5px] font-bold text-base-content">Models</h2>
      </div>

      <div className="overflow-x-auto">
        <div className={isAgentGrouping ? "min-w-[900px]" : "min-w-[720px]"}>
          <div
            className="grid gap-2 px-5 py-2.5 border-b border-base-300 text-[11px] uppercase tracking-wide font-bold text-base-content/50"
            style={{ gridTemplateColumns: gridCols }}
          >
            {HEADERS.map((header) => {
              const sortable = header.sortable !== false;
              const isActive = sortable && sortKey === header.key;
              return (
                <div
                  key={header.key}
                  onClick={() => handleSort(header.key, sortable)}
                  className={`flex items-center gap-1 select-none ${sortable ? "cursor-pointer" : ""} ${
                    header.align === "right" ? "justify-end" : ""
                  }`}
                >
                  <span>{header.label}</span>
                  {sortable && (
                    <MoveDownIcon
                      className={`w-3 h-3 transition-colors ${isActive ? "text-base-content" : "text-base-content/25"} ${
                        isActive && sortDir === "asc" ? "rotate-180" : "rotate-0"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {sortedData.map((item) => {
            const color = colorForId(item.id);
            const percentage = maxTokens > 0 ? Math.round((item.tokens / maxTokens) * 100) : 0;
            const isExpanded = expandedId === item.id;
            const breakdown = agentModelBreakdown[item.id];
            const tag = isAgentGrouping ? modelTag(breakdown) : null;
            const tokenSplit = isAgentGrouping ? agentTokenBreakdown[item.id] : null;

            return (
              <div key={item.id} className="border-b border-base-300 last:border-b-0">
                <div
                  onClick={() => handleRowClick(item.id)}
                  className={`grid gap-2 items-center px-5 py-3 ${
                    isAgentGrouping ? "cursor-pointer hover:bg-base-200/60" : ""
                  }`}
                  style={{ gridTemplateColumns: gridCols }}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    {/* Same provider icon (openai/anthropic/...) the real Agents
                        list page shows next to each agent's name - only
                        meaningful for Agent/Service groupings, where the row
                        maps to exactly one service. */}
                    {item.service && (
                      <span className="flex items-center flex-shrink-0">{getIconOfService(item.service, 16, 16)}</span>
                    )}
                    <span className="font-semibold text-[13.5px] text-base-content truncate" title={item.name}>
                      {item.name}
                    </span>
                    {tag && <span className="text-[12px] text-base-content/50 truncate">({tag})</span>}
                    {isAgentGrouping && breakdown?.length > 0 && (
                      <ChevronDownIcon
                        className={`w-3.5 h-3.5 text-base-content/50 flex-shrink-0 transition-transform ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      />
                    )}
                  </div>
                  <div className="text-right text-[12.5px] text-base-content/70">
                    {formatTokensFull(item.successCount)}
                  </div>
                  <div className="relative text-right text-[12.5px] font-medium text-base-content rounded overflow-hidden px-1.5 py-0.5 -mx-1.5">
                    <span
                      className="absolute inset-y-0 left-0 bg-primary/10 rounded"
                      style={{ width: `${percentage}%` }}
                    />
                    <span className="relative">{formatTokensFull(item.tokens)}</span>
                  </div>
                  <div className="text-right text-[12.5px] text-base-content/70">
                    {item.avgLatency > 0 ? `${Math.round(item.avgLatency)} ms` : "-"}
                  </div>
                  <div className="text-right text-[12.5px] text-base-content/70">{formatCost(item.cost)}</div>
                  {isAgentGrouping && (
                    <>
                      <div className="text-right text-[12.5px] text-primary">
                        {tokenSplit ? formatTokensFull(tokenSplit.inputTokens) : "-"}
                      </div>
                      <div className="text-right text-[12.5px] text-secondary">
                        {tokenSplit ? formatTokensFull(tokenSplit.outputTokens) : "-"}
                      </div>
                    </>
                  )}
                </div>

                {isAgentGrouping && isExpanded && breakdown?.length > 0 && (
                  <div className="bg-base-200/40 px-5 pb-3">
                    {breakdown.map((model) => (
                      <div
                        key={model.id}
                        className="grid gap-2 items-center py-1.5 pl-6"
                        style={{ gridTemplateColumns: gridCols }}
                      >
                        <div className="flex items-center gap-2 text-[12.5px] text-base-content/70 truncate">
                          <span className="w-1 h-1 rounded-full bg-base-content/40 flex-shrink-0" />
                          {model.name}
                        </div>
                        <div />
                        <div className="text-right text-[12px] text-base-content/60">
                          {formatTokensFull(model.tokens)}
                        </div>
                        <div />
                        <div className="text-right text-[12px] text-base-content/60">{formatCost(model.cost)}</div>
                        <div />
                        <div />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

TokenUsageOverview.displayName = "TokenUsageOverview";

export default TokenUsageOverview;
