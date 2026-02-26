"use client";

import React, { useEffect, useRef } from "react";

const ChatbotPreview = ({ showHeader = true, embedToken }) => {
  const scriptLoadedRef = useRef(false);
  const scriptId = "chatbot-main-script";

  useEffect(() => {
    if (!embedToken) return;
    if (scriptLoadedRef.current) return;
    scriptLoadedRef.current = true;

    const existingScript = document.getElementById(scriptId);
    if (existingScript) {
      document.head.removeChild(existingScript);
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.setAttribute("embedToken", embedToken);
    script.setAttribute("hideIcon", "false");
    script.setAttribute("threadId", "thread1");
    script.setAttribute("defaultOpen", "true");
    script.src = process.env.NEXT_PUBLIC_CHATBOT_SCRIPT_SRC;
    document.head.appendChild(script);

    return () => {
      const scriptToRemove = document.getElementById(scriptId);
      if (scriptToRemove) {
        document.head.removeChild(scriptToRemove);
      }
      scriptLoadedRef.current = false;
    };
  }, [embedToken]);

  useEffect(() => {
    if (!embedToken) return;

    const checkChatbot = setInterval(() => {
      if (typeof window.SendDataToChatbot === "function") {
        clearInterval(checkChatbot);
        window.SendDataToChatbot({
          bridgeName: "chatbot preview",
          parentId: "chatbot-preview-container",
        });
      }
    }, 100);

    return () => clearInterval(checkChatbot);
  }, [embedToken]);

  if (!embedToken) {
    return null;
  }

  return (
    <div className="h-full flex flex-col bg-base-100">
      {showHeader && (
        <div className="p-4 border-b border-base-300">
          <h3 className="text-sm font-semibold text-base-content">Live Preview</h3>
        </div>
      )}

      <div id="chatbot-preview-container" className="h-full w-full"></div>
    </div>
  );
};

export default ChatbotPreview;
