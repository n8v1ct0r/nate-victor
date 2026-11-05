// Build-time renderer: turns content.json into static HTML so every word is in the first paint.
// vite.config.ts swaps the result in for <!--APP--> in index.html. Media paths follow the
// sidequest id: /clips/<id>.{webp,webm,mp4} for demo cards, /icons/<id>.webp for every card.

type Link = { label: string; url: string };

/** A sidequest card. Cards with a demoUrl get a hover clip; code-only cards show their icon. */
export type Quest = {
  id: string;
  name: string;
  line: string;
  accent: string;
  demoUrl: string | null;
  codeUrl: string | null;
};

export type TimelineEntry = {
  when: string;
  name: string;
  state: "live" | "archived" | "plain";
  text: string;
};

export type Content = {
  _rules: string;
  name: string;
  bookCall: Link;
  nav: { label: string; href: string }[];
  hero: {
    name: string;
    line: string;
    roles: string[];
    seeDemos: string;
    avatarAlt: string;
    status: { label: string; value: string }[];
  };
  building: {
    heading: string;
    name: string;
    url: string;
    logo: string;
    role: string;
    line: string;
    metricLabel: string;
    metric: string;
  };
  sidequests: {
    heading: string;
    demoLabel: string;
    codeLabel: string;
    items: Quest[];
    more: { heading: string; items: Quest[] };
  };
  timeline: { heading: string; entries: TimelineEntry[] };
  about: {
    heading: string;
    portrait: string;
    portraitAlt: string;
    intro: string;
    sub: string;
    background: string;
    companiesLabel: string;
    companies: { name: string; url: string; color: string; line: string }[];
    away: { label: string; text: string };
    book: { label: string; title: string; by: string };
  };
  closing: { line: string; cta: Link };
  footer: { links: (Link & { rel?: "me"; newTab?: boolean })[] };
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const icon = {
  arrow: '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 11 11 5M6 5h5v5"/></svg>',
  down: '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M4 9l4 4 4-4"/></svg>',
};

/** href plus target/rel. rel "me" marks profile links; new tabs always get noopener. */
const linkAttrs = (url: string, opts: { rel?: "me"; newTab?: boolean } = {}) => {
  const rel = [opts.rel, opts.rel || opts.newTab ? "noopener" : ""].filter(Boolean).join(" ");
  return `href="${esc(url)}"${opts.newTab ? ' target="_blank"' : ""}${rel ? ` rel="${rel}"` : ""}`;
};
const ext = (url: string) => linkAttrs(url, { newTab: true });

// "1M+" and "$23K+" in the metric become count-up spans (see countUp in main.ts).
// min-width holds the final width in ch so the line does not reflow while counting.
const metric = (text: string) =>
  text
    .split(/(\$?\d+[KM]\+)/)
    .map((part, i) => {
      if (i % 2 === 0) return esc(part);
      const [, pre, to, unit] = /^(\$?)(\d+)([KM])\+$/.exec(part)!;
      return `<span class="count" data-pre="${esc(pre)}" data-to="${to}" data-unit="${unit}" style="min-width:${part.length}ch">${esc(part)}</span>`;
    })
    .join("");

export function render(c: Content): string {
  const { hero, building: b, sidequests: sq, about } = c;

  const nav = c.nav.map((n) => `<li><a href="${esc(n.href)}">${esc(n.label)}</a></li>`).join("\n    ");

  const status = hero.status.map((s) => `<div><dt class="mono">${esc(s.label)}</dt><dd>${esc(s.value)}</dd></div>`).join("");

  // One card shape for both lists. Demo cards: poster + clip, "Open demo" plus an optional Code link.
  // Code-only cards: the icon stands in for the clip and Code becomes the primary action.
  const card = (q: Quest) => {
    const primary = q.demoUrl ? { label: sq.demoLabel, url: q.demoUrl } : { label: sq.codeLabel, url: q.codeUrl ?? "" };
    const id = esc(q.id);
    const media = q.demoUrl
      ? `<img class="qc-poster" src="/clips/${id}.webp" width="960" height="600" alt="" loading="lazy" decoding="async"><video class="qc-clip" muted loop playsinline preload="none" disablepictureinpicture disableremoteplayback tabindex="-1" data-clip><source src="/clips/${id}.webm" type="video/webm"><source src="/clips/${id}.mp4" type="video/mp4"></video>`
      : `<span class="qc-fallback"><img class="app-icon" src="/icons/${id}.webp" width="320" height="320" alt="" loading="lazy" decoding="async"></span>`;
    const code = q.demoUrl && q.codeUrl ? `<a class="act" ${ext(q.codeUrl)} aria-label="${esc(sq.codeLabel)}: ${esc(q.name)}">${esc(sq.codeLabel)} ${icon.arrow}</a>` : "";
    return `<li class="qc${q.demoUrl ? "" : " qc-code"}" data-quest="${id}" style="--accent:${esc(q.accent)}">
      <a class="qc-media" ${ext(primary.url)} tabindex="-1" aria-hidden="true">${media}</a>
      <div class="qc-body">
        <img class="app-icon" src="/icons/${id}.webp" width="96" height="96" alt="" loading="lazy" decoding="async">
        <div class="qc-text"><h3 class="qc-name">${esc(q.name)}</h3><p class="qc-line">${esc(q.line)}</p></div>
      </div>
      <div class="qc-acts mono">
        <a class="demo" ${ext(primary.url)} aria-label="${esc(primary.label)}: ${esc(q.name)}" data-magnet>${esc(primary.label)} ${icon.arrow}</a>${code}
      </div>
      <span class="qc-light" aria-hidden="true"><i></i></span>
    </li>`;
  };

  const tags = { live: "Live", archived: "Archived", plain: "" } as const;
  const log = c.timeline.entries.map((e) => `<li class="entry${e.state === "plain" ? "" : ` is-${e.state}`}">
      <span class="e-when mono">${esc(e.when)}</span>
      <span class="e-tag mono">${tags[e.state]}</span>
      <div class="e-body"><h3 class="e-name">${esc(e.name)}</h3><p>${esc(e.text)}</p></div>
    </li>`).join("");

  const companies = about.companies.map((co) => `<li>
          <a class="co-name" ${ext(co.url)} style="--co:${esc(co.color)}">${esc(co.name)} ${icon.arrow}</a>
          <p>${esc(co.line)}</p>
        </li>`).join("");

  const foot = c.footer.links.map((l) => `<li><a ${linkAttrs(l.url, l)}>${esc(l.label)} ${icon.arrow}</a></li>`).join("");

  const cta = c.closing.cta;

  return `
<a class="skip mono" href="#main">Skip to content</a>
<header class="bar mono">
  <a class="brand" href="#top">${esc(c.name)}</a>
  <nav id="site-nav" aria-label="Sections"><ul>
    ${nav}
    <li class="nav-book"><a ${ext(c.bookCall.url)}>${esc(c.bookCall.label)} ${icon.arrow}</a></li>
  </ul></nav>
  <a class="book" ${ext(c.bookCall.url)} data-magnet><i aria-hidden="true"></i>${esc(c.bookCall.label)}</a>
  <button class="menu-btn mono" type="button" aria-expanded="false" aria-controls="site-nav" data-menu-btn><span data-menu-label>Menu</span><i aria-hidden="true"></i></button>
</header>

<main id="main">
  <div class="lit">
  <div class="aura" aria-hidden="true" data-aura><i class="a1"></i><i class="a2"></i><i class="a3"></i><i class="a4"></i></div>
  <section class="hero" id="top" aria-labelledby="hero-title">
    <div class="avatar" data-avatar>
      <div class="av-tilt" data-tilt>
        <picture>
          <source media="(max-width: 540px)" srcset="/avatar/hero-still-480.webp" width="480" height="480">
          <img class="av-still" src="/avatar/hero-still.webp" width="960" height="960" alt="${esc(hero.avatarAlt)}" fetchpriority="high">
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
      <h1 id="hero-title" data-hero><span class="h-name">${esc(hero.name)}</span> <span class="h-rest">${esc(hero.line)}</span></h1>
      <p class="roles">${esc(hero.roles.map((r) => `${r}.`).join(" "))}</p>
      <a class="see mono" href="#sidequests">${esc(hero.seeDemos)} ${icon.down}</a>
    </div>
    <dl class="now" aria-label="Status">${status}</dl>
  </section>

  <section class="sec" id="building" aria-labelledby="building-h">
    <h2 class="sec-h" id="building-h">${esc(b.heading)}</h2>
    <article class="build">
      <div class="build-id">
        <h3 class="build-name"><a class="build-logo" ${ext(b.url)}><img src="${esc(b.logo)}" width="360" height="96" alt="${esc(b.name)}" decoding="async"></a></h3>
        <p class="build-role mono">${esc(b.role)}</p>
      </div>
      <p class="build-line">${esc(b.line)}</p>
      <dl class="build-meta mono">
        <div><dt>${esc(b.metricLabel)}</dt><dd>${metric(b.metric)}</dd></div>
      </dl>
    </article>
  </section>

  <section class="sec" id="sidequests" aria-labelledby="sq-h">
    <h2 class="sec-h" id="sq-h">${esc(sq.heading)}</h2>
    <ol class="cards" data-quests>${sq.items.map(card).join("")}</ol>
    <h3 class="more-h mono">${esc(sq.more.heading)}</h3><ul class="cards cards-code">${sq.more.items.map(card).join("")}</ul>
  </section>
  </div>

  <div class="lit lit-2">
  <div class="aura aura-2" aria-hidden="true" data-aura><i class="a1"></i><i class="a2"></i><i class="a3"></i></div>
  <section class="sec" id="log" aria-labelledby="log-h">
    <h2 class="sec-h" id="log-h">${esc(c.timeline.heading)}</h2>
    <div class="log-wrap"><span class="log-rail" aria-hidden="true"><i data-rail></i></span><ol class="log" data-log>${log}</ol></div>
  </section>

  <section class="sec sec-about" id="about" aria-labelledby="about-h">
    <div class="about-wrap">
      <h2 class="sec-h" id="about-h">${esc(about.heading)}</h2>
      <div class="about">
        <img src="${esc(about.portrait)}" width="560" height="560" alt="${esc(about.portraitAlt)}" loading="lazy" decoding="async">
        <div class="about-text">
        <div class="about-head"><p class="about-intro">${esc(about.intro)}</p><p class="about-sub">${esc(about.sub)}</p></div>
        <p class="about-bg">${esc(about.background)}</p>
        <div class="about-work"><h3 class="about-label mono">${esc(about.companiesLabel)}</h3><ul class="about-cos">${companies}</ul></div>
        <div class="about-quiet">
          <div><h3 class="about-label mono">${esc(about.away.label)}</h3><p>${esc(about.away.text)}</p></div>
          <div><h3 class="about-label mono">${esc(about.book.label)}</h3><p><cite>${esc(about.book.title)}</cite><span class="about-by">${esc(about.book.by)}</span></p></div>
        </div></div>
      </div>
    </div>
  </section>

  <section class="closing" aria-label="Closing">
    <p>${esc(c.closing.line)}</p>
    <a class="cta" ${linkAttrs(cta.url, { rel: "me", newTab: true })}>
      <span class="cta-k mono">${esc(cta.label)}</span>
      <span class="cta-v">${esc(cta.url.replace(/^https?:\/\/(www\.)?/, ""))}</span>
      <span class="cta-go" aria-hidden="true">${icon.arrow}</span>
    </a>
  </section>
  </div>
</main>

<footer class="foot mono" data-footer>
  <span>${esc(c.name)}</span>
  <ul>${foot}</ul>
</footer>
`;
}
