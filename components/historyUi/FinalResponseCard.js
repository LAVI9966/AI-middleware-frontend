"use client";

import React from "react";
import { Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import CodeBlock from "../codeBlock/CodeBlock";

/**
 * Final AI response card — transparent and borderless.
 */
export function FinalResponseCard({ attachments = null, content, isHtml = false, editButton = null }) {
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

      {/* Body container */}
      <div data-testid="final-response-content">
        <div className="whitespace-pre-wrap">
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
      </div>

      {editButton}
    </div>
  );
}
