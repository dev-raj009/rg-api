// server.js — RG-MAXX API v5
// ✅ 24/7 Token KeepAlive — har 25 min silent ping
// ✅ ID+Password login
// ✅ Batches as cards with thumbnails (live fetch from API)
// ✅ Premium dark UI — God-level design
// ✅ No duplicate batches
// ✅ Telegram: userId + token logs, /disconnect support

import "dotenv/config";
import express from "express";
import fetch from "node-fetch";
import { BASE_URL, BASE_HEADERS, makeHeaders, decrypt } from "./lib/config.js";
import {
  addToken, removeToken, getAllTokens,
  getTokenCount, getToken, getAnyToken,
  getTokenForBatch, clearPool, updateBatches,
} from "./lib/tokenStore.js";
import { smartFetch } from "./lib/smartFetch.js";
import { fetchUserBatches, loginWithCredentials } from "./lib/fetchBatches.js";
import {
  sendLog, buildLoginLog,
  processTelegramUpdate, setWebhook,
} from "./lib/telegram.js";
import { startKeepAlive, getTokenHealth } from "./lib/tokenKeepAlive.js";
import { MANUAL_USERS } from "./users.js";

const app = express();
app.use(express.json());

// ── CORS ─────────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// ══════════════════════════════════════════════════════════════════════════════
// BOOT
// ══════════════════════════════════════════════════════════════════════════════
async function loadManualUsers() {
  console.log(`\n📋 Loading ${MANUAL_USERS.length} users from users.js...`);
  let loaded = 0;
  for (const u of MANUAL_USERS) {
    if (!u.userId || !u.token) continue;
    if (u.token.startsWith("TOKEN_") && u.token.endsWith("_YAHAN_PASTE_KARO")) continue;
    try {
      const batches = await fetchUserBatches(u.userId, u.token);
      addToken(u.userId, u.token, u.name || "", batches, "manual");
      console.log(`  ✅ ${u.name || u.userId} — ${batches.length} batches`);
      loaded++;
    } catch (err) {
      console.log(`  ❌ ${u.userId} — ${err.message}`);
    }
  }
  console.log(`✅ ${loaded}/${MANUAL_USERS.length} loaded\n`);
}

// ══════════════════════════════════════════════════════════════════════════════
// HOME — GOD-LEVEL DARK UI
// ══════════════════════════════════════════════════════════════════════════════
app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>RG-MAXX API v5</title>
<style>
:root{
  --bg:#06090f;
  --bg2:#0a0f1a;
  --surface:#0d1424;
  --border:#1a2540;
  --border2:#243050;
  --accent:#7c6fff;
  --accent2:#00d4ff;
  --accent3:#ff6b9d;
  --green:#00e676;
  --red:#ff5252;
  --yellow:#ffd740;
  --text:#e8edf5;
  --muted:#5a6a8a;
  --card:#0f1826;
  --card2:#111e30;
  --glow:rgba(124,111,255,0.15);
}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{
  font-family:'Segoe UI',system-ui,sans-serif;
  background:var(--bg);
  color:var(--text);
  min-height:100vh;
  overflow-x:hidden;
}

/* ── SCROLLBAR ── */
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-track{background:var(--bg)}
::-webkit-scrollbar-thumb{background:var(--border2);border-radius:10px}

/* ── NAV ── */
.nav{
  background:rgba(10,15,26,0.92);
  backdrop-filter:blur(20px);
  border-bottom:1px solid var(--border);
  padding:0 32px;
  height:60px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  position:sticky;top:0;z-index:200;
}
.brand{display:flex;align-items:center;gap:12px}
.brand-icon{
  width:34px;height:34px;
  background:linear-gradient(135deg,var(--accent),var(--accent2));
  border-radius:10px;
  display:flex;align-items:center;justify-content:center;
  font-size:1rem;font-weight:900;color:#fff;
  box-shadow:0 0 16px rgba(124,111,255,0.4);
}
.brand-name{font-size:1.1rem;font-weight:800;color:var(--text)}
.brand-name span{
  background:linear-gradient(90deg,var(--accent),var(--accent2));
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;
}
.v-badge{
  background:linear-gradient(135deg,var(--accent),var(--accent2));
  color:#fff;font-size:.6rem;padding:2px 7px;
  border-radius:20px;font-weight:800;letter-spacing:.5px;
  margin-left:4px;
}
.nav-right{display:flex;align-items:center;gap:12px}
.pill{
  display:flex;align-items:center;gap:6px;
  background:var(--surface);border:1px solid var(--border);
  padding:5px 12px;border-radius:20px;font-size:.75rem;color:var(--muted);
}
.dot{
  width:7px;height:7px;border-radius:50%;
  background:var(--green);
  box-shadow:0 0 6px var(--green);
  animation:blink 2s infinite;
}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}

