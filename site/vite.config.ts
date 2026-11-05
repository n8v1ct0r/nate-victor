import { defineConfig } from "vite";
import { readFileSync } from "node:fs";
import { render, type Content } from "./src/render";

export default defineConfig({
  plugins: [
    {
      name: "render-content",
      transformIndexHtml(html) {
        const content = JSON.parse(readFileSync(new URL("./src/content.json", import.meta.url), "utf8")) as Content;
        return html.replace("<!--APP-->", render(content));
      },
    },
  ],
  build: { target: "es2020", assetsInlineLimit: 0 },
});
