import { PROMPT_FIELDS } from "./enums";

const ROLE_KEY = PROMPT_FIELDS.ROLE.key;
const GOAL_KEY = PROMPT_FIELDS.GOAL.key;
const INSTRUCTION_KEY = PROMPT_FIELDS.INSTRUCTION.key;

// Check if a prompt is a structured object with role/goal/instruction keys
// Accepts both plain objects and JSON strings
export const isValidJsonPrompt = (prompt) => {
  if (!prompt) return false;

  // Direct object check
  if (typeof prompt === "object" && !Array.isArray(prompt)) {
    return ROLE_KEY in prompt || GOAL_KEY in prompt || INSTRUCTION_KEY in prompt;
  }

  // JSON string fallback (legacy data)
  if (typeof prompt === "string") {
    try {
      const parsed = JSON.parse(prompt);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return false;
      return ROLE_KEY in parsed || GOAL_KEY in parsed || INSTRUCTION_KEY in parsed;
    } catch {
      return false;
    }
  }

  return false;
};

// Parse a JSON prompt string into a structured object { role, goal, instruction }
export const parsePromptObject = (prompt) => {
  if (!prompt) return { role: "", goal: "", instruction: "" };

  if (typeof prompt === "object" && prompt !== null) {
    return {
      role: prompt[ROLE_KEY] || "",
      goal: prompt[GOAL_KEY] || "",
      instruction: prompt[INSTRUCTION_KEY] || "",
    };
  }

  if (typeof prompt === "string") {
    try {
      const parsed = JSON.parse(prompt);
      return {
        role: parsed[ROLE_KEY] || "",
        goal: parsed[GOAL_KEY] || "",
        instruction: parsed[INSTRUCTION_KEY] || "",
      };
    } catch {
      return { role: "", goal: "", instruction: "" };
    }
  }

  return { role: "", goal: "", instruction: "" };
};

// Convert a structured prompt object to a plain string for DB storage
// Format: "Role: ...\n\nGoal: ...\n\nInstruction: ..."
// If already a string, return as-is
export const promptObjectToString = (prompt) => {
  if (!prompt) return "";

  if (typeof prompt === "string") return prompt;

  if (typeof prompt === "object" && prompt !== null) {
    const parts = [];
    if (prompt[ROLE_KEY]) parts.push(`Role: ${prompt[ROLE_KEY]}`);
    if (prompt[GOAL_KEY]) parts.push(`Goal: ${prompt[GOAL_KEY]}`);
    if (prompt[INSTRUCTION_KEY]) parts.push(prompt[INSTRUCTION_KEY]);
    return parts.join("\n\n");
  }

  return String(prompt);
};

// Preprocess content into granular fields so it can be compared consistently.
export const preprocessPrompt = (content) => {
  if (!content) return {};
  let obj = content;
  if (typeof content === "string") {
    try {
      obj = JSON.parse(content);
    } catch {
      return { instruction: content };
    }
  }
  return obj;
};

// Extract {{variable}} names from a prompt (string or object)
export const extractVariablesFromPrompt = (prompt) => {
  if (!prompt) return [];

  let text = "";
  if (typeof prompt === "string") {
    text = prompt;
  } else if (typeof prompt === "object" && prompt !== null) {
    text = [prompt[ROLE_KEY] || "", prompt[GOAL_KEY] || "", prompt[INSTRUCTION_KEY] || ""].join(" ");
  }

  const matches = text.matchAll(/\{\{([^}]+)\}\}/g);
  const variables = [];
  for (const match of matches) {
    if (match[1]) variables.push(match[1].trim());
  }
  return [...new Set(variables)];
};
