"use client";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { CloseIcon, FileTextIcon } from "@/components/Icons";
import { toggleSidebar } from "@/utils/utility";
import { getBridgeConfigHistory } from "@/config/index";
import { CONFIG_HISTORY_FILTER_KEYS, CONFIG_HISTORY_FEATURE_OPTIONS, CONFIG_HISTORY_HIDDEN_TYPES } from "@/utils/enums";
import { splitDraftAndHistory, groupHistoryByDate } from "@/utils/configHistoryUtils";
import { buildRevertPayloadFromHistoryItem } from "@/utils/configurationParamUtils";
import { ConfigHistoryCard, ConfigHistoryDraftRow, HistoryDiffPanel } from "./ConfigHistoryItem";
import { useCustomSelector } from "@/customHooks/customSelector";
import { useDispatch } from "react-redux";
import { updateBridgeVersionAction } from "@/store/action/bridgeAction";
import { toast } from "react-toastify";
import InfiniteScroll from "react-infinite-scroll-component";

function ConfigHistorySlider({ versionId }) {
  const dispatch = useDispatch();
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [revertingId, setRevertingId] = useState(null);
  const [filters, setFilters] = useState({
    [CONFIG_HISTORY_FILTER_KEYS.USER_IDS]: [],
    [CONFIG_HISTORY_FILTER_KEYS.TYPES]: [],
  });
  const [availableUsers, setAvailableUsers] = useState([]);
  const pageSize = 25;

  const bridgeId = useCustomSelector((state) => {
    const mapping = state?.bridgeReducer?.bridgeVersionMapping || {};
    for (const [parentId, versions] of Object.entries(mapping)) {
      if (versions && versionId && versions[versionId]) {
        return parentId;
      }
    }
    return null;
  });

  const currentVersion = useCustomSelector((state) => {
    if (!bridgeId || !versionId) return null;
    return state?.bridgeReducer?.bridgeVersionMapping?.[bridgeId]?.[versionId] || null;
  });

  const resetFilters = useCallback(() => {
    setFilters({
      [CONFIG_HISTORY_FILTER_KEYS.USER_IDS]: [],
      [CONFIG_HISTORY_FILTER_KEYS.TYPES]: [],
    });
    setExpandedIds(new Set());
  }, []);

  const featureLabelMap = useMemo(
    () =>
      CONFIG_HISTORY_FEATURE_OPTIONS.reduce((acc, option) => {
        acc[option.value] = option.label;
        return acc;
      }, {}),
    []
  );

  const fetchHistory = useCallback(
    async (targetPage = page, currentFilters = filters) => {
      const sliderElement = document.getElementById("default-config-history-slider");
      const isSliderOpen = sliderElement && !sliderElement.classList.contains("translate-x-full");

      if (!versionId || !isSliderOpen) return;

      setLoading(true);
      try {
        const response = await getBridgeConfigHistory(versionId, targetPage, pageSize, currentFilters);
        const usersFromResponse = response?.userData?.users;

        if (Array.isArray(usersFromResponse) && usersFromResponse.length > 0) {
          setAvailableUsers(usersFromResponse);
        }

        if (!response?.success) {
          if (targetPage === 1) {
            setHistoryData([]);
          }
          setHasMore(false);
          return;
        }

        const newData = response?.userData?.updates ?? [];
        setHistoryData((prev) => (targetPage === 1 ? newData : [...prev, ...newData]));
        setHasMore(newData.length === pageSize);
      } catch (error) {
        console.error("Error fetching agent history:", error);
      } finally {
        setLoading(false);
      }
    },
    [versionId, pageSize]
  );

  useEffect(() => {
    const sliderElement = document.getElementById("default-config-history-slider");
    if (!sliderElement) return;

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "attributes" && mutation.attributeName === "class") {
          const isOpen = !sliderElement.classList.contains("translate-x-full");
          if (isOpen && versionId) {
            setPage(1);
            setHistoryData([]);
            setExpandedIds(new Set());
            fetchHistory(1);
          } else if (!isOpen) {
            resetFilters();
          }
        }
      });
    });

    observer.observe(sliderElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, [versionId, fetchHistory, resetFilters]);

  useEffect(() => {
    if (page > 1) {
      fetchHistory(page, filters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => {
    setPage(1);
    setHistoryData([]);
    setExpandedIds(new Set());
    fetchHistory(1, filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const visibleHistory = useMemo(
    () => historyData.filter((item) => !(CONFIG_HISTORY_HIDDEN_TYPES || []).includes(item?.type)),
    [historyData]
  );

  const { draftItems, historyItems } = useMemo(() => splitDraftAndHistory(visibleHistory), [visibleHistory]);
  const groupedHistory = useMemo(() => groupHistoryByDate(historyItems), [historyItems]);

  const toggleExpanded = useCallback((id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleRevert = useCallback(
    async (item) => {
      if (!versionId || !item?.id) return;

      const payload = buildRevertPayloadFromHistoryItem(item, currentVersion);
      if (!payload) {
        toast.error("Nothing to revert for this change");
        return;
      }

      setRevertingId(item.id);
      try {
        const result = await dispatch(
          updateBridgeVersionAction({
            versionId,
            bridgeId,
            dataToSend: payload,
          })
        );

        if (result?.success) {
          toast.success("Change reverted");
          setPage(1);
          setHistoryData([]);
          fetchHistory(1, filters);
        } else {
          toast.error(result?.error || "Failed to revert change");
        }
      } catch (error) {
        console.error("Revert history change failed:", error);
        toast.error("Failed to revert change");
      } finally {
        setRevertingId(null);
      }
    },
    [dispatch, versionId, bridgeId, currentVersion, fetchHistory, filters]
  );

  const handleCloseConfigHistorySlider = useCallback(() => {
    toggleSidebar("default-config-history-slider", "right");
    resetFilters();
  }, [resetFilters]);

  const loadMore = () => {
    setPage((prev) => prev + 1);
  };

  const handleDropdownFilterChange = (filterType, value) => {
    setFilters((prev) => ({
      ...prev,
      [filterType]: value ? [value] : [],
    }));
  };

  const renderDraftSection = () => {
    if (draftItems.length === 0) return null;

    return (
      <div className="rounded-xl border border-warning/35 bg-warning/5 p-3 mb-4">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-warning shrink-0" />
            <span className="text-sm font-semibold text-base-content">Draft</span>
          </div>
          <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-warning/20 text-warning border border-warning/30">
            {draftItems.length} unpublished
          </span>
        </div>

        <div className="space-y-2">
          {draftItems.map((item, index) => {
            const itemId = item?.id ?? `draft-${index}`;
            const isExpanded = expandedIds.has(itemId);

            return (
              <div key={itemId}>
                <ConfigHistoryDraftRow
                  item={item}
                  featureLabelMap={featureLabelMap}
                  isExpanded={isExpanded}
                  onToggle={() => toggleExpanded(itemId)}
                />
                {isExpanded && (
                  <div className="mt-2 rounded-lg border border-base-300 bg-base-100 p-3">
                    <HistoryDiffPanel
                      item={item}
                      showRevert
                      onRevert={handleRevert}
                      isReverting={revertingId === item.id}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <aside
      id="default-config-history-slider"
      data-testid="config-history-sidebar"
      className="sidebar-container fixed z-very-high flex flex-col top-0 right-0 p-4 w-full md:w-[28rem] lg:w-[30rem] opacity-100 h-screen bg-base-200 transition-all duration-300 border-l border-base-300 overflow-hidden translate-x-full"
      aria-label="Config History Slider"
    >
      <div className="flex flex-col w-full gap-4 h-full min-h-0">
        <div className="flex justify-between items-center border-b border-base-300 pb-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <FileTextIcon className="w-4 h-4 text-primary" />
            </div>
            <p className="text-base font-semibold text-base-content leading-tight">Updates History</p>
          </div>
          <button
            id="config-history-slider-close-icon"
            onClick={handleCloseConfigHistorySlider}
            className="p-1.5 rounded-lg text-base-content/40 hover:text-base-content hover:bg-base-300 transition-all"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-base-100 rounded-lg p-4 border border-base-300 shrink-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium mb-1">Filter by User</label>
              <select
                className="select select-sm select-bordered w-full"
                value={filters[CONFIG_HISTORY_FILTER_KEYS.USER_IDS][0] || ""}
                onChange={(e) => handleDropdownFilterChange(CONFIG_HISTORY_FILTER_KEYS.USER_IDS, e.target.value)}
              >
                <option value="">All Users</option>
                {availableUsers?.map((user) => (
                  <option key={user?.id} value={user?.id}>
                    {user?.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">Filter by Feature</label>
              <select
                className="select select-sm select-bordered w-full"
                value={filters[CONFIG_HISTORY_FILTER_KEYS.TYPES][0] || ""}
                onChange={(e) => handleDropdownFilterChange(CONFIG_HISTORY_FILTER_KEYS.TYPES, e.target.value)}
              >
                <option value="">All Features</option>
                {CONFIG_HISTORY_FEATURE_OPTIONS.map((feature) => (
                  <option key={feature.value} value={feature.value}>
                    {feature.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={resetFilters}
            className="w-full px-3 py-1.5 text-xs bg-base-300 text-base-content rounded hover:bg-base-200 transition-colors"
          >
            Clear
          </button>
        </div>

        <p className="text-[11px] text-base-content/45 px-1 -mt-1 shrink-0">
          Tap any change to see what was edited or to revert it.
        </p>

        <div id="config-history-scroll-container" className="flex-1 overflow-y-auto min-h-0">
          {loading && page === 1 ? (
            <div className="flex justify-center items-center h-40">
              <div className="loading loading-spinner loading-md"></div>
            </div>
          ) : (
            <InfiniteScroll
              dataLength={historyData.length}
              next={loadMore}
              hasMore={hasMore}
              loader={
                <div className="flex justify-center py-4">
                  <div className="loading loading-spinner loading-md"></div>
                </div>
              }
              endMessage={
                historyData.length > 0 && (
                  <p className="text-center text-xs text-base-content/30 py-5">— All caught up —</p>
                )
              }
              scrollableTarget="config-history-scroll-container"
            >
              <div className="space-y-4 text-base-content pb-2">
                {renderDraftSection()}

                {groupedHistory.length > 0
                  ? groupedHistory.map(({ label, items }) => (
                      <div key={label}>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-[11px] font-semibold text-base-content/50 tracking-wider whitespace-nowrap">
                            {label}
                          </span>
                          <div className="flex-1 h-px bg-base-300" />
                        </div>

                        <div className="space-y-2.5">
                          {items.map((item, index) => {
                            const itemId = item?.id ?? `${label}-${index}`;
                            return (
                              <ConfigHistoryCard
                                key={itemId}
                                item={item}
                                featureLabelMap={featureLabelMap}
                                isExpanded={expandedIds.has(itemId)}
                                onToggle={() => toggleExpanded(itemId)}
                                showRevert={false}
                              />
                            );
                          })}
                        </div>
                      </div>
                    ))
                  : !draftItems.length && (
                      <div className="text-center py-12 text-base-content/30">
                        <FileTextIcon className="w-10 h-10 mx-auto mb-3 opacity-20" />
                        <p className="text-sm">No history found</p>
                      </div>
                    )}
              </div>
            </InfiniteScroll>
          )}
        </div>
      </div>
    </aside>
  );
}

export default ConfigHistorySlider;
