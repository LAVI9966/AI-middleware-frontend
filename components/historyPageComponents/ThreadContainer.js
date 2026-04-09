"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useParams, usePathname, useSearchParams, useRouter } from "next/navigation";
import { useDispatch } from "react-redux";

import { CircleDownIcon } from "@/components/Icons";
import ThreadItem from "./ThreadItem";
import InfiniteScroll from "react-infinite-scroll-component";
import { scrollToBottom, scrollToTop } from "./AssistFile";
import { getThread, updateContentHistory } from "@/store/action/historyAction";
import { useCustomSelector } from "@/customHooks/customSelector";
import { closeModal, openModal } from "@/utils/utility";
import { MODAL_TYPE } from "@/utils/enums";
import AddTestCaseModal from "../modals/AddTestCaseModal";
import HistoryPagePromptUpdateModal from "../modals/HistoryPagePromptUpdateModal";
import { ChatLoadingSkeleton } from "./ChatLayoutLoader";
import { clearThreadData } from "@/store/reducer/historyReducer";
import EditMessageModal from "../modals/EditMessageModal";
import { improvePrompt } from "@/config/utilityApi";
import { getBatchConversationLogs } from "@/config/historyApi";

// ------------------------------------
// Constants
// ------------------------------------
const PAGE_SIZE = 40;
const SCROLL_BOTTOM_THRESHOLD = 16; // px

