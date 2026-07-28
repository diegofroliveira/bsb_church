import React, { useEffect, useState, useMemo, useRef } from 'react';
import { supabase, supabaseReader } from '../lib/supabase';
import { filterOperationalMembers } from '../lib/operationalScope';
import { matchesPopulationMode, type PopulationMode } from '../lib/populationScope';
import { PopulationFlags } from '../components/PopulationFlags';
import { 
  Calendar, 
  Copy, 
  Download, 
  Image as ImageIcon, 
  Loader2, 
  Upload,
  AlertCircle,
  AlertTriangle,
  Lock,
  Check,
  X,
  Eye,
  EyeOff,
  Trash2
} from 'lucide-react';
import { toPng } from 'html-to-image';
import clsx from 'clsx';

const formatName = (fullName: string) => {
  if (!fullName) return '';
  const parts = fullName.trim().split(' ');
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]}` : parts[0];
};

const getFirstName = (fullName: string) => {
  if (!fullName) return '';
  const parts = fullName.trim().replace(/\s+/g, ' ').split(' ');
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];

  const firstWord = parts[0].toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const secondWord = parts[1].toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const compoundStarters = new Set([
    'MARIA', 'ANA', 'ANNA', 'JOAO', 'JOSE', 'CARLOS', 'PEDRO', 'LUIZ', 'LUIS', 
    'PAULO', 'MARCOS', 'MARCO', 'FRANCISCO', 'JULIO', 'VICTOR', 'VITOR'
  ]);

  const compoundSeconds = new Set([
    'ANTONIO', 'AUGUSTO', 'CESAR', 'EDUARDO', 'FELIPE', 'GABRIEL', 'HENRIQUE', 
    'JOAO', 'JORGE', 'JOSE', 'LUCAS', 'MANOEL', 'MIGUEL', 'OTAVIO', 'PEDRO', 
    'VITOR', 'VICTOR', 'VINICIUS', 'ALICE', 'BEATRIZ', 'CLARA', 'CRISTINA', 
    'EDUARDA', 'HELENA', 'INES', 'JULIA', 'LARA', 'LIZ', 'LUIZA', 'REGINA', 
    'RITA', 'ROSA', 'SOPHIA', 'TERESA', 'THEREZA', 'VALENTINA'
  ]);

  if (compoundStarters.has(firstWord) && compoundSeconds.has(secondWord)) {
    return `${parts[0]} ${parts[1]}`;
  }

  return parts[0];
};

const formatGCName = (gcName?: string): string => {
  if (!gcName) return 'Sem GC';
  let name = gcName.trim();
  if (name.toUpperCase() === 'NENHUM' || name === '') return 'Sem GC';
  
  // Remove BSB prefix (case-insensitive, followed by spaces, hyphens, or underscores)
  name = name.replace(/^BSB[\s\-_]+/i, '');
  
  return `GC ${name}`;
};

const toTitleCase = (str: string): string => {
  if (!str) return '';
  const trimmed = str.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
};

interface Member {
  id: any;
  nome: string;
  nascimento: string;
  grupos_caseiros?: string;
  avatar_url?: string;
  sexo?: string;
  estado_civil?: string;
  status?: string;
  pai?: string;
  mae?: string;
  celular_principal_sms?: string;
  cidade?: string;
  tipo_de_pessoa?: string;
  tipo_cadastro?: string;
}

export const Birthdays: React.FC = () => {
  const [members, setMembers] = useState<Member[]>([]);
  const [, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{id: any, status: 'idle' | 'uploading' | 'success' | 'error'}>({id: null, status: 'idle'});
  const [customNames, setCustomNames] = useState<Record<any, { 
    msgName: string; 
    photoName: string; 
    zoom?: number; 
    xOffset?: number; 
    yOffset?: number; 
  }>>({});
  const [storageError, setStorageError] = useState<string | null>(null);
  const [excludedMemberIds, setExcludedMemberIds] = useState<Set<any>>(new Set());

  const toggleExcludeMember = (memberId: any) => {
    setExcludedMemberIds(prev => {
      const next = new Set(prev);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
  };

  const handleDeletePhoto = async (memberId: any) => {
    if (!window.confirm('Deseja realmente remover a foto deste membro? O cadastro voltará a exibir a inicial do nome.')) return;
    setUploadStatus({ id: memberId, status: 'uploading' });
    try {
      const { error: dbError } = await supabase
        .from('membros')
        .update({ foto: null })
        .eq('id', memberId);

      if (dbError) throw dbError;

      const filePath = `avatars/${memberId}.jpg`;
      await supabase.storage.from('avatars').remove([filePath]);

      setAvatarCacheBuster(Date.now());
      fetchMembers();
      setUploadStatus({ id: memberId, status: 'success' });
      setTimeout(() => setUploadStatus({ id: null, status: 'idle' }), 3000);
    } catch (err: any) {
      console.error('Error deleting photo:', err);
      setUploadStatus({ id: memberId, status: 'error' });
      alert(`Erro ao excluir foto: ${err.message}`);
    }
  };

  const handleUpdateCustomName = (memberId: any, field: 'msgName' | 'photoName' | 'zoom' | 'xOffset' | 'yOffset', value: any) => {
    setCustomNames(prev => {
      const current = prev[memberId] || { 
        msgName: getFirstName(members.find(m => m.id === memberId)?.nome ?? ''), 
        photoName: getFirstName(members.find(m => m.id === memberId)?.nome ?? ''),
        zoom: 1.0,
        xOffset: 50,
        yOffset: 50
      };
      return {
        ...prev,
        [memberId]: {
          ...current,
          [field]: value
        }
      };
    });
  };
  const collageRef = useRef<HTMLDivElement>(null);

  const [filterMode, setFilterMode] = useState<'today' | 'tomorrow' | 'month' | 'specific'>('today');
  const [draggedOverMemberId, setDraggedOverMemberId] = useState<any>(null);
  const [avatarCacheBuster, setAvatarCacheBuster] = useState<number>(Date.now());
  const [specificDate, setSpecificDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [filterGender, setFilterGender] = useState('Todos');
  const [filterGC, setFilterGC] = useState('Todos');
  const [filterMinAge, setFilterMinAge] = useState<number>(0);
  const [filterMaxAge, setFilterMaxAge] = useState<number>(120);
  const [filterMaritalStatus, setFilterMaritalStatus] = useState('Todos');
  const [populationMode, setPopulationMode] = useState<PopulationMode>('todos');

  const [editedMessage, setEditedMessage] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showWarningBlock, setShowWarningBlock] = useState(false);

  const getStorageKey = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    return `birthday_msg_${filterMode}_${filterMode === 'specific' ? specificDate : todayStr}`;
  };

  useEffect(() => {
    const key = getStorageKey();
    const saved = localStorage.getItem(key);
    if (saved) {
      setEditedMessage(saved);
    } else {
      setEditedMessage(null);
    }
    setIsEditMode(false);
    setShowConfirmModal(false);
    setShowWarningBlock(false);
  }, [filterMode, specificDate]);

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    setIsLoading(true);
    setStorageError(null);
    try {
      const { data, error } = await supabase
        .from('membros')
        .select('id, nome, nascimento, grupos_caseiros, sexo, estado_civil, status, pai, mae, celular_principal_sms, cidade, tipo_de_pessoa, tipo_cadastro')
        .limit(10000);

      if (error) throw error;
      setMembers(filterOperationalMembers(data || []));
      
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
    }
  };

  const calculateAge = (dob: string) => {
    if (!dob) return -1;
    let parts = dob.includes('/') ? dob.split('/') : dob.split('-');
    const birth = dob.includes('/') ? new Date(Number(parts[2]), Number(parts[1])-1, Number(parts[0])) : new Date(dob);
    if (isNaN(birth.getTime())) return -1;
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--;
    return age;
  };

  const getAgeRange = (age: number) => {
    if (age < 0) return 'Indefinida';
    if (age <= 12) return '0-12';
    if (age <= 17) return '13-17';
    if (age <= 25) return '18-25';
    if (age <= 35) return '26-35';
    if (age <= 45) return '36-45';
    if (age <= 60) return '46-60';
    return '60+';
  };

  const uniqueGCs = useMemo(() => Array.from(new Set(members.map(m => m.grupos_caseiros).filter(Boolean))).sort(), [members]);
  const uniqueMaritalStatuses = useMemo(() => Array.from(new Set(members.map(m => m.estado_civil).filter(Boolean))).sort(), [members]);

  const getBirthdays = useMemo(() => {
    const now = new Date();
    const todayDay = now.getDate();
    const todayMonth = now.getMonth() + 1;
    
    const tomorrow = new Date();
    tomorrow.setDate(now.getDate() + 1);
    const tomorrowDay = tomorrow.getDate();
    const tomorrowMonth = tomorrow.getMonth() + 1;
    
    const currentMonth = now.getMonth() + 1;

    return members.filter(m => {
      if (!matchesPopulationMode(m, populationMode)) return false;
      if (m.status !== 'Ativo') return false;
      if (!m.nascimento) return false;

      const isExterno = (m.tipo_de_pessoa || '').trim().toUpperCase() === 'EXTERNO' || (m.tipo_cadastro || '').trim().toUpperCase() === 'EXTERNO';
      if (isExterno) return false;
      
      let day: number, month: number;
      if (m.nascimento.includes('/')) {
        const parts = m.nascimento.split('/');
        if (parts.length < 2) return false;
        day = parseInt(parts[0]);
        month = parseInt(parts[1]);
      } else if (m.nascimento.includes('-')) {
        const parts = m.nascimento.split('-');
        if (parts.length < 2) return false;
        if (parts[0].length === 4) {
          day = parseInt(parts[2]);
          month = parseInt(parts[1]);
        } else {
          month = parseInt(parts[0]);
          day = parseInt(parts[1]);
        }
      } else {
        return false;
      }

      if (isNaN(day) || isNaN(month)) return false;

      if (filterGender !== 'Todos' && m.sexo !== filterGender) return false;
      if (filterGC !== 'Todos' && m.grupos_caseiros !== filterGC) return false;
      if (filterMaritalStatus !== 'Todos' && m.estado_civil !== filterMaritalStatus) return false;
      
      const age = calculateAge(m.nascimento);
      if (age < filterMinAge || age > filterMaxAge) return false;

      let matchDate = false;
      if (filterMode === 'today') {
        matchDate = day === todayDay && month === todayMonth;
      } else if (filterMode === 'tomorrow') {
        matchDate = day === tomorrowDay && month === tomorrowMonth;
      } else if (filterMode === 'month') {
        matchDate = month === currentMonth;
      } else if (filterMode === 'specific') {
        let specDay = 0;
        let specMonth = 0;
        
        if (specificDate) {
          const cleanDate = specificDate.trim();
          if (cleanDate.includes('-')) {
            const parts = cleanDate.split('-');
            if (parts.length >= 3) {
              if (parts[0].length === 4) {
                // YYYY-MM-DD
                specDay = parseInt(parts[2], 10);
                specMonth = parseInt(parts[1], 10);
              } else {
                // DD-MM-YYYY or MM-DD-YYYY
                specDay = parseInt(parts[1], 10);
                specMonth = parseInt(parts[0], 10);
              }
            }
          } else if (cleanDate.includes('/')) {
            const parts = cleanDate.split('/');
            if (parts.length >= 3) {
              if (parts[2].length === 4) {
                // DD/MM/YYYY
                specDay = parseInt(parts[0], 10);
                specMonth = parseInt(parts[1], 10);
              } else if (parts[0].length === 4) {
                // YYYY/MM/DD
                specDay = parseInt(parts[2], 10);
                specMonth = parseInt(parts[1], 10);
              }
            }
          }

          if (!specDay || !specMonth || isNaN(specDay) || isNaN(specMonth)) {
            const spec = new Date(cleanDate);
            if (!isNaN(spec.getTime())) {
              if (cleanDate.includes('-')) {
                specDay = spec.getUTCDate();
                specMonth = spec.getUTCMonth() + 1;
              } else {
                specDay = spec.getDate();
                specMonth = spec.getMonth() + 1;
              }
            }
          }
        }
        
        matchDate = day === specDay && month === specMonth;

        if (filterMode === 'specific' && (month === 5 || m.nome.includes('ARTHUR'))) {
          console.log('[DEBUG-SPECIFIC]', {
            nome: m.nome,
            nascimento: m.nascimento,
            calculatedDay: day,
            calculatedMonth: month,
            selectedDate: specificDate,
            specDay,
            specMonth,
            matchDate,
            age: calculateAge(m.nascimento),
            filterMinAge,
            filterMaxAge,
            gender: m.sexo,
            filterGender,
            gc: m.grupos_caseiros,
            filterGC,
            marital: m.estado_civil,
            filterMaritalStatus
          });
        }
      }
      return matchDate;
    }).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [members, populationMode, filterMode, specificDate, filterGender, filterGC, filterMinAge, filterMaxAge, filterMaritalStatus]);

  const birthdayRows = useMemo(() => {
    const activeBirthdays = getBirthdays.filter(m => !excludedMemberIds.has(m.id));
    const total = activeBirthdays.length;
    if (total === 0) return [];
    
    // Determine row sizes
    let rowSizes: number[] = [];
    if (total <= 3) {
      rowSizes = [total];
    } else if (total === 4) {
      rowSizes = [2, 2];
    } else if (total === 5) {
      rowSizes = [3, 2];
    } else if (total === 6) {
      rowSizes = [3, 3];
    } else if (total === 7) {
      rowSizes = [4, 3];
    } else if (total === 8) {
      rowSizes = [4, 4];
    } else {
      // General algorithm for 9+
      let remaining = total;
      while (remaining > 0) {
        if (remaining === 5) {
          rowSizes.push(3, 2);
          break;
        }
        if (remaining === 6) {
          rowSizes.push(3, 3);
          break;
        }
        if (remaining === 7) {
          rowSizes.push(4, 3);
          break;
        }
        const take = Math.min(4, remaining);
        rowSizes.push(take);
        remaining -= take;
      }
    }

    // Partition activeBirthdays into rows
    const rows: Member[][] = [];
    let index = 0;
    for (const size of rowSizes) {
      rows.push(activeBirthdays.slice(index, index + size));
      index += size;
    }
    return rows;
  }, [getBirthdays, excludedMemberIds]);

  const generateAutomaticMessage = () => {
    const activeBirthdays = getBirthdays.filter(m => !excludedMemberIds.has(m.id));
    if (activeBirthdays.length === 0) return "Nenhum aniversariante encontrado.";
    
    const names = activeBirthdays.map(m => {
      const age = calculateAge(m.nascimento);
      const isExterno = (m.tipo_de_pessoa || '').trim().toUpperCase() === 'EXTERNO' || (m.tipo_cadastro || '').trim().toUpperCase() === 'EXTERNO';
      const citySuffix = isExterno && m.cidade ? ` (${m.cidade})` : '';
      const gcText = formatGCName(m.grupos_caseiros) + citySuffix;
      
      const customMsgName = customNames[m.id]?.msgName;
      const firstName = (customMsgName !== undefined ? customMsgName : getFirstName(m.nome)).trim().toUpperCase();

      const flower = m.sexo === 'Feminino' ? ' 🌷' : '';

      if (age >= 0 && age <= 15) {
        // Até 15 anos: Nome, idade, pais e GC
        const genderWord = m.sexo === 'Feminino' ? 'Filha' : m.sexo === 'Masculino' ? 'Filho' : 'Filho(a)';
        
        let parentsText = '';
        const father = m.pai?.trim();
        const mother = m.mae?.trim();
        
        if (father && mother) {
          parentsText = ` - ${genderWord} de ${getFirstName(father).toUpperCase()} e ${getFirstName(mother).toUpperCase()}`;
        } else if (father) {
          parentsText = ` - ${genderWord} de ${getFirstName(father).toUpperCase()}`;
        } else if (mother) {
          parentsText = ` - ${genderWord} de ${getFirstName(mother).toUpperCase()}`;
        }

        return `*${firstName}* (${age} anos)${parentsText} - ${gcText}${flower}`;
      } else {
        // Depois dos 15 anos: Nome, @mention (se tem telefone) e GC
        const hasPhone = m.celular_principal_sms && m.celular_principal_sms.trim() !== '';
        const mention = hasPhone ? ` (@${toTitleCase(firstName)})` : '';
        return `*${firstName}*${mention} - ${gcText}${flower}`;
      }
    }).join('\n');
    
    const isPlural = activeBirthdays.length > 1;
    const isFemale = !isPlural && activeBirthdays[0]?.sexo === 'Feminino';
    
    let timeLabel = "de hoje";
    if (filterMode === 'tomorrow') {
      timeLabel = "de amanhã";
    } else if (filterMode === 'month') {
      timeLabel = "do mês";
    } else if (filterMode === 'specific') {
      timeLabel = "da data selecionada";
    }

    const greeting = isPlural 
      ? `Os aniversariantes ${timeLabel} são:` 
      : (isFemale ? `A aniversariante ${timeLabel} é:` : `O aniversariante ${timeLabel} é:`);
    const blessing = isPlural ? "Deus abençoe vocês!!" : "Deus abençoe você!!";
    
    return `Bom dia,\n\n${greeting}\n${names}\n\nParabéns!! ${blessing} 🥳 🎂 🎊 🥂 🎇\n\n_"Este é o dia com que nos presenteou o SENHOR: festejemos e regozijemo-nos nele!" (Salmos 118:24)_`;
  };

  const generateMessage = () => {
    if (editedMessage !== null) {
      return editedMessage;
    }
    return generateAutomaticMessage();
  };

  const handleStartEdit = () => {
    const savedDatesStr = localStorage.getItem('edited_birthday_dates');
    const savedDates = savedDatesStr ? JSON.parse(savedDatesStr) : [];
    const todayStr = new Date().toISOString().split('T')[0];

    // Filter to only include dates from the current month
    const now = new Date();
    const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const currentMonthDates = savedDates.filter((d: string) => d.startsWith(currentMonthPrefix));

    if (currentMonthDates.length >= 10 && !currentMonthDates.includes(todayStr)) {
      setShowWarningBlock(true);
      return;
    }

    setShowConfirmModal(true);
  };

  const handleConfirmEdit = () => {
    setShowConfirmModal(false);
    if (editedMessage === null) {
      setEditedMessage(generateAutomaticMessage());
    }
    setIsEditMode(true);
  };

  const handleSaveEdit = () => {
    if (editedMessage !== null) {
      const key = getStorageKey();
      localStorage.setItem(key, editedMessage);

      const todayStr = new Date().toISOString().split('T')[0];
      const savedDatesStr = localStorage.getItem('edited_birthday_dates');
      const savedDates = savedDatesStr ? JSON.parse(savedDatesStr) : [];

      // Clean up dates older than current month when saving, to keep localStorage tidy
      const now = new Date();
      const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const currentMonthDates = savedDates.filter((d: string) => d.startsWith(currentMonthPrefix));

      if (!currentMonthDates.includes(todayStr)) {
        currentMonthDates.push(todayStr);
        localStorage.setItem('edited_birthday_dates', JSON.stringify(currentMonthDates));
      }
    }
    setIsEditMode(false);
  };

  const handleCancelEdit = () => {
    const key = getStorageKey();
    const saved = localStorage.getItem(key);
    setEditedMessage(saved);
    setIsEditMode(false);
  };

  const handleRestoreDefault = () => {
    if (window.confirm("Deseja realmente restaurar a mensagem automática padrão para este dia?")) {
      const key = getStorageKey();
      localStorage.removeItem(key);
      setEditedMessage(null);
      setIsEditMode(false);
    }
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(generateMessage());
    alert('Mensagem copiada para a área de transferência!');
  };

  const handleDownloadCollage = async () => {
    const activeBirthdays = getBirthdays.filter(m => !excludedMemberIds.has(m.id));
    if (!collageRef.current || activeBirthdays.length === 0) return;
    
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

  const handleUploadFile = async (memberId: any, file: File) => {
    setUploadStatus({ id: memberId, status: 'uploading' });
    try {
      // Force all uploaded photos to be stored as .jpg to align with public URL expectations
      const filePath = `avatars/${memberId}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { 
          upsert: true,
          contentType: file.type
        });

      if (uploadError) throw uploadError;

      // Get the public URL of the uploaded image
      const publicUrl = supabase.storage.from('avatars').getPublicUrl(filePath).data.publicUrl;

      // Update the member profile in the database
      const { error: dbError } = await supabase
        .from('membros')
        .update({ foto: publicUrl })
        .eq('id', memberId);

      if (dbError) throw dbError;

      setAvatarCacheBuster(Date.now());
      fetchMembers();
      setUploadStatus({ id: memberId, status: 'success' });
      setTimeout(() => setUploadStatus({ id: null, status: 'idle' }), 3000);
    } catch (err: any) {
      console.error('Upload error:', err);
      setUploadStatus({ id: memberId, status: 'error' });
      alert(`Erro no upload: ${err.message}`);
    }
  };

  const handleUploadPhoto = async (memberId: any, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    handleUploadFile(memberId, file);
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

      <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-3 items-center">
        <PopulationFlags value={populationMode} onChange={setPopulationMode} className="mr-2" />
        <select value={filterGender} onChange={e => setFilterGender(e.target.value)} className="text-xs border-gray-200 rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-pink-500 bg-gray-50/50">
          <option value="Todos">Todos os Sexos</option>
          <option value="Masculino">Masculino</option>
          <option value="Feminino">Feminino</option>
        </select>
        <select value={filterGC} onChange={e => setFilterGC(e.target.value)} className="text-xs border-gray-200 rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-pink-500 bg-gray-50/50 max-w-[150px]">
          <option value="Todos">Todos os GCs</option>
          {uniqueGCs.map(gc => <option key={gc} value={gc}>{gc}</option>)}
        </select>
        <select value={filterMaritalStatus} onChange={e => setFilterMaritalStatus(e.target.value)} className="text-xs border-gray-200 rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-pink-500 bg-gray-50/50">
          <option value="Todos">Estado Civil</option>
          {uniqueMaritalStatuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="flex items-center gap-2 bg-gray-50/50 border border-gray-200 rounded-lg px-2 py-1">
           <span className="text-[10px] font-bold text-gray-400 uppercase">Idade:</span>
           <input type="number" value={filterMinAge} onChange={e => setFilterMinAge(parseInt(e.target.value) || 0)} className="w-10 bg-transparent text-xs font-semibold outline-none" placeholder="Min" />
           <span className="text-gray-300">/</span>
           <input type="number" value={filterMaxAge} onChange={e => setFilterMaxAge(parseInt(e.target.value) || 120)} className="w-10 bg-transparent text-xs font-semibold outline-none" placeholder="Max" />
        </div>
        {(filterGender !== 'Todos' || filterGC !== 'Todos' || filterMinAge !== 0 || filterMaxAge !== 120 || filterMaritalStatus !== 'Todos') && (
          <button onClick={() => { setFilterGender('Todos'); setFilterGC('Todos'); setFilterMinAge(0); setFilterMaxAge(120); setFilterMaritalStatus('Todos'); }} className="text-[10px] text-red-600 font-bold uppercase hover:underline">Limpar</button>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* Left Column: Text Message */}
        <div className="xl:col-span-4 space-y-6">
          {getBirthdays.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">✍️</span>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">
                    Ajuste Personalizado de Nomes
                  </h3>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    Ajuste os nomes que vão na mensagem do WhatsApp e na foto.
                  </p>
                </div>
              </div>
              
              <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                {getBirthdays.map((m) => {
                  const currentMsgVal = customNames[m.id]?.msgName ?? getFirstName(m.nome);
                  const currentPhotoVal = customNames[m.id]?.photoName ?? getFirstName(m.nome);
                  const avatarUrl = `${supabase.storage.from('avatars').getPublicUrl(`avatars/${m.id}.jpg`).data.publicUrl}?t=${avatarCacheBuster}`;
                  
                  return (
                    <div 
                      key={m.id} 
                      className={clsx(
                        "p-3 rounded-xl border transition-all space-y-2.5",
                        excludedMemberIds.has(m.id) 
                          ? "bg-red-50/20 border-red-100 opacity-60" 
                          : "bg-gray-50/50 border-gray-100"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="h-8 w-8 rounded-full bg-pink-100 overflow-hidden flex items-center justify-center shrink-0 border border-pink-200">
                            <img 
                              src={avatarUrl} 
                              alt={m.nome}
                              className="w-full h-full object-cover animate-none"
                              style={{ 
                                transform: `scale(${customNames[m.id]?.zoom ?? 1.0}) translate(${(customNames[m.id]?.xOffset ?? 50) - 50}%, ${(customNames[m.id]?.yOffset ?? 50) - 50}%)`, 
                                transformOrigin: 'center' 
                              }}
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = '';
                                (e.target as HTMLImageElement).classList.add('hidden');
                                (e.target as HTMLImageElement).parentElement?.querySelector('.fallback-icon')?.classList.remove('hidden');
                              }}
                            />
                            <div className="fallback-icon hidden text-pink-650 font-bold text-xs uppercase">
                              {m.nome.charAt(0)}
                            </div>
                          </div>
                          <div className="min-w-0">
                            <h4 className={clsx("text-xs font-bold text-gray-800 truncate", excludedMemberIds.has(m.id) && "line-through text-gray-400")} title={m.nome}>
                              {m.nome}
                            </h4>
                            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">
                              {m.grupos_caseiros || 'Sem GC'}
                            </p>
                          </div>
                        </div>

                        {/* Card Actions: Hide from Collage & Exclude Photo */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => toggleExcludeMember(m.id)}
                            title={excludedMemberIds.has(m.id) ? "Mostrar na colagem" : "Ocultar da colagem"}
                            className={clsx(
                              "p-1 rounded-lg transition-colors border",
                              excludedMemberIds.has(m.id)
                                ? "bg-red-100 text-red-700 border-red-300 hover:bg-red-200"
                                : "bg-white text-gray-500 border-gray-250 hover:bg-gray-100"
                            )}
                          >
                            {excludedMemberIds.has(m.id) ? (
                              <EyeOff className="h-3.5 w-3.5" />
                            ) : (
                              <Eye className="h-3.5 w-3.5" />
                            )}
                          </button>
                          {m.foto && (
                            <button
                              type="button"
                              onClick={() => handleDeletePhoto(m.id)}
                              title="Excluir foto (voltar para inicial)"
                              className="p-1 rounded-lg bg-white text-gray-500 border border-gray-250 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[8px] font-bold text-gray-400 uppercase mb-0.5 tracking-wider">
                            Na Mensagem
                          </label>
                          <input
                            type="text"
                            value={currentMsgVal}
                            onChange={(e) => handleUpdateCustomName(m.id, 'msgName', e.target.value)}
                            disabled={excludedMemberIds.has(m.id)}
                            className="w-full text-xs bg-white disabled:bg-gray-100 border border-gray-250 rounded-lg px-2 py-1.5 outline-none focus:border-pink-300 focus:ring-1 focus:ring-pink-300/30 transition-all font-medium text-gray-700"
                            placeholder="Nome Msg"
                          />
                        </div>
                        <div>
                          <label className="block text-[8px] font-bold text-gray-400 uppercase mb-0.5 tracking-wider">
                            Na Foto
                          </label>
                          <input
                            type="text"
                            value={currentPhotoVal}
                            onChange={(e) => handleUpdateCustomName(m.id, 'photoName', e.target.value)}
                            disabled={excludedMemberIds.has(m.id)}
                            className="w-full text-xs bg-white disabled:bg-gray-100 border border-gray-250 rounded-lg px-2 py-1.5 outline-none focus:border-pink-300 focus:ring-1 focus:ring-pink-300/30 transition-all font-medium text-gray-700"
                            placeholder="Nome Foto"
                          />
                        </div>
                      </div>

                      {/* Photo Zoom and Crop Adjustments */}
                      {!excludedMemberIds.has(m.id) && (
                        <div className="pt-1.5 space-y-1.5 border-t border-gray-100 mt-1">
                          <div>
                            <label className="block text-[8px] font-bold text-gray-400 uppercase mb-0.5 tracking-wider flex justify-between">
                              <span>Zoom (Escala)</span>
                              <span className="text-pink-650 font-extrabold">{(customNames[m.id]?.zoom ?? 1.0).toFixed(1)}x</span>
                            </label>
                            <input
                              type="range"
                              min="1"
                              max="3"
                              step="0.1"
                              value={customNames[m.id]?.zoom ?? 1.0}
                              onChange={(e) => handleUpdateCustomName(m.id, 'zoom', parseFloat(e.target.value))}
                              className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-pink-600 focus:outline-none"
                            />
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[8px] font-bold text-gray-400 uppercase mb-0.5 tracking-wider flex justify-between">
                                <span>Horizontal (X)</span>
                                <span className="text-pink-650 font-extrabold">{customNames[m.id]?.xOffset ?? 50}%</span>
                              </label>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                value={customNames[m.id]?.xOffset ?? 50}
                                onChange={(e) => handleUpdateCustomName(m.id, 'xOffset', parseInt(e.target.value))}
                                className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-pink-600 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[8px] font-bold text-gray-400 uppercase mb-0.5 tracking-wider flex justify-between">
                                <span>Vertical (Y)</span>
                                <span className="text-pink-650 font-extrabold">{customNames[m.id]?.yOffset ?? 50}%</span>
                              </label>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                value={customNames[m.id]?.yOffset ?? 50}
                                onChange={(e) => handleUpdateCustomName(m.id, 'yOffset', parseInt(e.target.value))}
                                className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-pink-600 focus:outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
             <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                   <ImageIcon className="h-4 w-4 text-pink-500" /> Mensagem Automática
                </h3>
                <div className="flex items-center gap-1.5">
                  {isEditMode ? (
                    <>
                      <button 
                        onClick={handleSaveEdit}
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 hover:bg-emerald-50 px-2 py-1 rounded border border-emerald-100 transition-colors uppercase"
                      >
                         Salvar
                      </button>
                      <button 
                        onClick={handleCancelEdit}
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 hover:bg-red-50 px-2 py-1 rounded border border-red-100 transition-colors uppercase"
                      >
                         Cancelar
                      </button>
                    </>
                  ) : (
                    <>
                      <button 
                        onClick={handleStartEdit}
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-pink-600 hover:bg-pink-50 px-2 py-1 rounded border border-pink-100 transition-colors uppercase"
                      >
                         Editar
                      </button>
                      {editedMessage !== null && (
                        <button 
                          onClick={handleRestoreDefault}
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:bg-slate-50 px-2 py-1 rounded border border-slate-100 transition-colors uppercase"
                          title="Restaurar mensagem automática padrão"
                        >
                           Padrão
                        </button>
                      )}
                      <button 
                        onClick={handleCopyText}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                      >
                         <Copy className="h-3 w-3" /> Copiar
                      </button>
                    </>
                  )}
                </div>
             </div>
             {isEditMode ? (
               <textarea
                 value={editedMessage ?? generateAutomaticMessage()}
                 onChange={e => setEditedMessage(e.target.value)}
                 className="w-full h-64 bg-gray-50 rounded-xl p-4 text-xs text-gray-750 font-mono leading-relaxed border border-pink-200 outline-none focus:ring-1 focus:ring-pink-500 resize-y"
                 placeholder="Digite sua mensagem personalizada aqui..."
               />
             ) : (
               <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-600 font-mono whitespace-pre-wrap leading-relaxed border border-gray-100">
                  {generateMessage()}
               </div>
             )}
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
            <div className="max-w-3xl mx-auto">
              <div 
                ref={collageRef}
                className="bg-white rounded-2xl shadow-xl p-10 w-full"
              >
              <div className="text-center mb-10">
                <h2 className="text-4xl font-black text-gray-900 tracking-tight">
                  {birthdayRows.flat().length === 1 ? "Aniversariante" : "Aniversariantes"}
                </h2>
                <p className="text-pink-500 font-bold tracking-widest text-sm mt-2 uppercase">Parabéns!</p>
              </div>

              <div className="space-y-6">
                {birthdayRows.map((row, rowIndex) => (
                  <div key={rowIndex} className="flex flex-wrap justify-center gap-6">
                    {row.map((m) => {
                      const avatarUrl = `${supabase.storage.from('avatars').getPublicUrl(`avatars/${m.id}.jpg`).data.publicUrl}?t=${avatarCacheBuster}`;
                      const isUploading = uploadStatus.id === m.id && uploadStatus.status === 'uploading';
                      const rowLength = row.length;
                      const itemWidthClass = 
                        rowLength === 1 ? "w-full max-w-[240px]" : 
                        rowLength === 2 ? "w-full max-w-[220px] sm:w-[220px]" : 
                        rowLength === 3 ? "w-full max-w-[180px] sm:w-[180px]" : 
                        "w-full max-w-[144px] sm:w-[144px]";
                      
                      return (
                        <div key={m.id} className={clsx("flex flex-col items-center group relative", itemWidthClass)}>
                           <label 
                              className="cursor-pointer block w-full"
                              onDragOver={(e) => {
                                e.preventDefault();
                                setDraggedOverMemberId(m.id);
                              }}
                              onDragLeave={(e) => {
                                e.preventDefault();
                                setDraggedOverMemberId(null);
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                setDraggedOverMemberId(null);
                                const file = e.dataTransfer.files?.[0];
                                if (file && file.type.startsWith('image/')) {
                                  handleUploadFile(m.id, file);
                                }
                              }}
                           >
                              <input 
                                type="file" 
                                accept="image/*" 
                                className="hidden" 
                                onChange={(e) => handleUploadPhoto(m.id, e)}
                              />
                              <div className={clsx(
                                "aspect-square w-full rounded-2xl bg-gray-50 border-2 border-dashed flex items-center justify-center overflow-hidden relative group-hover:border-pink-300 transition-colors",
                                draggedOverMemberId === m.id ? "border-pink-500 bg-pink-50/30" : "border-gray-200"
                              )}>
                                 <img 
                                    src={avatarUrl} 
                                    alt={m.nome}
                                    className="w-full h-full object-cover animate-none"
                                    style={{ 
                                      transform: `scale(${customNames[m.id]?.zoom ?? 1.0}) translate(${(customNames[m.id]?.xOffset ?? 50) - 50}%, ${(customNames[m.id]?.yOffset ?? 50) - 50}%)`, 
                                      transformOrigin: 'center' 
                                    }}
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
                           
                           <div className="text-center mt-3 w-full">
                                <h4 className="font-black text-gray-900 text-sm uppercase truncate max-w-[150px] mx-auto">
                                  {customNames[m.id]?.photoName || getFirstName(m.nome)}
                                </h4>
                                 <p className="text-[10px] font-bold text-gray-400 uppercase truncate">
                                   {(() => {
                                     const age = calculateAge(m.nascimento);
                                     const hasGC = m.grupos_caseiros && m.grupos_caseiros.trim() !== '' && m.grupos_caseiros.trim().toUpperCase() !== 'NENHUM';
                                     const isExterno = (m.tipo_de_pessoa || '').trim().toUpperCase() === 'EXTERNO' || (m.tipo_cadastro || '').trim().toUpperCase() === 'EXTERNO';
                                     const citySuffix = isExterno && m.cidade ? ` (${m.cidade})` : '';
                                     const gcText = hasGC 
                                       ? `${formatGCName(m.grupos_caseiros)}${citySuffix}` 
                                       : (isExterno && m.cidade ? m.cidade : '');
                                     
                                     if (age >= 0 && age <= 15) {
                                       return `${age} Anos${gcText ? ` • ${gcText}` : ''}`;
                                     } else {
                                       return gcText;
                                     }
                                   })()}
                                 </p>
                           </div>
                        </div>
                      );
                    })}
                  </div>
                ))}

                {getBirthdays.length === 0 && (
                  <div className="py-20 flex flex-col items-center justify-center text-gray-300 border-2 border-dashed border-gray-100 rounded-3xl w-full">
                     <ImageIcon className="h-16 w-16 mb-4" />
                     <p className="font-bold text-sm">Nenhum aniversariante selecionado</p>
                  </div>
                )}
              </div>

              </div>

              <div className="mt-4 text-center">
                 <p className="text-[10px] text-gray-400 font-bold tracking-widest uppercase flex items-center justify-center gap-2">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin-slow text-gray-400" /> A área branca acima será capturada e convertida em imagem
                 </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Modal: Confirmação de Edição ── */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-4 mb-5">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">Confirmar edição da mensagem</h2>
                <p className="text-sm text-gray-500 mt-1">Antes de prosseguir, precisamos confirmar uma coisa.</p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mb-5">
              <p className="text-sm text-amber-800 leading-relaxed">
                Você já conversou com o administrador sobre a alteração que deseja fazer na mensagem?
              </p>
              <p className="text-xs text-amber-600 mt-2 italic">
                Lembre-se: edições manuais são exceções pontuais. Se a mudança for recorrente, o ideal é atualizar a lógica padrão com o administrador.
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                <X className="h-4 w-4" /> Não, cancelar
              </button>
              <button
                onClick={handleConfirmEdit}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-pink-600 hover:bg-pink-700 transition-colors shadow-md shadow-pink-200"
              >
                <Check className="h-4 w-4" /> Sim, já falei — editar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Bloqueio por excesso de edições ── */}
      {showWarningBlock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-4 mb-5">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <Lock className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">Limite de edições atingido</h2>
                <p className="text-sm text-gray-500 mt-1">A mensagem foi editada manualmente em 10 ou mais dias distintos no mesmo mês.</p>
              </div>
            </div>

            <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-5">
              <p className="text-sm text-red-800 leading-relaxed font-medium">
                ⚠️ Atenção, secretária!
              </p>
              <p className="text-sm text-red-700 mt-2 leading-relaxed">
                Percebemos que você tem editado a mensagem de aniversariantes com frequência. Isso é um sinal de que algo na <strong>lógica padrão</strong> precisa ser atualizado — e não a mensagem em si.
              </p>
              <p className="text-sm text-red-700 mt-2 leading-relaxed">
                Ficar "remendando" manualmente todo dia não é a solução ideal. Por favor, <strong>fale com o administrador do sistema</strong> para que a regra seja ajustada de forma definitiva. Assim, o trabalho fica mais fácil para todo mundo! 😊
              </p>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowWarningBlock(false)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors"
              >
                <Check className="h-4 w-4" /> Entendido — falarei com o admin
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const RefreshCw = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>
);
