"use client";
import { getFromCookies ,openModal} from "@/utils/utility";
import { useEffect } from "react";
import { MODAL_TYPE } from "@/utils/enums";

export const runtime = "edge";

const page = () => {

useEffect(() => {
    const configuration = {
    authToken: getFromCookies("proxy_token") || "",
    success: (data) => {},
    failure: (error) => {
      console.error("failure reason", error);
    },
  };

  const existingScript = document.querySelector(
    'script[src="https://proxy.msg91.com/assets/proxy-auth/proxy-auth.js"]'
  );

  if (existingScript) {
  existingScript.parentNode.removeChild(existingScript);
  const scriptSrc = document.createElement("script");
  scriptSrc.type = "text/javascript";
  scriptSrc.src = "https://proxy.msg91.com/assets/proxy-auth/proxy-auth.js";
  scriptSrc.onload = () => {
    if (window.initVerification) {
      window.initVerification(configuration);
    }
  };
  document.body.appendChild(scriptSrc);
}else {
    const scriptSrc = document.createElement("script");
    scriptSrc.type = "text/javascript";
    scriptSrc.src = "https://proxy.msg91.com/assets/proxy-auth/proxy-auth.js";
    window.proxyAuthConfig = configuration;
    scriptSrc.onload = () => {
      if (window.initVerification) {
        window.initVerification(configuration);
      } else {
        console.error("initVerification function not found");
      }
    };
    scriptSrc.onerror = (error) => {
      console.error("Failed to load script:", error);
    };
    document.body.appendChild(scriptSrc);
  }

  return () => {
    // Remove current script on unmount, then reload with user-management config for other pages
    const existingScript = document.querySelector(
      'script[src="https://proxy.msg91.com/assets/proxy-auth/proxy-auth.js"]'
    );
    if (existingScript) {
      existingScript.parentNode.removeChild(existingScript);
    }
    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = "https://proxy.msg91.com/assets/proxy-auth/proxy-auth.js";
    script.onload = function () {
      if (typeof window.initVerification === "function") {
        window.initVerification({
          authToken: getFromCookies("proxy_token") || "",
          pass: true,
          type: "user-management",
          exclude_role_ids: [18, 20],
          success: (data) => {},
          failure: (error) => {},
        });
      }
    };
    document.head.appendChild(script);
  };
}, []);

useEffect(() => {
  const handleOpenDialog = () => {
    openModal(MODAL_TYPE.INVITE_USER);
  };
  window.addEventListener('openAddUserDialog', handleOpenDialog);
  return () => {
    window.removeEventListener('openAddUserDialog', handleOpenDialog);
  };
}, []);
  return <div id="proxyContainer"></div>;
};

export default page;