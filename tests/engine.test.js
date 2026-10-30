import { test } from "node:test";
import assert from "node:assert/strict";
import { esc, safeUrl, githubHandle, linkedinUrl, isEmail, slug, emptyState, normalizeState, parseBackup, makeBackup, checklist, cleanList,
  parseRepos, parseUser, reposUrl, explainFailure, makeZip, crc32, decodeDataUrl, renderBody, buildSite, themeCss, contactLinks, THEMES, LIMITS } from "../engine/index.js";

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const sample = () => normalizeState({
  theme: "midnight",
  profile: { name: "Asha Rao", role: "Full-stack developer", tagline: "I build small, fast web apps.", about: "First paragraph.\n\nSecond paragraph.", location: "Pune", email: "asha@example.com", github: "asha-rao", linkedin: "asha-rao", website: "asha.dev", photo: PNG, skills: ["JavaScript", "React", "javascript"] },
  projects: [{ title: "Hisaab", summary: "Monthly bills.", tags: ["JS", "PWA"], live: "https://x.github.io/Hisaab/", repo: "github.com/x/Hisaab", image: PNG }, { title: "Pakka", featured: true, summary: "GST invoices.", repo: "https://github.com/x/Pakka" }],
});

test("esc escapes the five dangerous characters", () => { assert.equal(esc(`<a href="x" onclick='y'>&`), "&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;"); assert.equal(esc(null), ""); });

test("safeUrl allows http(s) only", () => {
  assert.equal(safeUrl("https://a.com/x"), "https://a.com/x");
  assert.equal(safeUrl("a.com/x"), "https://a.com/x");
  assert.equal(safeUrl("javascript:alert(1)"), "");
  assert.equal(safeUrl("data:text/html,<script>"), "");
  assert.equal(safeUrl("ftp://a.com"), "");
  assert.equal(safeUrl("https://a.com/\"onmouseover=\""), "");
  assert.equal(safeUrl("not a url"), "");
  assert.equal(safeUrl("hello"), "");
  assert.equal(safeUrl(""), "");
});

test("handles and links", () => {
  assert.equal(githubHandle("@jay-m007"), "jay-m007");
  assert.equal(githubHandle("https://github.com/jay-m007/Hisaab"), "jay-m007");
  assert.equal(githubHandle("-bad"), ""); assert.equal(githubHandle("bad--x"), ""); assert.equal(githubHandle("a b"), "");
  assert.equal(linkedinUrl("jaymaurya"), "https://www.linkedin.com/in/jaymaurya");
  assert.equal(linkedinUrl("https://www.linkedin.com/in/x/"), "https://www.linkedin.com/in/x/");
  assert.equal(linkedinUrl("https://evil.com/linkedin.com"), "");
  assert.ok(isEmail("a@b.co")); assert.ok(!isEmail("a@b")); assert.ok(!isEmail('a"@b.com'));
});

test("slug", () => { assert.equal(slug("Asha Rao"), "asha-rao"); assert.equal(slug("Zoë  Ünal!"), "zoe-unal"); assert.equal(slug("!!!"), "portfolio"); assert.ok(slug("x".repeat(100)).length <= 40); });

test("normalizeState survives junk and enforces limits", () => {
  assert.deepEqual(normalizeState(null), emptyState());
  assert.deepEqual(normalizeState([1, 2]), emptyState());
  const s = normalizeState({ theme: "neon", profile: { name: "x".repeat(500), skills: "a, b, a, c" }, projects: "no" });
  assert.equal(s.theme, "clean"); assert.equal(s.profile.name.length, LIMITS.name); assert.deepEqual(s.profile.skills, ["a", "b", "c"]); assert.deepEqual(s.projects, []);
  const many = normalizeState({ projects: Array.from({ length: 80 }, (_, i) => ({ title: "p" + i })) });
  assert.equal(many.projects.length, LIMITS.projects);
  assert.equal(new Set(many.projects.map((p) => p.id)).size, LIMITS.projects);
});

