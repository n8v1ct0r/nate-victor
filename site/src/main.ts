import "./style.css";
import { startHero } from "./hero";

// The inline head script already added .js, and .motion unless the visitor prefers reduced
// motion or has Save-Data on. Everything below that moves checks this one flag.
const root = document.documentElement;
root.classList.add("js");
const still = !root.classList.contains("motion");
const finePointer = matchMedia("(hover: hover) and (pointer: fine)");

/* Hero: the avatar forms out of particles right after first paint, so the text is always the
   LCP. It doesn't wait for window load (lazy posters below the fold would hold that back);
   startHero awaits the still image's decode itself. */
const hero = document.querySelector<HTMLElement>(".hero");
requestAnimationFrame(() => setTimeout(() => { if (hero) startHero(hero, !still); }, 0));

/* Local time in Red Bank, NJ. Updates on the minute. */
const clock = document.querySelector<HTMLTimeElement>("[data-clock]");
if (clock) {
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: clock.dataset.tz || "America/New_York", hour: "numeric", minute: "2-digit" });
  const iso = new Intl.DateTimeFormat("en-CA", { timeZone: clock.dataset.tz || "America/New_York", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const tick = () => {
    const now = new Date();
    clock.textContent = fmt.format(now);
    clock.dateTime = iso.format(now);
    setTimeout(tick, 60_000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 50);
  };
  tick();
}

/* Top bar: hairline appears once the page scrolls; full-screen menu under 960px. */
const bar = document.querySelector<HTMLElement>("[data-bar]");
const menuBtn = document.querySelector<HTMLButtonElement>("[data-menu-btn]");
const menuLabel = document.querySelector("[data-menu-label]");
if (bar) {
  const onScroll = () => { bar.dataset.scrolled = String(scrollY > 8); };
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}
if (bar && menuBtn) {
  const nav = bar.querySelector<HTMLElement>("nav")!;
  const small = matchMedia("(max-width: 960px)");
  const behind = [...document.querySelectorAll<HTMLElement>("main, footer, .skip")];
  // While the sheet is closed on small screens its links must not be tabbable; while it is
  // open, everything behind it is inert so focus and screen readers stay in the sheet.
  const sync = () => {
    const open = bar.dataset.menu === "open";
    if (small.matches && !open) nav.setAttribute("inert", ""); else nav.removeAttribute("inert");
    behind.forEach((el) => el.toggleAttribute("inert", small.matches && open));
  };
  const setMenu = (open: boolean, focusBack = false) => {
    bar.dataset.menu = open ? "open" : "closed";
    root.dataset.menu = open ? "open" : "closed";
    menuBtn.setAttribute("aria-expanded", String(open));
    if (menuLabel) menuLabel.textContent = open ? "Close" : "Menu";
    sync();
    if (open) nav.querySelector<HTMLElement>("a")?.focus({ preventScroll: true });
    else if (focusBack) menuBtn.focus();
  };
  menuBtn.addEventListener("click", () => setMenu(bar.dataset.menu !== "open"));
  // Any link in the bar (sheet links, brand) closes the sheet on the way to its target.
  bar.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => { if (small.matches && bar.dataset.menu === "open") setMenu(false); }));
  addEventListener("keydown", (e) => {
    if (bar.dataset.menu !== "open") return;
    if (e.key === "Escape") { setMenu(false, true); return; }
    if (e.key !== "Tab") return;
    // Focus cycles through the sheet links (DOM order), then the Close button, then back.
    const items = [...nav.querySelectorAll<HTMLElement>("a"), menuBtn];
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); items[items.length - 1].focus(); }
    else if (!e.shiftKey && (i === items.length - 1 || i < 0)) { e.preventDefault(); items[0].focus(); }
  });
  small.addEventListener("change", () => setMenu(false));
  sync();
}

/* Scrollspy: the nav marks the section you are reading. */
const spyLinks = [...document.querySelectorAll<HTMLAnchorElement>("[data-spy]")];
if (spyLinks.length && "IntersectionObserver" in window) {
  const byId = new Map(spyLinks.map((a) => [a.dataset.spy!, a]));
  const visible = new Set<string>();
  const order = spyLinks.map((a) => a.dataset.spy!);
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) visible.add(e.target.id); else visible.delete(e.target.id); });
    const current = order.find((id) => visible.has(id));
    byId.forEach((a, id) => { if (id === current) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current"); });
  }, { rootMargin: "-45% 0px -50% 0px" });
  order.forEach((id) => { const s = document.getElementById(id); if (s) io.observe(s); });
}

