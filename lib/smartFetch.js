// lib/smartFetch.js
import fetch from "node-fetch";
import { BASE_URL, BASE_HEADERS } from "./config.js";
import { getAllTokens, getTokenForBatch } from "./tokenStore.js";

/**
 * Try all tokens until one gives a valid response
 * isVideo=true: also checks video_player_token validity
 */
export async function smartFetch(endpoint, params = {}, isVideo = false, batchId = null) {
  // If we know the batchId, prefer that token first
  let tokens = getAllTokens();
  if (batchId) {
    const preferred = getTokenForBatch(batchId);
    if (preferred) {
      tokens = [preferred, ...tokens.filter((t) => t.userId !== preferred.userId)];
    }
  }

  if (tokens.length === 0) {
    return {
      status: 503,
      error: "No tokens in pool. Please login first via /api/login or send token to Telegram bot.",
    };
  }

  const urlParams = new URLSearchParams(params).toString();
  const url = `${BASE_URL}${endpoint}${urlParams ? "?" + urlParams : ""}`;

  for (const entry of tokens) {
    try {
      const headers = {
        ...BASE_HEADERS,
        authorization: entry.token,
        "user-id": entry.userId,
      };

      const resp = await fetch(url, { headers, timeout: 12000 });
      if (!resp.ok) continue;

      const json = await resp.json();
      const dataBody = json.data;

      if (isVideo) {
        const vToken = dataBody?.video_player_token || "";
        if (!vToken || vToken.length < 10) continue;
      }

      if (json.status === "success" || dataBody) {
        return { status: 200, data: dataBody || json };
      }
    } catch (_) {
      continue;
    }
  }

  return {
    status: 403,
    error: "All tokens failed or access denied. Token may be expired.",
  };
}