test("images must be small real data URLs", () => {
  assert.equal(normalizeState({ profile: { photo: "https://evil.com/x.png" } }).profile.photo, "");
  assert.equal(normalizeState({ profile: { photo: "data:image/svg+xml;base64,PHN2Zz4=" } }).profile.photo, "");
  assert.equal(normalizeState({ profile: { photo: "data:image/png;base64," + "A".repeat(LIMITS.photo) } }).profile.photo, "");
  assert.equal(normalizeState({ profile: { photo: PNG } }).profile.photo, PNG);
});

test("cleanList", () => { assert.deepEqual(cleanList([" a ", "A", "", 5, "b"], 5, 10), ["a", "b"]); assert.deepEqual(cleanList(["a", "b", "c"], 2, 10), ["a", "b"]); });

test("backup round trip and rejection of bad files", () => {
  const s = sample();
  const r = parseBackup(makeBackup(s)); assert.ok(r.ok); assert.deepEqual(r.state.profile, s.profile);
  assert.ok(!parseBackup("nope").ok); assert.ok(!parseBackup('{"app":"other","data":{}}').ok); assert.ok(!parseBackup('{"app":"folio"}').ok);
  const hostile = parseBackup(JSON.stringify({ app: "folio", data: { profile: { name: "<script>alert(1)</script>" }, projects: [{ title: "x", live: "javascript:1", image: "javascript:1" }] } }));
  assert.ok(hostile.ok); assert.equal(hostile.state.projects[0].image, "");
});

test("checklist lists what is missing", () => {
  assert.ok(checklist(emptyState()).length >= 4);
  assert.deepEqual(checklist(sample()), []);
});

test("GitHub repos become projects, forks last, profile repo skipped", () => {
  const json = [
    { name: "old-fork", fork: true, pushed_at: "2026-10-01T00:00:00Z", html_url: "https://github.com/me/old-fork", description: "x" },
    { name: "me", pushed_at: "2026-10-20T00:00:00Z", html_url: "https://github.com/me/me" },
    { name: "my-app", description: "An app", language: "JavaScript", topics: ["pwa", "javascript"], homepage: "https://me.github.io/my-app/", html_url: "https://github.com/me/my-app", pushed_at: "2026-10-10T00:00:00Z", stargazers_count: 3 },
    { name: "secret", private: true, html_url: "https://github.com/me/secret" },
    { name: "newer_one", pushed_at: "2026-10-15T00:00:00Z", html_url: "https://github.com/me/newer_one", homepage: "javascript:alert(1)" },
  ];
  const r = parseRepos(json, "me");
  assert.deepEqual(r.map((x) => x.project.title), ["Newer one", "My app", "Old fork"]);
  assert.equal(r[1].project.live, "https://me.github.io/my-app/");
  assert.deepEqual(r[1].project.tags, ["JavaScript", "pwa"]);
  assert.equal(r[0].project.live, "javascript:alert(1)"); // stored as typed; the generator drops it
  assert.deepEqual(parseRepos({ message: "Not Found" }), []);
});

test("parseUser keeps only non-empty text", () => { assert.deepEqual(parseUser({ name: " Asha ", bio: null, location: "Pune", blog: "" }), { name: "Asha", location: "Pune" }); assert.deepEqual(parseUser(null), {}); });
test("reposUrl rejects bad handles", () => { assert.equal(reposUrl("jay-m007"), "https://api.github.com/users/jay-m007/repos?per_page=100&sort=pushed"); assert.equal(reposUrl("../etc"), ""); });
test("explainFailure", () => { assert.match(explainFailure(404), /No GitHub user/); assert.match(explainFailure(403), /too many/); assert.match(explainFailure(0), /Could not reach/); });

test("crc32 known value", () => { assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926); });

function readZip(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let e = buf.length - 22; assert.equal(dv.getUint32(e, true), 0x06054b50);
  const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); const out = {};
  for (let i = 0; i < n; i++) {
    assert.equal(dv.getUint32(p, true), 0x02014b50);
    const crc = dv.getUint32(p + 16, true), size = dv.getUint32(p + 24, true), nl = dv.getUint16(p + 28, true), off = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(buf.subarray(p + 46, p + 46 + nl));
    assert.equal(dv.getUint32(off, true), 0x04034b50);
    const ds = off + 30 + dv.getUint16(off + 26, true);
    const data = buf.subarray(ds, ds + size); assert.equal(crc32(data), crc, name); out[name] = data; p += 46 + nl;
  }
  return out;
}

