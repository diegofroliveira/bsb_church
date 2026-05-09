import React, { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Calendar, 
  Copy, 
  Download, 
  Image as ImageIcon, 
  Loader2, 
  Upload,
  AlertCircle
} from 'lucide-react';
import { toPng } from 'html-to-image';
import clsx from 'clsx';

interface Member {
  id: any;
  nome: string;
  nascimento: string;
  grupos_caseiros?: string;
  avatar_url?: string;
}

export const Birthdays: React.FC = () => {
  const [members, setMembers] = useState<Member[]>([]);
  const [, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{id: any, status: 'idle' | 'uploading' | 'success' | 'error'}>({id: null, status: 'idle'});
  const [storageError, setStorageError] = useState<string | null>(null);
  const collageRef = useRef<HTMLDivElement>(null);

  const [filterMode, setFilterMode] = useState<'today' | 'tomorrow' | 'month' | 'specific'>('today');
  const [specificDate, setSpecificDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    setIsLoading(true);
    setStorageError(null);
    try {
      const { data, error } = await supabase
        .from('membros')
        .select('id, nome, nascimento, grupos_caseiros')
        .limit(10000);

      if (error) throw error;
      setMembers(data || []);
      
      // Test storage access
      const { error: storageCheck } = await supabase.storage.from('avatars').list('', { limit: 1 });
      if (storageCheck) {
        if (storageCheck.message.includes('not found')) {
           setStorageError("Bucket 'avatars' não encontrado. Crie um bucket público chamado 'avatars' no Supabase Storage.");
        } else {
           setStorageError(storageCheck.message);
        }
      }
    } catch (err: any) {
      console.error('Error fetching members:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getBirthdays = useMemo(() => {
    const now = new Date();
    const todayStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    const tomorrow = new Date();
    tomorrow.setDate(now.getDate() + 1);
    const tomorrowStr = `${String(tomorrow.getDate()).padStart(2, '0')}/${String(tomorrow.getMonth() + 1).padStart(2, '0')}`;
    
    const currentMonth = now.getMonth() + 1;

    return members.filter(m => {
      if (!m.nascimento) return false;
      const parts = m.nascimento.split('/');
      if (parts.length < 2) return false;
      const dayMonth = `${parts[0]}/${parts[1]}`;
      const month = parseInt(parts[1]);

      if (filterMode === 'today') return dayMonth === todayStr;
      if (filterMode === 'tomorrow') return dayMonth === tomorrowStr;
      if (filterMode === 'month') return month === currentMonth;
      if (filterMode === 'specific') {
        const spec = new Date(specificDate);
        const specStr = `${String(spec.getDate()+1).padStart(2, '0')}/${String(spec.getMonth() + 1).padStart(2, '0')}`;
        return dayMonth === specStr;
      }
      return false;
    }).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [members, filterMode, specificDate]);

  const generateMessage = () => {
    if (getBirthdays.length === 0) return "Nenhum aniversariante encontrado.";
    
    const names = getBirthdays.map(m => `*${m.nome.toUpperCase()}* (@${m.nome.split(' ')[0].toUpperCase()}) - ${m.grupos_caseiros || 'Sem GC'} 🌷`).join('\n');
    
    return `Bom dia,\n\nOs aniversariantes hoje são:\n${names}\n\nParabéns!! Deus abençoe vocês!! 🥳 🎂 🎊 🥂 🎇\n\n_"Este é o dia com que nos presenteou o SENHOR: festejemos e regozijemo-nos nele!" (Salmos 118:24)_`;
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(generateMessage());
    alert('Mensagem copiada para a área de transferência!');
  };

  const handleDownloadCollage = async () => {
    if (!collageRef.current || getBirthdays.length === 0) return;
    
    setIsExporting(true);
    try {
      // Usando html-to-image (toPng) que lida melhor com CSS moderno e oklch
      const dataUrl = await toPng(collageRef.current, {
        cacheBust: true,
        quality: 1,
        pixelRatio: 2, // Alta definição
        backgroundColor: '#f9fafb'
      });
      
      const link = document.createElement('a');
      link.download = `aniversariantes_${filterMode}_${new Date().getTime()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Erro ao gerar colagem:', err);
      alert('Erro ao gerar imagem. Verifique o console para mais detalhes.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleUploadPhoto = async (memberId: any, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadStatus({ id: memberId, status: 'uploading' });
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${memberId}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Force refresh for this member (in a real app you'd update the DB record too)
      // Here we just refresh the UI
      fetchMembers();
      setUploadStatus({ id: memberId, status: 'success' });
      setTimeout(() => setUploadStatus({ id: null, status: 'idle' }), 3000);
    } catch (err: any) {
      console.error('Upload error:', err);
      setUploadStatus({ id: memberId, status: 'error' });
      alert(`Erro no upload: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header>
        <div className="inline-flex items-center gap-2 bg-pink-50 text-pink-600 px-3 py-1 rounded-full text-xs font-bold mb-3">
           <Calendar className="h-3 w-3" /> Secretariado
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Aniversariantes</h1>
        <p className="mt-2 text-sm text-gray-500">
          Gere as mensagens e colagens de fotos automaticamente.
        </p>
      </header>

      {storageError && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex gap-3 items-start">
           <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
           <div>
              <h3 className="text-sm font-bold text-red-800">Erro de Armazenamento</h3>
              <p className="text-xs text-red-600 mt-1">{storageError}</p>
              <p className="text-[10px] text-red-400 mt-2 italic">Para corrigir, acesse o painel do Supabase {'>'} Storage {'>'} Crie um bucket público chamado "avatars".</p>
           </div>
        </div>
      )}

      <div className="flex flex-wrap gap-4 border-b border-gray-100 pb-1">
        {[
          { id: 'today', label: 'Aniversariantes de Hoje' },
          { id: 'tomorrow', label: 'Amanhã' },
          { id: 'month', label: 'Todo o Mês' },
          { id: 'specific', label: 'Data Específica:' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterMode(tab.id as any)}
            className={clsx(
              "pb-3 text-sm font-medium transition-colors relative",
              filterMode === tab.id ? "text-pink-600" : "text-gray-500 hover:text-gray-700"
            )}
          >
            {tab.label}
            {filterMode === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-pink-600" />}
          </button>
        ))}
        {filterMode === 'specific' && (
          <input 
            type="date" 
            value={specificDate} 
            onChange={e => setSpecificDate(e.target.value)}
            className="text-xs border border-gray-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-pink-500"
          />
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* Left Column: Text Message */}
        <div className="xl:col-span-4 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
             <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                   <ImageIcon className="h-4 w-4 text-pink-500" /> Mensagem Automática
                </h3>
                <button 
                  onClick={handleCopyText}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                >
                   <Copy className="h-3 w-3" /> Copiar Texto
                </button>
             </div>
             <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-600 font-mono whitespace-pre-wrap leading-relaxed border border-gray-100">
                {generateMessage()}
             </div>
          </div>

          <div className="bg-pink-50/50 rounded-2xl border border-pink-100 p-6">
             <h3 className="text-sm font-bold text-pink-900 flex items-center gap-2 mb-2">
                <Download className="h-4 w-4" /> Exportação de Imagem
             </h3>
             <p className="text-xs text-pink-700 mb-6">
                O painel ao lado gera um mosaico automático com as fotos de todos os aniversariantes. Se alguém estiver sem foto, você pode fazer o upload clicando no card da pessoa.
             </p>
             <button
                onClick={handleDownloadCollage}
                disabled={isExporting || getBirthdays.length === 0}
                className="w-full bg-pink-600 hover:bg-pink-700 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-pink-200 transition-all flex items-center justify-center gap-2"
             >
                {isExporting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
                Baixar Colagem Final
             </button>
          </div>
        </div>

        {/* Right Column: Visual Collage */}
        <div className="xl:col-span-8">
          <div className="bg-gray-100/50 rounded-3xl p-8 border border-gray-200">
            <div 
              ref={collageRef}
              className="bg-white rounded-2xl shadow-xl p-10 max-w-3xl mx-auto"
            >
              <div className="text-center mb-10">
                <h2 className="text-4xl font-black text-gray-900 tracking-tight">Aniversariantes</h2>
                <p className="text-pink-500 font-bold tracking-widest text-sm mt-2 uppercase">Parabéns!</p>
              </div>

              <div className={clsx(
                "grid gap-6",
                getBirthdays.length === 1 ? "grid-cols-1" : 
                getBirthdays.length === 2 ? "grid-cols-2" :
                "grid-cols-2 md:grid-cols-3"
              )}>
                {getBirthdays.map((m) => {
                  const avatarUrl = `${supabase.storage.from('avatars').getPublicUrl(`avatars/${m.id}.jpg`).data.publicUrl}?t=${new Date().getTime()}`;
                  const isUploading = uploadStatus.id === m.id && uploadStatus.status === 'uploading';
                  
                  return (
                    <div key={m.id} className="flex flex-col items-center group relative">
                       <label className="cursor-pointer block w-full">
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={(e) => handleUploadPhoto(m.id, e)}
                          />
                          <div className="aspect-square w-full rounded-2xl bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden relative group-hover:border-pink-300 transition-colors">
                             {/* Tenta carregar a imagem, se falhar mostra placeholder */}
                             <img 
                                src={avatarUrl} 
                                alt={m.nome}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = '';
                                  (e.target as HTMLImageElement).classList.add('hidden');
                                  (e.target as HTMLImageElement).parentElement?.querySelector('.placeholder')?.classList.remove('hidden');
                                }}
                             />
                             <div className="placeholder hidden flex flex-col items-center gap-2 text-gray-300">
                                <ImageIcon className="h-10 w-10" />
                                <span className="text-[10px] font-bold uppercase tracking-tighter">Sem Foto</span>
                             </div>

                             {/* Hover Overlay */}
                             <div className="absolute inset-0 bg-pink-600/0 group-hover:bg-pink-600/20 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                                <Upload className="h-8 w-8 text-white drop-shadow-md" />
                             </div>

                             {/* Uploading State */}
                             {isUploading && (
                               <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                                 <Loader2 className="h-8 w-8 animate-spin text-pink-600" />
                               </div>
                             )}
                          </div>
                       </label>
                       
                       <div className="text-center mt-3">
                          <h4 className="font-black text-gray-900 text-sm uppercase truncate max-w-[150px]">{m.nome.split(' ')[0]}</h4>
                          <p className="text-[10px] font-bold text-gray-400 uppercase">47 Anos</p>
                       </div>
                    </div>
                  );
                })}

                {getBirthdays.length === 0 && (
                  <div className="col-span-full py-20 flex flex-col items-center justify-center text-gray-300 border-2 border-dashed border-gray-100 rounded-3xl">
                     <ImageIcon className="h-16 w-16 mb-4" />
                     <p className="font-bold text-sm">Nenhum aniversariante selecionado</p>
                  </div>
                )}
              </div>

              <div className="mt-12 pt-6 border-t border-gray-100 text-center">
                 <p className="text-[9px] text-gray-300 font-bold tracking-widest uppercase flex items-center justify-center gap-2">
                    <RefreshCw className="h-3 w-3 animate-spin-slow" /> Esta área será capturada e convertida em imagem
                 </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const RefreshCw = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>
);
