import { isAdmin, getMeta, purge, json } from "../lib/common.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  if (!isAdmin(req)) return json({ error: "Unauthorized." }, 401);
  let key = "";
  try { key = String((await req.json()).key || ""); } catch {}
  if (!key || !(await getMeta(key))) return json({ error: "Not found." }, 404);
  return (await purge(key)) ? json({ ok: true }) : json({ error: "Delete failed." }, 500);
};
