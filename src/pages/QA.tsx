import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import { AlertTriangle, Loader2, ChevronDown, ChevronRight, ShieldCheck, Activity, FileWarning } from 'lucide-react';
import clsx from 'clsx';

interface QAReport {
  id: string;
  title: string;
  description: string;
  count: number;
  data: any[];
  columns: { key: string; label: string }[];
  severity: 'high' | 'medium' | 'low';
}

const calculateAge = (birthDateString: string | null): number => {
  if (!birthDateString) return 999; // unknown
  const birthDate = new Date(birthDateString);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

const normalizeStr = (s: string | null | undefined): string => {
  if (!s) return '';
  return s.trim().replace(/\s+/g, ' ').toUpperCase();
};

// DFS cycle detection
const findCycles = (edges: { from: string; to: string }[]): string[][] => {
  const adj = new Map<string, string[]>();
  edges.forEach(e => {
    if (!adj.has(e.from)) adj.set(e.from, []);
    adj.get(e.from)!.push(e.to);
  });

  const visited = new Set<string>();
  const recStack = new Set<string>();
  const cycles: string[][] = [];
  const path: string[] = [];

  const dfs = (node: string) => {
    if (recStack.has(node)) {
      const cycleStartIdx = path.indexOf(node);
      cycles.push([...path.slice(cycleStartIdx), node]);
      return;
    }
    if (visited.has(node)) return;

    visited.add(node);
    recStack.add(node);
    path.push(node);

    const neighbors = adj.get(node) || [];
    for (const neighbor of neighbors) {
      dfs(neighbor);
    }

    recStack.delete(node);
    path.pop();
  };

  for (const node of adj.keys()) {
    if (!visited.has(node)) dfs(node);
  }

  // Deduplicate cycles (simplistic)
  const uniqueCycles = new Map<string, string[]>();
  cycles.forEach(c => {
    const key = [...c].sort().join('->');
    if (!uniqueCycles.has(key)) uniqueCycles.set(key, c);
  });

  return Array.from(uniqueCycles.values());
};

export const QA: React.FC = () => {
  const [reports, setReports] = useState<QAReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [membrosRes, celulasRes, discRes] = await Promise.all([
          supabase.from('membros').select('nome, status, tipo_cadastro, nascimento, grupos_caseiros, estado_civil, telefone').limit(15000),
          supabase.from('celulas').select('grupo_caseiro, lider, setor'),
          supabase.from('discipulado').select('discipulador, discipulo, status')
        ]);

        const membros = membrosRes.data || [];
        const celulas = celulasRes.data || [];
        const discipulado = discRes.data || [];

        const membrosNomes = new Set(membros.map(m => normalizeStr(m.nome)));
        const membrosMap = new Map(membros.map(m => [normalizeStr(m.nome), m]));
        const gruposNomes = new Set(celulas.map(c => normalizeStr(c.grupo_caseiro)));
        const discipuladores = new Set(discipulado.map(d => normalizeStr(d.discipulador)));
        const discipulos = new Set(discipulado.map(d => normalizeStr(d.discipulo)));
        const allDiscipuladoNames = new Set([...discipuladores, ...discipulos]);
        
        // Mapeamento inverso para exibir o nome original escrito no discipulado em caso de erro
        const discOriginalNames = new Map();
        discipulado.forEach(d => {
           if (d.discipulador) discOriginalNames.set(normalizeStr(d.discipulador), d.discipulador);
           if (d.discipulo) discOriginalNames.set(normalizeStr(d.discipulo), d.discipulo);
        });

        const newReports: QAReport[] = [];

        // 1. Membros sem Discipulador
        const semDiscipulador = membros.filter(m => {
           if (m.status !== 'Ativo') return false;
           const tipo = (m.tipo_cadastro || '').toLowerCase();
           if (tipo.includes('pastor') || tipo.includes('ext') || tipo.includes('agregado') || tipo.includes('externo')) return false;
           if (!['membro', 'líder', 'lider', 'diácono', 'diacono'].some(t => tipo.includes(t))) return false;
           return !discipulos.has(normalizeStr(m.nome));
        });
        newReports.push({
          id: 'orfaos',
          title: 'Membros sem Discipulador',
          description: 'Membros ativos que não estão sendo discipulados por ninguém (exceto Pastores).',
          count: semDiscipulador.length,
          severity: 'high',
          data: semDiscipulador.map(m => ({ nome: m.nome, tipo: m.tipo_cadastro })),
          columns: [{ key: 'nome', label: 'Nome' }, { key: 'tipo', label: 'Tipo de Cadastro' }]
        });

        // 2. Ativos sem Grupo Caseiro
        const semGrupo = membros.filter(m => {
           if (m.status !== 'Ativo') return false;
           if (m.grupos_caseiros && m.grupos_caseiros.trim() !== '') return false;
           const tipo = (m.tipo_cadastro || '').toLowerCase();
           if (tipo.includes('ext') || tipo.includes('agregado') || tipo.includes('externo')) return false;
           return ['membro', 'pastor', 'líder', 'lider', 'diácono', 'diacono'].some(t => tipo.includes(t));
        });
        newReports.push({
          id: 'sem_grupo',
          title: 'Ativos sem Grupo Caseiro',
          description: 'Membros ativos que deveriam estar vinculados a uma célula, mas o campo está vazio.',
          count: semGrupo.length,
          severity: 'high',
          data: semGrupo.map(m => ({ nome: m.nome, tipo: m.tipo_cadastro })),
          columns: [{ key: 'nome', label: 'Nome' }, { key: 'tipo', label: 'Tipo' }]
        });

        // 3. Estado Civil vs Idade
        const casadosMenores = membros.filter(m => {
           const civil = (m.estado_civil || '').toLowerCase();
           if (!civil.includes('casad') && !civil.includes('divorciad')) return false;
           return calculateAge(m.nascimento) < 18;
        });
        newReports.push({
          id: 'idade_civil',
          title: 'Idade Incompatível com Estado Civil',
          description: 'Pessoas marcadas como casadas ou divorciadas, mas com idade menor que 18 anos.',
          count: casadosMenores.length,
          severity: 'medium',
          data: casadosMenores.map(m => ({ nome: m.nome, idade: calculateAge(m.nascimento), civil: m.estado_civil })),
          columns: [{ key: 'nome', label: 'Nome' }, { key: 'idade', label: 'Idade Calculada' }, { key: 'civil', label: 'Estado Civil' }]
        });

        // 4. Discipuladores Inativos
        const discipuladoresInativos = [...discipuladores].filter(nome => {
           const m = membrosMap.get(nome);
           return m && m.status !== 'Ativo';
        });
        newReports.push({
          id: 'disc_inativo',
          title: 'Discipuladores Inativos',
          description: 'Pessoas inativas no sistema, mas que ainda constam como líderes de alguém na rede.',
          count: discipuladoresInativos.length,
          severity: 'high',
          data: discipuladoresInativos.map(nome => ({ nome, status: membrosMap.get(nome)?.status })),
          columns: [{ key: 'nome', label: 'Nome' }, { key: 'status', label: 'Status' }]
        });

        // 5. Grupos Fantasmas
        const grupoFantasma = membros.filter(m => m.grupos_caseiros && m.grupos_caseiros !== 'Sem Grupo' && !gruposNomes.has(normalizeStr(m.grupos_caseiros)));
        newReports.push({
          id: 'grupo_fantasma',
          title: 'Membros em Grupos Inexistentes',
          description: 'Membros associados a um Grupo Caseiro que não existe na tabela oficial de Células (possível erro de digitação).',
          count: grupoFantasma.length,
          severity: 'medium',
          data: grupoFantasma.map(m => ({ nome: m.nome, grupo: m.grupos_caseiros })),
          columns: [{ key: 'nome', label: 'Nome' }, { key: 'grupo', label: 'Grupo Digitado' }]
        });

        // 6. Loop no Discipulado
        const edges = discipulado.map(d => ({ from: normalizeStr(d.discipulador), to: normalizeStr(d.discipulo) })).filter(e => e.from && e.to);
        const cycles = findCycles(edges);
        newReports.push({
          id: 'loop_rede',
          title: 'Loops no Discipulado',
          description: 'Discipulado circular (A -> B -> A), o que quebra hierarquias lógicas.',
          count: cycles.length,
          severity: 'high',
          data: cycles.map((c, i) => ({ loop: c.join(' ➔ '), id: i+1 })),
          columns: [{ key: 'id', label: '#' }, { key: 'loop', label: 'Ciclo Detectado' }]
        });

        // 7. Typos na Tabela de Discipulado
        const typos = [...allDiscipuladoNames].filter(nome => nome && !membrosNomes.has(nome));
        newReports.push({
          id: 'typo_disc',
          title: 'Nomes Órfãos no Discipulado',
          description: 'Nomes escritos na tabela de Discipulado que não possuem cadastro correspondente na tabela de Membros.',
          count: typos.length,
          severity: 'medium',
          data: typos.map(nome => ({ nome: discOriginalNames.get(nome) || nome })),
          columns: [{ key: 'nome', label: 'Nome Escrito na Rede' }]
        });

        // 8. Ativos sem Telefone
        const semTel = membros.filter(m => m.status === 'Ativo' && (!m.telefone || m.telefone.length < 8));
        newReports.push({
          id: 'sem_tel',
          title: 'Membros Ativos sem Telefone',
          description: 'Cadastros que dificultam o contato e a integração.',
          count: semTel.length,
          severity: 'low',
          data: semTel.map(m => ({ nome: m.nome, tipo: m.tipo_cadastro })),
          columns: [{ key: 'nome', label: 'Nome' }, { key: 'tipo', label: 'Tipo' }]
        });

        // 9. Células sem Líder Ativo
        const celulasSemLider = celulas.filter(c => {
           if (!c.lider) return true;
           const m = membrosMap.get(normalizeStr(c.lider));
           return !m || m.status !== 'Ativo';
        });
        newReports.push({
          id: 'celula_sem_lider',
          title: 'Grupos Caseiros sem Líder Válido',
          description: 'Células cujo líder não está preenchido, ou o nome não existe, ou o líder está Inativo.',
          count: celulasSemLider.length,
          severity: 'high',
          data: celulasSemLider.map(c => ({ grupo: c.grupo_caseiro, lider: c.lider || 'Vazio', setor: c.setor })),
          columns: [{ key: 'grupo', label: 'Grupo Caseiro' }, { key: 'lider', label: 'Líder Atual' }, { key: 'setor', label: 'Setor' }]
        });

        setReports(newReports);

      } catch (error) {
        console.error('Error computing QA reports:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const totalErrors = useMemo(() => reports.reduce((acc, r) => acc + r.count, 0), [reports]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-7xl mx-auto pb-12">
      <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 text-red-700 text-sm font-semibold mb-3 border border-red-100 shadow-sm">
            <AlertTriangle className="w-4 h-4" />
            Quality Assurance (QA)
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Auditoria de Dados</h1>
          <p className="mt-2 text-sm text-gray-500 max-w-2xl">
            Identifique inconsistências, cadastros órfãos e quebras de regras de negócio para manter a saúde do banco de dados sempre impecável.
          </p>
        </div>
        
        {!isLoading && (
           <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
             <div className="h-12 w-12 rounded-full bg-red-50 flex items-center justify-center border border-red-100">
               <Activity className="text-red-600 w-6 h-6" />
             </div>
             <div>
               <p className="text-sm text-gray-500 font-medium">Inconsistências Encontradas</p>
               <p className="text-2xl font-bold text-gray-900">{totalErrors}</p>
             </div>
           </div>
        )}
      </header>

      {isLoading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 flex flex-col items-center justify-center min-h-[400px]">
          <Loader2 className="h-10 w-10 animate-spin text-primary-600 mb-4" />
          <p className="text-gray-500 font-medium">Analisando milhares de registros e cruzando dados...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {reports.sort((a,b) => b.count - a.count).map((report) => (
            <div 
              key={report.id} 
              className={clsx(
                "bg-white rounded-xl shadow-sm border transition-all duration-200 overflow-hidden",
                expandedId === report.id ? "border-primary-200 ring-1 ring-primary-50" : "border-gray-200 hover:border-gray-300",
                report.count === 0 && "opacity-70"
              )}
            >
              <div 
                className="p-5 flex items-center gap-4 cursor-pointer"
                onClick={() => report.count > 0 && setExpandedId(expandedId === report.id ? null : report.id)}
              >
                <div className={clsx(
                  "h-10 w-10 shrink-0 rounded-full flex items-center justify-center border",
                  report.count === 0 ? "bg-green-50 text-green-600 border-green-200" :
                  report.severity === 'high' ? "bg-red-50 text-red-600 border-red-200" :
                  report.severity === 'medium' ? "bg-orange-50 text-orange-600 border-orange-200" :
                  "bg-yellow-50 text-yellow-600 border-yellow-200"
                )}>
                   {report.count === 0 ? <ShieldCheck className="w-5 h-5" /> : <FileWarning className="w-5 h-5" />}
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-gray-900">{report.title}</h3>
                  <p className="text-sm text-gray-500 truncate">{report.description}</p>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                   <span className={clsx(
                     "px-3 py-1 text-sm font-bold rounded-full",
                     report.count === 0 ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-800"
                   )}>
                     {report.count} {report.count === 1 ? 'erro' : 'erros'}
                   </span>
                   {report.count > 0 && (
                     <div className="text-gray-400">
                       {expandedId === report.id ? <ChevronDown /> : <ChevronRight />}
                     </div>
                   )}
                </div>
              </div>

              {/* Tabela de Detalhes Expandida */}
              {expandedId === report.id && report.count > 0 && (
                <div className="border-t border-gray-100 bg-gray-50/50 p-5">
                   <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            {report.columns.map((col, idx) => (
                              <th key={col.key} className={clsx("py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider", idx === 0 ? "pl-6 pr-3" : "px-3")}>
                                {col.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                          {report.data.slice(0, 100).map((row, i) => (
                            <tr key={i} className="hover:bg-gray-50/50">
                              {report.columns.map((col, idx) => (
                                <td key={col.key} className={clsx("whitespace-nowrap py-2 text-sm text-gray-700", idx === 0 ? "pl-6 pr-3 font-medium text-gray-900" : "px-3")}>
                                  {col.key === 'nome' && row[col.key] ? (
                                    <Link to={`/crm/${encodeURIComponent(row[col.key])}`} className="text-primary-600 hover:text-primary-800 hover:underline">
                                      {row[col.key]}
                                    </Link>
                                  ) : (
                                    row[col.key] || '-'
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {report.data.length > 100 && (
                        <div className="p-3 text-center text-sm text-gray-500 border-t border-gray-100">
                           Mostrando os primeiros 100 registros. Corrija-os no sistema para visualizar os demais.
                        </div>
                      )}
                   </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
