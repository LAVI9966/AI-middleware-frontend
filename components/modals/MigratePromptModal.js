import React, { useEffect, useState } from "react";
import Modal from "../UI/Modal";
import { MODAL_TYPE, PROMPT_FIELDS } from "@/utils/enums";
import { closeModal } from "@/utils/utility";
import { isValidJsonPrompt, parsePromptObject } from "@/utils/promptUtils";

const ROLE_KEY = PROMPT_FIELDS.ROLE.key;
const GOAL_KEY = PROMPT_FIELDS.GOAL.key;
const INSTRUCTION_KEY = PROMPT_FIELDS.INSTRUCTION.key;

const MigratePromptModal = ({ currentPrompt = "", onConfirm, embedFields = null }) => {
  const isEmbedMode = Array.isArray(embedFields) && embedFields.length > 0;

  const getInitialFields = (prompt) => {
    if (isEmbedMode) {
      // Initialize all embed fields as empty strings
      return embedFields.reduce((acc, f) => ({ ...acc, [f.name]: "" }), {});
    }
    if (isValidJsonPrompt(prompt)) {
      const parsed = parsePromptObject(prompt);
      return {
        [ROLE_KEY]: parsed.role || "",
        [GOAL_KEY]: parsed.goal || "",
        [INSTRUCTION_KEY]: parsed.instruction || "",
      };
    }
    return {
      [ROLE_KEY]: "",
      [GOAL_KEY]: "",
      [INSTRUCTION_KEY]: "",
    };
  };

  const [fields, setFields] = useState(() => getInitialFields(currentPrompt));

  // Re-populate fields whenever the modal is opened with a new prompt or embedFields change
  useEffect(() => {
    setFields(getInitialFields(currentPrompt));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPrompt, isEmbedMode]);

  const handleChange = (key, value) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  };

  const handleConfirm = () => {
    onConfirm?.(fields);
    closeModal(MODAL_TYPE.MIGRATE_PROMPT_MODAL);
  };

  const handleCancel = () => {
    closeModal(MODAL_TYPE.MIGRATE_PROMPT_MODAL);
  };

  return (
    <Modal MODAL_ID={MODAL_TYPE.MIGRATE_PROMPT_MODAL}>
      <div className="modal-box w-full max-w-4xl flex flex-col gap-4">
        <h3 className="text-lg font-semibold">Migrate Prompt to Structured Format</h3>

        {/* Side-by-side layout */}
        <div className="grid grid-cols-2 gap-4 min-h-0">
          {/* Left: Current prompt */}
          <div className="flex flex-col gap-1">
            <label className="label py-0">
              <span className="label-text font-medium text-base-content/70">Current Prompt</span>
            </label>
            <textarea
              className="textarea textarea-bordered bg-base-200 w-full flex-1 text-sm leading-relaxed resize-none"
              style={{ minHeight: "320px" }}
              value={currentPrompt}
              readOnly
            />
          </div>

          {/* Right: Structured fields */}
          <div className="flex flex-col gap-3 overflow-y-auto" style={{ maxHeight: "420px" }}>
            <label className="label py-0">
              <span className="label-text font-medium text-base-content/70">Structured Fields</span>
            </label>

            {isEmbedMode ? (
              /* Render embed fields dynamically */
              embedFields
                .filter((f) => !f.hidden)
                .map((field) => (
                  <div key={field.name} className="form-control gap-1">
                    <span className="label-text font-medium capitalize">{field.name}</span>
                    {field.type === "textarea" ? (
                      <textarea
                        className="textarea textarea-bordered w-full text-sm leading-relaxed"
                        style={{ minHeight: "120px" }}
                        placeholder={`Enter ${field.name}...`}
                        value={fields[field.name] || ""}
                        onChange={(e) => handleChange(field.name, e.target.value)}
                      />
                    ) : (
                      <input
                        type="text"
                        className="input input-bordered w-full text-sm input-sm"
                        placeholder={`Enter ${field.name}...`}
                        value={fields[field.name] || ""}
                        onChange={(e) => handleChange(field.name, e.target.value)}
                      />
                    )}
                  </div>
                ))
            ) : (
              /* Default role / goal / instruction fields */
              <div className="p-2">
                <div className="form-control gap-1 ">
                  <span className="label-text font-medium capitalize">{ROLE_KEY}</span>
                  <input
                    type="text"
                    className="input input-bordered w-full text-sm input-sm"
                    placeholder="e.g. You are a helpful customer support assistant"
                    value={fields[ROLE_KEY]}
                    onChange={(e) => handleChange(ROLE_KEY, e.target.value)}
                  />
                </div>

                <div className="form-control gap-1">
                  <span className="label-text font-medium capitalize">{GOAL_KEY}</span>
                  <input
                    type="text"
                    className="input input-bordered w-full text-sm input-sm"
                    placeholder="e.g. Help users resolve their issues quickly and accurately"
                    value={fields[GOAL_KEY]}
                    onChange={(e) => handleChange(GOAL_KEY, e.target.value)}
                  />
                </div>

                <div className="form-control gap-1 flex-1 flex flex-col">
                  <span className="label-text font-medium capitalize">{INSTRUCTION_KEY}</span>
                  <textarea
                    className="textarea textarea-bordered w-full flex-1 text-sm leading-relaxed"
                    style={{ minHeight: "260px" }}
                    placeholder="e.g. Always be polite. Ask clarifying questions if needed..."
                    value={fields[INSTRUCTION_KEY]}
                    onChange={(e) => handleChange(INSTRUCTION_KEY, e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-2">
          <button type="button" className="btn btn-ghost btn-sm" onClick={handleCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={handleConfirm}>
            Migrate &amp; Save
          </button>
        </div>
      </div>
    </Modal>
  );
};

MigratePromptModal.displayName = "MigratePromptModal";

export default MigratePromptModal;
