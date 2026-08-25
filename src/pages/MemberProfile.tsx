import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase, supabaseReader, rawGet } from '../lib/supabase';
import { 
  ArrowLeft, User, Phone, MapPin, Mail, Calendar, Users, Heart, 
  Wallet, BookOpen, Activity, Loader2, Award, FileText, Briefcase,
  Key, ShieldCheck, Plus, Trash2, X, CheckCircle2, Shield, CalendarCheck, Map, HelpCircle, Eye, Edit3, Upload
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../context/AuthContext';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { ImageCropperModal } from '../components/ImageCropperModal';

// Fix leaflet default icon path issues in React
const DefaultIcon = L.icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

interface MemberData {
  id: number;
  nome: string;
  apelido?: string;
  nascimento: string;
  telefone_fixo: string;
  celular_principal_sms: string;
  email: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep?: string;
  cpf?: string;
  status: string;
  tipo_cadastro: string;
  grupos_caseiros: string;
  data_de_cadastro: string;
  data_de_vinculo?: string;
  setor_eclesiastico?: string;
  setor_residencial?: string;
  sexo?: string;
  estado_civil?: string;
  foto?: string;
  pai?: string;
  mae?: string;
  e_dizimista?: string | boolean;
  latitude?: string | number | null;
  longitude?: string | number | null;
}

interface Relative {
  id: number;
  nome: string;
  parentesco: string;
  mesmoDomicilio: string;
  status: string;
  sexo: string;
  nascimento: string | null;
  foto: string | null;
}

interface HistoryItem {
  id_serial: number;
  ocorrencia: string;
  data: string;
  anotacao: string | null;
  grupo_caseiro: string | null;
}

const calculateAge = (birthDateString: string | null): number | string => {
  if (!birthDateString) return '-';
  const birthDate = new Date(birthDateString);
  if (isNaN(birthDate.getTime())) return '-';
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '-';
  try {
    const parts = dateStr.includes('/') ? dateStr.split('/') : dateStr.split('-');
    if (dateStr.includes('/')) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  } catch {
    return dateStr;
  }
};

const normalizeStr = (s: string | null | undefined): string => {
  if (!s) return '';
  return s.trim().replace(/\s+/g, ' ').toUpperCase();
};

const DEFAULT_ROLES: Record<string, string[]> = {
  admin: ['Dashboard', 'Aniversariantes', 'Mapa', 'Membros', 'Famílias', 'GCs/Localidades', 'Setores', 'Discipulado', 'Rede', 'Relatórios', 'QA', 'Financeiro', 'Consultor IA', 'Insights IA', 'Configurações', 'Simulações', 'Companheirismo', 'Lab: Visão da Plenitude', 'Lab: Gestão de Visitas', 'Lab: Consultas & Estudos'],
  pastor: ['Dashboard', 'Aniversariantes', 'Mapa', 'Membros', 'Famílias', 'GCs/Localidades', 'Setores', 'Discipulado', 'Rede', 'Relatórios', 'QA', 'Financeiro', 'Consultor IA', 'Insights IA', 'Simulações', 'Companheirismo', 'Lab: Visão da Plenitude', 'Lab: Gestão de Visitas', 'Lab: Consultas & Estudos'],
  secretaria: ['Dashboard', 'Aniversariantes', 'Membros', 'Famílias', 'GCs/Localidades', 'Discipulado', 'Rede', 'Relatórios', 'QA', 'Consultor IA'],
  financeiro: ['Dashboard', 'Financeiro']
};

export const MemberProfile: React.FC = () => {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const hasFinanceAccess = (() => {
    if (!user) return false;
    const userRole = user.role;
    if (userRole === 'admin' || userRole === 'pastor' || userRole === 'financeiro') {
      return true;
    }
    
    try {
      const stored = localStorage.getItem('church_dynamic_roles');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed[userRole]) {
          const modules = parsed[userRole].modules || [];
          return modules.includes('Financeiro');
        }
      }
    } catch (_) {}

    const defaultModules = DEFAULT_ROLES[userRole] || [];
    return defaultModules.includes('Financeiro');
  })();
  
  const [member, setMember] = useState<MemberData | null>(null);
  const [discipuladores, setDiscipuladores] = useState<string[]>([]);
  const [discipulos, setDiscipulos] = useState<string[]>([]);
  const [cellInfo, setCellInfo] = useState<any>(null);
  const [finance, setFinance] = useState<any[]>([]);
  const [relatives, setRelatives] = useState<Relative[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPhotoUploading, setIsPhotoUploading] = useState(false);
  const [isAvatarOpen, setIsAvatarOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);

  // Expanded tabs list
  const [activeTab, setActiveTab] = useState<
    'dados_gerais' | 'familiares' | 'funcoes' | 'historico' | 'eventos' | 'financeiro' | 'acessos' | 'lgpd' | 'cuidados' | 'geolocalizacao'
  >('dados_gerais');

  // Converted JSON data variables
  const [cellsParticipations, setCellsParticipations] = useState<any[]>([]);
  const [pessoasFuncoes, setPessoasFuncoes] = useState<any[]>([]);
  const [localidadesParticipations, setLocalidadesParticipations] = useState<any[]>([]);
  const [eventosInscricoes, setEventosInscricoes] = useState<any[]>([]);

  // Interactive Card Modals
  const [activeModal, setActiveModal] = useState<'grupos_caseiros' | 'rede' | 'discipulado' | 'localidades' | null>(null);

  // Write occurrences states
  const [showAddOccModal, setShowAddOccModal] = useState(false);
  const [isSubmittingOcc, setIsSubmittingOcc] = useState(false);
  const [newOcc, setNewOcc] = useState({
    ocorrencia: 'DATA DE VÍNCULO',
    data: new Date().toISOString().split('T')[0],
    anotacao: '',
    grupo_caseiro: ''
  });

  // Pastoral note states
  const [careNotes, setCareNotes] = useState<string[]>([]);
  const [newCareNote, setNewCareNote] = useState('');

  // LGPD consent state
  const [lgpdConsent, setLgpdConsent] = useState<{ accepted: boolean; date?: string }>({ accepted: false });

  // Mocks/Visual controls for Acessos & Funções
  const [allowAppLogin, setAllowAppLogin] = useState(true);
  const [allowFinanceAccess, setAllowFinanceAccess] = useState(false);
  const [accessProfile, setAccessProfile] = useState('Membro Geral');
  const [customRoles, setCustomRoles] = useState<any[]>([]);
  const [showAddRoleModal, setShowAddRoleModal] = useState(false);
  const [newRole, setNewRole] = useState({ funcao: '', data_inicio: new Date().toISOString().split('T')[0], situacao: 'Ativo' });

  // Edit vinculo modal state
  const [showVinculoModal, setShowVinculoModal] = useState(false);
  const [vinculoForm, setVinculoForm] = useState({
    grupos_caseiros: '',
    setor_eclesiastico: '',
    status: '',
    data_de_vinculo: ''
  });
  const [isSavingVinculo, setIsSavingVinculo] = useState(false);
  const [vinculoSaveSuccess, setVinculoSaveSuccess] = useState(false);

  useEffect(() => {
    if (!name) return;

    const fetchProfile = async () => {
      setIsLoading(true);
      try {
        const decodedName = decodeURIComponent(name);
        
        // 1. Fetch Member (Support search by ID if parameters are numeric)
        const isNumeric = /^\d+$/.test(decodedName);
        let memberQuery = supabaseReader.from('membros').select('*');
        if (isNumeric) {
          memberQuery = memberQuery.eq('id', parseInt(decodedName));
        } else {
          memberQuery = memberQuery.ilike('nome', `%${decodedName}%`);
        }
        const { data: memberData } = await memberQuery.limit(1);

        if (!memberData || memberData.length === 0) {
           setMember(null);
           setIsLoading(false);
           return;
        }

        const m = memberData[0];
        setMember(m);

        const normName = normalizeStr(m.nome);

        // Fetch auxiliary data — rawGet usado APENAS para pessoas_familiares (RLS fix)
        // Demais tabelas usam supabaseReader normalmente
        const primeiroNome = m.nome.split(' ')[0];
        const [discRes, cellRes, finRes, relsRes, histRes, cellsJson, funcoesJson, locsJson, evJson] = await Promise.all([
          supabaseReader.from('discipulado').select('*'),
          m.grupos_caseiros ? supabaseReader.from('celulas').select('*') : Promise.resolve({ data: null }),
          hasFinanceAccess 
            ? supabaseReader.from('financeiro').select('*').ilike('pessoa_lancamento', `%${primeiroNome}%`).limit(100)
            : Promise.resolve({ data: [] } as any),
          rawGet('pessoas_familiares', `select=*&or=(id_pessoa_a.eq.${m.id},id_pessoa_b.eq.${m.id})`),
          supabaseReader.from('pessoas_historico').select('*').eq('id_pessoa', m.id).order('data', { ascending: false }),
          // Static files
          fetch('/data/celulas_participantes.json').then(r => r.ok ? r.json() : []).catch(() => []),
          fetch('/data/pessoas_funcoes.json').then(r => r.ok ? r.json() : []).catch(() => []),
          fetch('/data/localidade_participantes.json').then(r => r.ok ? r.json() : []).catch(() => []),
          fetch('/data/eventos_inscricoes.json').then(r => r.ok ? r.json() : []).catch(() => [])
        ]);

        // Discipleship parsing
        if (discRes.data) {
          const myDiscipuladores = discRes.data
              .filter(d => normalizeStr(d.discipulo) === normName)
              .map(d => d.discipulador);
          const myDiscipulos = discRes.data
              .filter(d => normalizeStr(d.discipulador) === normName)
              .map(d => d.discipulo);
              
          setDiscipuladores(myDiscipuladores);
          setDiscipulos(myDiscipulos);
        }

        // Cell info mapping
        if (cellRes.data && m.grupos_caseiros) {
          const myCell = cellRes.data.find(c => normalizeStr(c.grupo_caseiro) === normalizeStr(m.grupos_caseiros));
          setCellInfo(myCell || null);
        } else {
          setCellInfo(null);
        }

        // Finance mapping
        if (finRes.data) {
          const myFin = finRes.data.filter(f => normalizeStr(f.pessoa_lancamento) === normName);
          setFinance(myFin);
        } else {
          setFinance([]);
        }

        // History logs mapping
        if (histRes.data) {
          setHistory(histRes.data as HistoryItem[]);
        } else {
          setHistory([]);
        }

        // Relatives mapping — usando objetos simples (evita new Map que o minificador do Vercel renomeia para 'UI')
        console.log('[DEBUG] relsRes:', JSON.stringify({ data: relsRes.data?.length, error: relsRes.error }));
        try {
          if (relsRes.data && relsRes.data.length > 0) {
            const rawRels: any[] = relsRes.data;

            // Deduplicate relationships by relative ID, preferring direct (isA === true)
            // Using plain object instead of new Map() to avoid Vercel minifier bug
            const relsByRelativeId: Record<number, any> = {};
            rawRels.forEach((r: any) => {
              const relId = Number(r.id_pessoa_a) === Number(m.id) ? Number(r.id_pessoa_b) : Number(r.id_pessoa_a);
              const isA = Number(r.id_pessoa_a) === Number(m.id);
              if (!relsByRelativeId[relId] || isA) {
                relsByRelativeId[relId] = r;
              }
            });

            const uniqueRelsList = Object.entries(relsByRelativeId).map(([relIdStr, r]) => {
              const relId = Number(relIdStr);
              const isA = Number(r.id_pessoa_a) === Number(m.id);
              return {
                id: relId,
                nome: isA ? r.pessoa_b : r.pessoa_a,
                rawParentesco: r.parentesco || 'Familiar',
                mesmoDomicilio: r.mesmo_domicilio || 'Não',
                isDirect: isA
              };
            });

            // Fetch extra fields of these relatives via rawGet (bypass SDK auth)
            const relIds = uniqueRelsList.map(r => r.id);
            const relIdsParam = relIds.map(id => `id.eq.${id}`).join(',');
            console.log('[DEBUG] fetching relMembers for', relIds.length, 'relatives');
            const { data: relMembers, error: relMembersError } = await rawGet('membros', `select=id,status,sexo,nascimento,foto&or=(${relIdsParam})`);
            console.log('[DEBUG] relMembers:', relMembers?.length, 'error:', relMembersError);

            // Build lookup using plain object instead of new Map()
            const relDetailsById: Record<number, any> = {};
            (relMembers || []).forEach((rm: any) => { relDetailsById[rm.id] = rm; });

            const invertParentesco = (parentesco: string, relativeGender: string): string => {
              const p = parentesco.trim();
              if (p === 'Mãe' || p === 'Pai') return 'Filho(a)';
              if (p === 'Filho(a)') return relativeGender === 'Feminino' ? 'Mãe' : 'Pai';
              if (p === 'Sogro(a)') return 'Genro / Nora';
              if (p === 'Genro / Nora') return 'Sogro(a)';
              if (p === 'Tio(a)') return 'Sobrinho(a)';
              if (p === 'Sobrinho(a)') return 'Tio(a)';
              return p;
            };

            const enrichedRels = uniqueRelsList.map(r => {
              const details = relDetailsById[r.id];
              const sexo = details?.sexo || 'Desconhecido';

              let parentesco = r.rawParentesco;
              if (!r.isDirect) {
                parentesco = invertParentesco(parentesco, sexo);
              }

              return {
                id: r.id,
                nome: r.nome,
                parentesco,
                mesmoDomicilio: r.mesmoDomicilio,
                status: details?.status || 'Inativo',
                sexo,
                nascimento: details?.nascimento || null,
                foto: details?.foto || null
              };
            });
            console.log('[DEBUG] enrichedRels count:', enrichedRels.length);
            // Ordenar: mesmo domicílio primeiro, cônjuges acima de outros, depois alfabético
            const isSpouseParentesco = (p: string): boolean => {
              const norm = (p || '').trim().toUpperCase();
              return norm.includes('CÔNJUGE') || 
                     norm.includes('CONJUGE') || 
                     norm.includes('ESPOSA') || 
                     norm.includes('ESPOSO') || 
                     norm.includes('MARIDO') || 
                     norm.includes('COMPANHEIR');
            };

            const getPriority = (rel: any): number => {
              const isSameHome = rel.mesmoDomicilio === 'Sim';
              const isSpouse = isSpouseParentesco(rel.parentesco);
              if (isSameHome) {
                return isSpouse ? 0 : 1;
              } else {
                return isSpouse ? 2 : 3;
              }
            };

            enrichedRels.sort((a, b) => {
              const aPri = getPriority(a);
              const bPri = getPriority(b);
              if (aPri !== bPri) return aPri - bPri;
              return a.nome.localeCompare(b.nome, 'pt-BR');
            });
            setRelatives(enrichedRels);

          } else {
            setRelatives([]);
          }
        } catch (relsError: any) {
          console.error('[DEBUG] Relatives processing error:', relsError?.message, relsError?.stack);
          setRelatives([]);
        }



        // Static datasets filtering - use loose equality == for ID comparison
        const myId = m.id;
        const myCells = cellsJson.filter((c: any) => 
          Number(c.id_pessoa) === Number(myId) || (c.pessoa && normalizeStr(c.pessoa) === normName)
        );
        const myFuncoes = funcoesJson.filter((f: any) => 
          Number(f.id_pessoa) === Number(myId) || (f.pessoa && normalizeStr(f.pessoa) === normName)
        );
        const myLocs = locsJson.filter((l: any) => 
          Number(l.id_pessoa) === Number(myId) || (l.pessoa && normalizeStr(l.pessoa) === normName)
        );
        const myEvents = evJson.filter((e: any) => 
          Number(e.id_pessoa) === Number(myId) || (e.pessoa && normalizeStr(e.pessoa) === normName)
        );

        setCellsParticipations(myCells);
        setPessoasFuncoes(myFuncoes);
        setLocalidadesParticipations(myLocs);
        setEventosInscricoes(myEvents);

        // Load LGPD local states
        const consentStored = localStorage.getItem(`lgpd_consent_${m.id}`);
        if (consentStored) {
          setLgpdConsent(JSON.parse(consentStored));
        } else {
          setLgpdConsent({ accepted: false });
        }

        // Load Pastoral notes local states
        const notesStored = localStorage.getItem(`cuidado_notas_${m.id}`);
        if (notesStored) {
          setCareNotes(JSON.parse(notesStored));
        } else {
          setCareNotes([
            "Demonstra compromisso com a vida espiritual e as reuniões do GC.",
            "Visita pastoral domiciliar realizada recentemente."
          ]);
        }

      } catch (error) {
        console.error('Error fetching member profile:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [name]);

  // Visual/Mock configurations for App roles based on fetched values
  useEffect(() => {
    if (member) {
      if (member.status !== 'Ativo') {
        setAccessProfile('Sem Acesso');
        setAllowAppLogin(false);
      } else if (member.tipo_cadastro === 'Pastor' || member.nome.toLowerCase().includes('diego de freitas')) {
        setAccessProfile('Pastor / Administrador');
        setAllowAppLogin(true);
        setAllowFinanceAccess(true);
      } else if (member.grupos_caseiros && cellInfo && (cellInfo.lider === member.nome || cellInfo.auxiliar === member.nome)) {
        setAccessProfile('Líder de Célula');
        setAllowAppLogin(true);
      } else {
        setAccessProfile('Membro Geral');
        setAllowAppLogin(true);
      }
    }
  }, [member, cellInfo]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !member) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCropImageSrc(reader.result);
      }
    };
    reader.readAsDataURL(file);
    // Reset file input so same file can be selected again
    e.target.value = '';
  };

  const handleCropComplete = async (file: File) => {
    if (!member) return;
    setCropImageSrc(null);
    setIsPhotoUploading(true);
    try {
      const filePath = `avatars/${member.id}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { 
          upsert: true,
          contentType: file.type
        });

      if (uploadError) throw uploadError;

      // Get public url
      const publicUrl = `${supabase.storage.from('avatars').getPublicUrl(filePath).data.publicUrl}?t=${Date.now()}`;

      // Update Database
      const { error: dbError } = await supabase
        .from('membros')
        .update({ foto: publicUrl })
        .eq('id', member.id);

      if (dbError) throw dbError;

      // Update local state
      setMember(prev => prev ? { ...prev, foto: publicUrl } : null);
      alert('Foto atualizada com sucesso!');
    } catch (err: any) {
      console.error('Error uploading photo:', err);
      alert(`Erro ao carregar a foto: ${err.message}`);
    } finally {
      setIsPhotoUploading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!member) {
    return (
      <div className="flex flex-col h-[80vh] items-center justify-center space-y-4">
        <User className="w-16 h-16 text-gray-300" />
        <h2 className="text-xl font-bold text-gray-700">Membro não encontrado</h2>
        <button onClick={() => navigate(-1)} className="text-primary-600 hover:underline">Voltar</button>
      </div>
    );
  }

  const formatCurrency = (val: string | number) => {
    const num = typeof val === 'string' ? parseFloat(val.replace(',', '.')) || 0 : val;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
  };

  const telefone = member.celular_principal_sms || member.telefone_fixo || 'Não informado';
  const endereco = [member.logradouro, member.bairro, member.cidade, member.estado, member.cep].filter(Boolean).join(', ') || 'Endereço não informado';

  const menuItems = [
    { id: 'dados_gerais', label: 'Dados Gerais', icon: User },
    { id: 'familiares', label: 'Familiares', icon: Users },
    { id: 'funcoes', label: 'Funções', icon: Briefcase },
    { id: 'historico', label: 'Históricos e Protocolos', icon: FileText },
    { id: 'eventos', label: 'Eventos e Ensinos', icon: Calendar },
    { id: 'financeiro', label: 'Dados Financeiros', icon: Wallet },
    { id: 'acessos', label: 'Acessos', icon: Key },
    { id: 'lgpd', label: 'LGPD', icon: ShieldCheck },
    { id: 'cuidados', label: 'Cuidados', icon: Heart },
    { id: 'geolocalizacao', label: 'Geolocalização', icon: MapPin }
  ] as const;

  // Insert occurrence handler
  const handleAddOccurrence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOcc.ocorrencia || !newOcc.data) return;
    setIsSubmittingOcc(true);
    try {
      const payload = {
        id_pessoa: member.id,
        pessoa: member.nome,
        ocorrencia: newOcc.ocorrencia,
        data: newOcc.data,
        anotacao: newOcc.anotacao || null,
        grupo_caseiro: newOcc.grupo_caseiro || null,
        celular_principal_sms: member.celular_principal_sms || null,
        email: member.email || null
      };

      const { error } = await supabase.from('pessoas_historico').insert([payload]);
      if (error) throw error;

      // Refresh list
      const { data: refreshedData } = await supabase
        .from('pessoas_historico')
        .select('*')
        .eq('id_pessoa', member.id)
        .order('data', { ascending: false });

      if (refreshedData) {
        setHistory(refreshedData as HistoryItem[]);
      }

      setShowAddOccModal(false);
      setNewOcc({ ocorrencia: 'DATA DE VÍNCULO', data: new Date().toISOString().split('T')[0], anotacao: '', grupo_caseiro: '' });
    } catch (err) {
      console.error('Error inserting occurrence:', err);
      alert('Erro ao registrar ocorrência: ' + (err as any).message);
    } finally {
      setIsSubmittingOcc(false);
    }
  };

  // Add care note handler
  const handleAddCareNote = () => {
    if (!newCareNote.trim()) return;
    const updated = [newCareNote.trim(), ...careNotes];
    setCareNotes(updated);
    localStorage.setItem(`cuidado_notas_${member.id}`, JSON.stringify(updated));
    setNewCareNote('');
  };

  // Delete care note handler
  const handleDeleteCareNote = (index: number) => {
    const updated = careNotes.filter((_, i) => i !== index);
    setCareNotes(updated);
    localStorage.setItem(`cuidado_notas_${member.id}`, JSON.stringify(updated));
  };

  // Register LGPD consent handler
  const handleRegisterLgpd = () => {
    const newConsent = { accepted: true, date: new Date().toLocaleString('pt-BR') };
    setLgpdConsent(newConsent);
    localStorage.setItem(`lgpd_consent_${member.id}`, JSON.stringify(newConsent));
  };

  // Revoke LGPD consent
  const handleRevokeLgpd = () => {
    const newConsent = { accepted: false };
    setLgpdConsent(newConsent);
    localStorage.setItem(`lgpd_consent_${member.id}`, JSON.stringify(newConsent));
  };

  // Add custom local role/function
  const handleAddRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRole.funcao) return;
    const updated = [...customRoles, newRole];
    setCustomRoles(updated);
    setShowAddRoleModal(false);
    setNewRole({ funcao: '', data_inicio: new Date().toISOString().split('T')[0], situacao: 'Ativo' });
  };

  const getCombinedRoles = () => {
    // 1. Roles loaded from CSV
    const roles = pessoasFuncoes.map(f => ({
      funcao: f.funcao || 'Cargo',
      data_inicio: f.data_inicio || '-',
      situacao: f.situacao || 'Ativo',
      source: 'prover'
    }));

    // 2. Add dynamic cell leader role if they are the leader in 'celulas'
    if (member.grupos_caseiros && cellInfo) {
      if (normalizeStr(cellInfo.lider) === normalizeStr(member.nome)) {
        roles.unshift({
          funcao: `LÍDER DE GRUPO CASEIRO (${cellInfo.grupo_caseiro})`,
          data_inicio: member.data_de_vinculo || member.data_de_cadastro || '-',
          situacao: 'Ativo',
          source: 'cell'
        });
      }
      if (normalizeStr(cellInfo.auxiliar) === normalizeStr(member.nome) || 
          normalizeStr(cellInfo.auxiliar_1) === normalizeStr(member.nome) || 
          normalizeStr(cellInfo.auxiliar_2) === normalizeStr(member.nome)) {
        roles.unshift({
          funcao: `AUXILIAR DE GRUPO CASEIRO (${cellInfo.grupo_caseiro})`,
          data_inicio: member.data_de_vinculo || member.data_de_cadastro || '-',
          situacao: 'Ativo',
          source: 'cell'
        });
      }
    }

    // 3. User roles created in this session (custom roles)
    customRoles.forEach(r => {
      roles.unshift({
        ...r,
        source: 'local'
      });
    });

    return roles;
  };

  // Financial statistics
  const totalContributed = finance.reduce((sum, f) => {
    const val = typeof f.valor === 'string' ? parseFloat(f.valor.replace(',', '.')) || 0 : f.valor;
    return sum + val;
  }, 0);
  const avgContribution = finance.length ? totalContributed / finance.length : 0;

  const handleOpenVinculoModal = () => {
    setVinculoForm({
      grupos_caseiros: member.grupos_caseiros || '',
      setor_eclesiastico: member.setor_eclesiastico || '',
      status: member.status || '',
      data_de_vinculo: member.data_de_vinculo ? member.data_de_vinculo.split('T')[0] : ''
    });
    setVinculoSaveSuccess(false);
    setShowVinculoModal(true);
  };

  const handleSaveVinculo = async () => {
    if (!member) return;
    setIsSavingVinculo(true);
    try {
      const payload: Record<string, any> = {};
      if (vinculoForm.grupos_caseiros !== (member.grupos_caseiros || '')) payload.grupos_caseiros = vinculoForm.grupos_caseiros || null;
      if (vinculoForm.setor_eclesiastico !== (member.setor_eclesiastico || '')) payload.setor_eclesiastico = vinculoForm.setor_eclesiastico || null;
      if (vinculoForm.status !== (member.status || '')) payload.status = vinculoForm.status;
      if (vinculoForm.data_de_vinculo !== (member.data_de_vinculo?.split('T')[0] || '')) payload.data_de_vinculo = vinculoForm.data_de_vinculo || null;

      if (Object.keys(payload).length === 0) {
        setShowVinculoModal(false);
        return;
      }

      const { error } = await supabase.from('membros').update(payload).eq('id', member.id);
      if (error) throw error;

      setMember(prev => prev ? { ...prev, ...payload } : null);
      setVinculoSaveSuccess(true);
      setTimeout(() => setShowVinculoModal(false), 1500);
    } catch (err: any) {
      alert('Erro ao salvar: ' + err.message);
    } finally {
      setIsSavingVinculo(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-7xl mx-auto pb-20">
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-2 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>

      {/* Profile Header Banner */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-150 overflow-hidden">
        <div className="h-32 bg-gradient-to-r from-primary-600 via-primary-700 to-indigo-800"></div>
        <div className="px-6 sm:px-10 pb-8">
           <div className="relative flex flex-col md:flex-row justify-between items-start md:items-end -mt-12 mb-6 gap-4">
              <div className="h-24 w-24 bg-white rounded-2xl p-1 shadow-md shrink-0 relative group">
                 <div 
                   onClick={() => setIsAvatarOpen(true)}
                   className="h-full w-full bg-gray-100 rounded-xl flex items-center justify-center text-gray-400 overflow-hidden border border-gray-100 cursor-pointer relative block"
                 >
                    <img 
                      src={member.foto || `https://vadufkgbluisdamgkbln.supabase.co/storage/v1/object/public/avatars/avatars/${member.id}.jpg`} 
                      alt="" 
                      className="w-full h-full object-cover member-profile-img" 
                      onError={(e) => {
                        (e.target as HTMLImageElement).classList.add('hidden');
                        (e.target as HTMLImageElement).parentElement?.querySelector('.profile-fallback-icon')?.classList.remove('hidden');
                      }}
                    />
                    <div className="profile-fallback-icon hidden flex items-center justify-center">
                      <User className="w-10 h-10 text-gray-300" />
                    </div>
                    
                    {/* Hover Overlay with options */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      {/* Zoom Button */}
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsAvatarOpen(true);
                        }}
                        className="p-1.5 bg-white/20 hover:bg-white/40 rounded-lg text-white transition-colors cursor-pointer"
                        title="Visualizar foto"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {/* Edit/Upload Button */}
                      <label 
                        htmlFor="member-profile-photo-upload" 
                        onClick={(e) => e.stopPropagation()} 
                        className="p-1.5 bg-white/20 hover:bg-white/40 rounded-lg text-white transition-colors cursor-pointer"
                        title="Atualizar foto"
                      >
                        <Upload className="w-4 h-4" />
                      </label>
                    </div>

                    {/* Loader */}
                    {isPhotoUploading && (
                      <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                        <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                      </div>
                    )}
                 </div>
                 
                 <input 
                   type="file" 
                   id="member-profile-photo-upload" 
                   accept="image/*" 
                   className="hidden" 
                   onChange={handlePhotoUpload} 
                 />
              </div>
              <div className="flex flex-wrap gap-2">
                 <span className={clsx("px-3 py-1 rounded-full text-xs font-bold border shadow-sm uppercase tracking-wide", 
                    member.status === 'Ativo' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200')}>
                    {member.status || 'Desconhecido'}
                 </span>
                 <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 shadow-sm uppercase tracking-wide">
                    {member.tipo_cadastro || 'Membro'}
                 </span>
                 {hasFinanceAccess && (member.e_dizimista === 'Sim' || member.e_dizimista === true) ? (
                   <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm uppercase tracking-wide flex items-center gap-1">
                     💰 Dizimista
                   </span>
                 ) : null}
              </div>
           </div>

           <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                 <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight">{member.nome}</h1>
                 {member.apelido && <p className="text-sm font-semibold text-gray-500 mt-1">Conhecido(a) como: <span className="text-primary-600">{member.apelido}</span></p>}
                 <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-gray-400 text-xs font-medium mt-2">
                    <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-gray-300" /> Criado em {member.data_de_cadastro ? formatDate(member.data_de_cadastro) : 'Data desconhecida'}</span>
                    <span className="text-gray-300">•</span>
                    <span className="flex items-center gap-1.5"><Award className="w-3.5 h-3.5 text-gray-300" /> ID Cadastro: {member.id}</span>
                    <span className="text-gray-300">•</span>
                    <span className="font-semibold text-amber-600">
                      {lgpdConsent.accepted ? "✓ LGPD Autorizado" : "✗ Não possui LGPD registrado."}
                    </span>
                 </div>
              </div>
              
              {/* Prover Action Buttons styling */}
              <div className="flex flex-wrap gap-2 text-xs">
                <button
                  onClick={handleOpenVinculoModal}
                  className="border border-primary-500 text-primary-700 bg-primary-50 px-3 py-1.5 rounded-lg hover:bg-primary-100 font-bold tracking-wide transition-colors text-center shrink-0 flex items-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Editar Vínculo
                </button>
                <a 
                  href={`https://sis.sistemaprover.com.br/pt-BR/cadastro/${member.id}/dados`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border border-amber-500 text-amber-600 px-3 py-1.5 rounded-lg hover:bg-amber-50 font-bold tracking-wide transition-colors text-center shrink-0"
                >
                  Editar Cadastro
                </a>
                <a 
                  href={`https://sis.sistemaprover.com.br/pt-BR/cadastro/${member.id}/dados`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border border-amber-500 text-amber-600 px-3 py-1.5 rounded-lg hover:bg-amber-50 font-bold tracking-wide transition-colors text-center shrink-0"
                >
                  Inativar Cadastro
                </a>
                <a 
                  href={`https://sis.sistemaprover.com.br/pt-BR/cadastro/${member.id}/documento`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border border-amber-500 text-amber-600 px-3 py-1.5 rounded-lg hover:bg-amber-50 font-bold tracking-wide transition-colors text-center shrink-0"
                >
                  Documentos
                </a>
                <a 
                  href={`https://sis.sistemaprover.com.br/pt-BR/cadastro/${member.id}/dados`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border border-amber-500 text-amber-600 px-3 py-1.5 rounded-lg hover:bg-amber-50 font-bold tracking-wide transition-colors text-center shrink-0"
                >
                  Ficha de Cadastro
                </a>
                <a 
                  href={`https://sis.sistemaprover.com.br/pt-BR/cadastro/${member.id}/historico-e-protocolo`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border border-amber-500 text-amber-600 px-3 py-1.5 rounded-lg hover:bg-amber-50 font-bold tracking-wide transition-colors text-center shrink-0"
                >
                  Principais Ocorrências
                </a>
              </div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
         {/* Left Navigation Sidebar */}
          <div className="bg-white rounded-3xl shadow-sm border border-gray-150 p-4 space-y-1">
             <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 mb-2">Abas do Cadastro</span>
             {menuItems.filter(item => item.id !== 'financeiro' || hasFinanceAccess).map(item => {
               const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={clsx(
                    "w-full flex items-center gap-3 px-3 py-3 text-xs font-bold rounded-xl text-left transition-all duration-200 cursor-pointer",
                    isActive 
                      ? "bg-primary-50 text-primary-700 shadow-sm ring-1 ring-primary-100" 
                      : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
                  )}
                >
                  <Icon className={clsx("w-4.5 h-4.5 shrink-0", isActive ? "text-primary-600" : "text-gray-400")} />
                  {item.label}
                </button>
              );
            })}
         </div>

         {/* Right Details Panel */}
         <div className="lg:col-span-3">
            {activeTab === 'dados_gerais' && (
              <div className="space-y-6">
                <div className="bg-white rounded-3xl shadow-sm border border-gray-150 p-6 sm:p-8 space-y-6">
                  <div className="border-b border-gray-100 pb-3 flex justify-between items-center">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Identificação Geral</h3>
                      <p className="text-xs text-gray-400 mt-0.5">Informações de contato e dados pessoais.</p>
                    </div>
                    {hasFinanceAccess && member.e_dizimista === 'Sim' && (
                      <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold border border-emerald-100 flex items-center gap-1 animate-pulse">
                        ⭐ Contribuinte Ativo
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                    {/* Identificação */}
                    <div className="space-y-3 bg-gray-50/50 p-5 rounded-2xl border border-gray-100/50">
                      <h4 className="text-xs font-black text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5"><User className="w-4 h-4 text-gray-400" /> Dados Pessoais</h4>
                      <div>
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Data de Nascimento</span>
                        <span className="text-sm font-semibold text-gray-850">{formatDate(member.nascimento)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Idade</span>
                        <span className="text-sm font-semibold text-gray-850">{calculateAge(member.nascimento)} anos</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Sexo / Gênero</span>
                        <span className="text-sm font-semibold text-gray-850">{member.sexo || 'Não informado'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Estado Civil</span>
                        <span className="text-sm font-semibold text-gray-850">{member.estado_civil || 'Não informado'}</span>
                      </div>
                      {member.pai && (
                        <div>
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Pai</span>
                          <span className="text-sm font-semibold text-gray-850">{member.pai}</span>
                        </div>
                      )}
                      {member.mae && (
                        <div>
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Mãe</span>
                          <span className="text-sm font-semibold text-gray-850">{member.mae}</span>
                        </div>
                      )}
                    </div>

                    {/* Contatos */}
                    <div className="space-y-3 bg-gray-50/50 p-5 rounded-2xl border border-gray-100/50">
                      <h4 className="text-xs font-black text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5"><Phone className="w-4 h-4 text-gray-400" /> Contatos</h4>
                      <div className="flex items-center gap-3.5">
                        <Phone className="w-4 h-4 text-emerald-500 shrink-0" />
                        <div>
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Celular / WhatsApp</span>
                          <span className="text-sm font-semibold text-gray-850 flex items-center gap-1">
                            {telefone}
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block" title="Validado"></span>
                          </span>
                        </div>
                      </div>
                      {member.email && (
                        <div className="flex items-center gap-3.5">
                          <Mail className="w-4 h-4 text-indigo-500 shrink-0" />
                          <div>
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">E-mail</span>
                            <span className="text-sm font-semibold text-gray-850 break-all">{member.email}</span>
                          </div>
                        </div>
                      )}
                      <div>
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Identificação (RG / Documento)</span>
                        <span className="text-xs font-semibold text-gray-700 italic">{member.identificacao || 'Não cadastrado'}</span>
                      </div>
                      {member.cpf && (
                        <div>
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">CPF</span>
                          <span className="text-sm font-semibold text-gray-850">{member.cpf}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Localização */}
                  <div className="bg-gray-50/50 p-5 rounded-2xl border border-gray-100/50 space-y-4">
                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-wide flex items-center gap-1.5"><MapPin className="w-4 h-4 text-gray-400" /> Endereço & Setorização</h4>
                    
                    <div className="flex items-start gap-3">
                      <MapPin className="w-4.5 h-4.5 text-gray-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Endereço Completo</span>
                        <span className="text-sm font-semibold text-gray-850 leading-relaxed">{endereco}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-gray-100/70 pt-4">
                      <div>
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Setor de Residência</span>
                        <span className="text-sm font-bold text-indigo-700">
                          {member.setor_residencial ? (() => {
                            const norm = member.setor_residencial.trim().toUpperCase();
                            if (norm.includes('NORTE')) return 'Setor Norte';
                            if (norm.includes('CENTRAL')) return 'Setor Central';
                            if (norm.includes('AGUAS CLARAS') || norm.includes('ÁGUAS CLARAS')) return 'Setor Águas Claras';
                            if (norm.includes('SUL')) return 'Setor Sul';
                            return member.setor_residencial;
                          })() : 'Não informado'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Setor do GC (Eclesiástico)</span>
                        <span className="text-sm font-bold text-teal-700">
                          {member.setor_eclesiastico ? (() => {
                            const norm = member.setor_eclesiastico.trim().toUpperCase();
                            if (norm.includes('NORTE')) return 'Setor Norte';
                            if (norm.includes('CENTRAL')) return 'Setor Central';
                            if (norm.includes('AGUAS CLARAS') || norm.includes('ÁGUAS CLARAS')) return 'Setor Águas Claras';
                            if (norm.includes('SUL')) return 'Setor Sul';
                            return member.setor_eclesiastico;
                          })() : (cellInfo?.setor ? (() => {
                            const norm = cellInfo.setor.trim().toUpperCase();
                            if (norm.includes('NORTE')) return 'Setor Norte';
                            if (norm.includes('CENTRAL')) return 'Setor Central';
                            if (norm.includes('AGUAS CLARAS') || norm.includes('ÁGUAS CLARAS')) return 'Setor Águas Claras';
                            if (norm.includes('SUL')) return 'Setor Sul';
                            return cellInfo.setor;
                          })() : 'Não informado')}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Grupo Caseiro Atual</span>
                        <span className="text-sm font-bold text-rose-700 block truncate" title={member.grupos_caseiros}>
                          {member.grupos_caseiros || 'Não alocado'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4 Interactive bottom cards grid like Prover */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Card Grupos Caseiros */}
                  <button 
                    onClick={() => setActiveModal('grupos_caseiros')}
                    className="bg-white border border-gray-150 p-4 rounded-2xl shadow-sm text-left hover:shadow-md hover:border-red-200 transition-all group flex flex-col justify-between cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Grupos Caseiros</span>
                      <Users className="w-4.5 h-4.5 text-red-500 group-hover:scale-110 transition-transform" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-gray-800">
                        Participa de {cellsParticipations.length || (member.grupos_caseiros ? 1 : 0)} Grupo(s)
                      </span>
                      <span className="text-[10px] text-primary-600 font-semibold block mt-1">+ Detalhes</span>
                    </div>
                  </button>

                  {/* Card Rede */}
                  <button 
                    onClick={() => setActiveModal('rede')}
                    className="bg-white border border-gray-150 p-4 rounded-2xl shadow-sm text-left hover:shadow-md hover:border-blue-200 transition-all group flex flex-col justify-between cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Rede / EBD</span>
                      <BookOpen className="w-4.5 h-4.5 text-blue-500 group-hover:scale-110 transition-transform" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-gray-800">Participa de 0 EBD</span>
                      <span className="text-[10px] text-primary-600 font-semibold block mt-1">+ Detalhes</span>
                    </div>
                  </button>

                  {/* Card Discipulado */}
                  <button 
                    onClick={() => setActiveModal('discipulado')}
                    className="bg-white border border-gray-150 p-4 rounded-2xl shadow-sm text-left hover:shadow-md hover:border-purple-200 transition-all group flex flex-col justify-between cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Discipulado</span>
                      <Heart className="w-4.5 h-4.5 text-purple-500 group-hover:scale-110 transition-transform" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-gray-800">
                        Participa de {discipuladores.length + discipulos.length} Discipulado(s)
                      </span>
                      <span className="text-[10px] text-primary-600 font-semibold block mt-1">+ Detalhes</span>
                    </div>
                  </button>

                  {/* Card Localidades */}
                  <button 
                    onClick={() => setActiveModal('localidades')}
                    className="bg-white border border-gray-150 p-4 rounded-2xl shadow-sm text-left hover:shadow-md hover:border-green-200 transition-all group flex flex-col justify-between cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Localidades</span>
                      <MapPin className="w-4.5 h-4.5 text-green-500 group-hover:scale-110 transition-transform" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-gray-800">
                        Participa de {localidadesParticipations.length} Localidade(s)
                      </span>
                      <span className="text-[10px] text-primary-600 font-semibold block mt-1">+ Detalhes</span>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'familiares' && (
              <div className="bg-white rounded-3xl shadow-sm border border-gray-150 p-6 sm:p-8 space-y-6">
                <div className="border-b border-gray-100 pb-3 flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Membros da Família</h3>
                    <p className="text-xs text-gray-400 mt-0.5">Vínculos de parentesco declarados no Prover que compartilham ou não o mesmo lar.</p>
                  </div>
                  <a 
                    href={`https://sis.sistemaprover.com.br/pt-BR/cadastro/${member.id}/dados`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Vincular Familiar (no Prover)
                  </a>
                </div>

                {relatives.length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border border-gray-100">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Foto</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Nome</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Sexo</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Nascimento</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Parentesco</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Mesmo Domicílio</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Resp. Autorizado</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {relatives.map((rel, i) => (
                          <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-4 py-3 text-sm">
                              <div className="h-8 w-8 rounded-full bg-primary-50 flex items-center justify-center text-primary-700 font-black shrink-0 overflow-hidden text-xs">
                                {rel.foto ? (
                                  <img src={rel.foto} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  rel.nome.charAt(0).toUpperCase()
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm font-bold text-gray-800">
                              <Link to={`/membro/${rel.id}`} className="text-primary-600 hover:text-primary-850 hover:underline">
                                {rel.nome}
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-xs">
                              <span className={clsx("inline-flex items-center rounded px-2 py-0.5 font-semibold border",
                                rel.status === 'Ativo' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
                              )}>
                                {rel.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs font-bold text-gray-600 uppercase">
                              {rel.sexo || 'M'}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-600">
                              {rel.nascimento ? formatDate(rel.nascimento) : '-'}
                            </td>
                            <td className="px-4 py-3 text-xs font-bold text-indigo-700 uppercase tracking-wide">
                              {rel.parentesco}
                            </td>
                            <td className="px-4 py-3 text-xs">
                              {rel.mesmoDomicilio === 'Sim' ? (
                                <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 font-bold">🏠 Sim</span>
                              ) : (
                                <span className="text-gray-400 bg-gray-50 px-2 py-0.5 rounded border border-gray-100 font-medium">Não</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs font-bold text-emerald-600">
                              {rel.parentesco === 'Pai' || rel.parentesco === 'Mãe' ? 'Sim' : 'Não'}
                            </td>
                            <td className="px-4 py-3 text-center text-xs">
                              <div className="flex justify-center gap-1.5">
                                <Link to={`/membro/${rel.id}`} className="text-gray-400 hover:text-primary-650" title="Ver ficha">
                                  <Eye className="w-4 h-4" />
                                </Link>
                                <a 
                                  href={`https://sis.sistemaprover.com.br/pt-BR/cadastro/${member.id}/dados`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-gray-400 hover:text-amber-600 transition-colors" 
                                  title="Editar/Excluir vínculo no Prover"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </a>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200 p-6">
                    <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-gray-500">Nenhum familiar cadastrado no sistema.</p>
                    <p className="text-xs text-gray-400 mt-1">Vincule parentes e domicílios no painel do Prover.</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'funcoes' && (
              <div className="bg-white rounded-3xl shadow-sm border border-gray-150 p-6 sm:p-8 space-y-6">
                <div className="border-b border-gray-100 pb-3 flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Funções & Cargos Eclesiásticos</h3>
                    <p className="text-xs text-gray-400 mt-0.5">Histórico de cargos, ministérios e funções ativas exercidas na igreja.</p>
                  </div>
                  <button 
                    onClick={() => setShowAddRoleModal(true)}
                    className="bg-primary-50 text-primary-700 hover:bg-primary-100 border border-primary-150 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar Função
                  </button>
                </div>

                {getCombinedRoles().length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border border-gray-100">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Função / Cargo</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Início</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Origem</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {getCombinedRoles().map((role, i) => (
                          <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-4 py-3.5 text-sm font-bold text-indigo-900">
                              {role.funcao}
                            </td>
                            <td className="px-4 py-3.5 text-xs text-gray-600 font-medium">
                              {formatDate(role.data_inicio)}
                            </td>
                            <td className="px-4 py-3.5 text-xs">
                              <span className={clsx("inline-flex items-center rounded px-2.5 py-0.5 font-bold border text-[10px]",
                                role.situacao === 'Ativo' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
                              )}>
                                {role.situacao}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide text-[10px]">
                              {role.source === 'cell' ? 'Célula (Auto)' : role.source === 'local' ? 'Inserido Local' : 'Prover'}
                            </td>
                            <td className="px-4 py-3.5 text-center text-xs">
                              <button className="text-gray-400 hover:text-red-600 transition-colors" title="Remover cargo">
                                <Trash2 className="w-4 h-4 inline-block" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200 p-6">
                    <Briefcase className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-gray-500">Nenhuma função ou cargo atribuído a esta pessoa.</p>
                    <p className="text-xs text-gray-400 mt-1">Cargos como Diácono, Líder, Pastor e Discipulador aparecerão aqui.</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'historico' && (
              <div className="bg-white rounded-3xl shadow-sm border border-gray-150 p-6 sm:p-8 space-y-6">
                <div className="border-b border-gray-100 pb-3 flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Histórico & Protocolo</h3>
                    <p className="text-xs text-gray-400 mt-0.5">Registro oficial de eventos e marcos importantes do membro (Ex: Batismo, Vínculo, Decisão).</p>
                  </div>
                  <button 
                    onClick={() => setShowAddOccModal(true)}
                    className="bg-primary-600 hover:bg-primary-700 text-white border border-primary-500 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar Protocolo
                  </button>
                </div>

                {history.length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border border-gray-100">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Data</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Ocorrência / Evento</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Célula / GC</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Anotações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {history.map((item, i) => (
                          <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-4 py-3.5 text-xs text-gray-500 font-bold whitespace-nowrap">
                              {formatDate(item.data)}
                            </td>
                            <td className="px-4 py-3.5 text-sm">
                              <span className="font-bold text-indigo-755 bg-indigo-50/70 border border-indigo-100 px-2 py-0.5 rounded-lg text-xs uppercase tracking-wide">
                                {item.ocorrencia}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-xs font-semibold text-gray-700 whitespace-nowrap">
                              {item.grupo_caseiro || '-'}
                            </td>
                            <td className="px-4 py-3.5 text-xs text-gray-500 max-w-sm truncate" title={item.anotacao || ''}>
                              {item.anotacao || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200 p-6">
                    <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-gray-500">Nenhum evento registrado no histórico.</p>
                    <p className="text-xs text-gray-400 mt-1">Registros de batismos, novos vínculos e transferências aparecerão aqui.</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'eventos' && (
              <div className="bg-white rounded-3xl shadow-sm border border-gray-150 p-6 sm:p-8 space-y-6">
                <div className="border-b border-gray-100 pb-3">
                  <h3 className="text-lg font-bold text-gray-900">Eventos & Ensinos</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Lista de participações, inscrições e presenças em eventos ou cursos da igreja.</p>
                </div>

                {eventosInscricoes.length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border border-gray-100">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Evento / Tema</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Data Inscrição</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Lote</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Valor Pago</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {eventosInscricoes.map((ev, i) => (
                          <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-4 py-3.5 text-sm font-bold text-gray-800">
                              {ev.tema}
                            </td>
                            <td className="px-4 py-3.5 text-xs text-gray-500 font-semibold">
                              {formatDate(ev.data_inscricao)}
                            </td>
                            <td className="px-4 py-3.5 text-xs font-medium text-gray-600">
                              {ev.lote || 'Geral'}
                            </td>
                            <td className="px-4 py-3.5 text-sm font-bold text-right text-green-600">
                              {formatCurrency(ev.valor_total || 0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200 p-6">
                    <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-gray-500">Nenhuma inscrição de evento ou ensino encontrada.</p>
                    <p className="text-xs text-gray-400 mt-1">Registros de inscrições em conferências, acampamentos e EBD aparecerão aqui.</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'financeiro' && hasFinanceAccess && (
              <div className="space-y-6">
                {/* Statistics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white border border-gray-150 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total Contribuído</span>
                    <span className="text-2xl font-black text-emerald-600 mt-2">{formatCurrency(totalContributed)}</span>
                  </div>
                  <div className="bg-white border border-gray-150 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Média por Lançamento</span>
                    <span className="text-2xl font-black text-indigo-600 mt-2">{formatCurrency(avgContribution)}</span>
                  </div>
                  <div className="bg-white border border-gray-150 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Lançamentos</span>
                    <span className="text-2xl font-black text-gray-800 mt-2">{finance.length}</span>
                  </div>
                </div>

                <div className="bg-white rounded-3xl shadow-sm border border-gray-150 p-6 sm:p-8 space-y-6">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Histórico de Contribuições</h3>
                      <p className="text-xs text-gray-400 mt-0.5">Dízimos e ofertas registrados associados a este nome (exibindo até 100 lançamentos).</p>
                    </div>
                  </div>

                  {finance.length > 0 ? (
                    <div className="overflow-x-auto rounded-xl border border-gray-100">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Data</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Categoria / Tipo</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Centro de Custo</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Valor</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                          {finance.map((f, i) => (
                            <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                              <td className="px-4 py-3 text-xs text-gray-500 font-bold whitespace-nowrap">
                                {formatDate(f.data)}
                              </td>
                              <td className="px-4 py-3 text-sm font-semibold text-gray-850">
                                {f.categoria || f.tipo}
                              </td>
                              <td className="px-4 py-3 text-xs text-gray-500">
                                {f.centro_custo || '-'}
                              </td>
                              <td className="px-4 py-3 text-sm font-bold text-right text-green-600 whitespace-nowrap">
                                {formatCurrency(f.valor)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200 p-6">
                      <Wallet className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                      <p className="text-sm font-semibold text-gray-500">Nenhum lançamento financeiro encontrado.</p>
                      <p className="text-xs text-gray-400 mt-1">Contribuições associadas a este nome aparecerão nesta tela.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'acessos' && (
              <div className="bg-white rounded-3xl shadow-sm border border-gray-150 p-6 sm:p-8 space-y-6">
                <div className="border-b border-gray-100 pb-3">
                  <h3 className="text-lg font-bold text-gray-900">Configuração de Acessos</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Gerenciamento de login no aplicativo do membro e credenciais do dashboard.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Status do Perfil */}
                  <div className="border border-gray-150 rounded-2xl p-5 shadow-sm space-y-4">
                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-wide flex items-center gap-1.5"><Key className="w-4 h-4 text-primary-500" /> Perfil de Acesso BI</h4>
                    
                    <div className="bg-primary-50 border border-primary-100 p-4 rounded-xl">
                      <span className="text-[10px] text-primary-600 font-bold uppercase tracking-wider block">Perfil Atual</span>
                      <span className="text-base font-black text-primary-900 mt-1 block">{accessProfile}</span>
                      <p className="text-xs text-primary-700 leading-relaxed mt-2 font-medium">
                        {accessProfile === 'Pastor / Administrador' && 'Acesso total de administrador: visualiza relatórios financeiros, gestão geral de membros, pastorado e auditoria de usuários.'}
                        {accessProfile === 'Líder de Célula' && 'Acesso limitado: visualiza sua própria célula e os membros alocados, podendo lançar presenças e acompanhar metas do grupo.'}
                        {accessProfile === 'Membro Geral' && 'Sem acesso administrativo ao dashboard de BI. Credenciais básicas ativas apenas para uso no aplicativo móvel.'}
                        {accessProfile === 'Sem Acesso' && 'Cadastro inativo. Credenciais de login bloqueadas.'}
                      </p>
                    </div>

                    <div className="space-y-3 pt-2">
                      <label className="text-xs font-bold text-gray-500 block">Alterar Perfil de Acesso</label>
                      <select 
                        value={accessProfile} 
                        onChange={(e) => setAccessProfile(e.target.value)} 
                        disabled={member.status !== 'Ativo'}
                        className="w-full py-2 px-3 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none bg-white font-medium"
                      >
                        <option value="Membro Geral">Membro Geral</option>
                        <option value="Líder de Célula">Líder de Célula</option>
                        <option value="Secretaria">Secretaria</option>
                        <option value="Financeiro">Financeiro</option>
                        <option value="Pastor / Administrador">Pastor / Administrador</option>
                        <option value="Sem Acesso">Sem Acesso</option>
                      </select>
                    </div>
                  </div>

                  {/* Permissões do Aplicativo */}
                  <div className="border border-gray-150 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                    <div>
                      <h4 className="text-xs font-black text-gray-400 uppercase tracking-wide mb-4 flex items-center gap-1.5"><Shield className="w-4 h-4 text-emerald-500" /> Permissões Individuais</h4>
                      
                      <div className="space-y-4">
                        {/* Switch App Login */}
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-bold text-gray-800 block">Permitir Login no Aplicativo</span>
                            <span className="text-[10px] text-gray-400">Ativa o acesso do usuário no app mobile</span>
                          </div>
                          <input 
                            type="checkbox" 
                            checked={allowAppLogin} 
                            onChange={(e) => setAllowAppLogin(e.target.checked)}
                            disabled={member.status !== 'Ativo'}
                            className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500" 
                          />
                        </div>

                        {/* Switch Financeiro */}
                        <div className="flex items-center justify-between border-t border-gray-50 pt-3">
                          <div>
                            <span className="text-xs font-bold text-gray-800 block">Liberar Módulo Tesouraria</span>
                            <span className="text-[10px] text-gray-400">Permite registrar dízimos e despesas</span>
                          </div>
                          <input 
                            type="checkbox" 
                            checked={allowFinanceAccess} 
                            onChange={(e) => setAllowFinanceAccess(e.target.checked)}
                            disabled={member.status !== 'Ativo'}
                            className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500" 
                          />
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-50 border border-gray-100 p-3.5 rounded-xl mt-4">
                      <p className="text-[10px] text-gray-500 font-semibold leading-relaxed">
                        ⚠️ Alterações nesta aba não alteram o cadastro no banco central do Prover. Elas são locais à governança deste dashboard de inteligência.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'lgpd' && (
              <div className="bg-white rounded-3xl shadow-sm border border-gray-150 p-6 sm:p-8 space-y-6">
                <div className="border-b border-gray-100 pb-3 flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Termo de Consentimento (LGPD)</h3>
                    <p className="text-xs text-gray-400 mt-0.5">Tratamento de dados pessoais de acordo com a Lei Geral de Proteção de Dados (Nº 13.709/18).</p>
                  </div>
                  <span className={clsx("text-xs px-3 py-1 font-bold border rounded-full shadow-sm uppercase tracking-wide",
                    lgpdConsent.accepted ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
                  )}>
                    {lgpdConsent.accepted ? 'Autorizado' : 'Não Registrado'}
                  </span>
                </div>

                <div className="bg-gray-50 border border-gray-150 p-6 rounded-2xl space-y-4">
                  <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest text-center border-b border-gray-200 pb-2">TERMO DE ACEITE</h4>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Pelo presente instrumento, eu autorizo a <strong>Igreja BSB Church</strong> a efetuar o tratamento dos meus dados pessoais (nome, data de nascimento, filiação, endereço, e-mail, telefone de contato, estado civil) no banco de dados eclesiástico.
                  </p>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Entendo que a finalidade exclusiva desse tratamento é o acompanhamento de pastoreamento, gestão de pequenos grupos (células), convocação para eventos, comunicações internas e emissão de relatórios consolidados de dízimos/ofertas de forma a cumprir os objetivos da igreja.
                  </p>

                  <div className="text-xs text-gray-500 leading-relaxed font-semibold">
                    <span className="block border-t border-gray-200 pt-3 mb-1">Direitos Garantidos ao Titular (Art. 18):</span>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Acesso fácil e correção de dados incompletos/inexatos.</li>
                      <li>Revogação do consentimento a qualquer momento sob petição formal.</li>
                      <li>Eliminação de dados sob revogação ou inativação do cadastro.</li>
                    </ul>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-primary-50/50 border border-primary-100 p-5 rounded-2xl">
                  <div>
                    <span className="text-xs font-bold text-primary-900 block">Assinatura Digital / Consentimento</span>
                    {lgpdConsent.accepted ? (
                      <span className="text-[10px] text-emerald-600 font-bold block mt-1">
                        ✓ Consentido via Painel Administrativo em: {lgpdConsent.date}
                      </span>
                    ) : (
                      <span className="text-[10px] text-red-600 font-bold block mt-1">
                        ✗ Nenhuma assinatura ou consentimento registrado até o momento.
                      </span>
                    )}
                  </div>

                  {lgpdConsent.accepted ? (
                    <button 
                      onClick={handleRevokeLgpd}
                      className="bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      Revogar Consentimento
                    </button>
                  ) : (
                    <button 
                      onClick={handleRegisterLgpd}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-500 px-4 py-2 rounded-xl text-xs font-bold transition-colors shadow-sm cursor-pointer"
                    >
                      Registrar Consentimento LGPD
                    </button>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'cuidados' && (
              <div className="bg-white rounded-3xl shadow-sm border border-gray-150 p-6 sm:p-8 space-y-6">
                <div className="border-b border-gray-100 pb-3 flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Acompanhamento Pastoral & Cuidados</h3>
                    <p className="text-xs text-gray-400 mt-0.5">Notas pastorais de orações, aconselhamentos, visitas e orientações espirituais.</p>
                  </div>
                  <span className="text-[10px] bg-red-50 text-red-700 font-black border border-red-150 px-2.5 py-0.5 rounded uppercase tracking-wider flex items-center gap-1">
                    ❤️ Acompanhamento
                  </span>
                </div>

                {/* Form to insert note */}
                <div className="bg-gray-50/50 border border-gray-150 p-5 rounded-2xl space-y-3">
                  <label className="text-xs font-bold text-gray-600 block">Registrar Nova Observação Pastoral</label>
                  <textarea 
                    value={newCareNote}
                    onChange={(e) => setNewCareNote(e.target.value)}
                    rows={3}
                    placeholder="Ex: Visitamos o irmão no hospital. Ele demonstrou muita fé. Oremos pela restauração..."
                    className="w-full p-3 text-xs border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none bg-white font-medium shadow-inner"
                  />
                  <div className="flex justify-end">
                    <button 
                      onClick={handleAddCareNote}
                      className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
                    >
                      Salvar Nota de Cuidado
                    </button>
                  </div>
                </div>

                {/* List of notes */}
                <div className="space-y-3">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Cronologia de Cuidados</span>
                  
                  {careNotes.length > 0 ? (
                    <div className="space-y-3.5">
                      {careNotes.map((note, index) => (
                        <div key={index} className="bg-white border border-gray-150 p-4 rounded-2xl shadow-sm flex items-start justify-between gap-4">
                          <div className="space-y-1.5">
                            <p className="text-xs text-gray-700 leading-relaxed font-semibold">{note}</p>
                            <span className="text-[9px] text-gray-450 font-bold block">
                              Por: Pr. Diego Freitas (Registrado Localmente) • Nota #{careNotes.length - index}
                            </span>
                          </div>
                          <button 
                            onClick={() => handleDeleteCareNote(index)}
                            className="text-gray-400 hover:text-red-600 transition-colors p-1" 
                            title="Remover nota"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                      <Heart className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                      <p className="text-sm font-semibold text-gray-500">Nenhum registro pastoral inserido.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'geolocalizacao' && (
              <div className="bg-white rounded-3xl shadow-sm border border-gray-150 p-6 sm:p-8 space-y-6">
                <div className="border-b border-gray-100 pb-3 flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Georeferenciamento</h3>
                    <p className="text-xs text-gray-400 mt-0.5">Localização física do endereço do membro para planejamento territorial de GC.</p>
                  </div>
                  <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold border border-emerald-150 px-2 py-0.5 rounded uppercase tracking-wider">Coordenadas</span>
                </div>

                {member.latitude && member.longitude && !isNaN(parseFloat(member.latitude as string)) && !isNaN(parseFloat(member.longitude as string)) ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-xs font-medium">
                      <div className="bg-gray-50 border border-gray-100 p-3.5 rounded-xl">
                        <span className="text-[10px] text-gray-450 font-bold block">Latitude</span>
                        <span className="font-bold text-gray-800 text-sm mt-0.5 block">{member.latitude}</span>
                      </div>
                      <div className="bg-gray-50 border border-gray-100 p-3.5 rounded-xl">
                        <span className="text-[10px] text-gray-450 font-bold block">Longitude</span>
                        <span className="font-bold text-gray-800 text-sm mt-0.5 block">{member.longitude}</span>
                      </div>
                    </div>

                    <div className="h-96 rounded-2xl overflow-hidden border border-gray-150 shadow-sm relative z-0">
                      <MapContainer 
                        center={[parseFloat(member.latitude as string), parseFloat(member.longitude as string)]} 
                        zoom={15} 
                        scrollWheelZoom={false} 
                        style={{ height: '100%', width: '100%' }}
                      >
                        <TileLayer
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <Marker position={[parseFloat(member.latitude as string), parseFloat(member.longitude as string)]}>
                          <Popup>
                            <div className="text-xs space-y-1">
                              <p className="font-bold text-gray-900">{member.nome}</p>
                              <p className="text-gray-500">{endereco}</p>
                            </div>
                          </Popup>
                        </Marker>
                      </MapContainer>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200 p-8 space-y-4">
                    <Map className="w-12 h-12 text-gray-300 mx-auto" />
                    <div>
                      <p className="text-sm font-semibold text-gray-600">Coordenadas geográficas não cadastradas para este membro.</p>
                      <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
                        Endereço cadastrado: <strong>{endereco}</strong>
                      </p>
                    </div>
                    <button className="bg-primary-650 hover:bg-primary-750 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-sm transition-colors">
                      Calcular Coordenadas (Geocodificar)
                    </button>
                  </div>
                )}
              </div>
            )}
         </div>
      </div>

      {/* ============================================================== */}
      {/* interactive modals for Card clicks in the Dados Gerais Tab */}
      {/* ============================================================== */}

      {/* Modal 1: Grupos Caseiros */}
      {activeModal === 'grupos_caseiros' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-4xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-gray-100 px-6 py-4 bg-gray-50">
              <h3 className="text-base font-extrabold text-gray-900">Participações em Grupos Caseiros</h3>
              <button onClick={() => setActiveModal(null)} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              {cellsParticipations.length > 0 || member.grupos_caseiros ? (
                <div className="overflow-x-auto rounded-xl border border-gray-150">
                  <table className="min-w-full divide-y divide-gray-200 text-xs">
                    <thead className="bg-gray-50 text-gray-500 uppercase font-semibold">
                      <tr>
                        <th className="px-4 py-3 text-left">Tipo / Situação</th>
                        <th className="px-4 py-3 text-left">Grupo Caseiro</th>
                        <th className="px-4 py-3 text-left">Tipo Participação</th>
                        <th className="px-4 py-3 text-left">Entrada</th>
                        <th className="px-4 py-3 text-left">Saída</th>
                        <th className="px-4 py-3 text-left">Função</th>
                        <th className="px-4 py-3 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {/* Dynamic history records from JSON */}
                      {cellsParticipations.map((c, i) => (
                        <tr key={i} className="hover:bg-gray-50/50">
                          <td className="px-4 py-3 font-semibold text-red-600">
                            GRUPOS CASEIROS
                            <span className="block text-[9px] text-gray-400 uppercase font-black tracking-wide mt-0.5">Grupo Caseiro Ativo</span>
                          </td>
                          <td className="px-4 py-3 font-bold text-indigo-750">
                            {c.grupo_caseiro}
                          </td>
                          <td className="px-4 py-3 font-semibold text-gray-700">
                            {c.cargo || 'Participante'}
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-500">
                            {formatDate(c.data_entrada)}
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-500">
                            {c.data_de_saida ? formatDate(c.data_de_saida) : '-'}
                          </td>
                          <td className="px-4 py-3 font-semibold text-gray-700">
                            {c.cargo || 'Participante'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex justify-center gap-1">
                              <button className="text-gray-400 hover:text-primary-650" title="Editar">
                                <Edit3 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}

                      {/* If JSON is empty but member is in a cell, inject the current database cell */}
                      {cellsParticipations.length === 0 && member.grupos_caseiros && (
                        <tr className="hover:bg-gray-50/50">
                          <td className="px-4 py-3 font-semibold text-red-600">
                            GRUPOS CASEIROS
                            <span className="block text-[9px] text-gray-400 uppercase font-black tracking-wide mt-0.5">Grupo Caseiro Ativo</span>
                          </td>
                          <td className="px-4 py-3 font-bold text-indigo-750">
                            {member.grupos_caseiros}
                          </td>
                          <td className="px-4 py-3 font-semibold text-gray-700">
                            {cellInfo && (normalizeStr(cellInfo.lider) === normalizeStr(member.nome)) ? 'Líder' : 'Participante'}
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-500">
                            {member.data_de_vinculo ? formatDate(member.data_de_vinculo) : (member.data_de_cadastro ? formatDate(member.data_de_cadastro) : '-')}
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-500">
                            -
                          </td>
                          <td className="px-4 py-3 font-semibold text-gray-700">
                            {cellInfo && (normalizeStr(cellInfo.lider) === normalizeStr(member.nome)) ? 'Líder' : 'Participante'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex justify-center gap-1">
                              <button className="text-gray-400 hover:text-primary-650" title="Editar">
                                <Edit3 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-gray-500">Nenhum histórico de grupo caseiro encontrado.</p>
                </div>
              )}
            </div>
            
            <div className="flex justify-end border-t border-gray-100 px-6 py-4 bg-gray-50">
              <button 
                onClick={() => setActiveModal(null)}
                className="bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Rede */}
      {activeModal === 'rede' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-gray-100 px-6 py-4 bg-gray-50">
              <h3 className="text-base font-extrabold text-gray-900">Participações em Redes (EBD)</h3>
              <button onClick={() => setActiveModal(null)} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-10 text-center space-y-3">
              <BookOpen className="w-12 h-12 text-blue-500 mx-auto animate-bounce" />
              <h4 className="text-sm font-bold text-gray-800">Nenhuma participação registrada</h4>
              <p className="text-xs text-gray-500 max-w-sm mx-auto leading-relaxed">
                Este membro não possui participações ativas ou históricas em turmas da Escola Bíblica EBD ou classes de ensino registradas.
              </p>
            </div>
            
            <div className="flex justify-end border-t border-gray-100 px-6 py-4 bg-gray-50">
              <button 
                onClick={() => setActiveModal(null)}
                className="bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Discipulado */}
      {activeModal === 'discipulado' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-3xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-gray-100 px-6 py-4 bg-gray-50">
              <h3 className="text-base font-extrabold text-gray-900">Participações em Discipulado</h3>
              <button onClick={() => setActiveModal(null)} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
              {/* Discipulador */}
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 block">Discipulador(a)</span>
                
                {discipuladores.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {discipuladores.map((d, idx) => (
                      <div key={idx} className="bg-gray-50 border border-gray-150 p-4 rounded-2xl flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 bg-purple-100 rounded-full flex items-center justify-center text-purple-700 font-bold shrink-0">
                            {d.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-gray-800">{d}</p>
                            <p className="text-[9px] text-gray-500 font-medium">Vinculado desde: 05/12/2025</p>
                            <p className="text-[9px] text-purple-600 font-bold mt-1">Último encontro: Não registrado</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => alert(`Solicitação de encontro enviada para ${d}`)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0"
                        >
                          Marcar Encontro
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 bg-gray-50 rounded-xl border border-gray-100 text-xs text-gray-500">
                    Nenhum discipulador direto ativo associado.
                  </div>
                )}
              </div>

              {/* Liderados */}
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 block">Liderados (Discípulos - {discipulos.length})</span>
                
                {discipulos.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-48 overflow-y-auto pr-1">
                    {discipulos.map((d, idx) => (
                      <div key={idx} className="bg-gray-50 border border-gray-150 p-3 rounded-xl flex items-center gap-3">
                        <div className="h-8 w-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-750 font-bold shrink-0 text-xs">
                          {d.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-800">{d}</p>
                          <p className="text-[9px] text-gray-450">Discípulo na rede</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 bg-gray-50 rounded-xl border border-gray-100 text-xs text-gray-500">
                    Nenhum liderado ativo na rede.
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex justify-end border-t border-gray-100 px-6 py-4 bg-gray-50">
              <button 
                onClick={() => setActiveModal(null)}
                className="bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Localidades */}
      {activeModal === 'localidades' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-3xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-gray-100 px-6 py-4 bg-gray-50">
              <h3 className="text-base font-extrabold text-gray-900">Participações em Localidades</h3>
              <button onClick={() => setActiveModal(null)} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              {localidadesParticipations.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-gray-150">
                  <table className="min-w-full divide-y divide-gray-200 text-xs">
                    <thead className="bg-gray-50 text-gray-500 uppercase font-semibold">
                      <tr>
                        <th className="px-4 py-3 text-left">Localidade</th>
                        <th className="px-4 py-3 text-left">Cargo</th>
                        <th className="px-4 py-3 text-left">Data Entrada</th>
                        <th className="px-4 py-3 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {localidadesParticipations.map((loc, i) => (
                        <tr key={i} className="hover:bg-gray-50/50">
                          <td className="px-4 py-3 font-bold text-gray-800">
                            {loc.localidade}
                          </td>
                          <td className="px-4 py-3 text-gray-600 font-semibold">
                            {loc.cargo || 'Membro'}
                          </td>
                          <td className="px-4 py-3 text-gray-500">
                            {formatDate(loc.data_entrada)}
                          </td>
                          <td className="px-4 py-3">
                            <span className="bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded text-[10px] font-bold">
                              Ativo
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <MapPin className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-gray-500">Nenhum vínculo de localidade eclesiástica registrado.</p>
                </div>
              )}
            </div>
            
            <div className="flex justify-end border-t border-gray-100 px-6 py-4 bg-gray-50">
              <button 
                onClick={() => setActiveModal(null)}
                className="bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* Modal Dialog: Add Occurrence (Protocol) */}
      {/* ============================================================== */}
      {showAddOccModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-gray-100 px-6 py-4 bg-gray-50">
              <h3 className="text-base font-extrabold text-gray-900">Registrar Protocolo / Ocorrência</h3>
              <button onClick={() => setShowAddOccModal(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleAddOccurrence}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Tipo de Ocorrência</label>
                  <select 
                    value={newOcc.ocorrencia}
                    onChange={(e) => setNewOcc({ ...newOcc, ocorrencia: e.target.value })}
                    className="w-full py-2 px-3 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none bg-white font-medium"
                  >
                    <option value="DATA DE VÍNCULO">DATA DE VÍNCULO</option>
                    <option value="BATISMO">BATISMO</option>
                    <option value="INCLUSÃO">INCLUSÃO</option>
                    <option value="MUDANÇA DE LOCALIDADE">MUDANÇA DE LOCALIDADE</option>
                    <option value="TRANSFERÊNCIA">TRANSFERÊNCIA</option>
                    <option value="TRANSFERÊNCIA PARA OUTRA IGREJA">TRANSFERÊNCIA PARA OUTRA IGREJA</option>
                    <option value="MIGRAÇÃO DE CADASTRO">MIGRAÇÃO DE CADASTRO</option>
                    <option value="DESISTENCIA">DESISTÊNCIA</option>
                    <option value="FALECIMENTO">FALECIMENTO</option>
                    <option value="CADASTROS DUPLICADOS">CADASTROS DUPLICADOS</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Data</label>
                    <input 
                      type="date"
                      value={newOcc.data}
                      onChange={(e) => setNewOcc({ ...newOcc, data: e.target.value })}
                      required
                      className="w-full py-2 px-3 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none bg-white font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Grupo Caseiro (Opcional)</label>
                    <input 
                      type="text"
                      value={newOcc.grupo_caseiro}
                      onChange={(e) => setNewOcc({ ...newOcc, grupo_caseiro: e.target.value })}
                      placeholder="Ex: BSB ASA SUL"
                      className="w-full py-2 px-3 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none bg-white font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Anotações / Descrição</label>
                  <textarea 
                    value={newOcc.anotacao}
                    onChange={(e) => setNewOcc({ ...newOcc, anotacao: e.target.value })}
                    rows={4}
                    placeholder="Escreva detalhes da ocorrência..."
                    className="w-full p-3 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none bg-white font-medium"
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-2 border-t border-gray-100 px-6 py-4 bg-gray-50">
                <button 
                  type="button"
                  onClick={() => setShowAddOccModal(false)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={isSubmittingOcc}
                  className="bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors shadow-sm cursor-pointer flex items-center gap-1 disabled:opacity-50"
                >
                  {isSubmittingOcc && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirmar Registro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* Modal Dialog: Add Role/Function (Local) */}
      {/* ============================================================== */}
      {showAddRoleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-gray-100 px-6 py-4 bg-gray-50">
              <h3 className="text-base font-extrabold text-gray-900">Adicionar Função Eclesiástica</h3>
              <button onClick={() => setShowAddRoleModal(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleAddRole}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Nome do Cargo / Função</label>
                  <input 
                    type="text"
                    value={newRole.funcao}
                    onChange={(e) => setNewRole({ ...newRole, funcao: e.target.value })}
                    required
                    placeholder="Ex: LÍDER DE LOUVOR, DIÁCONO, COORDENADOR"
                    className="w-full py-2 px-3 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none bg-white font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Data Início</label>
                    <input 
                      type="date"
                      value={newRole.data_inicio}
                      onChange={(e) => setNewRole({ ...newRole, data_inicio: e.target.value })}
                      required
                      className="w-full py-2 px-3 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none bg-white font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Situação</label>
                    <select 
                      value={newRole.situacao}
                      onChange={(e) => setNewRole({ ...newRole, situacao: e.target.value })}
                      className="w-full py-2 px-3 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none bg-white font-medium"
                    >
                      <option value="Ativo">Ativo</option>
                      <option value="Inativo">Inativo</option>
                    </select>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end gap-2 border-t border-gray-100 px-6 py-4 bg-gray-50">
                <button 
                  type="button"
                  onClick={() => setShowAddRoleModal(false)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors shadow-sm cursor-pointer"
                >
                  Adicionar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* Modal de Edição Rápida de Vínculo */}
      {/* ============================================================== */}
      {showVinculoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-bold text-gray-900">Editar Vínculo</h2>
                <p className="text-xs text-gray-500 mt-0.5">{member.nome}</p>
              </div>
              <button onClick={() => setShowVinculoModal(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            {vinculoSaveSuccess ? (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <CheckCircle2 className="w-12 h-12 text-green-500" />
                <p className="font-bold text-green-700">Salvo com sucesso!</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Grupo Caseiro</label>
                  <select
                    value={vinculoForm.grupos_caseiros}
                    onChange={e => setVinculoForm(f => ({ ...f, grupos_caseiros: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent bg-gray-50"
                  >
                    <option value="">— Sem GC —</option>
                    {['BSB AGUAS CLARAS - "A"','BSB AGUAS CLARAS - "B"','BSB AGUAS CLARAS - "C"','BSB ASA NORTE','BSB ASA SUL','BSB CEILÂNDIA','BSB GUARÁ I','BSB GUARÁ II - NB','BSB RECANTO DAS EMAS','BSB SAMAMBAIA','BSB SOBRADINHO','BSB TAGUA 1','BSB TAGUA 2','BSB VICENTE PIRES','COBERTURA - VIX'].map(gc => (
                      <option key={gc} value={gc}>{gc}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Setor Eclesiástico</label>
                  <select
                    value={vinculoForm.setor_eclesiastico}
                    onChange={e => setVinculoForm(f => ({ ...f, setor_eclesiastico: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent bg-gray-50"
                  >
                    <option value="">— Não definido —</option>
                    {['BSB ÁGUAS CLARAS','BSB_CENTRAL','BSB_NORTE','BSB_SUL','COBERTURA - VIX'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Status</label>
                    <select
                      value={vinculoForm.status}
                      onChange={e => setVinculoForm(f => ({ ...f, status: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent bg-gray-50"
                    >
                      <option value="Ativo">Ativo</option>
                      <option value="Inativo">Inativo</option>
                      <option value="Em Transferência">Em Transferência</option>
                      <option value="Visitante">Visitante</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Data de Vínculo</label>
                    <input
                      type="date"
                      value={vinculoForm.data_de_vinculo}
                      onChange={e => setVinculoForm(f => ({ ...f, data_de_vinculo: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent bg-gray-50"
                    />
                  </div>
                </div>
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                  <p className="text-xs text-amber-700 font-medium">⚠️ Esta edição salva diretamente no banco de dados. Lembre de atualizar também no <strong>Prover</strong> após o retiro.</p>
                </div>
                <div className="flex gap-3 justify-end pt-2">
                  <button onClick={() => setShowVinculoModal(false)} className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveVinculo}
                    disabled={isSavingVinculo}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 transition-colors shadow-md disabled:opacity-60"
                  >
                    {isSavingVinculo ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Salvar Vínculo
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* Modal Dialog: Zoomed Avatar Lightbox */}
      {/* ============================================================== */}
      {isAvatarOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 transition-all duration-300"
          onClick={() => setIsAvatarOpen(false)}
        >
          <div className="relative max-w-3xl max-h-[85vh] flex items-center justify-center animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setIsAvatarOpen(false)} 
              className="absolute -top-12 right-0 bg-white/10 hover:bg-white/20 text-white rounded-full p-2.5 transition-colors cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>
            <img 
              src={member.foto || `https://vadufkgbluisdamgkbln.supabase.co/storage/v1/object/public/avatars/avatars/${member.id}.jpg`} 
              alt={member.nome} 
              className="max-w-full max-h-[75vh] object-contain rounded-2xl shadow-2xl border-4 border-white/10 bg-gray-900" 
              onClick={(e) => e.stopPropagation()}
              onError={(e) => {
                (e.target as HTMLImageElement).classList.add('hidden');
                (e.target as HTMLImageElement).parentElement?.querySelector('.lightbox-fallback')?.classList.remove('hidden');
              }}
            />
            <div className="lightbox-fallback hidden flex flex-col items-center justify-center bg-gray-950 border border-white/10 p-12 rounded-2xl text-gray-400">
              <User className="w-24 h-24 text-gray-600 mb-4" />
              <p className="text-sm font-bold text-gray-300">Nenhuma foto cadastrada para este membro.</p>
            </div>
          </div>
        </div>
      )}

      {cropImageSrc && (
        <ImageCropperModal
          imageSrc={cropImageSrc}
          onCropComplete={handleCropComplete}
          onCancel={() => setCropImageSrc(null)}
        />
      )}
    </div>
  );
};