/* Reveal: everything renders visible. The hide is only armed on the first real scroll, and only
   for blocks still below the fold, so screenshots, link previews and crawlers see the full page. */
const revealables = document.querySelectorAll<HTMLElement>(".eyebrow, .sec-head, .now-h, .now-text, .now-card, .qc, .more-h, .mc, .entry, .about-grid, .contact-h, .contact-text, .mail, .contact-links");
if (!still && "IntersectionObserver" in window) {
  const arm = () => {
    const io = new IntersectionObserver((entries) => {
      entries.filter((e) => e.isIntersecting).forEach((e, i) => {
        const el = e.target as HTMLElement;
        el.style.setProperty("--d", `${Math.min(i, 4) * 70}ms`);
        el.classList.add("in");
        io.unobserve(el);
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    revealables.forEach((el) => { if (el.getBoundingClientRect().top > innerHeight) { el.classList.add("reveal"); io.observe(el); } });
  };
  addEventListener("scroll", arm, { once: true, passive: true });
  addEventListener("focusin", (e) => (e.target as Element).closest?.(".reveal:not(.in)")?.classList.add("in"));
}

/* Timeline rail fills as you read; each dot lights when the rail reaches it. */
const rail = document.querySelector<HTMLElement>("[data-rail]");
const log = document.querySelector<HTMLElement>("[data-log]");
if (rail && log) {
  const entries = [...log.querySelectorAll<HTMLElement>(".entry")];
  let raf = 0;
  const update = () => {
    raf = 0;
    const r = log.getBoundingClientRect();
    const line = innerHeight * 0.7;
    const p = still ? 1 : Math.min(1, Math.max(0, (line - r.top) / r.height));
    rail.style.setProperty("--p", p.toFixed(4));
    entries.forEach((e) => e.classList.toggle("is-on", still || e.getBoundingClientRect().top + 24 < line));
  };
  const queue = () => { if (!raf) raf = requestAnimationFrame(update); };
  addEventListener("scroll", queue, { passive: true });
  addEventListener("resize", queue, { passive: true });
  update();
}

/* Sidequest previews. Real screen recordings, loaded only when needed:
   - fine pointer: featured clips play while on screen, the rest play on hover
   - touch: the clip most in view plays, one at a time, after a short pause in scrolling
   - reduced motion, Save-Data or a slow connection: posters only
   A "Pause previews" button stops them all, and the choice is remembered. */
type Clip = { video: HTMLVideoElement; frame: HTMLElement; bar: HTMLElement | null; featured: boolean; ratio: number; hovered: boolean };
const clips: Clip[] = [];
document.querySelectorAll<HTMLElement>(".qc").forEach((card) => {
  const video = card.querySelector<HTMLVideoElement>("video[data-clip]");
  const frame = card.querySelector<HTMLElement>(".qc-media");
  if (!video || !frame) return;
  const clip: Clip = { video, frame, bar: frame.querySelector<HTMLElement>(".qc-progress i"), featured: card.classList.contains("qc-feature"), ratio: 0, hovered: false };
  clips.push(clip);
  card.addEventListener("pointerenter", (e) => { if (e.pointerType !== "touch") { clip.hovered = true; decide(); } });
  card.addEventListener("pointerleave", () => { clip.hovered = false; decide(); });
});

const conn = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection;
const slowNet = /(^|-)2g$|^3g$/.test(conn?.effectiveType ?? "");
const toggle = document.querySelector<HTMLButtonElement>("[data-previews]");
const PREF = "previews";
let paused = false;
try { paused = localStorage.getItem(PREF) === "off"; } catch { /* storage blocked: default on */ }
const previewsOn = () => !still && !slowNet && !paused;

let ticking = 0;
const progress = () => {
  ticking = 0;
  let any = false;
  clips.forEach((c) => {
    if (c.video.paused || !c.video.duration) return;
    any = true;
    c.bar?.style.setProperty("--p", (c.video.currentTime / c.video.duration).toFixed(4));
  });
  if (any) ticking = requestAnimationFrame(progress);
};
const play = (c: Clip) => {
  if (!c.video.isConnected || !c.video.paused) return;
  c.video.play().then(() => { if (!ticking) ticking = requestAnimationFrame(progress); }).catch(() => {});
};
const pause = (c: Clip) => { if (!c.video.paused) c.video.pause(); c.frame.dataset.playing = "false"; };

let dwell = 0;
let lastBest: Clip | null = null;
function decide() {
  clearTimeout(dwell);
  if (!previewsOn() || document.hidden) { clips.forEach(pause); return; }
  if (finePointer.matches) {
    clips.forEach((c) => ((c.featured && c.ratio >= 0.5) || (c.hovered && c.ratio > 0) ? play(c) : pause(c)));
    return;
  }
  const best = clips.reduce<Clip | null>((b, c) => (c.ratio >= 0.6 && (!b || c.ratio > b.ratio) ? c : b), null);
  clips.forEach((c) => { if (c !== best) pause(c); });
  if (!best) { lastBest = null; return; }
  // On touch, wait until the scroll settles on a card so a quick flick doesn't download every clip.
  if (best === lastBest && !best.video.paused) return;
  lastBest = best;
  dwell = window.setTimeout(() => play(best), 450);
}

if (clips.length && !still && !slowNet) {
  clips.forEach((c) => {
    c.video.addEventListener("playing", () => { c.frame.dataset.playing = "true"; });
    // If neither source can play, drop the video and keep the poster.
    c.video.querySelectorAll("source").forEach((s) => s.addEventListener("error", () => {
      if (c.video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) c.video.remove();
    }));
  });
  if ("IntersectionObserver" in window) {
    // Measure the recording itself, not the whole card, and ignore the strip under the fixed bar.
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { const c = clips.find((x) => x.frame === e.target); if (c) c.ratio = e.isIntersecting ? e.intersectionRatio : 0; });
      decide();
    }, { threshold: [0, 0.25, 0.5, 0.6, 0.75, 0.9, 1], rootMargin: "-64px 0px 0px 0px" });
    clips.forEach((c) => io.observe(c.frame));
  }
  document.addEventListener("visibilitychange", decide);

  if (toggle) {
    toggle.hidden = false;
    const render = () => {
      toggle.setAttribute("aria-pressed", String(paused));
      root.dataset.clips = paused ? "off" : "on";
    };
    toggle.addEventListener("click", () => {
      paused = !paused;
      try { localStorage.setItem(PREF, paused ? "off" : "on"); } catch { /* ignore */ }
      render();
      decide();
    });
    render();
  }

  // A soft light follows the pointer across each card.
  document.querySelectorAll<HTMLElement>(".qc").forEach((card) => {
    const light = card.querySelector<HTMLElement>(".qc-light i");
    if (!light) return;
    let raf = 0, x = 0, y = 0;
    card.addEventListener("pointermove", (e) => {
      if (!finePointer.matches || e.pointerType === "touch") return;
      const r = card.getBoundingClientRect();
      x = e.clientX - r.left; y = e.clientY - r.top;
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; light.style.setProperty("--lx", `${x}px`); light.style.setProperty("--ly", `${y}px`); });
    });
  });
}

