"use client";
import React from "react";
import { ChevronDown, ChevronRight, RotateCcw } from "lucide-react";
import { getHistoryDiff, formatTime, getTypeLabel, getPublishSnapshot } from "@/utils/configHistoryUtils";

function DiffBlock({ title, lines, tone }) {
  const color = tone === "before" ? "text-error" : "text-success";

  return (
    <div className="rounded-md border border-base-300/60 bg-base-200/40 p-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-base-content/45 mb-1.5">{title}</p>
      {!lines?.length ? (
        <p className="text-xs text-base-content/40 italic">No data</p>
      ) : (
        <div className="space-y-1">
          {lines.map((line, i) => (
            <p key={i} className={`text-xs font-mono break-words ${color}`}>
              <span className="text-base-content/70">{line.key}: </span>
              {line.text}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export function HistoryDiffPanel({ item, showRevert, onRevert, isReverting }) {
  const { beforeLines, afterLines } = getHistoryDiff(item);

  return (
    <div className="space-y-2.5">
      <DiffBlock title="Before" lines={beforeLines} tone="before" />
      <DiffBlock title="After" lines={afterLines} tone="after" />
      {showRevert && beforeLines.length > 0 && (
        <button
          type="button"
          onClick={() => onRevert?.(item)}
          disabled={isReverting}
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 disabled:opacity-50"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          {isReverting ? "Reverting..." : "Revert this change"}
        </button>
      )}
    </div>
  );
}

function PublishPanel({ item, labels }) {
  const entries = getPublishSnapshot(item, labels);

  return (
    <div className="space-y-3 border-t border-base-300/70 pt-3">
      <p className="text-xs text-base-content/55">Made live to production</p>
      {!entries.length ? (
        <p className="text-xs text-base-content/40 italic">No tracked field changes.</p>
      ) : (
        entries.map(({ key, label, userName, diff }) => (
          <div key={key} className="rounded-md border border-base-300/60 bg-base-200/30 p-2.5 space-y-2">
            <div className="flex justify-between gap-2">
              <p className="text-xs font-medium">{label}</p>
              {userName && <p className="text-[10px] text-base-content/45">by {userName}</p>}
            </div>
            <DiffBlock title="Before" lines={diff.beforeLines} tone="before" />
            <DiffBlock title="After" lines={diff.afterLines} tone="after" />
          </div>
        ))
      )}
    </div>
  );
}

export function HistoryRow({ item, labels, expanded, onToggle, showRevert, onRevert, isReverting, isDraft }) {
  const isPublish = item?.type === "Version published";
  const label = getTypeLabel(item?.type, labels, item);

  return (
    <div className={`rounded-lg border bg-base-100 overflow-hidden ${isDraft ? "border-warning/20" : "border-base-300"}`}>
      <button type="button" onClick={onToggle} className="w-full text-left px-3 py-2.5 hover:bg-base-200/40">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 text-base-content/40">
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold truncate">{label}</p>
              {isPublish && (
                <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-bold bg-success text-success-content">
                  PUBLISHED
                </span>
              )}
            </div>
            <p className="text-[11px] text-base-content/45 mt-0.5">
              {item?.user_name || "Unknown"} · {formatTime(item?.time)}
            </p>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3">
          {isPublish ? (
            <PublishPanel item={item} labels={labels} />
          ) : (
            <HistoryDiffPanel item={item} showRevert={showRevert} onRevert={onRevert} isReverting={isReverting} />
          )}
        </div>
      )}
    </div>
  );
}
