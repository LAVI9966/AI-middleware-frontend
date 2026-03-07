import { useCustomSelector } from "./customSelector";

export const useConfigurationState = (params, searchParams) => {
  return useCustomSelector((state) => {
    const embedUserDetails = state?.appInfoReducer?.embedUserDetails || {};
    const versionData = state?.bridgeReducer?.bridgeVersionMapping?.[params?.id]?.[searchParams?.version];
    const bridgeDataFromState = state?.bridgeReducer?.allBridgesMap?.[params?.id];
    const isPublished = searchParams?.isPublished === "true";
    const modelReducer = state?.modelReducer?.serviceModels;

    // Use bridgeData when isPublished=true, otherwise use versionData
    const activeData = isPublished ? bridgeDataFromState : versionData;
    const service = activeData?.service;
    const serviceName = activeData?.service;
    const modelTypeName = activeData?.configuration?.type?.toLowerCase();
    const modelName = activeData?.configuration?.model;

    // Get full validationConfig for the current model
    const validationConfig = modelReducer?.[serviceName]?.[modelTypeName]?.[modelName]?.validationConfig || {};
    const hideAdvancedParameters =
      embedUserDetails.showAdvancedParameters !== undefined
        ? !embedUserDetails.showAdvancedParameters
        : (embedUserDetails.hideAdvancedParameters ?? true);
    const hideAdvancedConfigurations =
      embedUserDetails.showAdvancedConfigurations !== undefined
        ? !embedUserDetails.showAdvancedConfigurations
        : (embedUserDetails.hideAdvancedConfigurations ?? false);
    const hidePreTool =
      embedUserDetails.showPreTool !== undefined
        ? !embedUserDetails.showPreTool
        : (embedUserDetails.hidePreTool ?? false);

    return {
      bridgeType: state?.bridgeReducer?.allBridgesMap?.[params?.id]?.bridgeType?.trim()?.toLowerCase() || "api",
      modelType: isPublished
        ? bridgeDataFromState?.configuration?.type?.toLowerCase()
        : versionData?.configuration?.type?.toLowerCase(),
      reduxPrompt: isPublished ? bridgeDataFromState?.configuration?.prompt : versionData?.configuration?.prompt,
      modelName: isPublished ? bridgeDataFromState?.configuration?.model : versionData?.configuration?.model,
      showConfigType: state.appInfoReducer.embedUserDetails.showConfigType,
      showDefaultApikeys: state.appInfoReducer.embedUserDetails.addDefaultApiKeys,
      shouldToolsShow: validationConfig?.tools,
      bridgeApiKey: isPublished
        ? bridgeDataFromState?.apikey_object_id?.[service === "openai_response" ? "openai" : service]
        : versionData?.apikey_object_id?.[service === "openai_response" ? "openai" : service],
      shouldPromptShow: validationConfig?.system_prompt,
      bridge_functions: isPublished ? bridgeDataFromState?.function_ids || [] : versionData?.function_ids || [],
      connect_agents: isPublished ? bridgeDataFromState?.connected_agents || {} : versionData?.connected_agents || {},
      knowbaseVersionData: isPublished ? bridgeDataFromState?.doc_ids || [] : versionData?.doc_ids || [],
      hideAdvancedParameters,
      hideAdvancedConfigurations,
      service: service,
      hidePreTool,
      validationConfig: validationConfig, // Expose full validationConfig
    };
  });
};
