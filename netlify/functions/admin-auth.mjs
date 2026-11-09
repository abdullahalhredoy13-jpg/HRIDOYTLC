import crypto from "node:crypto";
import { json, makeToken } from "../lib/common.mjs";

const h = (s) => crypto.createHash("sha256").update(String(s)).digest();

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  if (!process.env.ADMIN_PIN) return json({ error: "ADMIN_PIN is not configured on the server." }, 500);
  let pin = "";
  try { pin = String((await req.json()).pin || ""); } catch {}
  if (crypto.timingSafeEqual(h(pin), h(process.env.ADMIN_PIN))) return json({ ok: true, token: makeToken() });
  await new Promise((r) => setTimeout(r, 1000)); // slow down guessing
  return json({ error: "Wrong PIN." }, 401);
};
