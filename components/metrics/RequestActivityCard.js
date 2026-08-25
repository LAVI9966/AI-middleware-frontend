import { memo, useState } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ChartIcon, LineChartIcon } from "@/components/Icons";

const SUCCESS_COLOR = "#4ade80";
const FAILED_COLOR = "#f87171";

// Real success vs failed request counts over time, from conversation_logs
// (via POST /api/metrics/requests-activity) - not simulated. Only real when
// `data` is non-empty; a genuinely idle window (0 requests) renders as a
// flat empty-state chart, same as any other card.
const RequestActivityCard = memo(({ data = [] }) => {
  const [chartType, setChartType] = useState("line");

  const chartData = data.map((row) => ({
    t: new Date(row.t).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
    success: Number(row.success) || 0,
    failed: Number(row.failed) || 0,
    avgLatency: row.avg_latency != null ? Number(row.avg_latency) : null,
  }));

  const totalSuccess = chartData.reduce((sum, row) => sum + row.success, 0);
  const totalFailed = chartData.reduce((sum, row) => sum + row.failed, 0);
  const totalRequests = totalSuccess + totalFailed;
  const errorRate = totalRequests > 0 ? ((totalFailed / totalRequests) * 100).toFixed(1) : "0.0";

  // Weighted by each bucket's successful-request count, not a plain mean of
  // per-bucket averages (which would let a near-empty bucket skew the result
  // as much as a busy one).
  const latencyWeightedSum = chartData.reduce(
    (sum, row) => sum + (row.avgLatency != null ? row.avgLatency * row.success : 0),
    0
  );
  const latencyWeight = chartData.reduce((sum, row) => sum + (row.avgLatency != null ? row.success : 0), 0);
  const avgLatency = latencyWeight > 0 ? Math.round(latencyWeightedSum / latencyWeight) : null;

  const ChartComponent = chartType === "bar" ? BarChart : LineChart;
  const SeriesComponent = chartType === "bar" ? Bar : Line;
  const seriesProps = chartType === "bar" ? { radius: [2, 2, 0, 0] } : { type: "monotone", strokeWidth: 2, dot: false };

  return (
    <div className="bg-base-100 shadow-md rounded-lg p-4 h-full flex flex-col" data-testid="request-activity-card">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-sm font-bold text-base-content">Request Activity</h2>
        <button
          type="button"
          title={chartType === "line" ? "Switch to bar chart" : "Switch to line chart"}
          onClick={() => setChartType((t) => (t === "line" ? "bar" : "line"))}
          className="w-7 h-7 rounded-lg border border-base-300 bg-base-100 flex items-center justify-center text-base-content/60 hover:bg-base-200 hover:text-base-content flex-shrink-0 transition-colors"
        >
          {chartType === "line" ? <ChartIcon className="w-3.5 h-3.5" /> : <LineChartIcon className="w-3.5 h-3.5" />}
        </button>
      </div>
      <div className="text-[11px] font-semibold tracking-wide text-base-content/50 uppercase mt-0.5">
        Total Requests: <span className="text-base-content">{totalRequests.toLocaleString()}</span>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2 mt-3">
        <div>
          <div className="text-lg font-bold text-success leading-none">{totalSuccess.toLocaleString()}</div>
          <div className="flex items-center gap-1.5 text-[11px] text-base-content/50 mt-1">
            <span className="w-1.5 h-1.5 rounded-sm bg-success flex-shrink-0" />
            Successful
          </div>
        </div>
        <div>
          <div className="text-lg font-bold text-error leading-none">{totalFailed.toLocaleString()}</div>
          <div className="flex items-center gap-1.5 text-[11px] text-base-content/50 mt-1">
            <span className="w-1.5 h-1.5 rounded-sm bg-error flex-shrink-0" />
            Failed
          </div>
        </div>
        <div>
          <div className="text-lg font-bold text-base-content leading-none">{errorRate}%</div>
          <div className="text-[11px] text-base-content/50 mt-1">Error rate</div>
        </div>
        <div>
          <div className="text-lg font-bold text-base-content leading-none">
            {avgLatency !== null ? `${avgLatency} ms` : "-"}
          </div>
          <div className="text-[11px] text-base-content/50 mt-1">Avg latency</div>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="flex-1 min-h-[200px] flex items-center justify-center text-base-content/60 text-sm">
          No requests in this period
        </div>
      ) : (
        <div className="flex-1 min-h-[200px] mt-3 -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <ChartComponent data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-base-300" vertical={false} />
              <XAxis dataKey="t" tick={{ fontSize: 10 }} className="fill-base-content/70" minTickGap={24} />
              <YAxis tick={{ fontSize: 10 }} className="fill-base-content/70" allowDecimals={false} width={30} />
              <Tooltip
                contentStyle={{
                  background: "var(--fallback-b1,oklch(var(--b1)))",
                  border: "1px solid var(--fallback-b3,oklch(var(--b3)))",
                  borderRadius: "0.5rem",
                  fontSize: "12px",
                }}
              />
              <SeriesComponent
                dataKey="success"
                name="Successful"
                fill={SUCCESS_COLOR}
                stroke={SUCCESS_COLOR}
                {...seriesProps}
              />
              <SeriesComponent
                dataKey="failed"
                name="Failed"
                fill={FAILED_COLOR}
                stroke={FAILED_COLOR}
                {...seriesProps}
              />
            </ChartComponent>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
});

RequestActivityCard.displayName = "RequestActivityCard";

export default RequestActivityCard;
