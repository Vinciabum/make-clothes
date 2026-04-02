import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface EditOptions {
  preserveFace: boolean;
}

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
    // Face preservation is handled entirely by prompt constraints, not by seed.
    // A fixed seed only reproduces the same output for the same input — it does not
    // preserve facial identity across different input photos.
    const generationSeed = Math.floor(Math.random() * 2147483647);

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

ABSOLUTE RULES — any violation makes the output unusable:
1. CLOTHING TRANSFER ONLY: Extract garment style, color, fabric texture, and fit from IMAGE 2. Apply these properties to the clothing region of IMAGE 1 only. Adapt the garment naturally to IMAGE 1 person's body proportions and shoulder width.
2. FRAMING: Output dimensions, zoom level, crop, and head position MUST be pixel-identical to IMAGE 1. DO NOT reframe, zoom, or adjust composition in any way.
3. FACE & IDENTITY: Preserve exact facial structure, eye shape, jawline, skin tone, and skin texture from IMAGE 1. Do NOT beautify, smooth, retouch, or generate a new face. Do NOT add or remove beard, freckles, or any facial features.
4. HAIR: Hairstyle and hair color from IMAGE 1 must remain completely unchanged. Do not modify, recolor, or restyle the hair.
5. BACKGROUND: Every background pixel from IMAGE 1 must remain identical. Do not alter the environment.
6. BODY: Shoulder position, neck, and body pose must remain exactly as in IMAGE 1.
7. DO NOT copy the face, hair, body shape, skin tone, or background from IMAGE 2.
8. THIS IS AN EDIT, NOT A GENERATION. Do not reimagine or recompose the photo.

Output ONLY the edited image.`;

      } else if (referenceType === 'hair') {
        v2Prompt = `This is a SURGICAL HAIR TRANSFER task. NOT an image generation task. NOT a recomposition task.

IMAGE 1 = The original person. This is the fixed identity template.
IMAGE 2 = The hairstyle reference source. Use ONLY the hairstyle — not the person wearing it.

TASK: Apply the hairstyle from IMAGE 2 onto the person in IMAGE 1.

ABSOLUTE RULES — any violation makes the output unusable:
1. HAIR REGION ONLY: Modify ONLY the hair pixels. Blend the hairline (temples, forehead edge, ears) naturally — do not create sharp or unnatural boundaries.
2. FRAMING: Output dimensions, zoom level, crop, and head position MUST be pixel-identical to IMAGE 1. DO NOT zoom out. DO NOT reframe. DO NOT adjust composition in any way.
3. FACE & IDENTITY: Every facial pixel must be identical to IMAGE 1. Do NOT retouch, smooth, beautify, or alter the face, jawline, eye shape, skin tone, or skin texture. Do NOT add or remove beard, freckles, or any facial features.
4. CLOTHING & BACKGROUND: Must be completely unchanged from IMAGE 1.
5. BODY: Shoulder position and body pose must remain exactly as in IMAGE 1.
6. DO NOT copy the face, skin tone, clothing, or background from IMAGE 2.
7. THIS IS AN EDIT, NOT A GENERATION. Do not reimagine or recompose the photo.

