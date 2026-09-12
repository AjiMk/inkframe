import type { NormBox, NormPoint } from "./types";

export function clampNormBox(box: NormBox, min = 0.04): NormBox {
  let { x, y, width, height } = box;
  if (width < 0) {
    x += width;
    width = -width;
  }
  if (height < 0) {
    y += height;
    height = -height;
  }
  width = Math.max(min, Math.min(1, width));
  height = Math.max(min, Math.min(1, height));
  x = Math.max(0, Math.min(1 - width, x));
  y = Math.max(0, Math.min(1 - height, y));
  return { x, y, width, height };
}

export function boxFromPoints(
  a: { x: number; y: number },
  b: { x: number; y: number },
  min = 0.02,
): NormBox {
  return clampNormBox(
    {
      x: Math.min(a.x, b.x),
      y: Math.min(a.y, b.y),
      width: Math.abs(b.x - a.x),
      height: Math.abs(b.y - a.y),
    },
    min,
  );
}

export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load that image."));
    img.src = src;
  });
}

function coverDrawCentered(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  w: number,
  h: number,
  natW: number,
  natH: number,
) {
  const imageAspect = natW / natH;
  const boxAspect = w / h;
  let dw = w;
  let dh = h;
  if (imageAspect > boxAspect) {
    dw = h * imageAspect;
  } else {
    dh = w / imageAspect;
  }
  ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
}

export function normalizeDeg(deg: number) {
  const wrapped = ((((deg + 180) % 360) + 360) % 360) - 180;
  return wrapped === -180 ? 180 : wrapped;
}

export function distPoint(a: NormPoint, b: NormPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function polygonArea(points: NormPoint[]) {
  if (points.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    area += current.x * next.y - next.x * current.y;
  }
  return Math.abs(area) / 2;
}

export function pathBounds(points: NormPoint[], pad = 0.02): NormBox {
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return clampNormBox(
    {
      x: minX - pad,
      y: minY - pad,
      width: maxX - minX + pad * 2,
      height: maxY - minY + pad * 2,
    },
    0.02,
  );
}

export function pointInPolygon(point: NormPoint, polygon: NormPoint[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const intersect =
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y + Number.EPSILON) + a.x;
    if (intersect) inside = !inside;
  }
  return inside;
}

function perpendicularDistance(point: NormPoint, start: NormPoint, end: NormPoint) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return distPoint(point, start);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
  return distPoint(point, { x: start.x + t * dx, y: start.y + t * dy });
}

export function simplifyPath(points: NormPoint[], epsilon = 0.004): NormPoint[] {
  if (points.length < 5) return points;
  let maxDist = 0;
  let index = 0;
  const last = points.length - 1;
  for (let i = 1; i < last; i++) {
    const dist = perpendicularDistance(points[i], points[0], points[last]);
    if (dist > maxDist) {
      index = i;
      maxDist = dist;
    }
  }
  if (maxDist > epsilon) {
    const left = simplifyPath(points.slice(0, index + 1), epsilon);
    const right = simplifyPath(points.slice(index), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  return [points[0], points[last]];
}

export function movePath(points: NormPoint[], dx: number, dy: number): NormPoint[] {
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  const ox = Math.max(-minX, Math.min(1 - maxX, dx));
  const oy = Math.max(-minY, Math.min(1 - maxY, dy));
  return points.map((point) => ({ x: point.x + ox, y: point.y + oy }));
}

function tracePath(ctx: CanvasRenderingContext2D, points: NormPoint[], width: number, height: number) {
  ctx.beginPath();
  ctx.moveTo(points[0].x * width, points[0].y * height);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x * width, points[i].y * height);
  }
  ctx.closePath();
}

function applyAlphaFeather(
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  feather: number,
) {
  const amount = Math.max(0, Math.min(0.6, feather));
  if (amount < 0.04) return;
  const mask = scratchMask ?? document.createElement("canvas");
  mask.width = source.width;
  mask.height = source.height;
  const mctx = mask.getContext("2d");
  if (!mctx) return;
  mctx.setTransform(1, 0, 0, 1, 0, 0);
  mctx.clearRect(0, 0, mask.width, mask.height);
  const blur = Math.max(1, Math.min(source.width, source.height) * amount * 0.22);
  mctx.filter = `blur(${blur}px)`;
  mctx.drawImage(source, 0, 0);
  mctx.filter = "none";
  ctx.save();
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(mask, 0, 0);
  ctx.restore();
}

