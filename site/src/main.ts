import "./style.css";
import { startHero } from "./hero";

// The inline script in index.html adds .js and, unless reduced motion or Save-Data is on, .motion.
const root = document.documentElement;
root.classList.add("js");
const noMotion = !root.classList.contains("motion");

// Hero starts after load so the text and the still image are the first paint.
const hero = document.querySelector<HTMLElement>(".hero");
const boot = () => {
  if (hero) startHero(hero, !noMotion);
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
  addEventListener("keydown", (e) => {
    if (e.key === "Escape" && bar.dataset.menu === "open") {
      setMenu(false);
      menuBtn.focus();
    }
  });
  matchMedia("(min-width: 961px)").addEventListener("change", (m) => {
    if (m.matches) setMenu(false);
  });
}

const finePointer = matchMedia("(hover: hover) and (pointer: fine)");

// Reveals and count-ups. Everything renders visible by default: the hide is only armed on the
// first real scroll, and only for blocks still below the fold at that moment. Screenshots, link
// previews and crawlers that never scroll always see the full page.
const revealables = document.querySelectorAll<HTMLElement>(".sec-h, .build, .qc, .more-h, .entry, .about, .closing p, .closing .cta");
const counters = document.querySelectorAll<HTMLElement>(".count");
if (!noMotion && "IntersectionObserver" in window) {
  const arm = () => {
    // Blocks entering together are staggered 80ms apart (capped at 320ms).
    const revealIO = new IntersectionObserver(
      (entries) => {
        entries
          .filter((e) => e.isIntersecting)
          .forEach((e, i) => {
            const el = e.target as HTMLElement;
            el.style.setProperty("--d", `${Math.min(i, 4) * 80}ms`);
            el.classList.add("in");
            revealIO.unobserve(el);
          });
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    revealables.forEach((el) => {
      if (el.getBoundingClientRect().top > innerHeight) {
        el.classList.add("reveal");
        revealIO.observe(el);
      }
    });

    const countIO = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          countIO.unobserve(e.target);
          countUp(e.target as HTMLElement);
        }),
      { threshold: 1 },
    );
    counters.forEach((el) => {
      if (el.getBoundingClientRect().top <= innerHeight) return;
      el.dataset.final = el.textContent ?? "";
      el.textContent = formatCount(el, 0);
      countIO.observe(el);
    });
  };
  addEventListener("scroll", arm, { once: true, passive: true });
}

// "$23K+" style label for a running value.
function formatCount(el: HTMLElement, n: number) {
  const pre = el.dataset.pre ?? "";
  if (n < 1e3) return `${pre}${Math.round(n)}+`;
  if (n < 1e6) return `${pre}${Math.floor(n / 1e3)}K+`;
  return `${pre}${Math.floor(n / 1e6)}M+`;
}

// Counts from 0 to data-to (in data-unit) over 1.4s with an ease-out-expo, then restores the exact text.
function countUp(el: HTMLElement) {
  const target = Number(el.dataset.to) * (el.dataset.unit === "M" ? 1e6 : 1e3);
  const final = el.dataset.final ?? el.textContent ?? "";
  el.style.minWidth = "5ch";
  el.style.textAlign = "right";
  const DURATION = 1400;
  const start = performance.now();
  const tick = (now: number) => {
    const p = Math.min(1, (now - start) / DURATION);
    const eased = 1 - Math.pow(2, -10 * p);
    el.textContent = p < 1 ? formatCount(el, target * eased) : final;
    if (p < 1) requestAnimationFrame(tick);
    else {
      el.style.minWidth = "";
      el.style.textAlign = "";
      el.classList.add("done");
    }
  };
  requestAnimationFrame(tick);
}

// Aura: pause the drifting gradients while their section group is off screen.
if (!noMotion && "IntersectionObserver" in window) {
  document.querySelectorAll<HTMLElement>("[data-aura]").forEach((aura) => {
    if (!aura.parentElement) return;
    new IntersectionObserver(([entry]) => {
      aura.dataset.paused = String(!entry.isIntersecting);
    }).observe(aura.parentElement);
  });
}

