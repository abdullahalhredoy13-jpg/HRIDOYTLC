(() => {
"use strict";
const $ = (id) => document.getElementById(id);
const SV = { bw: { n: "Print Black and White", min: 1 }, color: { n: "Print Color Copy", min: 1 }, passport: { n: "Passport Size Picture", min: 4 } };
const ALLOWED = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", pdf: "application/pdf", doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
const MAX = 4 * 1024 * 1024;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const size = (b) => b < 1024 ? b + " B" : b < 1048576 ? (b / 1024).toFixed(1) + " KB" : (b / 1048576).toFixed(2) + " MB";
const ext = (n) => (n.split(".").pop() || "").toLowerCase();

/* ---------------- Customer ---------------- */
let service = "", picked = [];

document.querySelectorAll(".card").forEach((c) => c.addEventListener("click", () => {
  service = c.dataset.s; $("picker").value = ""; $("picker").click();
}));
$("more").onclick = () => { $("picker").value = ""; $("picker").click(); };
$("picker").addEventListener("change", (e) => {
  const errs = [];
  for (const f of e.target.files) {
    const x = ext(f.name);
    if (!ALLOWED[x]) { errs.push(f.name + ": type not supported"); continue; }
    if (f.size > MAX) { errs.push(f.name + ": larger than 4 MB"); continue; }
    if (f.size === 0) { errs.push(f.name + ": empty file"); continue; }
    // Some phones report an empty/generic type; the server re-checks the real content.
    const type = f.type && f.type !== "application/octet-stream" ? f.type : ALLOWED[x];
    picked.push(new File([f], f.name, { type: x === "jpg" || x === "jpeg" ? (type === "image/jpg" ? "image/jpeg" : type) : type }));
  }
  const s = SV[service];
  $("order").hidden = false; $("done").hidden = false; $("done").hidden = true;
  $("oTitle").textContent = s.n; $("copies").min = s.min;
  if (+$("copies").value < s.min) $("copies").value = s.min;
  renderFiles(); say(errs.join(". "));
  $("order").scrollIntoView({ behavior: "smooth", block: "start" });
});
function say(t, ok) { $("msg").textContent = t || ""; $("msg").className = ok ? "ok" : ""; }
function renderFiles() {
  $("fileList").innerHTML = picked.map((f, i) =>
    `<li class="file"><span class="n">${esc(f.name)}</span><button class="small danger" data-i="${i}" type="button">Remove</button><span class="s">${ext(f.name).toUpperCase()} · ${size(f.size)}</span></li>`).join("");
  $("upload").disabled = !picked.length;
}
$("fileList").addEventListener("click", (e) => {
  const i = e.target.dataset.i; if (i === undefined) return;
  picked.splice(+i, 1); renderFiles();
});
$("last4").addEventListener("input", (e) => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 4); });

