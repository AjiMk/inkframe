import type { NormBox } from "./types";

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

function coverDraw(
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
  let dx = 0;
  let dy = 0;
  if (imageAspect > boxAspect) {
    dw = h * imageAspect;
    dx = (w - dw) / 2;
  } else {
    dh = w / imageAspect;
    dy = (h - dh) / 2;
  }
  ctx.drawImage(img, dx, dy, dw, dh);
}

function applyEllipseFeather(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  feather: number,
) {
  ctx.save();
  ctx.globalCompositeOperation = "destination-in";
  ctx.translate(w / 2, h / 2);
  ctx.scale(Math.max(1, w / 2), Math.max(1, h / 2));
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  const inner = Math.max(0, Math.min(0.97, 1 - Math.max(0.04, feather)));
  gradient.addColorStop(0, "rgba(0,0,0,1)");
  gradient.addColorStop(inner, "rgba(0,0,0,1)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export async function cropFaceBlob(img: HTMLImageElement, box: NormBox): Promise<Blob> {
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  const pad = 0.1;
  let sx = (box.x - box.width * pad) * nw;
  let sy = (box.y - box.height * pad) * nh;
  let sw = box.width * (1 + pad * 2) * nw;
  let sh = box.height * (1 + pad * 2) * nh;
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

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.92),
  );
  if (!blob) throw new Error("Could not crop that face");
  return blob;
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

export function drawSoftFace(
  ctx: CanvasRenderingContext2D,
  face: HTMLImageElement,
  box: { x: number; y: number; w: number; h: number },
  opts: {
    scale: number;
    feather: number;
    opacity: number;
    tint?: { r: number; g: number; b: number } | null;
  },
) {
  const w = Math.max(2, box.w * opts.scale);
  const h = Math.max(2, box.h * opts.scale);
  const x = box.x - (w - box.w) / 2;
  const y = box.y - (h - box.h) / 2;

  const off = scratch ?? document.createElement("canvas");
  off.width = Math.max(2, Math.round(w));
  off.height = Math.max(2, Math.round(h));
  const octx = off.getContext("2d");
  if (!octx) return;
  octx.setTransform(1, 0, 0, 1, 0, 0);
  octx.globalCompositeOperation = "source-over";
  octx.globalAlpha = 1;
  octx.clearRect(0, 0, off.width, off.height);

  coverDraw(octx, face, off.width, off.height, face.naturalWidth, face.naturalHeight);

  if (opts.tint) {
    octx.globalCompositeOperation = "source-atop";
    octx.globalAlpha = 0.26;
    octx.fillStyle = `rgb(${Math.round(opts.tint.r)} ${Math.round(opts.tint.g)} ${Math.round(opts.tint.b)})`;
    octx.fillRect(0, 0, off.width, off.height);
    octx.globalAlpha = 1;
    octx.globalCompositeOperation = "source-over";
  }

  applyEllipseFeather(octx, off.width, off.height, opts.feather);

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
      tint,
    });
  }
}
