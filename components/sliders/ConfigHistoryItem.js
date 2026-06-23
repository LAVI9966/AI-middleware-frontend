"use client";
import React from "react";
import { ChevronDown, ChevronRight, RotateCcw } from "lucide-react";
import {
  extractHistoryDiff,
  formatHistoryTime,
  getHistoryTypeLabel,
  getPublishSnapshotEntries,
} from "@/utils/configHistoryUtils";

function DiffBlock({ title, lines, tone }) {
  if (!lines?.length) {
    return (
      <div className="rounded-md border border-base-300/60 bg-base-200/40 p-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-base-content/45 mb-1">{title}</p>
        <p className="text-xs text-base-content/40 italic">No data</p>
      </div>
    );
  }

  const toneClass = tone === "before" ? "text-error" : "text-success";

  return (
    <div className="rounded-md border border-base-300/60 bg-base-200/40 p-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-base-content/45 mb-1.5">{title}</p>
      <div className="space-y-1">
        {lines.map((line, index) => (
          <p key={`${line.key}-${index}`} className={`text-xs font-mono leading-relaxed break-words ${toneClass}`}>
            <span className="text-base-content/70">{line.key}: </span>
            {line.text}
          </p>
        ))}
      </div>
    </div>
  );
}

export function HistoryDiffPanel({ item, showRevert, onRevert, isReverting }) {
  const { beforeLines, afterLines } = extractHistoryDiff(item?.previous_value, item?.current_value);
  const canRevert = showRevert && beforeLines.length > 0;

  return (
    <div className="mt-3 space-y-2.5 border-t border-base-300/70 pt-3">
      <div className="grid grid-cols-1 gap-2">
        <DiffBlock title="Before" lines={beforeLines} tone="before" />
        <DiffBlock title="After" lines={afterLines} tone="after" />
      </div>
      {canRevert && (
        <button
          type="button"
          onClick={() => onRevert?.(item)}
          disabled={isReverting}
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 disabled:opacity-50 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          {isReverting ? "Reverting..." : "Revert this change"}
        </button>
      )}
    </div>
  );
}

function PublishSnapshotPanel({ item, featureLabelMap }) {
  const snapshotEntries = getPublishSnapshotEntries(item, featureLabelMap);

  return (
    <div className="mt-3 space-y-3 border-t border-base-300/70 pt-3">
      <p className="text-xs text-base-content/55">Made live to production</p>
      {snapshotEntries.length > 0 ? (
        <div className="space-y-3">
          {snapshotEntries.map(({ key, label, entry, diff }) => (
            <div key={key} className="rounded-md border border-base-300/60 bg-base-200/30 p-2.5">
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-xs font-medium text-base-content">{label}</p>
                {entry?.user_name && <p className="text-[10px] text-base-content/45 truncate">by {entry.user_name}</p>}
              </div>
              {(diff.beforeLines.length > 0 || diff.afterLines.length > 0) && (
                <div className="grid grid-cols-1 gap-2">
                  <DiffBlock title="Before" lines={diff.beforeLines} tone="before" />
                  <DiffBlock title="After" lines={diff.afterLines} tone="after" />
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-base-content/40 italic">No tracked field changes in this publish.</p>
      )}
    </div>
  );
}

export function ConfigHistoryDraftRow({ item, featureLabelMap, isExpanded, onToggle }) {
  const label = getHistoryTypeLabel(item?.type, featureLabelMap, item);

  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-base-100/80 hover:bg-base-100 border border-warning/20 transition-colors text-left"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-base-content truncate">{label}</p>
        <p className="text-[11px] text-base-content/45 truncate mt-0.5">
          {item?.user_name || "Unknown user"} · {formatHistoryTime(item?.time)}
        </p>
      </div>
      <ChevronRight
        className={`w-4 h-4 text-base-content/35 shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`}
      />
    </button>
  );
}

export function ConfigHistoryCard({
  item,
  featureLabelMap,
  isExpanded,
  onToggle,
  showRevert = false,
  onRevert,
  isReverting = false,
  compact = false,
}) {
  const isPublishEvent = item?.type === "Version published";
  const label = getHistoryTypeLabel(item?.type, featureLabelMap, item);

  return (
    <div className="rounded-lg border border-base-300 bg-base-100 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className={`w-full text-left px-3 ${compact ? "py-2.5" : "py-3"} hover:bg-base-200/40 transition-colors`}
      >
        <div className="flex items-start gap-2">
          <div className="mt-0.5 shrink-0 text-base-content/40">
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-base-content truncate">{label}</p>
              {isPublishEvent && (
                <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-success text-success-content">
                  PUBLISHED
                </span>
              )}
            </div>
            <p className="text-[11px] text-base-content/45 mt-0.5 truncate">
              {item?.user_name || "Unknown user"} · {formatHistoryTime(item?.time)}
            </p>
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="px-3 pb-3">
          {isPublishEvent ? (
            <PublishSnapshotPanel item={item} featureLabelMap={featureLabelMap} />
          ) : (
            <HistoryDiffPanel item={item} showRevert={showRevert} onRevert={onRevert} isReverting={isReverting} />
          )}
        </div>
      )}
    </div>
  );
}
