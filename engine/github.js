// Turns GitHub's public API answers into Folio projects. The page does the fetching; this only reads the answers.
import { githubHandle, clip } from "./util.js";
import { cleanProject } from "./model.js";

export function reposUrl(input) {
  const h = githubHandle(input);
  return h ? `https://api.github.com/users/${h}/repos?per_page=100&sort=pushed` : "";
}
export function userUrl(input) {
  const h = githubHandle(input);
  return h ? `https://api.github.com/users/${h}` : "";
}

/** Candidate projects from a repos answer: newest first, forks and archived last, never the profile repo. */
export function parseRepos(json, handle = "") {
  if (!Array.isArray(json)) return [];
  const rows = json.filter((r) => r && typeof r === "object" && typeof r.name === "string" && r.private !== true).filter((r) => r.name.toLowerCase() !== String(handle).toLowerCase());
  const score = (r) => (r.fork ? 2 : 0) + (r.archived ? 1 : 0);
  rows.sort((a, b) => score(a) - score(b) || String(b.pushed_at || "").localeCompare(String(a.pushed_at || "")) || (b.stargazers_count | 0) - (a.stargazers_count | 0));
  return rows.map((r) => {
    const tags = [r.language, ...(Array.isArray(r.topics) ? r.topics : [])].filter((t) => typeof t === "string" && t);
    const title = r.name.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
    const live = typeof r.homepage === "string" ? r.homepage : "";
    const project = cleanProject({ title: title.charAt(0).toUpperCase() + title.slice(1), summary: clip(r.description || "", 400), tags, live, repo: typeof r.html_url === "string" ? r.html_url : "" });
    return { project, fork: r.fork === true, archived: r.archived === true, stars: r.stargazers_count | 0, pushed: String(r.pushed_at || "").slice(0, 10) };
  });
}

/** Profile fields from a user answer. Empty fields are left out so they never overwrite what you typed. */
export function parseUser(json) {
  if (!json || typeof json !== "object") return {};
  const out = {};
  const put = (k, v, n) => { const t = clip(typeof v === "string" ? v : "", n).replace(/\s+/g, " ").trim(); if (t) out[k] = t; };
  put("name", json.name, 60); put("about", json.bio, 1500); put("location", json.location, 60); put("website", json.blog, 300);
  return out;
}

/** Plain-language reason for a failed request. */
export function explainFailure(status) {
  if (status === 404) return "No GitHub user with that name.";
  if (status === 403 || status === 429) return "GitHub says too many requests from this network. Wait a few minutes, or add projects by hand.";
  if (status === 0) return "Could not reach GitHub. Check your connection, or add projects by hand.";
  return "GitHub answered with an error (" + status + "). Try again later.";
}
