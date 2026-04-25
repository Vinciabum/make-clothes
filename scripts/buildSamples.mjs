// Phase 2: Generate 76 sample outputs for the sample gallery.
// Uses the 8 virtual faces from Phase 1 + the exact prompts from services/geminiService.ts.
// Usage:  node scripts/buildSamples.mjs
// Output: public/samples/<packId>_<n>.png
// Revert: delete the public/samples/ folder.

import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const facesDir = path.join(__dirname, 'virtual-faces');
const outDir = path.resolve(__dirname, '..', 'public', 'samples');
fs.mkdirSync(outDir, { recursive: true });

// ── load API key ──────────────────────────────────────────────────────────
const candidateEnvPaths = [
  path.resolve(__dirname, '..', '.env.local'),
  path.resolve(__dirname, '..', '..', '..', '..', '.env.local'),
];
let apiKey = null;
for (const p of candidateEnvPaths) {
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, 'utf-8').split(/\r?\n/)) {
    const m = line.match(/^(GEMINI_API_KEY|API_KEY)\s*=\s*(.*)$/);
    if (m) { apiKey = m[2].trim().replace(/^["']|["']$/g, ''); break; }
  }
  if (apiKey) break;
}
if (!apiKey) { console.error('ERROR: GEMINI_API_KEY not found'); process.exit(1); }
const ai = new GoogleGenAI({ apiKey });

// ── prompts (copied verbatim from services/geminiService.ts) ─────────────
const POSE_LOCK_BLOCK = `
[FRONTAL VIEW LOCK — HARD CONSTRAINT, HIGHEST PRIORITY]
This is a Korean ID photograph (증명사진). By regulation, ONLY a direct frontal view is valid. The subject MUST face the camera directly.
Required: 0° yaw, 0° pitch, 0° roll. Nose tip points straight at the camera lens.
Both eyes must be equally visible. Both ears must be symmetrically visible (or equally covered by hair on both sides).
STRICTLY FORBIDDEN: profile view, three-quarter (3/4) view, side angle, turned head, head tilt, looking away, over-the-shoulder pose, any non-frontal angle.

[POSE / FRAMING / IDENTITY LOCK — HIGHEST PRIORITY]
Lock the original face pose EXACTLY as in the input photo.
No head rotation, no tilt, no pitch or yaw change.
Maintain the exact frontal orientation with the same micro-angle.
Keep identical eye alignment, gaze direction, and head position.
Do NOT reinterpret or "naturalize" the pose in any way.
Preserve original facial identity 100%. Do NOT beautify, smooth, retouch, slim, or age the face.
Preserve the exact framing, crop, zoom level, and aspect ratio of the input photo.
Shoulder position, body proportions, and background must be pixel-identical to the input.
`;

const FACE_CONSTRAINT_STYLE = `FACE & IDENTITY: Preserve exact facial structure, eye shape, jawline, skin tone, and skin texture from the original. Do NOT generate a new face. HAIR color and style must also remain completely unchanged.`;
const FACE_CONSTRAINT_HAIR = `FACE & IDENTITY: Preserve exact facial structure, eye shape, jawline, skin tone, and skin texture from the original. Do NOT generate a new face. Do NOT retouch or alter facial features. CLOTHING must also remain completely unchanged.`;

const BODY_FIT = " Adapt the garment to the person's EXACT body proportions and shoulder width from the original photo without making them wider or narrower.";

const stylePromptTemplate = (prompt) => `SURGICAL CLOTHING EDIT task. NOT an image generation task. NOT a recomposition task.

${prompt}

${POSE_LOCK_BLOCK}

ABSOLUTE RULES — any violation makes the output unusable:
1. CLOTHING ONLY: Modify ONLY the clothing/fabric pixels on the torso and arms. Every other pixel must be copied from the input unchanged.
2. FRAMING & POSE (CRITICAL): Output must be pixel-identical to the input in dimensions, zoom level, crop, and head position.
3. ${FACE_CONSTRAINT_STYLE}
4. BACKGROUND: Every background pixel must be identical to the input.
5. BODY FIT: The garment fit must match the exact original shoulder width, arm thickness, and neckline of the input. Do not widen or narrow the subject.
6. THIS IS A STRICT PIXEL-LEVEL EDIT, NOT A GENERATION.

FINAL CHECK: The output must be a direct frontal portrait. If in doubt, default to head-on frontal view. No profile, no 3/4 angle.

Output ONLY the edited image.`;

const hairPromptTemplate = (prompt) => `SURGICAL HAIR EDIT task. This is NOT image generation. This is NOT a recomposition.

${prompt}

${POSE_LOCK_BLOCK}

ABSOLUTE RULES — any violation makes the output unusable:
1. FACE LOCK (HIGHEST PRIORITY): ${FACE_CONSTRAINT_HAIR} The face region is completely frozen — do NOT alter eye shape, nose, lips, jawline, skin tone, or any facial feature even 1%.
2. HAIR REGION ONLY: Modify ONLY the hair pixels. Blend the hairline (temples, forehead edge, nape, ears) naturally.
3. INFILLING: If the new hairstyle exposes neck, ears, shoulders, or background previously covered by old hair, seamlessly infill with matching background and clothing pixels.
4. FRAMING LOCK: Output dimensions, zoom level, crop, and head position must be pixel-identical to the input.
5. NO REMNANTS: Ensure no traces of the original hairstyle remain on shoulders or background.
6. CLOTHING & BACKGROUND: Completely unchanged from the original.

FINAL CHECK: The output must be a direct frontal portrait. If in doubt, default to head-on frontal view. No profile, no 3/4 angle.

Output ONLY the edited image.`;

// ── style pack prompts (verbatim from geminiService.ts) ──────────────────
const stylePacks = {
  male: [
    "TASK: Change the outfit to a smart casual professional look: a well-fitted medium grey blazer worn over a clean white crew-neck t-shirt. No tie. Tailored but relaxed fit. High-quality fabric texture, realistic draping.",
    "TASK: Change the outfit to a highly professional job interview suit: a perfectly fitted dark navy suit jacket, crisp white dress shirt with spread collar, and a classic blue silk tie with a neat Windsor knot. Sharp lapels, structured shoulders.",
    "TASK: Change the outfit to an authoritative executive suit: a premium wide-lapel navy blue suit jacket, crisp white dress shirt, and a dignified burgundy striped silk tie. High-end traditional tailoring with visible chest pocket.",
    "TASK: Change the outfit to a classic navy blue polo shirt with a flat knit collar and two-button placket. Clean, mature, professional style. High-quality pique fabric texture. Short sleeves, no logo or print.",
    "TASK: Change the outfit to a classic mid-grey crewneck knit sweater over a white collared shirt. Soft merino wool texture, simple and professional. Relaxed but neat layered look.",
  ],
  female: [
    "TASK: Apply a classic business style: a structured, perfectly fitted black formal suit jacket over a plain white square-neck inner top. Clean lapels, immaculate formal tailoring, standard corporate professional style.",
    "TASK: Apply an elegant statement blouse style: a dark navy round-neck blouse featuring a large, distinctive white bow attached to the left chest area, with thin white piping trim outlining the collar and front placket. Include decorative round pearl-like front buttons.",
    "TASK: Apply a high-end Chanel style: a structured collarless black tweed jacket with a prominent fuzzy white knit trim tracing the neckline and the center front opening. Include large, prominent gold crest buttons down the front.",
    "TASK: Apply a luxurious authoritative style: a sleek black V-neck blazer worn over a dark, elegant silk scarf patterned with gold, white, and teal geometric shapes intricately tucked inside the neckline. Attach a highly detailed silver floral pearl brooch onto the left lapel.",
    "TASK: Apply a cozy casual style: a thick, dark navy-blue cable-knit sweater with a high, snug crew neckline. Prominent, realistic braided wool texture with a relaxed but neat fit.",
  ],
  male_summer: [
    "TASK: Change the outfit to a summer linen shirt. The shirt should be made of crisp, breathable linen fabric in a soft pastel color like light sky blue or mint. It can be short-sleeve or have neatly rolled-up sleeves, creating a breezy, natural, and trendy summer dandy look.",
    "TASK: Change the outfit to a short-sleeve pique polo shirt. Use a solid, high-quality thick cotton pique fabric with a structured collar. The fit should be neat, sporty, and clean, suitable for a professional yet energetic portrait.",
    "TASK: Change the outfit to a lightweight summer setup suit. Use a very thin, breathable cotton/nylon blend casual summer jacket worn over a plain white crew-neck short-sleeve t-shirt. Professional, modern, and cool for the summer heat.",
  ],
  female_summer: [
    "TASK: Change the outfit to a short-sleeve summer tweed jacket. The jacket should use a light, breathable summer tweed weave in a bright color like ivory or pale pink. It must look trendy, elegant, and fresh without being heavy or warm.",
    "TASK: Change the outfit to a cotton square-neck short-sleeve blouse. Use crisp, matte cotton fabric, absolutely no shiny silk. The square neckline should clearly show the collarbones, creating a clean, modern, and pure summer styling.",
    "TASK: Change the outfit to a natural open-collar linen shirt. The shirt should be made of textured, breathable linen in a soft ivory or beige tone. The V-neck open collar provides a breezy, effortless, and elegant summer look.",
  ],
  boy: [
    "TASK: Change the outfit to a neat preppy style: a crisp white button-down shirt layered under a thin, high-quality navy blue or cream v-neck knit vest. Smart casual, clean student look.",
    "TASK: Change the outfit to a fresh and cool summer style: a soft pastel blue or mint-colored oxford shirt with subtle thin stripes. Leave the top button undone for a natural, clean, and bright youthful appearance.",
    "TASK: Change the outfit to a trendy summer short-sleeve t-shirt. Use a solid, vibrant yet neat color like butter yellow, sage green, or cobalt blue. High-quality cotton, thick distinct neckline, with a very clean, active, and modern teenage fit without heavy logos.",
  ],
  girl: [
    "TASK: Change the outfit to a classic black blouse featuring beautiful white lace details along the collar. The stark contrast between the solid black fabric and the delicate white lace creates a distinct, elegant, and cute styling.",
    "TASK: Change the outfit to a casual plain pink dress. The fabric should be a normal soft cotton or linen blend, NOT silk or shiny. The dress should have a clean, everyday comfortable fit in a youthful, bright, and solid pink color.",
    "TASK: Change the outfit to a neat yellow short-sleeve t-shirt. The color should be a bright, clean, and cheerful yellow. High-quality cotton fabric with a simple, modern, and very tidy everyday fit, perfect for summer.",
  ],
  male_5060_suit: [
    "TASK: Change the outfit to a classic, dignified executive suit suitable for a senior expert or CEO. Dark navy blue suit jacket with traditional wide lapels, crisp white dress shirt, and a rich burgundy or gold patterned tie. High-end traditional tailoring.",
    "TASK: Change the outfit to a sophisticated grey double-breasted suit. Perfect for an authoritative senior portrait. Clean white shirt and a subtly striped silk tie.",
    "TASK: Change the outfit to a premium classic formal look: a dark charcoal grey suit jacket with a well-fitted white shirt and a classic solid navy tie. Mature, trustworthy, and elegant.",
  ],
  male_2030_suit: [
    "TASK: Change the outfit to a standard, pristine job interview suit for a young professional. Perfectly fitted dark navy single-breasted suit jacket, crisp white dress shirt with standard collar, and a neat blue or navy silk tie.",
    "TASK: Change the outfit to a modern, neat business formal look. A sharp, well-fitted dark grey or charcoal suit jacket, bright white shirt, and a simple diagonally striped tie. Energetic, trustworthy, and clean.",
    "TASK: Change the outfit to a crisp smart-casual business look. A very clean, well-fitted black suit jacket over a crisp white button-down shirt. Clean, confident and professional without a heavy tie.",
  ],
  female_5060_suit: [
    "TASK: Change the outfit to a highly elegant, luxurious jacket suitable for a senior executive or mother. A rich, textured dark navy or deep burgundy elegant structured jacket with subtle premium details like pearl buttons.",
    "TASK: Change the outfit to a classic luxury brand style. A high-end beige or light grey tweed jacket with elegant trims and buttons, worn over a simple inner blouse. Very graceful, wealthy, and sophisticated.",
    "TASK: Change the outfit to a conservative, dignified formal black suit. A well-tailored black jacket over a modest, high-quality white round-neck blouse. Professional, mature, and trustworthy.",
  ],
  female_2030_suit: [
    "TASK: Change the outfit to a classic job interview suit. A well-tailored black formal blazer worn over a crisp white dress shirt with standard pointed collars. Very traditional, neat, and highly professional corporate business style.",
    "TASK: Change the outfit to a modern pristine job interview suit. A structured black blazer worn over a plain white straight-neckline or square-neck inner top. Visually opens up the collarbones cleanly. Pure and modern corporate standard.",
    "TASK: Change the outfit to an elegant and professional job interview suit. A perfectly fitted black formal blazer worn over a pristine white V-neck chiffon inner blouse. The inner blouse features a clean, crossed or overlapping V-shaped neckline that gracefully exposes the collarbone and upper chest. Safe, classic, and trustworthy corporate style.",
  ],
  male_5060_casual: [
    "TASK: Change the outfit to a premium, relaxed daily look for a mature gentleman. A luxurious, soft navy blue or camel cashmere crewneck sweater over a subtle white polo shirt collar. Elegant, wealthy, and comfortable off-duty style.",
    "TASK: Change the outfit to a high-end golf/resort wear casual style. A very clean, well-fitted pique polo shirt in a tasteful dark tone (e.g., deep burgundy or forest green). Neat, energetic, and sophisticated.",
    "TASK: Change the outfit to a smart casual everyday look. A high-quality light grey cardigan worn over a crisp, casual white button-down shirt. Friendly, approachable, and refined.",
  ],
  male_2030_casual: [
    "TASK: Change the outfit to a trendy, clean daily look. A high-quality, comfortable semi-oversized grey or navy sweatshirt (crewneck). Simple, modern, and youthful everyday style without any heavy logos.",
    "TASK: Change the outfit to a neat 'boyfriend look'. A soft, slightly oversized knit sweater in a clean color like pale blue, mint, or black over the subtle hint of a white t-shirt collar. Trendy, soft, and modern.",
    "TASK: Change the outfit to a stylish layering look. A clean white t-shirt layered under an unbuttoned casual lightweight shirt or unstructured jacket (e.g., clean beige or navy). Energetic, casual, and pristine.",
  ],
  female_5060_casual: [
    "TASK: Change the outfit to an elegant, comfortable daily look for a mature woman. A soft, high-quality beige or blush pink cashmere knit sweater with a smooth drape. Luxurious, warm, and graceful.",
    "TASK: Change the outfit to a premium casual daytime outfit. A tasteful, flowy silk or linen blouse with a very subtle, elegant pattern or texture (e.g., subtle floral or geometric). Sophisticated, wealthy, and relaxed.",
    "TASK: Change the outfit to a gentle and approachable style. A very light, soft pastel cardigan draped elegantly over a simple high-quality white round-neck inner top. Comfortable, natural, and highly refined.",
  ],
  female_2030_casual: [
    "TASK: Change the outfit to a lovely and trendy daily look. A white or pastel-colored chiffon blouse with subtle puff sleeves and a beautiful fluid texture. Feminine, clean, and modern.",
    "TASK: Change the outfit to a stylish modern casual look. A neatly fitted or slightly cropped V-neck or cardigan sweater in a bright, cheerful color (like butter yellow or sky blue). Energetic, approachable, and trendy.",
    "TASK: Change the outfit to a relaxed and stylish daily look. A loose, relaxed linen overshirt in soft beige or light olive, with a natural wrinkled texture and buttons casually left open at the top. Comfortable, sophisticated-casual, and very on-trend for young women.",
  ],
};

const hairPacks = {
  male_interview_hair: [
    "TASK: Change the hairstyle to a neat, classic Pompadour/Slicked-back cut (포마드 컷). Hair cleanly swept back showcasing the forehead. Very professional, trustworthy corporate appearance.",
    "TASK: Change the hairstyle to a modern Two-block Ivy League cut (리젠트/상고 컷). Sides neatly trimmed short, top volume cleanly styled slightly upward exposing the forehead. Energetic, youthful, and clean.",
    "TASK: Change the hairstyle to a subtle Dandy cut showing a hint of forehead (가일 컷/애즈 펌). Neatly styled, soft but highly professional and trustworthy appearance.",
  ],
  female_interview_hair: [
    "Korean flight attendant hairstyle. Smooth 3:7 side-part, tightly pulled back behind the ears. The bun is completely hidden out of sight behind the head. Only the neatly combed front hair is visible. The neck and shoulders are completely bare.",
    "Classic slicked-back corporate hairstyle. Hair tightly combed back with a middle part. The tied portion is entirely concealed behind the head, making the neck and shoulders totally bare and exposed. Symmetrical and flawless grooming.",
    "Elegant news anchorwoman hairstyle. Deep side-parted with front root volume, then tightly swept back. The back bun is completely hidden from this frontal view. The jawline, neck, and shoulders are perfectly visible with zero hair around them.",
  ],
  male_2030_casual_hair: [
    "TASK: Change the hairstyle to a trendy Two-block soft perm (투블럭 소프트 펌). Sides and back neatly trimmed short, top styled with loose, natural waves. Youthful, modern, and very popular among Korean men in their 20s-30s.",
    "TASK: Change the hairstyle to a stylish center-part layered cut (중분 레이어드). Hair parted in the middle, falling naturally to ear length with soft layering on the ends. Hip, effortlessly cool, and very trendy.",
    "TASK: Change the hairstyle to a textured crop cut (텍스처드 크롭). Short sides with a slightly longer top, natural texture and subtle volume on the front. Clean, modern, and casually stylish.",
  ],
  male_4050_hair: [
    "TASK: Change ONLY the hairstyle to a classic side-part short cut (클래식 사이드파트). Hair neatly combed to one side with a clean side part, short and tidy on the sides and back. Polished, trustworthy, and timeless — the quintessential style for Korean men in their 40s-50s.",
    "TASK: Change ONLY the hairstyle to a clean sports short cut (스포츠 숏컷). Uniformly short all around, neat and well-groomed. Active, fresh, and low-maintenance — very popular among Korean middle-aged men.",
    "TASK: Change ONLY the hairstyle to a natural gray short cut (내추럴 그레이 숏). Short, neat cut with naturally blended silver-gray hair color integrated throughout. Distinguished, dignified, and elegantly mature.",
  ],
  female_long_hair: [
    "TASK: Change ONLY the hairstyle to sleek straight long hair (스트레이트 롱). Perfectly smooth, glossy hair falling past the chest with a clean center part. No waves, no frizz — pin-straight and polished.",
    "TASK: Change ONLY the hairstyle to layered long hair with face-framing layers (레이어드 롱). Long hair past the shoulders, soft layers starting from the chin framing the face naturally. Feminine, flowing, and modern.",
    "TASK: Change ONLY the hairstyle to long hair with loose natural waves (내추럴 웨이브 롱). Hair past the shoulders with gentle, natural S-wave or C-curl from mid-length to ends. Romantic and effortlessly beautiful.",
  ],
  female_short_hair: [
    "TASK: Change ONLY the hairstyle to a blunt jaw-length bob (턱선 단발). Perfectly even, straight ends cut precisely at the jawline. Bold, clean, and sharply modern.",
    "TASK: Change ONLY the hairstyle to a shoulder-length midi bob (미디 단발). Hair cut to shoulder length with soft, slight inward curve at the ends. Natural, versatile, and effortlessly chic.",
    "TASK: Change ONLY the hairstyle to a short pixie cut (픽시 숏컷). Very short on the sides and back, slightly longer textured top. Bold, confident, and stylishly minimal.",
  ],
  female_4050_long_hair: [
    "TASK: Change ONLY the hairstyle to a voluminous layered long hairstyle (볼륨 레이어드 롱). Long hair past the shoulders with rich volume and multiple soft layers adding body and movement. Elegant, sophisticated, and full — a classic choice for Korean women in their 40s-50s.",
    "TASK: Change ONLY the hairstyle to a spiral wave long hairstyle (스파이럴 웨이브 롱). Long hair with soft, flowing perm waves from mid-length to ends, full of graceful movement. Feminine, warm, and glamorous.",
    "TASK: Change ONLY the hairstyle to a silver-gray long hairstyle (내추럴 그레이 롱). Long hair with naturally blended silver and gray tones, soft layers adding depth. Graceful, refined, and beautifully mature.",
  ],
  female_4050_short_hair: [
    "TASK: Change ONLY the hairstyle to a voluminous wave bob (볼륨 웨이브 단발). Jaw-length bob with a full body wave perm, rich volume at the roots and ends. The most popular hairstyle for Korean women in their 40s-50s — polished and feminine.",
    "TASK: Change ONLY the hairstyle to a C-curl midi bob (C컬 미디 단발). Shoulder-length hair with a soft inward C-curl at the ends, natural volume throughout. Graceful, versatile, and very popular among Korean middle-aged women.",
    "TASK: Change ONLY the hairstyle to a refined short cut (세련된 숏컷). Short, neat cut styled with slight lift and texture on top, clean around the ears and nape. Chic, confident, and boldly elegant.",
  ],
};

// ── face assignment: which virtual face to use for each pack ─────────────
const faceForPack = {
  male: 'male_2030', female: 'female_2030',
  male_summer: 'male_2030', female_summer: 'female_2030',
  boy: 'boy', girl: 'girl',
  male_5060_suit: 'male_5060', male_2030_suit: 'male_2030',
  female_5060_suit: 'female_5060', female_2030_suit: 'female_2030',
  male_5060_casual: 'male_5060', male_2030_casual: 'male_2030',
  female_5060_casual: 'female_5060', female_2030_casual: 'female_2030',
  male_interview_hair: 'male_2030', female_interview_hair: 'female_2030',
  male_2030_casual_hair: 'male_2030', male_4050_hair: 'male_4050',
  female_long_hair: 'female_2030', female_short_hair: 'female_2030',
  female_4050_long_hair: 'female_4050', female_4050_short_hair: 'female_4050',
};

// ── load face base64 cache ───────────────────────────────────────────────
const faceCache = {};
for (const faceId of new Set(Object.values(faceForPack))) {
  const p = path.join(facesDir, `${faceId}.png`);
  if (!fs.existsSync(p)) { console.error(`Missing face: ${p}`); process.exit(1); }
  faceCache[faceId] = fs.readFileSync(p).toString('base64');
}
console.log(`[phase-2] Loaded ${Object.keys(faceCache).length} base faces`);

// ── generation ───────────────────────────────────────────────────────────
const MODEL = 'gemini-2.5-flash-image';

async function generateOne(faceId, fullPrompt, outName) {
  const started = Date.now();
  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [
        { text: fullPrompt },
        { inlineData: { mimeType: 'image/png', data: faceCache[faceId] } },
      ],
      config: {
        responseModalities: ['IMAGE'],
        imageConfig: { aspectRatio: '3:4' },
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData?.data) {
        fs.writeFileSync(path.join(outDir, `${outName}.png`), Buffer.from(part.inlineData.data, 'base64'));
        const ms = Date.now() - started;
        console.log(`  OK  ${outName}.png  (${(ms / 1000).toFixed(1)}s)`);
        return { name: outName, ok: true };
      }
    }
    throw new Error('No image data in response');
  } catch (e) {
    console.error(`  FAIL  ${outName}  —  ${e?.message || e}`);
    return { name: outName, ok: false, error: e?.message || String(e) };
  }
}

