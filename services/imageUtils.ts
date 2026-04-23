import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface Dimensions { width: number; height: number; }
export interface FaceBBox { x: number; y: number; width: number; height: number; }

const GEMINI_ASPECT_RATIOS: Array<{ ratio: number; label: string }> = [
  { ratio: 1 / 1, label: '1:1' },
  { ratio: 3 / 4, label: '3:4' },
  { ratio: 4 / 3, label: '4:3' },
  { ratio: 9 / 16, label: '9:16' },
  { ratio: 16 / 9, label: '16:9' },
  { ratio: 2 / 3, label: '2:3' },
  { ratio: 3 / 2, label: '3:2' },
];

export const pickGeminiAspectRatio = (w: number, h: number): string => {
  const r = w / h;
  let best = GEMINI_ASPECT_RATIOS[0];
  let bestDiff = Infinity;
  for (const a of GEMINI_ASPECT_RATIOS) {
    const diff = Math.abs(a.ratio - r);
    if (diff < bestDiff) { bestDiff = diff; best = a; }
  }
  return best.label;
};

export const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

export const getImageDimensions = async (base64: string): Promise<Dimensions> => {
  const img = await loadImage(base64);
  return { width: img.naturalWidth, height: img.naturalHeight };
};

export const resizeBase64ToMatch = async (
  srcBase64: string,
  target: Dimensions
): Promise<string> => {
  const img = await loadImage(srcBase64);
  if (img.naturalWidth === target.width && img.naturalHeight === target.height) {
    return srcBase64;
  }
  const canvas = document.createElement('canvas');
  canvas.width = target.width;
  canvas.height = target.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return srcBase64;

  // Cover-fit so the person stays centered and aspect is preserved (avoids squashed face).
  const srcRatio = img.naturalWidth / img.naturalHeight;
  const tgtRatio = target.width / target.height;
  let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
  if (srcRatio > tgtRatio) {
    sw = img.naturalHeight * tgtRatio;
    sx = (img.naturalWidth - sw) / 2;
  } else if (srcRatio < tgtRatio) {
    sh = img.naturalWidth / tgtRatio;
    sy = (img.naturalHeight - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, target.width, target.height);
  return canvas.toDataURL('image/png');
};

/**
 * Detects a face bounding box via Gemini vision. Returns null on failure.
 * Coordinates are normalized percentages [0..1] of the image dimensions.
 */
export const detectFaceBBox = async (base64: string): Promise<FaceBBox | null> => {
  try {
    let mimeType = 'image/png';
    const mimeMatch = base64.match(/^data:(image\/[a-zA-Z+]+);base64,/);
    if (mimeMatch) mimeType = mimeMatch[1];
    const base64Data = base64.replace(/^data:image\/[a-zA-Z+]+;base64,/, '').replace(/[^A-Za-z0-9+/=]/g, '');

    const prompt = `Detect the main person's face in this photo and return ONLY a compact JSON object with the tight face bounding box as normalized coordinates (0.0-1.0 of the image width/height). The box must cover from the top of the forehead/hairline to the bottom of the chin and from left cheek edge to right cheek edge. Schema: {"x": number, "y": number, "width": number, "height": number}. Output the raw JSON only — no prose, no markdown, no code fence.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { text: prompt },
        { inlineData: { mimeType, data: base64Data } }
      ],
    });

    const text = (response.text || '').trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    if (typeof parsed.x !== 'number' || typeof parsed.y !== 'number' ||
        typeof parsed.width !== 'number' || typeof parsed.height !== 'number') return null;
    return {
      x: Math.max(0, Math.min(1, parsed.x)),
      y: Math.max(0, Math.min(1, parsed.y)),
      width: Math.max(0, Math.min(1, parsed.width)),
      height: Math.max(0, Math.min(1, parsed.height)),
    };
  } catch (e) {
    console.warn('detectFaceBBox failed:', e);
    return null;
  }
};

export interface GeometryDrift {
  centerDx: number;   // normalized
  centerDy: number;   // normalized
  sizeRatio: number;  // result_size / original_size
  exceeds: boolean;   // true when drift exceeds tolerance
}

/**
 * Drift tolerance defaults chosen for ID-photo strictness:
 *   - center offset > 3% of image dimension
 *   - size change > 10% (ratio outside [0.9, 1.1])
 */
export const computeGeometryDrift = (
  orig: FaceBBox,
  result: FaceBBox,
  centerTol = 0.03,
  sizeTolPct = 0.10
): GeometryDrift => {
  const ocx = orig.x + orig.width / 2;
  const ocy = orig.y + orig.height / 2;
  const rcx = result.x + result.width / 2;
  const rcy = result.y + result.height / 2;
  const centerDx = rcx - ocx;
  const centerDy = rcy - ocy;
  const sizeRatio = (result.width * result.height) / Math.max(1e-9, orig.width * orig.height);
  const exceeds = Math.abs(centerDx) > centerTol ||
                  Math.abs(centerDy) > centerTol ||
                  sizeRatio < 1 - sizeTolPct ||
                  sizeRatio > 1 + sizeTolPct;
  return { centerDx, centerDy, sizeRatio, exceeds };
};

/**
 * Copies the face region from `originalBase64` onto `resultBase64` at the
 * result's face position, scaled to match the result's face size.
 * Uses a feathered radial alpha mask so skin blends with neck/hair.
 *
 * This runs only when face preservation is critical (ID photo use).
 */
export const facePasteBack = async (
  originalBase64: string,
  resultBase64: string,
  origFace: FaceBBox,
  resultFace: FaceBBox,
  featherScale = 1.35
): Promise<string> => {
  const [origImg, resultImg] = await Promise.all([
    loadImage(originalBase64),
    loadImage(resultBase64),
  ]);

  const ow = origImg.naturalWidth;
  const oh = origImg.naturalHeight;
  const rw = resultImg.naturalWidth;
  const rh = resultImg.naturalHeight;

  // Source face rect in original pixel space (pad slightly to include forehead/jaw).
  const pad = 0.15;
  const sx = Math.max(0, (origFace.x - origFace.width * pad) * ow);
  const sy = Math.max(0, (origFace.y - origFace.height * pad) * oh);
  const sw = Math.min(ow - sx, origFace.width * (1 + pad * 2) * ow);
  const sh = Math.min(oh - sy, origFace.height * (1 + pad * 2) * oh);

  // Dest face rect in result pixel space.
  const dx = Math.max(0, (resultFace.x - resultFace.width * pad) * rw);
  const dy = Math.max(0, (resultFace.y - resultFace.height * pad) * rh);
  const dw = Math.min(rw - dx, resultFace.width * (1 + pad * 2) * rw);
  const dh = Math.min(rh - dy, resultFace.height * (1 + pad * 2) * rh);

  // Build feathered face patch on an offscreen canvas.
  const patch = document.createElement('canvas');
  patch.width = Math.round(dw);
  patch.height = Math.round(dh);
  const pctx = patch.getContext('2d');
  if (!pctx) return resultBase64;

  pctx.drawImage(origImg, sx, sy, sw, sh, 0, 0, patch.width, patch.height);

  // Radial feather mask (alpha falls off at edges).
  pctx.globalCompositeOperation = 'destination-in';
  const cx = patch.width / 2;
  const cy = patch.height / 2;
  const rInner = Math.min(patch.width, patch.height) / 2 * 0.72;
  const rOuter = Math.min(patch.width, patch.height) / 2 * featherScale;
  const grad = pctx.createRadialGradient(cx, cy, rInner, cx, cy, rOuter);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  pctx.fillStyle = grad;
  pctx.fillRect(0, 0, patch.width, patch.height);

  // Composite onto result.
  const out = document.createElement('canvas');
  out.width = rw;
  out.height = rh;
  const octx = out.getContext('2d');
  if (!octx) return resultBase64;
  octx.drawImage(resultImg, 0, 0);
  octx.drawImage(patch, dx, dy);

  return out.toDataURL('image/png');
};