export async function cropFacePathBlob(img: HTMLImageElement, points: NormPoint[]): Promise<Blob> {
  if (points.length < 3) throw new Error("Draw a closed selection around the face.");
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  const bounds = pathBounds(points, 0.03);
  let sx = bounds.x * nw;
  let sy = bounds.y * nh;
  let sw = bounds.width * nw;
  let sh = bounds.height * nh;
  if (sx < 0) {
    sw += sx;
    sx = 0;
  }
  if (sy < 0) {
    sh += sy;
    sy = 0;
  }
  if (sx + sw > nw) sw = nw - sx;
  if (sy + sh > nh) sh = nh - sy;
  sw = Math.max(1, sw);
  sh = Math.max(1, sh);

  const maxSide = 640;
  const scale = Math.min(1, maxSide / Math.max(sw, sh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable");

  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

  const local = points.map((point) => ({
    x: (point.x * nw - sx) / sw,
    y: (point.y * nh - sy) / sh,
  }));
  ctx.globalCompositeOperation = "destination-in";
  const feather = Math.max(1.2, Math.min(canvas.width, canvas.height) * 0.018);
  ctx.filter = `blur(${feather}px)`;
  tracePath(ctx, local, canvas.width, canvas.height);
  ctx.fill();
  ctx.filter = "none";
  ctx.globalCompositeOperation = "source-over";

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) throw new Error("Could not crop that face");
  return blob;
}

export async function cropFaceBlob(img: HTMLImageElement, box: NormBox): Promise<Blob> {
  return cropFacePathBlob(img, [
    { x: box.x, y: box.y },
    { x: box.x + box.width, y: box.y },
    { x: box.x + box.width, y: box.y + box.height },
    { x: box.x, y: box.y + box.height },
  ]);
}

export function sampleRingColor(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
): { r: number; g: number; b: number } | null {
  try {
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const x = Math.round(cx + Math.cos(a) * rx * 1.14);
      const y = Math.round(cy + Math.sin(a) * ry * 1.14);
      if (x < 0 || y < 0 || x >= ctx.canvas.width || y >= ctx.canvas.height) continue;
      const data = ctx.getImageData(x, y, 1, 1).data;
      r += data[0];
      g += data[1];
      b += data[2];
      n += 1;
    }
    if (!n) return null;
    return { r: r / n, g: g / n, b: b / n };
  } catch {
    return null;
  }
}

const scratch = typeof document === "undefined" ? null : document.createElement("canvas");
const scratchMask = typeof document === "undefined" ? null : document.createElement("canvas");

export function drawSoftFace(
  ctx: CanvasRenderingContext2D,
  face: HTMLImageElement,
  box: { x: number; y: number; w: number; h: number },
  opts: {
    scale: number;
    feather: number;
    opacity: number;
    rotation?: number;
    mirror?: boolean;
    tint?: { r: number; g: number; b: number } | null;
  },
) {
  const w = Math.max(2, box.w * opts.scale);
  const h = Math.max(2, box.h * opts.scale);
  const x = box.x - (w - box.w) / 2;
  const y = box.y - (h - box.h) / 2;
  const rotation = normalizeDeg(opts.rotation ?? 0);
  const rad = (rotation * Math.PI) / 180;

  const off = scratch ?? document.createElement("canvas");
  off.width = Math.max(2, Math.round(w));
  off.height = Math.max(2, Math.round(h));
  const octx = off.getContext("2d");
  if (!octx) return;
  octx.setTransform(1, 0, 0, 1, 0, 0);
  octx.globalCompositeOperation = "source-over";
  octx.globalAlpha = 1;
  octx.clearRect(0, 0, off.width, off.height);

  octx.translate(off.width / 2, off.height / 2);
  if (rad) octx.rotate(rad);
  if (opts.mirror) octx.scale(-1, 1);
  const span = rad ? Math.hypot(off.width, off.height) : Math.max(off.width, off.height);
  const targetW = rad ? span : off.width;
  const targetH = rad ? span : off.height;
  coverDrawCentered(octx, face, targetW, targetH, face.naturalWidth, face.naturalHeight);

  if (opts.tint) {
    octx.globalCompositeOperation = "source-atop";
    octx.globalAlpha = 0.26;
    octx.fillStyle = `rgb(${Math.round(opts.tint.r)} ${Math.round(opts.tint.g)} ${Math.round(opts.tint.b)})`;
    const pad = Math.hypot(off.width, off.height);
    octx.fillRect(-pad, -pad, pad * 2, pad * 2);
    octx.globalAlpha = 1;
    octx.globalCompositeOperation = "source-over";
  }

  octx.setTransform(1, 0, 0, 1, 0, 0);
  applyAlphaFeather(octx, off, opts.feather);

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, opts.opacity));
  ctx.drawImage(off, x, y, w, h);
  ctx.restore();
}

export function paintPanelWithFaces(
  canvas: HTMLCanvasElement,
  panel: HTMLImageElement,
  slots: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    scale: number;
    feather: number;
    opacity: number;
    matchTone: boolean;
    rotation?: number;
    mirror?: boolean;
    face: HTMLImageElement | null;
  }>,
) {
  canvas.width = panel.naturalWidth;
  canvas.height = panel.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(panel, 0, 0, canvas.width, canvas.height);

  for (const slot of slots) {
    if (!slot.face) continue;
    const box = {
      x: slot.x * canvas.width,
      y: slot.y * canvas.height,
      w: slot.width * canvas.width,
      h: slot.height * canvas.height,
    };
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    const tint = slot.matchTone
      ? sampleRingColor(ctx, cx, cy, (box.w * slot.scale) / 2, (box.h * slot.scale) / 2)
      : null;
    drawSoftFace(ctx, slot.face, box, {
      scale: slot.scale,
      feather: slot.feather,
      opacity: slot.opacity,
      rotation: slot.rotation ?? 0,
      mirror: Boolean(slot.mirror),
      tint,
    });
  }
}