/* ── HERO ── */
.hero{
  padding:70px 32px 50px;
  text-align:center;
  position:relative;
  overflow:hidden;
}
.hero::before{
  content:'';position:absolute;
  top:-100px;left:50%;transform:translateX(-50%);
  width:700px;height:400px;
  background:radial-gradient(ellipse,rgba(124,111,255,.1) 0,transparent 70%);
  pointer-events:none;
}
.hero-tag{
  display:inline-flex;align-items:center;gap:6px;
  background:rgba(124,111,255,.1);border:1px solid rgba(124,111,255,.3);
  padding:4px 14px;border-radius:20px;
  font-size:.7rem;font-weight:700;color:var(--accent);
  letter-spacing:1px;text-transform:uppercase;
  margin-bottom:20px;
}
.hero h1{
  font-size:3rem;font-weight:900;line-height:1.1;
  background:linear-gradient(135deg,#fff 20%,var(--accent2) 60%,var(--accent));
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;
  margin-bottom:12px;
}
.hero p{color:var(--muted);font-size:.95rem;max-width:480px;margin:0 auto 36px;line-height:1.7}

/* ── STATS ── */
.stats{
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(150px,1fr));
  gap:14px;
  max-width:900px;margin:0 auto;
  padding:0 32px 50px;
}
.stat{
  background:var(--card);
  border:1px solid var(--border);
  border-radius:14px;
  padding:18px 16px;
  text-align:center;
  position:relative;overflow:hidden;
  transition:border-color .2s,transform .2s;
}
.stat:hover{border-color:var(--accent);transform:translateY(-2px)}
.stat::after{
  content:'';position:absolute;
  top:0;left:0;right:0;height:2px;
  background:linear-gradient(90deg,var(--accent),var(--accent2));
  opacity:0;transition:opacity .2s;
}
.stat:hover::after{opacity:1}
.stat-val{
  font-size:2rem;font-weight:900;
  background:linear-gradient(135deg,var(--accent),var(--accent2));
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;
  line-height:1;margin-bottom:6px;
}
.stat-lbl{font-size:.7rem;color:var(--muted);text-transform:uppercase;letter-spacing:.8px}

/* ── MAIN ── */
.main{max-width:1200px;margin:0 auto;padding:0 32px 80px}

/* ── TABS ── */
.tabs{
  display:flex;gap:4px;
  background:var(--surface);border:1px solid var(--border);
  border-radius:12px;padding:5px;
  margin-bottom:30px;overflow-x:auto;
}
.tab{
  flex:1;min-width:fit-content;
  padding:8px 18px;border-radius:8px;
  font-size:.82rem;font-weight:600;color:var(--muted);
  cursor:pointer;border:none;background:transparent;
  transition:all .2s;white-space:nowrap;
}
.tab.active{
  background:linear-gradient(135deg,var(--accent),var(--accent2));
  color:#fff;box-shadow:0 4px 14px rgba(124,111,255,.3);
}
.tab:hover:not(.active){color:var(--text);background:var(--border)}

/* ── TAB PANELS ── */
.panel{display:none}
.panel.active{display:block}

/* ── SECTION TITLE ── */
.section-title{
  font-size:.65rem;font-weight:800;letter-spacing:2.5px;
  text-transform:uppercase;color:var(--accent);
  margin:30px 0 14px;
  display:flex;align-items:center;gap:10px;
}
.section-title::after{content:'';flex:1;height:1px;background:var(--border)}

