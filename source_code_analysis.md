# 기존 소스 코드 분석 보고서

**작성일:** 2026-03-19  
**대상 위치:** `c:/Users/user/Desktop/make_clothes/`

사용자님께서 제공해주신 폴더 내의 소스 코드를 분석한 결과입니다. 현재 애플리케이션의 아키텍처와 기술 스택, 그리고 주요 한계점(사용자님이 지적하신 샘플 부재 등)이 어떻게 구현되어 있는지 확인했습니다.

## 1. 기술 스택 및 아키텍처 (Tech Stack)
* **프론트엔드 프레임워크:** React 19 + Vite (`package.json`, `vite.config.ts`)
* **스타일링:** Tailwind CSS (`className` 유틸리티 사용) 및 Lucide React (아이콘)
* **언어:** TypeScript (`App.tsx`, `types.ts`)
* **AI 연동:** `@google/genai` 패키지를 사용하며, `services/geminiService.ts`와 내부 Express 백엔드(`server/server.js`)를 통해 Google Gemini 2.5 Flash 모델 기반 편집(Edit) 기능을 호출하는 구조입니다.

## 2. 주요 구현 로직 분석 (`App.tsx`)

### 2.1. 상태 관리 (State Management)
* `originalImage` 및 `currentImage`: 업로드된 원본 이미지와 현재 AI를 통해 적용된 결과물 이미지를 Base64/URL로 관리합니다.
* `history`: 생성된 이미지 이력 배열로, 이전 결과물들을 빠르게 클릭해 비교할 수 있는 형태(`isComparisonMode`)로 구현되어 있습니다.
* `preserveFace`: 얼굴 비례/특징을 강제로 유지할지 여부를 결정하는 토글 옵션이 지원됩니다.

### 2.2. 파일 구조 (File Structure)
* `components/UploadZone.tsx`, `components/Button.tsx`: 분리된 공통 컴포넌트
* `services/geminiService.ts`: AI 생성 API 호출을 담당하는 서비스 레이어
* `server/server.js`: 프록시 혹은 실제 AI 서비스 연동을 위한 백엔드 실행 파일 (약 14KB 규모)

### 2.3. 기존 의상 & 헤어스타일 선택 방식 (Pain Point)
* **문제점(핵심 단점) 확인:** 코드 내 `OUTFIT_OPTIONS` 및 `HAIR_OPTIONS` 상수를 보면, 다음과 같이 구성되어 있습니다.
  ```typescript
  { 
    id: 'male_suit', 
    label: 'Male Business Suit (Navy/Black)', 
    prompt: 'Change the clothing to a formal...' 
  }
  ```
  현재 옵션은 `id`, `label` (텍스트 이름), `prompt`로만 구성되어 있으며, **각 스타일을 시각적으로 보여줄 수 있는 썸네일(Image URL) 속성이 없습니다.** 
* UI 렌더링 시에도 그저 `<Shirt />` 또는 `<Scissors />` 공통 아이콘과 텍스트(label)만 렌더링되고 있어, 작업자가 결과를 명확히 예측하기 힘든 구조입니다.

## 3. 기능 개선 방향 (PRD로 반영할 내용)

이 소스 코드 분석을 바탕으로, 기존의 텍스트 버튼 렌더링 구조를 썸네일 그리드 형태로 개편해야 합니다.

1. **데이터 스키마 확장:** `PresetOption` 타입(`types.ts`)에 `thumbnailUrl` 속성을 추가해야 합니다.
2. **UI 컴포넌트 개편:** `App.tsx`에서 목록을 순회(`map`)하며 그리는 버튼 내부를 아이콘 대신 실제 옷/헤어스타일의 작은 직사각형 썸네일 이미지(`img`)로 대체합니다.
3. **분류 고도화:** 현재 남자/여자가 하나의 리스트로 묶여있어 스크롤이 깁니다. 탭을 "의상(남/여)", "헤어(남/여)" 등으로 세분화하여 빠르게 탐색할 수 있도록 UI를 나눌 필요가 있습니다.
4. **로컬 에셋 디렉토리 신설:** `public/thumbnails/` 등의 폴더를 만들어 의상 샘플과 헤어스타일 샘플 이미지를 저장하고 연결해야 합니다.
