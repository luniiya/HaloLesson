import * as THREE from "three";

// The spinning book as real WebGL meshes, so it stays solid from every angle.
// World units are cqw of the artwork's width (the canvas is 100 wide), with
// y up and z toward the viewer. Layout and camera match the old CSS version:
// perspective 150cqw from 50% 20%, the book centered at 42% from the top.
// Loaded lazily by BookArtwork so three.js stays out of the main bundle.

type Palette = Record<"accent" | "shade" | "dark" | "deep" | "light" | "pale", string>;

const PALETTE_VARS: Palette = {
  accent: "--accent",
  shade: "--accent-shade",
  dark: "--accent-dark",
  deep: "--color-accent-deep",
  light: "--color-accent-light",
  pale: "--color-accent-pale",
};

// CSS colors can be color-mix(); painting a pixel resolves any of them to hex.
function readPalette(el: HTMLElement): Palette {
  const style = getComputedStyle(el);
  const probe = document.createElement("canvas");
  probe.width = probe.height = 1;
  const ctx = probe.getContext("2d", { willReadFrequently: true })!;
  const read = (name: string) => {
    ctx.fillStyle = "#7c5cff";
    ctx.fillStyle = style.getPropertyValue(name).trim() || "#7c5cff";
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
  };
  return Object.fromEntries(Object.entries(PALETTE_VARS).map(([key, name]) => [key, read(name)])) as Palette;
}

const COVER = { w: 22, h: 28, d: 1.8, round: 4 };
const PAGES = { w: 20, h: 25.4, d: 3, round: 3 };
const SPINE = { w: 3, h: COVER.h - 3, d: 1.8, round: 1.5 };
const SLICE = 0.3; // stacked paper stripe thickness
const BLUE = "#1cb0f6";
const DEG = Math.PI / 180;
const MAX_CANVAS_PX = 2560;

function roundedRect(w: number, h: number, r: number) {
  const x = -w / 2, y = -h / 2;
  const shape = new THREE.Shape();
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  shape.lineTo(x + w, y + h - r);
  shape.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  shape.lineTo(x + r, y + h);
  shape.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  shape.lineTo(x, y + r);
  shape.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return shape;
}

// A rounded slab centered on its origin. Material slots: 0 back, 1 front,
// 2 sides. Cap UVs span 0..1 across the face (the back is mirrored so it reads
// correctly from behind); side UVs stay in world units for the paper stripes.
function slab({ w, h, d, round }: { w: number; h: number; d: number; round: number }) {
  const geometry = new THREE.ExtrudeGeometry(roundedRect(w, h, round), { depth: d, bevelEnabled: false, curveSegments: 8 });
  geometry.translate(0, 0, -d / 2);
  const [caps, sides] = geometry.groups;
  geometry.clearGroups();
  geometry.addGroup(caps.start, caps.count / 2, 0);
  geometry.addGroup(caps.start + caps.count / 2, caps.count / 2, 1);
  geometry.addGroup(sides.start, sides.count, 2);
  const position = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  for (let i = caps.start; i < caps.start + caps.count; i++) {
    const x = position.getX(i) / w;
    uv.setXY(i, position.getZ(i) < 0 ? 0.5 - x : 0.5 + x, position.getY(i) / h + 0.5);
  }
  return geometry;
}

// Face artwork, painted in world units onto a canvas.
const PX = 64;

function painter(w: number, h: number, draw: (ctx: CanvasRenderingContext2D, colors: Palette) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * PX);
  canvas.height = Math.round(h * PX);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return {
    texture,
    paint(colors: Palette) {
      const ctx = canvas.getContext("2d")!;
      ctx.setTransform(PX, 0, 0, PX, 0, 0);
      ctx.clearRect(0, 0, w, h);
      draw(ctx, colors);
      texture.needsUpdate = true;
    },
  };
}

function fillRound(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number, r: number) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.max(0, r));
  ctx.fill();
}

// Outside cover: thin light inner border and a title label.
function paintCover(ctx: CanvasRenderingContext2D, c: Palette) {
  const { w, h, round } = COVER;
  ctx.fillStyle = c.accent;
  ctx.fillRect(0, 0, w, h);
  fillRound(ctx, c.light, 1.3, 1.3, w - 2.6, h - 2.6, round - 1.3);
  fillRound(ctx, c.accent, 1.9, 1.9, w - 3.8, h - 3.8, round - 1.9);
  const lx = w * 0.22, lw = w * 0.56, ly = h * 0.17, lh = h * 0.17;
  fillRound(ctx, c.deep, lx, ly + 0.7, lw, lh, 1.2);
  fillRound(ctx, "#fff", lx, ly, lw, lh, 1.2);
  const bar = (color: string, width: number, height: number, at: number) => {
    ctx.fillStyle = color;
    ctx.fillRect(lx + (lw - lw * width) / 2, ly + (lh - lh * height) * at, lw * width, lh * height);
  };
  bar(BLUE, 0.62, 0.16, 0.32);
  bar("#a8e1fb", 0.44, 0.13, 0.72);
}

