import { orders, getMeta, isExpired, purge } from "../lib/common.mjs";

// Scheduled function: runs every minute (best effort, may run late).
// API endpoints never return expired files even if deletion is still pending.
export default async () => {
  let scanned = 0, deleted = 0, failed = 0;
  try {
    const { blobs } = await orders().list();
    for (const b of blobs) {
      try {
        scanned++;
        const m = await getMeta(b.key);
        if (!m) continue;
        if (isExpired(m)) (await purge(b.key)) ? deleted++ : failed++;
      } catch (e) { failed++; console.error("cleanup item error", b.key, e?.message); }
    }
  } catch (e) { console.error("cleanup scan error", e?.message); }
  console.log(`cleanup ${new Date().toISOString()} scanned=${scanned} deleted=${deleted} failed=${failed}`);
};

export const config = { schedule: "* * * * *" };
