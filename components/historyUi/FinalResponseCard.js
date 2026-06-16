"use client";

import React from "react";
import { Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { ExpandCollapse } from "@/components/UI/ExpandCollapse";
import { mdComponentsLight, mdRemarkPlugins } from "@/utils/markdownComponents";

/**
 * Final AI response card — transparent and borderless.
 * Long responses are collapsed behind a gradient shade and can be expanded inline.
 */
export function FinalResponseCard({
  attachments = null,
  content,
  isHtml = false,
  editButton = null,
  hasToolCalls = false,
}) {
  return (
    <div
      data-testid="final-response-card"
      className="w-full relative text-sm text-slate-900 dark:text-zinc-100 group"
      style={{ wordBreak: "break-word" }}
    >
      {hasToolCalls && <hr className="border-base-300 my-4" />}

      {/* Header */}
      {hasToolCalls && (
        <div className="flex items-center gap-1.5 text-[#c07e2c] dark:text-[#C9A84C] font-bold text-xs tracking-wider uppercase mb-3 select-none">
          <Sparkles size={13} className="shrink-0" />
          <span>Final Response</span>
        </div>
      )}

      {attachments}

      {/* Body container — wrapped in ExpandCollapse for long content */}
      <ExpandCollapse collapsedHeight={300} fadeHeight={90} expandLabel="Show more" collapseLabel="Collapse">
        <div data-testid="final-response-content">
          <div className="">
            {isHtml ? (
              <div dangerouslySetInnerHTML={{ __html: content }} />
            ) : (
              <ReactMarkdown components={mdComponentsLight} remarkPlugins={mdRemarkPlugins}>
                {content}
              </ReactMarkdown>
            )}
          </div>
        </div>
      </ExpandCollapse>

      {editButton}
    </div>
  );
}
