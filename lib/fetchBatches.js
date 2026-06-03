// lib/fetchBatches.js — v4
// ✅ ID+Password se login support
// ✅ Token se direct bhi kaam karta hai
// ✅ Single fetch — ek baar hi batches milte hain, no duplicates

import fetch from "node-fetch";
import { BASE_URL, makeHeaders, LOGIN_HEADERS, LOGIN_HEADERS_WEB } from "./config.js";

/**
 * Login with mobile/email + password
 * Returns: { userId, token } or throws error
 */
export async function loginWithCredentials(mobile, password) {
  const loginUrl = `${BASE_URL}/post/userLogin`;

  // Method 1: okhttp style (primary)
  try {
    const body = new URLSearchParams({ email: mobile, password });
    const resp = await fetch(loginUrl, {
      method: "POST",
      headers: LOGIN_HEADERS,
      body: body.toString(),
      timeout: 12000,
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data.status === 200 && data.data?.token) {
        return {
          userId: String(data.data.userid),
          token: String(data.data.token),
        };
      }
      // status 203 = try web method
      if (data.status !== 203) {
        throw new Error(data.message || `Login failed (status ${data.status})`);
      }
    }
  } catch (e) {
    if (e.message !== "pass") throw e;
  }

  // Method 2: Web browser style (fallback for 203)
  const body2 = new URLSearchParams({
    source: "website",
    phone: mobile,
    email: mobile,
    password,
    extra_details: "1",
  });
  const resp2 = await fetch(`${loginUrl}?extra_details=0`, {
    method: "POST",
    headers: LOGIN_HEADERS_WEB,
    body: body2.toString(),
    timeout: 12000,
  });
  if (!resp2.ok) throw new Error("Login server unreachable");
  const data2 = await resp2.json();
  if (data2.status === 200 && data2.data?.token) {
    return {
      userId: String(data2.data.userid),
      token: String(data2.data.token),
    };
  }
  throw new Error(data2.message || "Invalid credentials");
}

/**
 * Get userId from token (decode JWT or fallback fetch)
 */
export function extractUserIdFromToken(token) {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64").toString("utf-8")
    );
    return String(payload.userid || payload.user_id || payload.sub || "");
  } catch {
    return "";
  }
}

/**
 * Fetch all purchased batches for a user
 * Returns: array of { id, name, thumbnail, expiry }
 * ✅ Single call — no refresh duplicates
 */
export async function fetchUserBatches(userId, token) {
  const headers = makeHeaders(token, userId);
  const batchMap = new Map(); // id => batch object (auto-dedup)

  // Method 1: get_all_purchases
  try {
    const resp = await fetch(
      `${BASE_URL}/get/get_all_purchases?userid=${userId}`,
      { headers, timeout: 12000 }
    );
    if (resp.ok) {
      const data = await resp.json();
      for (const item of data.data || []) {
        if (item.itemtype === "Course" && item.coursedt?.[0]) {
          const c = item.coursedt[0];
          const id = String(c.id);
          if (!batchMap.has(id)) {
            batchMap.set(id, {
              id,
              name: c.course_name || "Unknown",
              thumbnail: c.course_thumbnail || "",
              expiry: item.enddatetime || "",
              type: "course",
            });
          }
        }
      }
    }
  } catch (_) {}

  // Method 2: mycourseweb (fallback if no batches found)
  if (batchMap.size === 0) {
    try {
      const resp = await fetch(
        `${BASE_URL}/get/mycourseweb?userid=${userId}`,
        { headers, timeout: 10000 }
      );
      if (resp.ok) {
        const data = await resp.json();
        for (const c of data.data || []) {
          const id = String(c.id);
          if (!batchMap.has(id)) {
            batchMap.set(id, {
              id,
              name: c.course_name || "Unknown",
              thumbnail: c.course_thumbnail || "",
              expiry: c.expiryDate || "",
              type: "course",
            });
          }
        }
      }
    } catch (_) {}
  }

  return Array.from(batchMap.values());
}

/**
 * Validate token — returns true/false
 */
export async function validateToken(userId, token) {
  try {
    const headers = makeHeaders(token, userId);
    const resp = await fetch(
      `${BASE_URL}/get/mycourseweb?userid=${userId}`,
      { headers, timeout: 8000 }
    );
    if (!resp.ok) return false;
    const data = await resp.json();
    return data.status === "success" || Array.isArray(data.data);
  } catch {
    return false;
  }
}
