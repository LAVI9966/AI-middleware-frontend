"use client";

import React from "react";

/**
 * Final AI response card — beige/gold bordered panel with agent badge header.
 */
export function FinalResponseCard({
  agentInitials,
  agentName,
  avatarClassName = "bg-trace-gold text-white",
  onAvatarClick = null,
  avatarMenu = null,
  badges = null,
  attachments = null,
  content,
  isHtml = false,
  contentRef,
  isExpanded = true,
  overflows = false,
  onToggleExpand,
  footerExtra = null,
  editButton = null,
}) {
  return (
    <div
      data-testid="final-response-card"
      className="rounded-xl border border-trace-gold-border border-l-4 border-l-trace-gold px-5 py-4 text-sm text-base-content relative group"
      style={{ wordBreak: "break-word", background: "var(--final-response-bg)" }}
    >
      {attachments}

      {/* Body */}
      <div
        ref={contentRef}
        data-testid="final-response-content"
        className={!isExpanded ? "line-clamp-5 overflow-hidden" : "whitespace-pre-wrap"}
      >
        {isHtml ? <div dangerouslySetInnerHTML={{ __html: content }} /> : <span>{content}</span>}
      </div>

      {overflows && (
        <button
          type="button"
          data-testid="final-response-show-more"
          className="mt-2 text-xs font-bold text-trace-gold hover:text-trace-gold/80 transition-colors"
          onClick={onToggleExpand}
        >
          {isExpanded ? "Show less" : "Show more"}
        </button>
      )}

      {footerExtra}
      {editButton}
    </div>
  );
}
