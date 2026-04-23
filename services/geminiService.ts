import { GoogleGenAI } from "@google/genai";
import {
  getImageDimensions,
  pickGeminiAspectRatio,
  resizeBase64ToMatch,
  detectFaceBBox,
  computeGeometryDrift,
  facePasteBack,
  FaceBBox,
} from "./imageUtils";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface EditOptions {
  preserveFace: boolean;
  /** Session-wide fixed seed for reproducibility. If omitted a random one is used. */
  sessionSeed?: number;
  /** When true, enforce output geometry == original and face paste-back from original. */
  enforceIdentity?: boolean;
  /** Pre-detected original face bbox (cache across calls within a session). */
  originalFaceBBox?: FaceBBox | null;
}

// Hard constraint block injected into every prompt. Taken from the 증명사진 프롬프트.md doc
// — "Face pose consistency" section — so the AI model receives the strongest identity lock
// the user has specified.
const POSE_LOCK_BLOCK = `
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

/**
 * Post-processing guard: aligns geometry to original dimensions and (when enforceIdentity
 * is on) detects drift and applies face paste-back from the pristine original.
 */
const applyIdentityGuard = async (
  originalBase64: string,
  generatedBase64: string,
  opts: EditOptions
): Promise<string> => {
  try {
    const origDims = await getImageDimensions(originalBase64);
    // 1) Force result to original dimensions (defends against zoom/reframe drift).
    let aligned = await resizeBase64ToMatch(generatedBase64, origDims);

    if (!opts.enforceIdentity) return aligned;

    // 2) Detect faces on both (cache original bbox via opts).
    const origBBox = opts.originalFaceBBox ?? await detectFaceBBox(originalBase64);
    const resultBBox = await detectFaceBBox(aligned);
    if (!origBBox || !resultBBox) return aligned;

    // 3) Check drift; warn in console. Always paste back when identity enforcement is on
    //    (paste-back is a no-op visually when the generated face already matches because
    //    the feathered patch blends with matching skin — but identity lock is guaranteed).
    const drift = computeGeometryDrift(origBBox, resultBBox);
    if (drift.exceeds) {
      console.warn('[identity-guard] drift exceeds tolerance:', drift);
    }

    aligned = await facePasteBack(originalBase64, aligned, origBBox, resultBBox);
    return aligned;
  } catch (e) {
    console.warn('[identity-guard] failed, returning raw generation:', e);
    return generatedBase64;
  }
};

const randomSeed = () => Math.floor(Math.random() * 2147483647);

const buildImageConfig = async (base64: string, seed: number) => {
  const dims = await getImageDimensions(base64);
  const aspectRatio = pickGeminiAspectRatio(dims.width, dims.height);
  return {
    responseModalities: ['IMAGE'] as any,
    seed,
    imageConfig: { aspectRatio },
  };
};

export const editIDPhoto = async (
  base64Image: string,
  instruction: string,
  options: EditOptions = { preserveFace: true },
  referenceImageBase64?: string,
  referenceType: 'outfit' | 'hair' = 'outfit'
): Promise<string> => {
  try {
    let mimeType = 'image/png';
    const mimeMatch = base64Image.match(/^data:(image\/[a-zA-Z+]+);base64,/);
    if (mimeMatch) mimeType = mimeMatch[1];
    const base64Data = base64Image.replace(/^data:image\/[a-zA-Z+]+;base64,/, '').replace(/[^A-Za-z0-9+/=]/g, '');

    const model = 'gemini-3.1-flash-image-preview';
    const generationSeed = options.sessionSeed ?? randomSeed();

    let parts: any[] = [];

    if (referenceImageBase64) {
      let mimeType2 = 'image/png';
      const mimeMatch2 = referenceImageBase64.match(/^data:(image\/[a-zA-Z+]+);base64,/);
      if (mimeMatch2) mimeType2 = mimeMatch2[1];
      const base64Data2 = referenceImageBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, '').replace(/[^A-Za-z0-9+/=]/g, '');

      let v2Prompt = "";

      if (referenceType === 'outfit') {
        v2Prompt = `This is a SURGICAL REFERENCE-BASED CLOTHING TRANSFER task. NOT an image generation task. NOT a recomposition task.

IMAGE 1 = The original person. This is the immutable identity, background, and pose template.
IMAGE 2 = The reference outfit source. Use ONLY the clothing style — not the person wearing it.

TASK: Apply the clothing style from IMAGE 2 to the person in IMAGE 1.

${POSE_LOCK_BLOCK}

