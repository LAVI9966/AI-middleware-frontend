"use client";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { CloseIcon, FileTextIcon } from "@/components/Icons";
import { toggleSidebar } from "@/utils/utility";
import { getBridgeConfigHistory } from "@/config/index";
import { CONFIG_HISTORY_FILTER_KEYS, CONFIG_HISTORY_FEATURE_OPTIONS, CONFIG_HISTORY_HIDDEN_TYPES } from "@/utils/enums";
import { splitDraftAndHistory, groupByDate, buildRevertPayload } from "@/utils/configHistoryUtils";
import { HistoryRow } from "./ConfigHistoryItem";
import { useCustomSelector } from "@/customHooks/customSelector";
import { useDispatch } from "react-redux";
import { updateBridgeVersionAction } from "@/store/action/bridgeAction";
import { toast } from "react-toastify";
import InfiniteScroll from "react-infinite-scroll-component";

const PAGE_SIZE = 25;
const SLIDER_ID = "default-config-history-slider";

function ConfigHistorySlider({ versionId }) {
  const dispatch = useDispatch();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState(new Set());
  const [revertingId, setRevertingId] = useState(null);
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState({
    [CONFIG_HISTORY_FILTER_KEYS.USER_IDS]: [],
    [CONFIG_HISTORY_FILTER_KEYS.TYPES]: [],
  });

  const labels = useMemo(
    () => Object.fromEntries(CONFIG_HISTORY_FEATURE_OPTIONS.map((o) => [o.value, o.label])),
    []
  );

  const bridgeId = useCustomSelector((state) => {
    for (const [id, versions] of Object.entries(state?.bridgeReducer?.bridgeVersionMapping || {})) {
      if (versionId && versions?.[versionId]) return id;
    }
    return null;
  });

  const currentVersion = useCustomSelector((state) =>
    bridgeId && versionId ? state?.bridgeReducer?.bridgeVersionMapping?.[bridgeId]?.[versionId] : null
  );

  const fetchHistory = useCallback(
    async (p = 1, f = filters) => {
      const el = document.getElementById(SLIDER_ID);
      if (!versionId || !el || el.classList.contains("translate-x-full")) return;

      setLoading(true);
      try {
        const res = await getBridgeConfigHistory(versionId, p, PAGE_SIZE, f);
        if (res?.userData?.users?.length) setUsers(res.userData.users);

        if (!res?.success) {
          if (p === 1) setHistory([]);
          setHasMore(false);
          return;
        }

        const rows = res?.userData?.updates ?? [];
        setHistory((prev) => (p === 1 ? rows : [...prev, ...rows]));
        setHasMore(rows.length === PAGE_SIZE);
      } catch (e) {
        console.error("History fetch failed:", e);
      } finally {
        setLoading(false);
      }
    },
    [versionId]
  );

  const reset = useCallback(() => {
    setFilters({ [CONFIG_HISTORY_FILTER_KEYS.USER_IDS]: [], [CONFIG_HISTORY_FILTER_KEYS.TYPES]: [] });
    setExpanded(new Set());
  }, []);

  useEffect(() => {
    const el = document.getElementById(SLIDER_ID);
    if (!el) return;

    const obs = new MutationObserver(() => {
      const open = !el.classList.contains("translate-x-full");
      if (open && versionId) {
        setPage(1);
        setHistory([]);
        setExpanded(new Set());
        fetchHistory(1);
      } else if (!open) reset();
    });

    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, [versionId, fetchHistory, reset]);

  useEffect(() => {
    if (page > 1) fetchHistory(page, filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => {
    setPage(1);
    setHistory([]);
    setExpanded(new Set());
    fetchHistory(1, filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const visible = useMemo(
    () => history.filter((i) => !(CONFIG_HISTORY_HIDDEN_TYPES || []).includes(i?.type)),
    [history]
  );
  const { draftItems, historyItems } = useMemo(() => splitDraftAndHistory(visible), [visible]);
  const grouped = useMemo(() => groupByDate(historyItems), [historyItems]);

  const toggle = (id) =>
    setExpanded((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const handleRevert = async (item) => {
    const payload = buildRevertPayload(item, currentVersion);
    if (!payload) return toast.error("Nothing to revert");

    setRevertingId(item.id);
    try {
      const result = await dispatch(updateBridgeVersionAction({ versionId, bridgeId, dataToSend: payload }));
      if (result?.success) {
        toast.success("Change reverted");
        setPage(1);
        setHistory([]);
        fetchHistory(1, filters);
      } else {
        toast.error(result?.error || "Revert failed");
      }
    } catch {
      toast.error("Revert failed");
    } finally {
      setRevertingId(null);
    }
  };

  const setFilter = (key, val) => setFilters((f) => ({ ...f, [key]: val ? [val] : [] }));

  return (
    <aside
      id={SLIDER_ID}
      data-testid="config-history-sidebar"
      className="sidebar-container fixed z-very-high flex flex-col top-0 right-0 p-4 w-full md:w-[28rem] h-screen bg-base-200 border-l border-base-300 translate-x-full"
    >
      <div className="flex flex-col gap-4 h-full min-h-0">
        <div className="flex justify-between items-center border-b border-base-300 pb-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileTextIcon className="w-4 h-4 text-primary" />
            </div>
            <p className="text-base font-semibold">Updates History</p>
          </div>
          <button onClick={() => { toggleSidebar(SLIDER_ID, "right"); reset(); }} className="p-1.5 rounded-lg hover:bg-base-300">
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-base-100 rounded-lg p-4 border border-base-300 shrink-0 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium mb-1 block">Filter by User</label>
              <select
                className="select select-sm select-bordered w-full"
                value={filters[CONFIG_HISTORY_FILTER_KEYS.USER_IDS][0] || ""}
                onChange={(e) => setFilter(CONFIG_HISTORY_FILTER_KEYS.USER_IDS, e.target.value)}
              >
                <option value="">All Users</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Filter by Feature</label>
              <select
                className="select select-sm select-bordered w-full"
                value={filters[CONFIG_HISTORY_FILTER_KEYS.TYPES][0] || ""}
                onChange={(e) => setFilter(CONFIG_HISTORY_FILTER_KEYS.TYPES, e.target.value)}
              >
                <option value="">All Features</option>
                {CONFIG_HISTORY_FEATURE_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
          </div>
          <button onClick={reset} className="w-full py-1.5 text-xs bg-base-300 rounded hover:bg-base-200">Clear</button>
        </div>

        <p className="text-[11px] text-base-content/45 shrink-0">Tap any change to see what was edited or to revert it.</p>

        <div id="config-history-scroll" className="flex-1 overflow-y-auto min-h-0">
          {loading && page === 1 ? (
            <div className="flex justify-center h-40 items-center">
              <span className="loading loading-spinner loading-md" />
            </div>
          ) : (
            <InfiniteScroll
              dataLength={history.length}
              next={() => setPage((p) => p + 1)}
              hasMore={hasMore}
              loader={<div className="flex justify-center py-4"><span className="loading loading-spinner loading-md" /></div>}
              endMessage={history.length > 0 && <p className="text-center text-xs text-base-content/30 py-5">— All caught up —</p>}
              scrollableTarget="config-history-scroll"
            >
              <div className="space-y-4 pb-2">
                {draftItems.length > 0 && (
                  <div className="rounded-xl border border-warning/35 bg-warning/5 p-3 space-y-2">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-semibold flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-warning" /> Draft
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-warning/20 text-warning border border-warning/30">
                        {draftItems.length} unpublished
                      </span>
                    </div>
                    {draftItems.map((item, i) => {
                      const id = item.id ?? `d-${i}`;
                      return (
                        <HistoryRow
                          key={id}
                          item={item}
                          labels={labels}
                          expanded={expanded.has(id)}
                          onToggle={() => toggle(id)}
                          showRevert
                          onRevert={handleRevert}
                          isReverting={revertingId === item.id}
                          isDraft
                        />
                      );
                    })}
                  </div>
                )}

                {grouped.map(({ label, items }) => (
                  <div key={label}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[11px] font-semibold text-base-content/50 tracking-wider">{label}</span>
                      <div className="flex-1 h-px bg-base-300" />
                    </div>
                    <div className="space-y-2">
                      {items.map((item, i) => {
                        const id = item.id ?? `${label}-${i}`;
                        return (
                          <HistoryRow
                            key={id}
                            item={item}
                            labels={labels}
                            expanded={expanded.has(id)}
                            onToggle={() => toggle(id)}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}

                {!draftItems.length && !grouped.length && (
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
