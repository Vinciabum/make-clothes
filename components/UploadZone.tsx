import React, { useCallback } from 'react';
import { Upload, Camera, Image as ImageIcon } from 'lucide-react';

interface UploadZoneProps {
  onImageSelected: (base64: string) => void;
  compact?: boolean;
}

export const UploadZone: React.FC<UploadZoneProps> = ({ onImageSelected, compact = false }) => {

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          onImageSelected(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
    if (event.target) event.target.value = '';
  }, [onImageSelected]);

  if (compact) {
    return (
      <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer group">
        <Upload className="w-5 h-5 text-slate-400 group-hover:text-indigo-400 transition-colors mb-1" />
        <span className="text-xs text-slate-400 group-hover:text-indigo-400 transition-colors">Upload</span>
        <input
          type="file"
          className="hidden"
          accept="image/*"
          onChange={handleFileChange}
        />
      </label>
    );
  }

  return (
    <div className="w-full">
      <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-slate-300 border-dashed rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100 transition-all group">
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          <div className="bg-indigo-50 p-4 rounded-full mb-4 group-hover:scale-110 transition-transform duration-300">
            <Upload className="w-8 h-8 text-indigo-600" />
          </div>
          <p className="mb-2 text-sm text-slate-700 font-semibold">
            Click to upload or drag and drop
          </p>
          <p className="text-xs text-slate-500">
            PNG, JPG or WEBP (Max. 5MB)
          </p>
        </div>
        <input
          type="file"
          className="hidden"
          accept="image/*"
          onChange={handleFileChange}
        />
      </label>

      <div className="mt-4 flex gap-4 text-xs text-slate-500 justify-center">
         <span className="flex items-center gap-1"><Camera className="w-3 h-3" /> Clear Face</span>
         <span className="flex items-center gap-1"><ImageIcon className="w-3 h-3" /> Good Lighting</span>
      </div>
    </div>
  );
};