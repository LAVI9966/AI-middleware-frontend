"use client";

import React from "react";
import PrivateFormSection from "./FirstStep";
import SecondStep from "./SecondStep";
import { useCustomSelector } from "@/customHooks/customSelector";

const ChatbotIntegrationGuideTab = ({ params, chatBotId }) => {
  const { slugName, prompt } = useCustomSelector((state) => {
    const chatBotConfig = state?.ChatBot?.ChatBotMap?.[chatBotId];
    return {
      slugName: chatBotConfig?.slugName || "",
      prompt: chatBotConfig?.prompt || "",
    };
  });

  return (
    <div className="h-full overflow-y-auto p-6" data-testid="chatbot-integration-guide-tab">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-base-content mb-2">Chatbot Integration Guide</h2>
        <p className="text-sm text-base-content/70">Follow these steps to integrate your chatbot</p>
      </div>

      <div className="space-y-6">
        <PrivateFormSection params={params} ChooseChatbot={true} />
        <SecondStep slugName={slugName} prompt={prompt} />
      </div>
    </div>
  );
};

export default ChatbotIntegrationGuideTab;
