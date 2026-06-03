// lib/tokenKeepAlive.js — v5
// ✅ 24/7 token online rakhta hai
// ✅ Har 25 min pe silent ping — token expire nahi hoga
// ✅ Token fail ho to Telegram pe alert
// ✅ Baarbaar refresh nahi — sirf ping (batches re-fetch nahi hoti)

import fetch from "node-fetch";
import { BASE_URL, makeHeaders } from "./config.js";
import { getAllTokens, removeToken } from "./tokenStore.js";
import { sendLog } from "./telegram.js";

const PING_INTERVAL_MS = 25 * 60 * 1000; // 25 minutes
const MAX_FAILURES = 3; // is se zyada fail ho to remove

const failureCount = new Map(); // userId => consecutive failures

async function pingToken(entry) {
  try {
    const headers = makeHeaders(entry.token, entry.userId);
    const resp = await fetch(
      `${BASE_URL}/get/mycourseweb?userid=${entry.userId}`,
      { headers, timeout: 10000 }
    );
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const ok = data.status === "success" || Array.isArray(data.data) || data.status === 200;
    if (!ok) throw new Error("Invalid response");

    // Success — reset failure count
    failureCount.set(entry.userId, 0);
    return true;
  } catch (e) {
    const prev = failureCount.get(entry.userId) || 0;
    failureCount.set(entry.userId, prev + 1);
    console.warn(`[KeepAlive] ⚠️ ${entry.userId} ping failed (${prev + 1}/${MAX_FAILURES}): ${e.message}`);
    return false;
  }
}

export async function runKeepAlive() {
  const tokens = getAllTokens();
  if (tokens.length === 0) return;

  let alive = 0, dead = 0;

  // Parallel ping — sare tokens ek saath ping honge
  await Promise.allSettled(
    tokens.map(async (entry) => {
      if (entry.source === "manual") {
        await pingToken(entry); // ping but never remove
        alive++;
        return;
      }

      const ok = await pingToken(entry);
      if (ok) {
        alive++;
      } else {
        const failures = failureCount.get(entry.userId) || 0;
        if (failures >= MAX_FAILURES) {
          removeToken(entry.userId);
          dead++;
          await sendLog(
            `⚠️ <b>Token Expired / Removed</b>\n` +
            `👤 User ID: <code>${entry.userId}</code>\n` +
            `📌 Source: ${entry.source || "unknown"}\n` +
            `❌ ${MAX_FAILURES} consecutive ping failures\n` +
            `⏰ ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST`
          );
          console.log(`[KeepAlive] ❌ Removed dead token: ${entry.userId}`);
        }
      }
    })
  );

  if (tokens.length > 0) {
    console.log(`[KeepAlive] ✅ ${alive} alive, ❌ ${dead} removed — ${new Date().toLocaleTimeString()}`);
  }
}

export function startKeepAlive() {
  console.log(`🔄 Token KeepAlive started — ping every ${PING_INTERVAL_MS / 60000} min`);
  // First run after 2 min (let server boot)
  setTimeout(() => {
    runKeepAlive();
    setInterval(runKeepAlive, PING_INTERVAL_MS);
  }, 2 * 60 * 1000);
}

export function getTokenHealth() {
  const tokens = getAllTokens();
  return tokens.map((t) => ({
    userId: t.userId,
    name: t.name || "",
    source: t.source,
    failures: failureCount.get(t.userId) || 0,
    status: (failureCount.get(t.userId) || 0) === 0 ? "healthy" : "warning",
  }));
}
