# nate-victor.com

Live: https://nate-victor.com

Personal site of Nate Victor. Static Vite + TypeScript, no UI framework. The hero is a 3D avatar that forms from particles sampled from its still image, then blinks and tilts toward the pointer.

- `content/site.json`: every word on the page, plus project links, statuses and data labels. One source of truth, rendered to static HTML (including the `<head>` meta, Open Graph and JSON-LD) at build time by `site/src/render.ts`.
- `site/`: the site. `cd site && npm install && npm run build`.
  - `src/render.ts` markup, `src/style.css` styles, `src/main.ts` interactions, `src/hero.ts` the avatar intro.
  - Media lives in `site/public`: `avatar/`, `clips/<id>.{webp,mp4,webm}` (real screen recordings of each sidequest), `icons/<id>.webp`.
  - `vercel.json` sets cache headers; `public/404.html` is the not-found page.
- `verify/`: the checks run before anything goes live. Playwright per URL (console errors, failed requests, the hover-to-play and copy-email path, screenshots at 1440 and 390, horizontal scroll, every link), Lighthouse, a copy lint, and a secret scan. `node verify/og.mjs` regenerates `site/public/og.png` from the running build's hero.
- `shared/STRIP.md`: the data-honesty strip every sidequest prototype shows.

Adding a sidequest: drop `clips/<id>.webp|mp4|webm` (960x600, the top 24px is cropped by the card) and `icons/<id>.webp` into `site/public`, then add an item to `sidequests.items` in `content/site.json`. `focus` is the point phones zoom toward.

Sidequests: [AI Race Engineer](https://github.com/n8v1ct0r/race-engineer), [Photoncar](https://github.com/n8v1ct0r/photoncar), and more linked from the site.
