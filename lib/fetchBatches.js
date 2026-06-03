// lib/fetchBatches.js — v11 (native fetch, no node-fetch)

import { BASE_URL, makeHeaders, LOGIN_HEADERS, LOGIN_HEADERS_WEB } from "./config.js";

export async function loginWithCredentials(mobile, password) {
  const loginUrl = `${BASE_URL}/post/userLogin`;

  try {
    const body = new URLSearchParams({ email: mobile, password });
    const resp = await fetch(loginUrl, {
      method: "POST",
      headers: LOGIN_HEADERS,
      body: body.toString(),
      signal: AbortSignal.timeout(12000),
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data.status === 200 && data.data?.token) {
        return { userId: String(data.data.userid), token: String(data.data.token) };
      }
      if (data.status !== 203) {
        throw new Error(data.message || `Login failed (status ${data.status})`);
      }
    }
  } catch (e) {
    if (!e.message?.includes("203")) throw e;
  }

  const body2 = new URLSearchParams({
    source: "website", phone: mobile, email: mobile, password, extra_details: "1",
  });
  const resp2 = await fetch(`${loginUrl}?extra_details=0`, {
    method: "POST",
    headers: LOGIN_HEADERS_WEB,
    body: body2.toString(),
    signal: AbortSignal.timeout(12000),
  });
  if (!resp2.ok) throw new Error("Login server unreachable");
  const data2 = await resp2.json();
  if (data2.status === 200 && data2.data?.token) {
    return { userId: String(data2.data.userid), token: String(data2.data.token) };
  }
  throw new Error(data2.message || "Invalid credentials");
}

export function extractUserIdFromToken(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString("utf-8"));
    return String(payload.userid || payload.user_id || payload.sub || "");
  } catch { return ""; }
}

export async function fetchUserBatches(userId, token) {
  const headers = makeHeaders(token, userId);
  const batchMap = new Map();

  try {
    const resp = await fetch(
      `${BASE_URL}/get/get_all_purchases?userid=${userId}`,
      { headers, signal: AbortSignal.timeout(12000) }
    );
    if (resp.ok) {
      const data = await resp.json();
      for (const item of data.data || []) {
        if (item.itemtype === "Course" && item.coursedt?.[0]) {
          const c = item.coursedt[0];
          const id = String(c.id);
          if (!batchMap.has(id)) {
            batchMap.set(id, {
              id, name: c.course_name || "Unknown",
              thumbnail: c.course_thumbnail || "",
              expiry: item.enddatetime || "", type: "course",
            });
          }
        }
      }
    }
  } catch (_) {}

  if (batchMap.size === 0) {
    try {
      const resp = await fetch(
        `${BASE_URL}/get/mycourseweb?userid=${userId}`,
        { headers, signal: AbortSignal.timeout(10000) }
      );
      if (resp.ok) {
        const data = await resp.json();
        for (const c of data.data || []) {
          const id = String(c.id);
          if (!batchMap.has(id)) {
            batchMap.set(id, {
              id, name: c.course_name || "Unknown",
              thumbnail: c.course_thumbnail || "",
              expiry: c.expiryDate || "", type: "course",
            });
          }
        }
      }
    } catch (_) {}
  }

  return Array.from(batchMap.values());
}

export async function validateToken(userId, token) {
  try {
    const headers = makeHeaders(token, userId);
    const resp = await fetch(
      `${BASE_URL}/get/mycourseweb?userid=${userId}`,
      { headers, signal: AbortSignal.timeout(8000) }
    );
    if (!resp.ok) return false;
    const data = await resp.json();
    return data.status === "success" || Array.isArray(data.data);
  } catch { return false; }
}
