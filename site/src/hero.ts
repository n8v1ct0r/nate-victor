// Hero avatar. On load, particles sampled from the still image fly in along curved paths and
// "form" the avatar, then the canvas fades out and the still takes over. After that the avatar
// blinks every few seconds and tilts toward a fine pointer. Everything pauses while the hero is
// off screen or the tab is hidden. CSS reads data-av (forming/settled), data-paused, data-blinking.

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

const GRID = 200; // sampling resolution of the still image
const PIXELS = GRID * GRID;

/**
 * Picks `count` particle targets from the image, weighted toward lit areas and edges inside a
 * soft oval (the dark backdrop and corners get almost none). Returns unit coordinates plus a
 * 12-bit color key per particle so drawing can batch by color.
 */
function sampleAvatar(img: HTMLImageElement, count: number) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = GRID;
  const g = canvas.getContext("2d", { willReadFrequently: true });
  if (!g) throw new Error("2d context unavailable");
  g.drawImage(img, 0, 0, GRID, GRID);
  const rgba = g.getImageData(0, 0, GRID, GRID).data;

  const luma = new Float32Array(PIXELS);
  for (let i = 0; i < PIXELS; i++) luma[i] = (0.2126 * rgba[i * 4] + 0.7152 * rgba[i * 4 + 1] + 0.0722 * rgba[i * 4 + 2]) / 255;

  const weight = new Float32Array(PIXELS);
  let total = 0;
  for (let y = 1; y < GRID - 1; y++)
    for (let x = 1; x < GRID - 1; x++) {
      const i = y * GRID + x;
      const body = smoothstep(0.06, 0.14, luma[i]); // drops the near-black backdrop
      const edge = Math.min(1, Math.hypot(luma[i + 1] - luma[i - 1], luma[i + GRID] - luma[i - GRID]) * 5);
      const nx = (x / GRID - 0.5) / 0.5;
      const ny = (y / GRID - 0.46) / 0.54;
      const oval = 1 - smoothstep(0.62, 0.95, Math.hypot(nx, ny));
      const w = (body * (0.3 + 0.7 * luma[i]) + edge * 0.7 * smoothstep(0.04, 0.1, luma[i])) * oval;
      weight[i] = w;
      total += w;
    }

  // Cumulative distribution for inverse transform sampling.
  let run = 0;
  const cdf = new Float32Array(PIXELS);
  for (let i = 0; i < PIXELS; i++) {
    run += weight[i];
    cdf[i] = run / total;
  }

  const ux = new Float32Array(count);
  const uy = new Float32Array(count);
  const key = new Uint16Array(count);
  const colors = new Map<number, string>();
  for (let p = 0; p < count; p++) {
    const r = Math.random();
    let lo = 0;
    let hi = PIXELS - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cdf[mid] < r) lo = mid + 1;
      else hi = mid;
    }
    ux[p] = ((lo % GRID) + Math.random()) / GRID;
    uy[p] = (((lo / GRID) | 0) + Math.random()) / GRID;
    // Brighten slightly, then keep 4 bits per channel.
    const q = (v: number) => Math.min(255, v * 1.12 + 26) >> 4;
    const k = (q(rgba[lo * 4]) << 8) | (q(rgba[lo * 4 + 1]) << 4) | q(rgba[lo * 4 + 2]);
    key[p] = k;
    if (!colors.has(k)) colors.set(k, `rgb(${(k >> 8) * 17},${((k >> 4) & 15) * 17},${(k & 15) * 17})`);
  }
  return { ux, uy, key, colors };
}

