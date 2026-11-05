// Verification harness. Usage:
//   pnpm verify                      all targets in verify/targets.json
//   pnpm verify site argus           named targets only
//   pnpm verify site --lighthouse    add Lighthouse (performance, accessibility, SEO)
//   pnpm verify --url https://x.y    ad-hoc target named "adhoc"
//   pnpm verify --target verify/targets/x.json   one target file
// Writes verify/<target>/latest.md plus shots/. Exit code 1 if any target fails.
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const wantLighthouse = argv.includes("--lighthouse");
const urlIdx = argv.indexOf("--url");
// Targets live one per file in verify/targets/<name>.json so parallel teams never edit the same file.
const tdir = join(here, "targets");
const load = (f) => { const t = JSON.parse(readFileSync(f, "utf8")); return [t.name ?? f.split("/").pop().replace(/\.json$/, ""), t]; };
const tIdx = argv.indexOf("--target");
let targets;
if (urlIdx >= 0) {
  targets = { adhoc: { url: argv[urlIdx + 1], expect: ["body"], checkLinks: true } };
} else if (tIdx >= 0) {
  targets = Object.fromEntries([load(argv[tIdx + 1])]);
} else {
  const names = argv.filter((a, i) => !a.startsWith("--") && argv[i - 1] !== "--target");
  const files = readdirSync(tdir).filter((f) => f.endsWith(".json")).map((f) => join(tdir, f));
  const loaded = Object.fromEntries(files.map(load));
  targets = names.length ? Object.fromEntries(names.map((n) => [n, loaded[n]])) : loaded;
}

