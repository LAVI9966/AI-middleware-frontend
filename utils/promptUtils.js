//Utility functions for handling prompt formats (string vs structured object)

// Normalize prompt to structured format If string: convert to  role: "", goal: "", instruction: string  If object: ensure it has role, goal, instruction fields

export const normalizePromptToStructured = (prompt, isEmbedUser, embedConfig) => {
  // If Embed User is migrating and has configuration available
  if (isEmbedUser && embedConfig) {
    // Check if prompt config exists inside embedConfig
    const promptConfig = embedConfig.prompt || {};

    // If using default prompt (useDefaultPrompt: true) -> Return standard Role/Goal/Instruction structure
    if (promptConfig.useDefaultPrompt) {
      if (typeof prompt === "object" && (prompt.role || prompt.goal || prompt.instruction)) {
        return prompt;
      }
      return {
        role: "",
        goal: "",
        instruction: "",
      };
    }

    // If NOT using default prompt -> Return structure with custom embed fields
    // We construct the object based on the embedConfig.prompt
    if (!promptConfig.useDefaultPrompt && promptConfig.embedFields) {
      const result = {
        customPrompt: promptConfig.customPrompt || "",
        embedFields: promptConfig.embedFields, // This includes the 'hidden' property which PromptRenderer respects
        useDefaultPrompt: false,
      };
      return result;
    }
  }

  if (!prompt) {
    return { role: "", goal: "", instruction: "" };
  }

  // If it's a string (legacy format), we want to return empty structure
  // so user has to explicitly fill in Role, Goal, Instruction
  if (typeof prompt === "string") {
    return {
      role: "",
      goal: "",
      instruction: "",
    };
  }

  // If it's already an object, ensure it has the required fields
  if (typeof prompt === "object") {
    const structuredPrompt = {
      role: prompt.role || "",
      goal: prompt.goal || "",
      instruction: prompt.instruction || "",
    };

    // Only add embed fields if they already exist in the prompt object
    if (prompt.customPrompt !== undefined) structuredPrompt.customPrompt = prompt.customPrompt;
    if (prompt.embedFields !== undefined) structuredPrompt.embedFields = prompt.embedFields;
    if (prompt.useDefaultPrompt !== undefined) structuredPrompt.useDefaultPrompt = prompt.useDefaultPrompt;

    return structuredPrompt;
  }

  return { role: "", goal: "", instruction: "" };
};

// Convert structured prompt to string for backward compatibility
export const convertStructuredPromptToString = (promptObj) => {
  if (!promptObj || typeof promptObj !== "object") {
    return "";
  }

  // For embed users with custom prompt
  if (promptObj.customPrompt && !promptObj.useDefaultPrompt) {
    return promptObj.customPrompt;
  }

  // For main users: combine role, goal, instruction
  const parts = [];
  if (promptObj.role) {
    parts.push(`Role: ${promptObj.role}`);
  }
  if (promptObj.goal) {
    parts.push(`Goal: ${promptObj.goal}`);
  }
  if (promptObj.instruction) {
    parts.push(promptObj.instruction);
  }

  return parts.join("\n\n");
};

// Extract text from prompt for variable extraction (works with both string and structured formats)
const extractTextFromPrompt = (prompt) => {
  if (!prompt) return "";

  if (typeof prompt === "string") {
    return prompt;
  }

  if (typeof prompt === "object") {
    let textToSearch = "";
    // Extract from all text fields
    if (prompt.role) textToSearch += prompt.role + " ";
    if (prompt.goal) textToSearch += prompt.goal + " ";
    if (prompt.instruction) textToSearch += prompt.instruction + " ";
    if (prompt.customPrompt) textToSearch += prompt.customPrompt + " ";
    // Extract from embed fields
    if (Array.isArray(prompt.embedFields)) {
      prompt.embedFields.forEach((field) => {
        if (field.value) textToSearch += field.value + " ";
      });
    }
    return textToSearch;
  }

  return "";
};

// Extract variables from prompt (works with both string and structured formats)
export const extractVariablesFromPrompt = (prompt) => {
  if (!prompt) return [];

  const textToSearch = extractTextFromPrompt(prompt);
  if (!textToSearch) return [];

  // Extract {{variable}} patterns
  const matches = textToSearch.matchAll(/\{\{([^}]+)\}\}/g);
  const variables = [];
  for (const match of matches) {
    if (match[1]) {
      variables.push(match[1].trim());
    }
  }

  return [...new Set(variables)];
};

// Preprocess content into granular fields so it can be compared consistently.
export const preprocessPrompt = (content) => {
  let obj = content;

  // 1. Normalize String to Object
  if (typeof content === "string") {
    try {
      obj = JSON.parse(content);
    } catch {
      // Fallback: Treat as instruction
      return { instruction: content };
    }
  } else if (!content) {
    return {};
  }

  // 2. Clone to avoid mutation
  const processed = JSON.parse(JSON.stringify(obj));

  // 3. Explode embedFields array to object
  if (Array.isArray(processed.embedFields)) {
    const fieldsObj = {};
    processed.embedFields.forEach((field) => {
      if (!field.hidden && field.name) {
        fieldsObj[field.name] = field.value || "";
      }
    });
    processed.embedFields = fieldsObj;

    // If we have embed fields, remove the customPrompt template from comparison
    // as per user request to only compare the fields
    delete processed.customPrompt;
    delete processed.useDefaultPrompt;
  }

  return processed;
};

// Convert prompt to advanced view format (single string with values filled in)
// For main users: "Role: [value]\nGoal: [value]\nInstruction: [value]"
// For embed users: "Label: [value]\nLabel: [value]" (visible fields only)
export const convertPromptToAdvancedView = (prompt) => {
  if (!prompt) return "";

  // For string prompts (simple case)
  if (typeof prompt === "string") {
    return prompt;
  }

  // For object prompts
  if (typeof prompt === "object" && prompt !== null) {
    // Embed user with custom fields - show Label: Value format
    if (prompt.customPrompt && prompt.embedFields) {
      const parts = [];

      // Add visible embed fields in Label: Value format
      const fields = Array.isArray(prompt.embedFields) ? prompt.embedFields : [];
      fields.forEach((field) => {
        if (!field.hidden && field.value) {
          const label = field.label || field.name;
          if (label) {
            parts.push(`${label}: ${field.value}`);
          }
        }
      });

      return parts.join("\n");
    }

    // Main user structured format (role, goal, instruction)
    if (prompt.role !== undefined || prompt.goal !== undefined || prompt.instruction !== undefined) {
      const parts = [];
      if (prompt.role) parts.push(`Role: ${prompt.role}`);
      if (prompt.goal) parts.push(`Goal: ${prompt.goal}`);
      if (prompt.instruction) parts.push(`Instruction: ${prompt.instruction}`);
      return parts.join("\n");
    }
  }

  return String(prompt);
};
