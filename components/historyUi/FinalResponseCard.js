"use client";

import React from "react";
import { ChevronUp, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import CodeBlock from "../codeBlock/CodeBlock";

/**
 * Final AI response card — transparent and borderless.
 */
export function FinalResponseCard({
  attachments = null,
  content,
  isHtml = false,
  contentRef,
  isExpanded = true,
  overflows = false,
  onToggleExpand,
  editButton = null,
}) {
  return (
    <div
      data-testid="final-response-card"
      className="w-full relative text-sm text-base-content group"
      style={{ wordBreak: "break-word" }}
    >
      <hr className="border-base-300 my-4" />

      {/* Header */}
      <div className="flex items-center gap-1.5 text-[#c07e2c] font-bold text-xs tracking-wider uppercase mb-3 select-none">
        <Sparkles size={13} className="shrink-0" />
        <span>Final Response</span>
      </div>

      {attachments}

      {/* Body container with click-to-expand */}
      <div
        ref={contentRef}
        data-testid="final-response-content"
        onClick={!isExpanded && overflows ? onToggleExpand : undefined}
        className={`relative ${!isExpanded && overflows ? "cursor-pointer select-none" : ""}`}
      >
        <div className={!isExpanded && overflows ? "overflow-hidden max-h-[160px]" : "whitespace-pre-wrap"}>
          {isHtml ? (
            <div dangerouslySetInnerHTML={{ __html: content }} />
          ) : (
            <ReactMarkdown
              components={{
                code: ({ node, inline, className, children, ...props }) => (
                  <CodeBlock className={className} {...props}>
                    {children}
                  </CodeBlock>
                ),
              }}
            >
              {content}
            </ReactMarkdown>
          )}
        </div>

        {/* Semi-transparent fade-out overlay at the bottom when collapsed */}
        {!isExpanded && overflows && (
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-history-page to-transparent pointer-events-none" />
        )}
      </div>

      {/* Centered Collapse button shown only when expanded */}
      {isExpanded && overflows && (
        <div className="flex justify-center mt-4 select-none">
          <button
            type="button"
            data-testid="final-response-collapse"
            className="btn btn-xs rounded-full border border-base-300 bg-base-200/50 text-base-content hover:bg-base-300 px-4 py-1.5 flex items-center gap-1.5 transition-colors font-semibold"
            onClick={onToggleExpand}
          >
            <ChevronUp size={12} />
            <span>Collapse</span>
          </button>
        </div>
      )}

      {editButton}
    </div>
  );
}
