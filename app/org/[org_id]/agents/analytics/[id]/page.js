"use client";

import React, { use, useCallback, useEffect, useState, useRef, useMemo } from "react";
import { useDispatch } from "react-redux";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { useCustomSelector } from "@/customHooks/customSelector";
import { getThread } from "@/store/action/historyAction";
import { getAgentAnalyticsAction } from "@/store/action/analyticsAction";
import { getAgentAnalyticsFiltersApi } from "@/config";
import { setSelectedVersion } from "@/store/reducer/historyReducer";
import Protected from "@/components/Protected";
import useRtLayerEventHandler from "@/customHooks/useRtLayerEventHandler";

import { Activity, BarChart3, TrendingDown, TrendingUp, X, Bot, Filter, ChevronDown } from "lucide-react";
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

  const { thread, analyticsData, selectedVersion } = useCustomSelector((state) => {
    return {
      thread: state?.historyReducer?.thread || [],
      analyticsData: state?.analyticsReducer?.analyticsData?.[resolvedParams.id] || {},
      selectedVersion: state?.historyReducer?.selectedVersion || "all",
    };
  });

  // Derive sidebar thread list from analytics API response threads
  const historyData = useMemo(() => {
    const threads = analyticsData?.threads || [];
    // Transform analytics thread shape to history thread shape expected by Sidebar
    return threads.map((t) => ({
      ...t,
      thread_id: t.thread_id,
      updated_at: t.updated_at,
      // Sidebar expects sub_thread array; analytics gives flat sub_thread_id
      sub_thread: t.sub_thread_id ? [{ sub_thread_id: t.sub_thread_id }] : [],
    }));
  }, [analyticsData?.threads]);

  // Derive pagination from analytics response
  const hasMore = analyticsData?.pagination?.has_more ?? false;

  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
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
  const [isAdvanceFilterOpen, setIsAdvanceFilterOpen] = useState(false);
  const [showAllTools, setShowAllTools] = useState(false);
  const [showAllModels, setShowAllModels] = useState(false);

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

  // Clear stale thread slider params from URL on mount so no thread looks selected
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.has("thread_id") || p.has("subThread_id") || p.has("message_id") || p.has("batch_id")) {
      p.delete("thread_id");
      p.delete("subThread_id");
      p.delete("message_id");
      p.delete("batch_id");
      router.replace(`${pathName}?${p.toString()}`, undefined, { shallow: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    // Strip UI-only params that are for the thread slider, not analytics filters
    delete queryParams.thread_id;
    delete queryParams.sub_thread_id;
    delete queryParams.batch_id;
    delete queryParams.message_id;
    // Strip empty optional filters so only selected ones go to the API
    if (!queryParams.tool_id) delete queryParams.tool_id;
    if (!queryParams.model) delete queryParams.model;
    if (!queryParams.interval) delete queryParams.interval;
    if (!queryParams.feedback || queryParams.feedback === "all") delete queryParams.feedback;

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

    setPage(1);
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
    dispatch,
  ]);

  // Helper to dispatch analytics with current advanced filter fields
  const dispatchAnalyticsWithAdvancedFilters = () => {
    if (!resolvedParams?.id) return;
    const queryParams = { ...resolvedSearchParams };
    // Strip UI-only params that are for the thread slider, not analytics filters
    delete queryParams.thread_id;
    delete queryParams.sub_thread_id;
    delete queryParams.batch_id;
    delete queryParams.message_id;
    // Strip empty optional filters so only selected ones go to the API
    if (!queryParams.tool_id) delete queryParams.tool_id;
    if (!queryParams.model) delete queryParams.model;
    if (!queryParams.interval) delete queryParams.interval;
    if (!queryParams.feedback || queryParams.feedback === "all") delete queryParams.feedback;

    if (queryParams.start) queryParams.start_date = queryParams.start;
    if (queryParams.end) queryParams.end_date = queryParams.end;
    if (!queryParams.start && !queryParams.end) {
      queryParams.range = queryParams.range || "30d";
    }
    queryParams.version = selectedVersion;

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
    dispatch(getAgentAnalyticsAction(resolvedParams.id, queryParams));
  };

  const buildAnalyticsQueryParams = (extra = {}) => {
    const queryParams = { ...resolvedSearchParams };
    delete queryParams.thread_id;
    delete queryParams.sub_thread_id;
    delete queryParams.batch_id;
    delete queryParams.message_id;
    if (!queryParams.tool_id) delete queryParams.tool_id;
    if (!queryParams.model) delete queryParams.model;
    if (!queryParams.interval) delete queryParams.interval;
    if (!queryParams.feedback || queryParams.feedback === "all") delete queryParams.feedback;

    if (queryParams.start) queryParams.start_date = queryParams.start;
    if (queryParams.end) queryParams.end_date = queryParams.end;
    if (!queryParams.start && !queryParams.end) {
      queryParams.range = queryParams.range || "30d";
    }
    queryParams.version = selectedVersion;

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

    return { ...queryParams, ...extra };
  };

  const fetchMoreData = async () => {
    if (!hasMore || loading) return;
    const nextPage = page + 1;
    const queryParams = buildAnalyticsQueryParams({ page: nextPage });
    await dispatch(getAgentAnalyticsAction(resolvedParams.id, queryParams));
    setPage(nextPage);
  };

  const handleSearch = async (query) => {
    setSearchQuery(query);
    setPage(1);
    setLoading(true);
    const queryParams = buildAnalyticsQueryParams({ keyword: query, page: 1 });
    await dispatch(getAgentAnalyticsAction(resolvedParams.id, queryParams));
    setLoading(false);
  };

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

      setSelectedThreadId(thread_id);
      setSelectedSubThreadId(firstSubThreadId);
      setIsSliderOpen(true);
      dispatch(
        getThread({
          threadId: thread_id,
          bridgeId: resolvedParams.id,
          nextPage: 1,
          user_feedback: "all",
          subThreadId: firstSubThreadId,
          versionId: "",
          error: false,
        })
      );

      router.push(`${pathName}?${paramsObj.toString()}`, undefined, { shallow: true });
    },
    [pathName, router, search, resolvedParams.id, dispatch]
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
          <div className="p-6">
          {/* Dashboard Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-base-content">Agent Analytics</h1>
              <p className="text-sm text-base-content/60 mt-1">Overview of agent performance and execution history.</p>
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

          {/* Filters Container */}
          <div className="bg-base-100 border border-base-300 rounded-lg  mb-8 shadow-sm">
            {/* Row 1: Time Range, Interval, Feedback, Error, Advance Toggle */}
            <div className="flex items-center gap-4 px-4 py-2.5 flex-wrap">
              {/* Time Range */}
              <span className="text-[11px] font-bold tracking-widest text-base-content/40 uppercase shrink-0">
                Time Range
              </span>
              <div className="flex gap-1.5 shrink-0 ">
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

              <div className="w-px h-4 bg-base-300 shrink-0"></div>

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

              <div className="w-px h-4 bg-base-300 shrink-0"></div>

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

              <div className="w-px h-4 bg-base-300 shrink-0"></div>

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

              <div className="w-px h-4 bg-base-300 shrink-0"></div>

              {/* Advance Filter Toggle */}
              <button
                type="button"
                onClick={() => setIsAdvanceFilterOpen(!isAdvanceFilterOpen)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 border ${
                  isAdvanceFilterOpen
                    ? "bg-primary/10 text-primary border-primary/30 dark:bg-primary/20 dark:border-primary/40"
                    : "bg-base-100 text-base-content/70 border-base-300 hover:bg-primary/5 hover:text-primary hover:border-primary/40 dark:bg-base-100 dark:hover:bg-primary/10 dark:hover:text-primary"
                }`}
              >
                <Filter className="w-4 h-4" />
                Search by Fields
                <ChevronDown className={`w-4 h-4 transition-transform ${isAdvanceFilterOpen ? "rotate-180" : ""}`} />
              </button>
            </div>

            {/* Row 2: Advance Filters (expandable inside same container) */}
            <div
              className={`overflow-hidden px-4 transition-all duration-300 ${
                isAdvanceFilterOpen
                  ? "max-h-[600px] opacity-100 mt-3 pt-3 pb-3 rounded-lg border-base-300 bg-base-200/50 space-y-4"
                  : "max-h-0 opacity-0"
              }`}
            >
              {/* Tool & Model badges */}
              <div className="grid grid-cols-2 gap-4 px-4 ">
                  {/* Tool Column */}
                  <div>
                    <span className="text-[11px] font-bold tracking-widest text-base-content/40 uppercase block mb-1.5">Tool</span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        onClick={() => {
                          const val = "";
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
                      {(showAllTools
                        ? Object.entries(filterOptions.tools_data)
                        : Object.entries(filterOptions.tools_data).slice(0, 4)
                      ).map(([name, id]) => (
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
                      {Object.entries(filterOptions.tools_data).length > 4 && (
                        <button
                          onClick={() => setShowAllTools(!showAllTools)}
                          className="px-3 py-1 rounded-full text-xs font-medium transition-colors bg-base-200 text-base-content/70 hover:bg-base-300"
                        >
                          {showAllTools ? "Less" : `+${Object.entries(filterOptions.tools_data).length - 4} More`}
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Model Column */}
                  <div>
                    <span className="text-[11px] font-bold tracking-widest text-base-content/40 uppercase block mb-1.5">Model</span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        onClick={() => {
                          const val = "";
                          setFilterModel(val);
                          applyFilters({ model: val });
                        }}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                          filterModel === ""
                            ? "bg-blue-500 text-white"
                            : "bg-base-200 text-base-content/70 hover:bg-base-300"
                        }`}
                      >
                        All
                      </button>
                      {(showAllModels
                        ? Object.entries(filterOptions.unique_model).flatMap(([service, models]) =>
                            models.map((m) => ({ service, model: m }))
                          )
                        : Object.entries(filterOptions.unique_model).flatMap(([service, models]) =>
                            models.map((m) => ({ service, model: m }))
                          ).slice(0, 4)
                      ).map(({ service, model: m }) => (
                        <button
                          key={`${service}-${m}`}
                          onClick={() => {
                            const val = filterModel === m ? "" : m;
                            setFilterModel(val);
                            applyFilters({ model: val });
                          }}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                            filterModel === m
                              ? "bg-blue-500 text-white"
                              : "bg-base-200 text-base-content/70 hover:bg-base-300"
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                      {Object.entries(filterOptions.unique_model).flatMap(([service, models]) => models.map((m) => m)).length > 4 && (
                        <button
                          onClick={() => setShowAllModels(!showAllModels)}
                          className="px-3 py-1 rounded-full text-xs font-medium transition-colors bg-base-200 text-base-content/70 hover:bg-base-300"
                        >
                          {showAllModels ? "Less" : `+${Object.entries(filterOptions.unique_model).flatMap(([service, models]) => models.map((m) => m)).length - 4} More`}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Search by Fields */}
                <div className="px-4">
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
                          className="input input-sm input-bordered w-full rounded-lg text-xs"
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
                          className="input input-sm rounded-lg input-bordered flex-1 text-xs"
                          placeholder="key"
                          value={filterVariableKey}
                          onChange={(e) => setFilterVariableKey(e.target.value)}
                        />
                        <input
                          type="text"
                          className="input input-sm rounded-lg input-bordered flex-1 text-xs"
                          placeholder="value"
                          value={filterVariableValue}
                          onChange={(e) => setFilterVariableValue(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 mt-3">
                    <button
                      className="px-5 py-1 rounded-lg text-sm font-medium border-2 border-base-300 text-base-content/60 hover:border-base-400 hover:text-base-content transition-colors"
                      onClick={() => {
                        setFilterByFields({ thread_id: "", sub_thread_id: "", message_id: "", batch_id: "", user: "", llm_message: "" });
                        setFilterVariableKey("");
                        setFilterVariableValue("");
                        dispatchAnalyticsWithAdvancedFilters();
                      }}
                    >
                      Reset Fields
                    </button>
                    <button
                      className="px-5 py-1   rounded-lg text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 transition-colors shadow-lg"
                      onClick={() => {
                        if (document.activeElement) document.activeElement.blur();
                        dispatchAnalyticsWithAdvancedFilters();
                      }}
                    >
                      Apply Filter
                    </button>
                  </div>
                </div>
              </div>
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
      </div>

        {/* Backdrop overlay when slider is open */}
        {selectedThreadId && (
          <div
            className="absolute inset-0 bg-black/20 backdrop-blur-[1px] z-30 transition-opacity duration-300"
            onClick={handleCloseAside}
          />
        )}

        {/* Slide-in Thread Detail Panel - right to left */}
        <div
          className={`absolute top-0 right-0 h-full bg-base-100 shadow-2xl border-l border-base-300 z-40 flex flex-col transform transition-transform duration-300 ease-in-out ${
            selectedThreadId ? "translate-x-0 w-[85%]" : "translate-x-full w-[85%]"
          }`}
        >
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
          setHasMore={() => {}}
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
