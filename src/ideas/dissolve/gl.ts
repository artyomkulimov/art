/**
 * A painterly dissolve between two images, drawn with one fragment shader.
 *
 * The mask is built like a wash of brush strokes: wavy bands that run along
 * the sweep direction, each starting a little earlier or later than its
 * neighbours, with bristle streaks and large, slow noise on top. At the moving
 * edge the outgoing painting is dragged forward (a smear, sampled along the
 * stroke), its pigment pools into a dark rim, and a thin residue of it lingers
 * over the incoming painting before drying off.
 */

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const NOISE = `
precision highp float;
varying vec2 vUv;
uniform vec2 uRes;
uniform float uSeed;
uniform vec2 uDir;     // sweep direction, aspect-corrected, unit

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21) + uSeed * 0.013);
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float hash1(float n) {
  return hash(vec2(n, n * 0.37 + 11.0));
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = p * 2.07 + vec2(17.1, 9.2);
    a *= 0.5;
  }
  return v;
}
`;

/**
 * Pass 1, once per wash: the moment each pixel is washed away (v), packed as
 * 16 bits into R+G (linear in both, so filtering stays exact), and the
 * bristle streak value in B.
 */
const MASK = `${NOISE}
void main() {
  float aspect = uRes.x / uRes.y;
  vec2 q = (vUv - 0.5) * vec2(aspect, 1.0);
  vec2 perp = vec2(-uDir.y, uDir.x);
  float sMax = 0.5 * (abs(uDir.x) * aspect + abs(uDir.y));
  float s = dot(q, uDir) / sMax * 0.5 + 0.5;  // 0..1 along the sweep
  float t = dot(q, perp);

  // Wavy, slightly ragged stroke bands.
  float warp = (fbm(q * 1.4 + uSeed) - 0.5) * 0.22 + (noise(q * 38.0 + uSeed) - 0.5) * 0.012;
  float tw = t + warp;
  float b1 = floor(tw * 7.0);
  float f1 = fract(tw * 7.0);
  float b2 = floor(tw * 4.3 + 0.37);
  float f2 = fract(tw * 4.3 + 0.37);
  // Each stroke starts at its own moment; its tip is rounded (edges lag).
  float v1 = s + hash1(b1) * 0.26 + pow(abs(f1 - 0.5) * 2.0, 3.0) * 0.07;
  float v2 = s + hash1(b2 + 50.0) * 0.3 + 0.06 + pow(abs(f2 - 0.5) * 2.0, 3.0) * 0.09;
  float v = min(v1, v2);
  // Bristles: fine streaks along the stroke, strongest as a dry, broken tip.
  float br = noise(vec2(s * 4.0, tw * 95.0));
  v += (br - 0.5) * 0.05;
  // Large, slow pooling of the wash.
  v += (fbm(q * 2.3 + 3.7 + uSeed * 0.5) - 0.5) * 0.3;

  float enc = clamp((v + 0.6) / 2.8, 0.0, 1.0) * 255.0;
  gl_FragColor = vec4(floor(enc) / 255.0, fract(enc), br, 1.0);
}`;

/** Pass 2, every frame: composite the two paintings through the mask. */
const FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uA;
uniform sampler2D uB;
uniform sampler2D uMask;
uniform vec2 uRes;
uniform vec2 uSizeA;
uniform vec2 uSizeB;
uniform float uZoomA;
uniform float uZoomB;
uniform float uP;      // 0 = all A, 1 = all B
uniform vec2 uDir;
uniform float uMode;   // 0 = paint, 1 = plain crossfade