/* ── BATCH GRID ── */
.batch-grid{
  display:grid;
  grid-template-columns:repeat(auto-fill,minmax(220px,1fr));
  gap:16px;
  margin-bottom:30px;
}
.batch-card{
  background:var(--card);
  border:1px solid var(--border);
  border-radius:14px;
  overflow:hidden;
  transition:all .25s;
  cursor:default;
}
.batch-card:hover{
  border-color:var(--accent);
  transform:translateY(-3px);
  box-shadow:0 8px 30px rgba(124,111,255,.15);
}
.batch-thumb{
  width:100%;height:130px;
  object-fit:cover;
  background:linear-gradient(135deg,var(--surface),var(--border));
  display:block;
}
.batch-thumb-placeholder{
  width:100%;height:130px;
  background:linear-gradient(135deg,#1a2540,#0d1424);
  display:flex;align-items:center;justify-content:center;
  font-size:2.5rem;
}
.batch-info{padding:12px 14px 14px}
.batch-id{
  font-size:.65rem;font-weight:700;
  color:var(--accent2);letter-spacing:.5px;
  text-transform:uppercase;margin-bottom:5px;
}
.batch-name{
  font-size:.85rem;font-weight:600;
  color:var(--text);line-height:1.35;
  display:-webkit-box;-webkit-line-clamp:2;
  -webkit-box-orient:vertical;overflow:hidden;
  margin-bottom:8px;
}
.batch-expiry{
  font-size:.7rem;color:var(--muted);
  display:flex;align-items:center;gap:4px;
}
.batch-expiry .exp-dot{
  width:5px;height:5px;border-radius:50%;
  background:var(--green);flex-shrink:0;
}

/* ── USER CARDS ── */
.user-grid{
  display:grid;
  grid-template-columns:repeat(auto-fill,minmax(280px,1fr));
  gap:14px;
  margin-bottom:20px;
}
.user-card{
  background:var(--card);border:1px solid var(--border);
  border-radius:14px;padding:16px 18px;
  transition:all .2s;
}
.user-card:hover{border-color:var(--accent);transform:translateY(-2px)}
.user-top{display:flex;align-items:center;gap:12px;margin-bottom:12px}
.user-avatar{
  width:40px;height:40px;border-radius:12px;
  background:linear-gradient(135deg,var(--accent),var(--accent2));
  display:flex;align-items:center;justify-content:center;
  font-size:1.1rem;font-weight:800;color:#fff;flex-shrink:0;
  box-shadow:0 4px 12px rgba(124,111,255,.3);
}
.user-name{font-size:.9rem;font-weight:700;color:var(--text);margin-bottom:3px}
.user-id{font-size:.72rem;color:var(--muted);font-family:monospace}
.source-tag{
  display:inline-block;
  padding:2px 8px;border-radius:6px;font-size:.65rem;font-weight:700;
  letter-spacing:.5px;text-transform:uppercase;margin-left:auto;flex-shrink:0;
}
.src-manual{background:rgba(0,230,118,.1);color:var(--green);border:1px solid rgba(0,230,118,.2)}
.src-telegram{background:rgba(0,212,255,.1);color:var(--accent2);border:1px solid rgba(0,212,255,.2)}
.src-login{background:rgba(124,111,255,.1);color:var(--accent);border:1px solid rgba(124,111,255,.2)}
.src-api{background:rgba(255,107,157,.1);color:var(--accent3);border:1px solid rgba(255,107,157,.2)}
.src-bulk{background:rgba(255,215,64,.1);color:var(--yellow);border:1px solid rgba(255,215,64,.2)}
.user-stat{font-size:.72rem;color:var(--muted)}
.user-stat strong{color:var(--accent2)}
.health-bar{
  height:3px;border-radius:3px;margin-top:10px;
  background:var(--border);overflow:hidden;
}
.health-bar-fill{height:100%;border-radius:3px;background:var(--green);transition:width .5s}

/* ── API CARDS ── */
.api-card{
  background:var(--card);border:1px solid var(--border);
  border-radius:12px;padding:14px 18px;margin-bottom:10px;
  transition:all .2s;
}
.api-card:hover{border-color:var(--accent);transform:translateX(3px)}
.api-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.method{
  display:inline-block;padding:3px 10px;border-radius:6px;
  font-size:.65rem;font-weight:900;letter-spacing:.8px;flex-shrink:0;
}
.GET{background:rgba(0,212,255,.1);color:var(--accent2);border:1px solid rgba(0,212,255,.25)}
.POST{background:rgba(0,230,118,.1);color:var(--green);border:1px solid rgba(0,230,118,.25)}
.endpoint{
  font-family:monospace;font-size:.82rem;
  color:#a78bfa;word-break:break-all;
}
.api-desc{color:var(--muted);font-size:.8rem;margin-top:6px;line-height:1.5}
.api-params{font-size:.75rem;color:var(--yellow);margin-top:4px}
.new-badge{
  background:linear-gradient(135deg,var(--accent),var(--accent2));
  color:#fff;font-size:.6rem;padding:2px 7px;
  border-radius:10px;font-weight:800;margin-left:auto;flex-shrink:0;
}

/* ── INFO BOX ── */
.info-box{
  background:linear-gradient(135deg,rgba(124,111,255,.07),rgba(0,212,255,.05));
  border:1px solid rgba(124,111,255,.2);
  border-radius:14px;padding:18px 22px;margin-bottom:20px;
}
.info-box h3{color:var(--accent2);font-size:.85rem;margin-bottom:10px}
pre{
  background:var(--bg);border:1px solid var(--border);
  border-radius:8px;padding:12px 16px;
  font-size:.75rem;overflow-x:auto;
  color:#94a3b8;font-family:'Consolas',monospace;
  margin-top:10px;line-height:1.6;
}
code{
  background:rgba(124,111,255,.12);color:#c4b5fd;
  padding:2px 7px;border-radius:5px;
  font-size:.8rem;font-family:'Consolas',monospace;
}

/* ── LOADING ── */
.loader{
  display:flex;align-items:center;justify-content:center;
  padding:40px;color:var(--muted);font-size:.85rem;gap:10px;
}
.spin{
  width:18px;height:18px;border-radius:50%;
  border:2px solid var(--border);
  border-top-color:var(--accent);
  animation:spin .8s linear infinite;
}
@keyframes spin{to{transform:rotate(360deg)}}

/* ── EMPTY ── */
.empty{
  text-align:center;padding:60px 20px;color:var(--muted);
}
.empty-icon{font-size:3rem;margin-bottom:12px;opacity:.5}

/* ── FOOTER ── */
footer{
  text-align:center;padding:30px;color:var(--muted);
  font-size:.75rem;border-top:1px solid var(--border);
}

@media(max-width:640px){
  .nav{padding:0 16px}
  .hero{padding:50px 16px 30px}
  .hero h1{font-size:2.2rem}
  .main{padding:0 16px 60px}
  .stats{padding:0 16px 30px;gap:10px}
  .batch-grid{grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px}
  .tabs{padding:4px}
  .tab{padding:6px 12px;font-size:.75rem}
}
</style>
</head>
<body>

<!-- NAV -->
<nav class="nav">
  <div class="brand">
    <div class="brand-icon">R</div>
    <div>
      <div class="brand-name"><span>RG-MAXX</span> API <span class="v-badge">v5</span></div>
    </div>
  </div>
  <div class="nav-right">
    <div class="pill"><div class="dot"></div> <span id="nav-tc">...</span> tokens</div>
    <div class="pill" style="color:var(--green);font-size:.7rem;font-weight:700;">24/7 LIVE</div>
  </div>
</nav>

<!-- HERO -->
<section class="hero">
  <div class="hero-tag">⚡ RG Vikramjeet Course Proxy</div>
  <h1>RG-MAXX API v5</h1>
  <p>ID/Password Login · Token Pool · 24/7 KeepAlive · Telegram Bot · Premium Dashboard</p>
</section>

<!-- STATS -->
<div class="stats" id="stats-row">
  <div class="stat"><div class="stat-val" id="s-total">—</div><div class="stat-lbl">Total Tokens</div></div>
  <div class="stat"><div class="stat-val" id="s-manual">—</div><div class="stat-lbl">Manual</div></div>
  <div class="stat"><div class="stat-val" id="s-dynamic">—</div><div class="stat-lbl">Dynamic</div></div>
  <div class="stat"><div class="stat-val" id="s-batches">—</div><div class="stat-lbl">Total Batches</div></div>
  <div class="stat"><div class="stat-val" id="s-bot" style="font-size:1.4rem">—</div><div class="stat-lbl">Telegram Bot</div></div>
</div>

<!-- MAIN -->
<div class="main">

  <!-- TABS -->
  <div class="tabs" id="tabs">
    <button class="tab active" onclick="switchTab('batches',this)">📚 All Batches</button>
    <button class="tab" onclick="switchTab('users',this)">👥 Users Pool</button>
    <button class="tab" onclick="switchTab('health',this)">💓 Health</button>
    <button class="tab" onclick="switchTab('api',this)">📖 API Docs</button>
  </div>

  <!-- BATCHES PANEL -->
  <div class="panel active" id="panel-batches">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
      <div class="section-title" style="margin:0;flex:1">All Purchased Batches</div>
      <button onclick="loadBatches()" style="background:var(--surface);border:1px solid var(--border);color:var(--text);padding:6px 14px;border-radius:8px;cursor:pointer;font-size:.75rem;margin-left:16px">↻ Refresh</button>
    </div>
    <div id="batches-container">
      <div class="loader"><div class="spin"></div> Loading batches...</div>
    </div>
  </div>

  <!-- USERS PANEL -->
  <div class="panel" id="panel-users">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
      <div class="section-title" style="margin:0;flex:1">Token Pool</div>
      <button onclick="loadUsers()" style="background:var(--surface);border:1px solid var(--border);color:var(--text);padding:6px 14px;border-radius:8px;cursor:pointer;font-size:.75rem;margin-left:16px">↻ Refresh</button>
    </div>
    <div id="users-container">
      <div class="loader"><div class="spin"></div> Loading users...</div>
    </div>
  </div>

  <!-- HEALTH PANEL -->
  <div class="panel" id="panel-health">
    <div class="info-box" style="background:rgba(0,230,118,.04);border-color:rgba(0,230,118,.2)">
      <h3>💓 24/7 Token KeepAlive System</h3>
      <div style="font-size:.82rem;color:var(--muted);line-height:1.8">
        Server har <strong style="color:var(--green)">25 minute</strong> pe silently sab tokens ko ping karta hai.<br>
        Agar koi token <strong style="color:var(--red)">3 baar fail</strong> ho jaye to automatically pool se remove hota hai + Telegram alert aata hai.<br>
        Manual users (users.js) kabhi remove nahi hote — sirf ping hote hain.
      </div>
    </div>
    <div class="section-title">Token Health Status</div>
    <div id="health-container">
      <div class="loader"><div class="spin"></div> Loading health data...</div>
    </div>
  </div>

  <!-- API PANEL -->
  <div class="panel" id="panel-api">

    <div class="info-box">
      <h3>🆕 v5 — ID+Password Login</h3>
      <pre>// Option A — Mobile+Password
POST /api/login
{ "mobile": "9876543210", "password": "yourpass" }

// Option B — Direct Token
POST /api/login
{ "userId": "123456", "token": "eyJ..." }

// Telegram Bot
/login 9876543210 yourpassword
/add 123456 eyJ0eXAi...</pre>
    </div>

    <div class="section-title">🔐 Authentication</div>
    <div class="api-card">
      <div class="api-top">
        <span class="method POST">POST</span>
        <span class="endpoint">/api/login</span>
        <span class="new-badge">v5</span>
      </div>
      <div class="api-desc">ID+Password ya Token se login. Batches auto-fetch (ek baar), pool mein add, Telegram log.</div>
    </div>
    <div class="api-card">
      <div class="api-top"><span class="method GET">GET</span><span class="endpoint">/api/add-token?userid=123&token=eyJ...</span></div>
      <div class="api-desc">URL se token add karo</div>
    </div>
    <div class="api-card">
      <div class="api-top"><span class="method POST">POST</span><span class="endpoint">/api/bulk-login</span></div>
      <div class="api-desc">Array of <code>{userId, token}</code> — bulk add</div>
    </div>

    <div class="section-title">👥 Pool Management</div>
    <div class="api-card">
      <div class="api-top"><span class="method GET">GET</span><span class="endpoint">/api/users</span></div>
      <div class="api-desc">All users list with source, batches, health</div>
    </div>
    <div class="api-card">
      <div class="api-top"><span class="method GET">GET</span><span class="endpoint">/api/pool</span></div>
    </div>
    <div class="api-card">
      <div class="api-top"><span class="method GET">GET</span><span class="endpoint">/api/health</span></div>
      <div class="api-desc">Token health status (ping failures)</div>
    </div>
    <div class="api-card">
      <div class="api-top"><span class="method GET">GET</span><span class="endpoint">/api/remove-token?userid=123</span></div>
    </div>
    <div class="api-card">
      <div class="api-top"><span class="method GET">GET</span><span class="endpoint">/api/reload-users?secret=...</span></div>
      <div class="api-desc">users.js reload (no restart)</div>
    </div>
    <div class="api-card">
      <div class="api-top"><span class="method GET">GET</span><span class="endpoint">/api/clear-pool?secret=...</span></div>
    </div>

    <div class="section-title">📚 Courses & Content</div>
    <div class="api-card">
      <div class="api-top"><span class="method GET">GET</span><span class="endpoint">/api/all-batches</span></div>
      <div class="api-desc">All unique batches combined (no duplicates)</div>
    </div>
    <div class="api-card">
      <div class="api-top"><span class="method GET">GET</span><span class="endpoint">/api/my-courses?userid=123</span></div>
    </div>
    <div class="api-card">
      <div class="api-top"><span class="method GET">GET</span><span class="endpoint">/api/subjects?courseid=257</span></div>
    </div>
    <div class="api-card">
      <div class="api-top"><span class="method GET">GET</span><span class="endpoint">/api/topics?courseid=257&subjectid=1</span></div>
    </div>
    <div class="api-card">
      <div class="api-top"><span class="method GET">GET</span><span class="endpoint">/api/concepts?courseid=257&subjectid=1&topicid=1</span></div>
    </div>
    <div class="api-card">
      <div class="api-top"><span class="method GET">GET</span><span class="endpoint">/api/videos?courseid=257&subjectid=1&topicid=1&conceptid=1</span></div>
    </div>
    <div class="api-card">
      <div class="api-top"><span class="method GET">GET</span><span class="endpoint">/api/video-details?course_id=257&video_id=12345</span></div>
      <div class="api-desc">Decrypted stream URLs</div>
    </div>

    <div class="section-title">🧪 Tests</div>
    <div class="api-card">
      <div class="api-top"><span class="method GET">GET</span><span class="endpoint">/api/tests?testseriesid=100</span></div>
    </div>
    <div class="api-card">
      <div class="api-top"><span class="method GET">GET</span><span class="endpoint">/api/questions?url=https://...</span></div>
    </div>

    <div class="section-title">🤖 Telegram Bot</div>
    <div class="info-box" style="background:rgba(0,212,255,.04);border-color:rgba(0,212,255,.2)">
      <h3>Bot Commands</h3>
      <pre>/start              — Help
/login MOBILE PASS  — ID+Password login
/add USER_ID TOKEN  — Token add
/remove USER_ID     — Token remove
/disconnect         — Telegram tokens saare hatao
/status             — Pool status</pre>
    </div>
    <div class="api-card">
      <div class="api-top"><span class="method GET">GET</span><span class="endpoint">/api/set-webhook</span></div>
      <div class="api-desc">One-time setup: webhook register karo</div>
    </div>

  </div><!-- /panel-api -->

</div><!-- /main -->

<footer>RG-MAXX API v5 &nbsp;•&nbsp; 24/7 KeepAlive &nbsp;•&nbsp; RG Vikramjeet Platform</footer>

<script>
// ── TAB SWITCH ──────────────────────────────────────────────────────────────
function switchTab(name, btn) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('panel-' + name).classList.add('active');
  btn.classList.add('active');
  if (name === 'batches') loadBatches();
  if (name === 'users') loadUsers();
  if (name === 'health') loadHealth();
}