const VIEWPORTS = [
  { name: "1440", width: 1440, height: 900 },
  { name: "390", width: 390, height: 844, isMobile: true, hasTouch: true },
];
// Third-party noise that is not a defect of the page under test.
const IGNORE = [/favicon\.ico$/, /\/_vercel\/(insights|speed-insights)\//];

async function runStep(page, step) {
  if (step.click) await page.locator(step.click).first().click({ timeout: 10_000 });
  if (step.hover) await page.locator(step.hover).first().hover({ timeout: 10_000 });
  if (step.press) await page.keyboard.press(step.press);
  if (step.fill) await page.locator(step.fill[0]).first().fill(step.fill[1]);
  if (step.wait) await page.waitForTimeout(step.wait);
  if (step.expect) await page.locator(step.expect).first().waitFor({ state: "visible", timeout: 15_000 });
  if (step.expectText) await page.getByText(step.expectText).first().waitFor({ state: "visible", timeout: 15_000 });
}

async function checkTarget(name, t, browser) {
  const out = join(here, name);
  mkdirSync(join(out, "shots"), { recursive: true });
  const checks = [];
  const add = (label, ok, detail = "") => checks.push({ label, ok, detail });

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.hasTouch });
    const page = await ctx.newPage();
    const consoleErrors = [];
    const failed = [];
    page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200)); });
    page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${String(e).slice(0, 200)}`));
    page.on("requestfailed", (r) => { if (!IGNORE.some((re) => re.test(r.url()))) failed.push(`${r.url()} (${r.failure()?.errorText})`); });
    page.on("response", (r) => { if (r.status() >= 400 && !IGNORE.some((re) => re.test(r.url()))) failed.push(`${r.url()} (HTTP ${r.status()})`); });

    let status = 0;
    try {
      const res = await page.goto(t.url, { waitUntil: "load", timeout: 45_000 });
      status = res?.status() ?? 0;
      await page.waitForTimeout(t.settleMs ?? 1500);
    } catch (e) { add(`[${vp.name}] load`, false, String(e).slice(0, 200)); }
    add(`[${vp.name}] HTTP status`, status >= 200 && status < 400, String(status));

    for (const sel of t.expect ?? []) {
      const ok = await page.locator(sel).first().isVisible().catch(() => false);
      add(`[${vp.name}] visible: ${sel}`, ok);
    }
    for (const txt of t.expectText ?? []) {
      const ok = await page.getByText(txt, { exact: false }).first().isVisible().catch(() => false);
      add(`[${vp.name}] text: "${txt.slice(0, 60)}"`, ok);
    }
    // Screenshot before the wow path: interaction can scroll the page and skew a full-page capture.
    await page.screenshot({ path: join(out, "shots", `${vp.name}.png`), fullPage: !!t.fullPageShot });
    if (t.wowPath?.length && !(vp.isMobile && t.wowDesktopOnly)) {
      try { for (const s of t.wowPath) await runStep(page, s); add(`[${vp.name}] wow path (${t.wowPath.length} steps)`, true); }
      catch (e) { add(`[${vp.name}] wow path`, false, String(e).split("\n")[0].slice(0, 200)); }
    }
    if (vp.isMobile) {
      const sw = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
      add("[390] no horizontal scroll", sw[0] <= sw[1], `scrollWidth ${sw[0]} vs ${sw[1]}`);
    }
    add(`[${vp.name}] 0 console errors`, consoleErrors.length === 0, consoleErrors.slice(0, 5).join(" | "));
    add(`[${vp.name}] 0 failed requests`, failed.length === 0, [...new Set(failed)].slice(0, 5).join(" | "));

    if (t.checkLinks && vp.name === "1440") {
      const hrefs = await page.$$eval("a[href]", (as) => [...new Set(as.map((a) => a.href))]);
      const http = hrefs.filter((h) => /^https?:/.test(h) && !(t.skipLinks ?? []).some((s) => h.includes(s)));
      const bad = [];
      for (const h of http) {
        let code = 0;
        try {
          const r = await fetch(h, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(20_000), headers: { "user-agent": "Mozilla/5.0 (link-check)" } });
          code = r.status;
        } catch (e) { code = -1; }
        // LinkedIn answers bots with 999; treat as reachable but say so.
        if (!(code >= 200 && code < 400) && code !== 999) bad.push(`${h} -> ${code}`);
      }
      add(`every link returns 2xx/3xx (${http.length} links)`, bad.length === 0, bad.join(" | "));
    }
    await ctx.close();
  }

  if (wantLighthouse && t.lighthouse !== false) {
    try {
      const raw = execFileSync(join(here, "..", "node_modules", ".bin", "lighthouse"), [
        t.url, "--quiet", "--output=json", "--only-categories=performance,accessibility,seo,best-practices",
        "--chrome-flags=--headless=new --no-sandbox",
      ], { maxBuffer: 64 * 1024 * 1024, timeout: 180_000 }).toString();
      const lh = JSON.parse(raw);
      for (const k of ["performance", "accessibility", "seo", "best-practices"]) {
        const s = Math.round((lh.categories[k]?.score ?? 0) * 100);
        add(`Lighthouse ${k} >= ${t.lighthouseMin ?? 90}`, s >= (t.lighthouseMin ?? 90), String(s));
      }
    } catch (e) { add("Lighthouse ran", false, String(e).split("\n")[0].slice(0, 200)); }
  }

  const pass = checks.every((c) => c.ok);
  const stamp = new Date().toISOString();
  const md = [
    `# ${name}: ${pass ? "PASS" : "FAIL"}`, "", `- URL: ${t.url}`, `- Run: ${stamp}`,
    `- Screenshots: verify/${name}/shots/1440.png, 390.png`, "",
    "| Check | Result | Detail |", "|---|---|---|",
    ...checks.map((c) => `| ${c.label} | ${c.ok ? "pass" : "FAIL"} | ${(c.detail || "").replace(/\|/g, "/")} |`), "",
  ].join("\n");
  writeFileSync(join(out, "latest.md"), md);
  return { name, pass, failed: checks.filter((c) => !c.ok).length, total: checks.length };
}

const browser = await chromium.launch();
const results = [];
for (const [name, t] of Object.entries(targets)) {
  if (!t?.url) { results.push({ name, pass: false, failed: 1, total: 1, note: "no url in targets.json" }); continue; }
  results.push(await checkTarget(name, t, browser));
}
await browser.close();
for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"} ${r.name} (${r.total - r.failed}/${r.total})${r.note ? " " + r.note : ""}  -> verify/${r.name}/latest.md`);
process.exit(results.every((r) => r.pass) ? 0 : 1);
