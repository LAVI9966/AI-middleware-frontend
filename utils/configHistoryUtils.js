import { isEqual } from "lodash";
import { DIFFERNCE_DATA_DISPLAY_NAME } from "@/jsonFiles/bridgeParameter";

const SYSTEM_TYPES = new Set(["Version created", "Agent created"]);
const CONFIG_KEYS = new Set([
  "prompt",
  "model",
  "type",
  "fall_back",
  "response_type",
  "json_schema",
  "temperature",
  "max_tokens",
  "top_p",
  "is_rich_text",
  "is_enable",
  "fine_tune_model",
]);

const PROMPT_LABELS = { role: "Role", goal: "Goal", instruction: "Instruction" };

// --- value helpers (config can be string, object, or { mode, value }) ---

export function isModeValue(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) && "mode" in value;
}

/** Read stored value: new format = direct value; old format = { key: value } wrapper */
export function readHistoryValue(stored, type) {
  if (stored === null || stored === undefined) return stored;
  if (typeof stored !== "object" || Array.isArray(stored)) return stored;

  // Old wrapped format
  if (type && type in stored && Object.keys(stored).length === 1) return stored[type];
  if (type === "agents" && stored.connected_agents !== undefined) return stored.connected_agents;
  if (type === "pre_tools" && stored.pre_tools !== undefined) return stored.pre_tools;

  return stored;
}

export function formatValue(value) {
  if (value === null || value === undefined) return "—";

  if (isModeValue(value)) {
    if (value.mode === "default") return "—";
    if (value.mode === "min") return "min";
    if (value.mode === "max") return "max";
    const inner = value.value;
    return typeof inner === "object" ? JSON.stringify(inner, null, 2) : String(inner);
  }

  if (typeof value === "string") return `"${value}"`;
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

/** For AdvancedParamenter sliders */
export function resolveConfigParam(value, meta = null) {
  if (value === undefined || value === null) {
    return { isDefault: true, display: null, numeric: null };
  }

  if (isModeValue(value)) {
    if (value.mode === "default") return { isDefault: true, display: null, numeric: null };
    if (value.mode === "min") return { isDefault: false, display: meta?.min ?? "min", numeric: meta?.min ?? null };
    if (value.mode === "max") return { isDefault: false, display: meta?.max ?? "max", numeric: meta?.max ?? null };
    return {
      isDefault: false,
      display: value.value,
      numeric: typeof value.value === "number" ? value.value : null,
    };
  }

  if (value === "default" || value === undefined) return { isDefault: true, display: null, numeric: null };
  if (value === "min" || value === "max") {
    const display = meta?.[value] ?? value;
    return { isDefault: false, display, numeric: typeof display === "number" ? display : null };
  }

  return {
    isDefault: false,
    display: value,
    numeric: typeof value === "number" ? value : null,
  };
}

function toLines(type, value) {
  const v = readHistoryValue(value, type);
  const lines = [];

  if (v === null || v === undefined) return [{ key: type, text: "—" }];

  // Grouped model row: { service, model, type }
  if (type === "model" && typeof v === "object" && !Array.isArray(v) && !isModeValue(v) && ("service" in v || "model" in v)) {
    if (v.service !== undefined) lines.push({ key: "service", text: formatValue(v.service) });
    if (v.model !== undefined) lines.push({ key: "model", text: formatValue(v.model) });
    if (v.type !== undefined) lines.push({ key: "type", text: formatValue(v.type) });
    return lines.length ? lines : [{ key: type, text: formatValue(v) }];
  }

  if (type === "prompt" && typeof v === "object" && !Array.isArray(v)) {
    Object.entries(v).forEach(([k, part]) => {
      lines.push({ key: PROMPT_LABELS[k] || k, text: formatValue(part) });
    });
    return lines.length ? lines : [{ key: type, text: formatValue(v) }];
  }

  if (typeof v === "object" && !Array.isArray(v) && !isModeValue(v)) {
    Object.entries(v).forEach(([k, part]) => lines.push({ key: k, text: formatValue(part) }));
    return lines.length ? lines : [{ key: type, text: formatValue(v) }];
  }

  return [{ key: type, text: formatValue(v) }];
}

export function getHistoryDiff(item) {
  const type = item?.type;
  const before = readHistoryValue(item?.previous_value, type);
  const after = readHistoryValue(item?.current_value, type);

  if (isEqual(before, after)) {
    return { beforeLines: [], afterLines: [] };
  }

  return {
    beforeLines: toLines(type, before),
    afterLines: toLines(type, after),
  };
}

function normalizeRevertValue(value, currentConfigValue) {
  if (!isModeValue(currentConfigValue)) {
    if (isModeValue(value)) {
      if (value.mode === "default") return "default";
      if (value.mode === "min") return "min";
      if (value.mode === "max") return "max";
      if (value.mode === "custom") return value.value;
    }
    return value;
  }

  if (isModeValue(value)) return value;
  if (value === "default" || value === null || value === undefined) return { mode: "default", value: null };
  if (value === "min") return { mode: "min", value: null };
  if (value === "max") return { mode: "max", value: null };
  return { mode: "custom", value };
}

export function buildRevertPayload(item, currentVersion = null) {
  const type = item?.type;
  const raw = readHistoryValue(item?.previous_value, type);
  if (raw === undefined) return null;

  const config = currentVersion?.configuration || {};

  // Grouped model + service + type in one history row
  if (type === "model" && raw && typeof raw === "object" && !Array.isArray(raw) && !isModeValue(raw)) {
    const payload = {};
    if (raw.service !== undefined) payload.service = raw.service;
    const configuration = {};
    if (raw.model !== undefined) configuration.model = normalizeRevertValue(raw.model, config.model);
    if (raw.type !== undefined) configuration.type = raw.type;
    if (Object.keys(configuration).length > 0) payload.configuration = configuration;
    return Object.keys(payload).length > 0 ? payload : null;
  }

  const value = CONFIG_KEYS.has(type) || type in config ? normalizeRevertValue(raw, config[type]) : raw;

  if (type === "agents") {
    return { agents: { connected_agents: value, agent_status: "1" } };
  }
  if (CONFIG_KEYS.has(type) || type in config) {
    return { configuration: { [type]: value } };
  }
  if (type === "functionData") {
    return { function_ids: value };
  }
  return { [type]: value };
}

// --- labels & grouping ---

export function getTypeLabel(type, labels = {}, item = null) {
  if (!type) return "Change";
  if (type === "Version published") return "Version published";

  if (item && type === "prompt") {
    const before = readHistoryValue(item.previous_value, type);
    const after = readHistoryValue(item.current_value, type);
    const keys = Object.keys({ ...(before || {}), ...(after || {}) });
    const changed = keys.find((k) => !isEqual(before?.[k], after?.[k]));
    if (changed && PROMPT_LABELS[changed]) return PROMPT_LABELS[changed];
  }

  if (type === "response_type") return "Response type";
  if (type === "model" && item) {
    const before = readHistoryValue(item.previous_value, type);
    const after = readHistoryValue(item.current_value, type);
    if (before?.service !== after?.service) return "Model & Service";
  }
  return labels[type] || DIFFERNCE_DATA_DISPLAY_NAME(type) || type;
}

export function formatTime(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

export function formatDateHeader(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }).toUpperCase();
}