function paintCoverInside(ctx: CanvasRenderingContext2D, c: Palette) {
  const { w, h, round } = COVER;
  ctx.fillStyle = c.dark;
  ctx.fillRect(0, 0, w, h);
  const gradient = ctx.createLinearGradient(0, 0, w, 0);
  gradient.addColorStop(0, c.dark);
  gradient.addColorStop(0.35, c.deep);
  gradient.addColorStop(1, c.deep);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.roundRect(0.8, 0.8, w - 1.6, h - 1.6, round - 0.8);
  ctx.fill();
}

function paintPage(ribbon: boolean) {
  return (ctx: CanvasRenderingContext2D, c: Palette) => {
    const { w, h } = PAGES;
    // CSS linear-gradient(105deg, ...)
    const dx = Math.sin(105 * DEG), dy = -Math.cos(105 * DEG);
    const half = (w * Math.abs(dx) + h * Math.abs(dy)) / 2;
    const gradient = ctx.createLinearGradient(w / 2 - dx * half, h / 2 - dy * half, w / 2 + dx * half, h / 2 + dy * half);
    gradient.addColorStop(0, "#fffef5");
    gradient.addColorStop(0.6, "#fff");
    gradient.addColorStop(1, "#eef8fb");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    const pill = (top: number, width: number, height: number) => fillRound(ctx, BLUE, w * 0.15, h * top, w * width, h * height, (h * height) / 2);
    pill(0.14, 0.58, 0.05);
    ctx.globalAlpha = 0.72;
    pill(0.3, 0.68, 0.035);
    pill(0.4, 0.6, 0.035);
    pill(0.5, 0.66, 0.035);
    ctx.globalAlpha = 1;

    fillRound(ctx, c.accent, w * 0.22, h * 0.64, w * 0.52, h * 0.2, 2);
    fillRound(ctx, c.pale, w * 0.22 + 0.6, h * 0.64 + 0.6, w * 0.52 - 1.2, h * 0.2 - 1.2, 1.4);

    if (ribbon) {
      const rx = w * 0.75, rw = w * 0.09, rh = h * 0.34;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(rx, 0);
      ctx.lineTo(rx + rw, 0);
      ctx.lineTo(rx + rw, rh);
      ctx.lineTo(rx + rw / 2, rh * 0.82);
      ctx.lineTo(rx, rh);
      ctx.closePath();
      ctx.clip();
      ctx.fillStyle = "#ff4b4b";
      ctx.fillRect(rx, 0, rw, rh);
      ctx.fillStyle = "#e03c3c";
      ctx.fillRect(rx + rw - 0.5, 0, 0.5, rh);
      ctx.restore();
    }
  };
}

function paintSpine(ctx: CanvasRenderingContext2D, c: Palette) {
  const { w, h } = SPINE;
  ctx.fillStyle = c.shade;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = c.light;
  for (const at of [0.14, 0.86]) ctx.fillRect(0, (h - h * 0.04) * at, w, h * 0.04);
}

// Two stripes (paper, shade) repeating every two slices through the depth.
// Mipmapped, so at steep angles the stripes blend instead of breaking into a comb.
function paperStripes() {
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, 4, 32);
  ctx.fillStyle = "#e6e2d3";
  ctx.fillRect(0, 32, 4, 32);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1 / (SLICE * 2));
  return texture;
}

