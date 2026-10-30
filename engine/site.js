// Builds the portfolio site: one HTML page, one stylesheet, and the images. Plain HTML and CSS, no scripts.
import { esc, safeUrl, githubHandle, linkedinUrl, isEmail, slug } from "./util.js";
import { decodeDataUrl } from "./zip.js";

const paragraphs = (t) => String(t || "").split(/\n{2,}/).map((x) => x.trim()).filter(Boolean).map((x) => `<p>${esc(x).replace(/\n/g, "<br>")}</p>`).join("");

/** The visible links in the header, built only from validated values. */
export function contactLinks(p) {
  const out = [];
  const gh = githubHandle(p.github); if (gh) out.push({ label: "GitHub", href: "https://github.com/" + gh });
  const li = linkedinUrl(p.linkedin); if (li) out.push({ label: "LinkedIn", href: li });
  const web = safeUrl(p.website); if (web) out.push({ label: "Website", href: web });
  if (isEmail(p.email)) out.push({ label: "Email", href: "mailto:" + p.email.trim() });
  return out;
}

/** Inner HTML of the page. imgSrc(kind, project) returns where an image lives ("photo" or "project"). */
export function renderBody(state, { imgSrc, year }) {
  const p = state.profile, name = p.name || "Your name";
  const meta = [p.role, p.location].filter(Boolean).map(esc).join(" · ");
  const links = contactLinks(p);
  const photo = p.photo ? `<img class="photo" src="${esc(imgSrc("photo", null))}" alt="Photo of ${esc(name)}" width="160" height="160">` : "";
  let h = `<header class="hero">${photo}<div class="who"><h1>${esc(name)}</h1>`;
  if (meta) h += `<p class="role">${meta}</p>`;
  if (p.tagline) h += `<p class="tagline">${esc(p.tagline)}</p>`;
  if (links.length) h += `<ul class="links">${links.map((l) => `<li><a href="${esc(l.href)}"${l.href.startsWith("mailto:") ? "" : ' rel="noopener"'}>${l.label}</a></li>`).join("")}</ul>`;
  h += `</div></header><main>`;
  if (p.about) h += `<section class="about" aria-labelledby="h-about"><h2 id="h-about">About</h2>${paragraphs(p.about)}</section>`;
  if (p.skills.length) h += `<section class="skills" aria-labelledby="h-skills"><h2 id="h-skills">Skills</h2><ul class="chips">${p.skills.map((s) => `<li>${esc(s)}</li>`).join("")}</ul></section>`;
  const shown = state.projects.filter((x) => x.title);
  if (shown.length) {
    const ordered = [...shown.filter((x) => x.featured), ...shown.filter((x) => !x.featured)];
    h += `<section class="projects" aria-labelledby="h-projects"><h2 id="h-projects">Projects</h2><div class="grid">`;
    for (const x of ordered) {
      const live = safeUrl(x.live), repo = safeUrl(x.repo);
      h += `<article class="card${x.featured ? " featured" : ""}">`;
      if (x.image) h += `<img class="shot" src="${esc(imgSrc("project", x))}" alt="Screenshot of ${esc(x.title)}" loading="lazy">`;
      h += `<div class="body"><h3>${esc(x.title)}${x.featured ? ' <span class="badge">Featured</span>' : ""}</h3>`;
      if (x.summary) h += `<p>${esc(x.summary)}</p>`;
      if (x.tags.length) h += `<ul class="tags">${x.tags.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>`;
      if (live || repo) h += `<p class="actions">${live ? `<a href="${esc(live)}" rel="noopener">Live site</a>` : ""}${repo ? `<a href="${esc(repo)}" rel="noopener">Source code</a>` : ""}</p>`;
      h += `</div></article>`;
    }
    h += `</div></section>`;
  }
  h += `</main><footer><p>© ${esc(String(year))} ${esc(name)}</p></footer>`;
  return h;
}

