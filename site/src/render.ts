// Build-time renderer: turns content.json into static HTML so every word is in the first paint.
// No framework. Everything here runs once in vite.config.ts.

type Status = "Live" | "In progress";
type Quest = {
  id: string;
  name: string;
  line: string;
  accent: string;
  status: Status;
  /** Honest data label shown on the preview, e.g. "Recorded F1 telemetry". */
  data: string;
  demoUrl: string | null;
  codeUrl: string | null;
  featured?: boolean;
};
type CodeOnly = { id: string; name: string; line: string; accent: string; codeUrl: string };
type Entry = { when: string; title: string; text: string; now?: boolean };
type Link = { label: string; href: string };

export type Content = {
  _rules: string;
  name: string;
  meta: { title: string; description: string; url: string };
  hero: { line: string; questsWord: string; roles: string[]; cta: string };
  place: { city: string; tz: string };
  now: { eyebrow: string; company: string; summary: string; url: string; urlLabel: string; headline: string; text: string };
  sidequests: { eyebrow: string; title: string; dek: string; items: Quest[]; moreTitle: string; more: CodeOnly[] };
  timeline: { eyebrow: string; title: string; dek: string; entries: Entry[] };
  about: { eyebrow: string; title: string; text: string[]; interestsLabel: string; interests: string[]; reading: { label: string; title: string; by: string } | null };
  contact: { eyebrow: string; title: string; text: string; email: string; book: Link; links: Link[] };
  footer: { note: string; source: string };
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const ext = (href: string) => `href="${esc(href)}" target="_blank" rel="noopener"`;

const icon = {
  arrow: '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 11 11 5M6 5h5v5"/></svg>',
  down: '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M4 9l4 4 4-4"/></svg>',
  up: '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 13V3M4 7l4-4 4 4"/></svg>',
  copy: '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 3.5v-.5A1.5 1.5 0 0 0 9 1.5H4A1.5 1.5 0 0 0 2.5 3v5A1.5 1.5 0 0 0 4 9.5h.5"/></svg>',
  check: '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8.5 3.2 3L13 4.5"/></svg>',
};

/** Section eyebrow: a small index plus label, e.g. "01  Now". */
const eyebrow = (n: number, label: string) =>
  `<p class="eyebrow mono"><span class="eb-n">${String(n).padStart(2, "0")}</span><span>${esc(label)}</span></p>`;

/** Hero line: the word "side quests" becomes a link down to the sidequests section. */
function heroLine(line: string, word: string) {
  const i = line.indexOf(word);
  if (i < 0) return esc(line);
  return `${esc(line.slice(0, i))}<a class="h-link" href="#sidequests">${esc(word)}</a>${esc(line.slice(i + word.length))}`;
}

function quest(q: Quest, n: number) {
  const href = q.demoUrl ?? q.codeUrl;
  const live = q.status === "Live";
  const idx = String(n).padStart(2, "0");
  const media = `<img class="qc-poster" src="/clips/${esc(q.id)}.webp" width="960" height="600" alt="" loading="lazy" decoding="async">
        <video class="qc-clip" muted loop playsinline preload="none" disablepictureinpicture disableremoteplayback tabindex="-1" data-clip>
          <source src="/clips/${esc(q.id)}.webm" type="video/webm"><source src="/clips/${esc(q.id)}.mp4" type="video/mp4">
        </video>
        <span class="qc-progress" aria-hidden="true"><i></i></span>`;
  const acts = [
    q.demoUrl ? `<a class="demo" ${ext(q.demoUrl)} aria-label="Try ${esc(q.name)} (opens in a new tab)">Try it ${icon.arrow}</a>` : "",
    q.codeUrl ? `<a class="act" ${ext(q.codeUrl)} aria-label="${esc(q.name)} source code on GitHub">Code ${icon.arrow}</a>` : "",
  ].join("");
  return `<li class="qc${q.featured ? " qc-feature" : ""}" data-quest="${esc(q.id)}" style="--accent:${esc(q.accent)}">
      ${href ? `<a class="qc-media" ${ext(href)} tabindex="-1" aria-hidden="true">${media}</a>` : `<div class="qc-media">${media}</div>`}
      <div class="qc-body">
        <p class="qc-meta mono"><span class="qc-n">${idx}</span><span class="qc-status ${live ? "is-live" : "is-wip"}"><i aria-hidden="true"></i>${esc(q.status)}</span><span class="qc-data">${esc(q.data)}</span></p>
        <div class="qc-head">
          <img class="app-icon" src="/icons/${esc(q.id)}.webp" width="96" height="96" alt="" loading="lazy" decoding="async">
          <h3 class="qc-name">${esc(q.name)}</h3>
        </div>
        <p class="qc-line">${esc(q.line)}</p>
        <div class="qc-acts mono">${acts}</div>
      </div>
      <span class="qc-light" aria-hidden="true"><i></i></span>
    </li>`;
}

export function render(c: Content): string {
  const featured = c.sidequests.items.filter((q) => q.featured);
  const rest = c.sidequests.items.filter((q) => !q.featured);
  let n = 0;
  const featuredHtml = featured.map((q) => quest(q, ++n)).join("");
  const restHtml = rest.map((q) => quest(q, ++n)).join("");

  const more = c.sidequests.more
    .map((m) => `<li class="mc" style="--accent:${esc(m.accent)}">
        <a class="mc-link" ${ext(m.codeUrl)}>
          <img class="app-icon" src="/icons/${esc(m.id)}.webp" width="96" height="96" alt="" loading="lazy" decoding="async">
          <span class="mc-text"><span class="mc-name">${esc(m.name)}</span><span class="mc-line">${esc(m.line)}</span></span>
          <span class="mc-go mono">Code ${icon.arrow}</span>
        </a>
      </li>`)
    .join("");

  const log = c.timeline.entries
    .map((e) => `<li class="entry${e.now ? " is-now" : ""}">
        <span class="e-dot" aria-hidden="true"></span>
        <span class="e-when mono">${esc(e.when)}</span>
        <div class="e-main">
          <h3 class="e-title">${esc(e.title)}${e.now ? ' <span class="e-now mono">Now</span>' : ""}</h3>
          <p class="e-text">${esc(e.text)}</p>
        </div>
      </li>`)
    .join("");

  const interests = c.about.interests.map((i) => `<li>${esc(i)}</li>`).join("");
  const roles = c.hero.roles.map((r) => `<li>${esc(r)}</li>`).join("");
  const links = c.contact.links.map((l) => `<li><a ${ext(l.href)} rel="me noopener">${esc(l.label)} ${icon.arrow}</a></li>`).join("");
  const nav = [
    ["now", "Now"],
    ["sidequests", "Sidequests"],
    ["timeline", "Timeline"],
    ["about", "About"],
  ] as const;

  return `
<a class="skip mono" href="#main">Skip to content</a>
<header class="bar" data-bar>
  <a class="brand mono" href="#top"><i class="brand-dot" aria-hidden="true"></i>${esc(c.name)}</a>
  <nav class="nav" id="site-nav" aria-label="Sections">
    <ul class="nav-list mono">${nav.map(([id, label], i) => `<li><a href="#${id}" data-spy="${id}"><span class="nav-n" aria-hidden="true">0${i + 1}</span>${label}</a></li>`).join("")}</ul>
    <div class="nav-sheet-foot">
      <a class="mono" ${ext(c.contact.book.href)}>${esc(c.contact.book.label)} ${icon.arrow}</a>
      <a class="mono" href="mailto:${esc(c.contact.email)}">Email ${icon.arrow}</a>
    </div>
  </nav>
  <a class="book mono" ${ext(c.contact.book.href)}><i aria-hidden="true"></i>${esc(c.contact.book.label)}</a>
  <button class="menu-btn mono" type="button" aria-expanded="false" aria-controls="site-nav" data-menu-btn><span data-menu-label>Menu</span><i aria-hidden="true"></i></button>
</header>

<main id="main">
  <section class="hero" id="top" aria-labelledby="hero-title">
    <div class="avatar" data-avatar>
      <div class="av-tilt" data-tilt>
        <picture>
          <source media="(max-width: 540px)" srcset="/avatar/hero-still-480.webp" width="480" height="480">
          <img class="av-still" src="/avatar/hero-still.webp" width="960" height="960" alt="Nate Victor as a 3D cartoon avatar" fetchpriority="high">
        </picture>
        <video class="av-blink" muted playsinline preload="none" disablepictureinpicture tabindex="-1" aria-hidden="true" data-blink>
          <source src="/avatar/blink.webm" type="video/webm">
          <source src="/avatar/blink.mp4" type="video/mp4">
        </video>
        <i class="av-rim" aria-hidden="true"><i></i></i>
      </div>
    </div>
    <canvas class="swarm" aria-hidden="true"></canvas>
    <div class="hero-copy">
      <h1 id="hero-title" data-hero><span class="h-name">${esc(c.name)}.</span> <span class="h-line">${heroLine(c.hero.line, c.hero.questsWord)}</span></h1>
      <ul class="roles mono" aria-label="Roles">${roles}</ul>
      <a class="see mono" href="#sidequests">${esc(c.hero.cta)} ${icon.down}</a>
    </div>
    <dl class="hero-meta">
      <div><dt class="mono">Now</dt><dd><a href="#now">${esc(c.now.summary)}</a></dd></div>
      <div><dt class="mono">${esc(c.place.city)}</dt><dd><time class="clock" data-clock data-tz="${esc(c.place.tz)}">&nbsp;</time></dd></div>
    </dl>
  </section>

  <section class="sec now" id="now" aria-labelledby="now-h">
    <div class="wrap">
      ${eyebrow(1, c.now.eyebrow)}
      <div class="now-grid">
        <div class="now-copy">
          <h2 class="now-h" id="now-h">${esc(c.now.headline)}</h2>
          <p class="now-text">${esc(c.now.text)}</p>
        </div>
        <a class="now-card" ${ext(c.now.url)}>
          <img class="app-icon" src="/icons/medstrata.webp" width="96" height="96" alt="" decoding="async">
          <span class="now-id"><span class="now-co">${esc(c.now.company)}</span><span class="mono">${esc(c.now.urlLabel)}</span></span>
          <span class="now-go" aria-hidden="true">${icon.arrow}</span>
        </a>
      </div>
    </div>
  </section>

  <section class="sec quests" id="sidequests" aria-labelledby="sq-h">
    <div class="wrap">
      ${eyebrow(2, c.sidequests.eyebrow)}
      <div class="sec-head">
        <h2 class="sec-h" id="sq-h">${esc(c.sidequests.title)}</h2>
        <p class="sec-dek">${esc(c.sidequests.dek)}</p>
      </div>
      <ol class="cards cards-feature" data-quests>${featuredHtml}</ol>
      <ol class="cards cards-grid">${restHtml}</ol>
      <h3 class="more-h mono">${esc(c.sidequests.moreTitle)}</h3>
      <ul class="more">${more}</ul>
    </div>
  </section>

  <section class="sec timeline" id="timeline" aria-labelledby="tl-h">
    <div class="wrap">
      ${eyebrow(3, c.timeline.eyebrow)}
      <div class="sec-head">
        <h2 class="sec-h" id="tl-h">${esc(c.timeline.title)}</h2>
        <p class="sec-dek">${esc(c.timeline.dek)}</p>
      </div>
      <div class="log-wrap">
        <span class="log-rail" aria-hidden="true"><i data-rail></i></span>
        <ol class="log" data-log>${log}</ol>
      </div>
    </div>
  </section>

  <section class="sec about" id="about" aria-labelledby="about-h">
    <div class="wrap">
      ${eyebrow(4, c.about.eyebrow)}
      <div class="about-grid">
        <figure class="portrait">
          <img src="/nate-portrait-bw.webp" width="560" height="560" alt="Black and white portrait of Nate Victor" loading="lazy" decoding="async">
        </figure>
        <div class="about-text">
          <h2 class="sec-h" id="about-h">${esc(c.about.title)}</h2>
          ${c.about.text.map((p) => `<p>${esc(p)}</p>`).join("")}
          <div class="about-row">
            <h3 class="about-label mono">${esc(c.about.interestsLabel)}</h3>
            <ul class="chips">${interests}</ul>
          </div>
          ${c.about.reading ? `<div class="about-row">
            <h3 class="about-label mono">${esc(c.about.reading.label)}</h3>
            <p class="reading"><cite>${esc(c.about.reading.title)}</cite> <span>${esc(c.about.reading.by)}</span></p>
          </div>` : ""}
        </div>
      </div>
    </div>
  </section>

  <section class="sec contact" id="contact" aria-labelledby="contact-h">
    <div class="wrap">
      ${eyebrow(5, c.contact.eyebrow)}
      <div class="contact-grid">
        <div class="contact-copy">
          <h2 class="contact-h" id="contact-h">${esc(c.contact.title)}</h2>
          <p class="contact-text">${esc(c.contact.text)}</p>
        </div>
        <div class="contact-actions">
          <div class="mail">
            <a class="mail-addr" href="mailto:${esc(c.contact.email)}"><span class="mono mail-k">Email</span><span class="mail-v">${esc(c.contact.email)}</span></a>
            <button class="mail-copy mono" type="button" data-copy="${esc(c.contact.email)}" aria-label="Copy email address"><span class="mc-ico">${icon.copy}${icon.check}</span><span data-copy-label>Copy</span></button>
            <span class="sr-only" role="status" aria-live="polite" data-copy-status></span>
          </div>
          <ul class="contact-links mono">
            <li><a class="contact-book" ${ext(c.contact.book.href)}>${esc(c.contact.book.label)} ${icon.arrow}</a></li>
            ${links}
          </ul>
        </div>
      </div>
    </div>
  </section>
</main>

<footer class="foot mono" data-footer>
  <div class="wrap foot-in">
    <span>${esc(c.name)} · ${esc(c.place.city)}</span>
    <span class="foot-note">${esc(c.footer.note)} <a ${ext(c.footer.source)}>Source ${icon.arrow}</a></span>
    <a class="foot-top" href="#top">Back to top ${icon.up}</a>
  </div>
</footer>
`;
}

/** <head> tags generated from the same content: description, Open Graph, and a Person record for search. */
export function renderHead(c: Content): string {
  const person = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: c.name,
    url: c.meta.url,
    image: `${c.meta.url}/nate-portrait-bw.webp`,
    jobTitle: "Founder and CEO",
    worksFor: { "@type": "Organization", name: c.now.company, url: c.now.url },
    address: { "@type": "PostalAddress", addressLocality: "Red Bank", addressRegion: "NJ", addressCountry: "US" },
    sameAs: c.contact.links.map((l) => l.href),
  };
  return [
    `<title>${esc(c.meta.title)}</title>`,
    `<meta name="description" content="${esc(c.meta.description)}" />`,
    `<link rel="canonical" href="${esc(c.meta.url)}/" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${esc(c.name)}" />`,
    `<meta property="og:url" content="${esc(c.meta.url)}/" />`,
    `<meta property="og:title" content="${esc(c.meta.title)}" />`,
    `<meta property="og:description" content="${esc(c.meta.description)}" />`,
    `<meta property="og:image" content="${esc(c.meta.url)}/og.png" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${esc(c.name)}: ${esc(c.hero.line)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(c.meta.title)}" />`,
    `<meta name="twitter:description" content="${esc(c.meta.description)}" />`,
    `<meta name="twitter:image" content="${esc(c.meta.url)}/og.png" />`,
    `<script type="application/ld+json">${JSON.stringify(person).replace(/</g, "\\u003c")}</script>`,
  ].join("\n    ");
}
