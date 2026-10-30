import { esc, safeUrl, githubHandle, linkedinUrl, isEmail, slug, emptyState, normalizeState, parseBackup, makeBackup, checklist, cleanList, newId, LIMITS, THEMES,
  parseRepos, parseUser, reposUrl, userUrl, explainFailure, makeZip, renderBody, themeCss, buildSite } from "./engine/index.js";
import { sampleState } from "./sample.js";

const $ = (id) => document.getElementById(id);
const KEY = "folio.v1";
const THEME_NAMES = { clean: "Clean", midnight: "Midnight", journal: "Journal" };

/** Build elements without ever using innerHTML. */
function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "value") el.value = v;
    else if (k === "checked") el.checked = true;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
}

let state = load();
let toastTimer;

function load() {
  try { const t = localStorage.getItem(KEY); if (t) return normalizeState(JSON.parse(t)); } catch {}
  return emptyState();
}
let saveTimer;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); $("savedNote").textContent = "Saved on this device"; }
    catch { $("savedNote").textContent = "Not saved"; toast("Browser storage is full. Remove a large screenshot and download a backup."); }
  }, 250);
}
function toast(msg) {
  const t = $("toast"); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 3800);
}
function hasContent() { const p = state.profile; return !!(p.name || p.about || p.tagline || state.projects.length); }

/* ---------- live preview ---------- */
const host = $("host");
const shadow = host.attachShadow({ mode: "open" });
const previewBase = new CSSStyleSheet(); previewBase.replaceSync(".site{min-height:0!important}");
const themeSheet = new CSSStyleSheet();
let renderTimer;
function changed() { save(); clearTimeout(renderTimer); renderTimer = setTimeout(preview, 120); renderTodo(); }
function preview() {
  const s = normalizeState(state);
  themeSheet.replaceSync(themeCss(s.theme));
  shadow.adoptedStyleSheets = [themeSheet, previewBase];
  const html = renderBody(s, { imgSrc: (kind, x) => (kind === "photo" ? s.profile.photo : x.image), year: new Date().getFullYear() });
  const doc = new DOMParser().parseFromString(`<div class="site">${html}</div>`, "text/html");
  shadow.replaceChildren(document.importNode(doc.body.firstChild, true));
  const gh = githubHandle(s.profile.github);
  $("chromeUrl").textContent = (gh ? gh.toLowerCase() : "your-name") + ".github.io";
}
host.addEventListener("click", (e) => { if (e.composedPath().some((n) => n.tagName === "A")) { e.preventDefault(); toast("Links are switched off in the preview."); } });

/* ---------- profile fields ---------- */
const FIELDS = ["name", "role", "tagline", "about", "location", "github", "linkedin", "website", "email"];
function feedback() {
  const p = state.profile;
  const set = (id, ok, okText, badText, value) => { const el = $(id); el.textContent = !value ? "" : ok ? okText : badText; el.className = "fb " + (!value ? "" : ok ? "ok" : "bad"); };
  set("fb-github", !!githubHandle(p.github), "✓ github.com/" + githubHandle(p.github), "That is not a GitHub username.", p.github);
  set("fb-linkedin", !!linkedinUrl(p.linkedin), "✓ Link looks good", "Use your LinkedIn name or full profile link.", p.linkedin);
  set("fb-website", !!safeUrl(p.website), "✓ " + safeUrl(p.website), "Use a full web address like example.com.", p.website);
  set("fb-email", isEmail(p.email), "✓ Looks good", "That email address looks incomplete.", p.email);
  $("c-tagline").textContent = p.tagline ? `${p.tagline.length}/${LIMITS.tagline}` : "";
}
function fillInputs() {
  for (const k of FIELDS) $("f-" + k).value = state.profile[k];
  $("f-skills").value = state.profile.skills.join(", ");
  showPhoto(); feedback();
}
for (const k of FIELDS) $("f-" + k).addEventListener("input", (e) => { state.profile[k] = e.target.value; feedback(); changed(); });
$("f-skills").addEventListener("input", (e) => { state.profile.skills = cleanList(e.target.value, LIMITS.skills, LIMITS.skill); changed(); });
$("f-skills").addEventListener("blur", () => { $("f-skills").value = state.profile.skills.join(", "); });