Output ONLY the edited image.`;
      }

      parts = [
        { text: v2Prompt },
        { inlineData: { mimeType: mimeType, data: base64Data } },
        { inlineData: { mimeType: mimeType2, data: base64Data2 } }
      ];
    } else {
      const faceConstraint = options.preserveFace
        ? `FACE & IDENTITY: Preserve exact facial structure, eye shape, jawline, skin tone, and skin texture from the original. Do NOT generate a new face. Do NOT beautify, smooth, retouch, or alter any facial feature. Do NOT add or remove beard, freckles, wrinkles, or any identity-defining detail. Natural skin texture must be maintained as-is.`
        : `FACE: Preserve the person's facial features, skin tone, and identity as closely as possible.`;

      const v1Prompt = `This is a SURGICAL CLOTHING/HAIR EDIT task. NOT an image generation task. NOT a recomposition task.

The attached photo is the fixed identity template. The person in this photo is the immutable identity source.
TASK: ${instruction}

ABSOLUTE RULES — any violation makes the output unusable:
1. EDIT ONLY THE TARGET REGION: Modify ONLY the clothing or hair pixels as instructed. Every other pixel must remain unchanged.
2. FRAMING: Output dimensions, zoom level, crop, and head position MUST be pixel-identical to the input photo. DO NOT zoom out. DO NOT zoom in. DO NOT reframe. DO NOT adjust composition in any way.
3. ${faceConstraint}
4. HAIR: When editing clothing — hairstyle and hair color must remain completely unchanged. When editing hair — all clothing must remain completely unchanged.
5. BACKGROUND: Every background pixel must be completely identical to the input. Do not alter the environment.
6. BODY: Shoulders, neck, and body pose must remain exactly as in the input.
7. THIS IS AN EDIT, NOT A GENERATION. Do not reimagine or recompose the photo.

Output ONLY the edited image.`;
      
      parts = [
        { text: v1Prompt },
        { inlineData: { mimeType: mimeType, data: base64Data } }
      ];
    }

    const response = await ai.models.generateContent({
      model: model,
      contents: parts,
      config: { responseModalities: ['IMAGE'], seed: generationSeed },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData && part.inlineData.data) {
        return "data:image/png;base64," + part.inlineData.data;
      }
    }

    throw new Error("No image data returned from Gemini.");
  } catch (error) {
    console.error("Gemini Image Generation Error:", error);
    throw error;
  }
};

/**
 * V3 Feature: One-Click 5-Variations Multi-Generation utilizing gemini-2.5-flash-image for speed
 */
