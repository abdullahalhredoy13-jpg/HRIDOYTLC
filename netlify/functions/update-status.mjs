import { isAdmin, getMeta, isExpired, orders, json, STATUSES } from "../lib/common.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  if (!isAdmin(req)) return json({ error: "Unauthorized." }, 401);
  let b = {};
  try { b = await req.json(); } catch {}
  if (!STATUSES.includes(b.status)) return json({ error: "Bad status." }, 400);
  const m = b.key && (await getMeta(b.key));
  if (!m || isExpired(m)) return json({ error: "Not found." }, 404);
  m.status = b.status;
  await orders().setJSON(b.key, m);
  return json({ ok: true });
};