// ── INIT STATS ───────────────────────────────────────────────────────────────
async function initStats() {
  try {
    const [st, us] = await Promise.all([
      fetch('/api/status').then(r=>r.json()),
      fetch('/api/users').then(r=>r.json())
    ]);
    document.getElementById('nav-tc').textContent = st.tokens || 0;
    document.getElementById('s-total').textContent = st.tokens || 0;
    document.getElementById('s-manual').textContent = us.manual || 0;
    document.getElementById('s-dynamic').textContent = us.dynamic || 0;
    document.getElementById('s-bot').textContent = st.telegram_bot ? '✅' : '❌';
  } catch(e) {}
}

// ── LOAD BATCHES ─────────────────────────────────────────────────────────────
async function loadBatches() {
  const el = document.getElementById('batches-container');
  el.innerHTML = '<div class="loader"><div class="spin"></div> Fetching batches from all tokens...</div>';
  try {
    const data = await fetch('/api/all-batches').then(r=>r.json());
    document.getElementById('s-batches').textContent = data.total || 0;
    if (!data.data || data.data.length === 0) {
      el.innerHTML = '<div class="empty"><div class="empty-icon">📭</div><div>No batches found. Login karo ya users.js mein token add karo.</div></div>';
      return;
    }
    el.innerHTML = '<div class="batch-grid">' +
      data.data.map(b => batchCard(b)).join('') +
    '</div>';
  } catch(e) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">⚠️</div><div>Error loading batches. Server check karo.</div></div>';
  }
}