export const generateStylePack = async (
  base64Image: string,
  gender: 'male' | 'female' | 'male_summer' | 'female_summer' | 'boy' | 'girl',
  options: EditOptions = { preserveFace: true }
): Promise<string[]> => {
  try {
    let mimeType = 'image/png';
    const mimeMatch = base64Image.match(/^data:(image\/[a-zA-Z+]+);base64,/);
    if (mimeMatch) mimeType = mimeMatch[1];
    const base64Data = base64Image.replace(/^data:image\/[a-zA-Z+]+;base64,/, '').replace(/[^A-Za-z0-9+/=]/g, '');

    const faceConstraint = options.preserveFace
      ? `FACE & IDENTITY: Preserve exact facial structure, eye shape, jawline, skin tone, and skin texture from the original. Do NOT generate a new face. Do NOT beautify, smooth, retouch, or alter any facial feature. Do NOT add or remove beard, freckles, or any identity-defining detail. HAIR color and style must also remain completely unchanged.`
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

    let targetPrompts;
    if (gender === 'male') targetPrompts = malePrompts;
    else if (gender === 'female') targetPrompts = femalePrompts;
    else if (gender === 'male_summer') targetPrompts = maleSummerPrompts;
    else if (gender === 'female_summer') targetPrompts = femaleSummerPrompts;
    else if (gender === 'boy') targetPrompts = boyPrompts;
    else targetPrompts = girlPrompts;

    const generateSingle = async (promptInstruction: string, index: number): Promise<string> => {
      const generationSeed = Math.floor(Math.random() * 2147483647);

      const fullPrompt = `This is a SURGICAL CLOTHING EDIT task. NOT an image generation task. NOT a recomposition task.

IMAGE 1 = POSE ANCHOR. This is the immutable reference for pose, framing, composition, face, hair, and background. Every pixel except clothing must be reproduced exactly from this image.
IMAGE 2 = EDIT TARGET. This is the same photo. Apply the clothing change to this image only.

${promptInstruction}

ABSOLUTE RULES — any violation makes the output unusable:
1. CLOTHING ONLY: Modify ONLY the clothing/fabric pixels on the torso and arms. Copy every other pixel from IMAGE 1 without change.
2. FRAMING: The output must be pixel-identical to IMAGE 1 in dimensions, zoom level, crop, and head position. DO NOT zoom out. DO NOT zoom in. DO NOT reframe.
3. ${faceConstraint}
4. BACKGROUND: Every background pixel must be identical to IMAGE 1.
5. BODY: Shoulders, neck, and body pose must match IMAGE 1 exactly.
6. THIS IS AN EDIT, NOT A GENERATION. Do not reimagine or recompose the photo.

Output ONLY the edited image.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: [
          { text: fullPrompt },
          { inlineData: { mimeType: mimeType, data: base64Data } },
          { inlineData: { mimeType: mimeType, data: base64Data } }
        ],
        config: { responseModalities: ['IMAGE'], seed: generationSeed }
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData && part.inlineData.data) {
          return "data:image/png;base64," + part.inlineData.data;
        }
      }
      throw new Error("No image data returned from generator.");
    };

    const results: string[] = [];
    for (let i = 0; i < targetPrompts.length; i++) {
      const result = await generateSingle(targetPrompts[i], i);
      results.push(result);
      // Wait 2 seconds between requests to avoid QPS/burst rate limits on the paid tier
      if (i < targetPrompts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    return results;
  } catch (error) {
    console.error("Gemini 5-Pack Generation Error:", error);
    throw error;
  }
};

/**
 * V4 Feature: 2-Step Pipeline extracting prompt from reference image
 */
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
    const generationSeed = Math.floor(Math.random() * 2147483647);

    const editRegion = referenceType === 'outfit' ? 'CLOTHING' : 'HAIR';
    const lockedRegion = referenceType === 'outfit' ? 'HAIR' : 'CLOTHING';
    const lockedRegionDetail = referenceType === 'outfit'
      ? 'Hairstyle and hair color must remain completely unchanged.'
      : 'All clothing must remain completely unchanged.';

    const v4Prompt = `👉 주제: SURGICAL ${editRegion} EDIT task
The attached photo is the absolute, unchangeable identity template.

👉 세부 묘사 - ${editRegion}
아래 설명대로 ${editRegion.toLowerCase()} 영역만 정밀하게 교체하세요:
"${extractedDescription}"
${lockedRegion} 상태 유지 조건: ${lockedRegionDetail}

👉 구성/구도 및 비율 (절대 고정)
- 원본 사진의 구도, 여백, 상하좌우 비율, 피사체의 상대적 크기를 100% 동일한 픽셀로 유지. 확대나 축소(Crop/Zoom) 절대 금지.
- 얼굴의 화면 내 위치, 어깨의 넓이와 높이를 원본과 완벽하게 똑같이 맞출 것.
- 얼굴 포즈, 시선 방향(Gaze), 고개 각도(Rotation, Tilt)를 전혀 돌리지 말고 원래 사진 상태 그대로 고정.

👉 화질 및 조명 (원본 화질 완전 복사)
- Match the exact lighting, noise level, and image tone of the original input. 
- DSLR이나 스튜디오 조명처럼 화질을 인공적으로 상향(Enhance)하거나, 피부를 매끄럽게(Smoothen) 만들지 말 것.
- 원본 피부 결, 잡티, 고유의 조명 느낌을 어느 것도 미화하지 말고 있는 그대로 똑같이 픽셀 단위로 재현.

👉 편집 지시 (안면 정체성 100% 복사)
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
      config: { responseModalities: ['IMAGE'], seed: generationSeed },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData && part.inlineData.data) {
        return "data:image/png;base64," + part.inlineData.data;
      }
    }

    throw new Error("No image data returned from Gemini V4.");
  } catch (error) {
    console.error("Gemini V4 Edit Error:", error);
    throw error;
  }
};
