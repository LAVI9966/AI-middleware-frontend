import { memo, useState, useEffect, useCallback } from "react";
import { DownloadIcon, CloseIcon } from "@/components/Icons";
import { getMetricsDataApi } from "@/config/index";
import { aggregateMetricsByKey, computeCurrentWindow } from "@/customHooks/useMetricsData";
import { METRICS_FACTOR_OPTIONS, METRICS_FACTOR_LABELS } from "@/utils/enums";

const triggerDownload = (content, filename, mime) => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const toCsv = (rows) => {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escapeCell = (value) => {
    const str = String(value ?? "");
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const lines = [headers.join(","), ...rows.map((row) => headers.map((h) => escapeCell(row[h])).join(","))];
  return lines.join("\n");
};

const toDateInputValue = (date) => (date ? new Date(date).toISOString().slice(0, 10) : "");
const asFilterValue = (value) => (Array.isArray(value) ? (value.length ? value : undefined) : value || undefined);

const nameResolver =
  (keyField, { allBridges, apikeyData, services }) =>
  (id) => {
    if (keyField === "bridge_id")
      return allBridges.find((b) => b._id === id)?.name || `Agent ${String(id).slice(0, 6)}`;
    if (keyField === "apikey_id")
      return apikeyData.find((k) => k._id === id)?.name || `API Key ${String(id).slice(0, 6)}`;
    if (keyField === "service") return services.find((s) => s?.value === id)?.displayName || id;
    return id;
  };

// Export modal: "Group by" chooses which dimension to aggregate for the
// export, defaulting to the page's current grouping. Both the group-by and
// the date range are real, live controls - changing either fires a fresh
// POST /api/metrics scoped to a custom range (using the SAME agent/model/
// service/API-key filters currently active on the page), not a client-side
// reshape of data already sitting in memory.
const ExportMetricsButton = memo(
  ({
    orgId,
    factor,
    range,
    customStartDate,
    customEndDate,
    selectedBridgeIds,
    selectedApikeyIds,
    selectedModels,
    selectedServices,
    allBridges = [],
    apikeyData = [],
    services = [],
  }) => {
    const [isOpen, setIsOpen] = useState(false);
    // Defaults to the page's current grouping, but offers all four real
    // dimensions - matching what the backend can actually group by, not an
    // arbitrarily narrowed subset.
    const [groupByKey, setGroupByKey] = useState(METRICS_FACTOR_OPTIONS[factor] || "bridge_id");
    const [format, setFormat] = useState("csv");
    const [nameFilter, setNameFilter] = useState("");
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [dateRange, setDateRange] = useState(() => computeCurrentWindow(range, customStartDate, customEndDate));

    // Reset to the page's current window/grouping whenever the modal is (re)opened.
    useEffect(() => {
      if (isOpen) {
        setDateRange(computeCurrentWindow(range, customStartDate, customEndDate));
        setGroupByKey(METRICS_FACTOR_OPTIONS[factor] || "bridge_id");
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const runFetch = useCallback(async () => {
      if (!dateRange.start || !dateRange.end) return;
      setLoading(true);
      try {
        const requestBody = {
          range: 10,
          factor: groupByKey,
          org_id: orgId,
          start_date: dateRange.start,
          end_date: dateRange.end,
          bridge_id: asFilterValue(selectedBridgeIds),
          apikey_id: asFilterValue(selectedApikeyIds),
          model: asFilterValue(selectedModels),
          service: asFilterValue(selectedServices),
        };
        const apiData = await getMetricsDataApi(requestBody);
        setRows(
          aggregateMetricsByKey(apiData, groupByKey, nameResolver(groupByKey, { allBridges, apikeyData, services }))
        );
      } catch (error) {
        console.error("Error fetching export data:", error);
        setRows([]);
      } finally {
        setLoading(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groupByKey, orgId, dateRange, selectedBridgeIds, selectedApikeyIds, selectedModels, selectedServices]);

    useEffect(() => {
      if (isOpen) runFetch();
    }, [isOpen, runFetch]);

    const filteredRows = nameFilter.trim()
      ? rows.filter((row) =>
          String(row.name || "")
            .toLowerCase()
            .includes(nameFilter.trim().toLowerCase())
        )
      : rows;

    const handleDownload = () => {
      const stamp = new Date().toISOString().slice(0, 10);
      if (format === "json") {
        triggerDownload(JSON.stringify(filteredRows, null, 2), `gateway-metrics-${stamp}.json`, "application/json");
      } else {
        triggerDownload(toCsv(filteredRows), `gateway-metrics-${stamp}.csv`, "text/csv");
      }
      setIsOpen(false);
    };

    return (
      <>
        <button
          type="button"
          title="Export"
          onClick={() => setIsOpen(true)}
          className="w-9 h-9 rounded-lg border border-base-300 bg-base-100 flex items-center justify-center text-base-content/70 hover:bg-base-200 hover:text-base-content transition-colors"
        >
          <DownloadIcon className="w-4 h-4" />
        </button>

        {isOpen && (
          <div
            className="fixed inset-0 z-high flex items-center justify-center bg-black/45 p-5"
            onClick={() => setIsOpen(false)}
          >
            <div
              className="w-full max-w-[460px] max-h-[90vh] overflow-y-auto bg-base-100 border border-base-300 rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-base-300">
                <h3 className="text-[15.5px] font-bold text-base-content">Export metrics</h3>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-base-content/70 hover:bg-base-200"
                >
                  <CloseIcon className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 flex flex-col gap-3.5">
                <div>
                  <label className="text-[11.5px] font-semibold text-base-content/70 block mb-1.5">Group by</label>
                  <select
                    className="select select-sm w-full bg-base-200 border-base-300"
                    value={groupByKey}
                    onChange={(e) => setGroupByKey(e.target.value)}
                  >
                    {METRICS_FACTOR_OPTIONS.map((key, index) => (
                      <option key={key} value={key}>
                        {METRICS_FACTOR_LABELS[index]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11.5px] font-semibold text-base-content/70 block mb-1.5">
                      Filter by name
                    </label>
                    <input
                      type="text"
                      placeholder="All"
                      value={nameFilter}
                      onChange={(e) => setNameFilter(e.target.value)}
                      className="input input-sm w-full bg-base-200 border-base-300"
                    />
                  </div>
                  <div>
                    <label className="text-[11.5px] font-semibold text-base-content/70 block mb-1.5">File format</label>
                    <select
                      className="select select-sm w-full bg-base-200 border-base-300"
                      value={format}
                      onChange={(e) => setFormat(e.target.value)}
                    >
                      <option value="csv">CSV</option>
                      <option value="json">JSON</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11.5px] font-semibold text-base-content/70 block mb-1.5">Start date</label>
                    <input
                      type="date"
                      value={toDateInputValue(dateRange.start)}
                      max={toDateInputValue(dateRange.end)}
                      onChange={(e) => setDateRange((prev) => ({ ...prev, start: new Date(e.target.value) }))}
                      className="input input-sm w-full bg-base-200 border-base-300"
                    />
                  </div>
                  <div>
                    <label className="text-[11.5px] font-semibold text-base-content/70 block mb-1.5">End date</label>
                    <input
                      type="date"
                      value={toDateInputValue(dateRange.end)}
                      min={toDateInputValue(dateRange.start)}
                      max={toDateInputValue(new Date())}
                      onChange={(e) => setDateRange((prev) => ({ ...prev, end: new Date(e.target.value) }))}
                      className="input input-sm w-full bg-base-200 border-base-300"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={loading}
                  className="btn btn-primary btn-sm w-full mt-1 gap-2"
                >
                  {loading ? (
                    <span className="loading loading-spinner loading-xs"></span>
                  ) : (
                    <DownloadIcon className="w-4 h-4" />
                  )}
                  Export
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }
);

ExportMetricsButton.displayName = "ExportMetricsButton";

export default ExportMetricsButton;
