/**
 * Resolve configuration parameter values that may be stored as primitives
 * or as { mode, value } wrappers (new config format).
 */
export function isModeValueObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) && "mode" in value;
}

export function resolveConfigurationParamValue(configValue, modelParamMeta = null) {
  if (configValue === undefined || configValue === null) {
    return { isDefault: true, displayValue: null, rawValue: configValue, numericValue: null };
  }

  if (isModeValueObject(configValue)) {
    const { mode, value } = configValue;

    if (mode === "default") {
      return { isDefault: true, displayValue: null, rawValue: configValue, numericValue: null };
    }

    if (mode === "min") {
      const displayValue = modelParamMeta?.min ?? "min";
      return { isDefault: false, displayValue, rawValue: configValue, numericValue: displayValue };
    }

    if (mode === "max") {
      const displayValue = modelParamMeta?.max ?? "max";
      return { isDefault: false, displayValue, rawValue: configValue, numericValue: displayValue };
    }

    return {
      isDefault: false,
      displayValue: value,
      rawValue: configValue,
      numericValue: typeof value === "number" ? value : null,
    };
  }

  if (configValue === "default") {
    return { isDefault: true, displayValue: null, rawValue: configValue, numericValue: null };
  }

  if (configValue === "min" || configValue === "max") {
    const displayValue = modelParamMeta?.[configValue] ?? configValue;
    return {
      isDefault: false,
      displayValue,
      rawValue: configValue,
      numericValue: typeof displayValue === "number" ? displayValue : null,
    };
  }

  return {
    isDefault: false,
    displayValue: configValue,
    rawValue: configValue,
    numericValue: typeof configValue === "number" ? configValue : null,
  };
}

/**
 * Format a configuration value for safe React text rendering.
 */
export function formatConfigurationParamForDisplay(configValue, modelParamMeta = null) {
  const resolved = resolveConfigurationParamValue(configValue, modelParamMeta);
  if (resolved.isDefault || resolved.displayValue === null || resolved.displayValue === undefined) {
    return "—";
  }

  const { displayValue } = resolved;
  if (typeof displayValue === "object") {
    return JSON.stringify(displayValue, null, 2);
  }

  return String(displayValue);
}

/**
 * Normalize a reverted value to match the shape currently used in configuration.
 */
export function normalizeRevertConfigurationValue(key, value, currentConfiguration = {}) {
  if (value === undefined) return value;

  const current = currentConfiguration?.[key];

  if (!isModeValueObject(current)) {
    if (isModeValueObject(value)) {
      const { mode, innerValue } = { mode: value.mode, innerValue: value.value };
      if (mode === "default") return "default";
      if (mode === "min") return "min";
      if (mode === "max") return "max";
      if (mode === "custom") return innerValue;
    }
    return value;
  }

  if (isModeValueObject(value)) {
    return value;
  }

  if (value === "default" || value === undefined || value === null) {
    return { mode: "default", value: null };
  }

  if (value === "min") {
    return { mode: "min", value: null };
  }

  if (value === "max") {
    return { mode: "max", value: null };
  }

  return { mode: "custom", value };
}

export function getEffectiveConfigurationValue(configValue) {
  if (!isModeValueObject(configValue)) {
    return configValue;
  }

  if (configValue.mode === "custom") {
    return configValue.value;
  }

  if (configValue.mode === "default") {
    return undefined;
  }

  return configValue;
}

export function buildRevertPayloadFromHistoryItem(item, currentVersion = null) {
  const previousValue = item?.previous_value;
  if (!previousValue || typeof previousValue !== "object") return null;

  const currentConfiguration = currentVersion?.configuration || {};
  const configurationFieldKeys = new Set([
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

  const payload = {};
  Object.entries(previousValue).forEach(([key, value]) => {
    const normalizedValue =
      key in currentConfiguration || configurationFieldKeys.has(key)
        ? normalizeRevertConfigurationValue(key, value, currentConfiguration)
        : value;

    if (configurationFieldKeys.has(key) || key in currentConfiguration) {
      payload.configuration = {
        ...(payload.configuration || {}),
        [key]: normalizedValue,
      };
    } else {
      payload[key] = normalizedValue;
    }
  });

  return Object.keys(payload).length > 0 ? payload : null;
}
