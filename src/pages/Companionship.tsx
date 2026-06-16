import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { 
  Handshake, Users, MapPin, Search, Plus, Trash2, Heart, 
  Smile, Compass, BookOpen, AlertTriangle, Sparkles, 
  CheckCircle2, Map, Filter, ArrowRight, Clock, PlusCircle, Check,
  Sliders, Play, RefreshCw, XCircle, FileSpreadsheet
} from 'lucide-react';
import clsx from 'clsx';

const formatName = (fullName: string) => {
  if (!fullName) return '';
  const parts = fullName.trim().split(' ');
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]}` : parts[0];
};

// Interface do Companheirismo
interface CompanionshipData {
  id: string;
  memberIds: string[]; // 2 ou 3 IDs de membros
  status: 'EM ORAÇÃO' | 'ATIVO' | 'AJUSTE';
  dataInicio: string;
  observacoes?: string;
  oracoes: { id: string; pedido: string; respondido: boolean; criadoEm: string }[];
  atividades: { id: string; tipo: 'PALAVRA' | 'ORAÇÃO' | 'EVANGELISMO' | 'SERVIÇO'; data: string; descricao: string }[];
}

interface Member {
  id: string;
  nome: string;
  apelido?: string;
  tipo_de_pessoa: string;
  sexo: string;
  bairro?: string;
  grupos_caseiros?: string;
  latitude: number | null;
  longitude: number | null;
  foto?: string;
  estado_civil?: string | null;
  nascimento?: string | null;
  discipuladorNome?: string | null;
  gcRole?: 'LIDER' | 'AUXILIAR' | null; // papel de liderança no GC
  isDiscipulador?: boolean;
  mae?: string | null;
  pai?: string | null;
  batismo?: string | null;
  data_de_vinculo?: string | null;
  data_de_cadastro?: string | null;
  esposo_a?: string | null;
}

interface SimulatedPair {
  memberIds: string[];
  distance: number;
  compatScore: number; // 0-100
  scoreBreakdown: {
    maturidade: number;
    tempoIgreja: number;
    estadoCivil: number;
    redeDisc: number;
    mesmaFuncao: number;
    faixaEtaria: number;
    momentoVida: number;
    bairroRegiao: number;
    distancia: number;
  };
}

export const Companionship: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'active' | 'assistant' | 'theology'>('active');
  const [members, setMembers] = useState<Member[]>([]);
  const [rawMembers, setRawMembers] = useState<any[]>([]);
  const [companionships, setCompanionships] = useState<CompanionshipData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Assistant States
  const [searchTerm, setSearchTerm] = useState('');
  const [sexFilter, setSexFilter] = useState<'Todos' | 'Masculino' | 'Feminino'>('Todos');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [trioSecondMember, setTrioSecondMember] = useState<Member | null>(null);

  // Simulation States
  const [isSimulationMode, setIsSimulationMode] = useState(false);
  const [simulatedMatches, setSimulatedMatches] = useState<SimulatedPair[]>([]);
  const [simulatedUnmatched, setSimulatedUnmatched] = useState<string[]>([]);
  const [simMaxDistance, setSimMaxDistance] = useState<number>(15); // Padrão: 15km para Brasília
  const [simMinScore, setSimMinScore] = useState<number>(50); // Padrão: 50 pontos
  const [simAllowTrios, setSimAllowTrios] = useState<boolean>(true);
  
  // Simulation Filter Toggles
  const [simEnforceSameGC, setSimEnforceSameGC] = useState<boolean>(false);
  const [simEnforceSameDisc, setSimEnforceSameDisc] = useState<boolean>(false);
  const [simEnforceProximity, setSimEnforceProximity] = useState<boolean>(true);
  const [simEnforceMaturity, setSimEnforceMaturity] = useState<boolean>(false);
  const [simEnforceSameMarital, setSimEnforceSameMarital] = useState<boolean>(false);
  const [simEnforceAgeCompatible, setSimEnforceAgeCompatible] = useState<boolean>(false);
  const [simEnforceSameTenure, setSimEnforceSameTenure] = useState<boolean>(false);
  const [simEnforceSameRole, setSimEnforceSameRole] = useState<boolean>(false);
  const [activeDiscipuladores, setActiveDiscipuladores] = useState<Set<string>>(new Set());
  
  // Modals / Input States
  const [newPrayerText, setNewPrayerText] = useState<Record<string, string>>({});
  const [newActivityText, setNewActivityText] = useState<Record<string, string>>({});
  const [newActivityType, setNewActivityType] = useState<Record<string, 'PALAVRA' | 'ORAÇÃO' | 'EVANGELISMO' | 'SERVIÇO'>>({});

  // Tipos elegíveis para companheirismo (exclui agregado, visitante, etc. - e presbíteros/diáconos já pareados)
  const ELIGIBLE_TYPES = ['MEMBRO', 'LÍDER', 'LIDER', 'DISCIPULADOR', 'DIÁCONO', 'DIACONO'];

  // Fórmula de Haversine para calcular distância geográfica em KM
  const calculateDistance = (lat1: number | null, lon1: number | null, lat2: number | null, lon2: number | null): number | null => {
    if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) return null;
    const R = 6371; // Raio da Terra em KM
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((R * c).toFixed(1));
  };

  // Carregar dados iniciais
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // 1. Carregar membros, discipulado e células em paralelo
        let membrosData: any[] = [];
        let discipuladoData: any[] = [];
        let celulasData: any[] = [];

        const [discipuladoRes, celulasRes] = await Promise.all([
          supabase
            .from('discipulado')
            .select('discipulador, discipulo'),
          supabase
            .from('celulas')
            .select('*')
        ]);

        if (!discipuladoRes.error && discipuladoRes.data) {
          discipuladoData = discipuladoRes.data;
        }
        if (!celulasRes.error && celulasRes.data) {
          celulasData = celulasRes.data;
        }

        // Tentar obter membros com batismo e data_de_vinculo
        const membrosFullRes = await supabase
          .from('membros')
          .select('id, nome, apelido, tipo_de_pessoa, sexo, bairro, grupos_caseiros, latitude, longitude, foto, estado_civil, nascimento, mae, pai, batismo, data_de_vinculo, data_de_cadastro, esposo_a')
          .eq('status', 'Ativo');

        if (membrosFullRes.error) {
          console.warn('Failed to load membros with batismo/data_de_vinculo columns, falling back to base columns...', membrosFullRes.error);
          const membrosBaseRes = await supabase
            .from('membros')
            .select('id, nome, apelido, tipo_de_pessoa, sexo, bairro, grupos_caseiros, latitude, longitude, foto, estado_civil, nascimento, mae, pai, data_de_cadastro, esposo_a')
            .eq('status', 'Ativo');
          
          if (membrosBaseRes.error) {
            throw membrosBaseRes.error;
          }
          membrosData = membrosBaseRes.data || [];
        } else {
          membrosData = membrosFullRes.data || [];
        }

        // Pre-calcular discipuladores ativos da base oficial de discipulado
        const discNames = new Set<string>();
        if (discipuladoData) {
          for (const d of discipuladoData) {
            if (d.discipulador) {
              discNames.add(d.discipulador.trim().toUpperCase());
            }
          }
        }
        setActiveDiscipuladores(discNames);

        // Mapa: nome do discípulo -> nome do discipulador
        const discipuladorDe: Record<string, string> = {};
        if (discipuladoData) {
          for (const d of discipuladoData) {
            if (d.discipulo && d.discipulador) {
              discipuladorDe[d.discipulo.trim().toUpperCase()] = d.discipulador.trim();
            }
          }
        }

        // Mapa: nome (uppercase) -> papel no GC (LIDER | AUXILIAR)
        const gcRoleMap: Record<string, 'LIDER' | 'AUXILIAR'> = {};
        if (celulasData) {
          for (const celula of celulasData) {
            if (celula.lider) {
              gcRoleMap[celula.lider.trim().toUpperCase()] = 'LIDER';
            }
            // Suporta a coluna antiga 'auxiliar' e as novas 'auxiliar_1' e 'auxiliar_2'
            const auxiliares = [
              celula.auxiliar,
              celula.auxiliar_1,
              celula.auxiliar_2
            ].filter(Boolean).join(',');

            if (auxiliares) {
              auxiliares.split(',').forEach((aux: string) => {
                const name = aux.trim().toUpperCase();
                if (name) gcRoleMap[name] = 'AUXILIAR';
              });
            }
          }
        }

        // Filtrar membros elegíveis e enriquecer com discipulador, papel no GC e isDiscipulador
        const filteredMembers = membrosData.filter(m => {
          const type = (m.tipo_de_pessoa || '').toUpperCase().trim();
          return ELIGIBLE_TYPES.includes(type);
        }).map(m => {
          const nameUpper = m.nome.trim().toUpperCase();
          return {
            ...m,
            discipuladorNome: discipuladorDe[nameUpper] || null,
            gcRole: gcRoleMap[nameUpper] || null,
            isDiscipulador: discNames.has(nameUpper),
          };
        });
        setRawMembers(membrosData);
        setMembers(filteredMembers);

        // 2. Carregar companheirismos dos perfis do Supabase (com fallback no localStorage)
        let list: CompanionshipData[] = [];
        
        try {
          const stored = localStorage.getItem('church_dynamic_roles');
          if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed.companionships && Array.isArray(parsed.companionships)) {
              list = parsed.companionships;
            }
          }
        } catch (_) {}

        // Sincronizar da nuvem
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('avatar')
          .eq('role', 'admin');

        if (!profilesError && profiles) {
          for (const p of profiles) {
            if (p.avatar && p.avatar.startsWith('{"')) {
              const parsed = JSON.parse(p.avatar);
              if (parsed.companionships && Array.isArray(parsed.companionships)) {
                list = parsed.companionships;
                break;
              }
            }
          }
        }

        setCompanionships(list);
      } catch (err) {
        console.error('Erro ao carregar dados de companheirismo:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Salvar companheirismos
  const saveCompanionships = async (updatedList: CompanionshipData[]) => {
    setIsSaving(true);
    setCompanionships(updatedList);
    try {
      let currentConfig: any = {};
      try {
        const stored = localStorage.getItem('church_dynamic_roles');
        if (stored) currentConfig = JSON.parse(stored);
      } catch (_) {}

      currentConfig.companionships = updatedList;
      localStorage.setItem('church_dynamic_roles', JSON.stringify(currentConfig));

      if (currentUser?.id) {
        await supabase.from('profiles').upsert({
          id: currentUser.id,
          email: currentUser.email,
          name: currentUser.name,
          role: currentUser.role,
          avatar: JSON.stringify(currentConfig),
          updated_at: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error('Erro ao salvar alianças de companheirismo:', err);
      alert('Erro ao persistir alterações na nuvem. Verifique sua conexão.');
    } finally {
      setIsSaving(false);
    }
  };

  // Identificar se um membro já possui companheirismo
  const getMemberCompanionship = (memberId: string) => {
    return companionships.find(c => c.memberIds.includes(memberId));
  };

  const isMemberLinked = (memberId: string) => {
    return !!getMemberCompanionship(memberId);
  };

  // Criar novo vínculo (Dupla ou Trio)
  const handleLinkMembers = () => {
    if (!selectedMember) return;
    
    const partnerIds = [selectedMember.id];
    
    // Obter vizinho geográfico selecionado
    const candidates = getRecommendedNeighbors(selectedMember);
    const closestId = candidates.length > 0 ? candidates[0].id : null;
    
    if (!closestId && !trioSecondMember) {
      alert('Selecione ao menos um parceiro para estabelecer o companheirismo.');
      return;
    }

    if (trioSecondMember) {
      partnerIds.push(trioSecondMember.id);
    } else if (closestId) {
      partnerIds.push(closestId);
    }

    // Criar objeto de companheirismo
    const newLink: CompanionshipData = {
      id: crypto.randomUUID(),
      memberIds: partnerIds,
      status: 'EM ORAÇÃO',
      dataInicio: new Date().toISOString().split('T')[0],
      oracoes: [],
      atividades: []
    };

    const newList = [...companionships, newLink];
    saveCompanionships(newList);
    
    // Resetar seleções
    setSelectedMember(null);
    setTrioSecondMember(null);
    setActiveTab('active');
    
    alert('Aliança de companheirismo iniciada com sucesso em modo "Em Oração"!');
  };

  // Criar vínculo manual rápido
  const handleManualLink = (m1Id: string, m2Id: string) => {
    const newLink: CompanionshipData = {
      id: crypto.randomUUID(),
      memberIds: [m1Id, m2Id],
      status: 'EM ORAÇÃO',
      dataInicio: new Date().toISOString().split('T')[0],
      oracoes: [],
      atividades: []
    };
    saveCompanionships([...companionships, newLink]);
    setSelectedMember(null);
    alert('Aliança iniciada com sucesso!');
  };

  // Excluir vínculo
  const handleDeleteLink = (id: string) => {
    if (!confirm('Deseja realmente desfazer esta aliança de companheirismo? Todos os históricos de atividades e orações do vínculo serão excluídos.')) {
      return;
    }
    const newList = companionships.filter(c => c.id !== id);
    saveCompanionships(newList);
  };

  // Alterar status
  const handleToggleStatus = (id: string, newStatus: 'EM ORAÇÃO' | 'ATIVO' | 'AJUSTE') => {
    const newList = companionships.map(c => {
      if (c.id === id) {
        return { ...c, status: newStatus };
      }
      return c;
    });
    saveCompanionships(newList);
  };

  // Adicionar motivo de oração
  const handleAddPrayer = (companionshipId: string) => {
    const text = newPrayerText[companionshipId];
    if (!text || !text.trim()) return;

    const newList = companionships.map(c => {
      if (c.id === companionshipId) {
        return {
          ...c,
          oracoes: [
            ...c.oracoes,
            { id: crypto.randomUUID(), pedido: text, respondido: false, criadoEm: new Date().toISOString() }
          ]
        };
      }
      return c;
    });

    saveCompanionships(newList);
    setNewPrayerText(prev => ({ ...prev, [companionshipId]: '' }));
  };

  // Alternar resposta de oração
  const handleTogglePrayer = (companionshipId: string, prayerId: string) => {
    const newList = companionships.map(c => {
      if (c.id === companionshipId) {
        return {
          ...c,
          oracoes: c.oracoes.map(o => o.id === prayerId ? { ...o, respondido: !o.respondido } : o)
        };
      }
      return c;
    });
    saveCompanionships(newList);
  };

  // Remover motivo de oração
  const handleRemovePrayer = (companionshipId: string, prayerId: string) => {
    const newList = companionships.map(c => {
      if (c.id === companionshipId) {
        return { ...c, oracoes: c.oracoes.filter(o => o.id !== prayerId) };
      }
      return c;
    });
    saveCompanionships(newList);
  };

  // Adicionar atividade conjunta
  const handleAddActivity = (companionshipId: string) => {
    const text = newActivityText[companionshipId];
    const type = newActivityType[companionshipId] || 'PALAVRA';
    if (!text || !text.trim()) return;

    const newList = companionships.map(c => {
      if (c.id === companionshipId) {
        return {
          ...c,
          atividades: [
            ...c.atividades,
            { id: crypto.randomUUID(), tipo: type, data: new Date().toISOString().split('T')[0], descricao: text }
          ]
        };
      }
      return c;
    });

    saveCompanionships(newList);
    setNewActivityText(prev => ({ ...prev, [companionshipId]: '' }));
  };

  // Remover atividade
  const handleRemoveActivity = (companionshipId: string, activityId: string) => {
    const newList = companionships.map(c => {
      if (c.id === companionshipId) {
        return { ...c, atividades: c.atividades.filter(a => a.id !== activityId) };
      }
      return c;
    });
    saveCompanionships(newList);
  };

  // Nome normalizado para comparação robusta
  const normName = (name: string | null | undefined): string => {
    if (!name) return '';
    return name.trim().toUpperCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, ' ');
  };

  // Verifica se dois membros são irmãos de sangue
  const isSibling = (m1: Member, m2: Member): boolean => {
    const mae1 = normName(m1.mae);
    const mae2 = normName(m2.mae);
    const pai1 = normName(m1.pai);
    const pai2 = normName(m2.pai);
    
    // Se mães batem e não estão vazias
    if (mae1 && mae2 && mae1 === mae2) return true;
    // Se pais batem e não estão vazias
    if (pai1 && pai2 && pai1 === pai2) return true;
    
    // Fallback: Se residem nas mesmas coordenadas exatas E têm o mesmo sobrenome principal
    if (m1.latitude !== null && m1.longitude !== null && m1.latitude === m2.latitude && m1.longitude === m2.longitude) {
      const p1 = m1.nome.trim().split(/\s+/);
      const p2 = m2.nome.trim().split(/\s+/);
      const last1 = p1[p1.length - 1].toUpperCase();
      const last2 = p2[p2.length - 1].toUpperCase();
      if (last1.length > 2 && last1 === last2) return true;
    }
    return false;
  };

  // Verifica se há relação vertical (discipulador / discípulo)
  const isVertical = (m1: Member, m2: Member): boolean => {
    const nome1 = m1.nome.trim().toUpperCase();
    const nome2 = m2.nome.trim().toUpperCase();
    const disc1 = m1.discipuladorNome?.trim().toUpperCase() || null;
    const disc2 = m2.discipuladorNome?.trim().toUpperCase() || null;
    return disc1 === nome2 || disc2 === nome1;
  };

  // Verifica se dois membros são cunhados ou possuem relação direta de casamento/afins
  const isCunhadoOrInLaw = (m1: Member, m2: Member): boolean => {
    const spouse1Name = m1.esposo_a;
    const spouse2Name = m2.esposo_a;

    const spouse1 = spouse1Name ? members.find(m => normName(m.nome) === normName(spouse1Name)) : null;
    const spouse2 = spouse2Name ? members.find(m => normName(m.nome) === normName(spouse2Name)) : null;

    // 1. Se o cônjuge do m1 for irmão/irmã do m2
    if (spouse1 && isSibling(spouse1, m2)) return true;

    // 2. Se o cônjuge do m2 for irmão/irmã do m1
    if (spouse2 && isSibling(spouse2, m1)) return true;

    // 3. Se ambos são casados com pessoas que são irmãs entre si (concunhados)
    if (spouse1 && spouse2 && isSibling(spouse1, spouse2)) return true;

    return false;
  };

  // Método auxiliar para obter o tempo de igreja em anos (menor entre batismo e vinculo, fallback cadastro)
  const getTenureYears = (m: Member): number => {
    const dates = [m.batismo, m.data_de_vinculo, m.data_de_cadastro].filter(Boolean) as string[];
    if (dates.length === 0) return 3; // Padrão: 3 anos de casa
    const timeStamps = dates.map(d => new Date(d).getTime()).filter(t => !isNaN(t));
    if (timeStamps.length === 0) return 3;
    const minTimestamp = Math.min(...timeStamps);
    const oldestDate = new Date(minTimestamp);
    const today = new Date();
    let years = today.getFullYear() - oldestDate.getFullYear();
    const mDiff = today.getMonth() - oldestDate.getMonth();
    if (mDiff < 0 || (mDiff === 0 && today.getDate() < oldestDate.getDate())) {
      years--;
    }
    return Math.max(0, years);
  };

  // Resolve a função eclesiástica primária do membro
  const getMemberRole = (m: Member): 'DISCIPULADOR' | 'LIDER' | 'AUXILIAR' | 'MEMBRO' => {
    const nameUpper = m.nome.trim().toUpperCase();
    
    if (m.gcRole === 'LIDER') {
      return 'LIDER';
    }
    if (activeDiscipuladores.has(nameUpper)) {
      return 'DISCIPULADOR';
    }
    if (m.gcRole === 'AUXILIAR') {
      return 'AUXILIAR';
    }
    return 'MEMBRO';
  };

  const getRoleBadges = (m: Member): string[] => {
    const role = getMemberRole(m);
    if (role === 'LIDER') return ['líder'];
    if (role === 'AUXILIAR') return ['auxiliar'];
    if (role === 'DISCIPULADOR') return ['discipulador'];
    return ['membro'];
  };

  // Verifica se o par de membros satisfaz as flags de simulação ativadas no painel
  const meetsSimulatorConstraints = (m1: Member, m2: Member, dist: number | null): boolean => {
    const role1 = getMemberRole(m1);
    const role2 = getMemberRole(m2);

    // Regras de Equivalência:
    // 1. Discipulador com Discipulador apenas
    if ((role1 === 'DISCIPULADOR' || role2 === 'DISCIPULADOR') && role1 !== role2) {
      return false;
    }
    // 2. Líder de GC com Líder de GC apenas
    if ((role1 === 'LIDER' || role2 === 'LIDER') && role1 !== role2) {
      return false;
    }

    // 1. Mesmo GC (ou mesmo discipulado em região com múltiplos GCs)
    if (simEnforceSameGC) {
      const gc1 = (m1.grupos_caseiros || '').trim().toUpperCase();
      const gc2 = (m2.grupos_caseiros || '').trim().toUpperCase();
      const sameGC = gc1.length > 0 && gc1 === gc2;
      
      const r1 = getNormalizedRegion(m1.bairro, m1.grupos_caseiros);
      const r2 = getNormalizedRegion(m2.bairro, m2.grupos_caseiros);
      const sameRegion = r1 === r2;
      const hasMultipleGCs = sameRegion && (regionGcCounters[r1] > 1);
      
      if (!sameGC && !hasMultipleGCs) {
        return false;
      }
    }
    
    // 2. Mesmo discipulado
    if (simEnforceSameDisc) {
      const disc1 = m1.discipuladorNome?.trim().toUpperCase() || null;
      const disc2 = m2.discipuladorNome?.trim().toUpperCase() || null;
      if (!disc1 || disc1 !== disc2) return false;
    }
    
    // 3. Proximidade (dentro da distância limite definida)
    if (simEnforceProximity) {
      if (dist === null || dist > simMaxDistance) return false;
    }
    
    // 4. Maturidade compatível (diferença no rank <= 1)
    if (simEnforceMaturity) {
      const role1 = getMemberRole(m1);
      const role2 = getMemberRole(m2);
      const rawR1 = MATURITY_RANK[(m1.tipo_de_pessoa || '').toUpperCase().trim()] ?? 1;
      const rawR2 = MATURITY_RANK[(m2.tipo_de_pessoa || '').toUpperCase().trim()] ?? 1;
      const r1 = Math.max(rawR1, MATURITY_RANK[role1] ?? 1);
      const r2 = Math.max(rawR2, MATURITY_RANK[role2] ?? 1);
      if (Math.abs(r1 - r2) > 1) return false;
    }
    
    // 5. Mesmo Estado Civil
    if (simEnforceSameMarital) {
      const ec1 = normalizeMarital(m1.estado_civil);
      const ec2 = normalizeMarital(m2.estado_civil);
      if (ec1 === 'DESCONHECIDO' || ec2 === 'DESCONHECIDO' || ec1 !== ec2) return false;
    }
    
    // 6. Idade compatível (diferença <= 10 anos)
    if (simEnforceAgeCompatible) {
      const age1 = getAge(m1.nascimento);
      const age2 = getAge(m2.nascimento);
      if (age1 === null || age2 === null || Math.abs(age1 - age2) > 10) return false;
    }

    // 7. Tempo de Igreja Equivalente (diferença <= 3 anos)
    if (simEnforceSameTenure) {
      const t1 = getTenureYears(m1);
      const t2 = getTenureYears(m2);
      if (Math.abs(t1 - t2) > 3) return false;
    }

    // 8. Mesma Função Ministerial (reformulada para dimensões independentes)
    if (simEnforceSameRole) {
      const getGCRole = (m: Member) => {
        if (m.gcRole === 'LIDER') return 'LIDER';
        if (m.gcRole === 'AUXILIAR') return 'AUXILIAR';
        return 'MEMBRO';
      };
      const simGc1 = getGCRole(m1);
      const simGc2 = getGCRole(m2);
      const simIsDisc1 = !!m1.isDiscipulador;
      const simIsDisc2 = !!m2.isDiscipulador;

      const shareRole = 
        (simGc1 === simGc2 && simGc1 !== 'MEMBRO') || 
        (simIsDisc1 && simIsDisc2) || 
        (simGc1 === 'MEMBRO' && !simIsDisc1 && simGc2 === 'MEMBRO' && !simIsDisc2);

      if (!shareRole) return false;
    }
    
    return true;
  };

  // Algoritmo de sugestão por COMPATIBILIDADE MULTI-CRITÉRIO (não mais só distância)
  const getRecommendedNeighbors = (member: Member): (Member & { distance: number | null; compatScore: number; scoreBreakdown: SimulatedPair['scoreBreakdown'] })[] => {
    return members
      .filter(m => m.id !== member.id && m.sexo === member.sexo && !isMemberLinked(m.id))
      .map(m => {
        const dist = calculateDistance(member.latitude, member.longitude, m.latitude, m.longitude);
        
        // Se as flags adicionais não forem atendidas, tratar como totalmente incompatível (score = 0)
        if (!meetsSimulatorConstraints(member, m, dist)) {
          return { ...m, distance: dist, compatScore: 0, scoreBreakdown: { maturidade: 0, tempoIgreja: 0, estadoCivil: 0, redeDisc: 0, mesmaFuncao: 0, faixaEtaria: 0, momentoVida: 0, bairroRegiao: 0, distancia: 0 } };
        }
        
        const breakdown = calculateCompatibilityScore(member, m, dist);
        return { 
          ...m, 
          distance: dist, 
          compatScore: breakdown.total, 
          scoreBreakdown: { 
            maturidade: breakdown.maturidade, 
            tempoIgreja: breakdown.tempoIgreja,
            estadoCivil: breakdown.estadoCivil, 
            redeDisc: breakdown.redeDisc, 
            mesmaFuncao: breakdown.mesmaFuncao,
            faixaEtaria: breakdown.faixaEtaria, 
            momentoVida: breakdown.momentoVida,
            bairroRegiao: breakdown.bairroRegiao,
            distancia: breakdown.distancia 
          } 
        };
      })
      .filter(m => m.compatScore > 0) // Excluir completamente incompatíveis
      .sort((a, b) => b.compatScore - a.compatScore); // Ordenar por maior compatibilidade
  };

  // Helper para mapear critérios de pontuação positiva em motivos legíveis com badges
  const getCompatibilityReasons = (
    member: Member,
    candidate: Member & { scoreBreakdown: SimulatedPair['scoreBreakdown'] }
  ) => {
    const bd = candidate.scoreBreakdown;
    const reasons: {
      label: string;
      points: number;
      icon: React.ReactNode;
      color: string;
      tooltip: string;
    }[] = [];

    // --- MATURIDADE (0-10 pts) ---
    if (bd.maturidade > 0) {
      let label = 'Maturidade Compatível';
      if (bd.maturidade === 10) label = 'Mesma Maturidade';
      else if (bd.maturidade === 6) label = 'Maturidade Próxima';
      
      reasons.push({
        label,
        points: bd.maturidade,
        icon: <Compass className="h-3 w-3 shrink-0" />,
        color: 'bg-purple-50 text-purple-700 border-purple-100/70',
        tooltip: 'Alinhamento por maturidade e caminhada cristã'
      });
    }

    // --- TEMPO DE IGREJA (0-5 pts) ---
    if (bd.tempoIgreja > 0) {
      let label = 'Tempo de Igreja';
      if (bd.tempoIgreja === 5) label = 'Tempo de Igreja Idêntico';
      else if (bd.tempoIgreja === 3) label = 'Tempo de Igreja Próximo';
      else if (bd.tempoIgreja === 1) label = 'Tempo de Igreja Compatível';

      reasons.push({
        label,
        points: bd.tempoIgreja,
        icon: <Clock className="h-3 w-3 shrink-0" />,
        color: 'bg-teal-50 text-teal-700 border-teal-100/70',
        tooltip: 'Tempo de integração na igreja local'
      });
    }

    // --- ESTADO CIVIL (0-10 pts) ---
    if (bd.estadoCivil > 0) {
      let label = 'Estado Civil';
      if (bd.estadoCivil === 10) label = 'Mesmo Estado Civil';
      else if (bd.estadoCivil === 5) label = 'Fase Civil Compatível';

      reasons.push({
        label,
        points: bd.estadoCivil,
        icon: <Heart className="h-3 w-3 text-pink-500 shrink-0" />,
        color: 'bg-pink-50 text-pink-700 border-pink-100/70',
        tooltip: 'Mesmo estado civil ou fase de vida compatível'
      });
    }

    // --- REDE DE DISCIPULADO + GC (0-30 pts) ---
    if (bd.redeDisc > 0) {
      let label = 'Rede de Discipulado';
      const gc1 = (member.grupos_caseiros || '').trim().toUpperCase();
      const gc2 = (candidate.grupos_caseiros || '').trim().toUpperCase();
      const sameGC = gc1.length > 0 && gc1 === gc2;

      const bothLeadership = sameGC &&
        (member.gcRole === 'LIDER' || member.gcRole === 'AUXILIAR') &&
        (candidate.gcRole === 'LIDER' || candidate.gcRole === 'AUXILIAR');

      const disc1 = member.discipuladorNome?.trim().toUpperCase() || null;
      const disc2 = candidate.discipuladorNome?.trim().toUpperCase() || null;
      const sameDisc = disc1 !== null && disc2 !== null && disc1 === disc2;

      const r1Region = getNormalizedRegion(member.bairro, member.grupos_caseiros);
      const r2Region = getNormalizedRegion(candidate.bairro, candidate.grupos_caseiros);
      const sameRegion = r1Region === r2Region;
      const hasMultipleGCs = sameRegion && (regionGcCounters[r1Region] > 1);

      if (bothLeadership) {
        label = '👑 Núcleo de GC';
      } else if (bd.redeDisc === 28 && sameGC && sameDisc) {
        label = '🏠 Mesmo GC + 🔗 Mesmo Disc.';
      } else if (bd.redeDisc === 28 && hasMultipleGCs && sameDisc) {
        label = '🔗 Mesmo Disc. (Região)';
      } else if (sameGC) {
        label = '🏠 Mesmo GC';
      } else if (bd.redeDisc === 20) {
        label = '📍 Mesma Região (GCs Distintos)';
      } else if (sameDisc) {
        label = '🔗 Mesmo Discipulador';
      } else if (bd.redeDisc === 5) {
        label = 'Redes Distintas';
      } else if (bd.redeDisc === 2) {
        label = 'Discipulado Direto';
      }

      reasons.push({
        label,
        points: bd.redeDisc,
        icon: <Users className="h-3 w-3 shrink-0" />,
        color: 'bg-emerald-50 text-emerald-700 border-emerald-100/70',
        tooltip: 'Grupo Caseiro ou linha de discipulado comum'
      });
    }

    // --- FUNÇÃO MINISTERIAL (0-20 pts) ---
    if (bd.mesmaFuncao > 0) {
      let label = 'Função Ministerial';
      if (bd.mesmaFuncao === 20) label = 'Parceria de Auxiliares Próximos';
      else if (bd.mesmaFuncao === 10) label = 'Parceria de Auxiliares';
      else if (bd.mesmaFuncao === 5) {
        const getGCRole = (m: Member) => {
          if (m.gcRole === 'LIDER') return 'LIDER';
          if (m.gcRole === 'AUXILIAR') return 'AUXILIAR';
          return 'MEMBRO';
        };
        const reasonGc1 = getGCRole(member);
        const reasonGc2 = getGCRole(candidate);
        const reasonIsDisc1 = !!member.isDiscipulador;
        const reasonIsDisc2 = !!candidate.isDiscipulador;

        if (reasonIsDisc1 && reasonIsDisc2) label = 'Mesma Função (Discipulador)';
        else if (reasonGc1 === 'LIDER' && reasonGc2 === 'LIDER') label = 'Mesma Função (Líder)';
        else if (reasonGc1 === 'AUXILIAR' && reasonGc2 === 'AUXILIAR') label = 'Mesma Função (Auxiliar)';
        else label = 'Mesma Função (Membro)';
      }
      else if (bd.mesmaFuncao === 3) label = 'Líder & Auxiliar (GC)';
      else if (bd.mesmaFuncao === 1) label = 'Sinergia de Liderança';
      else if (bd.mesmaFuncao === 1) label = 'Sinergia de Liderança';

      reasons.push({
        label,
        points: bd.mesmaFuncao,
        icon: <Sparkles className="h-3 w-3 text-indigo-500 shrink-0" />,
        color: 'bg-indigo-50 text-indigo-700 border-indigo-100/70',
        tooltip: 'Sinergia de responsabilidade ou liderança'
      });
    }

    // --- FAIXA ETÁRIA (0-5 pts) ---
    if (bd.faixaEtaria > 0) {
      let label = 'Idade Compatível';
      if (bd.faixaEtaria === 5) label = 'Idades Muito Próximas (±3a)';
      else if (bd.faixaEtaria === 3) label = 'Idades Próximas (±7a)';
      else if (bd.faixaEtaria === 1) label = 'Idades Compatíveis (±12a)';

      reasons.push({
        label,
        points: bd.faixaEtaria,
        icon: <Smile className="h-3 w-3 shrink-0" />,
        color: 'bg-blue-50 text-blue-700 border-blue-100/70',
        tooltip: 'Aproximação e afinidade por faixa etária'
      });
    }

    // --- MOMENTO DE VIDA (0-5 pts) ---
    if (bd.momentoVida > 0) {
      let label = 'Momento de Vida';
      const getChildrenAges = (m: Member): number[] => {
        const nName = normName(m.nome);
        if (!nName) return [];
        return members
          .filter(c => {
            const pName = normName(c.pai);
            const mName = normName(c.mae);
            return (pName && pName === nName) || (mName && mName === nName);
          })
          .map(c => getAge(c.nascimento))
          .filter((age): age is number => age !== null);
      };
      const ages1 = getChildrenAges(member);
      const ages2 = getChildrenAges(candidate);
      if (ages1.length > 0 && ages2.length > 0) {
        if (bd.momentoVida === 5) label = 'Filhos com Idade Próxima (±3a)';
        else if (bd.momentoVida === 3) label = 'Filhos com Idade Compatível (±6a)';
        else label = 'Ambos têm Filhos';
      } else if (ages1.length === 0 && ages2.length === 0) {
        label = 'Ambos sem Filhos';
      }

      reasons.push({
        label,
        points: bd.momentoVida,
        icon: <Sparkles className="h-3 w-3 text-orange-500 shrink-0" />,
        color: 'bg-orange-50 text-orange-700 border-orange-100/70',
        tooltip: 'Afinidade de momento de vida e criação de filhos'
      });
    }

    // --- BAIRRO / REGIÃO (0-15 pts) ---
    if (bd.bairroRegiao > 0) {
      let label = 'Geografia Local';
      if (bd.bairroRegiao === 15) label = 'Mesmo Bairro';
      else if (bd.bairroRegiao === 10) label = 'Mesma Região';
      else if (bd.bairroRegiao === 5) label = 'Regiões Próximas';

      reasons.push({
        label,
        points: bd.bairroRegiao,
        icon: <Map className="h-3 w-3 shrink-0" />,
        color: 'bg-cyan-50 text-cyan-700 border-cyan-100/70',
        tooltip: 'Alinhamento residencial por bairro e proximidade de regiões'
      });
    }

    // --- DISTÂNCIA (0-15 pts) ---
    if (bd.distancia > 0) {
      let label = 'Distância';
      if (bd.distancia === 15) label = 'Mora Perto';
      else if (bd.distancia === 12) label = 'Mora Perto';
      else if (bd.distancia === 8) label = 'Distância Acessível';
      else if (bd.distancia === 3) label = 'Mora mais longe';
      else if (bd.distancia === 1) label = 'Mora muito longe';

      reasons.push({
        label,
        points: bd.distancia,
        icon: <MapPin className="h-3 w-3 shrink-0" />,
        color: 'bg-slate-50 text-slate-700 border-slate-200',
        tooltip: 'Proximidade geográfica residencial'
      });
    }

    // --- PENALIDADE DE IDADE/GERACIONAL ---
    if (member.nascimento && candidate.nascimento) {
      const age1 = getAge(member.nascimento);
      const age2 = getAge(candidate.nascimento);
      if (age1 !== null && age2 !== null) {
        const ageDiff = Math.abs(age1 - age2);
        if (ageDiff > 20) {
          reasons.push({
            label: 'Diferença Geracional (>20a)',
            points: -20,
            icon: <AlertTriangle className="h-3 w-3 shrink-0 text-red-500" />,
            color: 'bg-red-50 text-red-700 border-red-100/70',
            tooltip: 'Grande diferença de idade (relação tende a ser vertical/geracional)'
          });
        } else if (ageDiff > 15) {
          reasons.push({
            label: 'Diferença Geracional (>15a)',
            points: -10,
            icon: <AlertTriangle className="h-3 w-3 shrink-0 text-amber-500" />,
            color: 'bg-amber-50 text-amber-700 border-amber-100/70',
            tooltip: 'Diferença de idade relevante (relação tende a ser vertical/geracional)'
          });
        }
      }
    }

    return reasons;
  };


  // -----------------------------------------------------------------------
  // MOTOR DE COMPATIBILIDADE MULTI-CRITÉRIO (Pilares do Companheirismo)
  // -----------------------------------------------------------------------

  // Auxiliar para normalizar o bairro/região
  const getNormalizedRegion = (bairro?: string, gc?: string): string => {
    const b = (bairro || '').toUpperCase();
    const g = (gc || '').toUpperCase();
    
    if (b.includes('ÁGUAS CLARAS') || b.includes('AGUAS CLARAS') || g.includes('AGUAS CLARAS')) return 'AGUAS CLARAS';
    if (b.includes('TAGUATINGA') || g.includes('TAGUA')) return 'TAGUATINGA';
    if (b.includes('GUARÁ') || b.includes('GUARA') || g.includes('GUARÁ') || g.includes('GUARA')) return 'GUARA';
    if (b.includes('VICENTE PIRES') || g.includes('VICENTE PIRES')) return 'VICENTE PIRES';
    if (b.includes('SAMAMBAIA') || g.includes('SAMAMBAIA')) return 'SAMAMBAIA';
    if (b.includes('ASA SUL') || g.includes('ASA SUL')) return 'ASA SUL';
    if (b.includes('ASA NORTE') || g.includes('ASA NORTE')) return 'ASA NORTE';
    if (b.includes('SOBRADINHO') || g.includes('SOBRADINHO')) return 'SOBRADINHO';
    if (b.includes('RECANTO') || g.includes('RECANTO')) return 'RECANTO DAS EMAS';
    if (b.includes('CEILÂNDIA') || b.includes('CEILANDIA') || g.includes('CEILÂNDIA') || g.includes('CEILANDIA')) return 'CEILANDIA';
    
    return b
      .replace(/\s+(SUL|NORTE|LESTE|OESTE|I|II|III|IV|V)\b/g, '')
      .replace(/\(.*?\)/g, '')
      .trim();
  };

  const areRegionsAdjacent = (r1: string, r2: string): boolean => {
    const adjacencies: Record<string, string[]> = {
      'VICENTE PIRES': ['TAGUATINGA', 'AGUAS CLARAS', 'GUARA'],
      'AGUAS CLARAS': ['VICENTE PIRES', 'TAGUATINGA', 'GUARA', 'ARNIQUEIRA'],
      'TAGUATINGA': ['CEILANDIA', 'SAMAMBAIA', 'AGUAS CLARAS', 'VICENTE PIRES'],
      'GUARA': ['AGUAS CLARAS', 'VICENTE PIRES', 'ASA SUL'],
      'CEILANDIA': ['TAGUATINGA', 'SAMAMBAIA'],
      'SAMAMBAIA': ['TAGUATINGA', 'CEILANDIA', 'RECANTO DAS EMAS'],
      'ASA SUL': ['GUARA', 'ASA NORTE'],
      'ASA NORTE': ['ASA SUL', 'SETOR NOROESTE', 'LAGO NORTE'],
      'SETOR NOROESTE': ['ASA NORTE'],
    };
    return adjacencies[r1]?.includes(r2) || adjacencies[r2]?.includes(r1) || false;
  };

  // Mapeia região para conjunto de GCs únicos
  const regionGcCounters = React.useMemo(() => {
    const map: Record<string, Set<string>> = {};
    members.forEach(m => {
      const region = getNormalizedRegion(m.bairro, m.grupos_caseiros);
      const gc = (m.grupos_caseiros || '').trim().toUpperCase();
      if (gc && gc !== 'NENHUM') {
        if (!map[region]) {
          map[region] = new Set();
        }
        map[region].add(gc);
      }
    });
    
    // Converte para contagem
    const counts: Record<string, number> = {};
    Object.keys(map).forEach(r => {
      counts[r] = map[r].size;
    });
    return counts;
  }, [members]);

  // Hierarquia de maturidade espiritual (0=mais novo, maior=mais maduro)
  const MATURITY_RANK: Record<string, number> = {
    'MEMBRO': 1,
    'LIDER': 2, 'LÍDER': 2,
    'DIACONO': 3, 'DIÁCONO': 3,
    'DISCIPULADOR': 4,
    'PRESBITERO': 5, 'PRESBÍTERO': 5,
    'PASTOR': 6,
  };

  // Normaliza estado civil para grupos comparáveis
  const normalizeMarital = (ec: string | null | undefined): string => {
    if (!ec) return 'DESCONHECIDO';
    const upper = ec.toUpperCase().trim();
    if (upper.includes('SOLTEIR')) return 'SOLTEIRO';
    if (upper.includes('CASAD')) return 'CASADO';
    if (upper.includes('DIVORCI') || upper.includes('SEPAR')) return 'DIVORCIADO';
    if (upper.includes('VIUV')) return 'VIUVO';
    return upper;
  };

  // Calcula idade a partir de nascimento (string YYYY-MM-DD ou null)
  const getAge = (nascimento: string | null | undefined): number | null => {
    if (!nascimento) return null;
    const birth = new Date(nascimento);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return isNaN(age) ? null : age;
  };

  // Pontua compatibilidade entre dois membros (0-100)
  // Pesos: Maturidade=10, Função=5, Tempo=5, EstadoCivil=10, FaixaEtária=5, MomentoVida=5, RedeDisc=30, BairroRegião=15, Distância=15
  const calculateCompatibilityScore = (
    m1: Member, m2: Member, distKm: number | null
  ): SimulatedPair['scoreBreakdown'] & { total: number } => {
    // --- EXCLUSÕES CRÍTICAS (Irmãos de sangue, Relações Verticais e Regras de Equivalência de Função) ---
    const role1 = getMemberRole(m1);
    const role2 = getMemberRole(m2);

    // 1. Discipulador com Discipulador apenas
    if ((role1 === 'DISCIPULADOR' || role2 === 'DISCIPULADOR') && role1 !== role2) {
      return { maturidade: 0, tempoIgreja: 0, estadoCivil: 0, redeDisc: 0, mesmaFuncao: 0, faixaEtaria: 0, momentoVida: 0, bairroRegiao: 0, distancia: 0, total: 0 };
    }
    // 2. Líder de GC com Líder de GC apenas
    if ((role1 === 'LIDER' || role2 === 'LIDER') && role1 !== role2) {
      return { maturidade: 0, tempoIgreja: 0, estadoCivil: 0, redeDisc: 0, mesmaFuncao: 0, faixaEtaria: 0, momentoVida: 0, bairroRegiao: 0, distancia: 0, total: 0 };
    }

    if (isSibling(m1, m2) || isVertical(m1, m2)) {
      return { maturidade: 0, tempoIgreja: 0, estadoCivil: 0, redeDisc: 0, mesmaFuncao: 0, faixaEtaria: 0, momentoVida: 0, bairroRegiao: 0, distancia: 0, total: 0 };
    }

    // --- MATURIDADE ESPIRITUAL (0-10 pts) ---
    const rawR1 = MATURITY_RANK[(m1.tipo_de_pessoa || '').toUpperCase().trim()] ?? 1;
    const rawR2 = MATURITY_RANK[(m2.tipo_de_pessoa || '').toUpperCase().trim()] ?? 1;
    const r1 = Math.max(rawR1, MATURITY_RANK[role1] ?? 1);
    const r2 = Math.max(rawR2, MATURITY_RANK[role2] ?? 1);
    const rankDiff = Math.abs(r1 - r2);
    const maturidade = rankDiff === 0 ? 10 : rankDiff === 1 ? 6 : rankDiff === 2 ? 2 : 0;

    // --- ALINHAMENTO DE FUNÇÃO MINISTERIAL (0-20 pts) (reformulada para dimensões independentes) ---
    const getGCRole = (m: Member) => {
      if (m.gcRole === 'LIDER') return 'LIDER';
      if (m.gcRole === 'AUXILIAR') return 'AUXILIAR';
      return 'MEMBRO';
    };
    const scoreGc1 = getGCRole(m1);
    const scoreGc2 = getGCRole(m2);
    const scoreIsDisc1 = !!m1.isDiscipulador;
    const scoreIsDisc2 = !!m2.isDiscipulador;

    let mesmaFuncao = 0;
    if (scoreGc1 === 'AUXILIAR' && scoreGc2 === 'AUXILIAR') {
      // Parceria de Auxiliares: peso considerável se morarem perto
      if (distKm !== null && distKm <= 5) {
        mesmaFuncao = 20; // Próximo
      } else {
        mesmaFuncao = 10; // Distante
      }
    } else if ((scoreGc1 === scoreGc2 && scoreGc1 !== 'MEMBRO') || (scoreIsDisc1 && scoreIsDisc2)) {
      mesmaFuncao = 5;
    } else if ((scoreGc1 === 'LIDER' && scoreGc2 === 'AUXILIAR') || (scoreGc1 === 'AUXILIAR' && scoreGc2 === 'LIDER')) {
      mesmaFuncao = 3;
    } else if ((scoreIsDisc1 && (scoreGc2 === 'LIDER' || scoreGc2 === 'AUXILIAR')) || (scoreIsDisc2 && (scoreGc1 === 'LIDER' || scoreGc1 === 'AUXILIAR'))) {
      mesmaFuncao = 1;
    } else if (scoreGc1 === 'MEMBRO' && !scoreIsDisc1 && scoreGc2 === 'MEMBRO' && !scoreIsDisc2) {
      mesmaFuncao = 5; // ambos são membros comuns sem função de discipulado
    } else {
      mesmaFuncao = 0;
    }

    // --- TEMPO DE IGREJA (0-5 pts) ---
    const t1 = getTenureYears(m1);
    const t2 = getTenureYears(m2);
    const tenureDiff = Math.abs(t1 - t2);
    const tempoIgreja = tenureDiff <= 1 ? 5 : tenureDiff <= 3 ? 3 : tenureDiff <= 5 ? 1 : 0;

    // --- ESTADO CIVIL (0-10 pts) ---
    const ec1 = normalizeMarital(m1.estado_civil);
    const ec2 = normalizeMarital(m2.estado_civil);
    const estadoCivil = ec1 === ec2 && ec1 !== 'DESCONHECIDO' ? 10 :
      (ec1 === 'DESCONHECIDO' || ec2 === 'DESCONHECIDO') ? 5 : 0;

    // --- FAIXA ETÁRIA (0-5 pts) ---
    const age1 = getAge(m1.nascimento);
    const age2 = getAge(m2.nascimento);
    let faixaEtaria = 2;
    if (age1 !== null && age2 !== null) {
      const ageDiff = Math.abs(age1 - age2);
      faixaEtaria = ageDiff <= 3 ? 5 : ageDiff <= 7 ? 3 : ageDiff <= 12 ? 1 : 0;
    }

    // --- MOMENTO DE VIDA / FILHOS (0-5 pts) ---
    const getChildrenAges = (m: Member): number[] => {
      const nName = normName(m.nome);
      if (!nName) return [];
      return members
        .filter(c => {
          const pName = normName(c.pai);
          const mName = normName(c.mae);
          return (pName && pName === nName) || (mName && mName === nName);
        })
        .map(c => getAge(c.nascimento))
        .filter((age): age is number => age !== null);
    };

    const ages1 = getChildrenAges(m1);
    const ages2 = getChildrenAges(m2);

    let momentoVida = 0;
    if (ages1.length > 0 && ages2.length > 0) {
      let minAgeDiff = Infinity;
      for (const a1 of ages1) {
        for (const a2 of ages2) {
          const diff = Math.abs(a1 - a2);
          if (diff < minAgeDiff) {
            minAgeDiff = diff;
          }
        }
      }
      
      if (minAgeDiff <= 3) {
        momentoVida = 5;
      } else if (minAgeDiff <= 6) {
        momentoVida = 3;
      } else {
        momentoVida = 1;
      }
    } else if (ages1.length === 0 && ages2.length === 0) {
      momentoVida = 3;
    } else {
      momentoVida = 0;
    }

    // --- REDE DE DISCIPULADO + GC (0-30 pts) ---
    const disc1 = m1.discipuladorNome?.trim().toUpperCase() || null;
    const disc2 = m2.discipuladorNome?.trim().toUpperCase() || null;
    const gc1 = (m1.grupos_caseiros || '').trim().toUpperCase();
    const gc2 = (m2.grupos_caseiros || '').trim().toUpperCase();
    const sameGC = gc1.length > 0 && gc1 === gc2;
    const sameDisc = disc1 !== null && disc2 !== null && disc1 === disc2;

    const r1Region = getNormalizedRegion(m1.bairro, m1.grupos_caseiros);
    const r2Region = getNormalizedRegion(m2.bairro, m2.grupos_caseiros);
    const sameRegion = r1Region === r2Region;
    const hasMultipleGCs = sameRegion && (regionGcCounters[r1Region] > 1);

    // Bônus de núcleo de liderança: líder/auxiliar do mesmo GC
    const bothLeadership = sameGC &&
      (m1.gcRole === 'LIDER' || m1.gcRole === 'AUXILIAR') &&
      (m2.gcRole === 'LIDER' || m2.gcRole === 'AUXILIAR');
    let redeDisc = 0;
    if (bothLeadership) {
      redeDisc = 30; // Núcleo de liderança do mesmo GC
    } else if (sameGC && sameDisc) {
      redeDisc = 28; // Mesmo GC + mesmo discipulador
    } else if (hasMultipleGCs && sameDisc) {
      redeDisc = 28; // Múltiplos GCs na mesma região + mesmo discipulador
    } else if (sameGC) {
      redeDisc = 25; // Mesmo GC
    } else if (hasMultipleGCs) {
      redeDisc = 20; // Mesma Região (Múltiplos GCs)
    } else if (sameDisc) {
      redeDisc = 15; // Mesmo discipulador, GCs diferentes
    } else {
      redeDisc = 5;  // Redes distintas/neutro
    }

    // --- BAIRRO / REGIÃO (0-15 pts) ---
    let bairroRegiao = 0;
    const b1 = normName(m1.bairro);
    const b2 = normName(m2.bairro);
    const sameBairro = b1.length > 0 && b1 === b2;
    if (sameBairro) {
      bairroRegiao = 15;
    } else if (sameRegion) {
      bairroRegiao = 10;
    } else if (areRegionsAdjacent(r1Region, r2Region)) {
      bairroRegiao = 5;
    }

    // --- DISTÂNCIA GEOGRÁFICA (0-15 pts) ---
    let distancia = 0;
    if (distKm === null) {
      distancia = 2; // Sem coordenadas: pontuação neutra mínima
    } else if (distKm <= 2.5) {
      distancia = 15; // Vizinhos muito próximos
    } else if (distKm <= 5) {
      distancia = 12; // Próximos
    } else if (distKm <= 8) {
      distancia = 8;  // Acessível
    } else if (distKm <= 12) {
      distancia = 3;  // Distante
    } else if (distKm <= 15) {
      distancia = 1;  // Muito distante
    } else {
      distancia = 0;  // Inviável
    }

    // Calcular total
    let total = maturidade + mesmaFuncao + tempoIgreja + estadoCivil + faixaEtaria + momentoVida + redeDisc + bairroRegiao + distancia;

    // Penalidade por diferença geracional grande (relação deixa de ser horizontal/parcerias)
    if (age1 !== null && age2 !== null) {
      const ageDiff = Math.abs(age1 - age2);
      if (ageDiff > 20) {
        total = Math.max(0, total - 20); // Penalidade de 20 pontos para gap > 20 anos
      } else if (ageDiff > 15) {
        total = Math.max(0, total - 10); // Penalidade de 10 pontos para gap > 15 anos
      }
    }

    // Penalidade suave para cunhados
    if (isCunhadoOrInLaw(m1, m2)) {
      total = Math.max(0, total - 15); // Deduz 15 pontos para evitar incentivar cunhados na mesma dupla primária
    }

    return { maturidade, tempoIgreja, estadoCivil, redeDisc, mesmaFuncao, faixaEtaria, momentoVida, bairroRegiao, distancia, total };
  };

  const handleGenerateSimulation = () => {
    setIsLoading(true);

    // Pool: membros elegíveis sem vínculo ativo
    const pool = members.filter(m => !isMemberLinked(m.id));

    const simulated: SimulatedPair[] = [];
    const unmatched: string[] = [];
    const visited = new Set<string>();

    const sexes = ['Masculino', 'Feminino'];

    for (const s of sexes) {
      const sexPool = pool.filter(m => m.sexo === s);

      for (let i = 0; i < sexPool.length; i++) {
        const m1 = sexPool[i];
        if (visited.has(m1.id)) continue;

        let bestPartner: Member | null = null;
        let bestScore = -Infinity;
        let bestDist = Infinity;
        let bestBreakdown: SimulatedPair['scoreBreakdown'] | null = null;

        for (let j = i + 1; j < sexPool.length; j++) {
          const m2 = sexPool[j];
          if (visited.has(m2.id)) continue;

          const dist = calculateDistance(m1.latitude, m1.longitude, m2.latitude, m2.longitude);

          // Se ambos têm coordenadas, aplicar limite de distância
          if (m1.latitude !== null && m2.latitude !== null && dist !== null && dist > simMaxDistance) continue;

          // Se a flag de proximidade exigir e não satisfizer, pular
          if (simEnforceProximity && (dist === null || dist > simMaxDistance)) continue;

          // Se as flags adicionais de simulação não forem satisfeitas, pular
          if (!meetsSimulatorConstraints(m1, m2, dist)) continue;

          const breakdown = calculateCompatibilityScore(m1, m2, dist);
          if (breakdown.total >= simMinScore && breakdown.total > bestScore) {
            bestScore = breakdown.total;
            bestPartner = m2;
            bestDist = dist ?? 0;
            bestBreakdown = { 
              maturidade: breakdown.maturidade, 
              tempoIgreja: breakdown.tempoIgreja,
              estadoCivil: breakdown.estadoCivil, 
              redeDisc: breakdown.redeDisc, 
              mesmaFuncao: breakdown.mesmaFuncao,
              faixaEtaria: breakdown.faixaEtaria, 
              momentoVida: breakdown.momentoVida,
              bairroRegiao: breakdown.bairroRegiao,
              distancia: breakdown.distancia 
            };
          }
        }

        if (bestPartner && bestBreakdown && bestScore >= simMinScore) {
          visited.add(m1.id);
          visited.add(bestPartner.id);
          simulated.push({
            memberIds: [m1.id, bestPartner.id],
            distance: bestDist,
            compatScore: bestScore,
            scoreBreakdown: bestBreakdown
          });
        } else {
          // Membro sem parceiro compatível — vai para órfãos
          if (!visited.has(m1.id)) unmatched.push(m1.id);
        }
      }

      // Capturar quem não foi visitado
      sexPool.filter(m => !visited.has(m.id)).forEach(m => {
        if (!unmatched.includes(m.id)) unmatched.push(m.id);
      });
    }

    // Formação de Trios para órfãos com coordenadas
    let finalUnmatched = [...unmatched];
    if (simAllowTrios && unmatched.length > 0) {
      const remainingUnmatched: string[] = [];

      for (const unmatchedId of unmatched) {
        const unmatchedMember = members.find(m => m.id === unmatchedId);
        if (!unmatchedMember) { remainingUnmatched.push(unmatchedId); continue; }

        // Encontrar a dupla existente com maior score de compatibilidade para absorver este órfão
        let bestPairIdx = -1;
        let bestPairScore = -Infinity;

        for (let i = 0; i < simulated.length; i++) {
          const pair = simulated[i];
          if (pair.memberIds.length >= 3) continue;

          const pairLeader = members.find(m => m.id === pair.memberIds[0]);
          if (!pairLeader || pairLeader.sexo !== unmatchedMember.sexo) continue;

          const dist = calculateDistance(unmatchedMember.latitude, unmatchedMember.longitude, pairLeader.latitude, pairLeader.longitude);
          if (pairLeader.latitude !== null && unmatchedMember.latitude !== null && dist !== null && dist > simMaxDistance) continue;

          if (simEnforceProximity && (dist === null || dist > simMaxDistance)) continue;

          // Trio also needs to meet constraints and NOT be sibling or vertical with EITHER of the existing members of the pair
          const pairPartner = members.find(m => m.id === pair.memberIds[1]);
          if (pairPartner) {
            // Sibling/vertical exclusions
            if (isSibling(unmatchedMember, pairLeader) || isSibling(unmatchedMember, pairPartner)) continue;
            if (isVertical(unmatchedMember, pairLeader) || isVertical(unmatchedMember, pairPartner)) continue;
            
            // Check simulator flags
            if (!meetsSimulatorConstraints(unmatchedMember, pairLeader, dist)) continue;
            const distWithPartner = calculateDistance(unmatchedMember.latitude, unmatchedMember.longitude, pairPartner.latitude, pairPartner.longitude);
            if (!meetsSimulatorConstraints(unmatchedMember, pairPartner, distWithPartner)) continue;
          } else {
            if (!meetsSimulatorConstraints(unmatchedMember, pairLeader, dist)) continue;
          }

          const bd = calculateCompatibilityScore(unmatchedMember, pairLeader, dist);
          if (bd.total >= simMinScore && bd.total > bestPairScore) {
            bestPairScore = bd.total;
            bestPairIdx = i;
          }
        }

        if (bestPairIdx !== -1) {
          simulated[bestPairIdx].memberIds.push(unmatchedId);
          // Atualizar score médio do trio
          const p1 = members.find(m => m.id === simulated[bestPairIdx].memberIds[0])!;
          const p2 = members.find(m => m.id === simulated[bestPairIdx].memberIds[1])!;
          const d12 = calculateDistance(p1.latitude, p1.longitude, p2.latitude, p2.longitude);
          const d13 = calculateDistance(p1.latitude, p1.longitude, unmatchedMember.latitude, unmatchedMember.longitude);
          simulated[bestPairIdx].distance = parseFloat((((d12 ?? 0) + (d13 ?? 0)) / 2).toFixed(1));
        } else {
          remainingUnmatched.push(unmatchedId);
        }
      }
      finalUnmatched = remainingUnmatched;
    }

    setSimulatedUnmatched(finalUnmatched);
    setSimulatedMatches(simulated);
    setIsSimulationMode(true);
    setIsLoading(false);
  };

  // Descartar uma proposta específica da simulação
  const handleRemoveSimulatedMatch = (idxToRemove: number) => {
    const match = simulatedMatches[idxToRemove];
    if (!match) return;

    // Retornar membros de volta ao pool de órfãos (simulatedUnmatched)
    setSimulatedUnmatched(prev => {
      const updated = [...prev];
      match.memberIds.forEach(id => {
        if (!updated.includes(id)) updated.push(id);
      });
      return updated;
    });

    // Remover da lista de propostas
    setSimulatedMatches(prev => prev.filter((_, idx) => idx !== idxToRemove));
  };

  // Tentar outro parceiro para o membro titular (Re-mapear / Re-roll)
  const handleRefreshSimulatedMatch = (idx: number) => {
    const match = simulatedMatches[idx];
    if (!match) return;

    const idA = match.memberIds[0];
    const m1 = members.find(m => m.id === idA);
    if (!m1) return;

    const currentPartners = match.memberIds.slice(1);

    // 1. Encontrar o pool de todos os membros do mesmo sexo sem vínculo ativo oficial
    const poolSameSex = members.filter(m => 
      m.sexo === m1.sexo && 
      m.id !== m1.id && 
      !isMemberLinked(m.id)
    );

    // 2. Excluir os parceiros atuais para garantir que não vamos escolher os mesmos
    const eligibleCandidates = poolSameSex.filter(m => !currentPartners.includes(m.id));

    // 3. Avaliar candidatos sob as restrições e calcular pontuação
    interface CandidateResult {
      member: Member;
      score: number;
      dist: number;
      breakdown: SimulatedPair['scoreBreakdown'];
    }
    const results: CandidateResult[] = [];

    eligibleCandidates.forEach(m2 => {
      const dist = calculateDistance(m1.latitude, m1.longitude, m2.latitude, m2.longitude);

      // Aplicar filtros de distância
      if (m1.latitude !== null && m2.latitude !== null && dist !== null && dist > simMaxDistance) return;
      if (simEnforceProximity && (dist === null || dist > simMaxDistance)) return;

      // Verificar restrições do simulador (mesmo GC, mesmo Discipulado, etc)
      if (!meetsSimulatorConstraints(m1, m2, dist)) return;

      // Calcular score de compatibilidade
      const breakdown = calculateCompatibilityScore(m1, m2, dist);
      if (breakdown.total >= simMinScore) {
        results.push({
          member: m2,
          score: breakdown.total,
          dist: dist ?? 0,
          breakdown: {
            maturidade: breakdown.maturidade,
            tempoIgreja: breakdown.tempoIgreja,
            estadoCivil: breakdown.estadoCivil,
            redeDisc: breakdown.redeDisc,
            mesmaFuncao: breakdown.mesmaFuncao,
            faixaEtaria: breakdown.faixaEtaria,
            momentoVida: breakdown.momentoVida,
            bairroRegiao: breakdown.bairroRegiao,
            distancia: breakdown.distancia
          }
        });
      }
    });

    if (results.length === 0) {
      alert(`Não foi possível encontrar outro parceiro compatível para ${formatName(m1.nome)} dentro das restrições atuais.`);
      return;
    }

    // Ordenar por score de compatibilidade (maior primeiro)
    results.sort((a, b) => b.score - a.score);
    
    const bestMatch = results[0];
    const bestPartner = bestMatch.member;
    const bestScore = bestMatch.score;
    const bestDist = bestMatch.dist;
    const bestBreakdown = bestMatch.breakdown;
    const newPartnerId = bestPartner.id;

    // 4. Atualizar os estados de simulatedUnmatched e simulatedMatches
    // Coloca os parceiros antigos de volta no pool de órfãos
    let updatedUnmatched = [...simulatedUnmatched, ...currentPartners];

    // Se o novo parceiro estava no pool de órfãos, removemos ele de lá
    updatedUnmatched = updatedUnmatched.filter(id => id !== newPartnerId);

    // Se o novo parceiro estava em outra proposta simulada, precisamos atualizar ou dissolver essa outra proposta
    let updatedMatches = simulatedMatches.map((sm, i) => {
      if (i === idx) {
        // Atualiza a proposta atual para ser a nova dupla
        return {
          memberIds: [idA, newPartnerId],
          distance: bestDist,
          compatScore: bestScore,
          scoreBreakdown: bestBreakdown
        };
      }
      return sm;
    });

    // Encontrar se o novo parceiro está em outra proposta
    const otherMatchIdx = simulatedMatches.findIndex((sm, i) => i !== idx && sm.memberIds.includes(newPartnerId));
    
    if (otherMatchIdx !== -1) {
      const otherMatch = simulatedMatches[otherMatchIdx];
      const remainingIds = otherMatch.memberIds.filter(id => id !== newPartnerId);

      if (remainingIds.length <= 1) {
        // Se sobrou 0 ou 1 membro na outra proposta, removemos ela completamente dos matches
        updatedMatches = updatedMatches.filter((_, i) => i !== otherMatchIdx);
        // E jogamos o membro restante (se houver) de volta para o pool de órfãos
        remainingIds.forEach(id => {
          if (!updatedUnmatched.includes(id)) {
            updatedUnmatched.push(id);
          }
        });
      } else {
        // Se era um trio e sobrou 2 membros (virou dupla), recalculamos o score para eles
        const p1 = members.find(m => m.id === remainingIds[0])!;
        const p2 = members.find(m => m.id === remainingIds[1])!;
        const d = calculateDistance(p1.latitude, p1.longitude, p2.latitude, p2.longitude);
        const bd = calculateCompatibilityScore(p1, p2, d);

        updatedMatches[otherMatchIdx] = {
          memberIds: remainingIds,
          distance: d ?? 0,
          compatScore: bd.total,
          scoreBreakdown: {
            maturidade: bd.maturidade,
            tempoIgreja: bd.tempoIgreja,
            estadoCivil: bd.estadoCivil,
            redeDisc: bd.redeDisc,
            mesmaFuncao: bd.mesmaFuncao,
            faixaEtaria: bd.faixaEtaria,
            momentoVida: bd.momentoVida,
            bairroRegiao: bd.bairroRegiao,
            distancia: bd.distancia
          }
        };
      }
    }

    // Salvar estados atualizados
    setSimulatedUnmatched(updatedUnmatched);
    setSimulatedMatches(updatedMatches);
  };

  // Efetivar simulação (Salvar em lote)
  const handleApplySimulation = () => {
    if (simulatedMatches.length === 0) return;
    
    if (!confirm(`Deseja efetivar a simulação e criar automaticamente ${simulatedMatches.length} novas alianças de companheirismo na base oficial? Todos os membros serão iniciados no status "Em Oração".`)) {
      return;
    }

    const newCovenants: CompanionshipData[] = simulatedMatches.map(sm => ({
      id: crypto.randomUUID(),
      memberIds: sm.memberIds,
      status: 'EM ORAÇÃO',
      dataInicio: new Date().toISOString().split('T')[0],
      oracoes: [],
      atividades: []
    }));

    const mergedList = [...companionships, ...newCovenants];
    saveCompanionships(mergedList);
    
    setIsSimulationMode(false);
    setSimulatedMatches([]);
    setSimulatedUnmatched([]);
    setActiveTab('active');
    
    alert('Simulação georreferenciada gravada com sucesso! Vínculos ativos criados.');
  };

  // Descartar simulação
  const handleDiscardSimulation = () => {
    setIsSimulationMode(false);
    setSimulatedMatches([]);
    setSimulatedUnmatched([]);
  };

  // Filtro de membros sem companheiro
  const unlinkedMembers = members.filter(m => !isMemberLinked(m.id));
  
  const filteredUnlinked = unlinkedMembers.filter(m => {
    const matchesSearch = m.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (m.bairro || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSex = sexFilter === 'Todos' || m.sexo === sexFilter;
    return matchesSearch && matchesSex;
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Administrativo Premium */}
      <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between bg-white p-6 rounded-2xl border border-gray-100 shadow-sm gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 flex items-center gap-3">
              <Handshake className="h-8 w-8 text-blue-600 animate-pulse" />
              Juntas e Ligamentos
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-700/10">
              🔒 Modo Administrativo
            </span>
          </div>
          <p className="mt-2 text-sm text-gray-500">
            Mapeamento, alianças geográficas e edificação horizontal mútua (MDA).
          </p>
        </div>

        {/* Resumos Estatísticos Dinâmicos */}
        <div className="flex gap-4">
          <div className="bg-gray-50/80 rounded-xl px-4 py-2 text-center border border-gray-100">
            <div className="text-2xl font-bold text-gray-900">{companionships.length}</div>
            <div className="text-xs text-gray-500 font-medium">Alianças Ativas</div>
          </div>
          <div className="bg-amber-50/50 rounded-xl px-4 py-2 text-center border border-amber-100/50">
            <div className="text-2xl font-bold text-amber-600">{unlinkedMembers.length}</div>
            <div className="text-xs text-amber-700 font-medium">Sem Vínculo</div>
          </div>
        </div>
      </header>

      {/* Banner de Modo de Simulação Ativado */}
      {isSimulationMode && (
        <div className="bg-amber-500 text-white rounded-2xl p-4 shadow-lg border border-amber-600 flex flex-col md:flex-row items-center justify-between gap-4 animate-bounce" style={{ animationDuration: '6s' }}>
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 shrink-0 text-white" />
            <div>
              <div className="font-bold text-sm">Modo de Simulação Geográfica Ativo!</div>
              <div className="text-xs text-white/90">
                O motor gerou <strong>{simulatedMatches.length} alianças simuladas</strong> e deixou <strong>{simulatedUnmatched.length} órfãos</strong> com distância limite de {simMaxDistance}km.
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleApplySimulation}
              className="bg-white text-amber-600 hover:bg-gray-50 px-4 py-2 rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 flex items-center gap-1.5"
            >
              <CheckCircle2 className="h-4 w-4" /> Efetivar e Gravar na Nuvem
            </button>
            <button
              onClick={handleDiscardSimulation}
              className="bg-amber-600 hover:bg-amber-700 text-white border border-amber-700 px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5"
            >
              <XCircle className="h-4 w-4" /> Descartar
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('active')}
            className={clsx(
              activeTab === 'active'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700',
              'whitespace-nowrap border-b-2 py-4 px-1 text-sm transition-all'
            )}
          >
            Alianças Ativas ({companionships.length})
          </button>
          <button
            onClick={() => setActiveTab('assistant')}
            className={clsx(
              activeTab === 'assistant'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700',
              'whitespace-nowrap border-b-2 py-4 px-1 text-sm transition-all'
            )}
          >
            {isSimulationMode ? 'Revisar Simulação' : 'Assistente de Proximidade'} ({unlinkedMembers.length})
          </button>
          <button
            onClick={() => setActiveTab('theology')}
            className={clsx(
              activeTab === 'theology'
                ? 'border-blue-600 text-blue-600 font-semibold'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700',
              'whitespace-nowrap border-b-2 py-4 px-1 text-sm transition-all'
            )}
          >
            Fundamentos & Pilares
          </button>
        </nav>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="text-center space-y-3">
            <div className="h-10 w-10 border-4 border-blue-600 border-t-transparent animate-spin rounded-full mx-auto" />
            <p className="text-gray-500 text-sm">Processando dados geográficos da igreja...</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* ABA 1: ALIANÇAS ATIVAS */}
          {activeTab === 'active' && !isSimulationMode && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {companionships.map((c) => {
                const linkedMembers = c.memberIds.map(id => members.find(m => m.id === id)).filter(Boolean) as Member[];
                if (linkedMembers.length < 2) return null;
                
                const m1 = linkedMembers[0];
                const m2 = linkedMembers[1];
                const m3 = linkedMembers[2]; // Trio opcional
                
                // Calcular distância entre m1 e m2
                const dist12 = calculateDistance(m1.latitude, m1.longitude, m2.latitude, m2.longitude);
                
                return (
                  <div key={c.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col">
                    {/* Top Header Card */}
                    <div className="p-5 border-b border-gray-50 bg-gray-50/50 flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className={clsx(
                          c.status === 'ATIVO' ? 'bg-green-50 text-green-700 ring-green-600/20' : 
                          c.status === 'EM ORAÇÃO' ? 'bg-amber-50 text-amber-700 ring-amber-600/20' : 
                          'bg-red-50 text-red-700 ring-red-600/20',
                          'inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ring-1 ring-inset'
                        )}>
                          {c.status}
                        </span>
                        {dist12 !== null && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-700/10">
                            <MapPin className="h-3 w-3" />
                            {dist12} km de dist.
                          </span>
                        )}
                      </div>
                      
                      {/* Seleção de Status & Exclusão */}
                      <div className="flex items-center gap-3">
                        <select
                          value={c.status}
                          onChange={(e) => handleToggleStatus(c.id, e.target.value as any)}
                          className="text-xs bg-white border border-gray-200 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 font-medium"
                        >
                          <option value="EM ORAÇÃO">EM ORAÇÃO</option>
                          <option value="ATIVO">ATIVO</option>
                          <option value="AJUSTE">EM AJUSTE</option>
                        </select>
                        <button
                          onClick={() => handleDeleteLink(c.id)}
                          className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors"
                          title="Desfazer Vínculo"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Conteúdo dos Membros Vinculados */}
                    <div className="p-5 grid grid-cols-2 md:grid-cols-3 gap-4 border-b border-gray-50 bg-white">
                      {/* Membro 1 */}
                      <div className="text-center space-y-1">
                        <div className="h-12 w-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto text-base font-bold border border-blue-100 shadow-inner">
                          {m1.foto ? (
                            <img src={m1.foto} alt={m1.nome} className="h-12 w-12 rounded-full object-cover" />
                          ) : (
                            m1.nome.charAt(0)
                          )}
                        </div>
                        <div className="text-xs font-bold text-gray-800 line-clamp-1">{m1.apelido || formatName(m1.nome)}</div>
                        <div className="text-[10px] text-gray-400 font-medium capitalize">{m1.tipo_de_pessoa.toLowerCase()}</div>
                        <div className="text-[10px] text-gray-500 bg-gray-100 rounded py-0.5 px-1 inline-block truncate max-w-full">{m1.bairro || 'Sem Bairro'}</div>
                      </div>

                      {/* Ícone de Conexão */}
                      <div className="hidden md:flex flex-col items-center justify-center text-gray-400 text-xs gap-1">
                        <Handshake className="h-6 w-6 text-gray-300" />
                        <span className="font-semibold text-gray-400 text-[10px]">Aliança Horizontal</span>
                      </div>

                      {/* Membro 2 */}
                      <div className="text-center space-y-1">
                        <div className="h-12 w-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto text-base font-bold border border-blue-100 shadow-inner">
                          {m2.foto ? (
                            <img src={m2.foto} alt={m2.nome} className="h-12 w-12 rounded-full object-cover" />
                          ) : (
                            m2.nome.charAt(0)
                          )}
                        </div>
                        <div className="text-xs font-bold text-gray-800 line-clamp-1">{m2.apelido || formatName(m2.nome)}</div>
                        <div className="text-[10px] text-gray-400 font-medium capitalize">{m2.tipo_de_pessoa.toLowerCase()}</div>
                        <div className="text-[10px] text-gray-500 bg-gray-100 rounded py-0.5 px-1 inline-block truncate max-w-full">{m2.bairro || 'Sem Bairro'}</div>
                      </div>

                      {/* Membro 3 (Trio Opcional) */}
                      {m3 && (
                        <div className="col-span-2 md:col-span-3 text-center border-t border-dashed border-gray-100 pt-3 flex items-center justify-center gap-3">
                          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">Trio</span>
                          <div className="h-8 w-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-bold border border-indigo-100">
                            {m3.foto ? <img src={m3.foto} alt={m3.nome} className="h-8 w-8 rounded-full object-cover" /> : m3.nome.charAt(0)}
                          </div>
                          <div className="text-xs font-bold text-gray-800">{m3.apelido || m3.nome}</div>
                          <div className="text-[10px] text-gray-500 bg-gray-100 rounded py-0.5 px-1">{m3.bairro || 'Sem Bairro'}</div>
                        </div>
                      )}
                    </div>

                    {/* Ficha Prática: Oração & Atividades */}
                    <div className="p-5 flex-1 space-y-4 bg-white/50">
                      {/* 1. Motivos de Oração Mútua */}
                      <div>
                        <h4 className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1.5 uppercase tracking-wider">
                          <Heart className="h-3.5 w-3.5 text-red-500" /> Lista de Oração Mútua
                        </h4>
                        <ul className="space-y-1.5 max-h-36 overflow-y-auto mb-2 pr-1">
                          {c.oracoes?.map((o) => (
                            <li key={o.id} className="text-xs flex items-center justify-between bg-gray-50 p-2 rounded border border-gray-100 hover:bg-gray-100/70 transition-colors">
                              <span className={clsx(o.respondido ? 'line-through text-gray-400' : 'text-gray-700', 'font-medium break-words max-w-[80%]')}>
                                {o.pedido}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handleTogglePrayer(c.id, o.id)}
                                  className={clsx(o.respondido ? 'text-green-600' : 'text-gray-400 hover:text-green-600', 'p-0.5 rounded')}
                                  title={o.respondido ? 'Marcar como não respondido' : 'Marcar como Respondido!'}
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleRemovePrayer(c.id, o.id)}
                                  className="text-gray-300 hover:text-red-500 p-0.5"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </li>
                          ))}
                          {(!c.oracoes || c.oracoes.length === 0) && (
                            <li className="text-[11px] text-gray-400 text-center py-2 italic">Nenhum motivo de oração cadastrado.</li>
                          )}
                        </ul>
                        
                        {/* Input rápido de oração */}
                        <div className="flex gap-1">
                          <input
                            type="text"
                            placeholder="Adicionar pedido de oração..."
                            className="text-xs block w-full rounded border border-gray-200 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={newPrayerText[c.id] || ''}
                            onChange={(e) => setNewPrayerText(prev => ({ ...prev, [c.id]: e.target.value }))}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddPrayer(c.id)}
                          />
                          <button
                            onClick={() => handleAddPrayer(c.id)}
                            className="bg-blue-600 hover:bg-blue-700 text-white rounded px-2.5 py-1 text-xs font-semibold flex items-center justify-center transition-colors"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* 2. Práticas de Companheirismo */}
                      <div className="border-t border-gray-50 pt-4">
                        <h4 className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1.5 uppercase tracking-wider">
                          <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Registro de Atividades Conjuntas
                        </h4>
                        
                        <ul className="space-y-1.5 max-h-36 overflow-y-auto mb-2 pr-1">
                          {c.atividades?.map((a) => (
                            <li key={a.id} className="text-xs flex items-center justify-between bg-gray-50 p-2 rounded border border-gray-100">
                              <div className="space-y-0.5">
                                <span className={clsx(
                                  a.tipo === 'PALAVRA' ? 'bg-indigo-50 text-indigo-700' :
                                  a.tipo === 'ORAÇÃO' ? 'bg-red-50 text-red-700' :
                                  a.tipo === 'EVANGELISMO' ? 'bg-emerald-50 text-emerald-700' :
                                  'bg-amber-50 text-amber-700',
                                  'text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider mr-1.5'
                                )}>
                                  {a.tipo}
                                </span>
                                <span className="text-gray-700 font-medium">{a.descricao}</span>
                                <div className="text-[8px] text-gray-400 font-medium">Registrado em {a.data}</div>
                              </div>
                              <button
                                onClick={() => handleRemoveActivity(c.id, a.id)}
                                className="text-gray-300 hover:text-red-500 p-0.5"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </li>
                          ))}
                          {(!c.atividades || c.atividades.length === 0) && (
                            <li className="text-[11px] text-gray-400 text-center py-2 italic">Nenhuma atividade registrada ainda.</li>
                          )}
                        </ul>

                        {/* Adicionar Atividade Rápida */}
                        <div className="flex gap-1.5">
                          <select
                            value={newActivityType[c.id] || 'PALAVRA'}
                            onChange={(e) => setNewActivityType(prev => ({ ...prev, [c.id]: e.target.value as any }))}
                            className="text-xs bg-white border border-gray-200 rounded px-1.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                          >
                            <option value="PALAVRA">Palavra</option>
                            <option value="ORAÇÃO">Oração</option>
                            <option value="EVANGELISMO">Missão</option>
                            <option value="SERVIÇO">Serviço</option>
                          </select>
                          <input
                            type="text"
                            placeholder="Descreva a atividade em comum..."
                            className="text-xs block w-full rounded border border-gray-200 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={newActivityText[c.id] || ''}
                            onChange={(e) => setNewActivityText(prev => ({ ...prev, [c.id]: e.target.value }))}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddActivity(c.id)}
                          />
                          <button
                            onClick={() => handleAddActivity(c.id)}
                            className="bg-blue-600 hover:bg-blue-700 text-white rounded px-2.5 py-1 text-xs font-semibold flex items-center justify-center transition-colors"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {companionships.length === 0 && (
                <div className="col-span-2 text-center py-16 bg-white border border-gray-100 rounded-2xl shadow-sm space-y-3">
                  <Handshake className="h-12 w-12 text-gray-300 mx-auto" />
                  <h3 className="text-base font-bold text-gray-700">Nenhum companheirismo cadastrado.</h3>
                  <p className="text-gray-400 text-xs max-w-sm mx-auto">Vá para a aba "Assistente de Proximidade" para iniciar alianças inteligentes por localização.</p>
                </div>
              )}
            </div>
          )}

          {/* ABA 2: ASSISTENTE DE VÍNCULOS / REVISAR SIMULAÇÃO */}
          {activeTab === 'assistant' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              
              {/* Barra de Ferramentas de Simulação (Simulador em Massa) */}
              {!isSimulationMode ? (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50/50 rounded-2xl border border-blue-100/50 p-6 flex flex-col gap-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-1">
                      <h3 className="text-sm font-extrabold text-blue-900 flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-indigo-600 animate-pulse" />
                        Simulador Geográfico em Massa
                      </h3>
                      <p className="text-xs text-blue-700 leading-relaxed max-w-xl">
                        Deseja que o sistema simule automaticamente o companheirismo de todos os <strong>{unlinkedMembers.length} membros sem aliança</strong> de uma só vez baseando-se nas distâncias geográficas residenciais?
                      </p>
                    </div>

                    {/* Parâmetros e Gatilho */}
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-100 shadow-sm text-xs font-semibold text-gray-700">
                        <Sliders className="h-4 w-4 text-gray-400" />
                        Limite: 
                        <input
                          type="number"
                          className="w-12 text-center text-blue-600 bg-gray-50 border-0 p-0 font-bold focus:ring-0 focus:outline-none"
                          value={simMaxDistance}
                          onChange={(e) => setSimMaxDistance(Math.max(1, parseInt(e.target.value) || 1))}
                        /> km
                      </div>

                      <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-100 shadow-sm text-xs font-semibold text-gray-700">
                        <Sliders className="h-4 w-4 text-gray-400" />
                        Mín. Pontos: 
                        <input
                          type="number"
                          className="w-12 text-center text-blue-600 bg-gray-50 border-0 p-0 font-bold focus:ring-0 focus:outline-none"
                          value={simMinScore}
                          onChange={(e) => setSimMinScore(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                        /> pts
                      </div>

                      <label className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-100 shadow-sm text-xs font-semibold text-gray-700 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={simAllowTrios}
                          onChange={(e) => setSimAllowTrios(e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        Permitir Trios
                      </label>

                      <button
                        onClick={handleGenerateSimulation}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2 rounded-xl text-xs flex items-center gap-2 shadow hover:shadow-md transition-all active:scale-95"
                      >
                        <Play className="h-4 w-4 shrink-0 fill-current" /> Rodar Simulador
                      </button>
                    </div>
                  </div>

                  {/* Filtros Inteligentes (Pills) */}
                  <div className="border-t border-blue-100/50 pt-4 mt-2">
                    <div className="text-xs font-bold text-blue-900 mb-2 flex items-center gap-1.5">
                      <Filter className="h-3.5 w-3.5 text-indigo-500" />
                      Filtros & Restrições Inteligentes (Diminuir opções elegíveis):
                    </div>
                    <div className="flex flex-wrap gap-2.5">
                      {[
                        { id: 'sameGC', label: 'Mesmo GC', active: simEnforceSameGC, toggle: () => setSimEnforceSameGC(!simEnforceSameGC), color: 'border-emerald-200 text-emerald-700 bg-emerald-50/50 hover:bg-emerald-50' },
                        { id: 'sameDisc', label: 'Mesmo Discipulado', active: simEnforceSameDisc, toggle: () => setSimEnforceSameDisc(!simEnforceSameDisc), color: 'border-blue-200 text-blue-700 bg-blue-50/50 hover:bg-blue-50' },
                        { id: 'proximity', label: 'Restringir Distância', active: simEnforceProximity, toggle: () => setSimEnforceProximity(!simEnforceProximity), color: 'border-gray-200 text-gray-700 bg-gray-50/50 hover:bg-gray-100' },
                        { id: 'maturity', label: 'Maturidade Equivalente', active: simEnforceMaturity, toggle: () => setSimEnforceMaturity(!simEnforceMaturity), color: 'border-purple-200 text-purple-700 bg-purple-50/50 hover:bg-purple-50' },
                        { id: 'tenure', label: 'Tempo Equivalente (±3a)', active: simEnforceSameTenure, toggle: () => setSimEnforceSameTenure(!simEnforceSameTenure), color: 'border-teal-200 text-teal-700 bg-teal-50/50 hover:bg-teal-50' },
                        { id: 'marital', label: 'Mesmo Estado Civil', active: simEnforceSameMarital, toggle: () => setSimEnforceSameMarital(!simEnforceSameMarital), color: 'border-pink-200 text-pink-700 bg-pink-50/50 hover:bg-pink-50' },
                        { id: 'role', label: 'Mesma Função Ministerial', active: simEnforceSameRole, toggle: () => setSimEnforceSameRole(!simEnforceSameRole), color: 'border-indigo-200 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-50' },
                        { id: 'age', label: 'Idade Compatível (±10a)', active: simEnforceAgeCompatible, toggle: () => setSimEnforceAgeCompatible(!simEnforceAgeCompatible), color: 'border-amber-200 text-amber-700 bg-amber-50/50 hover:bg-amber-50' },
                      ].map((flag) => (
                        <button
                          key={flag.id}
                          onClick={flag.toggle}
                          className={clsx(
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold shadow-sm transition-all active:scale-95 cursor-pointer',
                            flag.active 
                              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-transparent' 
                              : flag.color
                          )}
                        >
                          <span className={clsx(
                            'w-4 h-4 rounded-full flex items-center justify-center border text-[9px]',
                            flag.active ? 'bg-white text-indigo-600 border-white' : 'border-current'
                          )}>
                            {flag.active ? '✓' : ''}
                          </span>
                          {flag.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* Controles do Modo Simulação Ativo */
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <h3 className="text-sm font-extrabold text-amber-900 flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 text-amber-600 animate-spin" style={{ animationDuration: '4s' }} />
                      Revisando Proposta Geográfica Simula
                    </h3>
                    <p className="text-xs text-amber-800">
                      As duplas e trios abaixo foram calculados e propostos. Revise e clique em <strong>Efetivar</strong> para criar as alianças ou em <strong>Descartar</strong> para voltar.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleApplySimulation}
                      className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow"
                    >
                      <CheckCircle2 className="h-4.5 w-4.5" /> Efetivar {simulatedMatches.length} Alianças
                    </button>
                    <button
                      onClick={handleDiscardSimulation}
                      className="bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 px-5 py-2 rounded-xl text-xs font-bold"
                    >
                      Descartar Proposta
                    </button>
                  </div>
                </div>
              )}

              {/* LISTAGEM PRINCIPAL DO ASSISTENTE / SIMULADOR */}
              {!isSimulationMode ? (
                /* Grid clássico do Assistente Geográfico Manual */
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                  {/* Painel Esquerdo: Lista de membros sem aliança */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm lg:col-span-1 flex flex-col max-h-[700px] overflow-hidden">
                    <div className="p-4 border-b border-gray-50 space-y-3">
                      <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Membros sem Aliança</h3>
                      
                      {/* Busca e Sexo */}
                      <div className="space-y-2">
                        <div className="relative">
                          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                          <input
                            type="text"
                            placeholder="Buscar por nome ou bairro..."
                            className="block w-full rounded-lg border-0 py-2 pl-10 pr-3 text-gray-900 ring-1 ring-inset ring-gray-200 placeholder:text-gray-400 focus:ring-1 focus:ring-blue-600 sm:text-xs"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                          />
                        </div>
                        
                        {/* Filtro Sexo */}
                        <div className="flex gap-1.5">
                          {(['Todos', 'Masculino', 'Feminino'] as const).map((s) => (
                            <button
                              key={s}
                              onClick={() => setSexFilter(s)}
                              className={clsx(
                                sexFilter === s ? 'bg-blue-50 text-blue-700 border-blue-200 font-semibold' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50',
                                'flex-1 text-[10px] border rounded-md py-1 text-center transition-all'
                              )}
                            >
                              {s === 'Todos' ? 'Ambos' : s === 'Masculino' ? 'Homens' : 'Mulheres'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Lista */}
                    <div className="overflow-y-auto divide-y divide-gray-50 p-2 space-y-1">
                      {filteredUnlinked.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => {
                            setSelectedMember(m);
                            setTrioSecondMember(null);
                          }}
                          className={clsx(
                            selectedMember?.id === m.id ? 'bg-blue-50/50 border-blue-200 shadow-sm' : 'border-transparent hover:bg-gray-50',
                            'w-full text-left p-3 rounded-xl border flex items-center gap-3 transition-all'
                          )}
                        >
                          <div className="h-10 w-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">
                            {m.foto ? <img src={m.foto} alt={m.nome} className="h-10 w-10 rounded-full object-cover" /> : m.nome.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-gray-900 truncate">{m.nome}</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={clsx(
                                m.sexo === 'Masculino' ? 'bg-blue-50 text-blue-700' : 'bg-pink-50 text-pink-700',
                                'text-[9px] font-bold px-1.5 py-0.5 rounded-full'
                              )}>
                                {m.sexo === 'Masculino' ? 'H' : 'M'}
                              </span>
                              {getRoleBadges(m).map(b => (
                                <span key={b} className={clsx(
                                  b === 'líder' || b === 'discipulador' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                  b === 'auxiliar' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                                  'bg-gray-100 text-gray-500 border border-gray-200',
                                  'text-[9px] font-bold px-1.5 py-0.5 rounded uppercase'
                                )}>
                                  {b}
                                </span>
                              ))}
                            </div>
                            <span className="text-[9px] text-gray-500 font-medium truncate block mt-0.5">📍 Bairro: {m.bairro || 'Não informado'}</span>
                          </div>
                        </button>
                      ))}

                      {filteredUnlinked.length === 0 && (
                        <div className="text-center py-12 text-gray-400 text-xs italic">Nenhum membro pendente encontrado.</div>
                      )}
                    </div>
                  </div>

                  {/* Painel Central e Direito: Sugestões e Mapa */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm lg:col-span-2 min-h-[400px] flex flex-col">
                    {selectedMember ? (
                      <div className="p-6 space-y-6 flex-1 flex flex-col justify-between">
                        <div>
                          {/* Perfil Selecionado */}
                          <div className="flex items-center gap-4 bg-gradient-to-r from-blue-50/50 to-indigo-50/30 p-4 rounded-2xl border border-blue-50/50">
                            <div className="h-14 w-14 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xl font-bold border border-blue-200">
                              {selectedMember.foto ? (
                                <img src={selectedMember.foto} alt={selectedMember.nome} className="h-14 w-14 rounded-full object-cover" />
                              ) : (
                                selectedMember.nome.charAt(0)
                              )}
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-gray-900">{selectedMember.nome}</h4>
                              <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-2">
                                <span>Sexo: <strong>{selectedMember.sexo}</strong></span>
                                <span>Bairro: <strong>{selectedMember.bairro || 'Sem Bairro'}</strong></span>
                                <span>GC: <strong>{selectedMember.grupos_caseiros || 'Nenhum'}</strong></span>
                                <span>Cargo: <strong className="text-indigo-600 uppercase">{getRoleBadges(selectedMember).join(' / ')}</strong></span>
                              </div>
                            </div>
                          </div>

                          {/* Motor de Compatibilidade Multi-Critério */}
                          <div className="mt-6 space-y-4">
                            <div className="flex items-center justify-between">
                              <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                                <Sparkles className="h-4 w-4 text-indigo-500 animate-pulse" />
                                Mais Compatíveis pelos Pilares
                              </h4>
                              <span className="text-[10px] text-gray-400 font-semibold italic">Mesmo sexo · sem aliança ativa</span>
                            </div>

                            {/* Lista de Candidatos por Compatibilidade */}
                            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                              {getRecommendedNeighbors(selectedMember).slice(0, 6).map((candidate, idx) => {
                                const isSelectedTrio = trioSecondMember?.id === candidate.id;
                                const score = candidate.compatScore;
                                const scoreColor = score >= 70 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : score >= 45 ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-red-700 bg-red-50 border-red-200';
                                const barColor = score >= 70 ? 'bg-emerald-500' : score >= 45 ? 'bg-amber-400' : 'bg-red-400';
                                const age = getAge(candidate.nascimento);
                                const ec = candidate.estado_civil;

                                return (
                                  <div
                                    key={candidate.id}
                                    className={clsx(
                                      idx === 0 ? 'ring-1 ring-indigo-400 bg-indigo-50/20' : 'bg-gray-50/50',
                                      'p-3 rounded-xl border border-gray-100 flex items-center justify-between gap-3 hover:bg-gray-50 transition-all'
                                    )}
                                  >
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                      <div className="relative shrink-0">
                                        <div className="h-9 w-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs border">
                                          {candidate.foto ? <img src={candidate.foto} alt={candidate.nome} className="h-9 w-9 rounded-full object-cover" /> : candidate.nome.charAt(0)}
                                        </div>
                                        {idx === 0 && (
                                          <span className="absolute -top-1 -left-1 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500 text-[8px] font-bold text-white shadow animate-bounce">
                                            1º
                                          </span>
                                        )}
                                      </div>
                                      
                                      <div className="min-w-0 flex-1">
                                        <div className="text-xs font-bold text-gray-900 truncate">{candidate.nome}</div>
                                        <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                          {ec && <span className="text-[9px] font-semibold text-indigo-600 bg-indigo-50 px-1 rounded">{ec}</span>}
                                          {age !== null && <span className="text-[9px] text-blue-600 bg-blue-50 px-1 rounded">{age}a</span>}
                                          {candidate.distance !== null && <span className="text-[9px] text-gray-400">📍{candidate.distance}km</span>}
                                          {(() => {
                                            const tenure = getTenureYears(candidate);
                                            return <span className="text-[9px] text-teal-700 bg-teal-50 px-1 rounded font-bold">⏳ {tenure}a de igreja</span>;
                                          })()}
                                          {(() => {
                                            const badges = getRoleBadges(candidate);
                                            return badges.map(b => (
                                              <span key={b} className="text-[9px] text-indigo-700 bg-indigo-50 px-1 rounded font-bold mr-1">💼 {b}</span>
                                            ));
                                          })()}
                                          {(() => {
                                            const sameGC = candidate.grupos_caseiros && candidate.grupos_caseiros.trim().toUpperCase() === (selectedMember.grupos_caseiros || '').trim().toUpperCase();
                                            const bothLeadership = sameGC && (candidate.gcRole === 'LIDER' || candidate.gcRole === 'AUXILIAR') && (selectedMember.gcRole === 'LIDER' || selectedMember.gcRole === 'AUXILIAR');
                                            if (bothLeadership) return <span className="text-[9px] text-purple-700 bg-purple-50 px-1 rounded font-bold">👑 Núcleo GC</span>;
                                            if (sameGC) return <span className="text-[9px] text-emerald-700 bg-emerald-50 px-1 rounded font-bold">🏠 Mesmo GC</span>;
                                            if (candidate.scoreBreakdown.redeDisc >= 8) return <span className="text-[9px] text-blue-700 bg-blue-50 px-1 rounded font-bold">🔗 Mesmo disc.</span>;
                                            return null;
                                          })()}
                                        </div>
                                        {/* Mini score bar */}
                                        <div className="flex items-center gap-1.5 mt-1">
                                          <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                                            <div className={clsx(barColor, 'h-full rounded-full')} style={{ width: `${score}%` }} />
                                          </div>
                                          <span className={clsx(scoreColor, 'text-[8px] font-bold border px-1 rounded-full')}>{score}pts</span>
                                        </div>

                                        {/* Detalhamento dos Pontos de Compatibilidade */}
                                        <div className="flex flex-wrap gap-1 mt-1.5 pt-1.5 border-t border-dashed border-gray-150">
                                          {getCompatibilityReasons(selectedMember, candidate).map((reason, rIdx) => (
                                            <span
                                              key={rIdx}
                                              className={clsx(
                                                reason.color,
                                                'inline-flex items-center gap-1 text-[8.5px] font-bold px-1.5 py-0.5 rounded border shadow-2sm transition-all hover:scale-105 select-none'
                                              )}
                                              title={reason.tooltip}
                                            >
                                              {reason.icon}
                                              <span>{reason.label}</span>
                                              <span className="font-extrabold">{reason.points > 0 ? '+' : ''}{reason.points}p</span>
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                      {/* Botão principal */}
                                      {idx === 0 ? (
                                        <button
                                          onClick={handleLinkMembers}
                                          className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                                        >
                                          <Plus className="h-3.5 w-3.5" /> Vincular
                                        </button>
                                      ) : (
                                        <button
                                          onClick={() => handleManualLink(selectedMember.id, candidate.id)}
                                          className="bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors"
                                        >
                                          Conectar
                                        </button>
                                      )}

                                      {/* Botão Trio */}
                                      <button
                                        onClick={() => setTrioSecondMember(isSelectedTrio ? null : candidate)}
                                        className={clsx(
                                          isSelectedTrio ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-transparent',
                                          'p-1.5 rounded-lg border text-[10px] font-bold transition-all'
                                        )}
                                        title="Incluir no Trio"
                                      >
                                        {isSelectedTrio ? '✕ Trio' : '+ Trio'}
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}

                              {getRecommendedNeighbors(selectedMember).length === 0 && (
                                <div className="text-center py-8 text-gray-400 text-xs italic">Nenhum companheiro compatível encontrado. Verifique se há membros do mesmo sexo com perfil complementar cadastrados.</div>
                              )}
                            </div>
                          </div>


                          {trioSecondMember && (
                            <div className="mt-4 bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-bold text-indigo-700 bg-indigo-100 rounded-full px-2 py-0.5 uppercase">Trio Ativado</span>
                                <span className="text-xs font-bold text-gray-700">Companheiro Adicional: {trioSecondMember.nome}</span>
                              </div>
                              <button
                                onClick={() => setTrioSecondMember(null)}
                                className="text-xs font-semibold text-red-600 hover:text-red-700"
                              >
                                Cancelar Trio
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Botão de Criação de Covenants */}
                        <div className="p-4 bg-gray-50 border-t border-gray-100 rounded-b-2xl flex justify-between items-center">
                          <span className="text-[10px] text-gray-400 font-semibold italic">Todos os vínculos começam no status "Em Oração"</span>
                          <button
                            onClick={handleLinkMembers}
                            disabled={isSaving}
                            className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold px-6 py-2.5 rounded-xl shadow hover:shadow-md hover:from-blue-700 hover:to-indigo-700 transition-all flex items-center gap-2 text-xs"
                          >
                            {isSaving ? 'Gravando...' : 'Iniciar Aliança de Companheirismo'}
                            <ArrowRight className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-gray-400 space-y-4">
                        <div className="h-16 w-16 rounded-full bg-gray-50 flex items-center justify-center text-gray-300">
                          <Compass className="h-8 w-8" />
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-sm font-bold text-gray-700">Assistente de Conexão Inteligente</h3>
                          <p className="text-xs text-gray-400 max-w-sm">Selecione um irmão ou irmã na lista à esquerda para carregar o motor geográfico e visualizar os vizinhos de residência mais próximos para recomendação.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* MODO SIMULAÇÃO EM ANDAMENTO: LISTAGEM DE DUPLAS E ÓRFÃOS */
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start animate-in fade-in duration-300">
                  
                  {/* Coluna Esquerda & Central: Grade de Duplas/Trios Propostos */}
                  <div className="lg:col-span-2 space-y-4">
                    <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                      <Sparkles className="h-4 w-4 text-amber-600" /> Vínculos Propostos ({simulatedMatches.length})
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto pr-1">
                      {simulatedMatches.map((sm, idx) => {
                        const smMembers = sm.memberIds.map(id => members.find(m => m.id === id)).filter(Boolean) as Member[];
                        if (smMembers.length < 2) return null;
                        
                        const m1 = smMembers[0];
                        const m2 = smMembers[1];
                        const m3 = smMembers[2];

                        const score = sm.compatScore;
                        const scoreColor = score >= 70 ? 'bg-emerald-500' : score >= 45 ? 'bg-amber-400' : 'bg-red-400';
                        const scoreTextColor = score >= 70 ? 'text-emerald-700' : score >= 45 ? 'text-amber-700' : 'text-red-700';
                        const scoreBg = score >= 70 ? 'bg-emerald-50 border-emerald-200' : score >= 45 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';
                        const scoreLabel = score >= 70 ? 'Alta' : score >= 45 ? 'Média' : 'Baixa';

                        // Detecção de in-laws (cunhados) na proposta
                        const hasInLaw = isCunhadoOrInLaw(m1, m2) || (m3 && (isCunhadoOrInLaw(m1, m3) || isCunhadoOrInLaw(m2, m3)));

                        const renderMemberTag = (m: Member) => {
                          const age = getAge(m.nascimento);
                          const ec = m.estado_civil ? m.estado_civil.charAt(0).toUpperCase() + m.estado_civil.slice(1).toLowerCase() : null;
                          return (
                            <div className="text-center space-y-1">
                              <div className="h-9 w-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs mx-auto border border-blue-100">
                                {m.foto ? <img src={m.foto} alt={m.nome} className="h-9 w-9 rounded-full object-cover" /> : m.nome.charAt(0)}
                              </div>
                              <div className="text-[10px] font-bold text-gray-800 truncate">{formatName(m.nome)}</div>
                              {(() => {
                                const badges = getRoleBadges(m);
                                return badges.map(b => (
                                  <div key={b} className={clsx(
                                    b === 'líder' || b === 'discipulador' ? 'text-amber-700 bg-amber-50 border-amber-100' :
                                    b === 'auxiliar' ? 'text-indigo-700 bg-indigo-50 border-indigo-100' :
                                    'text-gray-500 bg-gray-50 border-gray-150',
                                    'text-[8px] font-bold px-1 rounded border inline-block truncate max-w-full uppercase mr-1 mt-0.5'
                                  )}>
                                    {b}
                                  </div>
                                ));
                              })()}
                              {ec && <div className="text-[8px] font-medium text-indigo-600 bg-indigo-50 px-1 rounded-full inline-block">{ec}</div>}
                              {age !== null && <div className="text-[8px] text-gray-400">{age} anos</div>}
                            </div>
                          );
                        };

                        return (
                          <div key={idx} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm space-y-3 hover:shadow-md transition-all flex flex-col justify-between">
                            {/* Header: tipo + score */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded-full px-2 py-0.5">
                                  {m3 ? 'Trio Proposto' : 'Dupla Proposta'}
                                </span>
                                {hasInLaw && (
                                  <span className="text-[9px] font-bold text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5 animate-pulse" title="Membros possuem relação direta de cunhados ou parentesco familiar próximo.">
                                    ⚠️ Cunhados/Família
                                  </span>
                                )}
                                <div className="flex items-center gap-1 bg-gray-50 rounded-full border border-gray-150 px-1">
                                  <button
                                    onClick={() => handleRefreshSimulatedMatch(idx)}
                                    title="Tentar outro parceiro para este titular (Re-mapear)"
                                    className="text-gray-400 hover:text-blue-600 transition-colors p-1 rounded-full hover:bg-blue-50 cursor-pointer"
                                  >
                                    <RefreshCw className="h-3 w-3 hover:rotate-180 transition-transform duration-500" />
                                  </button>
                                  <div className="w-[1px] h-3 bg-gray-200" />
                                  <button
                                    onClick={() => handleRemoveSimulatedMatch(idx)}
                                    title="Desconsiderar proposta"
                                    className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded-full hover:bg-red-50 cursor-pointer"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                              <div className={clsx(scoreBg, 'border rounded-full px-2 py-0.5 flex items-center gap-1.5')}>
                                <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                  <div className={clsx(scoreColor, 'h-full rounded-full transition-all')} style={{ width: `${score}%` }} />
                                </div>
                                <span className={clsx(scoreTextColor, 'text-[9px] font-bold')}>{score}pts · {scoreLabel}</span>
                              </div>
                            </div>

                            {/* Membros */}
                            <div className="grid grid-cols-3 gap-2 items-center py-2 bg-gray-50/50 rounded-lg px-2">
                              {renderMemberTag(m1)}
                              <div className="text-center text-gray-300">
                                <Handshake className="h-5 w-5 mx-auto" />
                              </div>
                              {renderMemberTag(m2)}

                              {m3 && (
                                <div className="col-span-3 border-t border-dashed border-gray-200 pt-2 flex items-center justify-center gap-2">
                                  <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full">+Trio</span>
                                  {renderMemberTag(m3)}
                                </div>
                              )}
                            </div>

                            {/* Score Breakdown */}
                            <div className="grid grid-cols-9 gap-0.5 pt-1 border-t border-gray-50">
                              {[
                                { label: 'Maturidade', val: sm.scoreBreakdown.maturidade, max: 10, color: 'bg-purple-400' },
                                { label: 'Tempo', val: sm.scoreBreakdown.tempoIgreja, max: 5, color: 'bg-teal-400' },
                                { label: 'Est. Civil', val: sm.scoreBreakdown.estadoCivil, max: 10, color: 'bg-pink-400' },
                                { label: 'Rede Disc.', val: sm.scoreBreakdown.redeDisc, max: 30, color: 'bg-emerald-400' },
                                { label: 'Função', val: sm.scoreBreakdown.mesmaFuncao, max: 5, color: 'bg-indigo-400' },
                                { label: 'Faixa Et.', val: sm.scoreBreakdown.faixaEtaria, max: 5, color: 'bg-blue-400' },
                                { label: 'Mom. Vida', val: sm.scoreBreakdown.momentoVida, max: 5, color: 'bg-orange-400' },
                                { label: 'Região', val: sm.scoreBreakdown.bairroRegiao, max: 15, color: 'bg-cyan-400' },
                                { label: 'Distância', val: sm.scoreBreakdown.distancia, max: 15, color: 'bg-gray-400' },
                              ].map(({ label, val, max, color }) => (
                                <div key={label} className="text-center space-y-0.5">
                                  <div className="text-[7px] text-gray-400 font-medium leading-tight">{label}</div>
                                  <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                                    <div className={clsx(color, 'h-full rounded-full')} style={{ width: `${(val / (max || 1)) * 100}%` }} />
                                  </div>
                                  <div className="text-[8px] font-bold text-gray-500">{val}<span className="font-normal opacity-60">/{max}</span></div>
                                </div>
                              ))}
                            </div>

                            {/* Info de distância */}
                            {sm.distance > 0 && (
                              <div className="flex items-center gap-1 text-[9px] text-gray-400">
                                <MapPin className="h-3 w-3" /> {sm.distance} km de dist. geográfica
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Coluna Direita: Membros que restaram órfãos na simulação */}
                  <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm lg:col-span-1 flex flex-col max-h-[600px] overflow-hidden">
                    <div className="space-y-1 mb-4">
                      <h4 className="text-xs font-bold text-red-700 uppercase tracking-wider flex items-center gap-1.5">
                        <AlertTriangle className="h-4 w-4 text-red-500" /> Sem Par Compatível ({simulatedUnmatched.length})
                      </h4>
                      <p className="text-[10px] text-gray-500">
                        Sem parceiro de mesmo sexo com perfil compatível dentro de {simMaxDistance}km, ou sem coordenadas cadastradas.
                      </p>
                    </div>

                    <div className="overflow-y-auto divide-y divide-gray-50 space-y-1">
                      {simulatedUnmatched.map(id => {
                        const m = members.find(member => member.id === id);
                        if (!m) return null;
                        const hasCoords = m.latitude !== null && m.longitude !== null;
                        const age = getAge(m.nascimento);
                        return (
                          <div key={id} className="p-3 bg-gray-50 rounded-xl flex items-start gap-3 border border-gray-100">
                            <div className={clsx(
                              hasCoords ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600',
                              'h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0'
                            )}>
                              {m.nome.charAt(0)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold text-gray-900 truncate">{m.nome}</div>
                              <div className="text-[9px] text-gray-500 mt-0.5 flex flex-wrap gap-1">
                                {getRoleBadges(m).map(b => (
                                  <span key={b} className={clsx(
                                    b === 'líder' || b === 'discipulador' ? 'bg-amber-50 text-amber-700 font-bold border border-amber-100' :
                                    b === 'auxiliar' ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-100' :
                                    'bg-gray-100 text-gray-500 border border-gray-200',
                                    'px-1 rounded uppercase'
                                  )}>
                                    {b}
                                  </span>
                                ))}
                                {m.estado_civil && <span className="bg-indigo-50 text-indigo-600 px-1 rounded">{m.estado_civil}</span>}
                                {age !== null && <span className="bg-blue-50 text-blue-600 px-1 rounded">{age}a</span>}
                                {!hasCoords && <span className="bg-red-50 text-red-600 px-1 rounded">📍 Sem coords</span>}
                              </div>
                              <div className="text-[8px] text-gray-400 mt-0.5">{m.bairro || 'Bairro não informado'}</div>
                            </div>
                          </div>
                        );
                      })}
                      {simulatedUnmatched.length === 0 && (
                        <div className="text-center py-12 text-gray-400 text-xs italic">Nenhum membro órfão! Todos foram pareados.</div>
                      )}
                    </div>
                  </div>

                </div>
              )}

            </div>
          )}

          {/* ABA 3: PILARES & FUNDAMENTOS TEOLÓGICOS */}
          {activeTab === 'theology' && (
            <div className="space-y-6">
              {/* Alerta Inicial */}
              <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-6 flex flex-col md:flex-row gap-4 items-start">
                <BookOpen className="h-6 w-6 text-blue-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-blue-900">Aliança Horizontal vs. Discipulado Vertical</h3>
                  <p className="text-xs text-blue-700 leading-relaxed">
                    "No discipulado (vertical), alguém mais maduro vela por alguém mais novo. No companheirismo (horizontal), há uma responsabilização mútua por edificarem um ao outro. Só funcionará se houver um compromisso mútuo diante do Senhor."
                  </p>
                </div>
              </div>

              {/* Os 5 Pilares do Companheirismo */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Pilar 1 */}
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-3">
                  <div className="h-10 w-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-extrabold text-sm border border-purple-100">1</div>
                  <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                    Sujeição <span className="text-[10px] text-gray-400 lowercase">(Ef 5.21)</span>
                  </h4>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    A grande prova de humildade é a submissão ao companheiro, pois muitas vezes é mais fácil sujeitar-se ao discipulador, que consideramos mais maduro.
                  </p>
                </div>

                {/* Pilar 2 */}
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-3">
                  <div className="h-10 w-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center font-extrabold text-sm border border-red-100">2</div>
                  <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                    Transparência <span className="text-[10px] text-gray-400 lowercase">(Tg 5.16)</span>
                  </h4>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Confessar os pecados um ao outro produz cura. Não devemos esconder nada. Aprender a expor a vida perante o outro sem barreiras e perder o individualismo.
                  </p>
                </div>

                {/* Pilar 3 */}
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-3">
                  <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-extrabold text-sm border border-emerald-100">3</div>
                  <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                    Amor Verdadeiro <span className="text-[10px] text-gray-400 lowercase">(Jo 13.34)</span>
                  </h4>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Começa com amizade. Traz prazer e alegria uns nos outros. Amor é lealdade, compromisso nas provações e responsabilidade pelo bem-estar da família do parceiro.
                  </p>
                </div>

                {/* Pilar 4 */}
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-extrabold text-sm border border-amber-100">4</div>
                  <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                    Honra <span className="text-[10px] text-gray-400 lowercase">(Rm 12.10)</span>
                  </h4>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Buscar sempre o interesse do outro, mesmo que envolva perdas. Estar sempre disposto a dar o primeiro lugar ao companheiro e ficar na posição de servo.
                  </p>
                </div>

                {/* Pilar 5 */}
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-extrabold text-sm border border-blue-100">5</div>
                  <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                    Longanimidade & Perdão <span className="text-[10px] text-gray-400 lowercase">(Cl 3.12-13)</span>
                  </h4>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    O relacionamento funciona a fundo diante das deficiências de caráter. Não desanimar, mas aprender a perdoar e suportar no ajuste diário.
                  </p>
                </div>

                {/* Perigos */}
                <div className="bg-red-50/20 rounded-2xl border border-red-100/50 p-5 shadow-sm space-y-3">
                  <div className="h-10 w-10 rounded-xl bg-red-100 text-red-700 flex items-center justify-center font-extrabold text-sm">⚠️</div>
                  <h4 className="text-xs font-bold text-red-900 uppercase tracking-wider">Perigos Nocivos</h4>
                  <p className="text-xs text-red-700/80 leading-relaxed font-medium">
                    Evitar o egoísmo e tendências manipuladoras, lidar biblicamente com as diferenças de personalidade, blindar-se contra fofocas e focar em vencer ataques em oração mútua.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