/** Starts the hero. With `animate` false the avatar is shown settled and nothing moves. */
export function startHero(hero: HTMLElement, animate: boolean) {
  const avatar = hero.querySelector<HTMLElement>("[data-avatar]");
  const tilt = hero.querySelector<HTMLElement>("[data-tilt]");
  const still = hero.querySelector<HTMLImageElement>(".av-still");
  const blink = hero.querySelector<HTMLVideoElement>("[data-blink]");
  const canvas = hero.querySelector<HTMLCanvasElement>(".swarm");
  if (!animate) {
    hero.dataset.av = "settled";
    return;
  }
  if (!avatar || !tilt || !still || !canvas) return;

  // Active = hero on screen and tab visible.
  let inView = true;
  let pageVisible = !document.hidden;
  const active = () => inView && pageVisible;
  const listeners: (() => void)[] = [];
  const onActiveChange = (fn: () => void) => listeners.push(fn);
  const updateActive = () => {
    hero.dataset.paused = active() ? "false" : "true";
    listeners.forEach((fn) => fn());
  };
  new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    updateActive();
  }).observe(hero);
  document.addEventListener("visibilitychange", () => {
    pageVisible = !document.hidden;
    updateActive();
  });

  const settle = () => {
    if (hero.dataset.av === "settled") return;
    hero.dataset.av = "settled";
    startIdle();
  };

  // Particle forming: ~2.35s total, then the canvas is emptied.
  const form = async () => {
    await still.decode();
    const small = innerWidth <= 540;
    const count = small ? 1200 : 1500;
    const { ux, uy, key, colors } = sampleAvatar(still, count);
    const byColor = Array.from({ length: count }, (_, i) => i).sort((a, b) => key[a] - key[b]);

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2d context unavailable");
    // 1.5x is plenty for 2px dots and keeps a full-hero canvas cheap on retina screens.
    const dpr = Math.min(1.5, devicePixelRatio || 1);
    const heroBox = hero.getBoundingClientRect();
    const avBox = avatar.getBoundingClientRect();
    const W = heroBox.width;
    const H = heroBox.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Each particle travels a quadratic curve from an off-screen start to its target.
    const startX = new Float32Array(count);
    const startY = new Float32Array(count);
    const ctrlX = new Float32Array(count);
    const ctrlY = new Float32Array(count);
    const endX = new Float32Array(count);
    const endY = new Float32Array(count);
    const delay = new Float32Array(count);
    const duration = new Float32Array(count);
    for (let p = 0; p < count; p++) {
      endX[p] = avBox.left - heroBox.left + ux[p] * avBox.width;
      endY[p] = avBox.top - heroBox.top + uy[p] * avBox.height;
      // Desktop: everything streams in from the left. Phone: from both sides, near target height.
      const fromRight = small && Math.random() < 0.5;
      startX[p] = fromRight ? W + 10 + Math.random() * W * 0.3 : -10 - Math.random() * W * 0.3;
      startY[p] = small ? endY[p] + (Math.random() - 0.5) * H * 0.5 : H * (0.12 + Math.random() * 0.8);
      const midX = (startX[p] + endX[p]) / 2;
      const midY = (startY[p] + endY[p]) / 2;
      const dx = endX[p] - startX[p];
      const dy = endY[p] - startY[p];
      const bend = (Math.random() - 0.5) * 0.7;
      ctrlX[p] = midX - dy * bend;
      ctrlY[p] = midY + dx * bend;
      delay[p] = Math.random() * 0.45 + (small ? Math.abs(ux[p] - 0.5) * 0.3 : ux[p] * 0.35);
      duration[p] = 0.95 + Math.random() * 0.35;
    }

    // Particles never draw over the hero text: clip to the hero minus padded text boxes.
    const pad = small ? 10 : 18;
    const textBoxes = [...hero.querySelectorAll(".hero-copy h1, .hero-copy .roles, .hero-copy .hero-acts")].map((el) => {
      const r = el.getBoundingClientRect();
      return [r.left - heroBox.left - pad, r.top - heroBox.top - pad, r.width + pad * 2, r.height + pad * 2] as const;
    });
    const clip = new Path2D();
    clip.rect(0, 0, W, H);
    textBoxes.forEach(([x, y, w, h]) => clip.rect(x, y, w, h));

    hero.dataset.av = "forming";
    const FORM = 1.75; // seconds until the still takes over
    const FADE = 0.6; // canvas fade after that
    const END = FORM + FADE;
    const dot = small ? 1.7 : 2;
    let t = 0;
    let last = 0;
    let raf = 0;
    // Slow-device guard: if the first frames come in well under 30fps, skip straight to the
    // settled still instead of dragging a janky intro out for seconds.
    const firstGaps: number[] = [];

    // Position at progress p along particle i's curve (ease-out cubic), written to out[o], out[o + 1].
    const pointAt = (i: number, p: number, out: Float32Array, o: number) => {
      const e = 1 - Math.pow(1 - p, 3);
      const u = 1 - e;
      out[o] = u * u * startX[i] + 2 * u * e * ctrlX[i] + e * e * endX[i];
      out[o + 1] = u * u * startY[i] + 2 * u * e * ctrlY[i] + e * e * endY[i];
    };
    const head = new Float32Array(2);
    const tail = new Float32Array(2);

    const frame = (now: number) => {
      raf = 0;
      if (!active()) return;
      const gap = now - last;
      last = now;
      // Real elapsed time keeps the intro on schedule on slow devices; only a long gap
      // (tab switch, scroll away) counts as a pause.
      t += gap > 250 ? 1 / 60 : gap / 1000;
      if (firstGaps.length < 8) {
        firstGaps.push(gap);
        if (firstGaps.length === 8 && firstGaps.slice(2).sort((a, b) => a - b)[3] > 34) {
          ctx.clearRect(0, 0, W, H);
          canvas.width = canvas.height = 0;
          t = END;
          settle();
          return;
        }
      }
      ctx.clearRect(0, 0, W, H);
      if (t >= FORM) settle();
      if (t >= END) {
        canvas.width = canvas.height = 0;
        return;
      }
      ctx.save();
      ctx.clip(clip, "evenodd");
      ctx.globalAlpha = 1 - smoothstep(FORM, END, t);

      // Green motion trails for particles still in flight.
      ctx.beginPath();
      for (let i = 0; i < count; i++) {
        const p = (t - delay[i]) / duration[i];
        if (p <= 0 || p >= 0.97) continue;
        pointAt(i, p, head, 0);
        pointAt(i, Math.max(0, p - 0.045), tail, 0);
        ctx.moveTo(head[0], head[1]);
        ctx.lineTo(tail[0], tail[1]);
      }
      ctx.strokeStyle = "rgba(61,220,132,0.5)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Colored dots, drawn in color order so fillStyle changes as rarely as possible.
      let current = -1;
      for (let n = 0; n < count; n++) {
        const i = byColor[n];
        const p = (t - delay[i]) / duration[i];
        if (p <= 0) continue;
        if (key[i] !== current) {
          current = key[i];
          ctx.fillStyle = colors.get(current)!;
        }
        pointAt(i, Math.min(1, p), head, 0);
        ctx.fillRect(head[0] - dot / 2, head[1] - dot / 2, dot, dot);
      }
      ctx.restore();
      raf = requestAnimationFrame(frame);
    };
    const resume = () => {
      if (raf || !active() || t >= END) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };
    onActiveChange(resume);
    resume();
  };

  // After forming: blink loop and pointer tilt. Runs once.
  let idleStarted = false;
  const startIdle = () => {
    if (idleStarted) return;
    idleStarted = true;

    // Blink: play the short eye clip every 4 to 7s. data-blinking shows it once a frame is ready.
    if (blink) {
      blink.preload = "metadata";
      let timer = 0;
      const hideBlink = () => {
        delete hero.dataset.blinking;
      };
      const scheduleBlink = () => {
        clearTimeout(timer);
        if (active()) timer = window.setTimeout(playBlink, 4000 + Math.random() * 3000);
      };
      const playBlink = () => {
        if (!active()) return;
        blink.currentTime = 0;
        blink
          .play()
          .then(() => {
            const show = () => {
              hero.dataset.blinking = "true";
            };
            if ("requestVideoFrameCallback" in blink) blink.requestVideoFrameCallback(show);
            else show();
          })
          .catch(() => {
            hideBlink();
            scheduleBlink();
          });
      };
      blink.addEventListener("ended", () => {
        hideBlink();
        scheduleBlink();
      });
      onActiveChange(() => {
        if (active()) scheduleBlink();
        else {
          clearTimeout(timer);
          blink.pause();
          hideBlink();
        }
      });
      scheduleBlink();
    }

    // Tilt: up to 4deg toward a mouse pointer on desktop, eased toward the target each frame.
    const tiltable = matchMedia("(hover: hover) and (pointer: fine) and (min-width: 961px)");
    let rotX = 0;
    let rotY = 0;
    let goalX = 0;
    let goalY = 0;
    let raf = 0;
    let last = 0;
    const step = (now: number) => {
      raf = 0;
      const k = 1 - Math.exp(-Math.min(64, now - last) / 45);
      last = now;
      rotX += (goalX - rotX) * k;
      rotY += (goalY - rotY) * k;
      tilt.style.transform = `perspective(1400px) rotateX(${rotX.toFixed(3)}deg) rotateY(${rotY.toFixed(3)}deg)`;
      if (active() && (Math.abs(goalX - rotX) > 0.01 || Math.abs(goalY - rotY) > 0.01)) raf = requestAnimationFrame(step);
    };
    const kick = () => {
      if (raf || !active()) return;
      last = performance.now();
      raf = requestAnimationFrame(step);
    };
    hero.addEventListener(
      "pointermove",
      (e) => {
        if (!tiltable.matches || e.pointerType !== "mouse") return;
        const r = avatar.getBoundingClientRect();
        const nx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (innerWidth / 2)));
        const ny = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (innerHeight / 2)));
        goalY = nx * 4;
        goalX = -ny * 4;
        kick();
      },
      { passive: true },
    );
    hero.addEventListener("pointerleave", () => {
      goalX = goalY = 0;
      kick();
    });
  };

  // If anything in forming fails (image decode, canvas), skip straight to the settled avatar.
  form().catch(() => settle());
}
