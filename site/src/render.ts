// Build-time renderer: turns content.json into static HTML so every word is in the first paint.
type Quest = { id: string; n: string; name: string; line: string; status: string; tryUrl: string | null; codeUrl: string | null; data: string };
type Entry = { when: string; name: string; text: string; archived?: boolean };
export type Content = {
  name: string;
  hero: string;
  positioning: string[];
  building: { name: string; role: string; line: string; metric: string; locked: boolean; lockedNote?: string };
  sidequests: Quest[];
  timeline: Entry[];
  lessons: string[];
  about: { interests: string[]; location: string };
  closing: string;
  footer: Record<string, string | null>;
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Marks "[needs a number]" so it reads as an open slot, not a typo. Text stays verbatim.
const slot = (s: string) => esc(s).replace(/\[needs a number\]/g, '<span class="slot">[needs a number]</span>');

const icon = {
  lock: '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/></svg>',
  arrow: '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 11 11 5M6 5h5v5"/></svg>',
};

// Motifs take an id suffix so the same drawing can appear twice (hover preview + inline tile).
const motif: Record<string, (k: string) => string> = {
  argus: () => `<circle cx="100" cy="100" r="62"/><ellipse cx="100" cy="100" rx="62" ry="22"/><ellipse cx="100" cy="100" rx="22" ry="62"/><ellipse class="spin" cx="100" cy="100" rx="44" ry="62"/><path d="M38 100h124"/><circle class="ping" cx="74" cy="78" r="3"/><circle class="ping d2" cx="128" cy="112" r="3"/><circle class="ping d3" cx="110" cy="64" r="3"/>`,
  imperium: () => `<path class="grid" d="M40 40h120M40 70h120M40 100h120M40 130h120M40 160h120M40 40v120M70 40v120M100 40v120M130 40v120M160 40v120"/><path class="route" d="M52 148 88 112l28 10 32-58"/><path d="M148 58l6 6-6 6-6-6z"/><circle cx="52" cy="148" r="4"/><circle class="ping" cx="116" cy="122" r="3"/>`,
  photoncar: () => `<path class="trace" d="M30 120c14 0 14-40 28-40s14 52 28 52 14-70 28-70 14 44 28 44 14-24 28-24"/><path class="trace t2" d="M30 150c20 0 20-12 40-12s20 18 40 18 20-20 40-20 20 8 30 8"/><path class="grid" d="M30 60h140M30 100h140M30 140h140"/>`,
  "race-engineer": (k) => `<path id="trk-${k}" d="M54 132c-18-10-16-44 6-52l40-14c22-8 36 4 50 0 18-4 30 14 18 30l-22 30c-10 14-30 18-46 14l-30-6c-6-1-12-1-16-2z"/><circle class="car" r="4"><animateMotion dur="5s" repeatCount="indefinite"><mpath href="#trk-${k}"/></animateMotion></circle><path class="grid" d="M100 66v-14M96 52h8"/>`,
  "claude-learner": () => Array.from({ length: 20 }, (_, i) => {
    const x = 42 + (i % 5) * 24, y = 52 + Math.floor(i / 5) * 24;
    return `<rect class="${[1, 4, 6, 7, 12, 15, 18].includes(i) ? "on" : ""}" x="${x}" y="${y}" width="18" height="18" rx="3"/>`;
  }).join(""),
  usvc: () => `<rect x="44" y="46" width="52" height="104" rx="10"/><rect class="mid" x="74" y="40" width="52" height="116" rx="10"/><rect class="front" x="104" y="46" width="52" height="104" rx="10"/><path d="M114 66h32M114 76h22M114 120h32"/>`,
};

export function render(c: Content): string {
  const pos = c.positioning.map((p) => `<li>${esc(p)}</li>`).join("");

  const ext = (href: string) => `href="${esc(href)}" target="_blank" rel="noopener"`;
  const art = (q: Quest, k: string) => `<svg viewBox="0 0 200 200" aria-hidden="true">${motif[q.id]?.(k) ?? ""}</svg>`;

  const quests = c.sidequests.map((q) => {
    // Actions render only when a real URL exists. No placeholder links.
    const acts = [
      q.tryUrl ? `<a class="act" ${ext(q.tryUrl)}>Try it ${icon.arrow}</a>` : "",
      q.codeUrl ? `<a class="act" ${ext(q.codeUrl)}>Code ${icon.arrow}</a>` : "",
    ].join("");
    const title = q.tryUrl
      ? `<a class="q-link" ${ext(q.tryUrl)}><span class="q-title">${esc(q.name)}</span>${icon.arrow}</a>`
      : `<span class="q-title">${esc(q.name)}</span>`;
    const live = q.status.trim().toLowerCase() === "live" ? "is-live" : "is-wip";
    return `<li class="quest${q.tryUrl ? " has-link" : ""}" data-quest="${esc(q.id)}">
      <span class="q-n mono">${esc(q.n)}</span>
      <div class="q-main"><h3 class="q-name">${title}</h3><p class="q-line">${esc(q.line)}</p></div>
      <span class="q-status mono ${live}"><i class="light" aria-hidden="true"></i>${esc(q.status)}</span>
      <span class="q-data mono">${esc(q.data)}</span>
      ${acts ? `<span class="q-acts mono">${acts}</span>` : ""}
      <div class="q-tile tile tile-${esc(q.id)}">${art(q, `i-${q.id}`)}</div>
    </li>`;
  }).join("");

  const tiles = c.sidequests.map((q) => `<div class="tile tile-${esc(q.id)}">${art(q, `p-${q.id}`)}<span class="mono">${esc(q.n)} ${esc(q.name)}</span></div>`).join("");

  const log = c.timeline.map((e) => `<li class="entry${e.archived ? " is-archived" : ""}">
      <span class="e-when mono">${esc(e.when)}</span>
      <span class="e-tag mono">${e.archived ? "Archived" : ""}</span>
      <div class="e-body"><h3 class="e-name">${esc(e.name)}</h3><p>${slot(e.text)}</p></div>
    </li>`).join("");

  const lessons = c.lessons.map((l) => `<li>${esc(l)}</li>`).join("");
  const interests = c.about.interests.map((i) => `<li>${esc(i)}</li>`).join("");

  const footLinks = [
    ["email", "Email", (v: string) => `mailto:${v}`],
    ["linkedin", "LinkedIn", (v: string) => v],
    ["github", "GitHub", (v: string) => v],
  ] as const;
  const foot = footLinks
    .filter(([k]) => typeof c.footer[k] === "string" && c.footer[k])
    .filter(([k]) => k !== "github") // GitHub is the closing CTA directly above
    .map(([k, label, href]) => `<li><a href="${esc(href(c.footer[k] as string))}"${k === "email" ? "" : ' rel="me noopener"'}>${label} ${icon.arrow}</a></li>`)
    .join("");

  const gh = typeof c.footer.github === "string" && c.footer.github ? c.footer.github : null;
  const b = c.building;
  const [lead, ...restParts] = c.hero.split(". ");
  const rest = restParts.join(". ");

  return `
<a class="skip mono" href="#main">Skip to content</a>
<header class="bar mono">
  <a class="brand" href="#top">${esc(c.name)}</a>
  <nav id="site-nav" aria-label="Sections"><ul>
    <li><a href="#building">Building</a></li>
    <li><a href="#sidequests">Sidequests</a></li>
    <li><a href="#log">Log</a></li>
    <li><a href="#about">About</a></li>
  </ul></nav>
  <span class="clock" aria-hidden="true"><span data-clock>--:--:--</span> ET</span>
  <button class="menu-btn mono" type="button" aria-expanded="false" aria-controls="site-nav" data-menu-btn><span data-menu-label>Menu</span><i aria-hidden="true"></i></button>
</header>

<main id="main">
  <section class="hero" id="top" aria-labelledby="hero-title">
    <canvas class="swarm" aria-hidden="true"></canvas>
    <div class="hero-copy">
      <h1 id="hero-title" data-hero><span class="h-name">${esc(lead)}.</span> <span class="h-rest">${esc(rest)}</span></h1>
      <ul class="roles mono" aria-label="Roles">${pos}</ul>
    </div>
    <dl class="hud mono" aria-hidden="true">
      <div><dt>Agents</dt><dd data-hud="agents">0</dd></div>
      <div><dt>FPS</dt><dd data-hud="fps">0</dd></div>
      <div><dt>State</dt><dd data-hud="state">Idle</dd></div>
    </dl>
  </section>

  <section class="sec" id="building" aria-labelledby="building-h">
    <h2 class="sec-h" id="building-h">Building</h2>
    <article class="build">
      <div class="build-id">
        <h3 class="build-name">${esc(b.name)}</h3>
        <p class="build-role mono">${esc(b.role)}</p>
      </div>
      <p class="build-line">${esc(b.line)}</p>
      <dl class="build-meta mono">
        <div><dt>Metric</dt><dd>${slot(b.metric)}</dd></div>
        ${b.lockedNote ? `<div><dt>Access</dt><dd class="locked">${icon.lock}${esc(b.lockedNote)}</dd></div>` : ""}
      </dl>
    </article>
  </section>

  <section class="sec" id="sidequests" aria-labelledby="sq-h">
    <h2 class="sec-h" id="sq-h">Sidequests</h2>
    <ol class="quests" data-quests>${quests}</ol>
  </section>

  <section class="sec" id="log" aria-labelledby="log-h">
    <h2 class="sec-h" id="log-h">Timeline</h2>
    <ol class="log" data-log>${log}</ol>
  </section>

  <section class="sec" id="lessons" aria-labelledby="lessons-h">
    <h2 class="sec-h" id="lessons-h">Lessons</h2>
    <ol class="lessons">${lessons}</ol>
  </section>

  <section class="sec" id="about" aria-labelledby="about-h">
    <h2 class="sec-h" id="about-h">About</h2>
    <div class="about">
      <img src="/nate-about.webp" width="560" height="560" alt="Portrait of Nate Victor" fetchpriority="low" decoding="async">
      <dl class="about-meta mono">
        <div><dt>Location</dt><dd>${esc(c.about.location)}</dd></div>
        <div><dt>Interests</dt><dd><ul>${interests}</ul></dd></div>
      </dl>
    </div>
  </section>

  <section class="closing" aria-label="Closing">
    <p>${esc(c.closing)}</p>
    ${gh ? `<a class="cta" href="${esc(gh)}" target="_blank" rel="me noopener">
      <span class="cta-k mono">GitHub</span>
      <span class="cta-v">${esc(gh.replace(/^https?:\/\/(www\.)?/, ""))}</span>
      <span class="cta-go" aria-hidden="true">${icon.arrow}</span>
    </a>` : ""}
  </section>
</main>

<footer class="foot mono" data-footer>
  <span>${esc(c.name)}</span>
  <ul>${foot}</ul>
</footer>

<div class="preview" aria-hidden="true" data-preview><div class="strip">${tiles}</div></div>
`;
}
