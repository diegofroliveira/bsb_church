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
}

interface SimulatedPair {
  memberIds: string[];
  distance: number;
}

export const Companionship: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'active' | 'assistant' | 'theology'>('active');
  const [members, setMembers] = useState<Member[]>([]);
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
  const [simAllowTrios, setSimAllowTrios] = useState<boolean>(true);
  
  // Modals / Input States
  const [newPrayerText, setNewPrayerText] = useState<Record<string, string>>({});
  const [newActivityText, setNewActivityText] = useState<Record<string, string>>({});
  const [newActivityType, setNewActivityType] = useState<Record<string, 'PALAVRA' | 'ORAÇÃO' | 'EVANGELISMO' | 'SERVIÇO'>>({});

  // Tipos elegíveis para companheirismo (exclui agregado, visitante, etc.)
  const ELIGIBLE_TYPES = ['MEMBRO', 'LÍDER', 'LIDER', 'DISCIPULADOR', 'DIÁCONO', 'DIACONO', 'PASTOR', 'PRESBÍTERO', 'PRESBITERO'];

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
        // 1. Carregar membros
        const { data: dbMembers, error: membersError } = await supabase
          .from('membros')
          .select('id, nome, apelido, tipo_de_pessoa, sexo, bairro, grupos_caseiros, latitude, longitude, foto')
          .eq('status', 'Ativo');

        if (membersError) throw membersError;

        // Filtrar membros elegíveis
        const filteredMembers = (dbMembers || []).filter(m => {
          const type = (m.tipo_de_pessoa || '').toUpperCase().trim();
          return ELIGIBLE_TYPES.includes(type);
        });
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

  // Algoritmo de busca de vizinhos geograficamente recomendados
  const getRecommendedNeighbors = (member: Member): (Member & { distance: number })[] => {
    if (!member.latitude || !member.longitude) return [];
    
    return members
      .filter(m => m.id !== member.id && m.sexo === member.sexo && !isMemberLinked(m.id))
      .map(m => {
        const dist = calculateDistance(member.latitude, member.longitude, m.latitude, m.longitude);
        return { ...m, distance: dist ?? 9999 };
      })
      .filter(m => m.distance !== 9999)
      .sort((a, b) => a.distance - b.distance);
  };

  // ----------------------------------------------------
  // MOTOR DO SIMULADOR GEOGRÁFICO EM MASSA (YOLO ENGINE)
  // ----------------------------------------------------
  const handleGenerateSimulation = () => {
    setIsLoading(true);
    
    // Obter todos os membros sem companheirismo que têm coordenadas
    const pool = members.filter(m => !isMemberLinked(m.id) && m.latitude !== null && m.longitude !== null);
    
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
        let bestDist = Infinity;

        // Procurar o vizinho mais próximo não visitado do mesmo sexo
        for (let j = i + 1; j < sexPool.length; j++) {
          const m2 = sexPool[j];
          if (visited.has(m2.id)) continue;

          const dist = calculateDistance(m1.latitude, m1.longitude, m2.latitude, m2.longitude);
          if (dist !== null && dist < bestDist && dist <= simMaxDistance) {
            bestDist = dist;
            bestPartner = m2;
          }
        }

        if (bestPartner) {
          visited.add(m1.id);
          visited.add(bestPartner.id);
          simulated.push({
            memberIds: [m1.id, bestPartner.id],
            distance: bestDist
          });
        } else {
          unmatched.push(m1.id);
        }
      }

      // Adicionar à lista de órfãos quem não tem coordenadas ou restou na filtragem
      const unmatchedBySex = sexPool.filter(m => !visited.has(m.id));
      unmatchedBySex.forEach(m => {
        if (!unmatched.includes(m.id)) unmatched.push(m.id);
      });
    }

    // Gerar Trios se permitido (para não deixar ninguém isolado na proximidade)
    if (simAllowTrios && unmatched.length > 0) {
      const remainingUnmatched: string[] = [];

      for (const unmatchedId of unmatched) {
        const unmatchedMember = members.find(m => m.id === unmatchedId);
        if (!unmatchedMember || unmatchedMember.latitude === null || unmatchedMember.longitude === null) {
          remainingUnmatched.push(unmatchedId);
          continue;
        }

        let bestPairIdx = -1;
        let bestPairDist = Infinity;

        // Achar a dupla mais próxima do mesmo sexo que ainda não seja um trio
        for (let i = 0; i < simulated.length; i++) {
          const pair = simulated[i];
          if (pair.memberIds.length >= 3) continue;

          const pairLeader = members.find(m => m.id === pair.memberIds[0]);
          if (!pairLeader || pairLeader.sexo !== unmatchedMember.sexo) continue;

          const dist = calculateDistance(unmatchedMember.latitude, unmatchedMember.longitude, pairLeader.latitude, pairLeader.longitude);
          if (dist !== null && dist < bestPairDist && dist <= simMaxDistance) {
            bestPairDist = dist;
            bestPairIdx = i;
          }
        }

        if (bestPairIdx !== -1) {
          simulated[bestPairIdx].memberIds.push(unmatchedId);
          // Recalcular distância média
          const p1 = members.find(m => m.id === simulated[bestPairIdx].memberIds[0])!;
          const p2 = members.find(m => m.id === simulated[bestPairIdx].memberIds[1])!;
          const d1 = calculateDistance(p1.latitude, p1.longitude, p2.latitude, p2.longitude) || 0;
          const d2 = calculateDistance(p1.latitude, p1.longitude, unmatchedMember.latitude, unmatchedMember.longitude) || 0;
          simulated[bestPairIdx].distance = parseFloat(((d1 + d2) / 2).toFixed(1));
        } else {
          remainingUnmatched.push(unmatchedId);
        }
      }
      setSimulatedUnmatched(remainingUnmatched);
    } else {
      setSimulatedUnmatched(unmatched);
    }

    // Incluir também membros que já não tinham coordenadas de jeito nenhum na lista de órfãos
    const noCoordsMembers = members.filter(m => !isMemberLinked(m.id) && (m.latitude === null || m.longitude === null));
    setSimulatedUnmatched(prev => {
      const merged = [...prev];
      noCoordsMembers.forEach(m => {
        if (!merged.includes(m.id)) merged.push(m.id);
      });
      return merged;
    });

    setSimulatedMatches(simulated);
    setIsSimulationMode(true);
    setIsLoading(false);
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
                        <div className="text-xs font-bold text-gray-800 line-clamp-1">{m1.apelido || m1.nome.split(' ')[0]}</div>
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
                        <div className="text-xs font-bold text-gray-800 line-clamp-1">{m2.apelido || m2.nome.split(' ')[0]}</div>
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
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50/50 rounded-2xl border border-blue-100/50 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
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
                              <span className="text-[9px] text-gray-400 font-semibold uppercase">{m.tipo_de_pessoa}</span>
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
                              </div>
                            </div>
                          </div>

                          {/* Motor Geográfico */}
                          <div className="mt-6 space-y-4">
                            <div className="flex items-center justify-between">
                              <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                                <Compass className="h-4 w-4 text-blue-600 animate-spin" style={{ animationDuration: '6s' }} />
                                Vizinhos Recomendados (Proximidade)
                              </h4>
                              <span className="text-[10px] text-gray-400 font-semibold italic">Apenas mesmo sexo sem aliança ativa</span>
                            </div>

                            {/* Tabela de Vizinhos Recomendados */}
                            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                              {getRecommendedNeighbors(selectedMember).slice(0, 5).map((candidate, idx) => {
                                const isSelectedTrio = trioSecondMember?.id === candidate.id;
                                
                                // Badge de cores baseado na distância
                                const dist = candidate.distance;
                                const distanceBadge = 
                                  dist < 3 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                  dist < 8 ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                  dist < 15 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                  'bg-red-50 text-red-700 border-red-200';
                                
                                const distLabel = 
                                  dist < 3 ? 'Extremamente Próximo' :
                                  dist < 8 ? 'Próximo' :
                                  dist < 15 ? 'Relativamente Próximo' :
                                  'Distante';

                                return (
                                  <div
                                    key={candidate.id}
                                    className={clsx(
                                      idx === 0 ? 'ring-1 ring-blue-500 bg-blue-50/10' : 'bg-gray-50/50',
                                      'p-3 rounded-xl border border-gray-100 flex items-center justify-between gap-4 hover:bg-gray-50 transition-all'
                                    )}
                                  >
                                    <div className="flex items-center gap-3 min-w-0">
                                      <div className="relative">
                                        <div className="h-9 w-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs border">
                                          {candidate.foto ? <img src={candidate.foto} alt={candidate.nome} className="h-9 w-9 rounded-full object-cover" /> : candidate.nome.charAt(0)}
                                        </div>
                                        {idx === 0 && (
                                          <span className="absolute -top-1 -left-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[8px] font-bold text-white shadow animate-bounce">
                                            1º
                                          </span>
                                        )}
                                      </div>
                                      
                                      <div className="min-w-0">
                                        <div className="text-xs font-bold text-gray-900 truncate">{candidate.nome}</div>
                                        <div className="text-[10px] text-gray-500 truncate mt-0.5">📍 Bairro: {candidate.bairro || 'Sem Bairro'} • GC: {candidate.grupos_caseiros || 'Nenhum'}</div>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                      {/* Badge da Distância */}
                                      <div className={clsx(distanceBadge, 'text-right border px-2 py-0.5 rounded text-[10px] font-bold flex flex-col')}>
                                        <span>{dist} km</span>
                                        <span className="text-[8px] font-medium opacity-80">{distLabel}</span>
                                      </div>

                                      {/* Botão de Associação Rápida ou Trio */}
                                      {idx === 0 ? (
                                        <button
                                          onClick={handleLinkMembers}
                                          className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                                          title="Vincular com o vizinho mais próximo recomendado!"
                                        >
                                          <Plus className="h-4 w-4" /> Vincular
                                        </button>
                                      ) : (
                                        <button
                                          onClick={() => handleManualLink(selectedMember.id, candidate.id)}
                                          className="bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 p-2 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                                          title="Vincular Manualmente"
                                        >
                                          Conectar
                                        </button>
                                      )}

                                      {/* Botão para montar um Trio */}
                                      <button
                                        onClick={() => setTrioSecondMember(isSelectedTrio ? null : candidate)}
                                        className={clsx(
                                          isSelectedTrio ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-transparent',
                                          'p-1.5 rounded-lg border text-[10px] font-bold transition-all'
                                        )}
                                        title="Incluir este membro no vínculo para formar um Trio"
                                      >
                                        {isSelectedTrio ? 'Remover do Trio' : '+ Trio'}
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}

                              {getRecommendedNeighbors(selectedMember).length === 0 && (
                                <div className="text-center py-8 text-gray-400 text-xs italic">Não existem vizinhos cadastrados com coordenadas geográficas do mesmo sexo sem vínculo ativo.</div>
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

                        return (
                          <div key={idx} className="bg-white rounded-xl border border-gray-150 p-4 shadow-sm space-y-3 relative hover:border-amber-400 transition-all flex flex-col justify-between">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded-full px-2 py-0.5">
                                {m3 ? 'Trio Proposto' : 'Dupla Proposta'}
                              </span>
                              <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <MapPin className="h-3 w-3" /> {sm.distance} km
                              </span>
                            </div>

                            {/* Detalhe Membros */}
                            <div className="grid grid-cols-3 gap-2 items-center py-2 bg-gray-50/50 rounded-lg p-2">
                              {/* Membro 1 */}
                              <div className="text-center">
                                <div className="h-8 w-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs mx-auto">
                                  {m1.nome.charAt(0)}
                                </div>
                                <div className="text-[10px] font-bold text-gray-800 truncate mt-1">{m1.nome.split(' ')[0]}</div>
                                <div className="text-[8px] text-gray-400 font-medium truncate">{m1.bairro || 'Sem Bairro'}</div>
                              </div>
                              {/* Handshake */}
                              <div className="text-center text-gray-300">
                                <Handshake className="h-5 w-5 mx-auto" />
                              </div>
                              {/* Membro 2 */}
                              <div className="text-center">
                                <div className="h-8 w-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs mx-auto">
                                  {m2.nome.charAt(0)}
                                </div>
                                <div className="text-[10px] font-bold text-gray-800 truncate mt-1">{m2.nome.split(' ')[0]}</div>
                                <div className="text-[8px] text-gray-400 font-medium truncate">{m2.bairro || 'Sem Bairro'}</div>
                              </div>

                              {/* Membro 3 (trio) */}
                              {m3 && (
                                <div className="col-span-3 border-t border-dashed border-gray-150 pt-2 flex items-center justify-center gap-2 text-center">
                                  <div className="h-6 w-6 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-[10px]">
                                    {m3.nome.charAt(0)}
                                  </div>
                                  <div className="text-[10px] font-bold text-gray-800 truncate">{m3.nome.split(' ')[0]}</div>
                                  <div className="text-[8px] text-gray-400 font-medium bg-gray-100 px-1 rounded">{m3.bairro || 'Sem Bairro'}</div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Coluna Direita: Membros que restaram órfãos na simulação */}
                  <div className="bg-white rounded-2xl border border-gray-150 p-5 shadow-sm lg:col-span-1 flex flex-col max-h-[600px] overflow-hidden">
                    <div className="space-y-1 mb-4">
                      <h4 className="text-xs font-bold text-red-700 uppercase tracking-wider flex items-center gap-1.5">
                        <AlertTriangle className="h-4.5 w-4.5 text-red-500" /> Órfãos na Simulação ({simulatedUnmatched.length})
                      </h4>
                      <p className="text-[10px] text-gray-500">
                        Estes membros excedem o limite de {simMaxDistance}km de distância para vizinhos de mesmo sexo ou não possuem coordenadas cadastradas.
                      </p>
                    </div>

                    <div className="overflow-y-auto divide-y divide-gray-50 space-y-1">
                      {simulatedUnmatched.map(id => {
                        const m = members.find(member => member.id === id);
                        if (!m) return null;
                        return (
                          <div key={id} className="p-3 bg-gray-50 rounded-xl flex items-center gap-3 border border-gray-100">
                            <div className="h-8 w-8 rounded-full bg-red-50 text-red-600 flex items-center justify-center font-bold text-xs shrink-0">
                              {m.nome.charAt(0)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold text-gray-900 truncate">{m.nome}</div>
                              <div className="text-[9px] text-gray-500 truncate mt-0.5">
                                Sexo: {m.sexo} • Bairro: {m.bairro || 'Sem Coordenadas 📍'}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {simulatedUnmatched.length === 0 && (
                        <div className="text-center py-12 text-gray-400 text-xs italic">Nenhum membro órfão! Todos foram pareados perfeitamente.</div>
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
