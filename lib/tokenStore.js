// lib/tokenStore.js — v10
// ✅ Map based — userId key se auto-deduplicate
// ✅ source track: "manual" | "login" | "telegram" | "api" | "bulk"
// ✅ Telegram tokens separate track

const pool = new Map(); // userId => { userId, token, name, batches, batchIds, addedAt, source }

export function addToken(userId, token, name = "", batches = [], source = "api") {
  const uid = String(userId);
  const existing = pool.get(uid);

  const batchMap = new Map();
  for (const b of (batches || [])) {
    batchMap.set(String(b.id), b);
  }
  const dedupedBatches = Array.from(batchMap.values());

  pool.set(uid, {
    userId: uid,
    token: String(token),
    name: name || existing?.name || "",
    batches: dedupedBatches,
    batchIds: dedupedBatches.map((b) => String(b.id)),
    addedAt: existing?.addedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    source,
  });
}

export function removeToken(userId) {
  return pool.delete(String(userId));
}

export function getToken(userId) {
  return pool.get(String(userId));
}

export function getAllTokens() {
  return Array.from(pool.values());
}

export function getTokenCount() {
  return pool.size;
}

export function getTelegramTokens() {
  return Array.from(pool.values()).filter(t => t.source === "telegram");
}

export function getManualTokens() {
  return Array.from(pool.values()).filter(t => t.source === "manual");
}

export function updateBatches(userId, batches) {
  const uid = String(userId);
  const entry = pool.get(uid);
  if (!entry) return;

  const batchMap = new Map();
  for (const b of (batches || [])) {
    batchMap.set(String(b.id), b);
  }
  const dedupedBatches = Array.from(batchMap.values());

  entry.batches = dedupedBatches;
  entry.batchIds = dedupedBatches.map((b) => String(b.id));
  entry.updatedAt = new Date().toISOString();
  pool.set(uid, entry);
}

export function clearPool() {
  const count = pool.size;
  pool.clear();
  return count;
}

export function removeBySource(source) {
  let count = 0;
  for (const [uid, entry] of pool.entries()) {
    if (entry.source === source) {
      pool.delete(uid);
      count++;
    }
  }
  return count;
}

export function getAnyToken() {
  const all = Array.from(pool.values());
  if (!all.length) return null;
  return all[Math.floor(Math.random() * all.length)];
}

export function getTokenForBatch(batchId) {
  const bid = String(batchId);
  for (const entry of pool.values()) {
    if (entry.batchIds.includes(bid)) return entry;
  }
  return getAnyToken();
}
