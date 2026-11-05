# nate-victor.com

Live: https://nate-victor.com

Personal site of Nate Victor. Static Vite + TypeScript, no UI framework. The hero is a 3D avatar that forms from particles sampled from its still image, then blinks and tilts toward the pointer.

- `content/site.json`: all site copy and data, one source of truth. Rendered to static HTML at build time by `site/src/render.ts`.
- `site/`: the site. `cd site && npm install && npm run build`. Media lives in `site/public` (`avatar/`, `clips/<id>.*`, `icons/<id>.webp`, `logos/`).
- `verify/`: the verification harness used before anything is called live. Playwright per URL (console errors, failed requests, the 60-second path, screenshots at 1440 and 390, horizontal scroll, every link), Lighthouse, a copy lint, and a secret scan.
- `shared/STRIP.md`: the data-honesty strip every sidequest prototype shows.

Sidequests: [AI Race Engineer](https://github.com/n8v1ct0r/race-engineer), [Photoncar](https://github.com/n8v1ct0r/photoncar), and more linked from the site.
