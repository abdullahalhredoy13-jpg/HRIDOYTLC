import crypto from "node:crypto";
import { TTL_MS, MAX_BYTES, SERVICES, TYPES, files, orders, json, magicOk } from "../lib/common.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  let fd;
  try { fd = await req.formData(); } catch { return json({ error: "Invalid upload." }, 400); }

  const file = fd.get("file");
  const service = String(fd.get("service") || "");
  const last4 = String(fd.get("last4") || "");
  const copies = parseInt(String(fd.get("copies") || "1"), 10);
  let orderId = String(fd.get("orderId") || "");

  if (!file || typeof file === "string") return json({ error: "No file received." }, 400);
  if (!SERVICES[service]) return json({ error: "Unknown service." }, 400);
  if (!/^\d{4}$/.test(last4)) return json({ error: "Enter exactly 4 digits." }, 400);
  if (!Number.isInteger(copies) || copies < SERVICES[service].min || copies > 500)
    return json({ error: `Minimum ${SERVICES[service].min} copies.` }, 400);
  if (orderId && !/^HT-\d{8}-[0-9A-F]{6}$/.test(orderId)) return json({ error: "Bad order ID." }, 400);
  if (file.size > MAX_BYTES) return json({ error: "File is larger than 4 MB." }, 413);
  if (file.size === 0) return json({ error: "File is empty." }, 400);

  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (!TYPES[ext]) return json({ error: "File type not supported." }, 415);
  if (!TYPES[ext].includes(file.type)) return json({ error: "File content type does not match its extension." }, 415);
  const buf = await file.arrayBuffer();
  if (!magicOk(ext, new Uint8Array(buf, 0, 12))) return json({ error: "File content is not a valid " + ext.toUpperCase() + "." }, 415);

  const now = Date.now();
  if (!orderId) {
    const d = new Date(now).toISOString().slice(0, 10).replace(/-/g, "");
    orderId = `HT-${d}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
  }
  const key = `${orderId}/${crypto.randomUUID()}.${ext}`;
  const meta = {
    orderId, fileKey: key, fileName: file.name.slice(0, 200), fileFormat: ext.toUpperCase(),
    fileSize: file.size, service, serviceName: SERVICES[service].name, copies,
    customerLast4: last4, uploadedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + TTL_MS).toISOString(), status: "pending",
  };
  try {
    await files().set(key, buf, { metadata: { orderId } });
    try { await orders().setJSON(key, meta); }
    catch (e) { await files().delete(key).catch(() => {}); throw e; }
  } catch (e) {
    console.error("upload failed", e?.message);
    return json({ error: "Storage error. Please try again." }, 500);
  }
  return json({ ok: true, orderId, key, expiresAt: meta.expiresAt });
};