const BASE = `
.site{margin:0;min-height:100vh;background:var(--bg);color:var(--ink);font:17px/1.6 var(--sans);-webkit-text-size-adjust:100%}
.site *,.site *::before,.site *::after{box-sizing:border-box}
.site a{color:var(--accent);text-underline-offset:3px}
.site a:focus-visible{outline:3px solid var(--accent);outline-offset:3px;border-radius:3px}
.site ul{list-style:none;margin:0;padding:0}
.site .hero,.site main,.site footer{width:min(100% - 2.5rem,56rem);margin-inline:auto}
.site .hero{display:flex;gap:1.5rem;align-items:center;flex-wrap:wrap;padding:clamp(2rem,7vw,4.5rem) 0 1rem}
.site .photo{width:7.5rem;height:7.5rem;border-radius:50%;object-fit:cover;flex:none;background:var(--soft)}
.site .who{flex:1 1 18rem;min-width:0}
.site h1{margin:0;font:var(--h1);letter-spacing:-.02em;line-height:1.1;overflow-wrap:anywhere}
.site .role{margin:.35rem 0 0;color:var(--muted)}
.site .tagline{margin:.9rem 0 0;font-size:1.2rem;max-width:34rem}
.site .links{display:flex;gap:.5rem 1.1rem;flex-wrap:wrap;margin-top:1.1rem}
.site .links a{font-weight:650}
.site main{padding-bottom:2rem}
.site section{padding-top:2.2rem}
.site h2{margin:0 0 .8rem;font:var(--h2)}
.site .about p{margin:.6rem 0;max-width:42rem}
.site .chips{display:flex;flex-wrap:wrap;gap:.45rem}
.site .chips li,.site .tags li{padding:.2rem .7rem;border-radius:99px;background:var(--soft);font-size:.9rem}
.site .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,17rem),1fr));gap:1.1rem}
.site .card{display:flex;flex-direction:column;min-width:0;overflow:hidden}
.site .shot{width:100%;aspect-ratio:16/10;object-fit:cover;background:var(--soft);display:block}
.site .body{padding:1rem 1.1rem 1.2rem;display:flex;flex-direction:column;gap:.6rem;flex:1}
.site h3{margin:0;font:var(--h3);overflow-wrap:anywhere}
.site .body p{margin:0}
.site .badge{font:600 .72rem var(--sans);vertical-align:middle;padding:.1rem .5rem;border-radius:99px;background:var(--accent);color:var(--on-accent);margin-left:.3rem}
.site .tags{display:flex;flex-wrap:wrap;gap:.35rem}
.site .tags li{font-size:.8rem;padding:.1rem .55rem}
.site .actions{display:flex;gap:1rem;margin-top:auto!important;padding-top:.3rem;font-weight:650}
.site footer{padding:2rem 0 3rem;color:var(--muted);font-size:.9rem}
.site footer p{margin:0;border-top:1px solid var(--line);padding-top:1.2rem}
@media print{.site{background:#fff;color:#000}}`;

