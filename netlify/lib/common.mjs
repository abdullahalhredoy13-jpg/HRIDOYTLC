import crypto from "node:crypto";
import { getStore } from "@netlify/blobs";

export const TTL_MS = 120000;            // 120 seconds
export const MAX_BYTES = 4 * 1024 * 1024; // 4 MB
export const SERVICES = {
  bw: { name: "Print Black & White", price: 10, min: 1 },
  color: { name: "Print Color Copy", price: 20, min: 1 },
  passport: { name: "Passport Size Picture", price: 60, min: 4 },
};
export const TYPES = {
  jpg: ["image/jpeg"], jpeg: ["image/jpeg"], png: ["image/png"], webp: ["image/webp"],
  pdf: ["application/pdf"], doc: ["application/msword"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  xls: ["application/vnd.ms-excel"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
};
export const STATUSES = ["pending", "printing", "completed"];

export const files = () => getStore({ name: "hridoy-telecom-uploads", consistency: "strong" });
export const orders = () => getStore({ name: "hridoy-telecom-orders", consistency: "strong" });

export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

// ---- admin session token (HMAC-signed, 30 min) ----
const secret = () => process.env.ADMIN_SECRET || process.env.ADMIN_PIN || "";
const sign = (p) => crypto.createHmac("sha256", secret()).update(p).digest("base64url");

export function makeToken() {
  const p = Buffer.from(JSON.stringify({ exp: Date.now() + 30 * 60000 })).toString("base64url");
  return p + "." + sign(p);
}
export function isAdmin(req) {
  if (!secret()) return false;
  const [p, s] = (req.headers.get("authorization") || "").replace(/^Bearer /, "").split(".");
  if (!p || !s) return false;
  const a = Buffer.from(s), b = Buffer.from(sign(p));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try { return JSON.parse(Buffer.from(p, "base64url").toString()).exp > Date.now(); } catch { return false; }
}

export const isExpired = (m) => Date.parse(m.expiresAt) <= Date.now();

// Delete file first; only drop metadata once the file is really gone,
// so a failed deletion is retried by the next cleanup run.
export async function purge(key) {
  try {
    await files().delete(key);
    await orders().delete(key);
    return true;
  } catch (e) {
    console.error("purge failed", key, e?.message);
    return false;
  }
}

export async function getMeta(key) {
  try { return await orders().get(key, { type: "json" }); } catch { return null; }
}

// Returns only non-expired metadata; lazily purges expired entries.
export async function activeOrders() {
  const { blobs } = await orders().list();
  const out = [];
  await Promise.all(blobs.map(async (b) => {
    const m = await getMeta(b.key);
    if (!m) return;
    if (isExpired(m)) await purge(b.key); else out.push(m);
  }));
  return out;
}

// Light magic-byte check so a renamed file can't pass as a document/image.
export function magicOk(ext, u8) {
  const h = (...b) => b.every((x, i) => u8[i] === x);
  if (ext === "jpg" || ext === "jpeg") return h(0xff, 0xd8, 0xff);
  if (ext === "png") return h(0x89, 0x50, 0x4e, 0x47);
  if (ext === "webp") return h(0x52, 0x49, 0x46, 0x46) && u8[8] === 0x57 && u8[9] === 0x45;
  if (ext === "pdf") return h(0x25, 0x50, 0x44, 0x46);
  if (ext === "docx" || ext === "xlsx") return h(0x50, 0x4b);
  if (ext === "doc" || ext === "xls") return h(0xd0, 0xcf, 0x11, 0xe0);
  return false;
}
