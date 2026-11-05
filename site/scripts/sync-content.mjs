// Copies ../content/site.json (single source of truth) into src/content.json.
// On Vercel only site/ is uploaded, so the committed copy is used there.
import { copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "..", "..", "content", "site.json");
const dst = join(here, "..", "src", "content.json");

if (existsSync(src)) {
  copyFileSync(src, dst);
  console.log("synced content/site.json -> src/content.json");
} else if (existsSync(dst)) {
  console.log("content/site.json not found; using committed src/content.json");
} else {
  console.error("no content source found");
  process.exit(1);
}
