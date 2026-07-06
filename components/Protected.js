// Protected.js
"use client";

import { useCustomSelector } from "@/customHooks/customSelector";
import { getFromCookies } from "@/utils/utility";
import { useRouter } from "next/navigation";
import React, { useEffect } from "react";
const Protected = (WrappedComponent) => {
  const ProtectedComponent = (props) => {
    const router = useRouter();
    const { isEmbedUser, isFocus, isEmbedUserFromUserDetails } = useCustomSelector((state) => ({
      isEmbedUser: state.appInfoReducer.embedUserDetails.isEmbedUser,
      isFocus: state?.bridgeReducer?.isFocus || false,
      isEmbedUserFromUserDetails: state?.userDetailsReducer?.userDetails?.meta?.type === "embed",
    }));
    useEffect(() => {
      const timer = setTimeout(() => {
        if (
          typeof window !== "undefined" &&
          !getFromCookies("proxy_token") &&
          !sessionStorage.getItem("local_token") &&
          (!isEmbedUser || !isEmbedUserFromUserDetails)
        ) {
          const isEmbedContext =
            window.location.pathname.includes("/embed") ||
            sessionStorage.getItem("embedUser") === "true" ||
            window.location.hostname.includes("embed");
          if (isEmbedContext) {
            router.replace("/session-expired");
          } else {
            router.replace("/login");
          }
        }
      }, 1000);
      return () => clearTimeout(timer);
    }, [router]);

    const hasMainAppToken = !!getFromCookies("proxy_token");
    const isEmbedState = !!(isEmbedUser || isEmbedUserFromUserDetails);
    const hasEmbedToken = !!sessionStorage.getItem("local_token");
    // If the user has main-app auth (proxy_token cookie), ignore stale embed state
    // so the main app layout always renders correctly even after using embed in the same tab.
    const effectiveIsEmbedUser = !hasMainAppToken && isEmbedState && hasEmbedToken;

    return <WrappedComponent {...props} isEmbedUser={effectiveIsEmbedUser} isFocus={isFocus} />;
  };
  return ProtectedComponent;
};

export default Protected;
