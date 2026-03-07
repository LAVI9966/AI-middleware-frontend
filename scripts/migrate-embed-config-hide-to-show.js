// Migration script: convert embed config visibility keys from hideXxx to showXxx.
// NOTE: This script is NOT executed automatically. Run it manually after reviewing.
//
// Usage (example):
//   NODE_OPTIONS='-r dotenv/config' \
//   NEXT_PUBLIC_SERVER_URL='https://your-server-url' \
//   node scripts/migrate-embed-config-hide-to-show.js
//
// Authentication:
// - This script assumes that the backend accepts an Authorization header with a bearer token.
// - Set process.env.GTWY_MIGRATION_TOKEN accordingly, or adapt the getAxiosInstance() function.

/* eslint-disable no-console */

const axios = require("axios");

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL;
const MIGRATION_TOKEN = process.env.GTWY_MIGRATION_TOKEN || "";

if (!SERVER_URL) {
  console.error("NEXT_PUBLIC_SERVER_URL is not set. Please set it before running the migration.");
  process.exit(1);
}

const HIDE_TO_SHOW_MAP = {
  hideHomeButton: "showHomeButton",
  hideAdvancedParameters: "showAdvancedParameters",
  hideAdvancedConfigurations: "showAdvancedConfigurations",
  hidePreTool: "showPreTool",
  hideCreateManuallyButton: "showCreateManuallyButton",
  hideFullScreenButton: "showFullScreenButton",
  hideCloseButton: "showCloseButton",
  hideHeader: "showHeader",
  hidePromptHelper: "showPromptHelper",
};

function getAxiosInstance() {
  const instance = axios.create({
    baseURL: SERVER_URL,
  });

  if (MIGRATION_TOKEN) {
    instance.interceptors.request.use((config) => {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${MIGRATION_TOKEN}`;
      return config;
    });
  }

  return instance;
}

async function fetchAllEmbeds(client) {
  const res = await client.get("/api/embed/");
  return res.data;
}

function transformConfig(config = {}) {
  const updated = { ...config };
  let changed = false;

  Object.entries(HIDE_TO_SHOW_MAP).forEach(([hideKey, showKey]) => {
    const hasShow = Object.prototype.hasOwnProperty.call(updated, showKey);
    const hasHide = Object.prototype.hasOwnProperty.call(updated, hideKey);

    if (!hasShow && hasHide) {
      const hideValue = Boolean(updated[hideKey]);
      updated[showKey] = !hideValue;
      changed = true;
    }
  });

  return { updatedConfig: updated, changed };
}

async function migrate() {
  const client = getAxiosInstance();

  console.log(`Starting migration against ${SERVER_URL}`);

  const embeds = await fetchAllEmbeds(client);
  if (!Array.isArray(embeds) || embeds.length === 0) {
    console.log("No embed integrations found. Nothing to migrate.");
    return;
  }

  let updatedCount = 0;

  for (const embed of embeds) {
    const folderId = embed._id || embed.folder_id;
    if (!folderId) continue;

    const originalConfig = embed.config || {};
    const { updatedConfig, changed } = transformConfig(originalConfig);

    if (!changed) continue;

    console.log(`Would update embed ${folderId} (${embed.name || "unnamed"})`);

    // IMPORTANT: The following call is intentionally commented out.
    // Uncomment when you are ready to run the migration.
    //
    // await client.put("/api/embed/", {
    //   folder_id: folderId,
    //   orgId: embed.org_id || embed.orgId,
    //   config: updatedConfig,
    // });

    updatedCount += 1;
  }

  console.log(`Migration dry-run completed. Embeds to update: ${updatedCount}`);
  console.log("When ready, uncomment the client.put(...) call to perform the actual update.");
}

// Run only when this file is executed directly
if (require.main === module) {
  migrate().catch((err) => {
    console.error("Migration failed:", err?.response?.data || err.message || err);
    process.exit(1);
  });
}

