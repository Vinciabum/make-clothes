import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Shirt, Scissors, Download, Sparkles, UserRound, History, Upload,
  ShieldCheck, AlertCircle, X, Layers, Undo2, ArrowRight
} from 'lucide-react';
import { Button } from './components/Button';
import { UploadZone } from './components/UploadZone';
import { editIDPhoto, generateStylePack, extractReferencePrompt, editIDPhotoV4 } from './services/geminiService';
import { GenerationState, PresetOption } from './types';

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
  
  const [outfitOptions, setOutfitOptions] = useState<{men: PresetOption[], women: PresetOption[]}>({ men: [], women: [] });
  const [hairOptions, setHairOptions] = useState<{men: PresetOption[], women: PresetOption[]}>({ men: [], women: [] });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalCategory, setModalCategory] = useState<'men_outfit'|'women_outfit'|'men_hair'|'women_hair' | null>(null);
  const [promptOverride, setPromptOverride] = useState('');

  const [layerCount, setLayerCount] = useState(0);

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
        const newImage = await editIDPhotoV4(originalImage, textPrompt, { preserveFace }, initialReferenceType);
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
    if (!currentImage) return;
    setState({ isLoading: true, error: null, currentStep: `Extracting ${type} features...` });
    try {
      const textPrompt = await extractReferencePrompt(refImageBase64, type);
      setState({ isLoading: true, error: null, currentStep: `Applying mask & synthesizing ${type}...` });
      const newImage = await editIDPhotoV4(currentImage, textPrompt, { preserveFace }, type);
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
    const sourceImage = useOriginal ? originalImage : currentImage;
    if (!sourceImage) return;

    setState({ isLoading: true, error: null, currentStep: `Applying ${preset.label}...` });
    try {
      const finalPrompt = promptOverride.trim() 
        ? `${preset.prompt} ADDITIONAL INSTRUCTION: ${promptOverride}`
        : preset.prompt;

      const newImage = await editIDPhoto(sourceImage, finalPrompt, { preserveFace });
      
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

  const handleStylePack = async (gender: 'male'|'female') => {
    const sourceImage = currentImage || originalImage;
    if (!sourceImage) return;

    setState({ isLoading: true, error: null, currentStep: `Generating V3 ${gender} 5-Style P...` });
    try {
      const images = await generateStylePack(sourceImage, gender, { preserveFace });
      setStylePack(images);
      setSelectedStyleIndex(0);
      setCurrentImage(images[0]);
      setHistory(prev => [...prev, images[0]]);
      setLayerCount(prev => prev + 1);
      
      setState({ isLoading: false, error: null, currentStep: 'idle' });
    } catch (error: any) {
      setState({ isLoading: false, error: error.message || "Failed to generate style pack", currentStep: 'idle' });
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
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleDownload]);

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
              <Layers className="w-4 h-4" /><span>Layering Applied ({layerCount})</span>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-screen-2xl mx-auto px-4 py-8 w-full flex flex-col">
        {!isWorkspaceActive ? (
          <div className="max-w-5xl mx-auto mt-6 w-full animate-in fade-in zoom-in duration-300">
            <div className="text-center mb-8">
              <h2 className="text-4xl font-extrabold text-white mb-3 tracking-tight">Studio Davinci</h2>
              <p className="text-slate-400 text-lg">Upload client photo and an optional style reference for custom tailoring.</p>
            </div>
            
            <div className="flex flex-col md:flex-row gap-6 items-stretch justify-center">
              {/* Client Photo Input */}
              <div className="bg-slate-800/80 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-slate-700 relative flex flex-col pt-12 flex-1 max-w-sm w-full">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-indigo-600 text-white px-4 py-1.5 rounded-full font-bold text-sm shadow-lg whitespace-nowrap">
                  STEP 1. Client Photo
                </div>
                {originalImage ? (
                  <div className="w-full relative rounded-xl overflow-hidden aspect-[3/4] group border border-slate-700">
                    <img src={originalImage} className="w-full h-full object-cover" alt="Client" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Button onClick={() => setOriginalImage(null)} className="bg-red-600 hover:bg-red-700" icon={<X className="w-4 h-4"/>}>Remove</Button>
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
                  STEP 2. Reference Style (Optional)
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
                      <Button onClick={() => setInitialReferenceImage(null)} className="bg-red-600 hover:bg-red-700" icon={<X className="w-4 h-4"/>}>Remove</Button>
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
                {initialReferenceImage ? 'Merge & Restyle (V4 Mode)' : 'Enter Preset Workspace (V1 Mode)'}
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
                       <span className="bg-black/80 backdrop-blur-md text-white text-xs font-semibold px-2 py-1 rounded-md shadow-sm">Original Client</span>
                     </div>
                     <div className="flex-1 flex items-center justify-center cursor-pointer group" onClick={() => fileInputRef.current?.click()} title="Replace original photo">
                       <img src={originalImage || ''} alt="Original Viewer" className="max-h-full max-w-full object-contain transition-opacity duration-150 group-hover:opacity-60" />
                       <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 z-10 transition-colors flex items-center justify-center pointer-events-none">
                          <div className="opacity-0 group-hover:opacity-100 bg-white/90 text-slate-900 text-xs font-medium px-4 py-2 rounded-full shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-all flex items-center gap-2">
                              <Upload className="w-4 h-4" /> Replace Photo
                          </div>
                       </div>
                     </div>
                  </div>

                  {/* Right side: Result Image */}
                  <div className="flex-1 flex flex-col relative bg-slate-900 rounded-xl overflow-hidden border border-indigo-900/50">
                     <div className="absolute top-0 left-0 right-0 p-2 z-20 pointer-events-none flex justify-between items-start">
                       <span className="bg-indigo-600/90 backdrop-blur-md text-white text-xs font-semibold px-2 py-1 rounded-md shadow-sm flex items-center w-fit gap-1">
                         <Sparkles className="w-3 h-3" /> Result
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
                    <span className="text-[10px] text-amber-400 font-bold uppercase tracking-widest pl-4 mb-2 flex items-center gap-1"><Sparkles className="w-3 h-3"/> V3 Style Pack Gallery</span>
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
                    <History className="w-3 h-3" /> History (Pro tip: Ctrl+Z to undo)
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
                   Save Image (Ctrl+S)
                 </Button>
                 <Button onClick={handleUndo} disabled={history.length <= 1} className="w-full bg-slate-700 hover:bg-slate-600 text-slate-200" icon={<Undo2 className="w-4 h-4" />}>
                   Undo Last Change
                 </Button>
              </div>

              <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 flex flex-col gap-3 flex-1 overflow-y-auto">

                {/* V3 ONE CLICK 5 STYLES */}
                <div className="pb-4 border-b border-slate-700">
                  <div className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500 mb-3 flex items-center gap-1 line-clamp-1"><Sparkles className="w-4 h-4 text-amber-500"/> V3 Multi-Generation</div>
                  <div className="flex flex-col gap-2">
                     <Button onClick={() => handleStylePack('male')} className="w-full bg-slate-900 hover:bg-gradient-to-r hover:from-slate-800 hover:to-amber-900 border border-slate-700 hover:border-amber-500 text-slate-200 hover:text-white py-3 shadow-lg group transition-all" icon={<UserRound className="w-4 h-4 text-amber-500 group-hover:scale-110 transition-transform"/>}>
                        Male 5-Style Pack
                     </Button>
                     <Button onClick={() => handleStylePack('female')} className="w-full bg-slate-900 hover:bg-gradient-to-r hover:from-slate-800 hover:to-pink-900 border border-slate-700 hover:border-pink-500 text-slate-200 hover:text-white py-3 shadow-lg group transition-all" icon={<UserRound className="w-4 h-4 text-pink-500 group-hover:scale-110 transition-transform"/>}>
                        Female 5-Style Pack
                     </Button>
                  </div>
                </div>
                
                {/* V2 Sequential Reference Updates */}
                <div className="pb-4 border-b border-slate-700 pt-2">
                  <div className="text-sm font-bold text-slate-400 mb-4">V4 Reference Update</div>
                  
                  {/* Outfit Box */}
                  <div className="mb-5">
                    <span className="text-xs text-indigo-400 font-bold uppercase mb-2 flex items-center gap-1"><Shirt className="w-3 h-3"/> Outfit Reference</span>
                    <div className="relative group rounded-lg overflow-hidden border border-slate-600 bg-slate-900 h-20 flex items-center justify-center">
                      {workspaceOutfitRef ? (
                        <>
                          <img src={workspaceOutfitRef} className="w-full h-full object-cover opacity-60" alt="" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Button onClick={() => setWorkspaceOutfitRef(null)} className="bg-red-600/90 text-xs px-2 py-1" icon={<X className="w-3 h-3"/>}>Clear</Button>
                          </div>
                        </>
                      ) : (
                        <UploadZone onImageSelected={setWorkspaceOutfitRef} compact />
                      )}
                    </div>
                    {workspaceOutfitRef && (
                      <Button onClick={() => handleSyncWorkspaceRef('outfit', workspaceOutfitRef)} className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-xs py-2 shadow-sm" icon={<Shirt className="w-3 h-3"/>}>Sync Outfit</Button>
                    )}
                  </div>

                  {/* Hair Box */}
                  <div>
                    <span className="text-xs text-pink-400 font-bold uppercase mb-2 flex items-center gap-1"><Scissors className="w-3 h-3"/> Hair Reference</span>
                    <div className="relative group rounded-lg overflow-hidden border border-slate-600 bg-slate-900 h-20 flex items-center justify-center">
                      {workspaceHairRef ? (
                        <>
                          <img src={workspaceHairRef} className="w-full h-full object-cover opacity-60" alt="" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Button onClick={() => setWorkspaceHairRef(null)} className="bg-red-600/90 text-xs px-2 py-1" icon={<X className="w-3 h-3"/>}>Clear</Button>
                          </div>
                        </>
                      ) : (
                        <UploadZone onImageSelected={setWorkspaceHairRef} compact />
                      )}
                    </div>
                    {workspaceHairRef && (
                      <Button onClick={() => handleSyncWorkspaceRef('hair', workspaceHairRef)} className="w-full mt-2 bg-pink-600 hover:bg-pink-700 text-xs py-2 shadow-sm" icon={<Scissors className="w-3 h-3"/>}>Sync Hair</Button>
                    )}
                  </div>
                </div>

                <div className="pt-2">
                  <div className="text-sm font-bold text-slate-400 mb-2">Apply Style (V1 Presets)</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => openModal('men_outfit')} className="py-2 bg-slate-700 hover:bg-indigo-600 rounded-lg text-slate-300 hover:text-white text-xs font-medium transition-colors border border-slate-600">남성의상</button>
                    <button onClick={() => openModal('women_outfit')} className="py-2 bg-slate-700 hover:bg-indigo-600 rounded-lg text-slate-300 hover:text-white text-xs font-medium transition-colors border border-slate-600">여성의상</button>
                    <button onClick={() => openModal('men_hair')} className="py-2 bg-slate-700 hover:bg-indigo-600 rounded-lg text-slate-300 hover:text-white text-xs font-medium transition-colors border border-slate-600">남성헤어</button>
                    <button onClick={() => openModal('women_hair')} className="py-2 bg-slate-700 hover:bg-indigo-600 rounded-lg text-slate-300 hover:text-white text-xs font-medium transition-colors border border-slate-600">여성헤어</button>
                  </div>
                </div>

                 <div className="mt-auto pt-4 border-t border-slate-700">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input type="checkbox" checked={preserveFace} onChange={(e) => setPreserveFace(e.target.checked)} className="w-4 h-4 rounded bg-slate-900 border-slate-600 text-indigo-600" />
                    <span className="text-xs font-medium text-slate-300 flex items-center gap-1"><ShieldCheck className="w-3 h-3 text-emerald-400" /> Strict Face Lock</span>
                  </label>
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
               <span className="text-slate-400 flex items-center gap-1"><Sparkles className="w-4 h-4"/> Override Prompt:</span>
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
          <div><p className="font-bold text-sm text-red-100">Generation Failed</p><p className="text-sm">{state.error}</p></div>
          <button onClick={() => setState(s => ({...s, error: null}))} className="ml-4 text-red-400 hover:text-white p-1 rounded-md"><X className="w-4 h-4" /></button>
        </div>
      )}
    </div>
  );
};

export default App;