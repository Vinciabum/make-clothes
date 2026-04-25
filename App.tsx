import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Shirt, Scissors, Download, Sparkles, UserRound, History, Upload,
  ShieldCheck, AlertCircle, X, Layers, Undo2, ArrowRight
} from 'lucide-react';
import { Button } from './components/Button';
import { UploadZone } from './components/UploadZone';
import { editIDPhoto, generateStylePack, generateHairPack, extractReferencePrompt, editIDPhotoV4 } from './services/geminiService';
import { detectFaceBBox, FaceBBox } from './services/imageUtils';
import { GenerationState, PresetOption } from './types';

// Returns the sample preview image IDs (without extension) for the
// currently selected (gender, theme) combo on the given tab. Maps to
// files under /public/samples/<id>.png produced by scripts/buildSamples.mjs.
const getSampleIds = (
  gender: 'male' | 'female' | 'kids',
  theme: string,
  kind: 'outfit' | 'hair'
): string[] => {
  if (kind === 'outfit') {
    if (gender === 'kids') {
      // Generation currently produces only the 'boy' pack for kids; show both
      // boy and girl samples here so the user sees the full range.
      return ['boy_0', 'boy_1', 'boy_2', 'girl_0', 'girl_1', 'girl_2'];
    }
    if (theme === 'basic') return [0,1,2,3,4].map(i => `${gender}_${i}`);
    if (theme === 'suit_2030') return [0,1,2].map(i => `${gender}_2030_suit_${i}`);
    if (theme === 'suit_5060') return [0,1,2].map(i => `${gender}_5060_suit_${i}`);
    if (theme === 'casual_2030') return [0,1,2].map(i => `${gender}_2030_casual_${i}`);
    if (theme === 'casual_5060') return [0,1,2].map(i => `${gender}_5060_casual_${i}`);
    if (theme === 'summer_2030') return [0,1,2].map(i => `${gender}_summer_${i}`);
  } else { // hair
    if (theme === 'interview') {
      const g = gender === 'male' ? 'male' : 'female';
      return [0,1,2].map(i => `${g}_interview_hair_${i}`);
    }
    if (theme === 'hair_2030') return [0,1,2].map(i => `male_2030_casual_hair_${i}`);
    if (theme === 'hair_4050') return [0,1,2].map(i => `male_4050_hair_${i}`);
    if (theme === 'hair_long') return [0,1,2].map(i => `female_long_hair_${i}`);
    if (theme === 'hair_short') return [0,1,2].map(i => `female_short_hair_${i}`);
    if (theme === 'hair_4050_long') return [0,1,2].map(i => `female_4050_long_hair_${i}`);
    if (theme === 'hair_4050_short') return [0,1,2].map(i => `female_4050_short_hair_${i}`);
  }
  return [];
};

