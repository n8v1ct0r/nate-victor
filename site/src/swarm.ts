// Agent swarm that assembles into Nate's portrait.
// Targets are sampled from a 200px copy of the photo: the light gray backdrop drops out,
// skin and highlights pull more agents, hair and sweater keep a sparse silhouette.

type Hud = { agents?: Element | null; fps?: Element | null; state?: Element | null };

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

async function sampleTargets(src: string, n: number) {
  const img = new Image();
  img.decoding = "async";
  img.src = src;
  await img.decode();
  const S = img.naturalWidth;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, S, S).data;

  const L = new Float32Array(S * S);
  const sat = new Float32Array(S * S);
  for (let i = 0; i < S * S; i++) {
    const r = d[i * 4] / 255, gr = d[i * 4 + 1] / 255, b = d[i * 4 + 2] / 255;
    const mx = Math.max(r, gr, b), mn = Math.min(r, gr, b);
    L[i] = 0.2126 * r + 0.7152 * gr + 0.0722 * b;
    sat[i] = mx === 0 ? 0 : (mx - mn) / mx;
  }
  // Backdrop estimate per column from the top rows, which are all wall.
  const top = Math.round(S * 0.1);
  const bg = new Float32Array(S);
  for (let x = 0; x < S; x++) { let s = 0; for (let y = 0; y < top; y++) s += L[y * S + x]; bg[x] = s / top; }

  const w = new Float32Array(S * S);
  const E = new Float32Array(S * S);
  let total = 0;
  for (let y = 1; y < S - 1; y++) {
    const fadeY = 1 - smooth(0.84, 1, y / S);
    for (let x = 1; x < S - 1; x++) {
      const i = y * S + x;
      const subject = Math.max(smooth(0.05, 0.28, bg[x] - L[i]), smooth(0.13, 0.3, sat[i]));
      if (subject < 0.12) continue;
      const gx = L[i + 1] - L[i - 1], gy = L[i + S] - L[i - S];
      const edge = Math.min(1, Math.hypot(gx, gy) * 4);
      E[i] = edge * subject;
      const v = subject * (0.08 + 0.92 * Math.pow(L[i], 2.4)) + edge * 0.9 * subject;
      w[i] = v * fadeY;
      total += w[i];
    }
  }
  const cdf = new Float32Array(S * S);
  let acc = 0;
  for (let i = 0; i < S * S; i++) { acc += w[i]; cdf[i] = acc / total; }

  const tx = new Float32Array(n), ty = new Float32Array(n), tl = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    const r = Math.random();
    let lo = 0, hi = S * S - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (cdf[m] < r) lo = m + 1; else hi = m; }
    const x = lo % S, y = (lo / S) | 0;
    tx[k] = (x + Math.random()) / S;
    ty[k] = (y + Math.random()) / S;
    tl[k] = Math.max(L[lo], E[lo] * 0.85);
  }
  return { tx, ty, tl };
}

