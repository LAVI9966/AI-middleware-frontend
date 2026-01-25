import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useCustomSelector } from "@/customHooks/customSelector";
import DefaultVariablesSection from "./DefaultVariablesSection";

const DynamicPromptFields = ({
  promptData,
  onChange,
  isPublished = false,
  isEditor = true,
  onSave, // Add onSave prop like PromptTextarea
  setIsTextareaFocused = () => {}, // Add focus state setter
  isEmbedUser = false, // Add isEmbedUser prop to control custom fields visibility
}) => {
  const [fields, setFields] = useState({
    role: "",
    goal: "",
    instructions: "",
    embedPromptFields: {},
  });
  const [singlePromptValue, setSinglePromptValue] = useState("");

  // Get global embed config from Redux
  const { embedUserDetails } = useCustomSelector((state) => state.appInfoReducer);
  const globalEmbedPromptFields = embedUserDetails?.prompt?.embedPromptFields;

  // Auto-migrate old string format and sync with global config
  useEffect(() => {
    let currentData = {};

    if (typeof promptData === "string") {
      // Old format
      currentData = {
        role: "",
        goal: "",
        instructions: promptData,
        embedPromptFields: {},
      };
    } else if (promptData && typeof promptData === "object") {
      // New format
      currentData = {
        role: promptData.role || "",
        goal: promptData.goal || "",
        instructions: promptData.instructions || "",
        embedPromptFields: promptData.embedPromptFields || {},
      };
    }

    // Merge with global configuration only for embed prompts
    if (
      globalEmbedPromptFields &&
      promptData &&
      typeof promptData === "object" &&
      (promptData.embedPromptFields || promptData.customPrompt)
    ) {
      currentData.embedPromptFields = globalEmbedPromptFields;
    }

    if (isEmbedUser) {
      const embedFields = currentData.embedPromptFields || {};
      currentData.embedPromptFields = {
        role: embedFields.role || { visible: false, type: "textarea", value: currentData.role || "" },
        goal: embedFields.goal || { visible: false, type: "input", value: currentData.goal || "" },
        instructions: embedFields.instructions || {
          visible: false,
          type: "textarea",
          value: currentData.instructions || "",
        },
        ...embedFields,
      };
    }

    setFields(currentData);
    if (isEmbedUser) {
      if (typeof promptData === "string") {
        setSinglePromptValue(promptData);
      } else if (promptData && typeof promptData === "object") {
        setSinglePromptValue(promptData.customPrompt || "");
      } else {
        setSinglePromptValue("");
      }
    }
  }, [promptData, globalEmbedPromptFields, isEmbedUser]);

  // Handle field changes
  const handleFieldChange = useCallback(
    (fieldName, value) => {
      const updatedFields = {
        ...fields,
        [fieldName]: value,
      };
      setFields(updatedFields);
      onChange?.(updatedFields);
    },
    [fields, onChange]
  );

  // Handle embed prompt field changes
  const handleFieldValueChange = useCallback(
    (fieldName, value) => {
      const updatedFields = {
        ...fields,
        embedPromptFields: {
          ...fields.embedPromptFields,
          [fieldName]: {
            ...fields.embedPromptFields[fieldName],
            value: value,
          },
        },
      };
      setFields(updatedFields);
      onChange?.(updatedFields);
    },
    [fields, onChange]
  );

  // Handle blur - save prompt object (same approach as PromptTextarea)
  const handleBlur = useCallback(() => {
    if (isEmbedUser && typeof promptData === "string") {
      onSave?.(singlePromptValue);
      return;
    }
    const embedFields = fields.embedPromptFields || {};
    const hasVisibleEmbedFields = Object.values(embedFields).some((fieldConfig) => fieldConfig?.visible);
    const hasCustomPrompt = Boolean(promptData?.customPrompt && String(promptData.customPrompt).trim());

    if (isEmbedUser && !hasVisibleEmbedFields) {
      onSave?.(singlePromptValue);
      return;
    }

    const promptObject = isEmbedUser
      ? {
          customPrompt: hasCustomPrompt ? promptData.customPrompt : "",
          embedPromptFields: embedFields,
        }
      : {
          role: fields.role || "",
          goal: fields.goal || "",
          instructions: fields.instructions || "",
          embedPromptFields: embedFields,
        };

    onSave?.(promptObject);
  }, [fields, isEmbedUser, onSave, promptData, singlePromptValue]);

  const isDisabled = isPublished && !isEditor;
  const hasVisibleEmbedFields = useMemo(() => {
    if (!isEmbedUser) {
      return false;
    }
    return Object.values(fields.embedPromptFields || {}).some((fieldConfig) => fieldConfig?.visible);
  }, [fields.embedPromptFields, isEmbedUser]);
  const showSinglePrompt = isEmbedUser && !hasVisibleEmbedFields;

  return (
    <div className="space-y-4">
      {showSinglePrompt && (
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">System Prompt</span>
          </label>
          <textarea
            value={singlePromptValue}
            onChange={(e) => {
              const value = e.target.value;
              setSinglePromptValue(value);
              onChange?.(value);
            }}
            onFocus={() => setIsTextareaFocused(true)}
            onBlur={(e) => {
              handleBlur(e);
              setIsTextareaFocused(false);
            }}
            disabled={isDisabled}
            placeholder="Write your system prompt..."
            className="textarea textarea-bordered w-full h-32 resize-y"
            title={isDisabled ? "Cannot edit in published mode" : ""}
          />
          <div className="-mt-1">
            <DefaultVariablesSection isPublished={isPublished} prompt={singlePromptValue} isEditor={isEditor} />
          </div>
        </div>
      )}

      {/* Role Field - Input */}
      {!isEmbedUser && (
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Role</span>
          </label>
          <input
            type="text"
            value={fields.role}
            onChange={(e) => handleFieldChange("role", e.target.value)}
            onFocus={() => setIsTextareaFocused(true)}
            onBlur={(e) => {
              handleBlur(e);
              setIsTextareaFocused(false);
            }}
            disabled={isDisabled}
            placeholder="e.g., Math teacher, Customer support agent"
            className="input input-bordered w-full"
            title={isDisabled ? "Cannot edit in published mode" : ""}
          />
        </div>
      )}

      {/* Goal Field - Textarea */}
      {!isEmbedUser && (
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Goal</span>
          </label>
          <input
            value={fields.goal}
            onChange={(e) => handleFieldChange("goal", e.target.value)}
            onFocus={() => setIsTextareaFocused(true)}
            onBlur={(e) => {
              handleBlur(e);
              setIsTextareaFocused(false);
            }}
            disabled={isDisabled}
            placeholder="e.g., Solve math questions, Help customers with inquiries"
            className="input input-bordered w-full"
            title={isDisabled ? "Cannot edit in published mode" : ""}
          />
        </div>
      )}

      {/* Instructions Field - Textarea */}
      {!isEmbedUser && (
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Instructions</span>
          </label>
          <textarea
            value={fields.instructions}
            onChange={(e) => handleFieldChange("instructions", e.target.value)}
            onFocus={() => setIsTextareaFocused(true)}
            onBlur={(e) => {
              handleBlur(e);
              setIsTextareaFocused(false);
            }}
            disabled={isDisabled}
            placeholder="e.g., Provide step-by-step solutions, Be friendly and professional"
            className="textarea textarea-bordered w-full h-32 resize-y"
            title={isDisabled ? "Cannot edit in published mode" : ""}
          />
          {/* Manage Variables Section - No gap with Instructions */}
          <div className="-mt-1">
            <DefaultVariablesSection isPublished={isPublished} prompt={fields.instructions} isEditor={isEditor} />
          </div>
        </div>
      )}

      {/* Embed Prompt Fields - Only show for embed users */}
      {isEmbedUser && fields.embedPromptFields && Object.keys(fields.embedPromptFields).length > 0 && (
        <div className="space-y-3">
          {Object.entries(fields.embedPromptFields)
            .filter(([_, fieldConfig]) => fieldConfig.visible)
            .map(([fieldName, fieldConfig]) => (
              <div key={fieldName} className="form-control">
                <label className="label">
                  <span className="label-text font-medium capitalize">{fieldName}</span>
                </label>
                {fieldConfig.type === "input" ? (
                  <input
                    type="text"
                    value={fieldConfig.value || ""}
                    onChange={(e) => handleFieldValueChange(fieldName, e.target.value)}
                    onFocus={() => setIsTextareaFocused(true)}
                    onBlur={(e) => {
                      handleBlur(e);
                      setIsTextareaFocused(false);
                    }}
                    disabled={isDisabled}
                    placeholder={`Enter ${fieldName}`}
                    className="input input-bordered w-full"
                    title={isDisabled ? "Cannot edit in published mode" : ""}
                  />
                ) : (
                  <textarea
                    value={fieldConfig.value || ""}
                    onChange={(e) => handleFieldValueChange(fieldName, e.target.value)}
                    onFocus={() => setIsTextareaFocused(true)}
                    onBlur={(e) => {
                      handleBlur(e);
                      setIsTextareaFocused(false);
                    }}
                    disabled={isDisabled}
                    placeholder={`Enter ${fieldName}`}
                    className="textarea textarea-bordered w-full h-24 resize-y"
                    title={isDisabled ? "Cannot edit in published mode" : ""}
                  />
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
};

export default DynamicPromptFields;
