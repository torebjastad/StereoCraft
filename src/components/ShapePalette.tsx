import React, { useRef } from 'react';
import { Circle, Square, Triangle, Star, Type, Image as ImageIcon, Trash2 } from 'lucide-react';
import { ShapeType } from '../types/index.ts';

interface ShapePaletteProps {
  onAddShape: (type: ShapeType, initialData?: { imageData: Uint8ClampedArray; imageWidth: number; imageHeight: number; imageUrl: string }) => void;
  onClearAll: () => void;
  shapeCount: number;
}

export const ShapePalette: React.FC<ShapePaletteProps> = ({
  onAddShape,
  onClearAll,
  shapeCount,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      const offscreen = document.createElement('canvas');
      offscreen.width = img.width;
      offscreen.height = img.height;
      const ctx = offscreen.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(img, 0, 0);
      const raw = ctx.getImageData(0, 0, img.width, img.height);
      const data = raw.data;

      // Extract luminance buffer (grayscale 0..255)
      const grayBuffer = new Uint8ClampedArray(img.width * img.height);
      for (let i = 0; i < grayBuffer.length; i++) {
        const p = i * 4;
        const r = data[p];
        const g = data[p + 1];
        const b = data[p + 2];
        const a = data[p + 3] / 255.0;
        // Standard Rec. 709 luminance scaled by alpha
        const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) * a;
        grayBuffer[i] = Math.round(lum);
      }

      onAddShape('image', {
        imageData: grayBuffer,
        imageWidth: img.width,
        imageHeight: img.height,
        imageUrl: objectUrl,
      });

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    img.src = objectUrl;
  };

  return (
    <div className="flex flex-col gap-2 p-3 bg-slate-900/60 rounded-xl border border-slate-800/80">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageFileChange}
        className="hidden"
      />
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Add Shapes & Depthmaps
        </span>
        {shapeCount > 0 && (
          <button
            onClick={onClearAll}
            className="flex items-center gap-1 text-[11px] font-medium text-rose-400 hover:text-rose-300 transition cursor-pointer"
            title="Clear all shapes"
          >
            <Trash2 className="w-3 h-3" />
            <span>Clear</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
        <button
          onClick={() => onAddShape('circle')}
          className="flex flex-col items-center justify-center gap-1.5 py-2.5 rounded-lg bg-slate-800/80 hover:bg-indigo-600/30 hover:border-indigo-500/50 border border-slate-700/60 text-slate-200 transition group active:scale-95 cursor-pointer"
          title="Add Circle"
        >
          <Circle className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition" />
          <span className="text-[10px] font-semibold">Circle</span>
        </button>

        <button
          onClick={() => onAddShape('square')}
          className="flex flex-col items-center justify-center gap-1.5 py-2.5 rounded-lg bg-slate-800/80 hover:bg-indigo-600/30 hover:border-indigo-500/50 border border-slate-700/60 text-slate-200 transition group active:scale-95 cursor-pointer"
          title="Add Square"
        >
          <Square className="w-4 h-4 text-pink-400 group-hover:scale-110 transition" />
          <span className="text-[10px] font-semibold">Square</span>
        </button>

        <button
          onClick={() => onAddShape('triangle')}
          className="flex flex-col items-center justify-center gap-1.5 py-2.5 rounded-lg bg-slate-800/80 hover:bg-indigo-600/30 hover:border-indigo-500/50 border border-slate-700/60 text-slate-200 transition group active:scale-95 cursor-pointer"
          title="Add Triangle"
        >
          <Triangle className="w-4 h-4 text-amber-400 group-hover:scale-110 transition" />
          <span className="text-[10px] font-semibold">Triangle</span>
        </button>

        <button
          onClick={() => onAddShape('star')}
          className="flex flex-col items-center justify-center gap-1.5 py-2.5 rounded-lg bg-slate-800/80 hover:bg-indigo-600/30 hover:border-indigo-500/50 border border-slate-700/60 text-slate-200 transition group active:scale-95 cursor-pointer"
          title="Add 5-Point Star"
        >
          <Star className="w-4 h-4 text-teal-400 group-hover:scale-110 transition" />
          <span className="text-[10px] font-semibold">Star</span>
        </button>

        <button
          onClick={() => onAddShape('text')}
          className="flex flex-col items-center justify-center gap-1.5 py-2.5 rounded-lg bg-slate-800/80 hover:bg-indigo-600/30 hover:border-indigo-500/50 border border-slate-700/60 text-slate-200 transition group active:scale-95 cursor-pointer"
          title="Add 3D Text"
        >
          <Type className="w-4 h-4 text-sky-400 group-hover:scale-110 transition" />
          <span className="text-[10px] font-semibold">Text</span>
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-1.5 py-2.5 rounded-lg bg-slate-800/80 hover:bg-purple-600/30 hover:border-purple-500/50 border border-slate-700/60 text-slate-200 transition group active:scale-95 cursor-pointer"
          title="Import Custom Grayscale Depthmap Image"
        >
          <ImageIcon className="w-4 h-4 text-purple-400 group-hover:scale-110 transition" />
          <span className="text-[10px] font-semibold">Depthmap</span>
        </button>
      </div>
    </div>
  );
};
