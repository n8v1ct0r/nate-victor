// Copy lint for visible text. Usage: node verify/copy-lint.mjs <url-or-html-file>...
// Fails on em/en dashes and banned words (except "Empower Sleep"). Writes nothing; prints findings.
import { chromium } from "@playwright/test";
import { pathToFileURL } from "node:url";
const BANNED = ["leverage", "delve", "landscape", "showcase", "pivotal", "seamless", "robust", "empower", "unlock", "transform"];
const browser = await chromium.launch();
let bad = 0;
for (const arg of process.argv.slice(2)) {
  const page = await browser.newPage();
  await page.goto(/^https?:/.test(arg) ? arg : pathToFileURL(arg).href, { waitUntil: "load" });
  await page.waitForTimeout(800);
  const text = await page.evaluate(() => document.body.innerText + "\n" + document.title + "\n" + (document.querySelector('meta[name="description"]')?.content ?? ""));
  const findings = [];
  for (const m of text.matchAll(/[–—]/g)) findings.push(`dash at: "${text.slice(Math.max(0, m.index - 30), m.index + 30).replace(/\n/g, " ")}"`);
  const scrubbed = text.replace(/Empower Sleep/g, "");
  for (const w of BANNED) for (const m of scrubbed.matchAll(new RegExp(`\\b${w}\\w*`, "gi"))) findings.push(`banned "${m[0]}" at: "${scrubbed.slice(Math.max(0, m.index - 30), m.index + 30).replace(/\n/g, " ")}"`);
  console.log(`${findings.length ? "FAIL" : "PASS"} copy-lint ${arg} (${findings.length} findings)`);
  findings.forEach((f) => console.log("  " + f));
  bad += findings.length;
  await page.close();
}
await browser.close();
process.exit(bad ? 1 : 0);
