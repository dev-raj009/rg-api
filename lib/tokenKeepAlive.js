// lib/tokenKeepAlive.js — v11 (native fetch, Vercel-safe)

import { BASE_URL, makeHeaders } from "./config.js";
import { getAllTokens, removeToken } from "./tokenStore.js";
import { sendLog } from "./telegram.js";

const PING_INTERVAL_MS = 25 * 60 * 1000;
const MAX_FAILURES = 3;
const failureCount = new Map();

async function pingToken(entry) {
  try {
    const headers = makeHeaders(entry.token, entry.userId);
    const resp = await fetch(
      `${BASE_URL}/get/mycourseweb?userid=${entry.userId}`,
      { headers, signal: AbortSignal.timeout(10000) }
    );
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const ok = data.status === "success" || Array.isArray(data.data) || data.status === 200;
    if (!ok) throw new Error("Invalid response");
    failureCount.set(entry.userId, 0);
    return true;
  } catch (e) {
    const prev = failureCount.get(entry.userId) || 0;
    failureCount.set(entry.userId, prev + 1);
    return false;
  }
}

export async function runKeepAlive() {
  const tokens = getAllTokens();
  if (tokens.length === 0) return;
  let alive = 0, dead = 0;
  await Promise.allSettled(tokens.map(async (entry) => {
    if (entry.source === "manual") { await pingToken(entry); alive++; return; }
    const ok = await pingToken(entry);
    if (ok) { alive++; }
    else {
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
      }
    }
  }));
  console.log(`[KeepAlive] ✅ ${alive} alive, ❌ ${dead} removed`);
}

// ✅ Vercel-safe: setInterval sirf local/long-running server pe kaam karta hai
// Vercel pe har request naya instance hai, isliye ye local only hai
export function startKeepAlive() {
  if (process.env.VERCEL) return; // Vercel pe skip — serverless mein kaam nahi karta
  console.log(`🔄 Token KeepAlive started — ping every ${PING_INTERVAL_MS / 60000} min`);
  setTimeout(() => {
    runKeepAlive();
    setInterval(runKeepAlive, PING_INTERVAL_MS);
  }, 2 * 60 * 1000);
}

export function getTokenHealth() {
  return getAllTokens().map((t) => ({
    userId: t.userId, name: t.name || "",
    source: t.source,
    failures: failureCount.get(t.userId) || 0,
    status: (failureCount.get(t.userId) || 0) === 0 ? "healthy" : "warning",
  }));
}
