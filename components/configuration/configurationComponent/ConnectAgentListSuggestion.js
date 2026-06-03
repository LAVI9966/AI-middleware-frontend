import { getStatusClass, openModal } from "@/utils/utility";
import { MODAL_TYPE } from "@/utils/enums";
import { AddIcon } from "@/components/Icons";
import React, { useMemo, useState } from "react";

function ConnectedAgentListSuggestion({
  params,
  handleSelectAgents = () => {},
  connect_agents = [],
  bridges,
  bridgeData,
  excludedAgentIds = [],
  closeOnSelect = false,
}) {
  // Determine if content is read-only (either published or user is not an editor)
  const [searchQuery, setSearchQuery] = useState("");
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const excludedAgentIdSet = useMemo(() => new Set(excludedAgentIds.filter(Boolean)), [excludedAgentIds]);

  const handleInputChange = (e) => {
    setSearchQuery(e?.target?.value || "");
  };

  const handleItemClick = (bridge, bridgeData) => {
    handleSelectAgents(bridge, bridgeData);
    if (closeOnSelect) {
      setSearchQuery("");
      document.activeElement?.blur();
    }
  };

  // First get all available agents (without search filter)
  const availableAgents = useMemo(
    () =>
      Object.values(bridges).filter((bridge) => {
        const isActive = bridge?.bridge_status === 1 || bridge?.bridge_status === undefined;
        const isNotConnected =
          connect_agents && Object.values(connect_agents).some((agent) => agent?.bridge_id === bridge?._id);
        const notSameBridge = bridge?._id !== params?.id;
        const isNotDeleted = !bridge?.deletedAt;
        const isNotExcluded = !excludedAgentIdSet.has(bridge?._id);
        return isActive && !isNotConnected && notSameBridge && isNotDeleted && isNotExcluded;
      }),
    [bridges, connect_agents, params?.id, excludedAgentIdSet]
  );

  // Then filter by search query and render
  const renderBridgeSuggestions = useMemo(
    () =>
      availableAgents
        .filter((bridge) => {
          const matchesSearch = bridge?.name?.toLowerCase()?.includes(normalizedSearchQuery);
          return matchesSearch;
        })
        .slice()
        .sort((a, b) => {
          if (!a?.name) return 1;
          if (!b?.name) return -1;
          return a?.name?.localeCompare(b?.name);
        })
        .map((bridge) => {
          return (
            <li
              data-testid={`connect-agent-suggestion-item-${bridge?._id}`}
              key={bridge?._id}
              id={`connect-agent-suggestion-item-${bridge?._id}`}
              onClick={() => (bridge?.published_version_id ? handleItemClick(bridge, bridgeData) : null)}
            >
              <div
                className={`flex justify-between items-center w-full ${!bridge?.published_version_id ? "opacity-50" : ""}`}
              >
                <p
                  className="overflow-hidden text-ellipsis whitespace-pre-wrap"
                  title={bridge?.name?.length > 20 ? bridge?.name : ""}
                >
                  {bridge?.name?.length > 20 ? `${bridge?.name.slice(0, 20)}...` : bridge?.name || "Untitled"}
                </p>
                <div>
                  {!bridge?.published_version_id ? (
                    <span
                      className={`rounded-full capitalize bg-base-200 px-3 py-1 text-[10px] sm:text-xs font-semibold text-black ${getStatusClass("unpublished")}`}
                    >
                      unpublished
                    </span>
                  ) : (
                    (() => {
                      const statusLabel = bridge?.bridge_status === 0 ? "paused" : "active";
                      return (
                        <span
                          className={`rounded-full capitalize bg-base-200 px-3 py-1 text-[10px] sm:text-xs font-semibold text-black ${getStatusClass(statusLabel)}`}
                        >
                          {statusLabel}
                        </span>
                      );
                    })()
                  )}
                </div>
              </div>
            </li>
          );
        }),
    [availableAgents, normalizedSearchQuery, bridgeData]
  );

  const hasSuggestions = renderBridgeSuggestions?.length > 0;
  const hasAvailableAgents = availableAgents?.length > 0;

  return (
    <ul
      data-testid="connect-agent-suggestion-dropdown"
      id="connect-agent-suggestion-dropdown"
      tabIndex={0}
      className="menu menu-dropdown-toggle dropdown-content z-high px-4 shadow bg-base-100 rounded-box w-72 max-h-96 overflow-y-auto pb-1"
    >
      <div className="flex flex-col gap-2 w-full">
        <li className="text-sm font-semibold disabled">Available Agents</li>
        {hasAvailableAgents && (
          <input
            autoComplete="off"
            data-testid="connect-agent-suggestion-search-input"
            id="connect-agent-suggestion-search-input"
            type="text"
            placeholder="Search Agent"
            value={searchQuery}
            onChange={handleInputChange}
            className="input input-bordered w-full input-sm"
          />
        )}
        {hasSuggestions ? renderBridgeSuggestions : <li className="text-center mt-2">No agents found</li>}
        <li
          data-testid="connect-agent-suggestion-add-new-button"
          id="connect-agent-suggestion-add-new-button"
          className="border-t border-base-300 w-full sticky bottom-0 bg-base-100 py-2"
          onClick={() => {
            openModal(MODAL_TYPE.CREATE_BRIDGE_MODAL);
            setSearchQuery("");
            document.activeElement?.blur();
          }}
        >
          <div>
            <AddIcon size={16} />
            <p className="font-semibold">Add new Agent</p>
          </div>
        </li>
      </div>
    </ul>
  );
}

export default ConnectedAgentListSuggestion;
