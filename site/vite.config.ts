import { defineConfig } from "vite";
import { readFileSync } from "node:fs";
import { render, renderHead, type Content } from "./src/render";

export default defineConfig({
  plugins: [
    {
      name: "render-content",
      // Every word on the page comes from src/content.json and is in the HTML at first paint.
      transformIndexHtml(html) {
        const content = JSON.parse(readFileSync(new URL("./src/content.json", import.meta.url), "utf8")) as Content;
        return html.replace("<!--HEAD-->", renderHead(content)).replace("<!--APP-->", render(content));
      },
    },
    {
      name: "preload-display-font",
      // The hero name is set in Schibsted Grotesk: fetch its latin file alongside the CSS
      // instead of after it, so the name doesn't sit in the fallback face on slow networks.
      transformIndexHtml: {
        order: "post",
        handler(html, ctx) {
          const font = Object.keys(ctx.bundle ?? {}).find((f) => /schibsted-grotesk-latin-wght-normal-[\w-]+\.woff2$/.test(f));
          if (!font) return html;
          return html.replace("</title>", `</title>\n    <link rel="preload" href="/${font}" as="font" type="font/woff2" crossorigin />`);
        },
      },
    },
  ],
  build: { target: "es2020", assetsInlineLimit: 0 },
});
