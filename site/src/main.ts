import "./style.css";
import { startSwarm } from "./swarm";

document.documentElement.classList.add("js");
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;

// Clock: real local time in Red Bank, NJ.
const clock = document.querySelector("[data-clock]");
const fmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
const tickClock = () => { if (clock) clock.textContent = fmt.format(new Date()); };
tickClock();
setInterval(tickClock, 1000);

// Hero swarm starts after first paint so the text is always the LCP.
const canvas = document.querySelector<HTMLCanvasElement>(".swarm");
const boot = () => {
  if (!canvas) return;
  startSwarm(canvas, {
    agents: document.querySelector('[data-hud="agents"]'),
    fps: document.querySelector('[data-hud="fps"]'),
    state: document.querySelector('[data-hud="state"]'),
  }, { still: reduced || saveData }).catch(() => { /* image failed: the hero stays text only */ });
};
if (document.readyState === "complete") requestAnimationFrame(() => setTimeout(boot, 0));
else addEventListener("load", () => setTimeout(boot, 0), { once: true });

// Mobile menu: the nav collapses behind a button under 960px.
const bar = document.querySelector<HTMLElement>(".bar");
const menuBtn = document.querySelector<HTMLButtonElement>("[data-menu-btn]");
const menuLabel = document.querySelector("[data-menu-label]");
if (bar && menuBtn) {
  const setMenu = (open: boolean) => {
    bar.dataset.menu = open ? "open" : "closed";
    menuBtn.setAttribute("aria-expanded", String(open));
    if (menuLabel) menuLabel.textContent = open ? "Close" : "Menu";
  };
  menuBtn.addEventListener("click", () => setMenu(bar.dataset.menu !== "open"));
  bar.querySelectorAll("nav a").forEach((a) => a.addEventListener("click", () => setMenu(false)));
  addEventListener("keydown", (e) => { if (e.key === "Escape" && bar.dataset.menu === "open") { setMenu(false); menuBtn.focus(); } });
  matchMedia("(min-width: 961px)").addEventListener("change", (m) => { if (m.matches) setMenu(false); });
}

// Rows fade up once as they enter. Everything renders visible by default: the hide is only
// armed on the first real scroll, and only for rows still below the fold at that moment.
// Screenshots, link previews and crawlers that never scroll always see the full page.
const rows = document.querySelectorAll<HTMLElement>(".build, .quest, .entry, .lessons li, .about, .closing p, .closing .cta");
if (!reduced && "IntersectionObserver" in window) {
  const arm = () => {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px" });
    rows.forEach((r) => { if (r.getBoundingClientRect().top > innerHeight) { r.classList.add("reveal"); io.observe(r); } });
  };
  addEventListener("scroll", arm, { once: true, passive: true });
}

// Sidequest hover preview: a square card parked beside the hovered row's title.
// It never covers the title or the row's actions; if there is no room, it stays closed.
const preview = document.querySelector<HTMLElement>("[data-preview]");
const strip = preview?.querySelector<HTMLElement>(".strip");
const list = document.querySelector<HTMLElement>("[data-quests]");
const canHover = matchMedia("(hover: hover) and (min-width: 961px)");
if (preview && strip && list) {
  const quests = [...list.querySelectorAll<HTMLElement>(".quest")];
  const GAP = 28;
  // Beside the title: start right of it, then sit above the row's own text and meta
  // (over the dimmed neighbour), or below it if the top of the viewport is in the way.
  const place = (q: HTMLElement) => {
    const t = q.querySelector<HTMLElement>(".q-title")!.getBoundingClientRect();
    const size = preview.offsetWidth;
    const left = t.right + GAP;
    const acts = q.querySelector<HTMLElement>(".q-acts")?.getBoundingClientRect();
    const limit = (acts ? acts.left : q.getBoundingClientRect().right) - GAP;
    if (left + size > limit) return false;
    const blocks = [...q.querySelectorAll<HTMLElement>(".q-line, .q-status, .q-data, .q-acts")]
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width && r.right > left && r.left < left + size);
    const above = Math.min(t.top + t.height / 2 + size / 2, ...blocks.map((r) => r.top - 12)) - size;
    const below = Math.max(t.top + t.height / 2 - size / 2, ...blocks.map((r) => r.bottom + 12));
    const top = above >= 72 ? above : below + size <= innerHeight - 8 ? below : NaN;
    if (Number.isNaN(top)) return false;
    preview.style.transform = `translate3d(${left}px, ${top}px, 0)`;
    return true;
  };
  let cur: HTMLElement | null = null;
  const close = () => { preview.dataset.open = "false"; cur = null; };
  quests.forEach((q, i) => {
    q.addEventListener("pointerenter", (e) => {
      if (!canHover.matches || e.pointerType === "touch") return;
      const wasOpen = preview.dataset.open === "true";
      preview.dataset.glide = wasOpen ? "true" : "false";
      if (!place(q)) return close();
      cur = q;
      strip.style.transform = `translateY(${-i * 100 / quests.length}%)`;
      preview.dataset.open = "true";
      preview.dataset.active = q.dataset.quest;
    });
  });
  list.addEventListener("pointerleave", close);
  // Wheel scrolling under a still pointer: keep the card pinned to its row, or close it.
  addEventListener("scroll", () => {
    if (!cur) return;
    preview.dataset.glide = "false";
    if (!cur.matches(":hover") || !place(cur)) close();
  }, { passive: true });
}
