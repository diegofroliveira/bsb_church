import React, { useState, useRef } from 'react';
import { X, Check, ZoomIn, ZoomOut } from 'lucide-react';

interface ImageCropperModalProps {
  imageSrc: string;
  onCropComplete: (croppedFile: File) => void;
  onCancel: () => void;
}

export function ImageCropperModal({ imageSrc, onCropComplete, onCancel }: ImageCropperModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isProcessing, setIsProcessing] = useState(false);

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setDragStart({ x: clientX - position.x, y: clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setPosition({
      x: clientX - dragStart.x,
      y: clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleCrop = async () => {
    if (!imageRef.current || !containerRef.current) return;
    setIsProcessing(true);
    
    try {
      const canvas = document.createElement('canvas');
      const size = 500; // Final crop size
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No 2d context');

      const containerRect = containerRef.current.getBoundingClientRect();
      const imageRect = imageRef.current.getBoundingClientRect();
      
      const scaleX = imageRef.current.naturalWidth / imageRect.width;
      const scaleY = imageRef.current.naturalHeight / imageRect.height;
      
      const offsetX = (containerRect.left - imageRect.left) * scaleX;
      const offsetY = (containerRect.top - imageRect.top) * scaleY;
      
      const cropWidth = containerRect.width * scaleX;
      const cropHeight = containerRect.height * scaleY;

      ctx.drawImage(
        imageRef.current,
        offsetX,
        offsetY,
        cropWidth,
        cropHeight,
        0,
        0,
        size,
        size
      );

      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], 'cropped_avatar.jpg', { type: 'image/jpeg' });
          onCropComplete(file);
        } else {
          throw new Error('Failed to create blob');
        }
      }, 'image/jpeg', 0.95);
    } catch (e) {
      console.error(e);
      alert('Erro ao processar imagem');
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
         onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
         onTouchMove={handleMouseMove} onTouchEnd={handleMouseUp}>
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-xl overflow-hidden flex flex-col h-[80vh]">
        
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800">Ajustar Foto</h2>
          <button onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative flex-1 w-full bg-gray-900 flex items-center justify-center overflow-hidden touch-none">
          <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
             <div className="w-[300px] h-[300px] sm:w-[400px] sm:h-[400px] rounded-full shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] border-2 border-white/50"></div>
          </div>
          
          <div 
             ref={containerRef}
             className="w-[300px] h-[300px] sm:w-[400px] sm:h-[400px] relative z-0 flex items-center justify-center cursor-move"
             onMouseDown={handleMouseDown} onTouchStart={handleMouseDown}
          >
             <img 
               ref={imageRef}
               src={imageSrc} 
               alt="Crop preview" 
               draggable={false}
               className="max-w-none origin-center"
               style={{
                 transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                 minWidth: '100%',
                 minHeight: '100%',
                 objectFit: 'cover'
               }}
             />
          </div>
        </div>

        <div className="p-4 border-t flex flex-col sm:flex-row gap-4 items-center justify-between bg-gray-50">
          <div className="flex-1 w-full flex items-center gap-4">
            <ZoomOut className="w-5 h-5 text-gray-400" />
            <input
              type="range"
              value={zoom}
              min={0.1}
              max={3}
              step={0.05}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-pink-600 focus:outline-none"
            />
            <ZoomIn className="w-5 h-5 text-gray-400" />
            <span className="text-sm font-bold text-gray-500 min-w-[3rem]">{zoom.toFixed(2)}x</span>
          </div>

          <div className="flex gap-2 w-full sm:w-auto mt-4 sm:mt-0">
            <button
              onClick={onCancel}
              className="flex-1 sm:flex-none px-6 py-2.5 border border-gray-300 rounded-full text-gray-700 font-bold hover:bg-gray-100 transition-colors"
              disabled={isProcessing}
            >
              Cancelar
            </button>
            <button
              onClick={handleCrop}
              disabled={isProcessing}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-pink-600 rounded-full text-white font-bold hover:bg-pink-700 transition-colors disabled:opacity-50"
            >
              {isProcessing ? 'Cortando...' : (
                <>
                  <Check className="w-4 h-4" />
                  Salvar
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