// Timeline rail fills as the list passes 70% of the viewport height.
const rail = document.querySelector<HTMLElement>("[data-rail]");
const log = document.querySelector<HTMLElement>("[data-log]");
if (rail && log && !noMotion) {
  let raf = 0;
  const update = () => {
    raf = 0;
    const r = log.getBoundingClientRect();
    const progress = Math.min(1, Math.max(0, (innerHeight * 0.7 - r.top) / r.height));
    rail.style.setProperty("--p", progress.toFixed(4));
  };
  const schedule = () => {
    if (!raf) raf = requestAnimationFrame(update);
  };
  addEventListener("scroll", schedule, { passive: true });
  addEventListener("resize", schedule, { passive: true });
  update();
}

const cards = [...document.querySelectorAll<HTMLElement>(".qc")];

// Card clips: with a fine pointer a clip plays while hovered (and on screen); on touch it plays
// while at least half the card is visible. The poster stays until the clip is actually playing.
if (!noMotion) {
  type Clip = { video: HTMLVideoElement; frame: HTMLElement; hovered: boolean; visible: number };
  const clips = new Map<Element, Clip>();
  cards.forEach((card) => {
    const video = card.querySelector<HTMLVideoElement>("video[data-clip]");
    const frame = card.querySelector<HTMLElement>(".qc-media");
    if (!video || !frame) return;
    clips.set(card, { video, frame, hovered: false, visible: 0 });
    video.addEventListener("playing", () => {
      frame.dataset.playing = "true";
    });
    // No playable source: drop the video so the poster is all that remains.
    video.querySelectorAll("source").forEach((source) =>
      source.addEventListener("error", () => {
        if (video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) video.remove();
      }),
    );
  });

  const sync = (card: Element) => {
    const clip = clips.get(card);
    if (!clip || !clip.video.isConnected) return;
    const play = clip.visible > 0 && (finePointer.matches ? clip.hovered : clip.visible >= 0.5);
    if (play && clip.video.paused) clip.video.play().catch(() => {});
    else if (!play && !clip.video.paused) clip.video.pause();
    if (!play && finePointer.matches) clip.frame.dataset.playing = "false";
  };

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          const clip = clips.get(e.target);
          if (!clip) return;
          clip.visible = e.isIntersecting ? e.intersectionRatio : 0;
          sync(e.target);
        }),
      { threshold: [0, 0.5, 0.75] },
    );
    clips.forEach((_, card) => io.observe(card));
  }

  cards.forEach((card) => {
    const clip = clips.get(card);
    if (!clip) return;
    card.addEventListener("pointerenter", (e) => {
      if (e.pointerType === "touch") return;
      clip.hovered = true;
      sync(card);
    });
    card.addEventListener("pointerleave", () => {
      clip.hovered = false;
      sync(card);
    });
  });
}

if (!noMotion) {
  // Card pointer light: a soft accent spot follows the mouse inside each card.
  cards.forEach((card) => {
    const light = card.querySelector<HTMLElement>(".qc-light i");
    if (!light) return;
    let raf = 0;
    let x = 0;
    let y = 0;
    card.addEventListener("pointermove", (e) => {
      if (!finePointer.matches || e.pointerType === "touch") return;
      const r = card.getBoundingClientRect();
      x = e.clientX - r.left;
      y = e.clientY - r.top;
      if (!raf)
        raf = requestAnimationFrame(() => {
          raf = 0;
          light.style.setProperty("--lx", `${x}px`);
          light.style.setProperty("--ly", `${y}px`);
        });
    });
  });

  // Magnetic buttons: drift up to 4px x 3px toward the pointer (CSS reads --tx/--ty).
  document.querySelectorAll<HTMLElement>("[data-magnet]").forEach((el) => {
    el.addEventListener("pointermove", (e) => {
      if (!finePointer.matches || e.pointerType === "touch") return;
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      el.dataset.magnetOn = "";
      el.style.setProperty("--tx", `${(dx * 4).toFixed(2)}px`);
      el.style.setProperty("--ty", `${(dy * 3).toFixed(2)}px`);
    });
    el.addEventListener("pointerleave", () => {
      delete el.dataset.magnetOn;
      el.style.setProperty("--tx", "0px");
      el.style.setProperty("--ty", "0px");
    });
  });
}
