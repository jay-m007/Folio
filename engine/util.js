// Small safe helpers shared by the page and the site generator.
const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Escape text for use inside HTML text or a quoted attribute. */
export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);
}

/** Keep only http(s) links. Anything else (javascript:, data:, file:) becomes "". A bare "site.com/x" gets https://. */
export function safeUrl(input) {
  let s = String(input ?? "").trim();
  if (!s || /[\s<>"'`]/.test(s)) return "";
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) {
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/|$|\?|#|:)/i.test(s)) return "";
    s = "https://" + s;
  }
  let u;
  try { u = new URL(s); } catch { return ""; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return "";
  if (!u.hostname.includes(".") && u.hostname !== "localhost") return "";
  return u.href;
}

/** A GitHub handle from "name", "@name" or a github.com link. Returns "" when it is not a valid handle. */
export function githubHandle(input) {
  let s = String(input ?? "").trim().replace(/^@/, "");
  const m = s.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/?#\s]+)/i);
  if (m) s = m[1];
  return /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/.test(s) ? s : "";
}

/** A LinkedIn profile link from "name" or a linkedin.com link. */
export function linkedinUrl(input) {
  const s = String(input ?? "").trim().replace(/^@/, "");
  if (!s) return "";
  if (/^[A-Za-z0-9-_%]{3,100}$/.test(s)) return "https://www.linkedin.com/in/" + s;
  const u = safeUrl(s);
  try { return u && /(^|\.)linkedin\.com$/i.test(new URL(u).hostname) ? u : ""; } catch { return ""; }
}

export function isEmail(s) {
  return /^[^\s@<>"'`]+@[^\s@<>"'`]+\.[^\s@<>"'`]{2,}$/.test(String(s ?? "").trim()) && String(s).length <= 120;
}

export function slug(s, fallback = "portfolio") {
  const t = String(s ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return (t || fallback).slice(0, 40).replace(/-+$/, "") || fallback;
}

export function clip(s, n) {
  return String(s ?? "").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").slice(0, n);
}
