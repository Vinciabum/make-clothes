// Phase 1: Generate 8 virtual-person base faces for the sample gallery.
// Usage:  node scripts/buildVirtualFaces.mjs
// Output: scripts/virtual-faces/<id>.png (8 files)
// Revert: delete the virtual-faces/ folder.

import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outDir = path.join(__dirname, 'virtual-faces');
fs.mkdirSync(outDir, { recursive: true });

// Resolve .env.local in the main repo (walks up from this worktree)
const candidateEnvPaths = [
  path.resolve(__dirname, '..', '.env.local'),
  path.resolve(__dirname, '..', '..', '..', '..', '.env.local'),
];
let apiKey = null;
for (const p of candidateEnvPaths) {
  if (!fs.existsSync(p)) continue;
  const content = fs.readFileSync(p, 'utf-8');
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^(GEMINI_API_KEY|API_KEY)\s*=\s*(.*)$/);
    if (m) {
      apiKey = m[2].trim().replace(/^["']|["']$/g, '');
      console.log(`[env] loaded from ${p}`);
      break;
    }
  }
  if (apiKey) break;
}
if (!apiKey) {
  console.error('ERROR: GEMINI_API_KEY not found in .env.local');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

const buildPrompt = (persona, hair) => `Generate a professional Korean 증명사진 (ID photograph) of a ${persona}.

[FRONTAL VIEW LOCK — HARD CONSTRAINT, HIGHEST PRIORITY]
Direct frontal view — subject facing the camera directly, 0° yaw, 0° pitch, 0° roll.
Nose tip points straight at the camera lens.
Both eyes equally visible. Both ears symmetrically visible (or equally covered by hair on both sides).
Perfectly symmetrical pose.
STRICTLY FORBIDDEN: profile view, three-quarter (3/4) view, side angle, turned head, head tilt, looking away, any non-frontal angle.

[APPEARANCE]
Hair: ${hair}
Expression: neutral, calm, looking straight at the camera. Gentle closed-mouth smile optional but minimal.
Clothing: a simple plain neutral-colored crew-neck t-shirt (this will be replaced later). No logos, no patterns.

[COMPOSITION]
Bust shot showing the head, neck, and upper shoulders.
Camera framing centered on the face.
Subject occupies roughly the upper-middle portion of the frame.
Aspect ratio 3:4 portrait.

[BACKGROUND]
Pure white studio background (#FFFFFF).
Completely smooth, no texture, no patterns, no gradient, no vignette.
Clean, bright, evenly lit background — uniform white across the entire frame behind the subject.

[LIGHTING & QUALITY]
Soft even three-point studio lighting.
Equal lighting on both sides of the face.
No harsh shadows, no directional drama lighting.
Photographic realism, not painterly.
Ultra-realistic DSLR photograph, 85mm f/2.8 portrait lens.
High resolution, crisp focus on the face, gentle natural skin texture (visible pores, fine detail).
Natural clarity — not over-sharpened, not over-smoothed, not beautified.

FINAL CHECK: The output must be a direct frontal portrait. If in doubt, default to head-on frontal view. No profile, no 3/4 angle.

Output ONLY the image.`;

const targets = [
  { id: 'male_2030', persona: '25-year-old Korean man', hair: 'short neat business-ready haircut, natural black hair, clean hairline showing forehead' },
  { id: 'male_4050', persona: '48-year-old Korean man', hair: 'neat side-parted short hair with slight gray at temples, professional mature appearance' },
  { id: 'male_5060', persona: '58-year-old Korean man', hair: 'dignified short hair partially gray, calm mature demeanor' },
  { id: 'female_2030', persona: '27-year-old Korean woman', hair: 'shoulder-length straight black hair with a center part, neat professional look' },
  { id: 'female_4050', persona: '47-year-old Korean woman', hair: 'shoulder-length dark brown hair with natural body and slight wave, mature professional' },
  { id: 'female_5060', persona: '58-year-old Korean woman', hair: 'neat medium-length dark brown hair with subtle volume, dignified mature appearance' },
  { id: 'boy', persona: '10-year-old Korean boy', hair: 'short neat black hair, bright clean appearance' },
  { id: 'girl', persona: '10-year-old Korean girl', hair: 'shoulder-length straight black hair, bright clean appearance' },
];

const MODEL = 'gemini-3.1-flash-image-preview';

async function generate(target) {
  const started = Date.now();
  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [{ text: buildPrompt(target.persona, target.hair) }],
      config: {
        responseModalities: ['IMAGE'],
        imageConfig: { aspectRatio: '3:4' },
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData?.data) {
        const outPath = path.join(outDir, `${target.id}.png`);
        fs.writeFileSync(outPath, Buffer.from(part.inlineData.data, 'base64'));
        const ms = Date.now() - started;
        console.log(`  OK  ${target.id}.png  (${ms}ms)`);
        return { id: target.id, ok: true };
      }
    }
    throw new Error('No image data in response');
  } catch (e) {
    console.error(`  FAIL  ${target.id}  —  ${e?.message || e}`);
    return { id: target.id, ok: false, error: e?.message || String(e) };
  }
}

console.log(`[phase-1] Generating ${targets.length} virtual faces with ${MODEL}...`);
const results = await Promise.all(targets.map(generate));
const okCount = results.filter(r => r.ok).length;
console.log(`\n[phase-1] ${okCount}/${targets.length} succeeded. Output: ${outDir}`);
if (okCount < targets.length) {
  console.log('[phase-1] Failed targets:', results.filter(r => !r.ok));
  process.exit(2);
}
