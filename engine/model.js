// The saved data: shape, limits and a strict loader (used for storage and for restoring a backup).
import { clip, safeUrl } from "./util.js";

export const THEMES = ["clean", "midnight", "journal"];
export const LIMITS = { name: 60, role: 80, tagline: 140, about: 1500, location: 60, handle: 120, skills: 20, skill: 30, projects: 24, title: 70, summary: 400, tags: 6, tag: 24, image: 450_000, photo: 150_000 };
const IMG = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;

export function emptyState() {
  return { v: 1, theme: "clean", profile: { name: "", role: "", tagline: "", about: "", location: "", email: "", github: "", linkedin: "", website: "", photo: "", skills: [] }, projects: [] };
}

let counter = 0;
export function newId() { return "p" + Date.now().toString(36) + (counter++).toString(36); }

export function cleanImage(v, max) {
  const s = typeof v === "string" ? v : "";
  return s && s.length <= max && IMG.test(s) ? s : "";
}

export function cleanList(v, maxItems, maxLen) {
  const raw = Array.isArray(v) ? v : typeof v === "string" ? v.split(",") : [];
  const out = [];
  for (const x of raw) {
    const t = clip(typeof x === "string" ? x : "", maxLen).replace(/\s+/g, " ").trim();
    if (t && !out.some((o) => o.toLowerCase() === t.toLowerCase())) out.push(t);
    if (out.length >= maxItems) break;
  }
  return out;
}

export function cleanProject(p) {
  const o = p && typeof p === "object" ? p : {};
  return {
    id: typeof o.id === "string" && /^[\w-]{1,40}$/.test(o.id) ? o.id : newId(),
    title: clip(o.title, LIMITS.title).replace(/\s+/g, " ").trim(),
    summary: clip(o.summary, LIMITS.summary).trim(),
    tags: cleanList(o.tags, LIMITS.tags, LIMITS.tag),
    live: clip(o.live, 300).trim(),
    repo: clip(o.repo, 300).trim(),
    image: cleanImage(o.image, LIMITS.image),
    featured: o.featured === true,
  };
}

/** Turn anything (parsed JSON, old data, junk) into valid state. Never throws. */
export function normalizeState(raw) {
  const base = emptyState();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  const p = raw.profile && typeof raw.profile === "object" ? raw.profile : {};
  const s = (k, n) => clip(p[k], n).trim();
  base.profile = {
    name: s("name", LIMITS.name).replace(/\s+/g, " "), role: s("role", LIMITS.role).replace(/\s+/g, " "), tagline: s("tagline", LIMITS.tagline).replace(/\s+/g, " "),
    about: clip(p.about, LIMITS.about).trim(), location: s("location", LIMITS.location).replace(/\s+/g, " "), email: s("email", LIMITS.handle),
    github: s("github", LIMITS.handle), linkedin: s("linkedin", LIMITS.handle), website: s("website", 300),
    photo: cleanImage(p.photo, LIMITS.photo), skills: cleanList(p.skills, LIMITS.skills, LIMITS.skill),
  };
  base.theme = THEMES.includes(raw.theme) ? raw.theme : "clean";
  const list = Array.isArray(raw.projects) ? raw.projects.slice(0, LIMITS.projects) : [];
  const seen = new Set();
  base.projects = list.map(cleanProject).map((x) => { while (seen.has(x.id)) x.id = newId(); seen.add(x.id); return x; });
  return base;
}

/** Parse a backup file's text. Returns {ok, state} or {ok:false, reason}. */
export function parseBackup(text) {
  if (typeof text !== "string" || text.length > 12_000_000) return { ok: false, reason: "That file is too large to be a Folio backup." };
  let j;
  try { j = JSON.parse(text); } catch { return { ok: false, reason: "That is not a valid backup file." }; }
  if (!j || typeof j !== "object" || j.app !== "folio" || !j.data) return { ok: false, reason: "This file was not made by Folio." };
  return { ok: true, state: normalizeState(j.data) };
}

export function makeBackup(state) {
  return JSON.stringify({ app: "folio", version: 1, data: state }, null, 1);
}

/** What is still missing before the site looks finished. */
export function checklist(state) {
  const p = state.profile, out = [];
  if (!p.name) out.push("Add your name");
  if (!p.role && !p.tagline) out.push("Add a role or one-line tagline");
  if (!p.about) out.push("Write a short about section");
  if (!state.projects.length) out.push("Add at least one project");
  const bare = state.projects.filter((x) => x.title && !x.live && !x.repo).length;
  if (bare) out.push(bare === 1 ? "One project has no link" : bare + " projects have no link");
  const untitled = state.projects.filter((x) => !x.title).length;
  if (untitled) out.push(untitled === 1 ? "One project needs a title" : untitled + " projects need a title");
  if (!p.email && !p.github && !p.linkedin && !safeUrl(p.website)) out.push("Add a way to contact you");
  return out;
}
