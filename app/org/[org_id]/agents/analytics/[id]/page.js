"use client";

import React, { use, useCallback, useEffect, useState, useRef } from "react";
import { useDispatch } from "react-redux";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { useCustomSelector } from "@/customHooks/customSelector";
import { getHistoryAction, getThread } from "@/store/action/historyAction";
import { getAgentAnalyticsAction } from "@/store/action/analyticsAction";
import { getAgentAnalyticsFiltersApi } from "@/config";
import { setSelectedVersion } from "@/store/reducer/historyReducer";
import Protected from "@/components/Protected";
import useRtLayerEventHandler from "@/customHooks/useRtLayerEventHandler";

import { Activity, BarChart3, TrendingDown, TrendingUp, X, Bot } from "lucide-react";
import Chart from "@/components/LazyApexChart";

import Sidebar from "@/components/historyPageComponents/Sidebar";
import BatchSubthreadPanel from "@/components/historyPageComponents/BatchSubthreadPanel";
import ThreadContainer from "@/components/historyPageComponents/ThreadContainer";
import { getStatsConfig, MODAL_TYPE } from "@/utils/enums";
import { openModal } from "@/utils/utility";
import ChatAiConfigDeatilViewModal from "@/components/modals/ChatAiConfigDeatilViewModal";

