import { MODAL_TYPE } from "@/utils/enums";
import { closeModal } from "@/utils/utility";
import { CloseIcon, CopyIcon } from "@/components/Icons";
import React, { useMemo, useState } from "react";
import Modal from "../UI/Modal";
import CodeBlock from "@/components/codeBlock/CodeBlock";
import { SlidersHorizontal } from "lucide-react";

// ---------------------------------------------------------------------------
// Helpers (used by the generic fallback modal path)
// ---------------------------------------------------------------------------

const flattenMessage = (message) => {
  if (typeof message !== "object" || message === null) {
    return { message };
  }
  const result = {};
  const flatten = (obj, parentKey = "") => {
    Object.keys(obj).forEach((key) => {
      const newKey = parentKey ? `${parentKey}.${key}` : key;
      if (typeof obj[key] === "object" && obj[key] !== null) {
        flatten(obj[key], newKey);
      } else {
        result[newKey] = obj[key];
      }
    });
  };
  flatten(message);
  return result;
};

const formatValue = (value) => {
  if (typeof value === "string" && value.startsWith("**") && value.includes("\n")) {
    return value.split("\n").map((line, index) => (
      <p key={index} className={line.startsWith("**") ? "font-bold" : ""}>
        {line}
      </p>
    ));
  }
  return String(value);
};

const renderFlattenedMessage = (message) => {
  const flattened = flattenMessage(message);
  return Object.entries(flattened).map(([key, value]) => (
    <div key={key} className="mb-2 last:mb-0">
      <span className="font-medium">{key}:</span> {formatValue(value)}
    </div>
  ));
};

// ---------------------------------------------------------------------------
// JsonSection — one collapsible code block
// ---------------------------------------------------------------------------