// ── main loop: one category at a time, parallel within category ─────────
const allCategories = [
  ...Object.entries(stylePacks).map(([id, prompts]) => ({ id, prompts, kind: 'style' })),
  ...Object.entries(hairPacks).map(([id, prompts]) => ({ id, prompts, kind: 'hair' })),
];

const total = allCategories.reduce((s, c) => s + c.prompts.length, 0);
console.log(`[phase-2] Generating ${total} samples across ${allCategories.length} categories with ${MODEL}...\n`);

const startTime = Date.now();
const allResults = [];

for (const cat of allCategories) {
  const faceId = faceForPack[cat.id];
  console.log(`── ${cat.id}  (${cat.kind}, ${cat.prompts.length} samples, face=${faceId}) ──`);

  const catResults = await Promise.all(
    cat.prompts.map((rawPrompt, i) => {
      const basePrompt = cat.kind === 'style' ? rawPrompt + BODY_FIT : rawPrompt;
      const fullPrompt = cat.kind === 'style'
        ? stylePromptTemplate(basePrompt)
        : hairPromptTemplate(basePrompt);
      return generateOne(faceId, fullPrompt, `${cat.id}_${i}`);
    })
  );
  allResults.push(...catResults);
}

const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
const okCount = allResults.filter(r => r.ok).length;
const failed = allResults.filter(r => !r.ok);

console.log(`\n[phase-2] ${okCount}/${total} succeeded in ${elapsed}s`);
console.log(`[phase-2] Output: ${outDir}`);
if (failed.length > 0) {
  console.log(`[phase-2] Failed (${failed.length}):`);
  for (const f of failed) console.log(`  - ${f.name}: ${f.error}`);
  process.exit(2);
}
