import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { CalendarHeart, Copy, Download, Upload, Image as ImageIcon, CheckCircle2, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import html2canvas from 'html2canvas';

interface Member {
  id: string;
  nome: string;
  apelido: string;
  nascimento: string;
  pai: string;
  mae: string;
  grupos_caseiros: string;
  foto_url?: string;
}

export default function Birthdays() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  type FilterType = 'hoje' | 'amanha' | 'mes' | 'especifico';
  const [filter, setFilter] = useState<FilterType>('hoje');
  const [specificDate, setSpecificDate] = useState<string>('');
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const collageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchBirthdays();
  }, [filter, specificDate]);

  const fetchBirthdays = async () => {
    setLoading(true);
    try {
      // Puxar todos os membros ativos que têm data de nascimento
      const { data, error } = await supabase
        .from('membros')
        .select('id, nome, apelido, nascimento, pai, mae, grupos_caseiros')
        .eq('status', 'Ativo')
        .not('nascimento', 'is', null);

      if (error) throw error;

      const today = new Date();
      const currentMonth = today.getMonth() + 1;
      const currentDay = today.getDate();

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomMonth = tomorrow.getMonth() + 1;
      const tomDay = tomorrow.getDate();

      let filtered = data?.filter(m => {
        if (!m.nascimento) return false;
        // Tenta parsear a data (AAAA-MM-DD ou DD/MM/AAAA)
        let bDay, bMonth;
        if (m.nascimento.includes('-')) {
          const parts = m.nascimento.split('-');
          if (parts.length >= 3) {
            bDay = parseInt(parts[2], 10);
            bMonth = parseInt(parts[1], 10);
          }
        } else if (m.nascimento.includes('/')) {
          const parts = m.nascimento.split('/');
          if (parts.length >= 2) {
            bDay = parseInt(parts[0], 10);
            bMonth = parseInt(parts[1], 10);
          }
        } else {
           // Tenta ler como date object
           const d = new Date(m.nascimento);
           if (!isNaN(d.getTime())) {
              bDay = d.getDate();
              bMonth = d.getMonth() + 1;
           }
        }

        if (!bDay || !bMonth) return false;

        if (filter === 'hoje') {
          return bDay === currentDay && bMonth === currentMonth;
        } else if (filter === 'amanha') {
          return bDay === tomDay && bMonth === tomMonth;
        } else if (filter === 'especifico' && specificDate) {
          const specParts = specificDate.split('-');
          if (specParts.length >= 3) {
            const specDay = parseInt(specParts[2], 10);
            const specMonth = parseInt(specParts[1], 10);
            return bDay === specDay && bMonth === specMonth;
          }
          return false;
        } else {
          // 'mes' or 'especifico' without date yet
          if (filter === 'especifico' && !specificDate) return false;
          return bMonth === currentMonth;
        }
      }) || [];

      // Agora busca as fotos no bucket "avatars"
      const { data: filesData } = await supabase.storage.from('avatars').list();
      
      const membersWithPhotos = filtered.map(m => {
        // Verifica se existe um arquivo com o ID do membro
        const hasPhoto = filesData?.some(f => f.name.startsWith(m.id));
        let foto_url = undefined;
        if (hasPhoto) {
          const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(`${m.id}.jpg`);
          // Adiciona um timestamp para forçar atualização de cache caso troque a foto
          foto_url = `${publicUrlData.publicUrl}?t=${new Date().getTime()}`;
        }
        return { ...m, foto_url };
      });

      setMembers(membersWithPhotos);
    } catch (error) {
      console.error('Erro ao buscar aniversariantes:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateAge = (birthDateString: string) => {
    let d;
    if (birthDateString.includes('/')) {
       const [day, month, year] = birthDateString.split('/');
       d = new Date(`${year}-${month}-${day}T12:00:00Z`);
    } else {
       d = new Date(birthDateString);
    }
    
    if (isNaN(d.getTime())) return 0;
    
    const today = new Date();
    let age = today.getFullYear() - d.getFullYear();
    const m = today.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < d.getDate())) {
        age--;
    }
    return age;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, memberId: string) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingId(memberId);
    setUploadError(null);

    try {
      // Padroniza como JPG no path para não acumular lixo
      const filePath = `${memberId}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true, cacheControl: '0' });

      if (uploadError) {
         // Se o bucket não existir, ele dá erro. Vamos tentar criar o bucket se não existir?
         // O cliente precisa ter criado o bucket `avatars` no painel como público.
         throw uploadError;
      }

      // Recarrega a lista
      fetchBirthdays();
    } catch (error: any) {
      console.error('Erro no upload:', error);
      setUploadError(error.message || 'Erro ao fazer upload da imagem. O bucket "avatars" existe e é público?');
      setTimeout(() => setUploadError(null), 8000);
    } finally {
      setUploadingId(null);
    }
  };

  const generateMessageText = () => {
    if (members.length === 0) return '';

    let label = 'hoje';
    if (filter === 'amanha') label = 'amanhã';
    else if (filter === 'mes') label = 'deste mês';
    else if (filter === 'especifico' && specificDate) {
       const [_, m, d] = specificDate.split('-');
       label = `do dia ${d}/${m}`;
    }

    let text = `Bom dia,\n\nOs aniversariantes ${label} são:\n`;

    members.forEach(m => {
      const age = calculateAge(m.nascimento);
      const isChild = age < 12;
      const gcText = m.grupos_caseiros ? `- GC ${m.grupos_caseiros}` : '';
      const maePai = [];
      if (m.pai) maePai.push(m.pai.split(' ')[0]);
      if (m.mae) maePai.push(m.mae.split(' ')[0]);
      
      let parentText = '';
      if (isChild && maePai.length > 0) {
         parentText = `- pais ${maePai.join(' e ')} `;
      }

      // Regra de exibição
      if (isChild) {
         text += `*${m.nome.toUpperCase()}/${age} anos* ${parentText}${gcText}\n`;
      } else {
         const displayName = m.apelido || m.nome.split(' ')[0];
         text += `*${m.nome.toUpperCase()}* (@${displayName}) ${gcText} 🌷\n`;
      }
    });

    text += `\nParabéns!! Deus abençoe vocês!! 🥳🥳🎂🎉🎊\n\n`;
    text += `_"Este é o dia com que nos presenteou o SENHOR: festejemos e regozijemo-nos nele!" (Salmos 118:24)_`;

    return text;
  };

  const copyToClipboard = () => {
    const text = generateMessageText();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const downloadCollage = async () => {
    if (!collageRef.current) return;
    setGenerating(true);

    try {
      // Esconde botões de upload temporariamente
      const uploadButtons = collageRef.current.querySelectorAll('.no-print');
      uploadButtons.forEach(el => (el as HTMLElement).style.display = 'none');

      const canvas = await html2canvas(collageRef.current, {
        useCORS: true,
        scale: 2, // Maior resolução
        backgroundColor: '#ffffff',
      });

      // Restaura botões
      uploadButtons.forEach(el => (el as HTMLElement).style.display = '');

      const image = canvas.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      link.download = `aniversariantes-${filter}-${new Date().toISOString().split('T')[0]}.png`;
      link.href = image;
      link.click();
    } catch (error) {
      console.error('Erro ao gerar colagem:', error);
      alert('Houve um erro ao gerar a imagem. Tente novamente.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700 max-w-5xl mx-auto pb-12 px-4">
      <header className="mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-50 text-pink-700 text-sm font-semibold mb-3 border border-pink-100">
          <CalendarHeart className="w-4 h-4" /> Secretariado
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Aniversariantes</h1>
        <p className="mt-2 text-sm text-gray-500">Gere as mensagens e colagens de fotos automaticamente.</p>
      </header>

      {/* Alerta caso bucket não exista */}
      {uploadError && (
         <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-200 flex items-start gap-3 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5"/>
            <div>
               <strong className="block font-bold">Erro de Armazenamento</strong>
               {uploadError}
               <br/><br/>
               <em className="text-xs">Para corrigir, acesse o painel do Supabase {'>'} Storage {'>'} Crie um bucket público chamado "avatars".</em>
            </div>
         </div>
      )}

      {/* Tabs / Filters */}
      <div className="flex border-b border-gray-100 gap-6">
        <button 
          onClick={() => setFilter('hoje')}
          className={`pb-4 font-bold text-sm border-b-2 transition-all ${filter === 'hoje' ? "border-pink-600 text-pink-600" : "border-transparent text-gray-400 hover:text-gray-600"}`}
        >
          Aniversariantes de Hoje
        </button>
        <button 
          onClick={() => setFilter('amanha')}
          className={`pb-4 font-bold text-sm border-b-2 transition-all ${filter === 'amanha' ? "border-pink-600 text-pink-600" : "border-transparent text-gray-400 hover:text-gray-600"}`}
        >
          Amanhã
        </button>
        <button 
          onClick={() => setFilter('mes')}
          className={`pb-4 font-bold text-sm border-b-2 transition-all ${filter === 'mes' ? "border-pink-600 text-pink-600" : "border-transparent text-gray-400 hover:text-gray-600"}`}
        >
          Todo o Mês
        </button>
        <div className="flex items-center gap-2 pb-4">
           <button 
             onClick={() => setFilter('especifico')}
             className={`font-bold text-sm transition-all ${filter === 'especifico' ? "text-pink-600" : "text-gray-400 hover:text-gray-600"}`}
           >
             Data Específica:
           </button>
           {filter === 'especifico' && (
              <input 
                 type="date" 
                 value={specificDate}
                 onChange={(e) => setSpecificDate(e.target.value)}
                 className="text-sm border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
              />
           )}
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-gray-400">
          <Loader2 className="w-8 h-8 animate-spin mb-4" />
          <p>Buscando aniversariantes...</p>
        </div>
      ) : members.length === 0 ? (
        <div className="py-20 text-center bg-gray-50 rounded-3xl border border-gray-100 border-dashed">
          <CalendarHeart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-900 mb-1">Nenhum aniversariante</h3>
          <p className="text-gray-500 text-sm">Não há aniversários registrados para o período selecionado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Lado Esquerdo: Mensagem e Controles */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
               <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between">
                  <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                     <CalendarHeart className="w-4 h-4 text-pink-500"/>
                     Mensagem Automática
                  </h3>
                  <button 
                     onClick={copyToClipboard}
                     className="flex items-center gap-1.5 text-xs font-bold text-primary-600 hover:text-primary-800 transition-colors bg-primary-50 px-3 py-1.5 rounded-lg"
                  >
                     {copied ? <CheckCircle2 className="w-3 h-3"/> : <Copy className="w-3 h-3"/>}
                     {copied ? 'Copiado!' : 'Copiar Texto'}
                  </button>
               </div>
               <div className="p-4 bg-white whitespace-pre-wrap font-mono text-xs leading-relaxed text-gray-700">
                  {generateMessageText()}
               </div>
            </div>

            <div className="bg-pink-50 border border-pink-100 rounded-xl p-4">
               <h4 className="font-bold text-pink-900 text-sm mb-2 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4"/> 
                  Exportação de Imagem
               </h4>
               <p className="text-xs text-pink-700 mb-4">
                  O painel ao lado gera um mosaico automático com as fotos de todos os aniversariantes. Se alguém estiver sem foto, você pode fazer o upload clicando no card da pessoa.
               </p>
               <button 
                  onClick={downloadCollage}
                  disabled={generating}
                  className="w-full flex justify-center items-center gap-2 bg-pink-600 hover:bg-pink-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-sm transition-all disabled:opacity-70 disabled:cursor-not-allowed"
               >
                  {generating ? <Loader2 className="w-4 h-4 animate-spin"/> : <Download className="w-4 h-4"/>}
                  {generating ? 'Gerando Imagem...' : 'Baixar Colagem Final'}
               </button>
            </div>
          </div>

          {/* Lado Direito: A Colagem Canvas */}
          <div className="lg:col-span-7">
             <div className="bg-gray-100 rounded-3xl p-6 border border-gray-200 overflow-x-auto">
               <div 
                  ref={collageRef}
                  className="bg-white p-8 mx-auto w-full max-w-2xl rounded-2xl shadow-sm flex flex-col items-center justify-center min-h-[400px]"
               >
                  {/* Cabeçalho da Imagem */}
                  <div className="text-center mb-8">
                     <h2 className="text-3xl font-black text-gray-900 tracking-tight">Aniversariantes</h2>
                     <p className="text-lg font-medium text-pink-500 uppercase tracking-widest mt-1">Parabéns!</p>
                  </div>

                  {/* Grid de Fotos (Ajuste automático) */}
                  <div className={`grid gap-4 w-full ${members.length === 1 ? 'grid-cols-1 max-w-sm' : members.length === 2 ? 'grid-cols-2' : members.length === 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-3'}`}>
                     {members.map(member => (
                        <div key={member.id} className="flex flex-col items-center relative group">
                           {/* Container da Foto */}
                           <div className="w-full aspect-square rounded-2xl overflow-hidden bg-gray-100 border-2 border-gray-100 relative shadow-sm mb-3 group-hover:border-pink-200 transition-colors">
                              {member.foto_url ? (
                                 <img 
                                    src={member.foto_url} 
                                    alt={member.nome}
                                    className="w-full h-full object-cover"
                                    crossOrigin="anonymous" // Necessário para o html2canvas ler a imagem
                                 />
                              ) : (
                                 <div className="w-full h-full flex flex-col items-center justify-center text-gray-300">
                                    <ImageIcon className="w-12 h-12 mb-2 opacity-50"/>
                                    <span className="text-[10px] uppercase font-bold tracking-wider">Sem Foto</span>
                                 </div>
                              )}

                              {/* Botão de Upload (Invisível no print) */}
                              <div className="no-print absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                 <label className="cursor-pointer bg-white text-gray-900 text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-1.5 hover:bg-pink-50 hover:text-pink-600 transition-colors">
                                    {uploadingId === member.id ? <Loader2 className="w-3 h-3 animate-spin"/> : <Upload className="w-3 h-3"/>}
                                    {uploadingId === member.id ? 'Enviando...' : 'Trocar Foto'}
                                    <input 
                                       type="file" 
                                       accept="image/*" 
                                       className="hidden" 
                                       onChange={(e) => handleFileUpload(e, member.id)}
                                       disabled={uploadingId === member.id}
                                    />
                                 </label>
                              </div>
                           </div>
                           
                           <h3 className="text-sm font-bold text-gray-900 text-center leading-tight">
                              {member.apelido || member.nome.split(' ')[0]}
                           </h3>
                           <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mt-0.5">
                              {calculateAge(member.nascimento)} anos
                           </p>
                        </div>
                     ))}
                  </div>

                  <div className="mt-8 pt-6 border-t border-gray-100 w-full text-center no-print">
                     <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold flex items-center justify-center gap-1">
                        <RefreshCw className="w-3 h-3"/> Esta área será capturada e convertida em imagem
                     </p>
                  </div>
               </div>
             </div>
          </div>

        </div>
      )}
    </div>
  );
}