function JsonSection({ label, data, count }) {
  const jsonString = useMemo(() => JSON.stringify(data, null, 2), [data]);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="overflow-hidden rounded-lg border border-base-content/10">
      <div
        className="flex items-center justify-between gap-2 border-b border-base-content/10 px-3 py-2"
        style={{ background: "var(--ai-config-section-header)" }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-base-content">{label}</span>
          {count != null && (
            <span className="rounded-full bg-trace-gold/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {count}
            </span>
          )}
        </div>
        <button
          type="button"
          data-testid="ai-config-section-copy-button"
          onClick={handleCopy}
          className="btn btn-ghost btn-xs text-[10px] px-2 py-0.5 h-auto min-h-0 font-medium text-base-content/75 hover:bg-base-content/10 flex items-center gap-1"
        >
          <CopyIcon size={11} />
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <div className="max-h-64 overflow-auto" style={{ background: "var(--ai-config-section-bg)" }}>
        <CodeBlock plain className="language-json">
          {jsonString}
        </CodeBlock>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// AiConfigPanel — fully dynamic: scalars → Parameters, arrays/objects → own section
// ---------------------------------------------------------------------------

// Keys that should always get their own section regardless of type
const SECTION_KEYS = new Set(["input", "messages", "tools", "functions"]);

function AiConfigPanel({ config }) {
  if (!config || typeof config !== "object") return null;

  const sections = [];
  const parameters = {};

  Object.entries(config).forEach(([key, value]) => {
    if (SECTION_KEYS.has(key) || Array.isArray(value) || (typeof value === "object" && value !== null)) {
      const label = key.replace(/_/g, " ");
      const count = Array.isArray(value) ? value.length : null;
      sections.push({ key, label, data: value, count });
    } else {
      parameters[key] = value;
    }
  });

  return (
    <div className="flex flex-col gap-4">
      {Object.keys(parameters).length > 0 && <JsonSection label="Parameters" data={parameters} />}
      {sections.map(({ key, label, data, count }) => (
        <JsonSection key={key} label={label} data={data} count={count} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main modal component
// ---------------------------------------------------------------------------

const ChatAiConfigDeatilViewModal = ({ modalContent, modalTitle }) => {
  const [copied, setCopied] = useState(false);

  const isLatencyView = modalTitle === "Latency Details" || modalTitle === "Latency";

  const isAiConfigView =
    modalTitle === "AI Configuration" ||
    (modalContent &&
      typeof modalContent === "object" &&
      !Array.isArray(modalContent) &&
      (modalContent.input || modalContent.messages || modalContent.tools || modalContent.functions));

  const isPrimitiveContent =
    typeof modalContent === "string" || typeof modalContent === "number" || typeof modalContent === "boolean";

  const copyData = typeof modalContent === "string" ? modalContent : JSON.stringify(modalContent, null, 2);

  const contentEntries = isPrimitiveContent ? [["Prompt", modalContent]] : Object.entries(modalContent || {});

  const handleCopy = (data) => {
    navigator.clipboard.writeText(data || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Latency view ────────────────────────────────────────────────────────
  if (isLatencyView) {
    return (
      <Modal
        MODAL_ID={MODAL_TYPE.CHAT_DETAILS_VIEW_MODAL}
        onClose={() => closeModal(MODAL_TYPE.CHAT_DETAILS_VIEW_MODAL)}
      >
        <div className="fixed inset-0 z-low-medium flex min-h-[100vh] min-w-[100vw] items-center justify-center overflow-auto bg-black/60 py-8">
          <div
            id="chat-details-modal-container"
            data-testid="latency-details-modal"
            className="relative flex w-[min(720px,92vw)] max-h-[88vh] flex-col overflow-hidden rounded-xl border border-base-content/10 shadow-2xl"
            style={{ background: "var(--ai-config-container-bg)" }}
          >
            {/* Header */}
            <div
              className="flex shrink-0 items-center justify-between border-b border-base-content/10 px-5 py-4"
              style={{ background: "var(--ai-config-header-bg)" }}
            >
              <div className="flex items-center gap-2.5">
                <SlidersHorizontal size={16} className="text-trace-gold" />
                <h3 className="text-base font-semibold text-base-content">{modalTitle || "Latency Details"}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-testid="chat-details-close-button"
                  id="chat-details-close-button"
                  className="rounded-md p-1.5 text-base-content/60 transition-colors hover:bg-base-content/10 hover:text-base-content"
                  onClick={() => closeModal(MODAL_TYPE.CHAT_DETAILS_VIEW_MODAL)}
                >
                  <CloseIcon size={18} />
                </button>
              </div>
            </div>

            {/* Sections */}
            <div className="flex-1 overflow-y-auto p-5 pb-6">
              <JsonSection label="Latency" data={modalContent} />
            </div>
          </div>
        </div>
      </Modal>
    );
  }

  // ── AI Config view ──────────────────────────────────────────────────────
  if (isAiConfigView) {
    return (
      <Modal
        MODAL_ID={MODAL_TYPE.CHAT_DETAILS_VIEW_MODAL}
        onClose={() => closeModal(MODAL_TYPE.CHAT_DETAILS_VIEW_MODAL)}
      >
        <div className="fixed inset-0 z-low-medium flex min-h-[100vh] min-w-[100vw] items-center justify-center overflow-auto bg-black/60 py-8">
          <div
            id="chat-details-modal-container"
            data-testid="ai-config-modal"
            className="relative flex w-[min(720px,92vw)] max-h-[88vh] flex-col overflow-hidden rounded-xl border border-base-content/10 shadow-2xl"
            style={{ background: "var(--ai-config-container-bg)" }}
          >
            {/* Header */}
            <div
              className="flex shrink-0 items-center justify-between border-b border-base-content/10 px-5 py-4"
              style={{ background: "var(--ai-config-header-bg)" }}
            >
              <div className="flex items-center gap-2.5">
                <SlidersHorizontal size={16} className="text-trace-gold" />
                <h3 className="text-base font-semibold text-base-content">{modalTitle || "AI Configuration"}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-testid="chat-details-close-button"
                  id="chat-details-close-button"
                  className="rounded-md p-1.5 text-base-content/60 transition-colors hover:bg-base-content/10 hover:text-base-content"
                  onClick={() => closeModal(MODAL_TYPE.CHAT_DETAILS_VIEW_MODAL)}
                >
                  <CloseIcon size={18} />
                </button>
              </div>
            </div>

            {/* Sections */}
            <div className="flex-1 overflow-y-auto p-5 pb-6">
              <AiConfigPanel config={modalContent} />
            </div>
          </div>
        </div>
      </Modal>
    );
  }

  // ── Generic fallback view ───────────────────────────────────────────────
  return (
    <Modal MODAL_ID={MODAL_TYPE.CHAT_DETAILS_VIEW_MODAL} onClose={() => closeModal(MODAL_TYPE.CHAT_DETAILS_VIEW_MODAL)}>
      <div className="fixed inset-0 bg-black/50 flex justify-center items-start z-low-medium min-w-[100vw] min-h-[100vh] overflow-auto py-4">
        <div
          id="chat-details-modal-container"
          className="bg-base-100 rounded-lg shadow-2xl max-w-6xl w-[90vw] h-auto overflow-auto relative flex flex-col"
        >
          <div className="flex items-start justify-between p-6 border-b border-base-300">
            <h3 className="text-2xl font-bold">{modalTitle || "Detailed View"}</h3>
            <button
              data-testid="chat-details-close-button"
              id="chat-details-close-button"
              className="hover:text-error"
              onClick={() => closeModal(MODAL_TYPE.CHAT_DETAILS_VIEW_MODAL)}
            >
              <CloseIcon size={24} />
            </button>
          </div>

          <div className="flex-1 overflow-auto p-6">
            <div
              data-testid="chat-details-content-container"
              id="chat-details-content-container"
              className="bg-base-200 rounded-lg p-6 h-auto overflow-auto relative"
            >
              <button
                type="button"
                data-testid="chat-details-copy-button"
                onClick={() => handleCopy(copyData)}
                className="absolute right-5 top-5 flex items-center gap-2 text-sm text-warning"
              >
                <CopyIcon size={14} />
                {copied ? "Copied!" : "Copy"}
              </button>
              {modalContent &&
                contentEntries.map(([key, value]) => (
                  <div key={key} className="mb-6 last:mb-0">
                    <h4 className="text-lg font-semibold mb-2">{key}</h4>
                    {Array.isArray(value) ? (
                      <ul className="space-y-2 ml-4">
                        {value.map((item, index) => (
                          <li key={index} className="break-words">
                            <div className="bg-base-100 p-4 rounded-lg shadow-inner break-words whitespace-pre-wrap relative">
                              {typeof item === "object" && item !== null && key === "messages" ? (
                                renderFlattenedMessage(item)
                              ) : (
                                <span className="text-base-content/80">
                                  {typeof item === "object" && item !== null
                                    ? JSON.stringify(item, null, 2)
                                    : String(item)}
                                </span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="bg-base-100 p-4 rounded-lg shadow-inner relative">
                        {typeof value === "object" && value !== null ? (
                          <pre className="text-base-content/80 break-words whitespace-pre-wrap">
                            {JSON.stringify(value, null, 2)}
                          </pre>
                        ) : (
                          <pre className="text-base-content/80 break-words whitespace-pre-wrap">
                            {formatValue(String(value))}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default ChatAiConfigDeatilViewModal;
