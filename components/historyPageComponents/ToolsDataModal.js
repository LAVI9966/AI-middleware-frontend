import React, { useMemo, useState, useEffect } from "react";
import { CloseIcon, CopyIcon } from "@/components/Icons";
import { SlidersHorizontal } from "lucide-react";
import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter";
import oneDark from "react-syntax-highlighter/dist/esm/styles/prism/one-dark";
import oneLight from "react-syntax-highlighter/dist/esm/styles/prism/one-light";
import json from "react-syntax-highlighter/dist/esm/languages/prism/json";

SyntaxHighlighter.registerLanguage("json", json);

function JsonSection({ label, data, count }) {
  const jsonString = useMemo(() => {
    if (typeof data === "string") {
      try {
        return JSON.stringify(JSON.parse(data), null, 2);
      } catch {
        return data;
      }
    }
    return JSON.stringify(data, null, 2);
  }, [data]);
  const [isDark, setIsDark] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const check = () => setIsDark(document.documentElement.getAttribute("data-theme") === "dark");
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

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
          onClick={handleCopy}
          className="btn btn-ghost btn-xs text-[10px] px-2 py-0.5 h-auto min-h-0 font-medium text-base-content/75 hover:bg-base-content/10 flex items-center gap-1"
        >
          <CopyIcon size={11} />
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <div className="max-h-64 overflow-auto" style={{ background: "var(--ai-config-section-bg)" }}>
        <SyntaxHighlighter
          language="json"
          style={isDark ? oneDark : oneLight}
          customStyle={{
            margin: 0,
            padding: "12px 14px",
            background: "transparent",
            fontSize: "11px",
            lineHeight: "1.55",
          }}
          codeTagProps={{
            style: {
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            },
          }}
        >
          {jsonString}
        </SyntaxHighlighter>
      </div>
    </section>
  );
}

const SECTION_KEYS = new Set(["input", "args", "payload", "output", "response", "data"]);

const ToolsDataModal = ({ toolsData, handleClose, toolsDataModalRef, integrationData }) => {
  const isAgent = toolsData?.metadata?.type === "agent" || toolsData?.type === "AGENT" || Boolean(toolsData?.bridge_id);
  const modalTitle = isAgent ? "Agent Data" : "Function Data";

  const { sections, parameters } = useMemo(() => {
    const secs = [];
    const params = {};

    Object.entries(toolsData || {}).forEach(([key, value]) => {
      let resolvedValue = value;
      if (key === "name" && integrationData?.[value]) {
        resolvedValue = integrationData[value]?.title;
      }

      if (
        SECTION_KEYS.has(key.toLowerCase()) ||
        Array.isArray(value) ||
        (typeof value === "object" && value !== null)
      ) {
        const label = key.replace(/_/g, " ");
        const count = Array.isArray(value) ? value.length : null;
        secs.push({ key, label, data: resolvedValue, count });
      } else {
        params[key] = resolvedValue;
      }
    });

    return { sections: secs, parameters: params };
  }, [toolsData, integrationData]);

  return (
    <dialog
      data-testid="tools-data-modal"
      id="tools-data-modal"
      className="modal modal-middle p-4 outline-none z-[1000]"
      ref={toolsDataModalRef}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          handleClose();
        }
      }}
    >
      <div
        id="tools-data-modal-container"
        className="relative flex w-[min(720px,92vw)] max-h-[88vh] flex-col overflow-hidden rounded-xl border border-base-content/10 shadow-2xl bg-base-100"
        style={{ background: "var(--ai-config-container-bg)" }}
      >
        {/* Header */}
        <div
          className="flex shrink-0 items-center justify-between border-b border-base-content/10 px-5 py-4"
          style={{ background: "var(--ai-config-header-bg)" }}
        >
          <div className="flex items-center gap-2.5">
            <SlidersHorizontal size={16} className="text-trace-gold" />
            <h3 className="text-base font-semibold text-base-content">{modalTitle}</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="tools-data-modal-close-button"
              className="rounded-md p-1.5 text-base-content/60 transition-colors hover:bg-base-content/10 hover:text-base-content"
              onClick={handleClose}
            >
              <CloseIcon size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 pb-6 text-left">
          {toolsData ? (
            <div className="flex flex-col gap-4">
              {Object.keys(parameters).length > 0 && <JsonSection label="Parameters" data={parameters} />}
              {sections.map(({ key, label, data, count }) => (
                <JsonSection key={key} label={label} data={data} count={count} />
              ))}
            </div>
          ) : (
            <p className="text-center text-base-content py-4">No data available</p>
          )}
        </div>
      </div>
    </dialog>
  );
};

export default ToolsDataModal;