const THEME = {
  clean: `.site{--bg:#ffffff;--ink:#14171f;--muted:#5b6475;--accent:#2352ff;--on-accent:#fff;--soft:#eef1f6;--line:#dde2ea;--sans:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;--h1:800 clamp(2.2rem,6vw,3.4rem) var(--sans);--h2:750 1.5rem var(--sans);--h3:700 1.15rem var(--sans)}
.site .card{border:1px solid var(--line);border-radius:14px;background:#fff;transition:box-shadow .15s}
.site .card:hover{box-shadow:0 8px 24px rgba(20,23,31,.08)}
.site .featured{border-color:var(--accent)}`,
  midnight: `.site{--bg:#0a0f1f;--ink:#e7ecf9;--muted:#9aa6c4;--accent:#5eead4;--on-accent:#06251f;--soft:#18213d;--line:#222d4d;--sans:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;--h1:800 clamp(2.2rem,6vw,3.4rem) var(--sans);--h2:750 1.4rem var(--sans);--h3:700 1.15rem var(--sans)}
.site{background:radial-gradient(60rem 30rem at 85% -10%,#17224a 0,transparent 60%),var(--bg)}
.site .card{background:#111935;border:1px solid var(--line);border-radius:16px}
.site .card:hover{border-color:var(--accent)}
.site .featured{box-shadow:0 0 0 1px var(--accent)}
.site .links a{text-decoration:none;border-bottom:2px solid var(--accent)}`,
  journal: `.site{--bg:#f3f4f1;--ink:#1d2320;--muted:#59635d;--accent:#9a2f1f;--on-accent:#fff;--soft:#e4e8e2;--line:#c9d0c9;--sans:Georgia,"Iowan Old Style","Palatino Linotype",Palatino,serif;--h1:700 clamp(2.4rem,7vw,3.8rem) var(--sans);--h2:700 1.3rem var(--sans);--h3:700 1.3rem var(--sans)}
.site{font-size:18px;line-height:1.7}
.site h2{padding-bottom:.4rem;border-bottom:2px solid var(--ink)}
.site .grid{display:block}
.site .card{flex-direction:row;gap:1.2rem;padding:1.3rem 0;border-bottom:1px solid var(--line);flex-wrap:wrap}
.site .shot{width:min(100%,13rem);aspect-ratio:4/3;border-radius:4px;flex:none}
.site .body{padding:0;flex:1 1 15rem}
.site .chips li,.site .tags li{background:none;border:1px solid var(--line);font-family:system-ui,sans-serif}`,
};

export function themeCss(theme) {
  return (THEME[theme] || THEME.clean) + BASE;
}

export function pageMeta(state) {
  const p = state.profile, name = p.name || "Portfolio";
  const title = p.role ? `${name} - ${p.role}` : name;
  const desc = (p.tagline || p.about.replace(/\s+/g, " ") || `Portfolio of ${name}`).slice(0, 160);
  return { title, desc };
}

/** The whole site as files, ready for makeZip. */
export function buildSite(state, { year }) {
  const files = [], used = new Set();
  const paths = new Map();
  const add = (key, url, base) => {
    const d = decodeDataUrl(url); if (!d) return "";
    let path = `images/${base}.${d.ext}`, n = 2; while (used.has(path)) path = `images/${base}-${n++}.${d.ext}`;
    used.add(path); files.push({ path, data: d.bytes }); paths.set(key, path); return path;
  };
  if (state.profile.photo) add("photo", state.profile.photo, "photo");
  state.projects.forEach((x) => { if (x.title && x.image) add(x.id, x.image, slug(x.title, "project")); });
  const imgSrc = (kind, x) => (kind === "photo" ? paths.get("photo") : paths.get(x.id)) || "";
  const body = renderBody(state, { imgSrc, year });
  const { title, desc } = pageMeta(state);
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta name="color-scheme" content="${state.theme === "midnight" ? "dark" : "light"}">
<link rel="stylesheet" href="style.css">
</head>
<body class="site">
${body}
</body>
</html>
`;
  const readme = `# ${state.profile.name || "My"} portfolio

Made with Folio. This folder is a complete website: open index.html to see it.

## Put it online for free (GitHub Pages)

1. Create a new repository on GitHub named ${githubHandle(state.profile.github) || "your-username"}.github.io
2. Upload everything in this folder to it.
3. In the repository, go to Settings > Pages and choose "Deploy from a branch", branch main, folder / (root).
4. Your site appears at https://${githubHandle(state.profile.github) || "your-username"}.github.io after a minute.

Other free hosts (Netlify, Cloudflare Pages, Vercel) accept the same folder by drag and drop.
`;
  return [{ path: "index.html", data: html }, { path: "style.css", data: themeCss(state.theme) }, ...files, { path: "README.md", data: readme }, { path: ".nojekyll", data: "" }];
}
