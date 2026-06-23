import { isEqual } from "lodash";
import { DIFFERNCE_DATA_DISPLAY_NAME } from "@/jsonFiles/bridgeParameter";
import {
  formatConfigurationParamForDisplay,
  isModeValueObject,
  buildRevertPayloadFromHistoryItem,
} from "@/utils/configurationParamUtils";

const SYSTEM_HISTORY_TYPES = new Set(["Version created", "Agent created"]);

const PROMPT_SECTION_LABELS = {
  role: "Role",
  goal: "Goal",
  instruction: "Instruction",
};

export function getHistoryTypeLabel(type, featureLabelMap = {}, item = null) {
  if (!type) return "Change";
  if (type === "Version published") return "Version published";

  if (item && (type === "prompt" || type === "response_type")) {
    const previousValue = item.previous_value || {};
    const currentValue = item.current_value || {};
    const fieldKey = Object.keys({ ...previousValue, ...currentValue })[0];
    const before = previousValue[fieldKey];
    const after = currentValue[fieldKey];

    if (fieldKey === "prompt" && (typeof before === "object" || typeof after === "object")) {
      const sectionKeys = Object.keys({ ...(before || {}), ...(after || {}) });
      const changedSection = sectionKeys.find((sectionKey) => !isEqual(before?.[sectionKey], after?.[sectionKey]));
      if (changedSection && PROMPT_SECTION_LABELS[changedSection]) {
        return PROMPT_SECTION_LABELS[changedSection];
      }
    }

    if (fieldKey === "response_type") {
      return "Response type";
    }
  }

  return featureLabelMap[type] || DIFFERNCE_DATA_DISPLAY_NAME(type) || type;
}

export function formatHistoryTime(timestamp) {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatHistoryDateHeader(timestamp) {
  if (!timestamp) return "";
  return new Date(timestamp)
    .toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    })
    .toUpperCase();
}

function formatPrimitive(value, modelKey = null) {
  if (isModeValueObject(value)) {
    return formatConfigurationParamForDisplay(value);
  }
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return `"${value}"`;
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return JSON.stringify(value, null, 2);
  }
  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

function flattenValueLines(key, value, lines = []) {
  if (value === null || value === undefined) {
    lines.push({ key, text: "—" });
    return lines;
  }

  if (key === "prompt" && typeof value === "object" && !Array.isArray(value)) {
    Object.entries(value).forEach(([sectionKey, sectionValue]) => {
      const label = PROMPT_SECTION_LABELS[sectionKey] || sectionKey;
      lines.push({
        key: label,
        text: formatPrimitive(sectionValue),
      });
    });
    return lines;
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    Object.entries(value).forEach(([nestedKey, nestedValue]) => {
      lines.push({
        key: nestedKey,
        text: formatPrimitive(nestedValue),
      });
    });
    return lines;
  }

  lines.push({ key, text: formatPrimitive(value) });
  return lines;
}

export function extractHistoryDiff(previousValue = {}, currentValue = {}) {
  const keys = [...new Set([...Object.keys(previousValue || {}), ...Object.keys(currentValue || {})])];
  const beforeLines = [];
  const afterLines = [];

  keys.forEach((key) => {
    const before = previousValue?.[key];
    const after = currentValue?.[key];
    if (isEqual(before, after)) return;

    flattenValueLines(key, before, beforeLines);
    flattenValueLines(key, after, afterLines);
  });

  return { beforeLines, afterLines };
}

export function splitDraftAndHistory(historyItems = []) {
  const visibleItems = historyItems.filter((item) => item?.type && !SYSTEM_HISTORY_TYPES.has(item.type));
  const lastPublishEntry = visibleItems.find((item) => item.type === "Version published");
  const lastPublishTime = lastPublishEntry?.time ? new Date(lastPublishEntry.time).getTime() : null;

  const draftItems = visibleItems.filter((item) => {
    if (item.type === "Version published") return false;
    if (lastPublishTime === null) return true;
    return new Date(item.time).getTime() > lastPublishTime;
  });

  const draftIdSet = new Set(draftItems.map((item) => item.id));
  const historyItemsFiltered = visibleItems.filter((item) => !draftIdSet.has(item.id));

  return { draftItems, historyItems: historyItemsFiltered };
}

export function groupHistoryByDate(historyItems = []) {
  const groups = [];
  const seen = new Map();

  historyItems.forEach((item) => {
    const label = formatHistoryDateHeader(item?.time);
    if (!seen.has(label)) {
      seen.set(label, groups.length);
      groups.push({ label, items: [] });
    }
    groups[seen.get(label)].items.push(item);
  });

  return groups;
}

export function buildRevertPayload(item, currentVersion = null) {
  return buildRevertPayloadFromHistoryItem(item, currentVersion);
}

export function getPublishSnapshotEntries(item, featureLabelMap = {}) {
  const snapshot = item?.current_value?.snapshot || {};
  return Object.entries(snapshot).map(([key, entry]) => ({
    key,
    label: getHistoryTypeLabel(key, featureLabelMap),
    entry,
    diff: extractHistoryDiff(entry?.previous_value || {}, entry?.current_value || {}),
  }));
}