test("zip holds every file intact, including binary and non-ASCII names", () => {
  const bin = new Uint8Array([0, 255, 1, 254, 128]);
  const z = readZip(makeZip([{ path: "a.txt", data: "héllo" }, { path: "images/b.png", data: bin }, { path: "empty", data: "" }]));
  assert.equal(new TextDecoder().decode(z["a.txt"]), "héllo"); assert.deepEqual([...z["images/b.png"]], [...bin]); assert.equal(z["empty"].length, 0);
  assert.throws(() => makeZip([{ path: "../x", data: "" }])); assert.throws(() => makeZip([{ path: "/x", data: "" }]));
  assert.deepEqual(makeZip([{ path: "a", data: "b" }]), makeZip([{ path: "a", data: "b" }]));
});

test("decodeDataUrl", () => { const d = decodeDataUrl(PNG); assert.equal(d.ext, "png"); assert.equal(d.bytes[1], 0x50); assert.equal(decodeDataUrl("data:text/html;base64,AAAA"), null); });

test("generated page contains the content, escaped, with only safe links", () => {
  const s = sample(); s.projects[0].live = "javascript:alert(1)"; s.profile.name = 'Asha <img src=x onerror=alert(1)>';
  const files = buildSite(s, { year: 2026 }); const html = files[0].data;
  assert.ok(!html.includes("<img src=x")); assert.ok(html.includes("Asha &lt;img src=x"));
  assert.ok(!html.includes("javascript:")); assert.ok(html.includes('href="https://github.com/x/Hisaab"'));
  assert.ok(html.includes('href="https://github.com/asha-rao"')); assert.ok(html.includes('href="mailto:asha@example.com"')); assert.ok(html.includes('href="https://asha.dev/"'));
  assert.ok(!/<script/i.test(html)); assert.ok(!/["'] on\w+=/.test(html), "no attribute can be broken out of"); assert.ok(!/style=/.test(html));
  assert.ok(html.indexOf("Pakka") < html.indexOf("Hisaab"), "featured projects come first");
  assert.ok(html.includes('<p>Second paragraph.</p>'));
});

test("build writes images, readme and a working zip", () => {
  const files = buildSite(sample(), { year: 2026 }); const paths = files.map((f) => f.path);
  assert.ok(paths.includes("images/photo.png") && paths.includes("images/hisaab.png") && paths.includes("style.css") && paths.includes("README.md") && paths.includes(".nojekyll"));
  assert.ok(files[0].data.includes('src="images/hisaab.png"')); assert.ok(files[0].data.includes('src="images/photo.png"'));
  const z = readZip(makeZip(files)); assert.ok(Object.keys(z).length === files.length);
  assert.match(new TextDecoder().decode(z["README.md"]), /asha-rao\.github\.io/);
});

test("two projects with the same title get different image files", () => {
  const s = normalizeState({ projects: [{ title: "App", image: PNG }, { title: "App", image: PNG }] });
  const paths = buildSite(s, { year: 2026 }).map((f) => f.path).filter((p) => p.startsWith("images/"));
  assert.equal(new Set(paths).size, 2);
});

test("an empty portfolio still builds a valid page", () => {
  const html = buildSite(emptyState(), { year: 2026 })[0].data; assert.ok(html.includes("Your name")); assert.ok(!html.includes("<section"));
});

test("every theme has a stylesheet and no external requests", () => {
  for (const t of THEMES) { const css = themeCss(t); assert.ok(css.includes(".site")); assert.ok(!/url\(|@import|http/i.test(css), t); }
});

test("contactLinks drops invalid values", () => { assert.deepEqual(contactLinks({ github: "bad name", linkedin: "", website: "javascript:1", email: "nope" }), []); });
