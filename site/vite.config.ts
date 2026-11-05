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
  ],
  build: { target: "es2020", assetsInlineLimit: 0 },
});