function batchCard(b) {
  const thumb = b.thumbnail
    ? \`<img class="batch-thumb" src="\${b.thumbnail}" alt="\${b.name}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">\`
    : '';
  const placeholder = \`<div class="batch-thumb-placeholder" \${b.thumbnail ? 'style="display:none"' : ''}>📚</div>\`;
  const expiry = b.expiry
    ? \`<div class="batch-expiry"><div class="exp-dot"></div> \${new Date(b.expiry).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) || b.expiry}</div>\`
    : '';
  return \`
    <div class="batch-card">
      \${thumb}\${placeholder}
      <div class="batch-info">
        <div class="batch-id">ID: \${b.id}</div>
        <div class="batch-name">\${b.name || 'Unknown Batch'}</div>
        \${expiry}
      </div>
    </div>\`;
}

// ── LOAD USERS ───────────────────────────────────────────────────────────────
async function loadUsers() {
  const el = document.getElementById('users-container');
  el.innerHTML = '<div class="loader"><div class="spin"></div> Loading users...</div>';
  try {
    const data = await fetch('/api/users').then(r=>r.json());
    if (!data.users || data.users.length === 0) {
      el.innerHTML = '<div class="empty"><div class="empty-icon">👥</div><div>No users in pool. Login karo.</div></div>';
      return;
    }
    const srcClass = {manual:'src-manual',telegram:'src-telegram',login:'src-login',api:'src-api',bulk:'src-bulk'};
    el.innerHTML = '<div class="user-grid">' +
      data.users.map(u => {
        const avatar = (u.name || u.userId || '?')[0].toUpperCase();
        const cls = srcClass[u.source] || 'src-api';
        const addedDate = u.addedAt ? new Date(u.addedAt).toLocaleDateString('en-IN') : '—';
        return \`
          <div class="user-card">
            <div class="user-top">
              <div class="user-avatar">\${avatar}</div>
              <div>
                <div class="user-name">\${u.name || 'User ' + u.userId}</div>
                <div class="user-id">\${u.userId}</div>
              </div>
              <span class="source-tag \${cls}">\${u.source || 'api'}</span>
            </div>
            <div class="user-stat">📚 <strong>\${u.batchCount}</strong> batches &nbsp;|&nbsp; Added: \${addedDate}</div>
            <div class="user-stat" style="margin-top:4px;font-size:.65rem;word-break:break-all;color:#374151">🔑 \${u.tokenPreview}</div>
            <div class="health-bar"><div class="health-bar-fill" style="width:100%"></div></div>
          </div>\`;
      }).join('') +
    '</div>';
  } catch(e) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">⚠️</div><div>Error loading users.</div></div>';
  }
}

// ── LOAD HEALTH ──────────────────────────────────────────────────────────────
async function loadHealth() {
  const el = document.getElementById('health-container');
  el.innerHTML = '<div class="loader"><div class="spin"></div> Loading health...</div>';
  try {
    const data = await fetch('/api/health').then(r=>r.json());
    if (!data.health || data.health.length === 0) {
      el.innerHTML = '<div class="empty"><div class="empty-icon">💓</div><div>No tokens in pool.</div></div>';
      return;
    }
    el.innerHTML = '<div class="user-grid">' +
      data.health.map(h => {
        const color = h.failures === 0 ? 'var(--green)' : h.failures < 3 ? 'var(--yellow)' : 'var(--red)';
        const fillW = Math.max(0, 100 - h.failures * 33);
        const statusIcon = h.failures === 0 ? '🟢' : h.failures < 3 ? '🟡' : '🔴';
        return \`
          <div class="user-card">
            <div class="user-top">
              <div class="user-avatar" style="background:linear-gradient(135deg,\${color},\${color}88)">\${statusIcon}</div>
              <div>
                <div class="user-name">\${h.name || 'User ' + h.userId}</div>
                <div class="user-id">\${h.userId}</div>
              </div>
              <span class="source-tag src-manual" style="color:\${color};border-color:\${color}33">\${h.status}</span>
            </div>
            <div class="user-stat">❌ Failures: <strong style="color:\${color}">\${h.failures}/3</strong> &nbsp;|&nbsp; Source: \${h.source}</div>
            <div class="health-bar" style="margin-top:10px">
              <div class="health-bar-fill" style="width:\${fillW}%;background:\${color}"></div>
            </div>
          </div>\`;
      }).join('') +
    '</div>';
  } catch(e) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">⚠️</div><div>Error loading health data.</div></div>';
  }
}

// ── BOOT ─────────────────────────────────────────────────────────────────────
initStats();
loadBatches();
// Auto-refresh stats every 60s
setInterval(initStats, 60000);
</script>
</body>
</html>`);
});

