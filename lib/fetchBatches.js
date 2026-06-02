// lib/fetchBatches.js
import fetch from "node-fetch";
import { BASE_URL, makeHeaders } from "./config.js";

/**
 * Fetch all purchased courses/batches for a user
 * Returns array of { id, name, thumbnail, expiry }
 */
export async function fetchUserBatches(userId, token) {
  const headers = makeHeaders(token, userId);
  const batches = [];

  // Method 1: get_all_purchases (main endpoint)
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
          batches.push({
            id: String(c.id),
            name: c.course_name || "Unknown",
            thumbnail: c.course_thumbnail || "",
            expiry: item.enddatetime || "",
            type: "course",
          });
        }
      }
    }
  } catch (_) {}

  // Method 2: mycourseweb (fallback)
  if (batches.length === 0) {
    try {
      const resp = await fetch(
        `${BASE_URL}/get/mycourseweb?userid=${userId}`,
        { headers, timeout: 10000 }
      );
      if (resp.ok) {
        const data = await resp.json();
        for (const c of data.data || []) {
          batches.push({
            id: String(c.id),
            name: c.course_name || "Unknown",
            thumbnail: c.course_thumbnail || "",
            expiry: c.expiryDate || "",
            type: "course",
          });
        }
      }
    } catch (_) {}
  }

  return batches;
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