/* Copy email. Clipboard API first, then the old execCommand route; if both are blocked, the
   address gets selected so it can be copied by hand. Never navigates away. */
const legacyCopy = (text: string) => {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
  document.body.append(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand("copy"); } catch { ok = false; }
  ta.remove();
  return ok;
};
document.querySelectorAll<HTMLButtonElement>("[data-copy]").forEach((btn) => {
  const label = btn.querySelector("[data-copy-label]");
  const status = btn.parentElement?.querySelector("[data-copy-status]");
  const value = btn.parentElement?.querySelector<HTMLElement>(".mail-v");
  let t = 0;
  const say = (copied: boolean, msg: string) => {
    btn.dataset.copied = String(copied);
    if (label) label.textContent = copied ? "Copied" : "Copy";
    if (status) status.textContent = msg;
  };
  btn.addEventListener("click", async () => {
    const text = btn.dataset.copy!;
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch { ok = legacyCopy(text); }
    clearTimeout(t);
    if (ok) {
      say(true, "Email address copied");
      t = window.setTimeout(() => say(false, ""), 2200);
    } else if (value) {
      const range = document.createRange();
      range.selectNodeContents(value);
      const sel = getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      say(false, "Email address selected");
    }
  });
});

/* For the people who open the console. */
console.log(
  "%cHey, you opened the console.%c\nThis site is plain TypeScript and CSS, no framework. Source: https://github.com/n8v1ct0r/nate-victor\nIf you like poking at things, try a sidequest. If you want to build something together: " + (document.querySelector<HTMLElement>("[data-copy]")?.dataset.copy ?? ""),
  "font: 600 13px/1.6 system-ui; color: #3ddc84",
  "font: 12px/1.6 ui-monospace, monospace; color: #9a9a9a",
);