ABSOLUTE RULES — any violation makes the output unusable:
1. CLOTHING TRANSFER ONLY: Extract garment style, color, fabric texture, and fit from IMAGE 2. Apply these properties to the clothing region of IMAGE 1 only. Adapt the garment naturally to IMAGE 1 person's body proportions and shoulder width.
2. FRAMING: Output dimensions, zoom level, crop, and head position MUST be pixel-identical to IMAGE 1. DO NOT reframe, zoom, or adjust composition in any way.
3. FACE & IDENTITY: Preserve exact facial structure, eye shape, jawline, skin tone, and skin texture from IMAGE 1. Do NOT beautify, smooth, retouch, or generate a new face. Do NOT add or remove beard, freckles, or any facial features.
4. HAIR: Hairstyle and hair color from IMAGE 1 must remain completely unchanged.
5. BACKGROUND: Every background pixel from IMAGE 1 must remain identical.
6. BODY: Shoulder position, neck, and body pose must remain exactly as in IMAGE 1.
7. DO NOT copy the face, hair, body shape, skin tone, or background from IMAGE 2.
8. THIS IS AN EDIT, NOT A GENERATION.

Output ONLY the edited image.`;

      } else if (referenceType === 'hair') {
        v2Prompt = `This is a SURGICAL HAIR TRANSFER task. NOT an image generation task. NOT a recomposition task.

IMAGE 1 = The original person. This is the fixed identity template.
IMAGE 2 = The hairstyle reference source. Use ONLY the hairstyle — not the person wearing it.

TASK: Apply the hairstyle from IMAGE 2 onto the person in IMAGE 1.

${POSE_LOCK_BLOCK}

ABSOLUTE RULES — any violation makes the output unusable:
1. HAIR REGION ONLY: Modify ONLY the hair pixels. Blend the hairline (temples, forehead edge, ears) naturally.
2. FRAMING: Output dimensions, zoom level, crop, and head position MUST be pixel-identical to IMAGE 1.
3. FACE & IDENTITY: Every facial pixel must be identical to IMAGE 1.
4. CLOTHING & BACKGROUND: Must be completely unchanged from IMAGE 1.
5. BODY: Shoulder position and body pose must remain exactly as in IMAGE 1.
6. DO NOT copy the face, skin tone, clothing, or background from IMAGE 2.
7. THIS IS AN EDIT, NOT A GENERATION.

Output ONLY the edited image.`;
      }

      parts = [
        { text: v2Prompt },
        { inlineData: { mimeType: mimeType, data: base64Data } },
        { inlineData: { mimeType: mimeType2, data: base64Data2 } }
      ];
    } else {
      const faceConstraint = options.preserveFace
        ? `FACE & IDENTITY: Preserve exact facial structure, eye shape, jawline, skin tone, and skin texture from the original. Do NOT generate a new face. Do NOT beautify, smooth, retouch, or alter any facial feature.`
        : `FACE: Preserve the person's facial features, skin tone, and identity as closely as possible.`;

      const v1Prompt = `This is a SURGICAL CLOTHING/HAIR EDIT task. NOT an image generation task. NOT a recomposition task.

The attached photo is the fixed identity template.
TASK: ${instruction}

${POSE_LOCK_BLOCK}

ABSOLUTE RULES — any violation makes the output unusable:
1. EDIT ONLY THE TARGET REGION: Modify ONLY the clothing or hair pixels as instructed.
2. FRAMING: Output dimensions, zoom level, crop, and head position MUST be pixel-identical to the input photo.
3. ${faceConstraint}
4. HAIR: When editing clothing — hairstyle and hair color must remain completely unchanged. When editing hair — all clothing must remain completely unchanged.
5. BACKGROUND: Every background pixel must be completely identical to the input.
6. BODY: Shoulders, neck, and body pose must remain exactly as in the input.
7. THIS IS AN EDIT, NOT A GENERATION.

Output ONLY the edited image.`;

      parts = [
        { text: v1Prompt },
        { inlineData: { mimeType: mimeType, data: base64Data } }
      ];
    }

    const response = await ai.models.generateContent({
      model: model,
      contents: parts,
      config: await buildImageConfig(base64Image, generationSeed),
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData && part.inlineData.data) {
        const raw = "data:image/png;base64," + part.inlineData.data;
        return await applyIdentityGuard(base64Image, raw, options);
      }
    }

    throw new Error("No image data returned from Gemini.");
  } catch (error) {
    console.error("Gemini Image Generation Error:", error);
    throw error;
  }
};

