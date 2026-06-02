// lib/tokenStore.js
// In-memory pool — survives as long as server is running
// On Vercel (serverless), use an external DB like Upstash Redis for persistence

const pool = new Map(); // userId => { userId, token, name, batches, addedAt, source }

export function addToken(userId, token, name = "", batches = [], source = "api") {
  pool.set(String(userId), {
    userId: String(userId),
    token: String(token),
    name: name || "",
    batches: batches || [],   // array of { id, name, thumbnail, expiry }
    batchIds: (batches || []).map((b) => String(b.id)),
    addedAt: new Date().toISOString(),
    source, // "login" | "telegram" | "api"
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

export function updateBatches(userId, batches) {
  const entry = pool.get(String(userId));
  if (entry) {
    entry.batches = batches;
    entry.batchIds = batches.map((b) => String(b.id));
    pool.set(String(userId), entry);
  }
}

export function clearPool() {
  const count = pool.size;
  pool.clear();
  return count;
}

// Get any token (random) — used as fallback
export function getAnyToken() {
  const all = Array.from(pool.values());
  if (!all.length) return null;
  return all[Math.floor(Math.random() * all.length)];
}

// Get best token that owns a specific batch
export function getTokenForBatch(batchId) {
  for (const entry of pool.values()) {
    if (entry.batchIds.includes(String(batchId))) return entry;
  }
  return getAnyToken(); // fallback
}