// ══════════════════════════════════════════════════════════════════════════════
// STATUS
// ══════════════════════════════════════════════════════════════════════════════
app.get("/api/status", (req, res) => {
  res.json({
    status: "RG-MAXX API v5 Online",
    version: "v5",
    tokens: getTokenCount(),
    manual_users_defined: MANUAL_USERS.filter(
      (u) => u.token && !u.token.startsWith("TOKEN_")
    ).length,
    telegram_bot: !!process.env.TELEGRAM_BOT_TOKEN,
    telegram_channel: !!process.env.TELEGRAM_LOG_CHANNEL_ID,
    keepalive: "active",
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// HEALTH
// ══════════════════════════════════════════════════════════════════════════════
app.get("/api/health", (req, res) => {
  const health = getTokenHealth();
  const healthy = health.filter((h) => h.failures === 0).length;
  res.json({
    total: health.length,
    healthy,
    warning: health.filter((h) => h.failures > 0 && h.failures < 3).length,
    dead: health.filter((h) => h.failures >= 3).length,
    health,
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// USERS
// ══════════════════════════════════════════════════════════════════════════════
app.get("/api/users", (req, res) => {
  const users = getAllTokens().map((t) => ({
    userId: t.userId,
    name: t.name || "",
    source: t.source || "unknown",
    batchCount: t.batches.length,
    batches: t.batches.map((b) => ({ id: b.id, name: b.name, expiry: b.expiry || "" })),
    addedAt: t.addedAt,
    updatedAt: t.updatedAt,
    tokenPreview: t.token.substring(0, 20) + "...",
  }));
  res.json({
    total: users.length,
    manual: users.filter((u) => u.source === "manual").length,
    dynamic: users.filter((u) => u.source !== "manual").length,
    users,
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// RELOAD USERS.JS
// ══════════════════════════════════════════════════════════════════════════════
app.get("/api/reload-users", async (req, res) => {
  const { secret } = req.query;
  if (process.env.ADMIN_SECRET && secret !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ error: "Forbidden" });
  }
  let loaded = 0, skipped = 0;
  const results = [];
  for (const u of MANUAL_USERS) {
    if (!u.userId || !u.token) { skipped++; continue; }
    if (u.token.startsWith("TOKEN_") && u.token.endsWith("_YAHAN_PASTE_KARO")) {
      skipped++;
      results.push({ userId: u.userId, status: "placeholder_skipped" });
      continue;
    }
    try {
      const batches = await fetchUserBatches(u.userId, u.token);
      addToken(u.userId, u.token, u.name || "", batches, "manual");
      loaded++;
      results.push({ userId: u.userId, name: u.name, status: "loaded", batchCount: batches.length });
    } catch (err) {
      skipped++;
      results.push({ userId: u.userId, name: u.name, status: "error", error: err.message });
    }
  }
  res.json({ success: true, loaded, skipped, totalInPool: getTokenCount(), results });
});

// ══════════════════════════════════════════════════════════════════════════════
// LOGIN — v5: ID+Password OR userId+token
// ══════════════════════════════════════════════════════════════════════════════
app.post("/api/login", async (req, res) => {
  try {
    const { userId, token, mobile, password } = req.body || {};
    let finalUserId, finalToken;

    if (mobile && password) {
      try {
        const result = await loginWithCredentials(mobile, password);
        finalUserId = result.userId;
        finalToken = result.token;
      } catch (e) {
        return res.status(401).json({ success: false, error: `Login failed: ${e.message}` });
      }
    } else if (userId && token) {
      finalUserId = String(userId);
      finalToken = String(token);
    } else {
      return res.status(400).json({
        success: false,
        error: "Send { mobile, password } OR { userId, token }",
      });
    }

    const batches = await fetchUserBatches(finalUserId, finalToken);
    addToken(finalUserId, finalToken, "", batches, "login");

    const source = (mobile && password) ? "id_pass" : "website";
    const extra = (mobile && password) ? mobile : "";
    await sendLog(buildLoginLog(finalUserId, finalToken, batches, source, extra));

    res.json({
      success: true,
      userId: finalUserId,
      batchCount: batches.length,
      batches,
      message: "Token added. Content accessible.",
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ADD TOKEN (GET)
// ══════════════════════════════════════════════════════════════════════════════
app.get("/api/add-token", async (req, res) => {
  try {
    const { userid, token, name } = req.query;
    if (!userid || !token) return res.status(400).json({ error: "userid and token required" });
    const batches = await fetchUserBatches(userid, token);
    addToken(userid, token, name || "", batches, "api");
    await sendLog(buildLoginLog(userid, token, batches, "website"));
    res.json({ success: true, userId: userid, batchCount: batches.length, batches });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// BULK LOGIN
// ══════════════════════════════════════════════════════════════════════════════
app.post("/api/bulk-login", async (req, res) => {
  try {
    const users = Array.isArray(req.body) ? req.body : [];
    if (users.length === 0) return res.status(400).json({ error: "Send array: [{userId, token}, ...]" });
    let added = 0;
    for (const u of users) {
      if (!u.userId || !u.token) continue;
      addToken(u.userId, u.token, u.name || "", [], "bulk");
      added++;
    }
    res.json({ success: true, added, total: getTokenCount() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// REMOVE TOKEN
// ══════════════════════════════════════════════════════════════════════════════
app.get("/api/remove-token", (req, res) => {
  const { userid } = req.query;
  if (!userid) return res.status(400).json({ error: "userid required" });
  res.json({ success: removeToken(userid), userId: userid });
});

// ══════════════════════════════════════════════════════════════════════════════
// POOL
// ══════════════════════════════════════════════════════════════════════════════
app.get("/api/pool", (req, res) => {
  const users = getAllTokens().map((t) => ({
    userId: t.userId,
    name: t.name || "",
    source: t.source,
    batchCount: t.batches.length,
    batchNames: t.batches.map((b) => `[${b.id}] ${b.name}`),
    addedAt: t.addedAt,
    tokenPreview: t.token.substring(0, 25) + "...",
  }));
  res.json({ total: users.length, users });
});

// ══════════════════════════════════════════════════════════════════════════════
// CLEAR POOL
// ══════════════════════════════════════════════════════════════════════════════
app.get("/api/clear-pool", (req, res) => {
  const { secret } = req.query;
  if (process.env.ADMIN_SECRET && secret !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ error: "Forbidden" });
  }
  res.json({ success: true, cleared: clearPool() });
});

// ══════════════════════════════════════════════════════════════════════════════
// ALL BATCHES — combined, thumbnail included, no duplicates
// ══════════════════════════════════════════════════════════════════════════════
app.get("/api/all-batches", async (req, res) => {
  try {
    const tokens = getAllTokens();
    if (tokens.length === 0) {
      return res.json({ status: 200, total: 0, data: [], message: "No tokens in pool" });
    }

    const batchMap = new Map();

    await Promise.allSettled(
      tokens.map(async (entry) => {
        try {
          const headers = makeHeaders(entry.token, entry.userId);
          const resp = await fetch(
            `${BASE_URL}/get/get_all_purchases?userid=${entry.userId}`,
            { headers, timeout: 10000 }
          );
          if (!resp.ok) return;
          const data = await resp.json();
          for (const item of data.data || []) {
            if (item.itemtype === "Course" && item.coursedt?.[0]) {
              const c = item.coursedt[0];
              const id = String(c.id);
              if (!batchMap.has(id)) {
                batchMap.set(id, {
                  id,
                  name: c.course_name,
                  thumbnail: c.course_thumbnail || "",
                  expiry: item.enddatetime || "",
                });
              }
            }
          }
        } catch (_) {}
      })
    );

    const masterList = Array.from(batchMap.values());
    res.json({ status: 200, total: masterList.length, data: masterList });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// MY COURSES
// ══════════════════════════════════════════════════════════════════════════════
app.get("/api/my-courses", async (req, res) => {
  try {
    const { userid } = req.query;
    const entry = userid ? getToken(userid) : getAnyToken();
    if (!entry) return res.status(503).json({ error: "No token found" });
    const headers = makeHeaders(entry.token, entry.userId);
    const resp = await fetch(`${BASE_URL}/get/mycourseweb?userid=${entry.userId}`, { headers });
    const data = await resp.json();
    const courses = (data.data || []).map((c) => ({
      id: c.id, name: c.course_name,
      thumbnail: c.course_thumbnail, expiry: c.expiryDate, is_paid: c.is_paid,
    }));
    res.json({ total: courses.length, courses });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// SUBJECTS / TOPICS / CONCEPTS / VIDEOS / VIDEO-DETAILS / TESTS / QUESTIONS
// ══════════════════════════════════════════════════════════════════════════════
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
    const j = await fetch(`${BASE_URL}/get/test_titlev2?testseriesid=${testseriesid}&subject_id=${subject_id||""}&userid=${entry.userId}&start=-1`, {headers}).then(r=>r.json());
    res.json({ total:(j.test_titles||[]).length, tests:(j.test_titles||[]).map(t=>({id:t.id,title:t.title,questions_url:t.test_questions_url})) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/questions", async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: "url required" });
    res.json(await fetch(url).then(r=>r.json()));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════════════════════
// TELEGRAM
// ══════════════════════════════════════════════════════════════════════════════
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

// ══════════════════════════════════════════════════════════════════════════════
// 404
// ══════════════════════════════════════════════════════════════════════════════
app.use((req, res) => {
  res.status(404).json({ error: "Not found. Visit / for dashboard." });
});

// ══════════════════════════════════════════════════════════════════════════════
// START
// ══════════════════════════════════════════════════════════════════════════════
const PORT = process.env.PORT || 3000;

loadManualUsers().then(() => {
  app.listen(PORT, () => {
    console.log(`✅ RG-MAXX API v5 on port ${PORT}`);
    console.log(`📖 Dashboard: http://localhost:${PORT}/`);
    console.log(`🤖 Telegram: ${process.env.TELEGRAM_BOT_TOKEN ? "configured ✅" : "NOT configured ❌"}`);
  });
  // Start 24/7 keepalive AFTER server is up
  startKeepAlive();
});

export default app;
