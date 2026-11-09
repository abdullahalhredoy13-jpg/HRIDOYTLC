import { isAdmin, activeOrders, json } from "../lib/common.mjs";

export default async (req) => {
  if (!isAdmin(req)) return json({ error: "Unauthorized." }, 401);
  try {
    const list = (await activeOrders()).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
    return json({ serverNow: new Date().toISOString(), orders: list });
  } catch (e) {
    console.error("list failed", e?.message);
    return json({ error: "Could not load orders." }, 500);
  }
};