vec2 cover(vec2 uv, vec2 img, float zoom) {
  float sr = uRes.x / uRes.y;
  float ir = img.x / img.y;
  vec2 s = sr > ir ? vec2(1.0, ir / sr) : vec2(sr / ir, 1.0);
  return (uv - 0.5) * s / zoom + 0.5;
}
float dither(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main() {
  vec2 uvA = cover(vUv, uSizeA, uZoomA);
  vec2 uvB = cover(vUv, uSizeB, uZoomB);
  vec3 b = texture2D(uB, uvB).rgb;

  if (uMode > 0.5) {
    gl_FragColor = vec4(mix(texture2D(uA, uvA).rgb, b, uP), 1.0);
    return;
  }

  vec3 mk = texture2D(uMask, vUv).rgb;
  float v = (mk.r + mk.g / 255.0) * 2.8 - 0.6;
  float br = mk.b;
  float thr = mix(-0.32, 1.62, uP);
  float e = v - thr;  // < 0: washed away (B shows)
  float aspect = uRes.x / uRes.y;
  vec2 dUv = vec2(uDir.x / aspect, uDir.y);
  vec3 col;

  if (e > 0.14) {
    col = texture2D(uA, uvA).rgb;  // untouched paint
  } else if (e < -0.09) {
    col = b;                       // fully washed, dry
  } else {
    // Outgoing paint near the edge is dragged forward along the stroke.
    float k = clamp(1.0 - e / 0.14, 0.0, 1.0) * step(0.0, e);
    float drag = k * k * 0.055 * (0.45 + br);
    vec3 a = texture2D(uA, uvA).rgb;
    a += texture2D(uA, uvA - dUv * drag * 0.35).rgb;
    a += texture2D(uA, uvA - dUv * drag * 0.7).rgb;
    a += texture2D(uA, uvA - dUv * drag).rgb;
    a *= 0.25;

    // Pigment pools at the wet edge: darker, denser.
    float rim = exp(-pow(e / 0.018, 2.0)) * step(0.0, e);
    a = mix(a, a * a * 1.4, rim * 0.5);
    a *= 1.0 - rim * 0.12;

    // A thin residue of the old paint lingers just behind the edge.
    float behind = smoothstep(-0.09, 0.0, e) * (1.0 - step(0.0, e));
    vec3 res = texture2D(uA, uvA - dUv * 0.03 * (0.3 + br)).rgb;
    vec3 bb = mix(b, res * 0.85 + b * 0.15, behind * behind * 0.55);
    bb *= 1.0 + behind * 0.05;  // still wet: a hint of sheen

    col = mix(a, bb, smoothstep(0.006, -0.004, e));
  }
  col += (dither(gl_FragCoord.xy * 0.71) - 0.5) * 0.008;
  gl_FragColor = vec4(col, 1.0);
}`;

export type Frame = {
  a: number;
  b: number;
  p: number;
  zoomA: number;
  zoomB: number;
  seed: number;
  angle: number;
  crossfade: boolean;
};

export type Dissolve = {
  /** Upload an image as texture `id` (use any id; -1 is reserved for the dark ground). */
  setTexture: (id: number, img: TexImageSource & { naturalWidth?: number; naturalHeight?: number; width: number; height: number }) => void;
  has: (id: number) => boolean;
  resize: (w: number, h: number) => void;
  draw: (f: Frame) => void;
  lost: () => boolean;
};

export const GROUND = -1;

export const createDissolve = (canvas: HTMLCanvasElement, ground: [number, number, number]): Dissolve | null => {
  const gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false, premultipliedAlpha: false, powerPreference: "high-performance" });
  if (!gl) return null;

  const compile = (type: number, src: string) => {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.warn("dissolve shader:", gl.getShaderInfoLog(sh));
      return null;
    }
    return sh;
  };
  const program = (frag: string) => {
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, frag);
    if (!vs || !fs) return null;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.bindAttribLocation(prog, 0, "aPos");
    gl.linkProgram(prog);
    return gl.getProgramParameter(prog, gl.LINK_STATUS) ? prog : null;
  };
  const main = program(FRAG);
  const maskProg = program(MASK);
  if (!main || !maskProg) return null;

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const uniforms = (prog: WebGLProgram, names: string[]) =>
    Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(prog, n)]));
  const U = uniforms(main, ["uA", "uB", "uMask", "uRes", "uSizeA", "uSizeB", "uZoomA", "uZoomB", "uP", "uDir", "uMode"]);
  const M = uniforms(maskProg, ["uRes", "uSeed", "uDir"]);
  gl.useProgram(main);
  gl.uniform1i(U.uA, 0);
  gl.uniform1i(U.uB, 1);
  gl.uniform1i(U.uMask, 2);

  const textures = new Map<number, { tex: WebGLTexture; w: number; h: number }>();
  const make = () => {
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return tex;
  };
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

  // The dark ground the first painting washes in over.
  {
    const tex = make();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([...ground, 255]));
    textures.set(GROUND, { tex, w: 16, h: 10 });
  }

  // The mask: baked once per wash (it doesn't depend on progress).
  const maskTex = make();
  const fbo = gl.createFramebuffer();
  let maskKey = "";
  const bakeMask = (seed: number, angle: number) => {
    const key = `${seed}|${angle}|${canvas.width}x${canvas.height}`;
    if (key === maskKey) return;
    maskKey = key;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.useProgram(maskProg);
    gl.uniform2f(M.uRes, canvas.width, canvas.height);
    gl.uniform1f(M.uSeed, seed);
    gl.uniform2f(M.uDir, Math.cos(angle), Math.sin(angle));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.useProgram(main);
  };

  let isLost = false;
  canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); isLost = true; });

  return {
    setTexture(id, img) {
      const tex = textures.get(id)?.tex ?? make();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      textures.set(id, { tex, w: img.naturalWidth || img.width, h: img.naturalHeight || img.height });
    },
    has: (id) => textures.has(id),
    resize(w, h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
      gl.bindTexture(gl.TEXTURE_2D, maskTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, maskTex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      maskKey = "";
    },
    draw(f) {
      const A = textures.get(f.a) ?? textures.get(GROUND)!;
      const B = textures.get(f.b) ?? A;
      const paint = !f.crossfade && f.p > 0 && f.p < 1;
      if (paint) bakeMask(f.seed, f.angle);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, A.tex);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, B.tex);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, maskTex);
      gl.uniform2f(U.uRes, canvas.width, canvas.height);
      gl.uniform2f(U.uSizeA, A.w, A.h);
      gl.uniform2f(U.uSizeB, B.w, B.h);
      gl.uniform1f(U.uZoomA, f.zoomA);
      gl.uniform1f(U.uZoomB, f.zoomB);
      gl.uniform1f(U.uP, f.p);
      gl.uniform2f(U.uDir, Math.cos(f.angle), Math.sin(f.angle));
      // At rest (p = 0 or 1) the crossfade path is exact and cheapest.
      gl.uniform1f(U.uMode, paint ? 0 : 1);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    lost: () => isLost,
  };
};