$("upload").onclick = async () => {
  const last4 = $("last4").value, copies = parseInt($("copies").value, 10), s = SV[service];
  if (!/^\d{4}$/.test(last4)) return say("Enter exactly 4 digits.");
  if (!(copies >= s.min)) return say("Minimum " + s.min + " copies.");
  if (!picked.length) return say("Select at least one file.");
  $("upload").disabled = $("more").disabled = true;
  let orderId = "";
  try {
    for (let i = 0; i < picked.length; i++) {
      say(`Uploading ${i + 1} of ${picked.length}…`, true);
      const fd = new FormData();
      fd.append("file", picked[i]); fd.append("service", service); fd.append("last4", last4); fd.append("copies", copies);
      if (orderId) fd.append("orderId", orderId);
      const r = await fetch("/.netlify/functions/upload", { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(`${picked[i].name}: ${j.error || "upload failed"}`);
      orderId = j.orderId;
    }
    say(""); $("oid").textContent = orderId; $("done").hidden = false;
    $("fileList").innerHTML = ""; $("more").hidden = $("upload").hidden = true; picked = [];
    $("done").scrollIntoView({ behavior: "smooth" });
  } catch (e) { say(e.message); $("upload").disabled = $("more").disabled = false; }
};
$("again").onclick = () => {
  $("order").hidden = true; $("more").hidden = $("upload").hidden = false; $("more").disabled = false;
  $("last4").value = ""; picked = []; $("done").hidden = true; scrollTo({ top: 0 });
};

/* ---------------- Hidden admin gesture (hold logo 2.5 s) ---------------- */
(() => {
  const logo = $("logo"); let t = null, sx = 0, sy = 0;
  const stop = () => { clearTimeout(t); t = null; };
  logo.addEventListener("pointerdown", (e) => {
    stop(); sx = e.clientX; sy = e.clientY;
    t = setTimeout(() => { t = null; openAdmin(); }, 2500);
  });
  logo.addEventListener("pointermove", (e) => { if (t && Math.hypot(e.clientX - sx, e.clientY - sy) > 12) stop(); });
  ["pointerup", "pointercancel", "pointerleave"].forEach((ev) => logo.addEventListener(ev, stop));
  logo.addEventListener("contextmenu", (e) => e.preventDefault());
})();

/* ---------------- Admin ---------------- */
const KEY = "ht_admin_token";
let token = sessionStorage.getItem(KEY) || "", poll = null, tick = null, orders = [], offset = 0;

function openAdmin() { token ? showDash() : ($("pinBox").hidden = false, $("pin").value = "", $("pinMsg").textContent = "", $("pin").focus()); }
$("pinCancel").onclick = () => { $("pinBox").hidden = true; };
$("pinForm").addEventListener("submit", async (e) => {
  e.preventDefault(); $("pinMsg").textContent = "Checking…";
  try {
    const r = await fetch("/.netlify/functions/admin-auth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pin: $("pin").value }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "Sign in failed.");
    token = j.token; sessionStorage.setItem(KEY, token); $("pin").value = ""; $("pinBox").hidden = true; showDash();
  } catch (err) { $("pinMsg").textContent = err.message; }
});
const auth = () => ({ authorization: "Bearer " + token });
function showDash() { $("admin").hidden = false; load(); clearInterval(poll); clearInterval(tick); poll = setInterval(load, 3000); tick = setInterval(countdown, 1000); }
function logout() { token = ""; sessionStorage.removeItem(KEY); clearInterval(poll); clearInterval(tick); $("admin").hidden = true; }
$("logout").onclick = logout; $("refresh").onclick = load;
["q", "fService", "fStatus"].forEach((id) => $(id).addEventListener("input", render));

async function load() {
  try {
    const r = await fetch("/.netlify/functions/list-orders", { headers: auth(), cache: "no-store" });
    if (r.status === 401) { logout(); return; }
    const j = await r.json(); if (!r.ok) throw new Error(j.error);
    offset = Date.parse(j.serverNow) - Date.now(); orders = j.orders; $("dmsg").textContent = ""; render();
  } catch (e) { $("dmsg").textContent = "Could not refresh: " + e.message; }
}
const left = (o) => Date.parse(o.expiresAt) - (Date.now() + offset);
function render() {
  const live = orders.filter((o) => left(o) > 0);
  const n = (s) => live.filter((o) => o.service === s).length;
  const ids = (s) => new Set(live.filter((o) => o.service === s).map((o) => o.orderId)).size;
  const all = new Set(live.map((o) => o.orderId)).size;
  $("stats").innerHTML = [["Active orders", all], ["Black & White orders", ids("bw")], ["Color Copy orders", ids("color")], ["Passport Photo orders", ids("passport")], ["Active files", live.length]]
    .map(([l, v]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join("");
  const q = $("q").value.trim().toLowerCase(), fs = $("fService").value, ft = $("fStatus").value;
  const rows = live.filter((o) => (!fs || o.service === fs) && (!ft || o.status === ft) &&
    (!q || [o.orderId, o.customerLast4, o.fileName].some((v) => v.toLowerCase().includes(q))));
  $("rows").innerHTML = rows.length ? rows.map((o) => `
    <div class="o ${o.service}">
      <div><div class="n">${esc(o.fileName)}</div>
        <div class="m">${esc(o.serviceName)} · ×${o.copies} · ${esc(o.fileFormat)} · ${size(o.fileSize)}</div>
        <div class="m">Mobile ****${esc(o.customerLast4)} · ${esc(o.orderId)} · ${new Date(o.uploadedAt).toLocaleTimeString()}</div></div>
      <div class="life" data-exp="${esc(o.expiresAt)}"></div>
      <div class="act">
        <button class="small primary" data-a="dl" data-k="${esc(o.fileKey)}" data-n="${esc(o.fileName)}">Download</button>
        <button class="small danger" data-a="del" data-k="${esc(o.fileKey)}">Delete</button>
        <select data-a="st" data-k="${esc(o.fileKey)}">${["pending", "printing", "completed"].map((s) => `<option${s === o.status ? " selected" : ""}>${s}</option>`).join("")}</select>
      </div>
    </div>`).join("") : `<p class="note">No active orders. Uploaded files appear here for 2 minutes.</p>`;
  countdown();
}
function countdown() {
  let gone = false;
  document.querySelectorAll("[data-exp]").forEach((el) => {
    const s = Math.ceil((Date.parse(el.dataset.exp) - (Date.now() + offset)) / 1000);
    if (s <= 0) { gone = true; return; }
    el.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")} left`; el.classList.toggle("low", s <= 30);
  });
  if (gone) render();
}
$("rows").addEventListener("click", async (e) => {
  const b = e.target.closest("button[data-a]"); if (!b) return;
  const key = b.dataset.k;
  try {
    if (b.dataset.a === "dl") {
      const r = await fetch("/.netlify/functions/download?key=" + encodeURIComponent(key), { headers: auth() });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Download failed");
      const url = URL.createObjectURL(await r.blob()), a = document.createElement("a");
      a.href = url; a.download = b.dataset.n; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
    } else if (b.dataset.a === "del") {
      if (!confirm("Delete this file now?")) return;
      const r = await fetch("/.netlify/functions/delete", { method: "POST", headers: auth(), body: JSON.stringify({ key }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Delete failed");
      orders = orders.filter((o) => o.fileKey !== key); render();
    }
  } catch (err) { $("dmsg").textContent = err.message; }
});
$("rows").addEventListener("change", async (e) => {
  if (e.target.dataset.a !== "st") return;
  const r = await fetch("/.netlify/functions/update-status", { method: "POST", headers: auth(), body: JSON.stringify({ key: e.target.dataset.k, status: e.target.value }) });
  if (!r.ok) $("dmsg").textContent = "Could not update status."; else load();
});
})();
