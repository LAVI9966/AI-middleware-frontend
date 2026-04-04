import { useCustomSelector } from "@/customHooks/customSelector";
import { genrateSummaryAction, updateBridgeAction } from "@/store/action/bridgeAction";
import { closeModal } from "@/utils/utility";
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState, useMemo, memo } from "react";
import { useDispatch } from "react-redux";
import Modal from "../UI/Modal";
import { promptObjectToString } from "@/utils/promptUtils";

// Optimized Textarea Component
const OptimizedTextarea = memo(({ value, onChange, className, disabled, placeholder }) => {
  const divRef = useRef(null);
  const contentRef = useRef(null);

  const handleInput = useCallback(
    (e) => {
      const newValue = e.target.value || "";
      onChange({ target: { value: newValue } });
    },
    [onChange]
  );

  const handlePaste = useCallback((e) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  }, []);

  useEffect(() => {
    if (contentRef.current && contentRef.current.value !== value) {
      contentRef.current.value = value;
    }
  }, [value]);

  return (
    <div ref={divRef}>
      <textarea
        data-testid="prompt-summary-textarea"
        id="prompt-summary-textarea"
        ref={contentRef}
        disabled={disabled}
        onInput={handleInput}
        onPaste={handlePaste}
        className={className}
        placeholder={placeholder}
        style={{
          minHeight: "8rem",
          maxWidth: "100%",
          width: "100%",
          whiteSpace: "pre-wrap",
          wordWrap: "break-word",
          wordBreak: "break-all",
          overflowWrap: "break-word",
          overflow: "hidden",
          overflowY: "auto",
          overflowX: "hidden",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
});

OptimizedTextarea.displayName = "OptimizedTextarea";

// Deduplicate publish-modal auto-generate when React re-runs effects (e.g. Strict Mode); single primitive, not a collection.
let lastHandledPublishAutoGenNonce = -1;

// Reusable Agent Summary Content Component
export const AgentSummaryContent = memo(
  ({
    params,
    autoGenerateSummary = false,
    /** Incremented once per publish-modal open when summary is empty; omit for non-publish flows. */
    publishAutoGenNonce = 0,
    setAutoGenerateSummary = () => {},
    autoSave = false,
    showTitle = true,
    showButtons = true,
    showSaveButton = true,
    onSave = () => {},
    isMandatory = false,
    showValidationError = false,
    prompt,
    versionId,
    isEditor = true,
  }) => {
    const dispatch = useDispatch();
    const { bridge_summary } = useCustomSelector((state) => ({
      bridge_summary: state?.bridgeReducer?.allBridgesMap?.[params?.id]?.bridge_summary,
    }));
    const [displayValue, setDisplayValue] = useState(bridge_summary || ""); // Immediate display value
    const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
    const [isSavingSummary, setIsSavingSummary] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const debounceTimerRef = useRef(null);
    const autoGenerateInFlightRef = useRef(false);
    const autoGenerateConsumedRef = useRef(false);
    const generateSummaryHandlerRef = useRef(null);

    useEffect(() => {
      setDisplayValue(bridge_summary || "");
    }, [bridge_summary, params, versionId]);

    const saveSummaryToServer = useCallback(
      (value) => {
        const newValue = value || "";
        const existingValue = bridge_summary || "";
        if (newValue === existingValue) return Promise.resolve(true);

        setIsSavingSummary(true);
        const dataToSend = { bridge_summary: newValue };

        return dispatch(updateBridgeAction({ bridgeId: params.id, dataToSend }))
          .then((data) => {
            if (data?.success) {
              onSave(newValue);
              return true;
            }
            return false;
          })
          .finally(() => {
            setIsSavingSummary(false);
          });
      },
      [dispatch, params.id, bridge_summary, onSave]
    );

    // Ultra-fast textarea change handler with optional autosave
    const handleTextareaChange = useCallback(
      (e) => {
        const value = e.target.value || "";
        setDisplayValue(value);

        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }

        if (autoSave && isEditor) {
          debounceTimerRef.current = setTimeout(() => {
            saveSummaryToServer(value);
          }, 600);
        }
      },
      [autoSave, isEditor, saveSummaryToServer]
    );

    // Cleanup debounce timer
    useEffect(() => {
      return () => {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
      };
    }, []);

    // Auto-generate summary once when flag flips true (publish flow uses publishAutoGenNonce to survive effect re-runs)
    useEffect(() => {
      if (!autoGenerateSummary) {
        autoGenerateConsumedRef.current = false;
        return;
      }

      const useNonce = typeof publishAutoGenNonce === "number" && publishAutoGenNonce > 0;
      if (useNonce) {
        if (lastHandledPublishAutoGenNonce === publishAutoGenNonce) {
          return;
        }
        lastHandledPublishAutoGenNonce = publishAutoGenNonce;
      } else if (autoGenerateConsumedRef.current || autoGenerateInFlightRef.current) {
        return;
      } else {
        autoGenerateConsumedRef.current = true;
      }

      autoGenerateInFlightRef.current = true;

      Promise.resolve(generateSummaryHandlerRef.current?.()).finally(() => {
        autoGenerateInFlightRef.current = false;
      });
    }, [autoGenerateSummary, publishAutoGenNonce]);

    const handleGenerateSummary = useCallback(async () => {
      // Convert prompt to string safely (handles both string and object formats)
      const promptText = typeof prompt === "string" ? prompt : promptObjectToString(prompt);
      if (!promptText || promptText.trim() === "") {
        setErrorMessage("Prompt is required");
        return;
      }
      setIsGeneratingSummary(true);
      try {
        const result = await dispatch(genrateSummaryAction({ versionId: versionId }));
        if (result) {
          setDisplayValue(result); // Update display value immediately
          if (autoSave && isEditor) {
            await saveSummaryToServer(result);
          }
          setAutoGenerateSummary(false); // Reset the flag
        }
      } finally {
        setIsGeneratingSummary(false);
      }
    }, [dispatch, prompt, versionId, autoSave, isEditor, saveSummaryToServer, setAutoGenerateSummary]);

    const handleSaveSummary = useCallback(() => {
      saveSummaryToServer(displayValue);
    }, [saveSummaryToServer, displayValue]);

    // Keep ref in sync before useEffect(auto-generate) runs so the first open never no-ops.
    useLayoutEffect(() => {
      generateSummaryHandlerRef.current = handleGenerateSummary;
    }, [handleGenerateSummary]);

    // Memoized validation values with reduced computation
    const validationProps = useMemo(() => {
      const isEmpty = !displayValue || displayValue.trim() === "";
      return {
        hasValidationError: showValidationError && isEmpty,
        isDisabled: isGeneratingSummary || isSavingSummary || bridge_summary === displayValue,
        textareaClassName: `textarea bg-base-100 textarea-bordered w-full min-h-32 resize-y focus:border-primary caret-base-content p-2 ${
          showValidationError && isEmpty ? "border-red-500 focus:border-red-500" : ""
        }`,
      };
    }, [showValidationError, displayValue, isGeneratingSummary, isSavingSummary, bridge_summary]);

    return (
      <div id="agent-summary-content" data-testid="agent-summary-content" className="space-y-4">
        {(showTitle || showButtons) && (
          <div id="agent-summary-header" className="flex justify-between items-center">
            {showTitle && (
              <h3 className="font-bold text-lg flex items-center gap-2">
                Agent Summary
                {isMandatory && <span className="text-red-500">*</span>}
              </h3>
            )}
            {showButtons && (
              <div className="flex gap-2">
                <button
                  data-testid="agent-summary-generate-button"
                  id="agent-summary-generate-button"
                  className={`btn btn-ghost btn-sm ${isGeneratingSummary ? "opacity-50 cursor-not-allowed" : ""}`}
                  onClick={handleGenerateSummary}
                  disabled={isGeneratingSummary || autoGenerateSummary}
                >
                  <span className="capitalize font-medium bg-gradient-to-r from-blue-800 to-orange-600 text-transparent bg-clip-text">
                    {isGeneratingSummary ? "Generating Summary..." : "Generate New Summary"}
                  </span>
                </button>
              </div>
            )}
          </div>
        )}

        {errorMessage && <span className="text-red-500 text-sm block">{errorMessage}</span>}
        {validationProps.hasValidationError && (
          <span className="text-red-500 text-sm block">Summary is required before publishing</span>
        )}

        <div className="space-y-2">
          <div className="relative">
            <OptimizedTextarea
              value={displayValue}
              onChange={handleTextareaChange}
              className={validationProps.textareaClassName}
              placeholder="Enter agent summary..."
              disabled={isGeneratingSummary}
            />
            {isGeneratingSummary && (
              <div className="absolute inset-0 bg-base-100/70 flex items-center justify-center pointer-events-none">
                <div className="flex items-center gap-2 text-sm text-base-content">
                  <span className="loading loading-spinner loading-sm"></span>
                  Generating summary...
                </div>
              </div>
            )}
          </div>

          {showSaveButton && (
            <div className="flex gap-2">
              <button
                data-testid="agent-summary-save-button"
                id="agent-summary-save-button"
                className="btn btn-primary btn-sm"
                onClick={handleSaveSummary}
                disabled={validationProps.isDisabled || !isEditor}
              >
                Save
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }
);

AgentSummaryContent.displayName = "AgentSummaryContent";

// Original Modal Component
const PromptSummaryModal = ({ modalType, params, autoGenerateSummary = false, setAutoGenerateSummary = () => {} }) => {
  const handleClose = () => {
    closeModal(modalType);
    setAutoGenerateSummary(false);
  };

  return (
    <Modal MODAL_ID={modalType} onClose={handleClose}>
      <div id="prompt-summary-modal-box" data-testid="prompt-summary-modal-box" className="modal-box w-11/12 max-w-5xl">
        <AgentSummaryContent
          params={params}
          autoGenerateSummary={autoGenerateSummary}
          setAutoGenerateSummary={setAutoGenerateSummary}
          showTitle={true}
          onSave={() => closeModal(modalType)}
        />
        <div className="modal-action">
          <button
            id="prompt-summary-close-button"
            data-testid="prompt-summary-close-button"
            className="btn btn-sm"
            onClick={handleClose}
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default PromptSummaryModal;
