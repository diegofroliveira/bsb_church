import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, Check, AlertCircle, Search, Loader2, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Member {
  id: string;
  nome: string;
}

interface BatchPhotoUploadModalProps {
  members: Member[];
  onClose: () => void;
  onSuccess: () => void;
}

interface FileItem {
  id: string;
  file: File;
  previewUrl: string;
  matchedMemberId: string | null;
  status: 'pending' | 'processing' | 'success' | 'error';
  errorMessage?: string;
  searchQuery: string;
  showDropdown: boolean;
}

function normalizeString(str: string) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export function BatchPhotoUploadModal({ members, onClose, onSuccess }: BatchPhotoUploadModalProps) {
  const [items, setItems] = useState<FileItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFilesAdded = (files: FileList | File[]) => {
    const newItems: FileItem[] = Array.from(files).map((file, index) => {
      const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
      const normalizedFileName = normalizeString(fileNameWithoutExt);
      
      // Attempt to match
      let matchedId = null;
      let matchedName = "";
      
      const exactMatch = members.find(m => normalizeString(m.nome) === normalizedFileName);
      if (exactMatch) {
        matchedId = exactMatch.id;
        matchedName = exactMatch.nome;
      } else {
        const partialMatch = members.find(m => normalizeString(m.nome).includes(normalizedFileName) || normalizedFileName.includes(normalizeString(m.nome)));
        if (partialMatch) {
           matchedId = partialMatch.id;
           matchedName = partialMatch.nome;
        }
      }

      return {
        id: `${Date.now()}-${index}`,
        file,
        previewUrl: URL.createObjectURL(file),
        matchedMemberId: matchedId,
        status: 'pending',
        searchQuery: matchedName || fileNameWithoutExt,
        showDropdown: false
      };
    });

    setItems(prev => [...prev, ...newItems]);
  };

  const removeItem = (id: string) => {
    setItems(prev => {
      const item = prev.find(i => i.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter(i => i.id !== id);
    });
  };

  const updateItem = (id: string, updates: Partial<FileItem>) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const processAndUploadFile = async (item: FileItem) => {
    if (!item.matchedMemberId) throw new Error("Nenhum membro selecionado");
    
    // 1. Process with canvas (center crop 500x500)
    const croppedBlob = await new Promise<Blob>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 500;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject("No 2d context");

        const scale = Math.max(size / img.width, size / img.height);
        const x = (size / scale - img.width) / 2;
        const y = (size / scale - img.height) / 2;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);
        ctx.scale(scale, scale);
        ctx.drawImage(img, x, y);

        canvas.toBlob(blob => {
          if (blob) resolve(blob);
          else reject("Canvas toBlob failed");
        }, 'image/jpeg', 0.9);
      };
      img.onerror = () => reject("Image load failed");
      img.src = item.previewUrl;
    });

    const fileToUpload = new File([croppedBlob], `${item.matchedMemberId}.jpg`, { type: 'image/jpeg' });
    const filePath = `avatars/${item.matchedMemberId}.jpg`;

    // 2. Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, fileToUpload, { upsert: true, contentType: 'image/jpeg' });

    if (uploadError) throw uploadError;

    // 3. Get Public URL
    const publicUrl = `${supabase.storage.from('avatars').getPublicUrl(filePath).data.publicUrl}?t=${Date.now()}`;

    // 4. Update Membros table
    const { error: dbError } = await supabase
      .from('membros')
      .update({ foto: publicUrl })
      .eq('id', item.matchedMemberId);

    if (dbError) throw dbError;
  };

  const handleStartUpload = async () => {
    const pendingItems = items.filter(i => i.status === 'pending' || i.status === 'error');
    if (pendingItems.length === 0) return;

    setIsUploading(true);

    for (const item of pendingItems) {
      if (!item.matchedMemberId) continue; // skip unmatched

      updateItem(item.id, { status: 'processing' });
      try {
        await processAndUploadFile(item);
        updateItem(item.id, { status: 'success' });
      } catch (err: any) {
        console.error(err);
        updateItem(item.id, { status: 'error', errorMessage: err.message });
      }
    }

    setIsUploading(false);
    onSuccess();
  };

  const getMatchedMemberName = (id: string | null) => {
    if (!id) return "";
    const m = members.find(m => m.id === id);
    return m ? m.nome : "";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-xl overflow-hidden flex flex-col h-[90vh]">
        <div className="p-5 border-b flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Upload de Fotos em Lote</h2>
            <p className="text-sm text-gray-500">Selecione várias fotos. O sistema tentará cruzar o nome do arquivo com o nome do membro.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 bg-gray-50 flex flex-col gap-4">
          
          {items.length === 0 && (
            <div 
              className="border-2 border-dashed border-gray-300 rounded-xl p-10 flex flex-col items-center justify-center text-gray-500 cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-10 h-10 mb-3 text-pink-500" />
              <p className="font-semibold text-gray-700">Clique para selecionar os arquivos</p>
              <p className="text-sm mt-1">Dica: Renomeie as fotos com o nome dos membros para pareamento automático!</p>
            </div>
          )}

          <input 
            type="file" 
            multiple 
            accept="image/*" 
            className="hidden" 
            ref={fileInputRef}
            onChange={(e) => {
              if (e.target.files) handleFilesAdded(e.target.files);
              e.target.value = '';
            }}
          />

          {items.length > 0 && (
             <div className="flex justify-between items-center bg-white p-3 rounded-lg shadow-sm">
                <span className="font-semibold text-gray-700">{items.length} arquivo(s) selecionado(s)</span>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="text-sm font-semibold text-pink-600 hover:text-pink-800"
                >
                  + Adicionar mais fotos
                </button>
             </div>
          )}

          <div className="flex flex-col gap-3">
            {items.map(item => (
              <div key={item.id} className="bg-white p-3 rounded-xl border shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-4 relative">
                
                <div className="w-16 h-16 shrink-0 rounded-lg overflow-hidden border bg-gray-100 flex items-center justify-center">
                   <img src={item.previewUrl} alt="Preview" className="w-full h-full object-cover" />
                </div>
                
                <div className="flex-1 min-w-0 w-full relative">
                   <p className="text-xs font-semibold text-gray-400 mb-1 truncate" title={item.file.name}>Arquivo: {item.file.name}</p>
                   
                   <div className="relative">
                      <div className="flex items-center border rounded-lg overflow-hidden focus-within:border-pink-500 focus-within:ring-1 focus-within:ring-pink-500">
                        <div className="pl-3 text-gray-400"><Search className="w-4 h-4"/></div>
                        <input 
                          type="text" 
                          className="w-full p-2 outline-none text-sm text-gray-700 bg-transparent"
                          placeholder="Buscar membro..."
                          value={item.searchQuery}
                          onChange={(e) => {
                            updateItem(item.id, { searchQuery: e.target.value, matchedMemberId: null, showDropdown: true });
                          }}
                          onFocus={() => updateItem(item.id, { showDropdown: true })}
                        />
                      </div>
                      
                      {item.showDropdown && item.searchQuery && !item.matchedMemberId && (
                         <div className="absolute z-10 w-full mt-1 bg-white border shadow-lg rounded-lg max-h-48 overflow-y-auto">
                            {members
                              .filter(m => normalizeString(m.nome).includes(normalizeString(item.searchQuery)))
                              .slice(0, 50)
                              .map(m => (
                                <button 
                                  key={m.id}
                                  className="w-full text-left p-2 hover:bg-gray-50 text-sm text-gray-700 border-b last:border-b-0"
                                  onClick={() => updateItem(item.id, { matchedMemberId: m.id, searchQuery: m.nome, showDropdown: false })}
                                >
                                  {m.nome}
                                </button>
                            ))}
                         </div>
                      )}
                   </div>
                   {!item.matchedMemberId && (
                     <p className="text-xs text-red-500 mt-1 font-semibold flex items-center gap-1">
                       <AlertCircle className="w-3 h-3" /> Membro não associado
                     </p>
                   )}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {item.status === 'processing' && <Loader2 className="w-5 h-5 animate-spin text-pink-500" />}
                  {item.status === 'success' && <div className="text-green-600 font-semibold flex items-center gap-1 text-sm"><Check className="w-4 h-4"/> Salvo</div>}
                  {item.status === 'error' && <div className="text-red-500 text-xs max-w-[100px] truncate" title={item.errorMessage}>Erro: {item.errorMessage}</div>}
                  
                  {item.status !== 'processing' && item.status !== 'success' && (
                     <button onClick={() => removeItem(item.id)} className="text-gray-400 hover:text-red-500 p-2">
                       <X className="w-5 h-5" />
                     </button>
                  )}
                </div>
              </div>
            ))}
          </div>

        </div>

        <div className="p-5 border-t bg-white flex justify-end gap-3">
           <button 
             onClick={onClose}
             className="px-5 py-2.5 rounded-full border text-gray-600 font-bold hover:bg-gray-50"
             disabled={isUploading}
           >
             Fechar
           </button>
           <button 
             onClick={handleStartUpload}
             disabled={isUploading || items.length === 0 || !items.some(i => i.status === 'pending' || i.status === 'error')}
             className="px-6 py-2.5 rounded-full bg-pink-600 text-white font-bold hover:bg-pink-700 disabled:opacity-50 flex items-center gap-2"
           >
             {isUploading && <Loader2 className="w-4 h-4 animate-spin" />}
             {isUploading ? 'Processando...' : 'Iniciar Upload'}
           </button>
        </div>
      </div>
    </div>
  );
}