export const generateStylePack = async (
  base64Image: string,
  gender: 'male' | 'female' | 'male_summer' | 'female_summer' | 'boy' | 'girl' | 'male_5060_suit' | 'male_2030_suit' | 'female_5060_suit' | 'female_2030_suit' | 'male_5060_casual' | 'male_2030_casual' | 'female_5060_casual' | 'female_2030_casual',
  options: EditOptions = { preserveFace: true }
): Promise<string[]> => {
  try {
    let mimeType = 'image/png';
    const mimeMatch = base64Image.match(/^data:(image\/[a-zA-Z+]+);base64,/);
    if (mimeMatch) mimeType = mimeMatch[1];
    const base64Data = base64Image.replace(/^data:image\/[a-zA-Z+]+;base64,/, '').replace(/[^A-Za-z0-9+/=]/g, '');

    const faceConstraint = options.preserveFace
      ? `FACE & IDENTITY: Preserve exact facial structure, eye shape, jawline, skin tone, and skin texture from the original. Do NOT generate a new face. HAIR color and style must also remain completely unchanged.`
      : `FACE: Preserve the person's facial features, skin tone, and identity as closely as possible. Hair color and style unchanged.`;

    const malePrompts = [
      "TASK: Change the outfit to a smart casual professional look: a well-fitted medium grey blazer worn over a clean white crew-neck t-shirt. No tie. Tailored but relaxed fit. High-quality fabric texture, realistic draping.",
      "TASK: Change the outfit to a highly professional job interview suit: a perfectly fitted dark navy suit jacket, crisp white dress shirt with spread collar, and a classic blue silk tie with a neat Windsor knot. Sharp lapels, structured shoulders.",
      "TASK: Change the outfit to an authoritative executive suit: a premium wide-lapel navy blue suit jacket, crisp white dress shirt, and a dignified burgundy striped silk tie. High-end traditional tailoring with visible chest pocket.",
      "TASK: Change the outfit to a classic navy blue polo shirt with a flat knit collar and two-button placket. Clean, mature, professional style. High-quality pique fabric texture. Short sleeves, no logo or print.",
      "TASK: Change the outfit to a classic mid-grey crewneck knit sweater over a white collared shirt. Soft merino wool texture, simple and professional. Relaxed but neat layered look."
    ];

    const femalePrompts = [
      "TASK: Apply a classic business style: a structured, perfectly fitted black formal suit jacket over a plain white square-neck inner top. Clean lapels, immaculate formal tailoring, standard corporate professional style.",
      "TASK: Apply an elegant statement blouse style: a dark navy round-neck blouse featuring a large, distinctive white bow attached to the left chest area, with thin white piping trim outlining the collar and front placket. Include decorative round pearl-like front buttons.",
      "TASK: Apply a high-end Chanel style: a structured collarless black tweed jacket with a prominent fuzzy white knit trim tracing the neckline and the center front opening. Include large, prominent gold crest buttons down the front.",
      "TASK: Apply a luxurious authoritative style: a sleek black V-neck blazer worn over a dark, elegant silk scarf patterned with gold, white, and teal geometric shapes intricately tucked inside the neckline. Attach a highly detailed silver floral pearl brooch onto the left lapel.",
      "TASK: Apply a cozy casual style: a thick, dark navy-blue cable-knit sweater with a high, snug crew neckline. Prominent, realistic braided wool texture with a relaxed but neat fit."
    ];

    const maleSummerPrompts = [
      "TASK: Change the outfit to a summer linen shirt. The shirt should be made of crisp, breathable linen fabric in a soft pastel color like light sky blue or mint. It can be short-sleeve or have neatly rolled-up sleeves, creating a breezy, natural, and trendy summer dandy look.",
      "TASK: Change the outfit to a short-sleeve pique polo shirt. Use a solid, high-quality thick cotton pique fabric with a structured collar. The fit should be neat, sporty, and clean, suitable for a professional yet energetic portrait.",
      "TASK: Change the outfit to a lightweight summer setup suit. Use a very thin, breathable cotton/nylon blend casual summer jacket worn over a plain white crew-neck short-sleeve t-shirt. Professional, modern, and cool for the summer heat."
    ];

    const femaleSummerPrompts = [
      "TASK: Change the outfit to a short-sleeve summer tweed jacket. The jacket should use a light, breathable summer tweed weave in a bright color like ivory or pale pink. It must look trendy, elegant, and fresh without being heavy or warm.",
      "TASK: Change the outfit to a cotton square-neck short-sleeve blouse. Use crisp, matte cotton fabric, absolutely no shiny silk. The square neckline should clearly show the collarbones, creating a clean, modern, and pure summer styling.",
      "TASK: Change the outfit to a natural open-collar linen shirt. The shirt should be made of textured, breathable linen in a soft ivory or beige tone. The V-neck open collar provides a breezy, effortless, and elegant summer look."
    ];

    const boyPrompts = [
      "TASK: Change the outfit to a neat preppy style: a crisp white button-down shirt layered under a thin, high-quality navy blue or cream v-neck knit vest. Smart casual, clean student look.",
      "TASK: Change the outfit to a fresh and cool summer style: a soft pastel blue or mint-colored oxford shirt with subtle thin stripes. Leave the top button undone for a natural, clean, and bright youthful appearance.",
      "TASK: Change the outfit to a trendy summer short-sleeve t-shirt. Use a solid, vibrant yet neat color like butter yellow, sage green, or cobalt blue. High-quality cotton, thick distinct neckline, with a very clean, active, and modern teenage fit without heavy logos."
    ];

    const girlPrompts = [
      "TASK: Change the outfit to a classic black blouse featuring beautiful white lace details along the collar. The stark contrast between the solid black fabric and the delicate white lace creates a distinct, elegant, and cute styling.",
      "TASK: Change the outfit to a casual plain pink dress. The fabric should be a normal soft cotton or linen blend, NOT silk or shiny. The dress should have a clean, everyday comfortable fit in a youthful, bright, and solid pink color.",
      "TASK: Change the outfit to a neat yellow short-sleeve t-shirt. The color should be a bright, clean, and cheerful yellow. High-quality cotton fabric with a simple, modern, and very tidy everyday fit, perfect for summer."
    ];

    const male5060SuitPrompts = [
      "TASK: Change the outfit to a classic, dignified executive suit suitable for a senior expert or CEO. Dark navy blue suit jacket with traditional wide lapels, crisp white dress shirt, and a rich burgundy or gold patterned tie. High-end traditional tailoring.",
      "TASK: Change the outfit to a sophisticated grey double-breasted suit. Perfect for an authoritative senior portrait. Clean white shirt and a subtly striped silk tie.",
      "TASK: Change the outfit to a premium classic formal look: a dark charcoal grey suit jacket with a well-fitted white shirt and a classic solid navy tie. Mature, trustworthy, and elegant."
    ];

    const male2030SuitPrompts = [
      "TASK: Change the outfit to a standard, pristine job interview suit for a young professional. Perfectly fitted dark navy single-breasted suit jacket, crisp white dress shirt with standard collar, and a neat blue or navy silk tie.",
      "TASK: Change the outfit to a modern, neat business formal look. A sharp, well-fitted dark grey or charcoal suit jacket, bright white shirt, and a simple diagonally striped tie. Energetic, trustworthy, and clean.",
      "TASK: Change the outfit to a crisp smart-casual business look. A very clean, well-fitted black suit jacket over a crisp white button-down shirt. Clean, confident and professional without a heavy tie."
    ];

    const female5060SuitPrompts = [
      "TASK: Change the outfit to a highly elegant, luxurious jacket suitable for a senior executive or mother. A rich, textured dark navy or deep burgundy elegant structured jacket with subtle premium details like pearl buttons.",
      "TASK: Change the outfit to a classic luxury brand style. A high-end beige or light grey tweed jacket with elegant trims and buttons, worn over a simple inner blouse. Very graceful, wealthy, and sophisticated.",
      "TASK: Change the outfit to a conservative, dignified formal black suit. A well-tailored black jacket over a modest, high-quality white round-neck blouse. Professional, mature, and trustworthy."
    ];

    const female2030SuitPrompts = [
      "TASK: Change the outfit to a classic job interview suit. A well-tailored black formal blazer worn over a crisp white dress shirt with standard pointed collars. Very traditional, neat, and highly professional corporate business style.",
      "TASK: Change the outfit to a modern pristine job interview suit. A structured black blazer worn over a plain white straight-neckline or square-neck inner top. Visually opens up the collarbones cleanly. Pure and modern corporate standard.",
      "TASK: Change the outfit to an elegant and professional job interview suit. A perfectly fitted black formal blazer worn over a pristine white V-neck chiffon inner blouse. The inner blouse features a clean, crossed or overlapping V-shaped neckline that gracefully exposes the collarbone and upper chest. Safe, classic, and trustworthy corporate style."
    ];

    const male5060CasualPrompts = [
      "TASK: Change the outfit to a premium, relaxed daily look for a mature gentleman. A luxurious, soft navy blue or camel cashmere crewneck sweater over a subtle white polo shirt collar. Elegant, wealthy, and comfortable off-duty style.",
      "TASK: Change the outfit to a high-end golf/resort wear casual style. A very clean, well-fitted pique polo shirt in a tasteful dark tone (e.g., deep burgundy or forest green). Neat, energetic, and sophisticated.",
      "TASK: Change the outfit to a smart casual everyday look. A high-quality light grey cardigan worn over a crisp, casual white button-down shirt. Friendly, approachable, and refined."
    ];

    const male2030CasualPrompts = [
      "TASK: Change the outfit to a trendy, clean daily look. A high-quality, comfortable semi-oversized grey or navy sweatshirt (crewneck). Simple, modern, and youthful everyday style without any heavy logos.",
      "TASK: Change the outfit to a neat 'boyfriend look'. A soft, slightly oversized knit sweater in a clean color like pale blue, mint, or black over the subtle hint of a white t-shirt collar. Trendy, soft, and modern.",
      "TASK: Change the outfit to a stylish layering look. A clean white t-shirt layered under an unbuttoned casual lightweight shirt or unstructured jacket (e.g., clean beige or navy). Energetic, casual, and pristine."
    ];

    const female5060CasualPrompts = [
      "TASK: Change the outfit to an elegant, comfortable daily look for a mature woman. A soft, high-quality beige or blush pink cashmere knit sweater with a smooth drape. Luxurious, warm, and graceful.",
      "TASK: Change the outfit to a premium casual daytime outfit. A tasteful, flowy silk or linen blouse with a very subtle, elegant pattern or texture (e.g., subtle floral or geometric). Sophisticated, wealthy, and relaxed.",
      "TASK: Change the outfit to a gentle and approachable style. A very light, soft pastel cardigan draped elegantly over a simple high-quality white round-neck inner top. Comfortable, natural, and highly refined."
    ];

    const female2030CasualPrompts = [
      "TASK: Change the outfit to a lovely and trendy daily look. A white or pastel-colored chiffon blouse with subtle puff sleeves and a beautiful fluid texture. Feminine, clean, and modern.",
      "TASK: Change the outfit to a stylish modern casual look. A neatly fitted or slightly cropped V-neck or cardigan sweater in a bright, cheerful color (like butter yellow or sky blue). Energetic, approachable, and trendy.",
      "TASK: Change the outfit to a relaxed and stylish daily look. A loose, relaxed linen overshirt in soft beige or light olive, with a natural wrinkled texture and buttons casually left open at the top. Comfortable, sophisticated-casual, and very on-trend for young women."
    ];

    let basePrompts;
    if (gender === 'male') basePrompts = malePrompts;
    else if (gender === 'female') basePrompts = femalePrompts;
    else if (gender === 'male_summer') basePrompts = maleSummerPrompts;
    else if (gender === 'female_summer') basePrompts = femaleSummerPrompts;
    else if (gender === 'boy') basePrompts = boyPrompts;
    else if (gender === 'male_5060_suit') basePrompts = male5060SuitPrompts;
    else if (gender === 'male_2030_suit') basePrompts = male2030SuitPrompts;
    else if (gender === 'female_5060_suit') basePrompts = female5060SuitPrompts;
    else if (gender === 'female_2030_suit') basePrompts = female2030SuitPrompts;
    else if (gender === 'male_5060_casual') basePrompts = male5060CasualPrompts;
    else if (gender === 'male_2030_casual') basePrompts = male2030CasualPrompts;
    else if (gender === 'female_5060_casual') basePrompts = female5060CasualPrompts;
    else if (gender === 'female_2030_casual') basePrompts = female2030CasualPrompts;
    else basePrompts = girlPrompts;

    const bodyFitDirective = " Adapt the garment to the person's EXACT body proportions and shoulder width from the original photo without making them wider or narrower.";
    const targetPrompts = basePrompts.map(prompt => prompt + bodyFitDirective);

    const sharedConfig = await buildImageConfig(
      base64Image,
      options.sessionSeed ?? randomSeed()
    );

    const generateSingle = async (promptInstruction: string): Promise<string> => {
      const fullPrompt = `SURGICAL CLOTHING EDIT task. NOT an image generation task. NOT a recomposition task.

${promptInstruction}

${POSE_LOCK_BLOCK}

ABSOLUTE RULES — any violation makes the output unusable:
1. CLOTHING ONLY: Modify ONLY the clothing/fabric pixels on the torso and arms. Every other pixel must be copied from the input unchanged.
2. FRAMING & POSE (CRITICAL): Output must be pixel-identical to the input in dimensions, zoom level, crop, and head position.
3. ${faceConstraint}
4. BACKGROUND: Every background pixel must be identical to the input.
5. BODY FIT: The garment fit must match the exact original shoulder width, arm thickness, and neckline of the input. Do not widen or narrow the subject.
6. THIS IS A STRICT PIXEL-LEVEL EDIT, NOT A GENERATION.

Output ONLY the edited image.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: [
          { text: fullPrompt },
          { inlineData: { mimeType, data: base64Data } }
        ],
        config: sharedConfig,
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData && part.inlineData.data) {
          const raw = "data:image/png;base64," + part.inlineData.data;
          return await applyIdentityGuard(base64Image, raw, options);
        }
      }
      throw new Error("No image data returned from generator.");
    };

    const results = await Promise.all(
      targetPrompts.map((prompt) => generateSingle(prompt))
    );

    return results;
  } catch (error) {
    console.error("Gemini 5-Pack Generation Error:", error);
    throw error;
  }
};

export const generateHairPack = async (
  base64Image: string,
  gender: 'male_interview_hair' | 'female_interview_hair' | 'male_2030_casual_hair' | 'male_4050_hair' | 'female_long_hair' | 'female_short_hair' | 'female_4050_long_hair' | 'female_4050_short_hair',
  options: EditOptions = { preserveFace: true }
): Promise<string[]> => {
  try {
    let mimeType = 'image/png';
    const mimeMatch = base64Image.match(/^data:(image\/[a-zA-Z+]+);base64,/);
    if (mimeMatch) mimeType = mimeMatch[1];
    const base64Data = base64Image.replace(/^data:image\/[a-zA-Z+]+;base64,/, '').replace(/[^A-Za-z0-9+/=]/g, '');

    const faceConstraint = options.preserveFace
      ? `FACE & IDENTITY: Preserve exact facial structure, eye shape, jawline, skin tone, and skin texture from the original. Do NOT generate a new face. Do NOT retouch or alter facial features. CLOTHING must also remain completely unchanged.`
      : `FACE: Preserve the person's facial features and identity. CLOTHING must be completely unchanged.`;

    const maleInterviewHairPrompts = [
      "TASK: Change the hairstyle to a neat, classic Pompadour/Slicked-back cut (포마드 컷). Hair cleanly swept back showcasing the forehead. Very professional, trustworthy corporate appearance.",
      "TASK: Change the hairstyle to a modern Two-block Ivy League cut (리젠트/상고 컷). Sides neatly trimmed short, top volume cleanly styled slightly upward exposing the forehead. Energetic, youthful, and clean.",
      "TASK: Change the hairstyle to a subtle Dandy cut showing a hint of forehead (가일 컷/애즈 펌). Neatly styled, soft but highly professional and trustworthy appearance."
    ];

    const femaleInterviewHairPrompts = [
      "Korean flight attendant hairstyle. Smooth 3:7 side-part, tightly pulled back behind the ears. The bun is completely hidden out of sight behind the head. Only the neatly combed front hair is visible. The neck and shoulders are completely bare.",
      "Classic slicked-back corporate hairstyle. Hair tightly combed back with a middle part. The tied portion is entirely concealed behind the head, making the neck and shoulders totally bare and exposed. Symmetrical and flawless grooming.",
      "Elegant news anchorwoman hairstyle. Deep side-parted with front root volume, then tightly swept back. The back bun is completely hidden from this frontal view. The jawline, neck, and shoulders are perfectly visible with zero hair around them."
    ];

    const male2030CasualHairPrompts = [
      "TASK: Change the hairstyle to a trendy Two-block soft perm (투블럭 소프트 펌). Sides and back neatly trimmed short, top styled with loose, natural waves. Youthful, modern, and very popular among Korean men in their 20s-30s.",
      "TASK: Change the hairstyle to a stylish center-part layered cut (중분 레이어드). Hair parted in the middle, falling naturally to ear length with soft layering on the ends. Hip, effortlessly cool, and very trendy.",
      "TASK: Change the hairstyle to a textured crop cut (텍스처드 크롭). Short sides with a slightly longer top, natural texture and subtle volume on the front. Clean, modern, and casually stylish."
    ];

    const femaleLongHairPrompts = [
      "TASK: Change ONLY the hairstyle to sleek straight long hair (스트레이트 롱). Perfectly smooth, glossy hair falling past the chest with a clean center part. No waves, no frizz — pin-straight and polished.",
      "TASK: Change ONLY the hairstyle to layered long hair with face-framing layers (레이어드 롱). Long hair past the shoulders, soft layers starting from the chin framing the face naturally. Feminine, flowing, and modern.",
      "TASK: Change ONLY the hairstyle to long hair with loose natural waves (내추럴 웨이브 롱). Hair past the shoulders with gentle, natural S-wave or C-curl from mid-length to ends. Romantic and effortlessly beautiful."
    ];

    const femaleShortHairPrompts = [
      "TASK: Change ONLY the hairstyle to a blunt jaw-length bob (턱선 단발). Perfectly even, straight ends cut precisely at the jawline. Bold, clean, and sharply modern.",
      "TASK: Change ONLY the hairstyle to a shoulder-length midi bob (미디 단발). Hair cut to shoulder length with soft, slight inward curve at the ends. Natural, versatile, and effortlessly chic.",
      "TASK: Change ONLY the hairstyle to a short pixie cut (픽시 숏컷). Very short on the sides and back, slightly longer textured top. Bold, confident, and stylishly minimal."
    ];

    const male4050HairPrompts = [
      "TASK: Change ONLY the hairstyle to a classic side-part short cut (클래식 사이드파트). Hair neatly combed to one side with a clean side part, short and tidy on the sides and back. Polished, trustworthy, and timeless — the quintessential style for Korean men in their 40s-50s.",
      "TASK: Change ONLY the hairstyle to a clean sports short cut (스포츠 숏컷). Uniformly short all around, neat and well-groomed. Active, fresh, and low-maintenance — very popular among Korean middle-aged men.",
      "TASK: Change ONLY the hairstyle to a natural gray short cut (내추럴 그레이 숏). Short, neat cut with naturally blended silver-gray hair color integrated throughout. Distinguished, dignified, and elegantly mature."
    ];

    const female4050LongHairPrompts = [
      "TASK: Change ONLY the hairstyle to a voluminous layered long hairstyle (볼륨 레이어드 롱). Long hair past the shoulders with rich volume and multiple soft layers adding body and movement. Elegant, sophisticated, and full — a classic choice for Korean women in their 40s-50s.",
      "TASK: Change ONLY the hairstyle to a spiral wave long hairstyle (스파이럴 웨이브 롱). Long hair with soft, flowing perm waves from mid-length to ends, full of graceful movement. Feminine, warm, and glamorous.",
      "TASK: Change ONLY the hairstyle to a silver-gray long hairstyle (내추럴 그레이 롱). Long hair with naturally blended silver and gray tones, soft layers adding depth. Graceful, refined, and beautifully mature."
    ];

    const female4050ShortHairPrompts = [
      "TASK: Change ONLY the hairstyle to a voluminous wave bob (볼륨 웨이브 단발). Jaw-length bob with a full body wave perm, rich volume at the roots and ends. The most popular hairstyle for Korean women in their 40s-50s — polished and feminine.",
      "TASK: Change ONLY the hairstyle to a C-curl midi bob (C컬 미디 단발). Shoulder-length hair with a soft inward C-curl at the ends, natural volume throughout. Graceful, versatile, and very popular among Korean middle-aged women.",
      "TASK: Change ONLY the hairstyle to a refined short cut (세련된 숏컷). Short, neat cut styled with slight lift and texture on top, clean around the ears and nape. Chic, confident, and boldly elegant."
    ];

    let targetPrompts;
    if (gender === 'male_interview_hair') targetPrompts = maleInterviewHairPrompts;
    else if (gender === 'male_2030_casual_hair') targetPrompts = male2030CasualHairPrompts;
    else if (gender === 'male_4050_hair') targetPrompts = male4050HairPrompts;
    else if (gender === 'female_long_hair') targetPrompts = femaleLongHairPrompts;
    else if (gender === 'female_short_hair') targetPrompts = femaleShortHairPrompts;
    else if (gender === 'female_4050_long_hair') targetPrompts = female4050LongHairPrompts;
    else if (gender === 'female_4050_short_hair') targetPrompts = female4050ShortHairPrompts;
    else targetPrompts = femaleInterviewHairPrompts;

    const sharedConfig = await buildImageConfig(
      base64Image,
      options.sessionSeed ?? randomSeed()
    );

    const generateSingle = async (promptInstruction: string): Promise<string> => {
      const fullPrompt = `SURGICAL HAIR EDIT task. This is NOT image generation. This is NOT a recomposition.

${promptInstruction}

${POSE_LOCK_BLOCK}

ABSOLUTE RULES — any violation makes the output unusable:
1. FACE LOCK (HIGHEST PRIORITY): ${faceConstraint} The face region is completely frozen — do NOT alter eye shape, nose, lips, jawline, skin tone, or any facial feature even 1%.
2. HAIR REGION ONLY: Modify ONLY the hair pixels. Blend the hairline (temples, forehead edge, nape, ears) naturally.
3. INFILLING: If the new hairstyle exposes neck, ears, shoulders, or background previously covered by old hair, seamlessly infill with matching background and clothing pixels.
4. FRAMING LOCK: Output dimensions, zoom level, crop, and head position must be pixel-identical to the input.
5. NO REMNANTS: Ensure no traces of the original hairstyle remain on shoulders or background.
6. CLOTHING & BACKGROUND: Completely unchanged from the original.

Output ONLY the edited image.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: [
          { text: fullPrompt },
          { inlineData: { mimeType, data: base64Data } }
        ],
        config: sharedConfig,
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData && part.inlineData.data) {
          const raw = "data:image/png;base64," + part.inlineData.data;
          return await applyIdentityGuard(base64Image, raw, options);
        }
      }
      throw new Error("No image data returned from generator.");
    };

    const results = await Promise.all(
      targetPrompts.map((prompt) => generateSingle(prompt))
    );

    return results;
  } catch (error) {
    console.error("Gemini Hair Pack Generation Error:", error);
    throw error;
  }
};

export const extractReferencePrompt = async (
  referenceImageBase64: string,
  referenceType: 'outfit' | 'hair'
): Promise<string> => {
  try {
    let mimeType = 'image/png';
    const mimeMatch = referenceImageBase64.match(/^data:(image\/[a-zA-Z+]+);base64,/);
    if (mimeMatch) mimeType = mimeMatch[1];
    const base64Data = referenceImageBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, '').replace(/[^A-Za-z0-9+/=]/g, '');

    const model = 'gemini-3.1-flash-image-preview';
    const instruction = referenceType === 'outfit'
      ? `Role: 당신은 사용자가 입고자 하는 '타겟 의상 이미지'를 정밀 분석하는 비전 에이전트입니다.
Task: 입력된 타겟 의상 이미지의 형태(넥라인 모양, 소매), 메인 색상, 재질, 패턴, 특징적 요소를 분석하여 인페인팅 모델이 이해할 수 있는 20단어 이내의 간결한 영문 묘사로 추출하십시오.
Constraint: 주관적 감상을 배제하고 시각적 팩트만 나열하십시오. (예: "plain black crew-neck cotton t-shirt with no graphics")
Output Format: [Target_Garment_Description] 형태의 텍스트로만 출력하십시오.`
      : `You are a professional hair stylist. Analyze the hairstyle in this image with maximum precision.

Include ALL of the following:
- Hair length (approximate: pixie / short / ear-length / chin-length / shoulder-length / mid-back / long)
- Hair color (exact shade, e.g., "jet black", "dark espresso brown", "warm chestnut", "platinum blonde", "silver grey")
- Texture (straight / wavy / curly / coily — if wavy or curly, specify tightness: loose / medium / tight)
- Parting (center part / left side part / right side part / no visible part / slicked back)
- Volume (flat / normal / voluminous — at roots and at ends separately)
- Styling finish (blowout / natural air-dry / salon-styled / slicked / braided)
- Specific structural features (layers, bangs type, highlights, updo elements, bun/ponytail construction if present)

Do NOT describe the person's face, clothing, skin tone, or background.
Output ONLY the hairstyle description as a precise, detailed physical description in English.`;

    const response = await ai.models.generateContent({
      model: model,
      contents: [
        { text: instruction },
        { inlineData: { mimeType, data: base64Data } }
      ]
    });

    return response.text || "A standard " + referenceType;
  } catch (error) {
    console.error("Gemini V4 Extraction Error:", error);
    throw error;
  }
};


export const editIDPhotoV4 = async (
  base64Image: string,
  extractedDescription: string,
  options: EditOptions = { preserveFace: true },
  referenceType: 'outfit' | 'hair' = 'outfit'
): Promise<string> => {
  try {
    let mimeType = 'image/png';
    const mimeMatch = base64Image.match(/^data:(image\/[a-zA-Z+]+);base64,/);
    if (mimeMatch) mimeType = mimeMatch[1];
    const base64Data = base64Image.replace(/^data:image\/[a-zA-Z+]+;base64,/, '').replace(/[^A-Za-z0-9+/=]/g, '');

    const model = 'gemini-3.1-flash-image-preview';
    const generationSeed = options.sessionSeed ?? randomSeed();

    const editRegion = referenceType === 'outfit' ? 'CLOTHING' : 'HAIR';
    const lockedRegion = referenceType === 'outfit' ? 'HAIR' : 'CLOTHING';
    const lockedRegionDetail = referenceType === 'outfit'
      ? 'Hairstyle and hair color must remain completely unchanged.'
      : 'All clothing must remain completely unchanged.';

    const v4Prompt = `주제: SURGICAL ${editRegion} EDIT task
The attached photo is the absolute, unchangeable identity template.

세부 묘사 - ${editRegion}
아래 설명대로 ${editRegion.toLowerCase()} 영역만 정밀하게 교체하세요:
"${extractedDescription}"
${lockedRegion} 상태 유지 조건: ${lockedRegionDetail}

${POSE_LOCK_BLOCK}

화질 및 조명 (원본 화질 완전 복사)
- Match the exact lighting, noise level, and image tone of the original input.
- 원본 피부 결, 잡티, 고유의 조명 느낌을 어느 것도 미화하지 말고 있는 그대로 픽셀 단위로 재현.

편집 지시
- Keep the face 100% physically identical to the input.
- 눈 모양, 코, 입, 얼굴 윤곽선 픽셀을 가장 먼저 물리적으로 똑같이 복사한 뒤에 다른 작업을 수행할 것.
- Maintain the exact original background without any changes.
- THIS IS A STRICT PIXEL-LEVEL EDIT, NOT A PORTRAIT GENERATION.
Output ONLY the edited image.`;

    const parts: any[] = [
      { text: v4Prompt },
      { inlineData: { mimeType, data: base64Data } }
    ];

    const response = await ai.models.generateContent({
      model: model,
      contents: parts,
      config: await buildImageConfig(base64Image, generationSeed),
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData && part.inlineData.data) {
        const raw = "data:image/png;base64," + part.inlineData.data;
        return await applyIdentityGuard(base64Image, raw, options);
      }
    }

    throw new Error("No image data returned from Gemini V4.");
  } catch (error) {
    console.error("Gemini V4 Edit Error:", error);
    throw error;
  }
};
