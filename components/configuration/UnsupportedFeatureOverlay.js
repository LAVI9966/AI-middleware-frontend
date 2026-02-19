import React from "react";
import { AlertCircle } from "lucide-react";

const UnsupportedFeatureOverlay = ({ featureName = "feature" }) => {
  return (
    <div className="absolute inset-0 z-10 backdrop-blur-sm bg-base-100/30 flex items-center justify-center">
      <div className="bg-base-200 border border-base-300 rounded-lg p-6 shadow-lg max-w-md text-center">
        <AlertCircle className="w-12 h-12 text-warning mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-base-content mb-2">{featureName} Not Supported</h3>
        <p className="text-sm text-base-content/70">This feature is not available for the currently selected model.</p>
      </div>
    </div>
  );
};

export default UnsupportedFeatureOverlay;
