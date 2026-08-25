import { memo, useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from "recharts";
import { METRICS_FACTOR_LABELS } from "@/utils/enums";
import { ChevronDownIcon } from "@/components/Icons";
import { formatTokens, formatCost, formatTokensFull, getMetricsColor } from "./metricsUtils";

const OTHER_COLOR = "#9ca3af";
const OTHER_KEY = "__other";
const MAX_SERIES = 7;

const METRIC_OPTIONS = [
  { key: "totalCost", itemField: "cost", label: "Cost", format: (v) => formatCost(v) },
  { key: "totalTokens", itemField: "tokens", label: "Tokens", format: (v) => formatTokens(v) },
  { key: "totalRequests", itemField: "successCount", label: "Requests", format: (v) => formatTokensFull(v) },
];

const closeDropdown = (event) => {
  event.currentTarget.closest("details")?.removeAttribute("open");
};

const DeltaBadge = ({ deltaPct }) => {
  if (deltaPct === null || deltaPct === undefined || !Number.isFinite(deltaPct)) return null;
  const isUp = deltaPct >= 0;
  return (
    <div className={`text-xs font-semibold mt-1 ${isUp ? "text-success" : "text-error"}`}>
      {isUp ? "+" : ""}
      {deltaPct.toFixed(1)}% <span className="text-base-content/50 font-normal">vs previous period</span>
    </div>
  );
};

// Mirrors the real bucketing convertApiData applies per range (see
// customHooks/useMetricsData.js): 15-minute buckets for the sub-2-day
// presets, 1-day buckets for everything longer (including custom ranges,
// which are always walked day-by-day). Compact form (e.g. "15m"/"1d") in a
// small square badge, not a spelled-out "X buckets" pill.
const getBucketLabel = (range) => (range <= 4 ? "15m" : "1d");

const MetricsChart = memo(({ rawData, currentTheme, factor, range, onFactorChange, headlineStats, loading }) => {
  const [hiddenIds, setHiddenIds] = useState(() => new Set());

  // Fixed to Cost - the separate Cost/Tokens/Requests switcher was removed
  // (redundant with the headline numbers above the chart).
  const activeMetric = METRIC_OPTIONS[0];

  // Top entities (by total value for the active metric, across the whole visible
  // window) get their own stacked, individually-colored bar segment + legend
  // chip; everything else outside that top set is folded into a single "Other"
  // segment so the chart/legend stay readable regardless of how many agents/
  // models/services are in the current view.
  const topEntities = useMemo(() => {
    const totals = new Map();
    rawData.forEach((period) => {
      (period.items || []).forEach((item) => {
        const prev = totals.get(item.id) || { id: item.id, name: item.name, value: 0 };
        prev.value += item[activeMetric.itemField] || 0;
        totals.set(item.id, prev);
      });
    });
    // Assigned by position (not a hash of the id) so every entity visible in
    // the current view gets a genuinely distinct color - a hash-based
    // assignment can collide or land two entities on near-identical hues.
    return [...totals.values()]
      .sort((a, b) => b.value - a.value)
      .slice(0, MAX_SERIES)
      .map((entry, index) => ({ ...entry, color: getMetricsColor(index) }));
  }, [rawData, activeMetric.itemField]);

  const topIds = useMemo(() => new Set(topEntities.map((e) => e.id)), [topEntities]);
  const topColorById = useMemo(() => {
    const map = new Map();
    topEntities.forEach((entity) => map.set(entity.id, entity.color));
    return map;
  }, [topEntities]);
  const colorForTooltipItem = (id) => topColorById.get(id) || OTHER_COLOR;

  // Everything folded into "Other" - listed individually (with a scroller) in
  // its own dropdown rather than being an opaque, all-or-nothing bucket.
  const overflowEntities = useMemo(() => {
    const totals = new Map();
    rawData.forEach((period) => {
      (period.items || []).forEach((item) => {
        if (topIds.has(item.id)) return;
        const prev = totals.get(item.id) || { id: item.id, name: item.name, value: 0 };
        prev.value += item[activeMetric.itemField] || 0;
        totals.set(item.id, prev);
      });
    });
    return [...totals.values()].sort((a, b) => b.value - a.value);
  }, [rawData, activeMetric.itemField, topIds]);

  const [hiddenOverflowIds, setHiddenOverflowIds] = useState(() => new Set());

  const data = useMemo(
    () =>
      rawData.map((period) => {
        const items = period.items || [];
        const row = {
          period: period.period,
          totalCost: period.totalCost,
          totalTokens: items.reduce((sum, i) => sum + (i.tokens || 0), 0),
          totalRequests: items.reduce((sum, i) => sum + (i.successCount || 0), 0),
          items,
        };
        let otherValue = 0;
        items.forEach((item) => {
          const value = item[activeMetric.itemField] || 0;
          if (topIds.has(item.id)) {
            row[item.id] = hiddenIds.has(item.id) ? 0 : value;
          } else if (!hiddenOverflowIds.has(item.id)) {
            otherValue += value;
          }
        });
        row[OTHER_KEY] = hiddenIds.has(OTHER_KEY) ? 0 : otherValue;
        return row;
      }),
    [rawData, activeMetric.itemField, topIds, hiddenIds, hiddenOverflowIds]
  );

  const hasOther = useMemo(() => data.some((row) => row[OTHER_KEY] > 0), [data]);

  const averageValue = useMemo(() => {
    if (data.length === 0) return 0;
    const sum = data.reduce((acc, row) => {
      const visibleTotal = topEntities.reduce((s, e) => s + (row[e.id] || 0), 0) + (row[OTHER_KEY] || 0);
      return acc + visibleTotal;
    }, 0);
    return sum / data.length;
  }, [data, topEntities]);

  const toggleLegend = (id) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleOverflow = (id) => {
    setHiddenOverflowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const groupByLabel = METRICS_FACTOR_LABELS[factor] || "Items";

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;
    const point = payload[0].payload;
    return (
      <div className="bg-base-100 p-4 shadow-xl rounded-lg border border-base-300 min-w-[250px] max-w-[360px]">
        <div className="text-sm font-semibold text-base-content mb-3 text-center border-b border-base-200 pb-2">
          {point.period}
        </div>
        <div className="flex justify-between text-xs text-base-content/70 mb-2">
          <span>Total Cost</span>
          <span className="font-semibold text-base-content">${point.totalCost?.toFixed(3)}</span>
        </div>
        <div className="flex justify-between text-xs text-base-content/70 mb-2">
          <span>Total Tokens</span>
          <span className="font-semibold text-base-content">{formatTokensFull(point.totalTokens)}</span>
        </div>
        <div className="flex justify-between text-xs text-base-content/70 mb-2">
          <span>Requests</span>
          <span className="font-semibold text-base-content">{formatTokensFull(point.totalRequests)}</span>
        </div>
        <div className="text-xs font-medium text-base-content/60 mb-1.5">{groupByLabel} Breakdown:</div>
        <div className="space-y-1">
          {point.items?.length > 0 ? (
            point.items.map((item) => (
              <div key={item.id} className="flex justify-between items-center text-[11px] text-base-content">
                <span className="flex-1 mr-2 truncate flex items-center gap-1.5">
                  <span
                    className="w-1.5 h-1.5 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: colorForTooltipItem(item.id) }}
                  />
                  {item.name}
                </span>
                <span className="text-base-content/60 mr-3 flex-shrink-0">{formatTokens(item.tokens)} tokens</span>
                <span className="font-semibold min-w-[50px] text-right flex-shrink-0">${item.cost?.toFixed(3)}</span>
              </div>
            ))
          ) : (
            <div className="text-[11px] text-base-content/50">No usage in this period</div>
          )}
        </div>
      </div>
    );
  };

  const axisColor = currentTheme === "dark" ? "oklch(var(--bc))" : "#374151";
  const gridColor = currentTheme === "dark" ? "oklch(var(--bc) / 0.2)" : "#e5e7eb";

  if (loading && rawData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-2">
          <span className="loading loading-ring loading-lg"></span>
          <div className="text-base-content/60 text-sm">Loading metrics...</div>
        </div>
      </div>
    );
  }

  if (rawData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-base-content opacity-60">No data available</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Overlay (not a full replace) so filter changes show a spinner
          without yanking the previous chart off-screen first - the old data
          just dims underneath while the new request is in flight. */}
      {loading && (
        <div className="absolute inset-0 z-high flex items-center justify-center bg-base-100/60 rounded-lg">
          <span className="loading loading-ring loading-lg"></span>
        </div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-6 mb-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-base-content/70 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-success shadow-[0_0_0_3px_var(--fallback-su,oklch(var(--su)/0.15))]"></span>
            Cost and usage
          </div>
          <div className="flex items-baseline gap-8 flex-wrap">
            <div>
              <div className="text-2xl font-bold text-base-content leading-none">
                {formatCost(headlineStats?.cost?.current)}
              </div>
              <div className="text-[11px] text-base-content/50 mt-1.5 font-semibold uppercase tracking-wide">
                Total cost
              </div>
              <DeltaBadge deltaPct={headlineStats?.cost?.deltaPct} />
            </div>
            <div>
              <div className="text-2xl font-bold text-base-content leading-none">
                {formatTokensFull(headlineStats?.tokens?.current)}
              </div>
              <div className="text-[11px] text-base-content/50 mt-1.5 font-semibold uppercase tracking-wide">
                Total tokens
              </div>
              <DeltaBadge deltaPct={headlineStats?.tokens?.deltaPct} />
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <details className="dropdown dropdown-end">
            <summary className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-base-300 bg-base-100 text-[13px] font-medium text-base-content/70 hover:bg-base-200 cursor-pointer select-none">
              <span>
                Group by: <b className="text-base-content font-semibold">{groupByLabel}</b>
              </span>
              <ChevronDownIcon className="w-3 h-3 text-base-content/50" />
            </summary>
            <ul className="dropdown-content z-high mt-2 menu p-1 shadow-lg bg-base-100 rounded-box w-44 border border-base-300">
              {METRICS_FACTOR_LABELS.map((optionLabel, index) => (
                <li key={optionLabel}>
                  <a
                    className={factor === index ? "bg-primary/10 text-primary font-semibold" : ""}
                    onClick={(e) => {
                      onFactorChange(index);
                      closeDropdown(e);
                    }}
                  >
                    {optionLabel}
                  </a>
                </li>
              ))}
            </ul>
          </details>
          <div
            className="flex items-center justify-center w-8 h-8 text-[11px] font-semibold text-base-content/60 bg-base-200 border border-base-300 rounded-lg"
            title="Bucket size for the current range"
          >
            {getBucketLabel(range)}
          </div>
          <div
            className="text-[11px] font-semibold text-base-content/60 bg-base-200 border border-base-300 rounded-lg px-2.5 py-1 whitespace-nowrap"
            title="Average across the visible periods"
          >
            Avg {activeMetric.format(averageValue)}
          </div>
        </div>
      </div>

      {/* Always fills the card's actual width, at any data-point count - no
          fixed min-width + horizontal scroll, which could force the chart
          wider than its container and spill into neighboring UI. Bars shrink
          to fit (capped by maxBarSize so they never look absurdly wide on
          short ranges like "Last 1 Hour"). */}
      <div style={{ width: "100%", height: "360px" }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barCategoryGap="25%">
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis
              dataKey="period"
              tick={{ fill: axisColor, fontSize: 11 }}
              axisLine={{ stroke: axisColor }}
              tickLine={{ stroke: axisColor }}
            />
            <YAxis
              tick={{ fill: axisColor, fontSize: 11 }}
              axisLine={{ stroke: axisColor }}
              tickLine={false}
              tickFormatter={(value) => activeMetric.format(value)}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(113, 117, 115, 0.15)" }} />
            {/* No attached label here on purpose - Recharts positions a
                  ReferenceLine's label relative to the LINE's own y-value,
                  not a fixed spot in the chart. When the average sits low
                  (e.g. a quiet 24h window), that label would land right on
                  top of the x-axis. The average is shown as a fixed badge in
                  the header above instead, so it never collides with the
                  chart regardless of the data. */}
            <ReferenceLine y={averageValue} stroke={axisColor} strokeDasharray="4 4" strokeOpacity={0.6} />
            {topEntities.map((entity, index) => {
              const isTopmostSegment = !hasOther && index === topEntities.length - 1;
              return (
                <Bar
                  key={entity.id}
                  dataKey={entity.id}
                  stackId="stack"
                  fill={entity.color}
                  radius={isTopmostSegment ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                  maxBarSize={48}
                />
              );
            })}
            {hasOther && (
              <Bar dataKey={OTHER_KEY} stackId="stack" fill={OTHER_COLOR} radius={[4, 4, 0, 0]} maxBarSize={48} />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend: one chip per top entity + Other, click to toggle out of the stack */}
      <div className="flex flex-wrap gap-2 mt-4">
        {topEntities.map((entity) => (
          <button
            key={entity.id}
            type="button"
            onClick={() => toggleLegend(entity.id)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs transition-opacity ${
              hiddenIds.has(entity.id) ? "opacity-40 border-base-300" : "border-base-300"
            }`}
          >
            <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: entity.color }} />
            <span className="truncate max-w-[140px]">{entity.name}</span>
          </button>
        ))}
        {overflowEntities.length > 0 && (
          <details className="dropdown group">
            <summary
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs cursor-pointer select-none transition-opacity ${
                hiddenIds.has(OTHER_KEY) ? "opacity-40 border-base-300" : "border-base-300"
              }`}
            >
              <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: OTHER_COLOR }} />
              <span>Other ({overflowEntities.length})</span>
              <ChevronDownIcon className="w-3 h-3 text-base-content/50 transition-transform group-open:rotate-180" />
            </summary>
            <div className="dropdown-content z-high mt-2 p-1 shadow-lg bg-base-100 rounded-box w-56 border border-base-300">
              <ul className="menu flex flex-col flex-nowrap p-0 w-full max-h-64 overflow-y-auto overflow-x-hidden">
                {overflowEntities.map((entity) => {
                  const isHidden = hiddenOverflowIds.has(entity.id);
                  return (
                    <li key={entity.id} className="w-full">
                      <a
                        className={`flex items-center gap-2 w-full truncate py-1.5 transition-opacity ${
                          isHidden ? "opacity-40" : ""
                        }`}
                        onClick={() => toggleOverflow(entity.id)}
                      >
                        <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: OTHER_COLOR }} />
                        <span className="truncate">{entity.name}</span>
                      </a>
                    </li>
                  );
                })}
              </ul>
              <div className="flex justify-end pt-1 mt-1 border-t border-base-300">
                <a
                  className="text-xs text-base-content/60 hover:text-base-content px-2 py-1 cursor-pointer"
                  onClick={() => toggleLegend(OTHER_KEY)}
                >
                  {hiddenIds.has(OTHER_KEY) ? "Show all" : "Hide all"}
                </a>
              </div>
            </div>
          </details>
        )}
      </div>
    </div>
  );
});

MetricsChart.displayName = "MetricsChart";

export default MetricsChart;