export async function startSwarm(canvas: HTMLCanvasElement, hud: Hud, opts: { still: boolean }) {
  const ctx = canvas.getContext("2d", { alpha: false })!;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  let W = 0, H = 0;
  const small = window.innerWidth < 700;
  const lowCore = (navigator.hardwareConcurrency || 8) <= 4;
  const N = small ? 1500 : lowCore ? 2200 : 3200;

  const { tx: ux, ty: uy, tl } = await sampleTargets("/nate-sample.png", N);
  const px = new Float32Array(N), py = new Float32Array(N);
  const vx = new Float32Array(N), vy = new Float32Array(N);
  const tx = new Float32Array(N), ty = new Float32Array(N);
  const delay = new Float32Array(N), phase = new Float32Array(N);

  const layout = () => {
    const r = canvas.getBoundingClientRect();
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const wide = W >= 900;
    const size = wide ? Math.min(H * 0.98, W * 0.56) : Math.min(W * 1.05, H * 0.62);
    const cx = wide ? W * 0.7 : W * 0.5;
    const cy = wide ? H * 0.52 : H * 0.34;
    for (let i = 0; i < N; i++) { tx[i] = cx + (ux[i] - 0.5) * size; ty[i] = cy + (uy[i] - 0.5) * size; }
  };
  layout();

  // Agents enter as a flock from the left edge, staggered, then each peels off to its target.
  for (let i = 0; i < N; i++) {
    px[i] = -20 - Math.random() * W * 0.18;
    py[i] = H * (0.15 + Math.random() * 0.7);
    vx[i] = 3 + Math.random() * 3; vy[i] = (Math.random() - 0.5) * 2;
    delay[i] = 0.25 + Math.random() * 1.6 + (ux[i] * 0.6);
    phase[i] = Math.random() * Math.PI * 2;
  }

  const setHud = (k: keyof Hud, v: string) => { const el = hud[k]; if (el && el.textContent !== v) el.textContent = v; };
  setHud("agents", N.toLocaleString("en-US"));

  const paintStill = () => {
    ctx.fillStyle = "#0a0a0b"; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < N; i++) {
      ctx.fillStyle = `rgba(237,237,237,${(0.25 + 0.75 * tl[i]).toFixed(2)})`;
      ctx.fillRect(tx[i], ty[i], 1.6, 1.6);
    }
    setHud("state", "Settled"); setHud("fps", "0");
  };

  if (opts.still) {
    paintStill();
    new ResizeObserver(() => { layout(); paintStill(); }).observe(canvas);
    return;
  }

  let mx = -1e4, my = -1e4, mouseOn = false;
  const onMove = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; mouseOn = true; };
  canvas.parentElement!.addEventListener("pointermove", onMove, { passive: true });
  canvas.parentElement!.addEventListener("pointerleave", () => { mouseOn = false; mx = my = -1e4; });
  new ResizeObserver(layout).observe(canvas);

  let running = true, visible = true, raf = 0, t0 = performance.now(), last = t0;
  let frames = 0, fpsT = t0;
  const R = small ? 70 : 110;
  const linkX = new Float32Array(64), linkY = new Float32Array(64);

  const tick = (now: number) => {
    raf = 0;
    if (!running || !visible) return;
    const dt = Math.min(2.5, (now - last) / 16.667); last = now;
    const t = (now - t0) / 1000;
    ctx.fillStyle = "#0a0a0b"; ctx.fillRect(0, 0, W, H);

    let settled = 0, links = 0;
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      let ax = 0, ay = 0;
      if (t < delay[i]) {
        // Flocking phase: shared flow field gives a coherent swarm heading right.
        const a = Math.sin(py[i] * 0.012 + t * 1.3) * 0.9 + Math.cos(px[i] * 0.01 - t) * 0.5;
        ax = (Math.cos(a) * 5 - vx[i]) * 0.06; ay = (Math.sin(a) * 2.2 - vy[i]) * 0.06;
      } else {
        const gx = tx[i] + Math.sin(t * 0.8 + phase[i]) * 0.6, gy = ty[i] + Math.cos(t * 0.7 + phase[i]) * 0.6;
        const dx = gx - px[i], dy = gy - py[i];
        const dist = Math.hypot(dx, dy) || 1;
        const sp = Math.min(16, dist * 0.07);
        ax = (dx / dist * sp - vx[i]) * 0.2; ay = (dy / dist * sp - vy[i]) * 0.2;
        if (dist < 3) settled++;
      }
      if (mouseOn) {
        const dx = px[i] - mx, dy = py[i] - my, d2 = dx * dx + dy * dy;
        if (d2 < R * R) {
          const d = Math.sqrt(d2) || 1, f = (1 - d / R);
          ax += dx / d * f * f * 6; ay += dy / d * f * f * 6;
          if (links < 64 && d > R * 0.55) { linkX[links] = px[i]; linkY[links] = py[i]; links++; }
        }
      }
      vx[i] += ax * dt; vy[i] += ay * dt;
      px[i] += vx[i] * dt; py[i] += vy[i] * dt;
      const sp2 = vx[i] * vx[i] + vy[i] * vy[i];
      if (sp2 > 2) { ctx.moveTo(px[i], py[i]); ctx.lineTo(px[i] - vx[i] * 2.4, py[i] - vy[i] * 2.4); }
    }
    ctx.strokeStyle = "rgba(61,220,132,0.55)"; ctx.lineWidth = 1; ctx.stroke();

    // Dots in three brightness buckets keeps fillStyle changes to three per frame.
    for (let b = 0; b < 3; b++) {
      ctx.fillStyle = b === 0 ? "rgba(237,237,237,0.32)" : b === 1 ? "rgba(237,237,237,0.62)" : "rgba(237,237,237,0.95)";
      const s = b === 2 ? 1.8 : 1.5;
      for (let i = 0; i < N; i++) {
        const bucket = tl[i] < 0.33 ? 0 : tl[i] < 0.6 ? 1 : 2;
        if (bucket === b && px[i] > -4 && px[i] < W + 4) ctx.fillRect(px[i] - s / 2, py[i] - s / 2, s, s);
      }
    }
    if (links) {
      ctx.beginPath();
      for (let k = 0; k < links; k++) { ctx.moveTo(mx, my); ctx.lineTo(linkX[k], linkY[k]); }
      ctx.strokeStyle = "rgba(61,220,132,0.16)"; ctx.stroke();
      ctx.fillStyle = "#3ddc84"; ctx.fillRect(mx - 2, my - 2, 4, 4);
    }

    frames++;
    if (now - fpsT > 500) { setHud("fps", String(Math.round(frames * 1000 / (now - fpsT)))); frames = 0; fpsT = now; }
    setHud("state", mouseOn && links ? "Reacting" : settled > N * 0.85 ? "Settled" : "Forming");
    raf = requestAnimationFrame(tick);
  };
  const resume = () => { if (!raf && running && visible) { last = performance.now(); raf = requestAnimationFrame(tick); } };

  new IntersectionObserver(([e]) => { visible = e.isIntersecting; resume(); }).observe(canvas);
  document.addEventListener("visibilitychange", () => { running = !document.hidden; resume(); });
  resume();
}