/* ---------- images ---------- */
async function shrink(file, { w, square, limit }) {
  if (!file.type.startsWith("image/")) throw new Error("That file is not an image.");
  if (file.size > 20e6) throw new Error("That image is over 20 MB.");
  let bmp;
  try { bmp = await createImageBitmap(file); } catch { throw new Error("Could not read that image."); }
  let sx = 0, sy = 0, sw = bmp.width, sh = bmp.height;
  if (square) { const s = Math.min(sw, sh); sx = (sw - s) / 2; sy = (sh - s) / 2; sw = sh = s; }
  for (const scale of [1, 0.75, 0.55, 0.4]) {
    const tw = Math.max(1, Math.round((square ? Math.min(w, sw) : Math.min(w, sw)) * scale)), th = Math.max(1, Math.round(tw * (sh / sw)));
    const c = document.createElement("canvas"); c.width = tw; c.height = th;
    const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, tw, th); x.drawImage(bmp, sx, sy, sw, sh, 0, 0, tw, th);
    for (const q of [0.85, 0.7, 0.55]) { const u = c.toDataURL("image/jpeg", q); if (u.length <= limit) { bmp.close?.(); return u; } }
  }
  bmp.close?.(); throw new Error("Could not make that image small enough.");
}
function showPhoto() {
  const t = $("photoThumb"), p = state.profile.photo;
  t.hidden = !p; if (p) t.src = p; else t.removeAttribute("src");
  $("photoClear").hidden = !p;
}
$("f-photo").addEventListener("change", async (e) => {
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  try { state.profile.photo = await shrink(f, { w: 360, square: true, limit: LIMITS.photo }); showPhoto(); changed(); } catch (err) { toast(err.message); }
});
$("photoClear").addEventListener("click", () => { state.profile.photo = ""; showPhoto(); changed(); });

