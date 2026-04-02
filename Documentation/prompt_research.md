# AI Clothing & Hairstyle Edit Prompt Research
> Collected via Playwright web scraping (Reddit, LinkedIn, Prompt Engineering sites, Official Docs)
> **영어 프롬프트 + 한국어 설명**
> Last updated: 2026-03-24

---

## Table of Contents

1. [핵심 프롬프트 엔지니어링 원칙](#1-핵심-프롬프트-엔지니어링-원칙)
2. [얼굴 보존 패턴 (Face Preservation Patterns)](#2-얼굴-보존-패턴)
3. [남성 비즈니스 정장 프롬프트](#3-남성-비즈니스-정장-프롬프트)
4. [여성 비즈니스 정장 프롬프트](#4-여성-비즈니스-정장-프롬프트)
5. [스마트 캐주얼 / LinkedIn 프롬프트](#5-스마트-캐주얼--linkedin-프롬프트)
6. [헤어스타일 변경 프롬프트 (여성)](#6-헤어스타일-변경-프롬프트-여성)
7. [헤어스타일 변경 프롬프트 (남성)](#7-헤어스타일-변경-프롬프트-남성)
8. [헤어 컬러 변경 프롬프트](#8-헤어-컬러-변경-프롬프트)
9. [증명사진 / 여권사진 전용 프롬프트](#9-증명사진--여권사진-전용-프롬프트)
10. [레퍼런스 이미지 기반 의상 전환 프롬프트](#10-레퍼런스-이미지-기반-의상-전환-프롬프트)
11. [Stable Diffusion / Inpainting 특화 프롬프트](#11-stable-diffusion--inpainting-특화-프롬프트)
12. [Negative Prompt (제외 프롬프트)](#12-negative-prompt-제외-프롬프트)
13. [FLUX Kontext 패턴 (최신 모델)](#13-flux-kontext-패턴-최신-모델)
14. [Gemini 전용 구조화 프롬프트](#14-gemini-전용-구조화-프롬프트)
15. [현재 앱 프롬프트 개선 제안](#15-현재-앱-프롬프트-개선-제안)

---

## 1. 핵심 프롬프트 엔지니어링 원칙

> 출처: DEV Community, Black Forest Labs Official Docs, GPT Image Research

---

### PRINCIPLE-01

```
Affirmative framing always wins over negation.
```

**설명:** "얼굴을 바꾸지 마세요" 대신 "얼굴은 원본 사진과 동일하게 유지" 라고 긍정형으로 써야 한다. 모든 테스트 모델에서 긍정형 지시가 부정형 지시보다 더 잘 지켜진다. 현재 앱의 `PIXEL-PERFECT IDENTICAL` 은 이 원칙을 따르고 있지만, "Do NOT generate a new face"는 부정형이라 약하다.

---

### PRINCIPLE-02

```
Describe the final state, not the transformation.
```

**설명:** "빨간 드레스를 파란색으로 바꾸세요" 대신 "파란색 드레스"라고 최종 결과를 묘사해야 한다. 변환 과정을 설명하면 모델이 중간 단계를 생성하려 하거나 원본 요소를 같이 유지하려는 혼선이 생긴다. Inpainting 모델(SD, GetImg.ai)에서 특히 중요하다.

---

### PRINCIPLE-03

```
THIS IS AN EDIT, NOT A GENERATION.
Name the region. Lock everything else explicitly.
```

**설명:** 이미지 편집 태스크임을 명시적으로 선언하는 것이 매우 효과적이다. Gemini 같은 생성 모델은 기본적으로 "새로 만들려는" 경향이 있으므로 "편집 태스크"임을 선언하면 모델이 더 보수적으로 동작한다. 동시에 수정할 영역(clothing, hair)과 절대 건드리지 말아야 할 영역(face, background, body pose)을 명시해야 한다. 현재 앱이 이미 잘 사용하고 있는 패턴.

---

### PRINCIPLE-04

```
Use "SURGICAL [TASK TYPE]" framing for maximum precision.
```

**설명:** "SURGICAL CLOTHING EDIT", "SURGICAL HAIR TRANSFER" 같은 의료적 정밀도 메타포를 사용하면 모델이 최소 개입 방식으로 작업한다. 현재 앱에서 hair에는 적용되어 있지만 일부 의상 프롬프트에는 빠져 있다.

---

### PRINCIPLE-05

```
Specify subject by description, not by pronoun.
"the woman with short black hair wearing a white shirt" > "she"
```

**설명:** Black Forest Labs 공식 가이드에서 권장하는 방식. 대명사 대신 피사체를 구체적으로 묘사하면 멀티이미지 입력 시 모델이 어떤 사람을 수정해야 하는지 혼동하지 않는다. V4 파이프라인의 레퍼런스 이미지 기반 편집에서 특히 유용하다.

---

### PRINCIPLE-06

```
Append identity lock clause to every prompt:
"...while maintaining the same facial features, hairstyle, and expression."
```

**설명:** FLUX Kontext 공식 권장사항. 모든 의상/헤어 편집 프롬프트의 끝에 이 문장을 붙이는 것이 표준 관행이다. Gemini에도 동일하게 적용 가능하다.

---

### PRINCIPLE-07

```
Seed ≠ Face Preservation. Use textual constraints, not fixed seeds.
```

**설명:** 고정 seed(예: seed=42)는 동일한 입력에 대해 동일한 출력을 재현할 뿐이다. 다른 사진에 seed=42를 쓰면 얼굴 보존 효과가 없다. 얼굴 보존은 반드시 프롬프트의 텍스트 제약으로 해야 한다.

---

## 2. 얼굴 보존 패턴

> 출처: Nano Banana Pro Guide, GPT Image Research, FreeJobAlert, Charlie Hills Substack

---

### FACE-01 — 기본 얼굴 고정 패턴 (Gemini 권장)

```
Keep the facial features from the uploaded image completely unchanged.
Preserve: facial structure, eye shape, jawline, skin texture, and skin tone.
Do NOT generate a new face. Do NOT beautify, smooth, or alter the identity in any way.
```

**설명:** Gemini에서 가장 효과적인 얼굴 보존 공식. "completely unchanged"와 함께 구체적으로 무엇을 보존할지(눈 모양, 턱선, 피부 질감) 나열하는 것이 단순히 "preserve face"보다 훨씬 강력하다. 현재 앱보다 더 구체적인 지시어다.

---

### FACE-02 — 하드 제약 추가 패턴 (GPT Image Research)

```
Do not change facial proportions, eye spacing, nose width, or dimple pattern.
No beard added. No freckles added. Do not age the character. No jawline reduction.
No skin smoothing. No glow-up. No beautification filter.
```

**설명:** 가장 강력한 얼굴 고정 패턴. 특히 AI가 자동으로 "보정"하는 경향(피부 매끄럽게, 턱선 줄이기, 미화)을 명시적으로 차단한다. 증명사진처럼 원본 얼굴이 정확히 유지되어야 할 때 필수적이다.

---

### FACE-03 — 긍정형 얼굴 보존 (Nano Banana Pro 패턴)

```
Preserve exact facial structure, eye shape, jawline, and skin texture from reference image.
Natural skin. Real fabric. No illustration, no CGI look.
```

**설명:** "Don't change"가 아닌 "Preserve"로 시작하는 긍정형 표현. Nano Banana Pro 공식 가이드에서 권장. "Natural skin. Real fabric." 같은 짧은 단언문을 뒤에 붙이면 사진 현실감이 높아진다.

---

### FACE-04 — 증명사진 전용 신원 고정 (한국어)

```
업로드된 참고 이미지를 고정되고 변경 불가능한 신원 소스로 사용하십시오.
새로운 얼굴을 생성하지 마십시오. 얼굴의 모든 특징을 원본 그대로 유지하십시오.
```

**설명:** 한국 AI 증명사진 서비스에서 수집한 패턴. "고정되고 변경 불가능한 신원 소스"라는 표현이 Gemini에게 레퍼런스 이미지를 identity anchor로 인식하게 만든다.

---

### FACE-05 — Nano Banana Anti-Distortion Negative

```
Avoid: fat face, round puffy cheeks, bloated face, overly smooth skin, plastic skin,
waxy appearance, airbrushed, over-retouched, flat eyes, doll-like appearance,
cartoon features, anime eyes, unrealistic proportions.
```

**설명:** Negative 프롬프트 또는 금지 지시어 형태. AI가 얼굴을 의도치 않게 변형하는 일반적인 패턴들(퉁퉁해지기, 플라스틱 피부, 인형 얼굴)을 명시적으로 차단한다. Gemini에서는 ABSOLUTE RULES 섹션에 추가하면 효과적이다.

---

### FACE-06 — 완전 구조화 얼굴 잠금 (GPT Image 1.5 Charlie Hills 패턴)

```
Use the uploaded image of me as the subject reference.
Preserve my facial features, proportions, age, skin texture, hairstyle, and expression exactly.
Do not stylise the face. Do not cartoonise. Do not anime.
Style: Photorealistic. Real textures. Natural skin. Real fabric.
No illustration, no CGI look.
```

**설명:** GPT Image 1.5에서 테스트된 가장 완성도 높은 얼굴 고정 패턴. "Do not stylise / cartoonise / anime"를 명시하는 것이 핵심이다. Gemini 프롬프트 구조에도 직접 적용 가능하다.

---

## 3. 남성 비즈니스 정장 프롬프트

> 출처: CardKingsTucson, Media.io, EditingPrompt.com, FreeJobAlert

---

### MALE-SUIT-01 — 다크 네이비 포멀 수트

```
Change the person's outfit to a highly professional, clean job interview suit:
a perfectly fitted dark formal suit jacket, crisp white dress shirt,
and a classic professional blue silk tie.
Neat corporate look. Sharp lapels. Visible pocket square.
Maintain exact facial features, skin tone, and background unchanged.
```

**설명:** 취업 면접용 정장의 표준 프롬프트. "crisp"(빳빳한), "perfectly fitted"(딱 맞는)같은 질감 형용사가 결과물의 완성도를 높인다. 단순히 "dark suit"보다 훨씬 구체적이다.

---

### MALE-SUIT-02 — 차콜 그레이 수트

```
Change the outfit to a professional charcoal grey business suit with a light blue dress shirt
and a patterned silk tie. Tailored fit, structured shoulders.
Professional corporate look. Keep all facial features and background identical to source.
```

**설명:** 회색 계열 정장 프롬프트. "charcoal grey"(진회색)로 색상을 구체화하고, "patterned silk tie"로 넥타이 디테일을 추가한다. "structured shoulders"는 어깨 패드가 있는 격식체 정장임을 나타낸다.

---

### MALE-SUIT-03 — 임원급 네이비 수트 (고급)

```
Change the outfit to an authoritative, classic executive navy suit:
a premium wide-lapel navy blue suit, crisp white shirt,
and a dignified burgundy striped silk tie.
High-end traditional tailoring, visible button stitching, chest pocket.
Face, hair, and background must remain pixel-identical to the input.
```

**설명:** 임원급 고급 정장 프롬프트. "wide-lapel"(넓은 라펠), "burgundy striped"(버건디 스트라이프)같이 세부 디테일을 지정할수록 AI의 결과물이 일관성을 갖는다. 현재 앱의 male_suit 프리셋보다 5배 이상 구체적이다.

---

### MALE-SUIT-04 — 슬림핏 모던 수트

```
Dress the person in a modern slim-fit navy blue business suit,
open-collar white shirt (no tie), confident posture.
Soft natural lighting, minimal office background.
Realistic shadows, high-detail professional portrait.
Keep face, skin tone, and hair exactly as in the original photo.
```

**설명:** 넥타이 없는 현대적인 수트 스타일. "open-collar"로 넥타이 없음을 명시하고, "slim-fit"으로 핏을 지정한다. 현재 앱에 없는 타이리스(no-tie) 포멀 옵션이다.

---

### MALE-SUIT-05 — 프리미엄 블랙 수트

```
Transform the subject into a professional portrait wearing a perfectly tailored black formal suit
with a crisp white shirt and black tie. Realistic fabric texture with subtle weave.
Natural folds and draping. Studio lighting. Neutral background.
Sharp focus, ultra-realistic photography.
Do not change facial features, hairstyle, skin tone, or background.
```

**설명:** 블랙 수트 프롬프트. "subtle weave"(섬세한 직물 질감), "natural folds and draping"(자연스러운 주름)을 추가하면 AI가 천 소재를 더 사실적으로 렌더링한다.

---

### MALE-SUIT-06 — 핀스트라이프 임원 수트

```
Dress the subject in a premium executive suit with a structured blazer,
subtle pinstripes on charcoal base, professional silk tie,
confident business posture. Clean professional studio lighting.
Preserve all facial features, eye color, skin tone, and hair exactly.
```

**설명:** 핀스트라이프(얇은 줄무늬) 수트 프롬프트. 고급 비즈니스 정장의 디테일 표현에 효과적이다. "confident business posture"는 자세 유지 지시어로도 활용 가능하다.

---

### MALE-SUIT-07 — 화이트 수트 (특별 이벤트용)

```
Dress the subject in an elegant white suit with a black shirt underneath.
Clean modern styling, soft studio lighting, high contrast.
Luxury portrait photography style. Realistic fabric details with light sheen.
Maintain face, features, and background as in original.
```

**설명:** 흰색 수트 프롬프트. "light sheen"(은은한 광택)으로 고급 수트 소재를 표현한다. 일반적인 비즈니스 세팅보다는 특별 행사나 프리미엄 포트폴리오용.

---

### MALE-SUIT-08 — 네이비 폴로 (캐주얼 비즈니스)

```
Change the outfit to a classic navy blue polo shirt with a neat flat collar.
Clean, mature, and professional style. High-quality pique fabric texture.
Short sleeves, no logo. Keep face, hair, and background identical.
```

**설명:** 완전한 정장 대신 격식 있는 폴로 셔츠 옵션. "pique fabric texture"는 폴로셔츠 특유의 그물 직물 질감을 표현한다. 현재 앱에 없는 세미포멀 남성 옵션이다.

---

### MALE-SUIT-09 — 크루넥 니트 스웨터

```
Change the outfit to a classic mid-grey crewneck knit sweater over a white collared shirt.
High quality soft merino wool texture, simple and professional.
Relaxed but neat style. Keep face, hair, and background unchanged.
```

**설명:** 니트 스웨터를 이너 셔츠 위에 레이어드한 스타일. "merino wool"(메리노 울)로 고급 소재를 지정한다. 블레이저 없이도 단정하고 지적인 인상을 줄 수 있는 옵션.

---

### MALE-SUIT-10 — 비즈니스 블레이저 + 크루넥 T

```
Change the outfit to a well-fitted navy blue blazer worn over a clean, crisp white crew-neck t-shirt.
Smart casual professional look. High quality fabric texture.
Realistic studio lighting. Face, hair, and background must not change.
```

**설명:** 블레이저와 티셔츠를 조합한 스마트 캐주얼. LinkedIn 프로필에 적합한 스타일. 현재 앱의 V3 스타일팩 중 하나와 유사하지만 더 구체적인 지시어를 포함한다.

---

## 4. 여성 비즈니스 정장 프롬프트

> 출처: FreeJobAlert, Media.io, EditingPrompt.com, CardKingsTucson

---

### FEMALE-SUIT-01 — 블랙 포멀 자켓 (가장 격식체)

```
Change the outfit to the most strictly formal business suit:
a perfectly fitted black blazer jacket worn open over a clean,
straight-cut white blouse (no collar, straight neckline).
Highly professional corporate look. Tailored shoulders.
Face, hair, skin tone, and background must remain identical.
```

**설명:** 여성 비즈니스 정장 중 가장 격식체. "straight-cut white blouse (no collar)"로 내부 블라우스의 형태까지 지정한다. 현재 앱의 female_suit 프롬프트보다 훨씬 구체적이다.

---

### FEMALE-SUIT-02 — 트위드 자켓 (샤넬 스타일)

```
Change the outfit to a modern, stylish black collarless tweed jacket
worn over a crisp white inner blouse.
Sophisticated luxury Chanel-style aesthetic, perfectly fitted around the shoulders.
Visible subtle tweed texture. Keep face, hair, and background unchanged.
```

**설명:** 명품 브랜드 스타일의 트위드 자켓 프롬프트. "collarless tweed"(칼라 없는 트위드)와 "Chanel-style"로 고급스러운 느낌을 구체화한다. 현재 앱에 없는 고급 여성 의상 옵션이다.

---

### FEMALE-SUIT-03 — 블랙 자켓 + 진주 목걸이

```
Change the outfit to a highly elegant, dignified black formal jacket
adorned with a classic, perfectly round pearl necklace resting on the chest.
Sophisticated and high-class style. Pearl necklace clearly visible.
Face, hair, skin tone, and background must remain pixel-identical.
```

**설명:** 진주 목걸이를 포함한 고급 여성 정장 프롬프트. 액세서리를 프롬프트에 포함시키는 것은 현재 앱에 없는 접근법이다. "clearly visible"로 액세서리가 묻히지 않도록 강조한다.

---

### FEMALE-SUIT-04 — 네이비 블레이저 + 화이트 탑

```
Change the outfit to a tailored navy blue professional blazer
worn over a simple white scoop-neck top.
Modern corporate style. Structured lapels, single-button closure.
Keep face, hair, skin tone, and background identical to source.
```

**설명:** 현재 앱의 female_blazer_navy 프리셋보다 구체적인 버전. "scoop-neck top"으로 안쪽 탑의 넥라인을 지정하고, "single-button closure"로 블레이저 스타일을 명확히 한다.

---

### FEMALE-SUIT-05 — 크림 실크 블라우스

```
Change the outfit to an elegant, high-quality cream silk blouse
with a modest V-neckline and subtle sheen.
Soft draping. Professional yet approachable look.
No logos, no prints. Face, hair, and background unchanged.
```

**설명:** 현재 앱의 female_blouse_cream 프리셋 강화 버전. "modest V-neckline"으로 넥라인을 지정하고, "subtle sheen"(은은한 광택)으로 실크 질감을 표현한다.

---

### FEMALE-SUIT-06 — 오트밀 캐시미어 (부드러운 비즈니스 캐주얼)

```
Change the outfit to a warm, luxurious oatmeal/beige colored cashmere wrap coat
or thick cardigan. Soft, graceful draping, thick premium texture.
Conveying a gentle, sophisticated feeling.
Preserve face, hair, skin tone, and background exactly.
```

**설명:** 부드럽고 따뜻한 느낌의 캐시미어 스타일. 딱딱한 수트보다 친근하고 따뜻한 이미지가 필요할 때 사용. "oatmeal/beige"로 색상을 구체화하고, "wrap coat or thick cardigan"으로 스타일 선택지를 열어둔다.

---

### FEMALE-SUIT-07 — 베이지핑크 브이넥 + 실크 스카프

```
Change the outfit to a sophisticated beige-pink colored V-neck blouse,
beautifully accessorized with a luxurious patterned silk scarf
tied elegantly around the neck. Graceful mature style, high-end fashion.
Face, hair, skin tone, and background must remain unchanged.
```

**설명:** 실크 스카프를 포함한 우아한 여성 비즈니스 스타일. "graceful mature style"은 연령대가 있는 전문직 여성에게 적합한 표현이다. 스카프 디테일이 포함된 프롬프트는 현재 앱에 없는 옵션이다.

---

### FEMALE-SUIT-08 — 다크 레드 파워 수트 (Full-body)

```
A full-body shot of a confident woman standing against a plain black background.
She is wearing a sharp, tailored deep red pantsuit with a double-breasted blazer
and high-waisted wide-leg trousers.
Her outfit is paired with black patent leather pointed-toe pumps.
Don't change the face, make sure the face is the same.
```

**설명:** FreeJobAlert에서 수집한 풀바디 패션 프롬프트. "double-breasted blazer"(더블 브레스트), "high-waisted wide-leg trousers"로 매우 구체적인 스타일링을 지시한다. "Don't change the face, make sure the face is the same"이라는 반복 강조 패턴이 특징이다.

---

### FEMALE-SUIT-09 — 화이트 오피스 수트 (Full-body)

```
A full-body shot of a confident woman posing against a plain white background.
She has short brown hair and is wearing a chic off-white pantsuit,
consisting of a slightly oversized blazer and matching relaxed-fit trousers.
Her outfit is paired with striking silver pointed-toe boots.
The lighting is soft and even. Don't change the face, make sure the face is the same.
```

**설명:** 오프화이트 파워 수트 프롬프트. 코디 전체(재킷, 바지, 부츠)를 일관되게 지정한다. 아이보리/오프화이트 계열 정장은 현재 앱에 없는 색상 옵션이다.

---

### FEMALE-SUIT-10 — 화이트 모노크롬 구조적 수트

```
A full-body shot of a sophisticated woman standing in a well-lit studio with a pristine white background.
She is dressed in a tailored, monochromatic off-white pantsuit,
consisting of a single-breasted blazer, a collared silk blouse, and impeccably pressed trousers.
She wears pointed-toe heels in a matching neutral tone.
Don't change the face, make sure the face is the same.
```

**설명:** 모노크로매틱(단색 조합) 오피스룩 프롬프트. "impeccably pressed"(완벽하게 다려진)처럼 옷의 상태를 묘사하는 표현이 AI에게 깔끔한 결과를 유도한다.

---

## 5. 스마트 캐주얼 / LinkedIn 프롬프트

> 출처: Charlie Hills, Media.io, CyberLink

---

### CASUAL-01 — LinkedIn 헤드샷 (남성)

```
Transform this into a professional LinkedIn headshot.
The person should appear in business attire: a dark blazer or suit jacket with a collared shirt.
Eyes should be open, looking directly at the camera with a natural, confident expression.
Replace the background with a softly blurred office interior.
Light the face evenly with soft front studio lighting.
Keep the person's facial features, bone structure, and likeness exactly as they are.
```

**설명:** LinkedIn 헤드샷 특화 프롬프트. 배경을 "softly blurred office interior"(아웃포커싱된 오피스 인테리어)로 지정하는 것이 현재 앱과의 차별점이다. 단순히 옷만 바꾸는 것이 아니라 전체적인 헤드샷 퀄리티를 높이는 방향이다.

---

### CASUAL-02 — 블레이저 + 화이트 티 (남성 스마트 캐주얼)

```
Change the outfit to a smart casual professional look:
a well-fitted medium grey blazer over a clean white crew-neck t-shirt.
No tie. Relaxed yet polished appearance.
Suitable for LinkedIn profile or startup company headshot.
Preserve face, hair, and background exactly as original.
```

**설명:** 현재 앱의 casual_smart_m 프롬프트를 구체화한 버전. "No tie. Relaxed yet polished"로 격식과 캐주얼 사이의 균형을 표현한다. "startup company headshot"을 용도로 명시하면 AI가 더 현대적인 스타일을 선택한다.

---

### CASUAL-03 — 테크 파운더 룩

```
Maintain face identical to reference photo.
Replace outfit with smart-casual look:
premium charcoal blazer over white tech company t-shirt,
slim-fit dark jeans, and minimalist white sneakers.
Modern, confident, approachable professional style.
Face, skin tone, hair, and background unchanged.
```

**설명:** 테크 기업 창업자 스타일 프롬프트. Media.io에서 수집. "white tech company t-shirt"와 "minimalist white sneakers" 조합이 실리콘밸리 스타일을 표현한다.

---

### CASUAL-04 — 흑색 터틀넥 (지적 전문가)

```
Keep the facial features from the uploaded image completely unchanged.
Change outfit to black turtleneck sweater paired with dark casual pants and white sneakers.
Clean, intellectual, modern professional style.
Face, hair, skin tone, and background identical to source.
```

**설명:** 블랙 터틀넥 스타일. 스티브 잡스 스타일로 알려진 지적이고 심플한 이미지. 현재 앱에 없는 남성 캐주얼 옵션이며 미니멀리스트 프로필에 적합하다.

---

### CASUAL-05 — 여성 스마트 캐주얼

```
Change the outfit to a smart casual professional look for a woman:
a fitted light blue button-down collared shirt, neatly tucked.
Clean, modern, approachable.
Suitable for LinkedIn profile or professional headshot.
Face, hair, skin tone, and background must remain unchanged.
```

**설명:** 현재 앱의 casual_smart_f 프롬프트를 구체화한 버전. "light blue button-down"으로 색상과 스타일을 지정해 예측 가능성을 높인다.

---

## 6. 헤어스타일 변경 프롬프트 (여성)

> 출처: Stable Diffusion Art, OpenArt, Reddit r/StableDiffusion

---

### HAIR-F-01 — 슬릭 로우번 (전문직 업스타일)

```
Change the hairstyle ONLY to a sleek, professional low bun with a neat center or side part.
Hair pulled back tightly, no flyaways.
Polished and elegant styling suitable for formal interviews or ID photos.
DO NOT change face, skin tone, clothing, or background.
Hair color must remain the same as original.
```

**설명:** 현재 앱의 sleek_updo 프롬프트 강화 버전. "no flyaways"(잔머리 없음), "hair color must remain the same"을 추가한 것이 핵심 개선점이다. 헤어 변경 시 현재 앱이 놓치고 있는 "기존 헤어 색상 유지" 지시어가 포함되어 있다.

---

### HAIR-F-02 — 미디엄 C컬 레이어드

```
Change the hairstyle ONLY to medium-length hair with face-framing layers,
ends curled inward in a smooth C-shape.
Voluminous, smooth texture. Feminine and elegant look.
Original hair color must remain unchanged.
DO NOT modify face, clothing, or background.
```

**설명:** 현재 앱의 medium_c_curl 프롬프트 강화 버전. "face-framing layers"(얼굴을 감싸는 레이어)와 "smooth C-shape"으로 컬의 방향을 명확히 한다.

---

### HAIR-F-03 — 롱 스트레이트 (자연스러운 직모)

```
Change the hairstyle ONLY to long, straight, smooth hair draped naturally over the shoulders.
High-shine, healthy-looking strands. Professional salon blowout finish.
Maintain original hair color. DO NOT change face, skin, clothing, or background.
```

**설명:** 현재 앱의 long_straight 프롬프트 강화 버전. "high-shine, healthy-looking"으로 머릿결 퀄리티를 지정하고, "salon blowout finish"로 살롱에서 한 것 같은 결과를 유도한다.

---

### HAIR-F-04 — 소프트 웨이브 (볼륨 웨이브)

```
Change the hairstyle ONLY to long, soft, voluminous wavy hair.
Loose beach waves with natural movement. Elegantly styled.
Keep original hair color. DO NOT alter face, clothing, or background.
```

**설명:** 현재 앱의 wavy_long 프롬프트 강화 버전. "loose beach waves"와 "natural movement"로 웨이브의 성질을 구체화한다.

---

### HAIR-F-05 — 컬리 밥 (어깨 길이)

```
Change the hairstyle ONLY to a chic, shoulder-length curly bob.
Defined bouncy curls, professionally styled. Modern and confident look.
Original hair color unchanged. DO NOT modify face, clothing, or background.
```

**설명:** 현재 앱의 curly_bob 프롬프트 강화 버전. "bouncy curls"(통통 튀는 컬)로 컬의 탄력감을 표현한다.

---

### HAIR-F-06 — 타이트 번 (승무원/코퍼릿 스타일)

```
Change the hairstyle ONLY to a tight, perfectly groomed professional bun pulled back.
All hair swept away from face. Suitable for flight attendant or corporate ID photo.
No loose strands. Original hair color preserved.
DO NOT change face, clothing, or background.
```

**설명:** 현재 앱의 bun 프롬프트 강화 버전. "no loose strands"(흘러내리는 머리카락 없음)와 "all hair swept away from face"로 깔끔한 번 스타일을 강조한다.

---

### HAIR-F-07 — 미디엄 소프트 샤그 / 울프컷

```
Change the hairstyle ONLY to a medium-length soft shag cut (wolf cut style)
with high-layered curtain bangs and wispy feathered ends.
Textured, airy, modern. Trendy yet professional.
Hair color same as original. DO NOT touch face, clothing, or background.
```

**설명:** 현재 앱의 medium_soft_shag 프롬프트 강화 버전. "curtain bangs"(커튼 뱅)과 "feathered ends"(페더드 끝머리)로 울프컷 특유의 디테일을 표현한다.

---

### HAIR-F-08 — 다크 헤어 컬러 (색상만 변경)

```
Keep the hairstyle EXACTLY the same length, texture, and style as in the original.
Change ONLY the hair color to a deep, rich natural black or dark espresso brown.
No highlights, no shine effects. Natural matte finish.
DO NOT change face, clothing, background, or hairstyle shape.
```

**설명:** 현재 앱의 color_dark 프롬프트 강화 버전. "Keep the hairstyle EXACTLY the same"을 앞에 배치해 스타일은 유지하고 색상만 바꾸겠다는 의도를 명확히 한다. "No highlights, no shine effects"로 과도한 효과를 차단한다.

---

### HAIR-F-09 — 밝은 브라운 하이라이트

```
Change the hair color ONLY to a warm chestnut brown with subtle caramel highlights.
Keep the exact same hairstyle and length.
No change to hairstyle shape, face, clothing, or background.
```

**설명:** 현재 앱에 없는 밝은 갈색 계열 헤어 컬러 옵션. 어두운 헤어를 밝게 바꾸는 것보다 어렵기 때문에 "subtle"을 사용해 급격한 변화를 방지한다.

---

### HAIR-F-10 — 볼류미너스 숏컷

```
Change the hairstyle ONLY to a volumized, professionally styled short bob
cut at jaw length. Smooth, polished finish. No flyaways.
Original hair color preserved. DO NOT change face, clothing, or background.
```

**설명:** 현재 앱에 없는 짧은 단발 스타일. "jaw length"로 길이를 명확히 지정하고, "volumized"로 납작하게 붙지 않도록 지시한다.

---

## 7. 헤어스타일 변경 프롬프트 (남성)

> 출처: Stable Diffusion Art, OpenArt, Reddit

---

### HAIR-M-01 — 깔끔한 숏컷

```
Change the hairstyle ONLY to a neat, professional short haircut.
Sides and back are tapered clean. Top is slightly longer and neatly combed.
No facial hair added or removed. Original hair color preserved.
DO NOT modify face, clothing, or background.
```

**설명:** 현재 앱의 neat_short 프롬프트 강화 버전. "tapered clean"(테이퍼드 클린)으로 옆머리 정리를 구체화하고, "no facial hair added or removed"로 수염 변화를 차단한다.

---

### HAIR-M-02 — 클래식 사이드파트

```
Change the hairstyle ONLY to a classic gentleman's side part,
neatly combed over with a natural-looking part on the left side.
Smooth, professional finish with visible comb marks.
Original hair color preserved. DO NOT alter face, clothing, or background.
```

**설명:** 현재 앱의 side_part 프롬프트 강화 버전. "left side"로 가르마 방향을 지정하고, "visible comb marks"로 정돈된 느낌을 강조한다.

---

### HAIR-M-03 — 텍스쳐 크루컷 (현대적)

```
Change the hairstyle ONLY to a modern textured crew cut.
Short on sides (fade), slightly longer on top with natural texture.
Clean masculine look. No facial hair change. Original hair color unchanged.
DO NOT modify face, clothing, or background.
```

**설명:** 현재 앱에 없는 현대적인 크루컷 스타일. "fade"(페이드)로 사이드 그라데이션을 표현한다.

---

### HAIR-M-04 — 언더컷 (현대 비즈니스)

```
Change the hairstyle ONLY to a clean undercut:
short close-shaved sides, longer structured top styled back or to the side.
Business-appropriate, modern and confident.
Hair color same as original. DO NOT change face, clothing, or background.
```

**설명:** 현재 앱에 없는 언더컷 스타일. "close-shaved sides"와 "structured top"으로 명확한 스타일링을 지시한다.

---

## 8. 헤어 컬러 변경 프롬프트

> 출처: OpenArt — 25 Stable Diffusion Hair Color Prompts

---

### COLOR-01 — 플래티넘 블론드

```
Change the hair color ONLY to platinum blonde.
Natural-looking, no brassy tones. Keep exact same hairstyle.
DO NOT change face, skin tone, clothing, or background.
```

**설명:** 금발 중 가장 밝은 플래티넘 블론드. "no brassy tones"(황동빛 없이)로 부자연스러운 노란 색조를 방지한다.

---

### COLOR-02 — 실버 그레이

```
Change the hair color ONLY to natural silver-grey.
Elegant and distinguished look. Keep exact same hairstyle.
Maintain face, skin tone, clothing, and background unchanged.
```

**설명:** 은회색 헤어 컬러. 중년 이상의 전문직 이미지에 적합하다. "distinguished"(품격 있는)라는 형용사가 AI의 스타일링 방향에 영향을 준다.

---

### COLOR-03 — 다크 에스프레소 브라운

```
Change hair color ONLY to a deep, rich espresso brown.
Natural matte finish. No highlights. Keep same hairstyle exactly.
Face, skin, clothing, and background unchanged.
```

**설명:** 짙은 커피색 헤어 컬러. "matte finish"로 과도한 광택을 억제한다.

---

### COLOR-04 — 따뜻한 체스트넛 브라운

```
Change hair color ONLY to warm chestnut brown with soft natural undertones.
Realistic salon result. Keep same hairstyle. Face and background unchanged.
```

**설명:** 따뜻한 밤색 계열 헤어. "natural undertones"(자연스러운 하부 색조)로 염색한 것 같은 부자연스러움을 방지한다.

---

## 9. 증명사진 / 여권사진 전용 프롬프트

> 출처: Tenorshare, Media.io Gemini Passport Prompts, GrandLife.co.kr

---

### ID-PHOTO-01 — 표준 증명사진

```
Professional ID photo. Person facing camera directly, neutral expression, no smile.
Plain white or light grey background. Professional business attire.
White collared shirt. Even studio lighting, no harsh shadows.
High resolution, sharp focus. Head and shoulders visible.
Keep exact face — do not retouch, beautify, or alter facial features.
```

**설명:** 가장 기본적인 증명사진 프롬프트. "no harsh shadows"와 "even studio lighting"으로 균일한 조명을 지시한다. 현재 앱이 이런 완성된 ID 포토 프롬프트를 제공하지 않는 것이 아쉬운 점이다.

---

### ID-PHOTO-02 — 취업 면접 증명사진 (남성)

```
Professional job application ID photo for Korean corporate interview.
Male subject wearing a formal black suit, crisp white dress shirt, dark navy tie.
Plain white background. Neutral expression, direct gaze.
Head and upper chest visible. Even lighting.
Do not change face, facial features, or skin tone in any way.
```

**설명:** 한국 기업 취업용 증명사진 특화 프롬프트. "Korean corporate interview"로 한국 스타일을 명시하면 AI가 해당 국가 문화에 맞는 포멀 스타일을 선택한다.

---

### ID-PHOTO-03 — 취업 면접 증명사진 (여성)

```
Professional job application ID photo for Korean corporate interview.
Female subject wearing a formal black blazer over a clean white blouse.
Plain white background. Neutral to slight natural expression.
Head and upper chest visible. Even soft studio lighting.
Do not change face, skin tone, or hairstyle.
```

**설명:** 여성 취업 증명사진 특화 프롬프트. 남성과 동일한 구조이나 의상 묘사가 다르다.

---

### ID-PHOTO-04 — LinkedIn 헤드샷 자동 변환

```
Professional LinkedIn headshot from this photo.
Keep my exact face — no retouching, no beautifying.
Very slight natural smile acceptable.
Plain light grey or white background (softly blurred).
Dark formal blazer or suit jacket. Studio lighting with soft fill.
```

**설명:** LinkedIn 프로필 사진 특화 프롬프트. "Very slight natural smile acceptable"로 완전히 무표정이 아닌 자연스러운 표정을 허용하는 점이 특징이다.

---

### ID-PHOTO-05 — 여권 사진 규격

```
US/International passport compliant photo from this image.
Exact same face — no changes to facial features.
Neutral expression, no smile. Full front view, direct gaze.
Plain white background. Even lighting, no shadows on face or background.
Head should fill 70-80% of frame. High resolution 600 DPI.
```

**설명:** 여권 규격에 맞는 증명사진 프롬프트. "head should fill 70-80% of frame"으로 얼굴 비율까지 지정한다.

---

### ID-PHOTO-06 — 6-컷 인쇄용 시트

```
Create a printable sheet with 6 identical 2x2 inch professional ID photos.
Keep exact face and neutral expression.
Plain white background. Studio lighting.
Arrange in 2 rows of 3. High resolution 600 DPI.
Same outfit in all 6 photos.
```

**설명:** 6장 인쇄 시트 생성 프롬프트. 한 번에 여러 장을 출력해야 하는 실용적인 케이스. 현재 앱에 추가할 수 있는 유용한 기능 아이디어이기도 하다.

---

## 10. 레퍼런스 이미지 기반 의상 전환 프롬프트

> 출처: DreamFaceApp GPT-4o Test, Nano Banana Pro Guide

---

### REF-01 — 두 번째 이미지 의상 적용 (간결 버전)

```
Change the entire outfit in the first photo to match the outfit in the second photo.
Don't change anything else. Keep face, hair, background, and pose identical.
```

**설명:** 가장 간결한 레퍼런스 기반 의상 전환 프롬프트. DreamFaceApp 테스트에서 수집. "Don't change anything else"라는 포괄적인 제약이 단순하지만 효과적이다. 현재 앱의 V2 파이프라인 프롬프트보다 더 간결하다.

---

### REF-02 — 포즈/배경 보존 + 의상 전환

```
Keep the background, pose, and hairstyle of the image.
Change the outfit to match the style in the reference image, aligning with body lines and skin tones.
Face must remain identical.
```

**설명:** 포즈와 배경을 명시적으로 보존하면서 의상만 전환하는 패턴. "aligning with body lines and skin tones"가 핵심 — 레퍼런스 의상이 원본 체형에 자연스럽게 맞도록 지시한다.

---

### REF-03 — 하의만 교체

```
Keep the character unchanged, but replace only the pants/skirt
with the outfit shown in the reference image.
Keep the top, face, hair, and background identical.
```

**설명:** Nano Banana Pro에서 수집한 부분 의상 교체 프롬프트. 상하의를 분리해서 교체할 수 있는 구조. 현재 앱은 전체 의상을 바꾸는 것이 기본이지만, 상의/하의 분리 편집 기능으로 확장할 수 있는 아이디어다.

---

### REF-04 — 패션 분석가 방식 (2단계 레퍼런스 추출)

```
STEP 1 — ANALYZE:
You are an expert fashion analyst. Analyze the clothing in the REFERENCE image.
Describe in extreme detail: garment type, color (use Pantone or hex if possible),
fit (slim/regular/oversized), collar style, pattern, fabric texture,
buttons/pockets/zippers, and any unique design features.
Do NOT describe the person's face, body, or background.

STEP 2 — APPLY:
Now apply this exact clothing description to the person in the ORIGINAL image.
The original person's face, hair, skin tone, body proportions, and background must remain unchanged.
Only the clothing region should change.
```

**설명:** 현재 앱의 V4 extractReferencePrompt 함수와 유사한 2단계 방식이지만, 색상 분석을 Pantone/hex까지 요청하는 더 정밀한 버전이다. 단계를 명확히 "STEP 1 / STEP 2"로 구분하면 모델이 순서대로 처리한다.

---

### REF-05 — 헤어 스타일리스트 방식 (헤어 레퍼런스 추출)

```
STEP 1 — ANALYZE:
You are a professional hair stylist. Analyze the hairstyle in the REFERENCE image.
Describe in detail: hair length (in inches/cm), color (exact shade), texture (straight/wavy/curly),
parting direction, volume level, specific styling techniques visible,
and any notable features (layers, bangs, highlights).
Do NOT describe face or clothing.

STEP 2 — APPLY:
Apply this exact hairstyle description to the person in the ORIGINAL image.
Face, skin tone, clothing, and background must remain pixel-identical.
Only the hair region should be modified.
```

**설명:** 현재 앱의 V4 헤어 레퍼런스 추출 프롬프트보다 더 구체적인 버전. "color (exact shade)"와 "length in inches/cm"로 정밀도를 높인다.

---

## 11. Stable Diffusion / Inpainting 특화 프롬프트

> 출처: NextDiffusion, Civitai, GetImg.ai, HuggingFace Docs

---

### INPAINT-01 — GetImg.ai 기본 원칙 (최종 상태 묘사)

```
[CORRECT] → "elegant black evening gown"
[WRONG]   → "change the red dress to black evening gown"
```

**설명:** GetImg.ai 공식 가이드에서 수집. Inpainting 프롬프트는 변환 과정이 아닌 최종 결과 상태만 묘사해야 한다. "change X to Y" 패턴을 쓰면 AI가 두 가지를 합치려 해서 결과가 나빠진다.

---

### INPAINT-02 — ControlNet 기본 유니버설 구조

```
[Positive]
(subject description), professional attire, (specific clothing item),
high quality fabric, natural folds, studio lighting, sharp focus, photorealistic

[Negative]
(worst quality:1.2), (low quality:1.2), (lowres:1.1), blurry, deformed,
bad anatomy, disfigured, watermark, multiple views, mutation hands,
extra fingers, missing fingers, shadow, sunlight
```

**설명:** ControlNet 방식의 기본 구조. 가중치 표기법 `(term:1.2)`로 중요도를 조절한다. 현재 앱의 Gemini 프롬프트와 다른 패러다임이지만, 네거티브 프롬프트 개념은 Gemini의 "ABSOLUTE RULES" 금지 조항에 적용 가능하다.

---

### INPAINT-03 — 의상 마스킹 원칙

```
Mask ONLY the clothing area. Leave face, hair, hands, and background unmasked.
Prompt: [describe only the target garment — color, style, fabric]
Denoising strength: 0.7-0.85 for best results
```

**설명:** SD Inpainting의 핵심 원칙. 마스크를 의상 영역에만 적용하고 얼굴/머리/배경은 마스크에서 제외해야 한다. 현재 앱의 V4 마스크 파이프라인이 제대로 구현되면 이 원칙을 따라야 한다.

---

### INPAINT-04 — 헤어 컬러만 변경 (마스킹 방식)

```
[Mask: hair region only]
[Prompt]: "platinum blonde hair, natural skin, professional"
[Negative]: "bad hair, hair extensions, hair pieces, wig"
```

**설명:** 헤어 컬러만 마스킹해서 변경하는 SD 방식. 짧은 설명만으로도 충분하다. "natural skin"을 포함해 헤어 마스크가 피부 경계에서 자연스럽게 블렌딩되도록 유도한다.

---

### INPAINT-05 — IP-Adapter 의상 교체 방식

```
[Reference Image]: target outfit image
[Mask]: clothing area of the subject
[Prompt]: "blue dress with floral print" (minimal description)
[IP-Adapter Weight]: 0.6-0.8 for balance between reference and text
```

**설명:** IP-Adapter를 사용하면 의상 이미지를 직접 레퍼런스로 주입할 수 있어 텍스트 묘사 없이도 정확한 의상 복제가 가능하다. 텍스트 프롬프트는 최소화해도 된다.

---

## 12. Negative Prompt (제외 프롬프트)

> 출처: Civitai, Stable Diffusion Art, Nano Banana Pro

---

### NEG-01 — 얼굴 품질 저하 방지 (범용)

```
fat face, round puffy cheeks, bloated face, overly smooth skin, plastic skin,
waxy appearance, airbrushed, over-retouched, flat eyes, doll-like,
cartoon features, anime eyes, unrealistic proportions, beauty filter,
heavy makeup, fake smile, unnatural expression
```

**설명:** 범용 얼굴 품질 저하 방지 네거티브 프롬프트. AI가 자동으로 추가하는 미화 효과들(플라스틱 피부, 인형 같은 눈, 과도한 보정)을 차단한다.

---

### NEG-02 — 의상 품질 저하 방지

```
wrinkled dirty clothing, stained fabric, torn clothes, cartoon clothing,
painted on outfit, flat 2D texture, incorrect anatomy under clothes,
floating clothing, disconnected collar, weird proportions, blurry fabric
```

**설명:** 의상 생성 품질 저하 방지 네거티브 프롬프트. "painted on outfit"(그려 붙인 것 같은 의상), "floating clothing"(옷이 몸에서 떠있는 현상)을 차단한다.

---

### NEG-03 — SD 범용 고퀄리티 네거티브

```
(worst quality:1.2), (low quality:1.2), (lowres:1.1), (monochrome:1.1),
(greyscale), multiple views, comic, sketch, (((bad anatomy))), (((deformed))),
(((disfigured))), watermark, (blurry), (((strabismus))), (wrong finger),
mutation hands, mutation fingers, extra fingers, missing fingers
```

**설명:** Stable Diffusion 커뮤니티에서 가장 널리 사용되는 범용 네거티브 프롬프트. 가중치 표기법으로 중요한 항목을 강조한다.

---

### NEG-04 — 배경 변경 방지

```
different background, background change, new environment, scene change,
outdoor scene, indoor scene change, background elements added or removed
```

**설명:** 배경이 바뀌는 현상을 방지하는 네거티브 프롬프트. 의상/헤어 편집 시 배경이 함께 변하는 경우에 유용하다. 현재 앱의 "BACKGROUND: Background pixels must be completely unchanged" 지시어를 보강할 수 있다.

---

## 13. FLUX Kontext 패턴 (최신 모델)

> 출처: Black Forest Labs Official Guide, MimicPC, FluxAI Pro, Kontext-Dev

---

### FLUX-01 — 기본 의상 변경 + 신원 잠금

```
Change the clothes to [target outfit] while preserving exact facial features,
eye color, and facial expression. Keep the same pose and background.
```

**설명:** FLUX Kontext 공식 가이드의 권장 기본 패턴. "while preserving"이 핵심 연결어다. 단순하지만 Gemini에도 그대로 적용 가능하다.

---

### FLUX-02 — 셔츠만 변경 (정밀 제약)

```
Change only the shirt to a deep navy cotton Oxford with a subtle texture;
slim fit; preserve buttons and folds;
keep face, skin tone, and background unchanged.
```

**설명:** FLUX Kontext에서 수집한 부분 의상 교체 프롬프트. "preserve buttons and folds"처럼 의상의 세부 요소를 명시하면 자연스러운 결과를 얻는다.

---

### FLUX-03 — 배경 교체 + 인물 고정

```
Change the background to [target background] while keeping the person
in the exact same position, scale, and pose.
Maintain identical subject placement, camera angle, framing, and perspective.
Only replace the environment around them.
```

**설명:** 배경만 교체하고 인물을 완전히 유지하는 패턴. 현재 앱에는 없지만 배경 변경 기능 추가 시 활용 가능한 패턴이다.

---

### FLUX-04 — 피사체 명시 패턴

```
The woman with [specific hair description] wearing [current outfit]
— change her outfit to [target outfit] while maintaining her exact facial features,
hairstyle, and expression.
```

**설명:** BFL 공식 권장 패턴. 대명사 대신 피사체를 구체적으로 묘사해서 멀티이미지 입력 시 혼동을 방지한다.

---

## 14. Gemini 전용 구조화 프롬프트

> 출처: Media.io, EditingPrompt.com, Tenorshare, GrandLife.co.kr, 자체 조합

---

### GEMINI-01 — 단일 이미지 의상 편집 최적 구조

```
This is a SURGICAL CLOTHING EDIT task. NOT an image generation task.

The attached photo is a fixed template. The person in this photo is the immutable identity source.

TASK: [specific outfit description]

ABSOLUTE RULES — violation makes output unusable:
1. CLOTHING ONLY: Modify ONLY the clothing/fabric pixels on the torso and arms.
   Nothing else may change — not a single pixel outside clothing region.
2. FRAMING: Output dimensions, zoom level, crop, and head position MUST be
   pixel-identical to the input. DO NOT reframe in any way.
3. FACE: Preserve exact facial structure, eye shape, jawline, skin tone, and skin texture.
   Do NOT beautify, smooth, retouch, or generate a new face.
   Do NOT add or remove beard, freckles, or any facial features.
4. HAIR: Hairstyle and hair color must remain completely unchanged.
5. BACKGROUND: Every background pixel must remain identical.
6. BODY: Shoulder position, neck, and body pose unchanged.
7. THIS IS AN EDIT. Do not reimagine. Do not recompose.

Output ONLY the edited image.
```

**설명:** 현재 앱의 V1 프롬프트에서 가장 중요하게 빠진 것들을 추가한 강화 버전. 특히 **"HAIR: Hairstyle and hair color must remain completely unchanged"** 와 **"Do NOT add or remove beard, freckles, or any facial features"** 가 핵심 추가사항이다.

---

### GEMINI-02 — 레퍼런스 기반 의상 적용 최적 구조

```
This is a SURGICAL REFERENCE-BASED CLOTHING TRANSFER task.

IMAGE 1 = Original person (immutable identity + background + pose)
IMAGE 2 = Reference outfit only (use ONLY the clothing style, not the person)

TASK: Apply the clothing style from IMAGE 2 to the person in IMAGE 1.

ABSOLUTE RULES:
1. CLOTHING TRANSFER ONLY: Extract the outfit style, color, fabric, and fit from IMAGE 2.
   Apply ONLY these garment properties to IMAGE 1.
2. FRAMING: Dimensions, zoom, crop, and head position identical to IMAGE 1.
3. FACE: Facial features, skin tone, and skin texture from IMAGE 1 preserved exactly.
   No retouching, no beautifying, no identity change.
4. HAIR: Hair from IMAGE 1 unchanged — color, style, and length.
5. BACKGROUND: Background from IMAGE 1 unchanged.
6. BODY: Adapt the garment to fit IMAGE 1 person's body proportions naturally.
7. DO NOT copy the IMAGE 2 person's face, hair, or body.

Output ONLY the edited image.
```

**설명:** 현재 앱의 V2 레퍼런스 의상 프롬프트를 완전히 재설계한 버전. **"IMAGE 2 person의 얼굴/헤어/체형을 복사하지 말 것"** 을 명시하는 것이 핵심이다. 현재 앱은 이 지시가 없어 가끔 레퍼런스 이미지의 사람처럼 바뀔 위험이 있다.

---

### GEMINI-03 — 헤어스타일 전용 최적 구조

```
This is a SURGICAL HAIR EDIT task. NOT an image generation task.

The attached photo is a fixed template.

TASK: [specific hairstyle description]

ABSOLUTE RULES:
1. HAIR REGION ONLY: Modify ONLY the hair pixels. Face boundary (hairline, temples, ears)
   must blend naturally — do not create sharp unnatural edges.
2. FRAMING: Output dimensions, zoom, crop identical to input.
3. FACE: Every facial pixel must be identical — skin tone, texture, eye shape, jawline.
   No retouching. No beautification.
4. CLOTHING: Clothing unchanged. If hairstyle drapes on shoulders, blend naturally.
5. BACKGROUND: Unchanged.
6. HAIR COLOR: [Specify: keep original color / change to X color]
7. THIS IS AN EDIT. Do not reimagine.

Output ONLY the edited image.
```

**설명:** 헤어 전용 프롬프트 강화 버전. **"hairline blend"** 지시가 핵심 추가사항이다. 현재 앱은 헤어라인에서 어색한 경계가 생기는 경우가 있는데, 이 지시어가 이를 방지한다. 헤어 컬러 유지/변경을 Rule 6에서 명시적으로 선택하도록 구조화했다.

---

### GEMINI-04 — 5-팩 스타일팩 개별 프롬프트 최적 구조

```
This is a SURGICAL CLOTHING EDIT task.

The attached photo is a fixed template.
TASK: [Variation X specific outfit]

RULES:
1. CLOTHING ONLY: Edit only clothing pixels. Nothing else changes.
2. FRAMING: Pixel-identical to input — no reframe, no zoom, no crop change.
3. FACE: Preserve exact face — no beautification, no retouching, no identity change.
   Hair color and style unchanged.
4. BACKGROUND: Unchanged.
5. BODY POSE: Unchanged.

Output ONLY the edited image.
```

**설명:** 현재 앱의 V3 스타일팩에서 사용 중인 프롬프트를 최적화한 버전. 더 간결하지만 핵심 제약 "hair color and style unchanged"를 FACE 룰 안에 포함시킨 것이 핵심 개선이다.

---

## 15. 현재 앱 프롬프트 개선 제안

> 지금 바로 `presets.json`과 `geminiService.ts`에 적용 가능한 구체적 개선안

---

### 개선 01 — presets.json casual_smart_m / casual_smart_f 프롬프트 교체

**현재 (너무 모호):**
```
"Change the clothing to a smart casual professional look, such as a collared shirt or nice blouse, suitable for LinkedIn."
```

**개선안 (남성):**
```
"Change the outfit to a smart casual professional look: a well-fitted medium grey blazer
over a clean white crew-neck t-shirt. No tie. Modern, polished appearance
suitable for LinkedIn or startup headshot.
Keep face, hair, and background exactly as original."
```

**개선안 (여성):**
```
"Change the outfit to a smart casual professional look: a fitted light blue
button-down collared shirt, neatly tucked. Clean, modern, approachable.
Suitable for LinkedIn profile. Keep face, hair, and background unchanged."
```

**설명:** 현재 "such as a collared shirt or nice blouse"처럼 AI에게 선택권을 주면 매번 다른 결과가 나온다. 구체적인 색상과 아이템을 지정해야 일관성이 생긴다.

---

### 개선 02 — V1 메인 프롬프트에 헤어 보존 규칙 추가

**현재 (없음):**
```
3. FACE: [얼굴 보존만 있음]
```

**추가할 내용:**
```
4. HAIR: Hairstyle and hair color must remain completely unchanged from the original.
   Do not modify, extend, or recolor hair in any way.
```

**설명:** 의상을 바꿀 때 AI가 무의식적으로 헤어도 살짝 바꾸는 현상을 방지한다.

---

### 개선 03 — 얼굴 보존 문구 강화

**현재:**
```
"PIXEL-PERFECT IDENTICAL to the original"
```

**개선안:**
```
"Preserve exact facial structure, eye shape, jawline, and skin tone from the original.
Do NOT beautify, smooth, retouch, or alter. Do NOT generate a new face.
No added beard, no skin smoothing, no glow-up effect."
```

**설명:** "PIXEL-PERFECT"는 물리적으로 불가능한 요구다. 더 현실적이고 구체적인 묘사로 바꾸는 게 효과적이다.

---

### 개선 04 — 모든 파이프라인 언어 영어로 통일

**현재:** V2 의상은 한국어, V2 헤어는 영어, V4는 한국어+영어 혼재

**개선안:** 모든 프롬프트를 영어로 통일

**설명:** Gemini를 포함한 대부분의 LLM은 영어 프롬프트에서 instruction-following 성능이 가장 높다. 일관성도 중요하다.

---

### 개선 05 — presets.json 의상 프롬프트 전반적 강화

모든 프롬프트 끝에 다음 문장 추가:
```
"Keep face, hair, skin tone, and background exactly as in the original photo."
```

**설명:** 한 줄만 추가해도 얼굴·헤어·피부·배경 보존을 명시할 수 있다. JSON만 수정하면 되는 즉각적인 개선이다.

---

*Sources: Black Forest Labs Official FLUX Kontext Prompting Guide | Media.io Gemini Outfit/Passport Guides | EditingPrompt.com | FreeJobAlert Fashion Prompts | CardKingsTucson Suit Prompts | NextDiffusion ControlNet Tutorial | Civitai MultiControlNet | GetImg.ai Inpainting Guide | Charlie Hills Substack GPT Image 1.5 | DEV Community Affirmative Prompting | DreamFaceApp GPT-4o Test | Apiyi.com Nano Banana Pro Guide | Fotor Nano Banana Prompts | GrandLife.co.kr Korean ID Photo | Velog Korean AI ID Photo | Tenorshare Gemini ID Prompts | OpenArt Hair Color Prompts | HuggingFace Inpainting Docs | RunThePrompts Midjourney CREF Guide*
