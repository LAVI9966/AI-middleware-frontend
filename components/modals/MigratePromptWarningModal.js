import { MODAL_TYPE } from "@/utils/enums";
import { closeModal } from "@/utils/utility";
import React, { useEffect, useState } from "react";
import { CircleAlert } from "lucide-react";

/**
 * MigratePromptWarningModal
 * Shows a warning when user tries to migrate from simple string prompt to structured prompt
 */
const MigratePromptWarningModal = ({
  onConfirm,
  isMainMigration = false,
  isEmbedMigration = false,
  sourcePrompt = "",
  onSaveStructured,
  onSaveEmbed,
  embedPromptConfig = {},
  agentPromptConfig = {},
  modalId = MODAL_TYPE.MIGRATE_PROMPT_WARNING_MODAL || "MIGRATE_PROMPT_WARNING_MODAL",
}) => {
  const [role, setRole] = useState("");
  const [goal, setGoal] = useState("");
  const [instruction, setInstruction] = useState("");
  const [embedFieldValues, setEmbedFieldValues] = useState({});
  const isEmbedDefaultPromptMode = !!embedPromptConfig?.useDefaultPrompt;
  const visibleEmbedFields = Array.isArray(embedPromptConfig?.embedFields)
    ? embedPromptConfig.embedFields.filter((field) => !field?.hidden)
    : [];
  const visibleAgentFields = Array.isArray(agentPromptConfig?.embedFields)
    ? agentPromptConfig.embedFields.filter((field) => !field?.hidden)
    : [];
  const hasAgentVisibleFields = visibleAgentFields.length > 0;
  const isSplitMigration = isMainMigration || isEmbedMigration;

  useEffect(() => {
    if (isMainMigration || isEmbedMigration) {
      setRole("");
      setGoal("");
      setInstruction("");

      const initialValues = {};
      const agentFieldValueMap = {};
      visibleAgentFields.forEach((field) => {
        const key = field?.name;
        if (key) {
          agentFieldValueMap[key] = field?.value || "";
        }
      });

      visibleEmbedFields.forEach((field) => {
        const key = field?.name;
        if (key) {
          initialValues[key] = agentFieldValueMap[key] ?? field?.value ?? "";
        }
      });
      setEmbedFieldValues(initialValues);
    }
  }, [isMainMigration, isEmbedMigration, sourcePrompt, embedPromptConfig, agentPromptConfig]);

  const handleClose = () => {
    closeModal(modalId);
  };

  const handleConfirm = () => {
    onConfirm?.();
    handleClose();
  };

  const handleMainSave = () => {
    onSaveStructured?.({
      role,
      goal,
      instruction,
    });
    handleClose();
  };

  const handleEmbedSave = () => {
    if (isEmbedDefaultPromptMode) {
      onSaveEmbed?.({
        role,
        goal,
        instruction,
        useDefaultPrompt: true,
      });
      handleClose();
      return;
    }

    const updatedEmbedFields = (embedPromptConfig?.embedFields || []).map((field) => {
      const name = field?.name;
      if (!name) return field;
      if (field?.hidden) return field;
      return {
        ...field,
        value: embedFieldValues[name] ?? field?.value ?? "",
      };
    });

    onSaveEmbed?.({
      customPrompt: embedPromptConfig?.customPrompt || sourcePrompt || "",
      embedFields: updatedEmbedFields,
      useDefaultPrompt: false,
    });
    handleClose();
  };

  return (
    <dialog id={modalId} className="modal">
      <div
        className={`modal-box bg-base-100 p-4 sm:p-6 rounded-xl shadow-xl border border-base-200 w-[96vw] max-h-[90vh] overflow-hidden ${
          isSplitMigration ? "max-w-6xl" : "max-w-lg"
        }`}
      >
        {isSplitMigration ? (
          <div className="space-y-5 h-full flex flex-col">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center">
                <CircleAlert className="w-6 h-6 text-warning" strokeWidth={1.5} />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-xl text-base-content">Migrate Prompt Structure</h3>
                <p className="text-sm text-base-content/70 break-words">
                  Copy from your current prompt on the left and paste into the new fields on the right.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0 overflow-y-auto pr-1">
              <div className="border border-base-300 rounded-lg p-3 bg-base-50 min-w-0">
                <h4 className="text-sm font-semibold mb-2">
                  {isEmbedMigration && !isEmbedDefaultPromptMode && hasAgentVisibleFields
                    ? "Current Agent Fields"
                    : "Current Prompt (String)"}
                </h4>
                {isEmbedMigration && !isEmbedDefaultPromptMode && hasAgentVisibleFields ? (
                  <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                    {visibleAgentFields.length > 0 ? (
                      visibleAgentFields.map((field) => (
                        <div key={field?.name} className="space-y-1 min-w-0">
                          <label className="text-xs font-medium text-base-content/70 break-all">{field?.name}</label>
                          {field?.type === "textarea" ? (
                            <textarea
                              className="textarea textarea-bordered w-full h-20"
                              value={field?.value || ""}
                              readOnly
                            />
                          ) : (
                            <input
                              type="text"
                              className="input input-bordered w-full"
                              value={field?.value || ""}
                              readOnly
                            />
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-base-content/60">No existing visible fields on agent.</p>
                    )}
                  </div>
                ) : (
                  <textarea
                    className="textarea textarea-bordered w-full h-[50vh] text-sm font-mono"
                    value={sourcePrompt || ""}
                    readOnly
                  />
                )}
              </div>

              <div className="border border-base-300 rounded-lg p-3 bg-base-50 space-y-3 min-w-0">
                <h4 className="text-sm font-semibold">
                  {isMainMigration || isEmbedDefaultPromptMode ? "New Structured Prompt" : "Fill Embed Fields"}
                </h4>
                {isMainMigration || isEmbedDefaultPromptMode ? (
                  <>
                    <input
                      type="text"
                      className="input input-bordered w-full"
                      placeholder="Role"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                    />
                    <input
                      type="text"
                      className="input input-bordered w-full"
                      placeholder="Goal"
                      value={goal}
                      onChange={(e) => setGoal(e.target.value)}
                    />
                    <textarea
                      className="textarea textarea-bordered w-full h-40"
                      placeholder="Instruction"
                      value={instruction}
                      onChange={(e) => setInstruction(e.target.value)}
                    />
                  </>
                ) : (
                  <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                    {visibleEmbedFields.length > 0 ? (
                      visibleEmbedFields.map((field) => {
                        const fieldName = field?.name || "";
                        const isTextarea = field?.type === "textarea";
                        return (
                          <div key={fieldName} className="space-y-1 min-w-0">
                            <label className="text-xs font-medium text-base-content/70 break-all">{fieldName}</label>
                            {isTextarea ? (
                              <textarea
                                className="textarea textarea-bordered w-full h-24"
                                value={embedFieldValues[fieldName] || ""}
                                onChange={(e) =>
                                  setEmbedFieldValues((prev) => ({
                                    ...prev,
                                    [fieldName]: e.target.value,
                                  }))
                                }
                              />
                            ) : (
                              <input
                                type="text"
                                className="input input-bordered w-full"
                                value={embedFieldValues[fieldName] || ""}
                                onChange={(e) =>
                                  setEmbedFieldValues((prev) => ({
                                    ...prev,
                                    [fieldName]: e.target.value,
                                  }))
                                }
                              />
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-base-content/60">No visible embed fields available to fill.</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="modal-action w-full flex gap-3 mt-2 justify-end">
              <button className="btn btn-ghost hover:bg-base-200" onClick={handleClose}>
                Cancel
              </button>
              <button
                className="btn btn-primary text-primary-content"
                onClick={isMainMigration ? handleMainSave : handleEmbedSave}
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center mb-2">
              <CircleAlert className="w-10 h-10 text-warning" strokeWidth={1.5} />
            </div>

            <h3 className="font-bold text-xl text-base-content">Migrate Prompt Structure?</h3>

            <div className="text-base-content/70 text-sm space-y-2">
              <p>
                This action will convert your current prompt format into a structured format with distinct{" "}
                <span className="font-semibold text-base-content">Role</span>,{" "}
                <span className="font-semibold text-base-content">Goal</span>, and{" "}
                <span className="font-semibold text-base-content">Instruction</span> fields.
              </p>
              <p className="bg-base-200/50 p-3 rounded-lg text-xs mt-2 border border-base-200">
                Note: Your existing prompt text will not be automatically moved to the Instruction field. You will start
                with empty fields to restructure your prompt optimally.
              </p>
            </div>

            <div className="modal-action w-full flex gap-3 mt-4 justify-center">
              <button className="btn btn-ghost hover:bg-base-200 flex-1" onClick={handleClose}>
                Cancel
              </button>
              <button className="btn btn-primary flex-1 text-primary-content" onClick={handleConfirm}>
                Confirm Migration
              </button>
            </div>
          </div>
        )}
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={handleClose}>close</button>
      </form>
    </dialog>
  );
};

export default MigratePromptWarningModal;