/* ---------- projects ---------- */
function field(id, label, input, hint) { return h("div", { class: "field" }, h("label", { for: id, text: label }), input, hint ? h("div", { class: "hint", text: hint }) : null); }
function renderProjects() {
  const box = $("projects"); box.replaceChildren();
  state.projects.forEach((p, i) => {
    const title = h("h3", { text: p.title || "Untitled project" });
    const id = (k) => `${p.id}-${k}`;
    const thumb = h("img", { class: "shot", alt: "", width: "96", height: "60" });
    const refreshShot = () => { thumb.hidden = !p.image; if (p.image) thumb.src = p.image; rm.hidden = !p.image; };
    const rm = h("button", { class: "btn small danger", type: "button", text: "Remove", onclick: () => { p.image = ""; refreshShot(); changed(); } });
    const pick = h("input", { id: id("img"), class: "file", type: "file", accept: "image/*", onchange: async (e) => {
      const f = e.target.files[0]; e.target.value = ""; if (!f) return;
      try { p.image = await shrink(f, { w: 1100, square: false, limit: LIMITS.image }); refreshShot(); changed(); } catch (err) { toast(err.message); }
    } });
    let armed = false;
    const del = h("button", { class: "icon-btn danger", type: "button", "aria-label": `Delete ${p.title || "project"}`, text: "🗑", onclick: (e) => {
      const b = e.currentTarget;
      if (!armed) { armed = true; b.textContent = "Sure?"; b.classList.add("armed"); b.classList.add("wide"); setTimeout(() => { armed = false; b.textContent = "🗑"; b.classList.remove("armed", "wide"); }, 3000); return; }
      state.projects.splice(i, 1); renderProjects(); changed();
    } });
    const move = (d) => () => { const j = i + d; if (j < 0 || j >= state.projects.length) return; [state.projects[i], state.projects[j]] = [state.projects[j], state.projects[i]]; renderProjects(); changed(); };
    const bind = (el, key, after) => { el.addEventListener("input", (e) => { p[key] = e.target.value; after?.(); changed(); }); return el; };
    const card = h("div", { class: "card" },
      h("header", {}, title,
        h("button", { class: "icon-btn", type: "button", "aria-label": "Move up", text: "↑", onclick: move(-1), disabled: i === 0 }),
        h("button", { class: "icon-btn", type: "button", "aria-label": "Move down", text: "↓", onclick: move(1), disabled: i === state.projects.length - 1 }), del),
      field(id("title"), "Title", bind(h("input", { id: id("title"), value: p.title, maxlength: LIMITS.title }), "title", () => (title.textContent = p.title || "Untitled project"))),
      field(id("summary"), "What it does", bind(h("textarea", { id: id("summary"), rows: "3", maxlength: LIMITS.summary, value: p.summary }), "summary")),
      field(id("tags"), "Technologies", (() => { const el = h("input", { id: id("tags"), value: p.tags.join(", "), placeholder: "React, Node.js" }); el.addEventListener("input", (e) => { p.tags = cleanList(e.target.value, LIMITS.tags, LIMITS.tag); changed(); }); return el; })(), "Separate with commas. Up to 6."),
      h("div", { class: "grid2" },
        field(id("live"), "Live link", bind(h("input", { id: id("live"), value: p.live, inputmode: "url", spellcheck: "false", placeholder: "https://…" }), "live")),
        field(id("repo"), "Code link", bind(h("input", { id: id("repo"), value: p.repo, inputmode: "url", spellcheck: "false", placeholder: "https://github.com/…" }), "repo"))),
      h("div", { class: "field" }, h("span", { class: "lbl", text: "Screenshot" }), h("div", { class: "shotrow" }, thumb, h("label", { class: "btn small", for: id("img"), text: p.image ? "Change" : "Choose a screenshot" }), pick, rm)),
      h("label", { class: "check" }, h("input", { type: "checkbox", checked: p.featured, onchange: (e) => { p.featured = e.target.checked; changed(); } }), "Feature this project (shown first)"));
    box.append(card); refreshShot();
  });
  const full = state.projects.length >= LIMITS.projects;
  $("addProject").disabled = full;
  $("projNote").textContent = full ? `That is the limit of ${LIMITS.projects} projects.` : state.projects.length ? "" : "Add projects by hand, or import them from GitHub above.";
}
$("addProject").addEventListener("click", () => {
  if (state.projects.length >= LIMITS.projects) return;
  state.projects.push({ id: newId(), title: "", summary: "", tags: [], live: "", repo: "", image: "", featured: false });
  renderProjects(); changed(); const last = state.projects[state.projects.length - 1];
  document.getElementById(last.id + "-title")?.focus();
});

/* ---------- import from GitHub ---------- */
let rows = [];
async function getJson(url) {
  let res; try { res = await fetch(url, { headers: { Accept: "application/vnd.github+json" }, credentials: "omit", referrerPolicy: "no-referrer" }); } catch { return { status: 0 }; }
  if (!res.ok) return { status: res.status };
  try { return { status: 200, json: await res.json() }; } catch { return { status: 500 }; }
}
$("ghGo").addEventListener("click", async () => {
  const u = $("ghUser").value, msg = $("ghMsg");
  if (!reposUrl(u)) { msg.textContent = "Enter a valid GitHub username."; msg.className = "fb bad"; return; }
  msg.textContent = "Looking up…"; msg.className = "fb"; $("ghGo").disabled = true;
  const r = await getJson(reposUrl(u)); $("ghGo").disabled = false;
  if (r.status !== 200) { msg.textContent = explainFailure(r.status); msg.className = "fb bad"; return; }
  rows = parseRepos(r.json, githubHandle(u));
  if (!rows.length) { msg.textContent = "That user has no public repositories to import."; msg.className = "fb"; $("ghList").replaceChildren(); $("ghActions").hidden = true; return; }
  rows.forEach((x, i) => (x.pick = i < 6 && !x.fork && !x.archived));
  msg.textContent = `Found ${rows.length} repositories. Pick the ones you want.`; msg.className = "fb ok";
  renderGh(); $("ghActions").hidden = false;
});
$("ghUser").addEventListener("keydown", (e) => { if (e.key === "Enter") $("ghGo").click(); });
function renderGh() {
  $("ghList").replaceChildren(...rows.map((x, i) => h("label", { class: "ghitem" },
    h("input", { type: "checkbox", checked: x.pick, onchange: (e) => { x.pick = e.target.checked; ghCount(); } }),
    h("div", {}, h("b", { text: x.project.title }), h("span", { text: [x.project.summary || "No description", x.fork ? "fork" : "", x.archived ? "archived" : "", x.stars ? "★ " + x.stars : ""].filter(Boolean).join(" · ") })))));
  ghCount();
}
function ghCount() { const n = rows.filter((x) => x.pick).length; $("ghCount").textContent = n + " selected"; $("ghAdd").disabled = !n; }
$("ghAdd").addEventListener("click", async () => {
  const have = new Set(state.projects.map((p) => p.repo.toLowerCase()));
  const room = LIMITS.projects - state.projects.length;
  const add = rows.filter((x) => x.pick && !have.has(x.project.repo.toLowerCase())).slice(0, room);
  add.forEach((x) => state.projects.push(x.project));
  const skipped = rows.filter((x) => x.pick).length - add.length;
  if ($("ghProfile").checked) {
    const r = await getJson(userUrl($("ghUser").value));
    if (r.status === 200) { const u = parseUser(r.json); for (const [k, v] of Object.entries(u)) if (!state.profile[k]) state.profile[k] = v; if (!state.profile.github) state.profile.github = githubHandle($("ghUser").value); fillInputs(); }
  }
  renderProjects(); changed();
  toast(`Added ${add.length} project${add.length === 1 ? "" : "s"}.` + (skipped ? ` ${skipped} skipped (already added or over the limit).` : "") + " Add screenshots to make them stand out.");
  $("importBox").open = false;
});