export function splitDraftAndHistory(items = []) {
  const visible = items.filter((i) => i?.type && !SYSTEM_TYPES.has(i.type));
  const lastPublish = visible.find((i) => i.type === "Version published");
  const publishTime = lastPublish?.time ? new Date(lastPublish.time).getTime() : null;

  const draftItems = visible.filter((i) => {
    if (i.type === "Version published") return false;
    if (publishTime === null) return true;
    return new Date(i.time).getTime() > publishTime;
  });

  const draftIds = new Set(draftItems.map((i) => i.id));
  return { draftItems, historyItems: visible.filter((i) => !draftIds.has(i.id)) };
}

export function groupByDate(items = []) {
  const groups = [];
  const seen = new Map();

  items.forEach((item) => {
    const label = formatDateHeader(item?.time);
    if (!seen.has(label)) {
      seen.set(label, groups.length);
      groups.push({ label, items: [] });
    }
    groups[seen.get(label)].items.push(item);
  });

  return groups;
}

export function getPublishSnapshot(item, labels = {}) {
  const snapshot = item?.current_value?.snapshot || {};
  return Object.entries(snapshot).map(([key, entry]) => ({
    key,
    label: getTypeLabel(key, labels),
    userName: entry?.user_name,
    diff: getHistoryDiff({
      type: key,
      previous_value: entry?.previous_value,
      current_value: entry?.current_value,
    }),
  }));
}
