import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { 
  Users, Home, Play, RotateCcw, Save, ArrowRight, 
  Search, ShieldAlert, CheckCircle2, Download, Filter,
  BookOpen, Network, TrendingUp, AlertTriangle, Brain, MapPin
} from 'lucide-react';
import clsx from 'clsx';

interface Member {
  id: string;
  nome: string;
  grupos_caseiros: string | null;
  status: string;
  sexo: string;
  bairro: string | null;
}

interface Cell {
  id: string;
  grupo_caseiro: string;
  lider: string;
  setor: string;
}

interface DiscipleshipLink {
  discipulador: string;
  discipulo: string;
}

export const Simulations: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'gc' | 'discipleship'>('gc');
  const [isLoading, setIsLoading] = useState(true);
  
  // Sandbox Data (Drafts)
  const [draftMembers, setDraftMembers] = useState<Member[]>([]);
  const [draftCells, setDraftCells] = useState<Cell[]>([]);
  const [draftLinks, setDraftLinks] = useState<DiscipleshipLink[]>([]);
  
  // Baseline (to compare)
  const [baselineMembers, setBaselineMembers] = useState<Member[]>([]);
  
  // Selection State
  const [selectedSource, setSelectedSource] = useState<string>('');
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  
  const [searchTerm, setSearchTerm] = useState('');

  const loadBaseline = async () => {
    setIsLoading(true);
    try {
      const [membersRes, cellsRes, discRes] = await Promise.all([
        supabase.from('membros').select('id, nome, grupos_caseiros, status, sexo, bairro'),
        supabase.from('celulas').select('id, grupo_caseiro, lider, setor'),
        supabase.from('discipulado').select('discipulador, discipulo')
      ]);

      if (membersRes.data) {
        setDraftMembers(membersRes.data);
        setBaselineMembers([...membersRes.data]);
      }
      if (cellsRes.data) setDraftCells(cellsRes.data);
      if (discRes.data) setDraftLinks(discRes.data);
      
    } catch (err) {
      console.error('Error loading simulation data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBaseline();
  }, []);

  const resetSimulation = () => {
    if (confirm('Deseja descartar todas as alterações da simulação e voltar aos dados reais?')) {
      setDraftMembers([...baselineMembers]);
      setSelectedMembers([]);
    }
  };

  // GC Simulation Logic
  const sourceMembers = useMemo(() => {
    return draftMembers.filter(m => m.grupos_caseiros === selectedSource && m.status === 'Ativo');
  }, [draftMembers, selectedSource]);

  const targetMembers = useMemo(() => {
    return draftMembers.filter(m => m.grupos_caseiros === selectedTarget && m.status === 'Ativo');
  }, [draftMembers, selectedTarget]);

  const handleMoveMembers = () => {
    if (!selectedTarget || selectedMembers.length === 0) return;
    
    setDraftMembers(prev => prev.map(m => 
      selectedMembers.includes(m.id) 
        ? { ...m, grupos_caseiros: selectedTarget } 
        : m
    ));
    setSelectedMembers([]);
  };

  const toggleMemberSelection = (id: string) => {
    setSelectedMembers(prev => 
      prev.includes(id) ? prev.filter(mId => mId !== id) : [...prev, id]
    );
  };

  // Impact Analysis
  // Impact Analysis
  const impactStats = useMemo(() => {
    const changes = draftMembers.filter(m => {
      const base = baselineMembers.find(bm => bm.id === m.id);
      return base?.grupos_caseiros !== m.grupos_caseiros;
    }).length;

    const sourceCount = sourceMembers.length;
    const targetCount = targetMembers.length;

    return { changes, sourceCount, targetCount };
  }, [draftMembers, baselineMembers, sourceMembers, targetMembers]);

  // --- TERRITORIAL INTELLIGENCE ENGINE ---
  const RA_RELATIONS: Record<string, string[]> = {
    'ARNIQUEIRA': ['AREAL', 'SHA', 'QS 6', 'QS 8', 'QS 10', 'QS 11', 'VEREDÃO', 'RIACHO FUNDO I'],
    'VICENTE PIRES': ['COLÔNIA AGRÍCOLA SAMAMBAIA', 'COLÔNIA AGRÍCOLA SÃO JOSÉ', 'CANA DO REINO', '26 DE SETEMBRO', 'JOCKEY'],
    'ÁGUAS CLARAS': ['ARNIQUEIRA', 'TAGUATINGA SUL', 'AREAL'],
    'NÚCLEO BANDEIRANTE': ['CANDANGOLÂNDIA', 'PARK WAY', 'VILA CAUHY'],
    'SUDOESTE': ['OCTOGONAL', 'CRUZEIRO', 'SIG'],
    'CEILÂNDIA': ['SOL NASCENTE', 'PÔR DO SOL', 'TAGUATINGA NORTE'],
    'GUARÁ': ['LÚCIO COSTA', 'SQB', 'ESTRUTURAL'],
    'SOBRADINHO': ['FERCAL', 'PLANALTINA', 'GRANDE COLORADO'],
  };

  const territorialInsights = useMemo(() => {
    if (isLoading || draftMembers.length === 0) return [];
    
    const insights: any[] = [];
    const membersByBairro: Record<string, Member[]> = {};
    
    draftMembers.filter(m => m.status === 'Ativo').forEach(m => {
      const b = (m as any).bairro?.trim().toUpperCase() || 'NÃO INFORMADO';
      if (!membersByBairro[b]) membersByBairro[b] = [];
      membersByBairro[b].push(m);
    });

    // 1. Cluster Analysis: Find members without local GC
    Object.entries(membersByBairro).forEach(([bairro, members]) => {
      if (bairro === 'NÃO INFORMADO' || members.length < 3) return;
      
      const hasGC = draftCells.some(c => 
        c.grupo_caseiro.toUpperCase().includes(bairro) || 
        c.setor?.toUpperCase().includes(bairro)
      );
      
      if (!hasGC) {
        // Find if any existing leader lives nearby
        let neighbors: string[] = [];
        Object.entries(RA_RELATIONS).forEach(([ra, subs]) => {
          if (ra === bairro) neighbors = subs;
          else if (subs.includes(bairro)) neighbors = [ra, ...subs.filter(s => s !== bairro)];
        });

        const neighborGCs = draftCells.filter(c => 
          neighbors.some(n => c.grupo_caseiro.toUpperCase().includes(n))
        );

        insights.push({
          type: 'expansion',
          title: `Potencial: ${bairro}`,
          description: `Existem ${members.length} membros ativos nesta região sem GC local dedicado.`,
          action: neighborGCs.length > 0 
            ? `Sugestão: Incorporar ao ${neighborGCs[0].grupo_caseiro} ou criar nova frente.` 
            : 'Sugestão: Avaliar abertura de nova frente estratégica.'
        });
      }
    });

    // 2. Cross-Regional Analysis (The "Arniqueiras + Areal" Case)
    Object.entries(RA_RELATIONS).forEach(([parent, subs]) => {
      const allRelated = [parent, ...subs];
      const clusterMembers = allRelated.reduce((acc, loc) => acc + (membersByBairro[loc]?.length || 0), 0);
      const clusterGCs = draftCells.filter(c => allRelated.some(loc => c.grupo_caseiro.toUpperCase().includes(loc)));
      
      // If we have many members in a cluster but few GCs
      if (clusterMembers >= 5 && clusterGCs.length === 0) {
        insights.push({
          type: 'strategic',
          title: `Cluster Estratégico: ${parent}`,
          description: `O eixo ${parent} + adjacências possui ${clusterMembers} membros. Ideal para uma planta de GC regional.`,
          action: 'Ação Recomendada: Verificar disponibilidade de líder local.'
        });
      }
    });

    return insights.slice(0, 4);
  }, [isLoading, draftMembers, draftCells]);

  if (isLoading) return <div className="flex h-96 items-center justify-center"><TrendingUp className="h-8 w-8 animate-spin text-primary-600" /></div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-700 max-w-7xl mx-auto pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold mb-3 border border-blue-100">
            <Play className="w-3 h-3" /> Modo Simulação (Sandbox)
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Laboratório de Estrutura</h1>
          <p className="mt-2 text-sm text-gray-500">Planeje multiplicações e reorganizações sem alterar os dados reais.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={resetSimulation} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all">
            <RotateCcw className="w-4 h-4" /> Resetar
          </button>
          <button className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-primary-600 rounded-xl hover:bg-primary-700 shadow-lg shadow-primary-100 transition-all">
            <Download className="w-4 h-4" /> Exportar Plano
          </button>
        </div>
      </header>

      {/* Warning Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800">
          <strong>Ambiente Seguro:</strong> Nenhuma alteração feita nesta tela será salva no banco de dados. 
          Use este espaço para testar cenários de multiplicação de GCs ou mudanças na rede de discipulado.
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Simulation Board */}
        <div className="lg:col-span-8 space-y-6">
           {/* Tabs */}
          <div className="flex gap-4 border-b border-gray-100">
            <button 
              onClick={() => setActiveTab('gc')}
              className={clsx(
                "pb-4 px-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2",
                activeTab === 'gc' ? "border-primary-600 text-primary-600" : "border-transparent text-gray-400 hover:text-gray-600"
              )}
            >
              <Home className="w-4 h-4" /> Simulação de GC
            </button>
            <button 
              onClick={() => setActiveTab('discipleship')}
              className={clsx(
                "pb-4 px-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2",
                activeTab === 'discipleship' ? "border-primary-600 text-primary-600" : "border-transparent text-gray-400 hover:text-gray-600"
              )}
            >
              <Network className="w-4 h-4" /> Rede de Discipulado
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-11 gap-4">
            {/* Source Panel */}
            <div className="md:col-span-5 bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col overflow-hidden min-h-[500px]">
              <div className="p-6 border-b border-gray-50 bg-gray-50/30">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">Grupo de Origem</label>
                <select 
                  value={selectedSource} 
                  onChange={e => setSelectedSource(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-primary-500 outline-none"
                >
                  <option value="">Selecione um GC...</option>
                  {draftCells.map(c => <option key={c.id} value={c.grupo_caseiro}>{c.grupo_caseiro} ({c.lider})</option>)}
                </select>
              </div>
              
              <div className="flex-1 p-4 overflow-y-auto max-h-[500px]">
                {!selectedSource ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8">
                    <div className="p-4 bg-gray-50 rounded-full mb-4"><Users className="w-8 h-8 text-gray-300" /></div>
                    <p className="text-sm text-gray-500">Selecione o grupo para listar os membros.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sourceMembers.map(m => (
                      <div 
                        key={m.id}
                        onClick={() => toggleMemberSelection(m.id)}
                        className={clsx(
                          "flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer select-none",
                          selectedMembers.includes(m.id) 
                            ? "border-primary-500 bg-primary-50/50 ring-1 ring-primary-100" 
                            : "border-gray-100 hover:border-gray-200"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={clsx("h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold", m.sexo === 'Masculino' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700')}>
                            {m.nome.charAt(0)}
                          </div>
                          <span className="text-sm font-medium text-gray-700">{m.nome}</span>
                        </div>
                        {selectedMembers.includes(m.id) && <CheckCircle2 className="w-4 h-4 text-primary-600" />}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Action Column */}
            <div className="md:col-span-1 flex flex-col items-center justify-center gap-4">
              <button 
                disabled={selectedMembers.length === 0 || !selectedTarget || selectedSource === selectedTarget}
                onClick={handleMoveMembers}
                className="w-12 h-12 bg-primary-600 text-white rounded-2xl shadow-xl flex items-center justify-center disabled:opacity-30 hover:scale-105 active:scale-95 transition-all"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>

            {/* Target Panel */}
            <div className="md:col-span-5 bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col overflow-hidden min-h-[500px]">
              <div className="p-6 border-b border-gray-50 bg-gray-50/30">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">Grupo de Destino</label>
                <select 
                  value={selectedTarget} 
                  onChange={e => setSelectedTarget(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-primary-500 outline-none"
                >
                  <option value="">Destino...</option>
                  <option value="NOVO_GC">+ Criar Novo GC Simulado</option>
                  {draftCells.map(c => <option key={c.id} value={c.grupo_caseiro}>{c.grupo_caseiro}</option>)}
                </select>
              </div>
              
              <div className="flex-1 p-4 overflow-y-auto max-h-[500px]">
                {selectedTarget === 'NOVO_GC' ? (
                  <div className="bg-primary-50 border border-primary-100 rounded-2xl p-6 text-center h-full flex flex-col justify-center">
                    <Home className="w-10 h-10 text-primary-400 mx-auto mb-3" />
                    <h4 className="font-bold text-primary-900">Novo Grupo Draft</h4>
                    <p className="text-xs text-primary-700 mt-2">Clique na seta para mover os selecionados para este novo grupo.</p>
                    <div className="mt-6 pt-6 border-t border-primary-200 text-2xl font-bold text-primary-900">
                       {draftMembers.filter(m => m.grupos_caseiros === 'NOVO_GC').length}
                       <span className="text-xs font-normal ml-1">membros</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {targetMembers.map(m => (
                      <div key={m.id} className="flex items-center gap-3 p-2 border-b border-gray-50 opacity-60">
                        <div className="h-6 w-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold">{m.nome.charAt(0)}</div>
                        <span className="text-xs text-gray-600">{m.nome}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Insights */}
        <div className="lg:col-span-4 space-y-6">
           <div className="bg-gray-900 rounded-3xl p-6 text-white shadow-2xl overflow-hidden relative">
              <div className="relative z-10">
                <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-widest mb-4">
                   <Brain className="w-4 h-4" /> Inteligência Estratégica
                </div>
                <h3 className="text-xl font-bold mb-4">Oportunidades no Radar</h3>
                
                <div className="space-y-4">
                   {territorialInsights.length > 0 ? territorialInsights.map((insight, i) => (
                     <div key={i} className="bg-white/10 rounded-2xl p-4 border border-white/10 hover:bg-white/20 transition-all cursor-default group">
                        <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
                           {insight.type === 'expansion' ? <MapPin className="w-4 h-4 text-emerald-400" /> : <TrendingUp className="w-4 h-4 text-amber-400" />}
                           {insight.title}
                        </h4>
                        <p className="text-xs text-gray-400 leading-relaxed mb-3">{insight.description}</p>
                        <div className="text-[10px] font-bold text-primary-400 uppercase tracking-tighter bg-primary-400/10 px-2 py-1 rounded inline-block">
                           {insight.action}
                        </div>
                     </div>
                   )) : (
                     <div className="text-center py-8 opacity-50">
                        <CheckCircle2 className="w-10 h-10 mx-auto mb-2" />
                        <p className="text-sm">Nenhuma oportunidade detectada no momento.</p>
                     </div>
                   )}
                </div>
              </div>
              <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-primary-600/20 rounded-full blur-3xl"></div>
           </div>

           <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                 <AlertTriangle className="w-4 h-4" /> Resumo do Impacto
              </h4>
              <div className="space-y-6">
                 <div>
                    <div className="flex justify-between text-sm mb-2">
                       <span className="text-gray-500">Saúde do Grupo</span>
                       <span className={clsx("font-bold", impactStats.targetCount > 12 ? "text-red-600" : "text-green-600")}>
                          {impactStats.targetCount} / 12
                       </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                       <div 
                         className={clsx("h-full transition-all duration-500", impactStats.targetCount > 12 ? "bg-red-500" : "bg-green-500")}
                         style={{ width: `${Math.min((impactStats.targetCount / 12) * 100, 100)}%` }}
                       />
                    </div>
                 </div>

                 <div className="pt-4 border-t border-gray-50">
                    <p className="text-xs text-gray-500 leading-relaxed">
                       <strong>Dica:</strong> Arniqueiras e Areal são regiões de crescimento acelerado. Se você identificar um cluster com > 5 membros, considere abrir uma nova frente local.
                    </p>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};
