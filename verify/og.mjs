// Renders site/public/og.png (1200x630) from the real hero of a running build, so the social card
// always matches the site.
// Usage: (cd site && npm run build && npx vite preview --port 4173) & node verify/og.mjs [url]
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";

const url = process.argv[2] ?? "http://localhost:4173/";
const out = fileURLToPath(new URL("../site/public/og.png", import.meta.url));

const browser = await chromium.launch();
// Reduced motion renders the settled avatar straight away, with no particles mid-flight.
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
await page.goto(url, { waitUntil: "load" });
await page.addStyleTag({
  content: `
    .hero { min-height: 630px; height: 630px; padding-top: 72px; padding-bottom: 40px; }
    .hero-copy { padding-bottom: 56px; }
    .see, .hero-meta { display: none; }
    .bar { border-bottom-color: transparent; }
  `,
});
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(600);
await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 1200, height: 630 } });
await browser.close();
console.log(`wrote ${out}`);