const ThreadContainer = ({
  thread,
  filterOption,
  batchFeed,
  isFetchingMore,
  setIsFetchingMore,
  searchMessageId,
  setSearchMessageId,
  pathName: pathNameProp,
  search,
  historyData,
  threadHandler,
  setLoading,
  threadPage,
  setThreadPage,
  hasMoreThreadData,
  setHasMoreThreadData,
  selectedVersion,
  previousPrompt,
  isErrorTrue,
}) => {
  const routeParams = useParams();
  const orgId = routeParams?.org_id;
  const bridgeId = routeParams?.id;
  const pathname = usePathname();
  const searchParamsHook = useSearchParams();
  const router = useRouter();

  const threadIdFromURL = searchParamsHook.get("thread_id");
  const subThreadIdFromURL = searchParamsHook.get("subThread_id");
  const versionFromURL = searchParamsHook.get("version");
  const errorFromURL = searchParamsHook.get("error");

  const dispatch = useDispatch();
  const integrationData = useCustomSelector((state) => state?.bridgeReducer?.org?.[orgId]?.integrationData) || {};
  const { searchResults, isSearchActive } = useCustomSelector((state) => ({
    searchResults: Array.isArray(state?.historyReducer?.search?.results) ? state.historyReducer.search.results : [],
    isSearchActive: state?.historyReducer?.search?.isActive || false,
  }));

  const historyRef = useRef(null);
  const contentRef = useRef(null);
  const previousScrollHeightRef = useRef(0);
  const threadRefs = useRef({});
  const isMountedRef = useRef(false);

  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [flexDirection, setFlexDirection] = useState("column");
  const [threadMessageState, setThreadMessageState] = useState();
  const [testCaseConversation, setTestCaseConversation] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [promotToUpdate, setPromptToUpdate] = useState(null);
  const [modalInput, setModalInput] = useState(null);
  const [isImprovingPrompt, setIsImprovingPrompt] = useState(false);
  const [generatedPrompts, setGeneratedPrompts] = useState({}); // Store generated prompts by message ID
  const [batchItems, setBatchItems] = useState([]);
  const [batchPage, setBatchPage] = useState(1);
  const [batchHasMore, setBatchHasMore] = useState(true);

  const formatDateAndTime = useCallback((created_at) => {
    const date = new Date(created_at);
    const options = {
      year: "numeric",
      month: "numeric",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    };
    return isNaN(date.getTime()) ? "Invalid Date" : date.toLocaleDateString("en-US", options);
  }, []);

  const handleAddTestCase = useCallback(
    (item, index, variables = false) => {
      const conversation = [];
      let AiConfigForVariable = {};
      AiConfigForVariable = thread[index]?.AiConfig ? thread[index]?.AiConfig : {};
      conversation.push(item || {});
      setTestCaseConversation(conversation);
      if (variables) return AiConfigForVariable;
      openModal(MODAL_TYPE.ADD_TEST_CASE_MODAL);
    },
    [thread]
  );

  const handleSave = useCallback(() => {
    if (!modalInput?.content?.trim()) {
      alert("Message cannot be empty.");
      return;
    }
    dispatch(
      updateContentHistory({
        id: modalInput?.Id,
        bridge_id: bridgeId ?? orgId, // prefer explicit bridgeId, fallback to orgId if needed
        message: modalInput.content,
        index: modalInput.index,
      })
    );
    setModalInput("");
    closeModal(MODAL_TYPE.EDIT_MESSAGE_MODAL);
  }, [modalInput, dispatch, bridgeId, orgId, thread]);

  const handleImprovePrompt = async () => {
    setIsImprovingPrompt(true);
    try {
      const variables = {};
      thread.forEach((item) => {
        if (item.id === modalInput?.Id) {
          const conversation = item?.AiConfig?.input || item?.AiConfig?.messages;
          const filteredConversation = conversation.filter((value) => {
            if (value.role === "developer") {
              variables["prompt"] = value.content;
            }
            return value.role !== "developer";
          });
          filteredConversation.push({
            role: "assistant",
            content: modalInput.originalContent,
          });
          variables["conversation_history"] = filteredConversation;
        }
      });
      variables["updated_response"] = modalInput.content;
      let data;
      try {
        data = await improvePrompt(variables);
      } catch (error) {
        console.error(error);
      }
      if (data) {
        setPromptToUpdate(JSON.parse(data)?.updated_prompt);
        setGeneratedPrompts((prev) => ({
          ...prev,
          [modalInput?.Id]: JSON.parse(data)?.updated_prompt,
        }));
        openModal(MODAL_TYPE?.HISTORY_PAGE_PROMPT_UPDATE_MODAL);
      }
    } finally {
      setIsImprovingPrompt(false);
    }
  };

  const handleClose = useCallback(() => {
    setModalInput("");
    closeModal(MODAL_TYPE.EDIT_MESSAGE_MODAL);
  }, []);

  const handleShowGeneratedPrompt = useCallback(() => {
    if (modalInput?.Id && generatedPrompts[modalInput.Id]) {
      setPromptToUpdate(generatedPrompts[modalInput.Id]);
      closeModal(MODAL_TYPE.EDIT_MESSAGE_MODAL);
      openModal(MODAL_TYPE.HISTORY_PAGE_PROMPT_UPDATE_MODAL);
    }
  }, [modalInput, generatedPrompts]);

  const handleRegenerateFromModal = useCallback(async () => {
    if (!modalInput?.Id) return;
    // Trigger regeneration
    setTimeout(() => {
      handleImprovePrompt();
    }, 100);
  }, [modalInput, handleImprovePrompt]);

  const handlePromptSaved = useCallback(() => {
    if (modalInput?.Id) {
      // Clear the generated prompt for this message when saved
      setGeneratedPrompts((prev) => {
        const updated = { ...prev };
        delete updated[modalInput.Id];
        return updated;
      });
    }
  }, [modalInput]);

  const calcFlexDirection = useCallback(() => {
    if (historyRef.current && contentRef.current) {
      setFlexDirection(contentRef.current.clientHeight < historyRef.current.clientHeight ? "column" : "column-reverse");
    }
  }, []);

  const handleScroll = useCallback(() => {
    const container = historyRef.current;
    if (!container) return;
    const { scrollTop, clientHeight, scrollHeight } = container;

    let nearBottom;

    if (flexDirection === "column-reverse") {
      // In reverse mode, scrollTop = 0 means at bottom, negative values are bounce
      nearBottom = scrollTop <= SCROLL_BOTTOM_THRESHOLD && scrollTop >= -50;
    } else {
      // Normal mode: check distance from bottom
      const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
      nearBottom = distanceFromBottom <= SCROLL_BOTTOM_THRESHOLD;
    }

    setShowScrollToBottom(!nearBottom);
  }, [flexDirection]);

  // ------------------------------------
  // Effects: mount / cleanup
  // ------------------------------------
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    calcFlexDirection();
  }, [thread, batchItems, calcFlexDirection]);

  // Attach scroll listener via onScroll prop in JSX, but ensure first bottom snap
  useEffect(() => {
    if (historyRef.current && threadPage === 1) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [threadPage]);

  // Keep auto-scroll on new messages when already near bottom
  useEffect(() => {
    if (!showScrollToBottom) scrollToBottom(historyRef);
  }, [thread, batchItems, showScrollToBottom]);

  // ------------------------------------
  // Fetch logic (debounced + stale guard)
  // ------------------------------------
  const pathName = pathNameProp || pathname;
  const availableThreads = useMemo(() => {
    if (isSearchActive) {
      return searchResults;
    }
    return Array.isArray(historyData) ? historyData : [];
  }, [isSearchActive, searchResults, historyData]);

  const fetchThread = useCallback(
    async ({ threadId, subThreadId, version, error, page = 1 }) => {
      return dispatch(
        getThread({
          threadId,
          bridgeId: bridgeId ?? orgId,
          nextPage: page,
          user_feedback: filterOption,
          subThreadId,
          versionId: selectedVersion === "all" ? "" : selectedVersion,
          error: error || isErrorTrue,
        })
      );
    },
    [dispatch, bridgeId, orgId, filterOption, selectedVersion, isErrorTrue]
  );

  const fetchBatchPage = useCallback(
    async ({ page = 1, append = false }) => {
      if (!batchFeed?.agent_id) return [];
      const resp = await getBatchConversationLogs({
        agent_id: batchFeed.agent_id,
        filter: batchFeed.filter || "completed",
        page,
        limit: 40,
      });
      const rows = resp?.data || resp?.result || resp || [];
      setBatchItems((prev) => (append ? [...rows, ...prev] : rows));
      setBatchPage(page);
      setBatchHasMore(Array.isArray(rows) ? rows.length >= 40 : false);
      return rows;
    },
    [batchFeed?.agent_id, batchFeed?.filter]
  );

  // Initial load + handle URL thread_id changes
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      dispatch(clearThreadData());
      setLoadingData(true);

      // Batch feed mode: ignore URL thread selection and just stream rows by status
      if (batchFeed?.enabled) {
        try {
          await fetchBatchPage({ page: 1, append: false });
        } finally {
          if (cancelled || !isMountedRef.current) return;
          setLoading(false);
          setLoadingData(false);
        }
        return;
      }

      const thread_id = threadIdFromURL;
      const subThreadId = subThreadIdFromURL || thread_id;
      const error = errorFromURL || isErrorTrue;
      const version = versionFromURL || "";

      // If no thread selected, navigate to the first one from whichever data source is active
      if (!thread_id && Array.isArray(availableThreads) && availableThreads.length > 0) {
        const firstThreadId = availableThreads[0]?.thread_id;
        if (firstThreadId) {
          const params = new URLSearchParams(searchParamsHook.toString());
          params.set("thread_id", firstThreadId);
          params.set("subThread_id", firstThreadId);
          if (version) params.set("version", version);
          if (error) params.set("error", String(error));
          if (search?.type) params.set("type", search.type);
          params.set("navigated", "true");
          router.push(`${pathName}?${params.toString()}`, undefined, { scroll: false });
          setLoadingData(false);
          return;
        }
      }

      if (!thread_id || !availableThreads?.some((h) => h?.thread_id === thread_id)) {
        setLoadingData(false);
        return;
      }

      // small debounce to absorb rapid filter/URL changes
      await new Promise((r) => setTimeout(r, 150));
      const res = await fetchThread({
        threadId: thread_id,
        subThreadId,
        version,
        error,
        page: 1,
      });

      if (cancelled || !isMountedRef.current) return;

      if (res) {
        setThreadMessageState({
          totalPages: res?.totalPages,
          totalEntries: res?.totalEnteries,
        });
        setHasMoreThreadData((res?.data?.length || 0) >= PAGE_SIZE);
      }

      setIsFetchingMore(false);
      setLoading(false);
      setLoadingData(false);
    };

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    threadIdFromURL,
    filterOption,
    availableThreads,
    errorFromURL,
    subThreadIdFromURL,
    batchFeed?.enabled,
    batchFeed?.filter,
    fetchBatchPage,
  ]);

  // Fetch more (pagination)
  const fetchMoreThreadData = useCallback(async () => {
    if (isFetchingMore) return;
    setIsFetchingMore(true);
    previousScrollHeightRef.current = historyRef.current?.scrollHeight || 0;

    if (batchFeed?.enabled) {
      const next = (batchPage || 1) + 1;
      await fetchBatchPage({ page: next, append: true });
      setIsFetchingMore(false);
      return;
    }

    const nextPage = (threadPage || 1) + 1;
    const res = await fetchThread({
      threadId: threadIdFromURL,
      subThreadId: subThreadIdFromURL || threadIdFromURL,
      version: versionFromURL || "",
      error: errorFromURL || isErrorTrue,
      page: nextPage,
    });

    setThreadPage(nextPage);
    const length = res?.data?.length || 0;
    setHasMoreThreadData(length >= PAGE_SIZE);
    if (!res || length < PAGE_SIZE) setSearchMessageId(null);
    setIsFetchingMore(false);
  }, [
    isFetchingMore,
    batchFeed?.enabled,
    batchPage,
    fetchBatchPage,
    threadPage,
    fetchThread,
    threadIdFromURL,
    subThreadIdFromURL,
    versionFromURL,
    errorFromURL,
    isErrorTrue,
    setThreadPage,
    setHasMoreThreadData,
    setSearchMessageId,
    setIsFetchingMore,
  ]);

  // Maintain scroll position when more items prepended in column-reverse mode
  useLayoutEffect(() => {
    // Both batch and normal threads should maintain scroll position correctly when items are prepended
    if (isFetchingMore && historyRef.current && (batchFeed?.enabled ? batchHasMore : hasMoreThreadData)) {
      const diff = (historyRef.current.scrollHeight || 0) - previousScrollHeightRef.current;
      historyRef.current.scrollTop += diff;
    }
    // re-run when thread/batchItems changes because new messages appended
  }, [thread, batchItems, isFetchingMore, hasMoreThreadData, batchHasMore, batchFeed?.enabled]);

  // Show/hide "scroll to bottom" button
  const onScroll = handleScroll; // stable

  // Window message listener (with cleanup)
  useEffect(() => {
    const handleEvent = (event) => {
      if (event?.data?.type !== "FRONT_END_ACTION") return;
      const data = event?.data?.data;
      if (data) {
        setPromptToUpdate(data?.prompt || data);
        openModal(MODAL_TYPE.HISTORY_PAGE_PROMPT_UPDATE_MODAL);
      }
    };
    window.addEventListener("message", handleEvent);
    return () => window.removeEventListener("message", handleEvent);
  }, []);

  // Scroll to searched message
  const scrollToSearchedMessage = useCallback(
    async (messageId) => {
      if (!messageId || !historyRef.current) return;

      const MAX_ATTEMPTS = threadMessageState?.totalPages || 1;
      const DELAY_MS = 100;

      const findMessageAndScroll = async (attempt = 1) => {
        const messageElement = threadRefs.current?.[messageId];
        if (messageElement) {
          messageElement.scrollIntoView({ behavior: "smooth", block: "center" });
          return;
        }
        if (attempt < MAX_ATTEMPTS) {
          scrollToTop(historyRef, messageId);
          await new Promise((r) => setTimeout(r, DELAY_MS));
          await findMessageAndScroll(attempt + 1);
        }
      };

      findMessageAndScroll();
    },
    [threadMessageState?.totalPages]
  );

  useEffect(() => {
    if (searchMessageId) scrollToSearchedMessage(searchMessageId);
  }, [searchMessageId, scrollToSearchedMessage]);

  return (
    <div
      data-testid="thread-container"
      id="thread-container"
      className="drawer-content flex flex-col items-center overflow-hidden justify-center"
    >
      <div className="w-full min-h-screen">
        <div
          data-testid="thread-container-scrollable-div"
          id="scrollableDiv"
          ref={historyRef}
          onScroll={onScroll}
          className="w-full text-start flex flex-col h-screen overflow-y-auto relative"
          style={{
            height: "90vh",
            overflowY: "auto",
            display: "flex",
            flexDirection,
          }}
        >
          {/* Loading skeleton overlay */}
          {loadingData && (
            <div className="absolute inset-0 z-10 bg-base-100/80 backdrop-blur-sm">
              <ChatLoadingSkeleton />
            </div>
          )}

          {!loadingData &&
          ((batchFeed?.enabled && batchItems.length === 0) ||
            (!batchFeed?.enabled && (!thread || thread.length === 0))) ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500 text-lg">No history present</p>
            </div>
          ) : (
            <InfiniteScroll
              dataLength={batchFeed?.enabled ? batchItems.length : thread?.length || 0}
              next={fetchMoreThreadData}
              hasMore={batchFeed?.enabled ? !!batchHasMore : !!hasMoreThreadData}
              loader={<div style={{ display: "none" }} />}
              scrollThreshold="250px"
              inverse={flexDirection === "column-reverse"}
              scrollableTarget="scrollableDiv"
            >
              <div ref={contentRef} className="pb-16 px-3 pt-4" style={{ width: "100%" }}>
                {isFetchingMore && (
                  <div className="w-full flex justify-center py-4">
                    <span className="loading loading-spinner loading-sm" />
                    <span className="ml-2 text-xs text-base-content/60">Loading more…</span>
                  </div>
                )}
                {Array.isArray(batchFeed?.enabled ? batchItems : thread) &&
                  (batchFeed?.enabled ? batchItems : thread).map((item, index) => (
                    <ThreadItem
                      key={item?.message_id || item?.id || item?.Id || `${item?.thread_id || "row"}-${index}`}
                      params={{ org_id: orgId, id: bridgeId }}
                      index={index}
                      item={item}
                      thread={batchFeed?.enabled ? batchItems : thread}
                      threadHandler={threadHandler}
                      formatDateAndTime={formatDateAndTime}
                      integrationData={integrationData}
                      threadRefs={threadRefs}
                      searchMessageId={searchMessageId}
                      setSearchMessageId={setSearchMessageId}
                      handleAddTestCase={handleAddTestCase}
                      setModalInput={setModalInput}
                      modalInput={modalInput}
                    />
                  ))}
              </div>
            </InfiniteScroll>
          )}
        </div>

        {showScrollToBottom && (
          <button
            data-testid="thread-container-scroll-to-bottom"
            id="thread-container-scroll-to-bottom"
            onClick={() => scrollToBottom(historyRef)}
            className="fixed bottom-16 right-4 bg-gray-500 text-white p-2 rounded-full shadow-lg z-[5]"
            aria-label="Scroll to bottom"
          >
            <CircleDownIcon size={24} />
          </button>
        )}
      </div>

      <AddTestCaseModal testCaseConversation={testCaseConversation} setTestCaseConversation={setTestCaseConversation} />

      <HistoryPagePromptUpdateModal
        searchParams={Object.fromEntries(searchParamsHook.entries())}
        promotToUpdate={promotToUpdate}
        previousPrompt={previousPrompt}
        handleRegenerate={modalInput?.Id && generatedPrompts[modalInput?.Id] ? handleRegenerateFromModal : null}
        isRegenerating={isImprovingPrompt}
        onPromptSaved={handlePromptSaved}
      />

      <EditMessageModal
        setModalInput={setModalInput}
        handleClose={handleClose}
        handleSave={handleSave}
        modalInput={modalInput}
        handleImprovePrompt={handleImprovePrompt}
        isImprovingPrompt={isImprovingPrompt}
        hasGeneratedPrompt={modalInput?.Id && generatedPrompts[modalInput?.Id]}
        handleShowGeneratedPrompt={handleShowGeneratedPrompt}
      />
    </div>
  );
};

export default ThreadContainer;