export function mountBook(container: HTMLElement): { dispose(): void } {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 2.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(-30, 60, 100);
  scene.add(sun);

  const painters = {
    cover: painter(COVER.w, COVER.h, paintCover),
    coverInside: painter(COVER.w, COVER.h, paintCoverInside),
    page: painter(PAGES.w, PAGES.h, paintPage(false)),
    pageRibbon: painter(PAGES.w, PAGES.h, paintPage(true)),
    spine: painter(SPINE.w, SPINE.h, paintSpine),
  };
  const stripes = paperStripes();
  const lambert = (params: THREE.MeshLambertMaterialParameters = {}) =>new THREE.MeshLambertMaterial(params);
  const materials = {
    cover: lambert({ map: painters.cover.texture }),
    coverInside: lambert({ map: painters.coverInside.texture }),
    edge: lambert(),
    page: lambert({ map: painters.page.texture }),
    pageRibbon: lambert({ map: painters.pageRibbon.texture }),
    paper: lambert({ map: stripes }),
    spine: lambert({ map: painters.spine.texture }),
  };
  const geometries = { cover: slab(COVER), pages: slab(PAGES), spine: slab(SPINE) };

  const recolor = () => {
    const colors = readPalette(container);
    for (const p of Object.values(painters)) p.paint(colors);
    materials.edge.color.set(colors.deep);
  };
  recolor();

  // Camera > spin > tilt, like the CSS transform stack (CSS rotateX flips sign
  // because its y axis points down).
  const root = new THREE.Group();
  const camera = new THREE.Group();
  const spin = new THREE.Group();
  const tilt = new THREE.Group();
  camera.rotation.x = 24 * DEG;
  tilt.rotation.x = -22 * DEG;
  scene.add(root);
  root.add(camera);
  camera.add(spin);
  spin.add(tilt);

  // Each half of the open book is hinged on the spine. side = -1 (left) or 1 (right).
  for (const side of [-1, 1] as const) {
    const half = new THREE.Group();
    half.rotation.y = side * -24 * DEG;
    const cover = new THREE.Mesh(geometries.cover, [materials.cover, materials.coverInside, materials.edge]);
    cover.position.set(side * COVER.w / 2, 0, -COVER.d / 2);
    const pageFace = side === 1 ? materials.pageRibbon : materials.page;
    const pages = new THREE.Mesh(geometries.pages, [pageFace, pageFace, materials.paper]);
    pages.position.set(side * (PAGES.w / 2 + 0.4), 0, PAGES.d / 2);
    half.add(cover, pages);
    tilt.add(half);
  }
  const spine = new THREE.Mesh(geometries.spine, [materials.spine, materials.edge, materials.edge]);
  spine.position.z = -COVER.d - 0.7;
  tilt.add(spine);

  // Off-axis projection: the eye sits above the canvas center (perspective-origin 50% 20%).
  // Render at the real on-screen resolution: browser zoom changes devicePixelRatio and
  // pinch zoom changes visualViewport.scale. Capped so the canvas stays a sane size.
  const view = new THREE.PerspectiveCamera();
  const resize = () => {
    const width = container.clientWidth, height = container.clientHeight;
    if (!width || !height) return;
    const ratio = devicePixelRatio * (window.visualViewport?.scale ?? 1);
    renderer.setPixelRatio(Math.min(ratio, MAX_CANVAS_PX / Math.max(width, height)));
    renderer.setSize(width, height, false);
    const halfH = 50 * height / width, distance = 150, near = 10, k = near / distance;
    const eyeY = halfH * 0.6;
    root.position.y = halfH * 0.16;
    view.position.set(0, eyeY, distance);
    view.projectionMatrix.makePerspective(-50 * k, 50 * k, (halfH - eyeY) * k, (-halfH - eyeY) * k, near, 400);
    view.projectionMatrixInverse.copy(view.projectionMatrix).invert();
  };

  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let visible = true;
  const render = () => {
    spin.rotation.y = reducedMotion.matches ? -20 * DEG : (performance.now() / 18000) * Math.PI * 2;
    renderer.render(scene, view);
  };
  const updateLoop = () => {
    renderer.setAnimationLoop(visible && !reducedMotion.matches && !document.hidden ? render : null);
    render();
  };

  const rerender = () => {
    resize();
    render();
  };
  const resizeObserver = new ResizeObserver(rerender);
  resizeObserver.observe(container);
  // A resolution query only matches one ratio, so re-arm it after every change.
  let ratioQuery: MediaQueryList | undefined;
  const watchRatio = () => {
    ratioQuery?.removeEventListener("change", onRatio);
    ratioQuery = matchMedia(`(resolution: ${devicePixelRatio}dppx)`);
    ratioQuery.addEventListener("change", onRatio);
  };
  const onRatio = () => {
    watchRatio();
    rerender();
  };
  watchRatio();
  window.visualViewport?.addEventListener("resize", rerender);
  const intersectionObserver = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    updateLoop();
  });
  intersectionObserver.observe(container);
  // The accent lives on <html> (inline style) and dark mode is a class there.
  const themeObserver = new MutationObserver(() => {
    recolor();
    render();
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["style", "class"] });
  reducedMotion.addEventListener("change", updateLoop);
  document.addEventListener("visibilitychange", updateLoop);

  resize();
  updateLoop();

  return {
    dispose() {
      renderer.setAnimationLoop(null);
      resizeObserver.disconnect();
      ratioQuery?.removeEventListener("change", onRatio);
      window.visualViewport?.removeEventListener("resize", rerender);
      intersectionObserver.disconnect();
      themeObserver.disconnect();
      reducedMotion.removeEventListener("change", updateLoop);
      document.removeEventListener("visibilitychange", updateLoop);
      for (const geometry of Object.values(geometries)) geometry.dispose();
      for (const material of Object.values(materials)) material.dispose();
      for (const p of Object.values(painters)) p.texture.dispose();
      stripes.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