function Page({ params, searchParams }) {
  const resolvedSearchParams = use(searchParams);
  const resolvedParams = use(params);
  const search = useSearchParams();
  const pathName = usePathname();
  const dispatch = useDispatch();

  const channelId =
    resolvedParams?.org_id && resolvedParams?.id
      ? `${resolvedParams.org_id}_${resolvedParams.id}`.replace(/ /g, "_")
      : "";
  useRtLayerEventHandler(channelId);

  const { historyData, thread, analyticsData, selectedVersion } = useCustomSelector((state) => {
    return {
      historyData: state?.historyReducer?.history || [],
      thread: state?.historyReducer?.thread || [],
      analyticsData: state?.analyticsReducer?.analyticsData?.[resolvedParams.id] || {},
      selectedVersion: state?.historyReducer?.selectedVersion || "all",
    };
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [selectedThreadId, setSelectedThreadId] = useState(null);
  const [selectedSubThreadId, setSelectedSubThreadId] = useState(null);
  const [selectedBatchMessageId, setSelectedBatchMessageId] = useState(null);
  const [isSliderOpen, setIsSliderOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [executionChartType, setExecutionChartType] = useState("area");
  const [latencyChartType, setLatencyChartType] = useState("area");

  const router = useRouter();
  const searchRef = useRef(null);
  const isFirstRender = useRef(true);
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const customDropdownRef = useRef(null);

  // Search-by-fields state (moved out from sidebar for analytics)
  const [filterByFields, setFilterByFields] = useState({
    thread_id: "",
    sub_thread_id: "",
    message_id: "",
    batch_id: "",
    user: "",
    llm_message: "",
  });
  const [filterVariableKey, setFilterVariableKey] = useState("");
  const [filterVariableValue, setFilterVariableValue] = useState("");

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (customDropdownRef.current && !customDropdownRef.current.contains(e.target)) {
        setIsCustomOpen(false);
      }
    };
    if (isCustomOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
      document.addEventListener("touchstart", handleOutsideClick, { passive: true });
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [isCustomOpen]);

  // Local state for the filter dropdown
  const getNormalizedRange = (r) => {
    if (r === "7") return "7d";
    if (r === "30") return "30d";
    if (r === "1" || r === "24") return "24h";
    return r || "30d";
  };

  const [filterStart, setFilterStart] = useState(resolvedSearchParams?.start || "");
  const [filterEnd, setFilterEnd] = useState(resolvedSearchParams?.end || "");
  const [filterRange, setFilterRange] = useState(getNormalizedRange(resolvedSearchParams?.range));
  const [filterInterval, setFilterInterval] = useState(resolvedSearchParams?.interval || "");
  const [filterFeedback, setFilterFeedback] = useState(resolvedSearchParams?.feedback || "all");
  const [filterError, setFilterError] = useState(resolvedSearchParams?.error === "true");
  const [filterTool, setFilterTool] = useState(resolvedSearchParams?.tool_id || "");
  const [filterModel, setFilterModel] = useState(resolvedSearchParams?.model || "");
  const [filterOptions, setFilterOptions] = useState({ tools_data: {}, unique_model: {} });

  const summary = analyticsData?.summary || {};
  const requestsOverTime = analyticsData?.requests_over_time || [];
  const responseTime = analyticsData?.response_time || [];

  const getDates = () => {
    let startDate = resolvedSearchParams?.start || "";
    let endDate = resolvedSearchParams?.end || "";

    if (!startDate && !endDate) {
      const rangeVal = resolvedSearchParams?.range || "30d";
      const now = new Date();
      let start;
      if (rangeVal === "24h") {
        start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      } else if (rangeVal === "7d") {
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (rangeVal === "30d") {
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
      if (start) {
        startDate = start.toISOString();
        endDate = now.toISOString();
      }
    }
    return { startDate, endDate };
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  };

  const executionData = requestsOverTime.map((item) => ({
    time: formatDate(item.t),
    success: item.success,
    failed: item.failed,
  }));

  const latencyData = responseTime.map((item) => ({
    time: formatDate(item.t),
    typical: Number(((item.typical || 0) / 1000).toFixed(2)),
    slow: Number(((item.slow || 0) / 1000).toFixed(2)),
    worst: Number(((item.worst || 0) / 1000).toFixed(2)),
  }));

  useEffect(() => {
    return () => {
      dispatch(setSelectedVersion("all"));
    };
  }, [dispatch]);

  useEffect(() => {
    if (!resolvedParams?.id) return;
    const fetchFilters = async () => {
      try {
        const data = await getAgentAnalyticsFiltersApi(resolvedParams.id);
        setFilterOptions({ tools_data: data.tools_data || {}, unique_model: data.unique_model || {} });
      } catch (e) {
        console.error("Failed to fetch filter options:", e);
      }
    };
    fetchFilters();
  }, [resolvedParams?.id]);

  // Fetch agent analytics (with a 1-second delay on refresh/initial mount, and immediately on subsequent updates)
  useEffect(() => {
    if (!resolvedParams?.id) return;

    const queryParams = { ...resolvedSearchParams };
    if (queryParams.start) queryParams.start_date = queryParams.start;
    if (queryParams.end) queryParams.end_date = queryParams.end;
    if (!queryParams.start && !queryParams.end) {
      queryParams.range = queryParams.range || "30d";
    }
    queryParams.version = selectedVersion;

    // Build filter_by from search-by-fields state
    const activeFilterBy = {};
    if (filterByFields.thread_id?.trim()) activeFilterBy.thread_id = filterByFields.thread_id.trim();
    if (filterByFields.sub_thread_id?.trim()) activeFilterBy.sub_thread_id = filterByFields.sub_thread_id.trim();
    if (filterByFields.message_id?.trim()) activeFilterBy.message_id = filterByFields.message_id.trim();
    if (filterByFields.batch_id?.trim()) activeFilterBy.batch_id = filterByFields.batch_id.trim();
    if (filterByFields.user?.trim()) activeFilterBy.user = filterByFields.user.trim();
    if (filterByFields.llm_message?.trim()) activeFilterBy.llm_message = filterByFields.llm_message.trim();
    if (filterVariableKey.trim() && filterVariableValue.trim()) {
      activeFilterBy.variables = { [filterVariableKey.trim()]: filterVariableValue.trim() };
    } else if (filterVariableValue.trim()) {
      activeFilterBy.variables = filterVariableValue.trim();
    }
    if (Object.keys(activeFilterBy).length > 0) {
      queryParams.filter_by = activeFilterBy;
    }

    if (isFirstRender.current) {
      isFirstRender.current = false;
      const timer = setTimeout(() => {
        dispatch(getAgentAnalyticsAction(resolvedParams.id, queryParams));
      }, 1000); // 1-second delay on initial load / refresh
      return () => clearTimeout(timer);
    } else {
      dispatch(getAgentAnalyticsAction(resolvedParams.id, queryParams));
    }
  }, [
    resolvedParams?.id,
    resolvedSearchParams?.start,
    resolvedSearchParams?.end,
    resolvedSearchParams?.range,
    resolvedSearchParams?.interval,
    resolvedSearchParams?.feedback,
    resolvedSearchParams?.error,
    resolvedSearchParams?.tool_id,
    resolvedSearchParams?.model,
    selectedVersion,
    filterByFields,
    filterVariableKey,
    filterVariableValue,
    dispatch,
  ]);

  // Initial fetch for history
  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      const { startDate, endDate } = getDates();
      const feedback = resolvedSearchParams?.feedback || "all";
      const isError = resolvedSearchParams?.error === "true";

      const activeFilterBy = {};
      if (filterByFields.thread_id?.trim()) activeFilterBy.thread_id = filterByFields.thread_id.trim();
      if (filterByFields.sub_thread_id?.trim()) activeFilterBy.sub_thread_id = filterByFields.sub_thread_id.trim();
      if (filterByFields.message_id?.trim()) activeFilterBy.message_id = filterByFields.message_id.trim();
      if (filterByFields.batch_id?.trim()) activeFilterBy.batch_id = filterByFields.batch_id.trim();
      if (filterByFields.user?.trim()) activeFilterBy.user = filterByFields.user.trim();
      if (filterByFields.llm_message?.trim()) activeFilterBy.llm_message = filterByFields.llm_message.trim();
      if (filterVariableKey.trim() && filterVariableValue.trim()) {
        activeFilterBy.variables = { [filterVariableKey.trim()]: filterVariableValue.trim() };
      } else if (filterVariableValue.trim()) {
        activeFilterBy.variables = filterVariableValue.trim();
      }

      const result = await dispatch(
        getHistoryAction(resolvedParams.id, 1, feedback, isError, selectedVersion, "", startDate, endDate, Object.keys(activeFilterBy).length > 0 ? activeFilterBy : undefined)
      );
      if (result && result.length > 0) {
        setHasMore(result.length >= 40); // PAGE_SIZE is usually 40
      } else {
        setHasMore(false);
      }
      setLoading(false);
    };
    fetchInitialData();
  }, [
    resolvedParams.id,
    resolvedSearchParams?.start,
    resolvedSearchParams?.end,
    resolvedSearchParams?.range,
    resolvedSearchParams?.feedback,
    resolvedSearchParams?.error,
    selectedVersion,
    filterByFields,
    filterVariableKey,
    filterVariableValue,
  ]);

  const fetchMoreData = async () => {
    if (!hasMore || loading) return;
    const nextPage = page + 1;
    const { startDate, endDate } = getDates();
    const feedback = resolvedSearchParams?.feedback || "all";
    const isError = resolvedSearchParams?.error === "true";

    const activeFilterBy = {};
    if (filterByFields.thread_id?.trim()) activeFilterBy.thread_id = filterByFields.thread_id.trim();
    if (filterByFields.sub_thread_id?.trim()) activeFilterBy.sub_thread_id = filterByFields.sub_thread_id.trim();
    if (filterByFields.message_id?.trim()) activeFilterBy.message_id = filterByFields.message_id.trim();
    if (filterByFields.batch_id?.trim()) activeFilterBy.batch_id = filterByFields.batch_id.trim();
    if (filterByFields.user?.trim()) activeFilterBy.user = filterByFields.user.trim();
    if (filterByFields.llm_message?.trim()) activeFilterBy.llm_message = filterByFields.llm_message.trim();
    if (filterVariableKey.trim() && filterVariableValue.trim()) {
      activeFilterBy.variables = { [filterVariableKey.trim()]: filterVariableValue.trim() };
    } else if (filterVariableValue.trim()) {
      activeFilterBy.variables = filterVariableValue.trim();
    }

    const result = await dispatch(
      getHistoryAction(resolvedParams.id, nextPage, feedback, isError, selectedVersion, searchQuery, startDate, endDate, Object.keys(activeFilterBy).length > 0 ? activeFilterBy : undefined)
    );
    if (result && result.length > 0) {
      setPage(nextPage);
      setHasMore(result.length >= 40);
    } else {
      setHasMore(false);
    }
  };

  const handleSearch = async (query) => {
    setSearchQuery(query);
    setPage(1);
    setLoading(true);
    const { startDate, endDate } = getDates();
    const feedback = resolvedSearchParams?.feedback || "all";
    const isError = resolvedSearchParams?.error === "true";

    const activeFilterBy = {};
    if (filterByFields.thread_id?.trim()) activeFilterBy.thread_id = filterByFields.thread_id.trim();
    if (filterByFields.sub_thread_id?.trim()) activeFilterBy.sub_thread_id = filterByFields.sub_thread_id.trim();
    if (filterByFields.message_id?.trim()) activeFilterBy.message_id = filterByFields.message_id.trim();
    if (filterByFields.batch_id?.trim()) activeFilterBy.batch_id = filterByFields.batch_id.trim();
    if (filterByFields.user?.trim()) activeFilterBy.user = filterByFields.user.trim();
    if (filterByFields.llm_message?.trim()) activeFilterBy.llm_message = filterByFields.llm_message.trim();
    if (filterVariableKey.trim() && filterVariableValue.trim()) {
      activeFilterBy.variables = { [filterVariableKey.trim()]: filterVariableValue.trim() };
    } else if (filterVariableValue.trim()) {
      activeFilterBy.variables = filterVariableValue.trim();
    }

    const result = await dispatch(
      getHistoryAction(resolvedParams.id, 1, feedback, isError, selectedVersion, query, startDate, endDate, Object.keys(activeFilterBy).length > 0 ? activeFilterBy : undefined)
    );
    if (result && result.length > 0) {
      setHasMore(result.length >= 40);
    } else {
      setHasMore(false);
    }
    setLoading(false);
  };

  const urlThreadId = search.get("thread_id");
  const urlSubThreadId = search.get("subThread_id");

  useEffect(() => {
    if (urlThreadId) {
      const activeSubThread = urlSubThreadId || urlThreadId;
      setSelectedThreadId(urlThreadId);
      setSelectedSubThreadId(activeSubThread);
      setIsSliderOpen(true);

      dispatch(
        getThread({
          threadId: urlThreadId,
          bridgeId: resolvedParams.id,
          nextPage: 1,
          user_feedback: "all",
          subThreadId: activeSubThread,
          versionId: "",
          error: false,
        })
      );
    } else {
      setSelectedThreadId(null);
      setSelectedSubThreadId(null);
      setIsSliderOpen(false);
    }
  }, [urlThreadId, urlSubThreadId, resolvedParams.id, dispatch]);

  const threadHandler = useCallback(
    async (thread_id, item, value) => {
      const start = search.get("start") || "";
      const end = search.get("end") || "";
      const range = search.get("range") || "";
      const interval = search.get("interval") || "";
      const feedback = search.get("feedback") || "";
      const error = search.get("error") || "";
      const tool_id = search.get("tool_id") || "";
      const model = search.get("model") || "";

      const encodedThreadId = encodeURIComponent(thread_id.replace(/&/g, "%26"));
      const firstSubThreadId = item?.sub_thread?.[0]?.sub_thread_id || thread_id;
      const encodedSubThreadId = encodeURIComponent(firstSubThreadId.replace(/&/g, "%26"));

      const paramsObj = new URLSearchParams();
      if (start) paramsObj.set("start", start);
      if (end) paramsObj.set("end", end);
      if (range) paramsObj.set("range", range);
      if (interval) paramsObj.set("interval", interval);
      if (feedback) paramsObj.set("feedback", feedback);
      if (error) paramsObj.set("error", error);
      if (tool_id) paramsObj.set("tool_id", tool_id);
      if (model) paramsObj.set("model", model);
      paramsObj.set("thread_id", encodedThreadId);
      paramsObj.set("subThread_id", encodedSubThreadId);

      router.push(`${pathName}?${paramsObj.toString()}`, undefined, { shallow: true });
    },
    [pathName, router, search]
  );

  const handleSelectSubThread = useCallback(
    async (subThreadId) => {
      setSelectedBatchMessageId(null);
      const start = search.get("start") || "";
      const end = search.get("end") || "";
      const range = search.get("range") || "";
      const interval = search.get("interval") || "";
      const feedback = search.get("feedback") || "";
      const error = search.get("error") || "";
      const tool_id = search.get("tool_id") || "";
      const model = search.get("model") || "";
      const threadId = search.get("thread_id") || "";

      const paramsObj = new URLSearchParams();
      if (start) paramsObj.set("start", start);
      if (end) paramsObj.set("end", end);
      if (range) paramsObj.set("range", range);
      if (interval) paramsObj.set("interval", interval);
      if (feedback) paramsObj.set("feedback", feedback);
      if (error) paramsObj.set("error", error);
      if (tool_id) paramsObj.set("tool_id", tool_id);
      if (model) paramsObj.set("model", model);
      if (threadId) paramsObj.set("thread_id", threadId);
      paramsObj.set("subThread_id", encodeURIComponent(subThreadId.replace(/&/g, "%26")));

      router.push(`${pathName}?${paramsObj.toString()}`, undefined, { shallow: true });
    },
    [pathName, router, search]
  );

  const handleCloseAside = useCallback(() => {
    setSelectedThreadId(null);
    setSelectedSubThreadId(null);
    setSelectedBatchMessageId(null);
    setIsSliderOpen(false);

    const start = search.get("start") || "";
    const end = search.get("end") || "";
    const range = search.get("range") || "";
    const interval = search.get("interval") || "";
    const feedback = search.get("feedback") || "";
    const error = search.get("error") || "";
    const tool_id = search.get("tool_id") || "";
    const model = search.get("model") || "";

    const paramsObj = new URLSearchParams();
    if (start) paramsObj.set("start", start);
    if (end) paramsObj.set("end", end);
    if (range) paramsObj.set("range", range);
    if (interval) paramsObj.set("interval", interval);
    if (feedback) paramsObj.set("feedback", feedback);
    if (error) paramsObj.set("error", error);
    if (tool_id) paramsObj.set("tool_id", tool_id);
    if (model) paramsObj.set("model", model);

    router.push(`${pathName}?${paramsObj.toString()}`, undefined, { shallow: true });
  }, [pathName, router, search]);

  const handleSelectBatch = useCallback((messageId) => {
    setSelectedBatchMessageId(messageId);
  }, []);

  const handleThreadItemClick = useCallback((thread_id, item, value) => {
    if (value === "AiConfig" || value === "Latency") {
      setSelectedItem({ variables: item.variables, ...item, value });
      openModal(MODAL_TYPE.CHAT_DETAILS_VIEW_MODAL);
    }
  }, []);

  const applyFilters = (updates = {}) => {
    const currentUrl = new URL(window.location);

    const newStart = updates.start !== undefined ? updates.start : filterStart;
    const newEnd = updates.end !== undefined ? updates.end : filterEnd;
    const newRange = updates.range !== undefined ? updates.range : filterRange;
    const newInterval = updates.interval !== undefined ? updates.interval : filterInterval;
    const newFeedback = updates.feedback !== undefined ? updates.feedback : filterFeedback;
    const newError = updates.error !== undefined ? updates.error : filterError;
    const newTool = updates.tool_id !== undefined ? updates.tool_id : filterTool;
    const newModel = updates.model !== undefined ? updates.model : filterModel;

    if (newStart) currentUrl.searchParams.set("start", newStart);
    else currentUrl.searchParams.delete("start");

    if (newEnd) currentUrl.searchParams.set("end", newEnd);
    else currentUrl.searchParams.delete("end");

    if (newRange && !newStart && !newEnd) currentUrl.searchParams.set("range", newRange);
    else currentUrl.searchParams.delete("range");

    if (newInterval) currentUrl.searchParams.set("interval", newInterval);
    else currentUrl.searchParams.delete("interval");

    if (newFeedback && newFeedback !== "all") currentUrl.searchParams.set("feedback", newFeedback);
    else currentUrl.searchParams.delete("feedback");

    if (newError) currentUrl.searchParams.set("error", "true");
    else currentUrl.searchParams.delete("error");

    if (newTool) currentUrl.searchParams.set("tool_id", newTool);
    else currentUrl.searchParams.delete("tool_id");

    if (newModel) currentUrl.searchParams.set("model", newModel);
    else currentUrl.searchParams.delete("model");

    router.push(currentUrl.pathname + currentUrl.search);
  };

  const clearFilters = () => {
    setFilterStart("");
    setFilterEnd("");
    setFilterRange("30d");
    setFilterInterval("");
    setFilterFeedback("all");
    setFilterError(false);
    setFilterTool("");
    setFilterModel("");
    setFilterByFields({ thread_id: "", sub_thread_id: "", message_id: "", batch_id: "", user: "", llm_message: "" });
    setFilterVariableKey("");
    setFilterVariableValue("");
    dispatch(setSelectedVersion("all"));
    setIsCustomOpen(false);

    const currentUrl = new URL(window.location);
    currentUrl.searchParams.delete("start");
    currentUrl.searchParams.delete("end");
    currentUrl.searchParams.delete("range");
    currentUrl.searchParams.delete("interval");
    currentUrl.searchParams.delete("feedback");
    currentUrl.searchParams.delete("error");
    currentUrl.searchParams.delete("tool_id");
    currentUrl.searchParams.delete("model");
    router.push(currentUrl.pathname + currentUrl.search);

    if (document.activeElement) {
      document.activeElement.blur();
    }
  };

  return (
    <div className="flex h-[calc(100vh-40px)] w-full overflow-hidden bg-base-200/50">
      {/* Main Dashboard Area */}
      <div className="flex-1 relative flex flex-row max-w-full overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          {selectedThreadId ? (
            <div className="flex flex-col h-full bg-base-100">
              <div className="h-14 border-b border-base-300 flex items-center justify-between px-4 bg-base-100 shrink-0">
                <h3 className="font-semibold text-sm truncate">Thread Details</h3>
                <button onClick={handleCloseAside} className="btn btn-ghost btn-sm btn-circle shrink-0">
                  <X size={16} className="text-base-content/60 hover:text-base-content" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <ThreadContainer
                  thread={
                    selectedBatchMessageId
                      ? thread.filter((msg) => msg?.message_id === selectedBatchMessageId)
                      : thread
                  }
                  searchParamsHook={search}
                  isSingleQuery={false}
                  isFetchingMore={false}
                  setIsFetchingMore={() => {}}
                  searchMessageId={null}
                  setSearchMessageId={() => {}}
                  pathName={pathName}
                  search={search}
                  historyData={historyData}
                  threadHandler={handleThreadItemClick}
                  setLoading={() => {}}
                  threadPage={1}
                  setThreadPage={() => {}}
                  hasMoreThreadData={false}
                  setHasMoreThreadData={() => {}}
                  selectedVersion={"all"}
                  previousPrompt={""}
                  isErrorTrue={false}
                />
              </div>
            </div>
          ) : (
            <div className="p-6">
          {/* Dashboard Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-base-content">Agent Analytics</h1>
              <p className="text-sm text-base-content/60 mt-1">Overview of agent performance and execution history.</p>
            </div>
          </div>

          {/* Horizontal Filter Bar */}
          <div className="flex items-center justify-between w-full bg-base-100 border border-base-300 rounded-lg px-4 py-2.5 mb-8 shadow-sm">
            <div className="flex items-center gap-4 flex-wrap">
              {/* Time Range */}
              <span className="text-[11px] font-bold tracking-widest text-base-content/40 uppercase shrink-0">
                Time Range
              </span>
              <div className="flex gap-1.5 shrink-0">
                {[
                  { label: "24h", value: "24h" },
                  { label: "7d", value: "7d" },
                  { label: "30d", value: "30d" },
                ].map((item) => {
                  const isActive = filterRange === item.value && !filterStart && !filterEnd;

                  return (
                    <button
                      key={item.value}
                      onClick={() => {
                        setFilterRange(item.value);
                        setFilterStart("");
                        setFilterEnd("");
                        applyFilters({ range: item.value, start: "", end: "" });
                      }}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        isActive ? "bg-blue-500 text-white" : "bg-base-200 text-base-content/70 hover:bg-base-300"
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}

                {/* Custom Date Dropdown replacing the pill */}
                <div ref={customDropdownRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setIsCustomOpen(!isCustomOpen)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer border-none outline-none focus:outline-none focus:ring-0 ${
                      filterStart || filterEnd
                        ? "bg-blue-500 text-white"
                        : "bg-base-200 text-base-content/70 hover:bg-base-300"
                    }`}
                  >
                    Custom
                  </button>
                  {isCustomOpen && (
                    <div className="absolute left-0 z-50 menu p-4 shadow-xl border border-base-300 bg-base-100 rounded-box w-80 mt-2">
                      <h3 className="font-semibold text-sm mb-4 text-base-content">Custom Date Range</h3>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-medium text-base-content/70 mb-1">Start Date</label>
                          <input
                            type="datetime-local"
                            className="input input-sm input-bordered w-full text-xs"
                            value={filterStart}
                            max={filterEnd}
                            onChange={(e) => {
                              setFilterStart(e.target.value);
                              setFilterRange("");
                            }}
                            onClick={(e) => e.target.showPicker()}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-base-content/70 mb-1">End Date</label>
                          <input
                            type="datetime-local"
                            className="input input-sm input-bordered w-full text-xs"
                            value={filterEnd}
                            min={filterStart}
                            onChange={(e) => {
                              setFilterEnd(e.target.value);
                              setFilterRange("");
                            }}
                            onClick={(e) => e.target.showPicker()}
                          />
                        </div>

                        <div className="flex gap-2 pt-2">
                          <button
                            className="btn btn-sm btn-primary flex-1"
                            onClick={() => {
                              applyFilters();
                              setIsCustomOpen(false);
                              if (document.activeElement) document.activeElement.blur();
                            }}
                          >
                            Apply
                          </button>
                          <button
                            className="btn btn-sm btn-outline flex-1"
                            onClick={() => {
                              clearFilters();
                              setIsCustomOpen(false);
                            }}
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="w-px h-4 bg-base-300 shrink-0" />

              {/* Interval */}
              <span className="text-[11px] font-bold tracking-widest text-base-content/40 uppercase shrink-0">
                Interval
              </span>
              <div className="flex gap-1.5 shrink-0">
                {[
                  { label: "1h", value: "1h" },
                  { label: "3h", value: "3h" },
                  { label: "6h", value: "6h" },
                  { label: "12h", value: "12h" },
                  { label: "24h", value: "24h" },
                ].map((item) => (
                  <button
                    key={item.value}
                    onClick={() => {
                      const newInterval = filterInterval === item.value ? "" : item.value;
                      setFilterInterval(newInterval);
                      applyFilters({ interval: newInterval });
                    }}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      filterInterval === item.value
                        ? "bg-blue-500 text-white"
                        : "bg-base-200 text-base-content/70 hover:bg-base-300"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="w-px h-4 bg-base-300 shrink-0" />

              {/* Feedback */}
              <span className="text-[11px] font-bold tracking-widest text-base-content/40 uppercase shrink-0">
                Feedback
              </span>
              <div className="flex gap-1.5 shrink-0">
                {[
                  { label: "Any", value: "all" },
                  { label: "Good", value: "1" },
                  { label: "Bad", value: "2" },
                ].map((item) => (
                  <button
                    key={item.value}
                    onClick={() => {
                      setFilterFeedback(item.value);
                      applyFilters({ feedback: item.value });
                    }}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      filterFeedback === item.value
                        ? "bg-blue-500 text-white"
                        : "bg-base-200 text-base-content/70 hover:bg-base-300"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="w-px h-4 bg-base-300 shrink-0" />

              {/* Error Toggle */}
              <label className="flex items-center gap-2 cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  className="toggle toggle-sm"
                  checked={filterError}
                  onChange={(e) => {
                    setFilterError(e.target.checked);
                    applyFilters({ error: e.target.checked });
                  }}
                />
                <span className="text-xs font-medium text-base-content/70">Error History</span>
              </label>

              <div className="w-px h-4 bg-base-300 shrink-0" />

              {/* Tool Filter - Badge style */}
              <span className="text-[11px] font-bold tracking-widest text-base-content/40 uppercase shrink-0">Tool</span>
              <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                <button
                  onClick={() => {
                    const val = filterTool === "" ? "" : "";
                    setFilterTool(val);
                    applyFilters({ tool_id: val });
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    filterTool === ""
                      ? "bg-blue-500 text-white"
                      : "bg-base-200 text-base-content/70 hover:bg-base-300"
                  }`}
                >
                  All
                </button>
                {Object.entries(filterOptions.tools_data).map(([name, id]) => (
                  <button
                    key={id}
                    onClick={() => {
                      const val = filterTool === id ? "" : id;
                      setFilterTool(val);
                      applyFilters({ tool_id: val });
                    }}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      filterTool === id
                        ? "bg-blue-500 text-white"
                        : "bg-base-200 text-base-content/70 hover:bg-base-300"
                    }`}
                    title={name}
                  >
                    {name.length > 20 ? name.slice(0, 20) + "..." : name}
                  </button>
                ))}
              </div>

              <div className="w-px h-4 bg-base-300 shrink-0" />

              {/* Model Filter */}
              <span className="text-[11px] font-bold tracking-widest text-base-content/40 uppercase shrink-0">Model</span>
              <select
                className="select select-sm select-bordered text-xs min-w-[8rem]"
                value={filterModel}
                onChange={(e) => {
                  const val = e.target.value;
                  setFilterModel(val);
                  applyFilters({ model: val });
                }}
              >
                <option value="">All</option>
                {Object.entries(filterOptions.unique_model).flatMap(([service, models]) =>
                  models.map((m) => (
                    <option key={`${service}-${m}`} value={m}>
                      {m} ({service})
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* Advance Filters Accordion */}
          <div className="collapse collapse-arrow border border-base-300 bg-base-100 rounded-lg mb-8 overflow-hidden">
            <input type="checkbox" className="peer" />
            <div className="collapse-title font-semibold min-h-0 py-3 flex items-center">
              <span className="text-xs">Advance Filters</span>
            </div>
            <div className="collapse-content !p-0 w-full min-w-0">
              <div className="p-4 bg-base-200 space-y-4">
                {/* Search by Fields */}
                <div>
                  <p className="text-xs font-medium text-base-content mb-2">Search by Fields</p>
                  <p className="text-[11px] text-base-content/60 mb-3">
                    Fill in values for fields you want to search. Leave empty to skip that field.
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { key: "thread_id", label: "Thread ID" },
                      { key: "sub_thread_id", label: "Sub Thread ID" },
                      { key: "message_id", label: "Message ID" },
                      { key: "batch_id", label: "Batch ID" },
                      { key: "user", label: "User" },
                      { key: "llm_message", label: "LLM Message" },
                    ].map((f) => (
                      <div key={f.key}>
                        <label className="block text-xs font-medium text-base-content/70 mb-0.5">{f.label}</label>
                        <input
                          type="text"
                          className="input input-sm input-bordered w-full text-xs"
                          placeholder={`Search ${f.label.toLowerCase()}...`}
                          value={filterByFields[f.key] || ""}
                          onChange={(e) =>
                            setFilterByFields((prev) => ({ ...prev, [f.key]: e.target.value }))
                          }
                        />
                      </div>
                    ))}
                    <div className="col-span-2 md:col-span-3">
                      <label className="block text-xs font-medium text-base-content/70 mb-0.5">Variables</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          className="input input-sm input-bordered flex-1 text-xs"
                          placeholder="key"
                          value={filterVariableKey}
                          onChange={(e) => setFilterVariableKey(e.target.value)}
                        />
                        <input
                          type="text"
                          className="input input-sm input-bordered flex-1 text-xs"
                          placeholder="value"
                          value={filterVariableValue}
                          onChange={(e) => setFilterVariableValue(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => {
                        if (document.activeElement) document.activeElement.blur();
                      }}
                    >
                      Apply Filter
                    </button>
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={() => {
                        setFilterByFields({ thread_id: "", sub_thread_id: "", message_id: "", batch_id: "", user: "", llm_message: "" });
                        setFilterVariableKey("");
                        setFilterVariableValue("");
                      }}
                    >
                      Reset Fields
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* KPI Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-4 mb-8">
            {getStatsConfig(summary).map((stat, idx) => {
              const Icon = stat.icon;
              return (
                <div
                  key={idx}
                  className="bg-base-100 p-5 rounded-2xl border border-base-300 shadow-sm flex flex-col gap-1"
                >
                  <div className="flex justify-between items-start">
                    <div className={`p-2.5 rounded-xl ${stat.bg} ${stat.color}`}>
                      <Icon size={16} />
                    </div>
                    <div
                      className={`flex items-center gap-1 text-xs font-semibold ${stat.trend === "up" ? "text-emerald-500" : "text-red-500"}`}
                    >
                      {stat.trend === "up" ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                      {stat.change}
                    </div>
                  </div>
                  <div className="flex flex-col mt-2">
                    <p className="text-xl font-bold text-base-content">{stat.value}</p>
                    <h3 className="text-[11px] font-medium text-base-content/60 mt-0.5">{stat.title}</h3>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Success / Failure Chart */}
            <div className="bg-base-100 p-6 rounded-2xl border border-base-300 shadow-sm flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-base font-semibold text-base-content">Execution Volume</h3>
                  <p className="text-xs text-base-content/60">Success vs Failed runs over time</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setExecutionChartType((prev) => (prev === "area" ? "bar" : "area"))}
                    className="btn btn-ghost btn-xs btn-circle"
                    title="Toggle bar / area"
                  >
                    <BarChart3 size={16} />
                  </button>
                </div>
              </div>
              <div className="flex-1 min-h-[240px]">
                <Chart
                  type={executionChartType}
                  height="100%"
                  options={{
                    chart: { type: executionChartType, toolbar: { show: false }, animations: { enabled: true }, zoom: { enabled: false }, pan: { enabled: false } },
                    colors: ["#10b981", "#ef4444"],
                    stroke: { curve: "smooth", width: 2 },
                    fill: executionChartType === "area" ? {
                      type: "gradient",
                      gradient: { shadeIntensity: 1, opacityFrom: 0.2, opacityTo: 0.02, stops: [0, 100] },
                    } : { type: "solid", opacity: 1 },
                    plotOptions: { bar: { columnWidth: "55%", borderRadius: 4 } },
                    dataLabels: { enabled: false },
                    grid: { strokeDashArray: 3, borderColor: "#f3f4f6", xaxis: { lines: { show: false } } },
                    xaxis: {
                      categories: executionData.map((d) => d.time),
                      labels: { style: { colors: "#9ca3af", fontSize: "11px" } },
                      axisBorder: { show: false },
                      axisTicks: { show: false },
                    },
                    yaxis: { labels: { style: { colors: "#9ca3af", fontSize: "11px" } } },
                    tooltip: { theme: "light", style: { fontSize: "12px" } },
                    legend: { show: false },
                  }}
                  series={[
                    { name: "Success", data: executionData.map((d) => d.success) },
                    { name: "Failed", data: executionData.map((d) => d.failed) },
                  ]}
                />
              </div>
            </div>

            {/* Latency Chart */}
            <div className="bg-base-100 p-6 rounded-2xl border border-base-300 shadow-sm flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-base font-semibold text-base-content">Average Latency</h3>
                  <p className="text-xs text-base-content/60">Agent response time (s)</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setLatencyChartType((prev) => (prev === "area" ? "bar" : "area"))}
                    className="btn btn-ghost btn-xs btn-circle"
                    title="Toggle bar / area"
                  >
                    <BarChart3 size={16} />
                  </button>
                </div>
              </div>
              <div className="flex-1 min-h-[240px]">
                <Chart
                  type={latencyChartType}
                  height="100%"
                  options={{
                    chart: { type: latencyChartType, toolbar: { show: false }, animations: { enabled: true }, zoom: { enabled: false }, pan: { enabled: false } },
                    colors: ["#ef4444", "#f59e0b", "#3b82f6"],
                    stroke: { curve: "smooth", width: 2 },
                    fill: latencyChartType === "area" ? {
                      type: "gradient",
                      gradient: { shadeIntensity: 1, opacityFrom: 0.2, opacityTo: 0.02, stops: [0, 100] },
                    } : { type: "solid", opacity: 1 },
                    plotOptions: { bar: { columnWidth: "55%", borderRadius: 4 } },
                    dataLabels: { enabled: false },
                    grid: { strokeDashArray: 3, borderColor: "#f3f4f6", xaxis: { lines: { show: false } } },
                    xaxis: {
                      categories: latencyData.map((d) => d.time),
                      labels: { style: { colors: "#9ca3af", fontSize: "11px" } },
                      axisBorder: { show: false },
                      axisTicks: { show: false },
                    },
                    yaxis: { labels: { style: { colors: "#9ca3af", fontSize: "11px" } } },
                    tooltip: { theme: "light", style: { fontSize: "12px" } },
                    legend: { show: false },
                  }}
                  series={[
                    { name: "Worst (s)", data: latencyData.map((d) => d.worst) },
                    { name: "Slow (s)", data: latencyData.map((d) => d.slow) },
                    { name: "Typical (s)", data: latencyData.map((d) => d.typical) },
                  ]}
                />
              </div>
            </div>
          </div>
            </div>
          )}
        </div>

        {/* Batch Subthread Panel - between main content and sidebar */}
        {selectedThreadId && (
          <BatchSubthreadPanel
            thread={thread}
            subThreadIdFromURL={selectedSubThreadId}
            parentThreadId={selectedThreadId}
            selectedBatchMessageId={selectedBatchMessageId}
            onSelectBatch={handleSelectBatch}
            onSelectSubThread={handleSelectSubThread}
          />
        )}
      </div>

      {/* Right Sidebar */}
      <div className="pr-4 h-full shrink-0 z-50 flex relative">
        <Sidebar
          historyData={historyData}
          threadHandler={threadHandler}
          fetchMoreData={fetchMoreData}
          hasMore={hasMore}
          loading={loading}
          params={resolvedParams}
          searchParams={Object.fromEntries(search.entries())}
          setSearchMessageId={setSelectedBatchMessageId}
          setPage={setPage}
          setHasMore={setHasMore}
          filterOption={filterFeedback}
          setFilterOption={setFilterFeedback}
          searchRef={searchRef}
          setThreadPage={() => {}}
          selectedVersion={selectedVersion}
          setIsErrorTrue={setFilterError}
          isErrorTrue={filterError}
          activeFilterByRef={undefined}
          isAnalytics={true}
          handleSearch={handleSearch}
        />
      </div>

      <ChatAiConfigDeatilViewModal
        modalContent={selectedItem?.value === "Latency" ? selectedItem?.latency : selectedItem?.AiConfig}
        modalTitle={selectedItem?.value === "Latency" ? "Latency Details" : "AI Configuration"}
      />
    </div>
  );
}

export default Protected(Page);