const App: React.FC = () => {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  
  // Initial Screen State
  const [initialReferenceImage, setInitialReferenceImage] = useState<string | null>(null);
  const [initialReferenceType, setInitialReferenceType] = useState<'outfit'|'hair'>('outfit');

  // Workspace View State
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [isWorkspaceActive, setIsWorkspaceActive] = useState(false);
  
  const [workspaceOutfitRef, setWorkspaceOutfitRef] = useState<string | null>(null);
  const [workspaceHairRef, setWorkspaceHairRef] = useState<string | null>(null);

  // V3 Feature State
  const [stylePack, setStylePack] = useState<string[]>([]);
  const [selectedStyleIndex, setSelectedStyleIndex] = useState<number>(0);

  const [history, setHistory] = useState<string[]>([]);
  const [preserveFace, setPreserveFace] = useState<boolean>(true);
  // ID-photo strict mode: locks geometry to original + face paste-back from pristine original.
  const [enforceIdentity, setEnforceIdentity] = useState<boolean>(true);
  // When true, every edit uses originalImage as source (no drift accumulation).
  // When false, edits stack on currentImage (legacy layering).
  const [alwaysFromOriginal, setAlwaysFromOriginal] = useState<boolean>(true);
  // Session-fixed seed: same input → same output. Regenerated only on new original upload.
  const [sessionSeed, setSessionSeed] = useState<number>(() => Math.floor(Math.random() * 2147483647));
  // Cached face bbox for the original image (computed once).
  const originalFaceBBoxRef = useRef<FaceBBox | null>(null);
  
  const [outfitOptions, setOutfitOptions] = useState<{men: PresetOption[], women: PresetOption[]}>({ men: [], women: [] });
  const [hairOptions, setHairOptions] = useState<{men: PresetOption[], women: PresetOption[]}>({ men: [], women: [] });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalCategory, setModalCategory] = useState<'men_outfit'|'women_outfit'|'men_hair'|'women_hair' | null>(null);
  const [promptOverride, setPromptOverride] = useState('');

  const [layerCount, setLayerCount] = useState(0);

  // Sample-preview lightbox: clicking a sample thumbnail opens the full image.
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // New UI States
  const [activeTab, setActiveTab] = useState<'outfit'|'hair'|'manual'>('outfit');
  const [filterGender, setFilterGender] = useState<'male'|'female'|'kids'>('male');
  const [filterTheme, setFilterTheme] = useState<'basic'|'suit_2030'|'suit_5060'|'casual_2030'|'casual_5060'|'summer_2030'|'interview'|'hair_2030'|'hair_long'|'hair_short'|'hair_4050'|'hair_4050_long'|'hair_4050_short'>('basic');

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [state, setState] = useState<GenerationState>({
    isLoading: false,
    error: null,
    currentStep: 'idle'
  });

  useEffect(() => {
    fetch('/presets.json')
      .then(res => res.json())
      .then(data => {
        if (data.outfits) {
          setOutfitOptions({
             men: data.outfits.filter((o: PresetOption) => o.category === 'men_outfit'),
             women: data.outfits.filter((o: PresetOption) => o.category === 'women_outfit')
          });
        }
        if (data.hairs) {
          setHairOptions({
             men: data.hairs.filter((o: PresetOption) => o.category === 'men_hair'),
             women: data.hairs.filter((o: PresetOption) => o.category === 'women_hair')
          });
        }
      })
      .catch(err => console.error("Failed to load presets:", err));
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setOriginalImage(reader.result);
          setSessionSeed(Math.floor(Math.random() * 2147483647));
          originalFaceBBoxRef.current = null;
          if (isWorkspaceActive) {
            setCurrentImage(reader.result);
            setHistory([reader.result]);
            setLayerCount(0);
          }
        }
      };
      reader.readAsDataURL(file);
    }
    if (event.target) event.target.value = '';
  };

  // Pre-detect and cache the original face bbox whenever a new original is loaded.
  useEffect(() => {
    if (!originalImage) { originalFaceBBoxRef.current = null; return; }
    let cancelled = false;
    (async () => {
      try {
        const bbox = await detectFaceBBox(originalImage);
        if (!cancelled) originalFaceBBoxRef.current = bbox;
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [originalImage]);

  // Source image helper: always start from original when alwaysFromOriginal is on.
  const sourceForEdit = (): string | null =>
    alwaysFromOriginal ? originalImage : (currentImage || originalImage);

  // Shared options bag passed to every service call.
  const editOpts = () => ({
    preserveFace,
    enforceIdentity,
    sessionSeed,
    originalFaceBBox: originalFaceBBoxRef.current,
  });

  const handleEnterWorkspace = async () => {
    if (!originalImage) return;
    
    setIsWorkspaceActive(true);
    setHistory([originalImage]);
    setCurrentImage(originalImage);
    setLayerCount(0);
    setStylePack([]);

    if (initialReferenceImage) {
      if (initialReferenceType === 'outfit') setWorkspaceOutfitRef(initialReferenceImage);
      if (initialReferenceType === 'hair') setWorkspaceHairRef(initialReferenceImage);

      setState({ isLoading: true, error: null, currentStep: `Extracting ${initialReferenceType} features...` });
      try {
        const textPrompt = await extractReferencePrompt(initialReferenceImage, initialReferenceType);
        setState({ isLoading: true, error: null, currentStep: `Applying mask & merging (V4)...` });
        const newImage = await editIDPhotoV4(originalImage, textPrompt, editOpts(), initialReferenceType);
        setHistory(prev => [...prev, newImage]);
        setCurrentImage(newImage);
        setLayerCount(1);
        setState({ isLoading: false, error: null, currentStep: 'idle' });
      } catch (error: any) {
        setState({ isLoading: false, error: error.message || "Failed to generate image", currentStep: 'idle' });
      }
    }
  };

  const handleSyncWorkspaceRef = async (type: 'outfit'|'hair', refImageBase64: string) => {
    const src = sourceForEdit();
    if (!src) return;
    setState({ isLoading: true, error: null, currentStep: `Extracting ${type} features...` });
    try {
      const textPrompt = await extractReferencePrompt(refImageBase64, type);
      setState({ isLoading: true, error: null, currentStep: `Applying mask & synthesizing ${type}...` });
      const newImage = await editIDPhotoV4(src, textPrompt, editOpts(), type);
      setHistory(prev => [...prev, newImage]);
      setCurrentImage(newImage);
      setLayerCount(prev => prev + 1);
      setStylePack([]); // clear V3 pack if they switch back to V4 manual routing
      setState({ isLoading: false, error: null, currentStep: 'idle' });
    } catch (error: any) {
      setState({ isLoading: false, error: error.message || "Failed to generate image", currentStep: 'idle' });
    }
  };

  const handleGeneratePreset = async (preset: PresetOption, useOriginal: boolean) => {
    setIsModalOpen(false);
    setStylePack([]);
    // Respect alwaysFromOriginal: any edit defaults to pristine original source.
    const sourceImage = (alwaysFromOriginal || useOriginal) ? originalImage : currentImage;
    if (!sourceImage) return;

    setState({ isLoading: true, error: null, currentStep: `Applying ${preset.label}...` });
    try {
      const finalPrompt = promptOverride.trim()
        ? `${preset.prompt} ADDITIONAL INSTRUCTION: ${promptOverride}`
        : preset.prompt;

      const newImage = await editIDPhoto(sourceImage, finalPrompt, editOpts());
      
      setHistory(prev => [...prev, newImage]);
      setCurrentImage(newImage);
      if (!useOriginal) setLayerCount(prev => prev + 1);
      else setLayerCount(1);
      
      setState({ isLoading: false, error: null, currentStep: 'idle' });
      setPromptOverride('');
    } catch (error: any) {
      setState({ isLoading: false, error: error.message || "Failed to generate image", currentStep: 'idle' });
    }
  };

  const handleStylePack = async (gender: 'male'|'female'|'male_summer'|'female_summer'|'boy'|'girl'|'male_5060_suit'|'male_2030_suit'|'female_5060_suit'|'female_2030_suit'|'male_5060_casual'|'male_2030_casual'|'female_5060_casual'|'female_2030_casual') => {
    const sourceImage = sourceForEdit();
    if (!sourceImage) return;

    const generationCount = (gender === 'male' || gender === 'female') ? 5 : 3;
    setState({ isLoading: true, error: null, currentStep: `Generating V3 ${gender} ${generationCount}-Style P...` });
    try {
      const images = await generateStylePack(sourceImage, gender, editOpts());
      setStylePack(images);
      setSelectedStyleIndex(0);
      setCurrentImage(images[0]);
      setHistory(prev => [...prev, ...images]);
      setLayerCount(prev => prev + images.length);
      
      setState({ isLoading: false, error: null, currentStep: 'idle' });
    } catch (error: any) {
      setState({ isLoading: false, error: error.message || "Failed to generate style pack", currentStep: 'idle' });
    }
  };

  const handleHairPack = async (genderMode: 'male_interview_hair'|'female_interview_hair'|'male_2030_casual_hair'|'male_4050_hair'|'female_long_hair'|'female_short_hair'|'female_4050_long_hair'|'female_4050_short_hair') => {
    const sourceImage = sourceForEdit();
    if (!sourceImage) return;

    setState({ isLoading: true, error: null, currentStep: `Generating V3 ${genderMode} 3-Style P...` });
    try {
      const images = await generateHairPack(sourceImage, genderMode, editOpts());
      setStylePack(images);
      setSelectedStyleIndex(0);
      setCurrentImage(images[0]);
      setHistory(prev => [...prev, ...images]);
      setLayerCount(prev => prev + images.length);
      
      setState({ isLoading: false, error: null, currentStep: 'idle' });
    } catch (error: any) {
      setState({ isLoading: false, error: error.message || "Failed to generate hair pack", currentStep: 'idle' });
    }
  };

  const handleHistorySelect = (image: string, index: number) => {
    setCurrentImage(image);
    setLayerCount(index);
    setStylePack([]); // reset pack view when browsing history
  };

  const handleUndo = useCallback(() => {
    if (history.length > 1) {
      const newHistory = [...history];
      newHistory.pop(); 
      const previousImage = newHistory[newHistory.length - 1];
      setHistory(newHistory);
      setCurrentImage(previousImage);
      setLayerCount(Math.max(0, layerCount - 1));
      setStylePack([]); // Reset V3 state on undo
    }
  }, [history, layerCount]);

  const handleDownload = useCallback(() => {
    if (!currentImage) return;
    const link = document.createElement('a');
    link.href = currentImage;
    link.download = `id-photo-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [currentImage]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); handleUndo(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); handleDownload(); }
      if (e.key === 'Escape' && previewImage) { e.preventDefault(); setPreviewImage(null); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleDownload, previewImage]);

  const openModal = (category: 'men_outfit'|'women_outfit'|'men_hair'|'women_hair') => {
    setModalCategory(category);
    setIsModalOpen(true);
  };

  const getOptionsForCategory = () => {
    switch(modalCategory) {
      case 'men_outfit': return outfitOptions.men;
      case 'women_outfit': return outfitOptions.women;
      case 'men_hair': return hairOptions.men;
      case 'women_hair': return hairOptions.women;
      default: return [];
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-900 text-slate-200">
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />

      <header className="bg-slate-950 border-b border-slate-800 sticky top-0 z-10 w-full">
        <div className="max-w-screen-2xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => { setIsWorkspaceActive(false); setOriginalImage(null); setInitialReferenceImage(null); setCurrentImage(null); setHistory([]); setStylePack([]); }}>
            <div className="bg-indigo-600 p-2 rounded-lg"><UserRound className="w-5 h-5 text-white" /></div>
            <h1 className="text-xl font-bold text-white tracking-tight">Studio Davinci</h1>
          </div>
          {layerCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1 bg-indigo-900/50 text-indigo-300 rounded-full text-sm font-medium border border-indigo-800/50">
              <Layers className="w-4 h-4" /><span>레이어 적용됨 ({layerCount})</span>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-screen-2xl mx-auto px-4 py-8 w-full flex flex-col">
        {!isWorkspaceActive ? (
          <div className="max-w-5xl mx-auto mt-6 w-full animate-in fade-in zoom-in duration-300">
            <div className="text-center mb-8">
              <h2 className="text-4xl font-extrabold text-white mb-3 tracking-tight">Studio Davinci</h2>
              <p className="text-slate-400 text-lg">고객 사진을 업로드하고 맞춤 편집을 위한 레퍼런스를 추가해보세요.</p>
            </div>
            
            <div className="flex flex-col md:flex-row gap-6 items-stretch justify-center">
              {/* Client Photo Input */}
              <div className="bg-slate-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-slate-700 relative flex flex-col pt-12 flex-1 max-w-sm w-full">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-indigo-600 text-white px-4 py-1.5 rounded-full font-bold text-sm shadow-lg whitespace-nowrap">
                  STEP 1. 원본 사진 (고객 사진)
                </div>
                {originalImage ? (
                  <div className="w-full relative rounded-xl overflow-hidden aspect-[3/4] group border border-slate-700">
                    <img src={originalImage} className="w-full h-full object-cover" alt="Client" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Button onClick={() => setOriginalImage(null)} className="bg-red-600 hover:bg-red-700" icon={<X className="w-4 h-4"/>}>제거하기</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center min-h-[300px]">
                    <UploadZone onImageSelected={setOriginalImage} />
                  </div>
                )}
              </div>

              {/* Arrow Indicator */}
              <div className="hidden md:flex flex-col items-center justify-center px-2">
                 <ArrowRight className="w-8 h-8 text-slate-600" />
              </div>

              {/* Reference Photo Input */}
              <div className="bg-slate-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-slate-700 relative flex flex-col pt-12 flex-1 max-w-sm w-full">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-emerald-600 text-white px-4 py-1.5 rounded-full font-bold text-sm shadow-lg whitespace-nowrap">
                  STEP 2. 레퍼런스 스타일 (선택사항)
                </div>

                <div className="mb-4 flex bg-slate-900 rounded-lg p-1 border border-slate-700">
                  <button onClick={() => setInitialReferenceType('outfit')} className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-colors ${initialReferenceType === 'outfit' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>
                    👗 Outfit (의상)
                  </button>
                  <button onClick={() => setInitialReferenceType('hair')} className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-colors ${initialReferenceType === 'hair' ? 'bg-pink-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>
                    ✂️ Hair (헤어)
                  </button>
                </div>

                {initialReferenceImage ? (
                  <div className="w-full relative rounded-xl overflow-hidden aspect-[3/4] group border border-slate-700">
                    <img src={initialReferenceImage} className="w-full h-full object-cover" alt="Reference" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Button onClick={() => setInitialReferenceImage(null)} className="bg-red-600 hover:bg-red-700" icon={<X className="w-4 h-4"/>}>제거하기</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center min-h-[300px]">
                    <UploadZone onImageSelected={setInitialReferenceImage} />
                  </div>
                )}
              </div>
            </div>
            
            <div className="mt-12 flex justify-center pb-12">
              <Button 
                onClick={handleEnterWorkspace} 
                disabled={!originalImage}
                className={`px-10 py-5 text-xl font-bold rounded-2xl shadow-2xl transition-all w-full max-w-md ${originalImage && initialReferenceImage ? 'bg-indigo-600 hover:bg-indigo-500 hover:scale-105' : (originalImage ? 'bg-slate-600 hover:bg-slate-500 text-slate-100' : 'bg-slate-800 text-slate-500 cursor-not-allowed')}`}
                icon={<Sparkles className="w-6 h-6" />}
              >
                {initialReferenceImage ? '합성 프로세스 시작 (V4 모드)' : '수동 작업 워크스페이스 열기'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full flex-1">
            
            {/* Left Column: Side-by-Side Viewer */}
            <div className="lg:col-span-3 flex flex-col gap-4">
              <div className={`bg-slate-950 rounded-2xl shadow-2xl border border-slate-800 p-4 flex-1 flex flex-col relative overflow-hidden h-full min-h-[600px] ${stylePack.length > 0 ? 'pb-[130px]' : ''}`}>
                
                <div className="flex-1 flex flex-row gap-4">
                  {/* Left side: Original Image */}
                  <div className="flex-1 flex flex-col relative bg-slate-900 rounded-xl overflow-hidden border border-slate-800">
                     <div className="absolute top-0 left-0 right-0 p-2 z-20 pointer-events-none">
                       <span className="bg-black/80 backdrop-blur-md text-white text-xs font-semibold px-2 py-1 rounded-md shadow-sm">원본 사진</span>
                     </div>
                     <div className="flex-1 flex items-center justify-center cursor-pointer group" onClick={() => fileInputRef.current?.click()} title="Replace original photo">
                       <img src={originalImage || ''} alt="Original Viewer" className="max-h-full max-w-full object-contain transition-opacity duration-150 group-hover:opacity-60" />
                       <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 z-10 transition-colors flex items-center justify-center pointer-events-none">
                          <div className="opacity-0 group-hover:opacity-100 bg-white/90 text-slate-900 text-xs font-medium px-4 py-2 rounded-full shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-all flex items-center gap-2">
                              <Upload className="w-4 h-4" /> 사진 교체하기
                          </div>
                       </div>
                     </div>
                  </div>

                  {/* Right side: Result Image */}
                  <div className="flex-1 flex flex-col relative bg-slate-900 rounded-xl overflow-hidden border border-indigo-900/50">
                     <div className="absolute top-0 left-0 right-0 p-2 z-20 pointer-events-none flex justify-between items-start">
                       <span className="bg-indigo-600/90 backdrop-blur-md text-white text-xs font-semibold px-2 py-1 rounded-md shadow-sm flex items-center w-fit gap-1">
                         <Sparkles className="w-3 h-3" /> 결과물
                       </span>
                       <div className="flex flex-col gap-2 items-end pointer-events-auto">
                         {workspaceOutfitRef && (
                          <div className="flex items-center gap-1 bg-slate-800/90 backdrop-blur-md px-2 py-1 rounded-md border border-slate-700 shadow-sm group">
                             <span className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider">Outfit Ref</span>
                             <img src={workspaceOutfitRef} className="w-6 h-8 object-cover rounded opacity-80 group-hover:opacity-100 transition-opacity" alt="outfit thumb" />
                           </div>
                         )}
                         {workspaceHairRef && (
                           <div className="flex items-center gap-1 bg-slate-800/90 backdrop-blur-md px-2 py-1 rounded-md border border-slate-700 shadow-sm group">
                             <span className="text-[10px] text-pink-300 font-bold uppercase tracking-wider">Hair Ref</span>
                             <img src={workspaceHairRef} className="w-6 h-8 object-cover rounded opacity-80 group-hover:opacity-100 transition-opacity" alt="hair thumb" />
                           </div>
                         )}
                       </div>
                     </div>

                     <div className="flex-1 flex items-center justify-center relative">
                       <img src={currentImage || ''} alt="Result Viewer" className="max-h-full max-w-full object-contain" />
                       {state.isLoading && (
                         <div className="absolute inset-0 bg-slate-950/80 z-30 flex flex-col items-center justify-center backdrop-blur-sm">
                           <div className="w-16 h-16 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
                           <p className="mt-4 text-indigo-400 font-medium animate-pulse">{state.currentStep}</p>
                         </div>
                       )}
                     </div>
                  </div>
                </div>

                {/* V3 STYLE PACK GALLERY */}
                {stylePack.length > 0 && (
                  <div className="absolute bottom-0 left-0 right-0 bg-slate-950/95 backdrop-blur-lg border-t border-amber-900/50 p-2 py-3 flex flex-col justify-center min-h-[110px] z-20">
                    <span className="text-[10px] text-amber-400 font-bold uppercase tracking-widest pl-4 mb-2 flex items-center gap-1"><Sparkles className="w-3 h-3"/> V3 다중생성 갤러리</span>
                    <div className="flex gap-4 justify-center items-center">
                      {stylePack.map((img, idx) => (
                        <div key={idx} className="relative group w-[72px] h-[72px] rounded-lg shrink-0 cursor-pointer" onClick={() => {
                           setSelectedStyleIndex(idx);
                           setCurrentImage(img);
                        }}>
                          <img src={img} className={`w-full h-full object-cover rounded-lg border-2 transition-all duration-300 ${selectedStyleIndex === idx ? 'border-amber-400 scale-110 shadow-[0_0_15px_rgba(251,191,36,0.5)] z-10' : 'border-slate-700 opacity-60 hover:opacity-100 hover:scale-105'}`} alt={`Style ${idx}`} />
                          
                          {selectedStyleIndex === idx && (
                             <button className="absolute -top-3 -right-3 bg-amber-500 text-slate-900 p-1 rounded-full shadow-lg hover:bg-amber-400 hover:scale-110 transition-transform z-20 pointer-events-auto" onClick={(e) => {
                               e.stopPropagation();
                               const link = document.createElement('a'); link.href = img; link.download = `v3-stylepack-${idx}.png`; link.click();
                             }} title="Download this style">
                               <Download className="w-3 h-3 font-bold" />
                             </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* History Strip */}
              {history.length > 0 && (
                <div className="bg-slate-950 rounded-xl border border-slate-800 p-3 h-28 flex-shrink-0">
                  <div className="flex items-center gap-2 mb-2 text-xs text-slate-400 font-medium">
                    <History className="w-3 h-3" /> 작업 히스토리 (꿀팁: Ctrl+Z 로 이전 되돌리기)
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {history.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleHistorySelect(img, idx)}
                        className={`relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${currentImage === img ? 'border-indigo-500' : 'border-slate-800 hover:border-slate-600'}`}
                      >
                        <img src={img} alt={`History ${idx}`} className="w-full h-full object-cover" />
                        {idx === 0 && <div className="absolute bottom-0 inset-x-0 bg-black/60 text-[8px] py-0.5 text-center text-white">Orig</div>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Actions */}
            <div className="flex flex-col gap-4">
              <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col gap-3">
                 <Button onClick={handleDownload} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-lg shadow-indigo-900/20" icon={<Download className="w-4 h-4" />}>
                   이미지 저장하기 (Ctrl+S)
                 </Button>
                 <Button onClick={handleUndo} disabled={history.length <= 1} className="w-full bg-slate-700 hover:bg-slate-600 text-slate-200" icon={<Undo2 className="w-4 h-4" />}>
                   이전 단계로 되돌리기
                 </Button>
              </div>

              <div className="bg-slate-800 rounded-xl border border-slate-700 flex flex-col flex-1 overflow-hidden">
                {/* TABS */}
                <div className="flex p-2 gap-1 bg-slate-900 border-b border-slate-700">
                  <button onClick={() => {setActiveTab('outfit'); setFilterTheme('basic');}} className={`flex-1 py-3 text-xs md:text-sm font-extrabold rounded-lg transition-all ${activeTab === 'outfit' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>
                    👕 의상 변경
                  </button>
                  <button onClick={() => {setActiveTab('hair'); setFilterTheme('interview');}} className={`flex-1 py-3 text-xs md:text-sm font-extrabold rounded-lg transition-all ${activeTab === 'hair' ? 'bg-pink-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>
                    ✂️ 헤어 변경
                  </button>
                  <button onClick={() => setActiveTab('manual')} className={`flex-1 flex flex-col items-center justify-center py-2 text-[10px] md:text-xs font-bold rounded-lg transition-all ${activeTab === 'manual' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>
                    <span>⚙️ 수동 도구</span>
                  </button>
                </div>

                <div className="p-4 flex flex-col gap-4 overflow-y-auto flex-1 h-[400px]">
                  {/* TAB 1: OUTFIT */}
                  {activeTab === 'outfit' && (
                    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
                      <div>
                         <label className="text-xs font-bold text-slate-400 mb-2 block tracking-widest uppercase">1. 성별/유형 선택</label>
                         <div className="flex gap-2">
                            {['male', 'female', 'kids'].map(g => (
                              <button key={g} onClick={() => { setFilterGender(g as any); setFilterTheme('basic'); }} className={`flex-1 py-3 rounded-xl border-2 font-bold text-sm transition-all ${filterGender === g ? 'bg-slate-700 border-indigo-500 text-white shadow-lg scale-105' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}>
                                {g === 'male' ? '👨 남성' : g === 'female' ? '👩 여성' : '👧 아이'}
                              </button>
                            ))}
                         </div>
                      </div>

                      <div>
                         <label className="text-xs font-bold text-slate-400 mb-2 block tracking-widest uppercase">2. 스타일 테마 선택</label>
                         <div className="grid grid-cols-2 gap-2">
                            {filterGender === 'kids' ? (
                              <button onClick={() => setFilterTheme('basic')} className={`py-3 rounded-xl border-2 font-bold text-sm transition-all ${filterTheme === 'basic' ? 'bg-slate-700 border-indigo-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}>기본 (3종)</button>
                            ) : (
                              <>
                                <button onClick={() => setFilterTheme('basic')} className={`py-3 rounded-xl border-2 font-bold text-sm transition-all ${filterTheme === 'basic' ? 'bg-slate-700 border-indigo-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'}`}>기본 (5종)</button>
                                <button onClick={() => setFilterTheme('suit_2030')} className={`py-3 rounded-xl border-2 font-bold text-sm transition-all ${filterTheme === 'suit_2030' ? 'bg-slate-700 border-indigo-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'}`}>2030 정장 (3종)</button>
                                <button onClick={() => setFilterTheme('casual_2030')} className={`py-3 rounded-xl border-2 font-bold text-sm transition-all ${filterTheme === 'casual_2030' ? 'bg-slate-700 border-indigo-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'}`}>2030 캐주얼 (3종)</button>
                                <button onClick={() => setFilterTheme('suit_5060')} className={`py-3 rounded-xl border-2 font-bold text-sm transition-all ${filterTheme === 'suit_5060' ? 'bg-slate-700 border-indigo-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'}`}>5060 정장 (3종)</button>
                                <button onClick={() => setFilterTheme('casual_5060')} className={`py-3 rounded-xl border-2 font-bold text-sm transition-all ${filterTheme === 'casual_5060' ? 'bg-slate-700 border-indigo-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'}`}>5060 캐주얼 (3종)</button>
                                <button onClick={() => setFilterTheme('summer_2030')} className={`py-3 rounded-xl border-2 font-bold text-sm transition-all ${filterTheme === 'summer_2030' ? 'bg-slate-700 border-indigo-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'}`}>2030 여름 (3종)</button>
                              </>
                            )}
                         </div>
                      </div>

                      {/* Inline sample preview for the current outfit (gender, theme) combo */}
                      {(() => {
                        const ids = getSampleIds(filterGender, filterTheme, 'outfit');
                        if (ids.length === 0) return null;
                        return (
                          <div className="border-t border-slate-800 pt-3">
                            <label className="text-xs font-bold text-slate-500 mb-2 block tracking-widest uppercase">📸 샘플 미리보기</label>
                            <div className={`grid gap-1.5 ${ids.length >= 5 ? 'grid-cols-5' : ids.length === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
                              {ids.map(id => (
                                <button
                                  key={id}
                                  onClick={() => setPreviewImage(`/samples/${id}.png`)}
                                  className="aspect-[3/4] bg-slate-900 rounded overflow-hidden border border-slate-800 hover:border-indigo-500 transition-colors group"
                                  title={id}
                                >
                                  <img
                                    src={`/samples/${id}.png`}
                                    alt={id}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                  />
                                </button>
                              ))}
                            </div>
                            <p className="text-[10px] text-slate-600 mt-1.5">썸네일 클릭 시 확대. 가상인물 기준 샘플로, 실제 결과는 입력 사진의 얼굴이 유지됩니다.</p>
                          </div>
                        );
                      })()}

                      <div className="mt-4">
                        <Button
                          onClick={() => {
                            if (filterGender === 'kids') {
                               handleStylePack(filterTheme === 'basic' ? 'boy' : 'girl');
                            } else {
                               const g = filterGender; 
                               if (filterTheme === 'basic') handleStylePack(g);
                               else if (filterTheme === 'suit_2030') handleStylePack(`${g}_2030_suit` as any);
                               else if (filterTheme === 'suit_5060') handleStylePack(`${g}_5060_suit` as any);
                               else if (filterTheme === 'casual_2030') handleStylePack(`${g}_2030_casual` as any);
                               else if (filterTheme === 'casual_5060') handleStylePack(`${g}_5060_casual` as any);
                               else if (filterTheme === 'summer_2030') handleStylePack(`${g}_summer` as any);
                            }
                          }}
                          className="w-full py-5 text-lg font-black bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-xl shadow-indigo-900/30 text-white border-0"
                          icon={<Sparkles className="w-6 h-6 text-yellow-300" />}
                        >
                          위 조합으로 생성하기
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: HAIR */}
                  {activeTab === 'hair' && (
                    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
                      <div>
                         <label className="text-xs font-bold text-slate-400 mb-2 block tracking-widest uppercase">1. 성별 선택</label>
                         <div className="flex gap-2">
                            {['male', 'female'].map(g => (
                              <button key={g} onClick={() => { setFilterGender(g as any); setFilterTheme('interview'); }} className={`flex-1 py-3 rounded-xl border-2 font-bold text-sm transition-all ${filterGender === g ? 'bg-slate-700 border-pink-500 text-white shadow-lg scale-105' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}>
                                {g === 'male' ? '👨 남성' : '👩 여성'}
                              </button>
                            ))}
                         </div>
                      </div>

                      <div>
                         <label className="text-xs font-bold text-slate-400 mb-2 block tracking-widest uppercase">2. 헤어스타일 테마</label>
                         <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => setFilterTheme('interview')} className={`py-3 rounded-xl border-2 font-bold text-sm transition-all col-span-2 ${filterTheme === 'interview' ? 'bg-slate-700 border-pink-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'}`}>
                               ✂️ 취업 단정 (3종)
                            </button>
                            {filterGender === 'male' ? (
                              <>
                                <button onClick={() => setFilterTheme('hair_2030')} className={`py-3 rounded-xl border-2 font-bold text-sm transition-all ${filterTheme === 'hair_2030' ? 'bg-slate-700 border-pink-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'}`}>
                                  2030 스타일 (3종)
                                </button>
                                <button onClick={() => setFilterTheme('hair_4050')} className={`py-3 rounded-xl border-2 font-bold text-sm transition-all ${filterTheme === 'hair_4050' ? 'bg-slate-700 border-pink-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'}`}>
                                  4050 스타일 (3종)
                                </button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => setFilterTheme('hair_long')} className={`py-3 rounded-xl border-2 font-bold text-sm transition-all ${filterTheme === 'hair_long' ? 'bg-slate-700 border-pink-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'}`}>
                                  2030 긴머리 (3종)
                                </button>
                                <button onClick={() => setFilterTheme('hair_short')} className={`py-3 rounded-xl border-2 font-bold text-sm transition-all ${filterTheme === 'hair_short' ? 'bg-slate-700 border-pink-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'}`}>
                                  2030 짧은머리 (3종)
                                </button>
                                <button onClick={() => setFilterTheme('hair_4050_long')} className={`py-3 rounded-xl border-2 font-bold text-sm transition-all ${filterTheme === 'hair_4050_long' ? 'bg-slate-700 border-pink-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'}`}>
                                  4050 긴머리 (3종)
                                </button>
                                <button onClick={() => setFilterTheme('hair_4050_short')} className={`py-3 rounded-xl border-2 font-bold text-sm transition-all ${filterTheme === 'hair_4050_short' ? 'bg-slate-700 border-pink-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'}`}>
                                  4050 짧은머리 (3종)
                                </button>
                              </>
                            )}
                         </div>
                      </div>

                      {/* Inline sample preview for the current hair (gender, theme) combo */}
                      {(() => {
                        const ids = getSampleIds(filterGender, filterTheme, 'hair');
                        if (ids.length === 0) return null;
                        return (
                          <div className="border-t border-slate-800 pt-3">
                            <label className="text-xs font-bold text-slate-500 mb-2 block tracking-widest uppercase">📸 샘플 미리보기</label>
                            <div className={`grid gap-1.5 ${ids.length >= 5 ? 'grid-cols-5' : ids.length === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
                              {ids.map(id => (
                                <button
                                  key={id}
                                  onClick={() => setPreviewImage(`/samples/${id}.png`)}
                                  className="aspect-[3/4] bg-slate-900 rounded overflow-hidden border border-slate-800 hover:border-pink-500 transition-colors group"
                                  title={id}
                                >
                                  <img
                                    src={`/samples/${id}.png`}
                                    alt={id}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                  />
                                </button>
                              ))}
                            </div>
                            <p className="text-[10px] text-slate-600 mt-1.5">썸네일 클릭 시 확대. 가상인물 기준 샘플로, 실제 결과는 입력 사진의 얼굴이 유지됩니다.</p>
                          </div>
                        );
                      })()}

                      <div className="mt-4">
                        <Button
                          onClick={() => {
                            let mode: Parameters<typeof handleHairPack>[0];
                            if (filterTheme === 'hair_2030') mode = 'male_2030_casual_hair';
                            else if (filterTheme === 'hair_4050') mode = 'male_4050_hair';
                            else if (filterTheme === 'hair_long') mode = 'female_long_hair';
                            else if (filterTheme === 'hair_short') mode = 'female_short_hair';
                            else if (filterTheme === 'hair_4050_long') mode = 'female_4050_long_hair';
                            else if (filterTheme === 'hair_4050_short') mode = 'female_4050_short_hair';
                            else mode = filterGender === 'male' ? 'male_interview_hair' : 'female_interview_hair';
                            handleHairPack(mode);
                          }}
                          className="w-full py-5 text-lg font-black bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 shadow-xl shadow-pink-900/30 text-white border-0"
                          icon={<Sparkles className="w-6 h-6 text-yellow-300" />}
                        >
                          위 조합으로 생성하기
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: MANUAL */}
                  {activeTab === 'manual' && (
                    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
                      
                      {/* V4 Reference Upload */}
                      <div>
                        <div className="text-sm font-bold text-slate-400 mb-4">V4 커스텀 레퍼런스 합성</div>
                        
                        <div className="mb-5">
                          <div className="relative group rounded-lg overflow-hidden border border-slate-600 bg-slate-900 h-20 flex items-center justify-center">
                            {workspaceOutfitRef ? (
                              <>
                                <img src={workspaceOutfitRef} className="w-full h-full object-cover opacity-60" alt="" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <Button onClick={() => setWorkspaceOutfitRef(null)} className="bg-red-600/90 text-xs px-2 py-1" icon={<X className="w-3 h-3"/>}>지우기</Button>
                                </div>
                              </>
                            ) : (
                              <UploadZone onImageSelected={setWorkspaceOutfitRef} compact />
                            )}
                          </div>
                          {workspaceOutfitRef && (
                            <Button onClick={() => handleSyncWorkspaceRef('outfit', workspaceOutfitRef)} className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-xs py-2 shadow-sm" icon={<Shirt className="w-3 h-3"/>}>업로드한 의상으로 덮어쓰기</Button>
                          )}
                        </div>

                        <div>
                          <div className="relative group rounded-lg overflow-hidden border border-slate-600 bg-slate-900 h-20 flex items-center justify-center">
                            {workspaceHairRef ? (
                              <>
                                <img src={workspaceHairRef} className="w-full h-full object-cover opacity-60" alt="" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <Button onClick={() => setWorkspaceHairRef(null)} className="bg-red-600/90 text-xs px-2 py-1" icon={<X className="w-3 h-3"/>}>지우기</Button>
                                </div>
                              </>
                            ) : (
                              <UploadZone onImageSelected={setWorkspaceHairRef} compact />
                            )}
                          </div>
                          {workspaceHairRef && (
                            <Button onClick={() => handleSyncWorkspaceRef('hair', workspaceHairRef)} className="w-full mt-2 bg-pink-600 hover:bg-pink-700 text-xs py-2 shadow-sm" icon={<Scissors className="w-3 h-3"/>}>업로드한 헤어로 덮어쓰기</Button>
                          )}
                        </div>
                      </div>

                      {/* V1 Modals */}
                      <div className="pt-2 border-t border-slate-700">
                        <div className="text-sm font-bold text-slate-400 mb-2">수동 프리셋 모달 (V1)</div>
                        <div className="grid grid-cols-2 gap-2">
                          <button onClick={() => openModal('men_outfit')} className="py-3 bg-slate-800 hover:bg-indigo-600 rounded-lg text-slate-300 hover:text-white text-xs font-medium border border-slate-700 transition">남성의상</button>
                          <button onClick={() => openModal('women_outfit')} className="py-3 bg-slate-800 hover:bg-indigo-600 rounded-lg text-slate-300 hover:text-white text-xs font-medium border border-slate-700 transition">여성의상</button>
                          <button onClick={() => openModal('men_hair')} className="py-3 bg-slate-800 hover:bg-pink-600 rounded-lg text-slate-300 hover:text-white text-xs font-medium border border-slate-700 transition">남성헤어</button>
                          <button onClick={() => openModal('women_hair')} className="py-3 bg-slate-800 hover:bg-pink-600 rounded-lg text-slate-300 hover:text-white text-xs font-medium border border-slate-700 transition">여성헤어</button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-auto pt-4 border-t border-slate-700 flex flex-col gap-2">
                    <label className="flex items-center gap-2 cursor-pointer group w-full px-2">
                      <input type="checkbox" checked={preserveFace} onChange={(e) => setPreserveFace(e.target.checked)} className="w-4 h-4 rounded bg-slate-900 border-slate-600 text-indigo-600" />
                      <span className="text-xs font-medium text-slate-300 flex items-center gap-1"><ShieldCheck className="w-3 h-3 text-emerald-400" /> 얼굴/이목구비 프롬프트 락</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer group w-full px-2">
                      <input type="checkbox" checked={enforceIdentity} onChange={(e) => setEnforceIdentity(e.target.checked)} className="w-4 h-4 rounded bg-slate-900 border-slate-600 text-emerald-600" />
                      <span className="text-xs font-medium text-slate-300 flex items-center gap-1"><ShieldCheck className="w-3 h-3 text-emerald-400" /> 증명사진 엄격 모드 (원본 해상도 정렬 + 얼굴 붙여넣기)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer group w-full px-2">
                      <input type="checkbox" checked={alwaysFromOriginal} onChange={(e) => setAlwaysFromOriginal(e.target.checked)} className="w-4 h-4 rounded bg-slate-900 border-slate-600 text-indigo-600" />
                      <span className="text-xs font-medium text-slate-300 flex items-center gap-1"><ShieldCheck className="w-3 h-3 text-amber-400" /> 항상 원본에서 편집 (드리프트 방지)</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}
      </main>

      {/* Grid Modal Overlay */}
      {isModalOpen && modalCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setIsModalOpen(false)}>
          <div className="bg-slate-900 rounded-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden shadow-2xl border border-slate-700" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
              <h3 className="text-xl font-bold text-white">{modalCategory.replace('_', ' ').toUpperCase()}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white transition-colors p-1 rounded-full"><X className="w-6 h-6" /></button>
            </div>
            <div className="px-6 py-3 bg-slate-800/50 border-b border-slate-800 flex items-center gap-4 text-sm">
               <span className="text-slate-400 flex items-center gap-1"><Sparkles className="w-4 h-4"/> 커스텀 지시사항:</span>
               <input type="text" value={promptOverride} onChange={e => setPromptOverride(e.target.value)} placeholder="ex) Change tie to red..." className="flex-1 bg-slate-950 text-white rounded-lg px-3 py-2 border border-slate-700 outline-none" />
            </div>
            <div className="flex-1 overflow-y-auto p-6 bg-slate-900">
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                {getOptionsForCategory().map(opt => (
                  <button key={opt.id} onClick={() => handleGeneratePreset(opt, !promptOverride.includes('stack'))} className="relative group w-full aspect-square bg-slate-800 rounded-xl overflow-hidden ring-1 ring-slate-700 hover:ring-4 hover:ring-indigo-500 transition-all focus:outline-none focus:ring-4 focus:ring-indigo-500">
                    <div className="absolute inset-0 bg-slate-800 flex items-center justify-center text-slate-600 group-hover:text-indigo-400 transition-colors">
                       {opt.category?.includes('hair') ? <Scissors className="w-8 h-8 opacity-20" /> : <Shirt className="w-8 h-8 opacity-20" />}
                    </div>
                    <img src={opt.thumbnailUrl || ''} alt="" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    <div className="absolute inset-0 bg-indigo-900/0 group-hover:bg-indigo-900/20 transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {state.error && (
        <div className="fixed bottom-4 right-4 bg-red-900 border border-red-500 text-red-200 px-6 py-4 rounded-xl shadow-2xl z-50 flex items-center gap-3 animate-in slide-in-from-bottom-5">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <div><p className="font-bold text-sm text-red-100">이미지 생성 실패</p><p className="text-sm">{state.error}</p></div>
          <button onClick={() => setState(s => ({...s, error: null}))} className="ml-4 text-red-400 hover:text-white p-1 rounded-md"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Sample-preview lightbox */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center cursor-pointer animate-in fade-in duration-200"
        >
          <img
            src={previewImage}
            alt="sample preview"
            className="max-w-[92vw] max-h-[92vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setPreviewImage(null)}
            className="absolute top-4 right-4 bg-slate-800/80 hover:bg-slate-700 text-white rounded-full p-2 transition-colors"
            title="닫기 (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
};

export default App;