/* ---------- theme, checklist ---------- */
function renderThemes() {
  $("themes").replaceChildren(...THEMES.map((t) => h("label", { class: "theme" },
    h("input", { type: "radio", name: "theme", value: t, checked: state.theme === t, onchange: () => { state.theme = t; changed(); } }),
    h("span", { class: "sw " + t }, h("b", { text: THEME_NAMES[t] }), h("i"), h("i")))));
}
function renderTodo() {
  const items = checklist(normalizeState(state));
  $("todo").replaceChildren(...(items.length ? items.map((t) => h("li", { text: t })) : [h("li", { class: "done", text: "Everything is filled in. Ready to download." })]));
}

/* ---------- download, backup, restore, erase, example ---------- */
function saveBlob(blob, name) {
  const a = h("a", { href: URL.createObjectURL(blob), download: name }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}
function download() {
  const s = normalizeState(state);
  if (!s.profile.name) { toast("Add your name first."); $("f-name").focus(); document.body.classList.remove("view-preview"); return; }
  const bytes = makeZip(buildSite(s, { year: new Date().getFullYear() }));
  saveBlob(new Blob([bytes], { type: "application/zip" }), slug(s.profile.name) + "-portfolio.zip");
  toast("Downloaded. Unzip it and follow the steps in step 4.");
}
$("download").addEventListener("click", download); $("download2").addEventListener("click", download);
$("backup").addEventListener("click", () => { saveBlob(new Blob([makeBackup(normalizeState(state))], { type: "application/json" }), "folio-backup.json"); toast("Backup downloaded."); });
$("restoreFile").addEventListener("change", async (e) => {
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  const r = parseBackup(await f.text());
  if (!r.ok) { toast(r.reason); return; }
  state = r.state; refreshAll(); changed(); toast("Backup restored.");
});
function arm(btn, idle, armedText, run) {
  let on = false, timer;
  btn.addEventListener("click", () => {
    if (!on) { on = true; btn.textContent = armedText; btn.classList.add("armed"); timer = setTimeout(() => { on = false; btn.textContent = idle; btn.classList.remove("armed"); }, 3500); return; }
    clearTimeout(timer); on = false; btn.textContent = idle; btn.classList.remove("armed"); run();
  });
}
arm($("erase"), "Erase everything", "Tap again to erase", () => { state = emptyState(); try { localStorage.removeItem(KEY); } catch {} refreshAll(); changed(); toast("Everything erased."); });
let exArmed = false, exTimer;
$("example").addEventListener("click", (e) => {
  const b = e.currentTarget;
  if (hasContent() && !exArmed) { exArmed = true; b.textContent = "Replace what is here?"; b.classList.add("armed"); exTimer = setTimeout(() => { exArmed = false; b.textContent = "See an example"; b.classList.remove("armed"); }, 3500); return; }
  clearTimeout(exTimer); exArmed = false; b.textContent = "See an example"; b.classList.remove("armed");
  state = sampleState();
  state.profile.photo = drawShot("Asha Rao", 200, 200, 160, true);
  const hues = [150, 215, 20];
  state.projects.forEach((p, i) => (p.image = drawShot(p.title, 1100, 690, hues[i % 3], false)));
  refreshAll(); changed(); toast("Example loaded. Change anything you like.");
});
/** A drawn stand-in image for the example (no files needed). */
function drawShot(label, w, hgt, hue, round) {
  const c = document.createElement("canvas"); c.width = w; c.height = hgt; const x = c.getContext("2d");
  const g = x.createLinearGradient(0, 0, w, hgt); g.addColorStop(0, `hsl(${hue} 55% 38%)`); g.addColorStop(1, `hsl(${(hue + 40) % 360} 60% 22%)`);
  x.fillStyle = g; x.fillRect(0, 0, w, hgt);
  x.fillStyle = "rgba(255,255,255,.12)"; x.beginPath(); x.arc(w * 0.82, hgt * 0.2, hgt * 0.45, 0, 7); x.fill();
  x.fillStyle = "#fff"; x.textAlign = "center"; x.textBaseline = "middle";
  const text = round ? label.split(" ").map((s) => s[0]).join("") : label;
  x.font = `700 ${round ? w * 0.4 : hgt * 0.2}px system-ui, sans-serif`; x.fillText(text, w / 2, hgt / 2);
  return c.toDataURL("image/jpeg", 0.8);
}

/* ---------- colour mode (auto, light, dark) ---------- */
const MODES = ["auto", "light", "dark"], MODE_LABEL = { auto: "◐ Auto", light: "☀ Light", dark: "☾ Dark" };
function currentMode() { try { const m = localStorage.getItem("folio.mode"); return MODES.includes(m) ? m : "auto"; } catch { return "auto"; } }
function applyMode(m) {
  if (m === "auto") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme", m);
  const b = $("themeBtn"); b.textContent = MODE_LABEL[m];
  b.setAttribute("aria-label", `Colour mode: ${m}. Press to change.`);
  const bg = getComputedStyle(document.documentElement).getPropertyValue("--ink").trim();
  document.querySelector('meta[name="theme-color"]').setAttribute("content", bg || "#12161b");
}
$("themeBtn").addEventListener("click", () => {
  const next = MODES[(MODES.indexOf(currentMode()) + 1) % MODES.length];
  try { next === "auto" ? localStorage.removeItem("folio.mode") : localStorage.setItem("folio.mode", next); } catch {}
  applyMode(next); toast(next === "auto" ? "Colour mode follows your device." : `Colour mode: ${next}.`);
});
applyMode(currentMode());

/* ---------- layout toggles ---------- */
function setView(preview) {
  document.body.classList.toggle("view-preview", preview);
  $("showEdit").classList.toggle("on", !preview); $("showEdit").setAttribute("aria-pressed", String(!preview));
  $("showPreview").classList.toggle("on", preview); $("showPreview").setAttribute("aria-pressed", String(preview));
}
$("showEdit").addEventListener("click", () => setView(false)); $("showPreview").addEventListener("click", () => setView(true));
function setDevice(phone) {
  $("frame").classList.toggle("phone", phone); $("frame").classList.toggle("desk", !phone);
  $("devPhone").classList.toggle("on", phone); $("devPhone").setAttribute("aria-pressed", String(phone));
  $("devDesk").classList.toggle("on", !phone); $("devDesk").setAttribute("aria-pressed", String(!phone));
}
$("devDesk").addEventListener("click", () => setDevice(false)); $("devPhone").addEventListener("click", () => setDevice(true));

function refreshAll() { fillInputs(); renderProjects(); renderThemes(); renderTodo(); preview(); }
refreshAll();
$("savedNote").textContent = hasContent() ? "Saved on this device" : "";
