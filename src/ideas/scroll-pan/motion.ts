/** CSS-style cubic-bezier easing as a JS function. */
export const bezier = (x1: number, y1: number, x2: number, y2: number) => {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dsx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const e = sx(t) - x;
      const d = dsx(t);
      if (Math.abs(e) < 1e-6) return sy(t);
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    let lo = 0;
    let hi = 1;
    t = x;
    for (let i = 0; i < 30; i++) {
      const v = sx(t);
      if (Math.abs(v - x) < 1e-6) break;
      if (v < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return sy(t);
  };
};

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeOutSine = (t: number) => Math.sin((t * Math.PI) / 2);

/**
 * Smooth zoom-and-pan between two views (van Wijk & Nuij, "Smooth and
 * efficient zooming and panning"). Views are [cx, cy, width-of-view].
 * Long moves rise a little mid-flight, like a camera operator would.
 */
export const flyTo = (a: [number, number, number], b: [number, number, number], rho = 1.15) => {
  const rho2 = rho * rho;
  const rho4 = rho2 * rho2;
  const [ux0, uy0, w0] = a;
  const [ux1, uy1, w1] = b;
  const dx = ux1 - ux0;
  const dy = uy1 - uy0;
  const d2 = dx * dx + dy * dy;
  if (d2 < 1e-9) {
    const S = Math.log(w1 / w0) / rho;
    return (t: number): [number, number, number] => [ux0 + t * dx, uy0 + t * dy, w0 * Math.exp(rho * t * S)];
  }
  const d1 = Math.sqrt(d2);
  const b0 = (w1 * w1 - w0 * w0 + rho4 * d2) / (2 * w0 * rho2 * d1);
  const b1 = (w1 * w1 - w0 * w0 - rho4 * d2) / (2 * w1 * rho2 * d1);
  const r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0);
  const r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1);
  const S = (r1 - r0) / rho;
  return (t: number): [number, number, number] => {
    const s = t * S;
    const coshr0 = Math.cosh(r0);
    const u = (w0 / (rho2 * d1)) * (coshr0 * Math.tanh(rho * s + r0) - Math.sinh(r0));
    return [ux0 + u * dx, uy0 + u * dy, (w0 * coshr0) / Math.cosh(rho * s + r0)];
  };
};
