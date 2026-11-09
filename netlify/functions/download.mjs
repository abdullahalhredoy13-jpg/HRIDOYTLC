import { isAdmin, getMeta, isExpired, purge, files, json, TYPES } from "../lib/common.mjs";

export default async (req) => {
  if (!isAdmin(req)) return json({ error: "Unauthorized." }, 401);
  const key = new URL(req.url).searchParams.get("key") || "";
  const m = key && (await getMeta(key));
  if (!m) return json({ error: "Not found." }, 404);
  if (isExpired(m)) { await purge(key); return json({ error: "This file has expired." }, 410); }
  const data = await files().get(key, { type: "arrayBuffer" });
  if (!data) return json({ error: "Not found." }, 404);
  const type = TYPES[m.fileFormat.toLowerCase()]?.[0] || "application/octet-stream";
  return new Response(data, {
    headers: {
      "content-type": type,
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(m.fileName)}`,
      "cache-control": "no-store",
    },
  });
};
