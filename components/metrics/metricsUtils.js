// Shared color palette and formatting helpers for the Metrics Dashboard.
// Data-viz accents have no theme equivalent, so a fixed palette is used;
// everything else in the dashboard relies on DaisyUI design tokens.

export const METRICS_COLORS = [
  "#10b981",
  "#8b5cf6",
  "#f59e0b",
  "#3b82f6",
  "#ef4444",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
  "#f97316",
  "#6366f1",
];

export const getMetricsColor = (index) => METRICS_COLORS[index % METRICS_COLORS.length];

// Stable string -> palette-index hash, so the same entity (agent/model/service/
// api key id) always gets the same color everywhere it's rendered (chart,
// legend, Models table row dot) without having to thread a shared color map
// through every component.
export const hashString = (value) => {
  let hash = 0;
  const str = String(value || "");
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

export const colorForId = (id) => getMetricsColor(hashString(id));

export const formatTokens = (tokens) => {
  const n = Number(tokens) || 0;
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
};

export const formatTokensFull = (tokens) => (Number(tokens) || 0).toLocaleString();

export const formatCost = (cost) => {
  const n = Number(cost) || 0;
  if (n === 0) return "$0";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  if (n < 1) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(2)}`;
};
