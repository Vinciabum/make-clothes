# AI ID Photo Studio - V3 Product Requirements Document (PRD)

## 1. 개요 (Overview)
**V3 핵심 목표:** '원클릭 5종 디자인 패키지(One-click 5-Style Pack) 동시 렌더링 시스템' 도입.
사용자가 남성(Male) 혹은 여성(Female) '추천 스타일 5종 세트' 버튼을 단 한 번만 클릭하면, 서로 완전히 느낌이 다른 5가지 코어 디자인의 의상을 동시에 생성하여 갤러리 형태로 제안하는 기능입니다. 

사용자가 템플릿을 찾아 일일이 여러 번 클릭할 필요 없이 가장 대중적이고 수요가 많은 5개의 룩(Look) 패키지를 한 번에 쫙 깔아주고, 완성된 5장 중 마음에 드는 사진만 쏙쏙 골라서 쇼핑하듯 다운로드하는 쾌적한 럭셔리 UX를 제공합니다.

## 2. 디자인 라인업 플랜 (5-Style Packs)
버튼 클릭 시 백그라운드에서 동시에 발송될 5개의 독립된 스크립트입니다.

**🤴 남성(Male) 5종 패키지:**
1. 네이비 정장 + 타이 (Navy suit with tie)
2. 그레이 정장 + 타이 (Grey suit with tie)
3. 노타이 정장 (Suit with no tie)
4. 비즈니스 캐주얼 (Smart casual, e.g., blazer over a t-shirt)
5. 깔끔한 셔츠 단독 (Only clean dress shirts)

**👸 여성(Female) 5종 패키지:**
1. 네이비 포멀 수트/블레이저 (Navy formal suit)
2. 그레이 포멀 수트/블레이저 (Grey formal suit)
3. 화이트 실크 블라우스 (White silk blouse)
4. 비즈니스 캐주얼 가디건/자켓 (Business casual cardigan/jacket)
5. 깔끔한 셔츠 단독 (Clean dress shirt only)

## 3. 기술 스펙 및 모델 적용 (Technical Spec)
- **속도 최적화 경량 모델 탑재:** 5번의 연산을 빠른 속도로 스트레스 없이 처리하기 위해, 무거운 초고화질 모델 대신 가볍고 생성 속도가 압도적인 **`gemini-2.5-flash-image`** API 모델을 이 기능에만 전략적으로 채택하여 사용합니다.
- **병렬 생성망 아키텍처:** 프론트엔드에서 1회 요청 시 백엔드가 `Promise.all`로 서로 다른 5개의 프롬프트를 담아 구글 서버에 동시에 5개의 채널 통신망을 열어 던집니다. 유저는 대략 1장 통신하는 시간 안에 5장을 모두 받아봅니다.

## 4. UI/UX 및 아키텍처 요구사항
- **퀵 버튼:** 결과 화면의 UI 우측 사이드바 하단 등 눈에 잘 띄는 곳에 넓고 강조된 `[✨ Male 5-Style Pack]`, `[✨ Female 5-Style Pack]` 버튼을 탑재합니다.
- **갤러리 뷰어 레이아웃:** 기존처럼 1개의 결과 페이지만 있는 것이 아니라, 메인 뷰어 바로 아래에 **5칸을 슬라이드나 그리드로 나열하는 미니 썸네일 스트립(Gallery Strip)** 컴포넌트를 개발합니다.
  - 썸네일을 누르면 메인 뷰어 화면으로 큼직하게 띄워줍니다.
  - 마음에 드는 사진마다 개별 다운로드 버튼이 존재합니다.

## 5. 개발 마일스톤
- **Phase 1 (현재):** `prd_v3.md` (본 문서) 기획안 작성 및 조율.
- **Phase 2:** 백엔드(`geminiService.ts`)에 남/녀 5종 멀티 렌더링을 담당하는 전용 함수 `generateStylePack()` 신설 (gemini-2.5-flash-image 모델 강제 바인딩).
- **Phase 3:** 프론트엔드(`App.tsx`) UI 단에 다중 배열 상태(`string[]`) 구조화 및 하단 갤러리 스트립 모듈 구축. 
