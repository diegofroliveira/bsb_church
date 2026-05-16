import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { 
  Users, Home, Play, RotateCcw, Save, ArrowRight, 
  Search, ShieldAlert, CheckCircle2, Download, Filter,
  BookOpen, Network, TrendingUp, AlertTriangle
} from 'lucide-react';
import clsx from 'clsx';

interface Member {
  id: string;
  nome: string;
  grupos_caseiros: string | null;
  status: string;
  sexo: string;
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
        supabase.from('membros').select('id, nome, grupos_caseiros, status, sexo'),
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
  const impactStats = useMemo(() => {
    const changes = draftMembers.filter(m => {
      const base = baselineMembers.find(bm => bm.id === m.id);
      return base?.grupos_caseiros !== m.grupos_caseiros;
    }).length;

    const sourceCount = sourceMembers.length;
    const targetCount = targetMembers.length;

    return { changes, sourceCount, targetCount };
  }, [draftMembers, baselineMembers, sourceMembers, targetMembers]);

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

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Source Panel */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
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
          
          <div className="flex-1 p-6 overflow-y-auto max-h-[500px]">
            {!selectedSource ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <div className="p-4 bg-gray-50 rounded-full mb-4"><Users className="w-8 h-8 text-gray-300" /></div>
                <p className="text-sm text-gray-500">Selecione o grupo que deseja reorganizar para listar os membros.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-900">{selectedSource} <span className="text-xs font-normal text-gray-400 ml-2">{sourceMembers.length} membros ativos</span></h3>
                </div>
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
        <div className="flex flex-col items-center justify-center gap-4">
          <button 
            disabled={selectedMembers.length === 0 || !selectedTarget || selectedSource === selectedTarget}
            onClick={handleMoveMembers}
            className="w-14 h-14 bg-primary-600 text-white rounded-2xl shadow-xl shadow-primary-200 flex items-center justify-center disabled:opacity-30 disabled:shadow-none hover:scale-105 active:scale-95 transition-all"
          >
            <ArrowRight className="w-6 h-6" />
          </button>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">
            Mover {selectedMembers.length} selecionados
          </span>
        </div>

        {/* Target Panel */}
        <div className="lg:col-span-1 bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
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
          
          <div className="flex-1 p-6 overflow-y-auto max-h-[500px]">
            {selectedTarget === 'NOVO_GC' ? (
              <div className="bg-primary-50 border border-primary-100 rounded-2xl p-4 text-center">
                <Home className="w-8 h-8 text-primary-400 mx-auto mb-2" />
                <h4 className="font-bold text-primary-900 text-sm">Novo Grupo Draft</h4>
                <p className="text-[10px] text-primary-700 mt-1 uppercase font-bold tracking-tighter">Planejamento de Multiplicação</p>
                <div className="mt-4 pt-4 border-t border-primary-200">
                   {draftMembers.filter(m => m.grupos_caseiros === 'NOVO_GC').length} membros movidos aqui.
                </div>
              </div>
            ) : !selectedTarget ? (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                <div className="p-4 bg-gray-50 rounded-full mb-4"><Users className="w-8 h-8 text-gray-300" /></div>
                <p className="text-xs text-gray-400">Escolha o destino para visualizar o impacto.</p>
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

      {/* Simulation Dashboard Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Alterações Realizadas</h4>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900">{impactStats.changes}</span>
            <span className="text-sm text-gray-500">membros movidos</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Saúde do Grupo (Destino)</h4>
          <div className="flex items-center gap-3">
             <div className="text-3xl font-bold text-gray-900">{impactStats.targetCount}</div>
             <div className={clsx(
               "text-xs font-bold px-2 py-1 rounded-lg",
               impactStats.targetCount > 12 ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"
             )}>
               {impactStats.targetCount > 12 ? 'ACIMA DA CAPACIDADE' : 'EQUILIBRADO'}
             </div>
          </div>
          <p className="text-[10px] text-gray-400 mt-2 uppercase font-bold tracking-widest">Capacidade ideal: 8-12 pessoas</p>
        </div>

        <div className="bg-indigo-600 rounded-2xl p-6 text-white shadow-xl shadow-indigo-100 relative overflow-hidden">
           <div className="relative z-10">
              <h4 className="font-bold text-lg mb-1">Dica Estratégica</h4>
              <p className="text-indigo-100 text-xs leading-relaxed">
                 Grupos com mais de 12 pessoas tendem a perder a intimidade. Use esta ferramenta para identificar auxiliares que podem liderar a multiplicação.
              </p>
           </div>
           <Home className="absolute -right-4 -bottom-4 w-24 h-24 text-indigo-500 opacity-20" />
        </div>
      </div>
    </div>
  );
};
