import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import { AlertTriangle, Loader2, ChevronDown, ChevronRight, ShieldCheck, Activity, FileWarning, Download } from 'lucide-react';
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

const normalizeStr = (s: string | null | undefined): string => {
  if (!s) return '';
  return s.trim().replace(/\s+/g, ' ').toUpperCase();
};

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
      const idx = path.indexOf(node);
      cycles.push([...path.slice(idx), node]);
      return;
    }
    if (visited.has(node)) return;
    visited.add(node); recStack.add(node); path.push(node);
    for (const n of (adj.get(node) || [])) dfs(n);
    recStack.delete(node); path.pop();
  };
  for (const node of adj.keys()) if (!visited.has(node)) dfs(node);
  const unique = new Map<string, string[]>();
  cycles.forEach(c => { const k = [...c].sort().join('->'); if (!unique.has(k)) unique.set(k, c); });
  return Array.from(unique.values());
};

// Enhanced similarity check for duplicate names
const similar = (a: string, b: string): boolean => {
  if (a === b) return false;
  const partsA = a.split(' ').filter(p => p.length > 2);
  const partsB = b.split(' ').filter(p => p.length > 2);
  
  // If surnames are clearly different, they are likely different people
  // Ex: "PEDRO HENRIQUE SOUZA" vs "PEDRO HENRIQUE SALES"
  if (partsA.length >= 3 && partsB.length >= 3) {
    const lastA = partsA[partsA.length - 1];
    const lastB = partsB[partsB.length - 1];
    if (lastA !== lastB) return false;
  }

  const shorter = a.length < b.length ? a : b;
  const longer = a.length < b.length ? b : a;
  
  // Catch "Alex Machado" vs "Alex Machado Junior" or small typos at the end
  if (longer.startsWith(shorter + ' ')) return true;
  
  return false;
};

const severityLabel: Record<string, string> = { high: 'Alta', medium: 'Média', low: 'Baixa' };

export const QA: React.FC = () => {
  const [reports, setReports] = useState<QAReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch ALL membros with pagination
        let allMembros: any[] = [];
        let from = 0;
        while (true) {
          const { data, error } = await supabase
            .from('membros')
            .select('nome, status, tipo_cadastro, tipo_de_pessoa, nascimento, grupos_caseiros, celular_principal_sms, email')
            .range(from, from + 999);
          if (error) throw error;
          if (!data || data.length === 0) break;
          allMembros = allMembros.concat(data);
          if (data.length < 1000) break;
          from += 1000;
        }

        const [celulasRes, discRes] = await Promise.all([
          supabase.from('celulas').select('grupo_caseiro, lider, setor, limite_de_pessoas'),
          supabase.from('discipulado').select('discipulador, discipulo, status')
        ]);

        const membros = allMembros;
        const celulas = celulasRes.data || [];
        const discipulado = discRes.data || [];

        const membrosNomes = new Set(membros.map(m => normalizeStr(m.nome)));
        const membrosMap = new Map(membros.map(m => [normalizeStr(m.nome), m]));
        const gruposNomes = new Set(celulas.map(c => normalizeStr(c.grupo_caseiro)));
        const discipuladores = new Set(discipulado.map(d => normalizeStr(d.discipulador)));
        const discipulos = new Set(discipulado.map(d => normalizeStr(d.discipulo)));
        const allDiscNames = new Set([...discipuladores, ...discipulos]);
        const discOriginalNames = new Map<string, string>();
        discipulado.forEach(d => {
          if (d.discipulador) discOriginalNames.set(normalizeStr(d.discipulador), d.discipulador);
          if (d.discipulo) discOriginalNames.set(normalizeStr(d.discipulo), d.discipulo);
        });

        const newReports: QAReport[] = [];

        // 1. Membros sem Discipulador
        const semDisc = membros.filter(m => {
          if (m.status !== 'Ativo') return false;
          const tipo = (m.tipo_cadastro || '').toLowerCase();
          if (tipo.includes('pastor') || tipo.includes('ext') || tipo.includes('agregado') || tipo.includes('externo')) return false;
          if (!['membro', 'líder', 'lider', 'diácono', 'diacono'].some(t => tipo.includes(t))) return false;
          return !discipulos.has(normalizeStr(m.nome));
        });
        newReports.push({ id: 'sem_disc', title: 'Membros sem Discipulador', description: 'Membros/Líderes/Diáconos ativos que não aparecem como discípulo de ninguém.', count: semDisc.length, severity: 'high', data: semDisc.map(m => ({ nome: m.nome, tipo: m.tipo_cadastro })), columns: [{ key: 'nome', label: 'Nome' }, { key: 'tipo', label: 'Tipo' }] });

        // 2. Ativos sem Grupo Caseiro
        const semGrupo = membros.filter(m => {
          if (m.status !== 'Ativo') return false;
          if (m.grupos_caseiros && m.grupos_caseiros.trim() !== '') return false;
          const tipo = (m.tipo_cadastro || '').toLowerCase();
          if (tipo.includes('ext') || tipo.includes('agregado') || tipo.includes('externo')) return false;
          return ['membro', 'pastor', 'líder', 'lider', 'diácono', 'diacono'].some(t => tipo.includes(t));
        });
        newReports.push({ id: 'sem_grupo', title: 'Ativos sem Grupo Caseiro', description: 'Membros ativos que deveriam estar vinculados a uma célula, mas o campo está vazio.', count: semGrupo.length, severity: 'high', data: semGrupo.map(m => ({ nome: m.nome, tipo: m.tipo_cadastro })), columns: [{ key: 'nome', label: 'Nome' }, { key: 'tipo', label: 'Tipo' }] });

        // 3. Discipuladores Inativos
        const discInativos = [...discipuladores].filter(nome => {
          const m = membrosMap.get(nome);
          return m && m.status !== 'Ativo';
        });
        newReports.push({ id: 'disc_inativo', title: 'Discipuladores Inativos', description: 'Pessoas inativas que ainda constam como líderes de alguém na rede de discipulado.', count: discInativos.length, severity: 'high', data: discInativos.map(nome => ({ nome, status: membrosMap.get(nome)?.status || 'Inativo' })), columns: [{ key: 'nome', label: 'Nome' }, { key: 'status', label: 'Status' }] });

        // 4. Grupos Caseiros sem LÃ­der VÃ¡lido
        const celulasSemLider = celulas.filter(c => {
          if (!c.lider) return true;
          const m = membrosMap.get(normalizeStr(c.lider));
          return !m || m.status !== 'Ativo';
        });
        newReports.push({ id: 'celula_sem_lider', title: 'Grupos sem Líder Válido', description: 'Células cujo líder está vazio, não existe na base ou está inativo.', count: celulasSemLider.length, severity: 'high', data: celulasSemLider.map(c => ({ grupo: c.grupo_caseiro, lider: c.lider || '(vazio)', setor: c.setor })), columns: [{ key: 'grupo', label: 'Grupo' }, { key: 'lider', label: 'Líder Atual' }, { key: 'setor', label: 'Setor' }] });

        // 5. Loops no Discipulado
        const edges = discipulado.map(d => ({ from: normalizeStr(d.discipulador), to: normalizeStr(d.discipulo) })).filter(e => e.from && e.to);
        const cycles = findCycles(edges);
        newReports.push({ id: 'loop_rede', title: 'Loops no Discipulado', description: 'Discipulado circular (A → B → A), que quebra hierarquias lógicas.', count: cycles.length, severity: 'high', data: cycles.map((c, i) => ({ loop: c.join(' ➜ '), num: i + 1 })), columns: [{ key: 'num', label: '#' }, { key: 'loop', label: 'Ciclo Detectado' }] });

        // 6. Membros em Grupos Inexistentes
        const grupoFantasma = membros.filter(m => m.grupos_caseiros && m.grupos_caseiros.trim() !== '' && !gruposNomes.has(normalizeStr(m.grupos_caseiros)));
        newReports.push({ id: 'grupo_fantasma', title: 'Membros em Grupos Inexistentes', description: 'Membros associados a um Grupo Caseiro que não existe na tabela oficial de Células.', count: grupoFantasma.length, severity: 'medium', data: grupoFantasma.map(m => ({ nome: m.nome, grupo: m.grupos_caseiros })), columns: [{ key: 'nome', label: 'Nome' }, { key: 'grupo', label: 'Grupo Digitado' }] });

        // 7. Nomes Órfãos no Discipulado
        const typos = [...allDiscNames].filter(nome => nome && !membrosNomes.has(nome));
        newReports.push({ id: 'typo_disc', title: 'Nomes Órfãos no Discipulado', description: 'Nomes na tabela de Discipulado que não têm cadastro correspondente na tabela de Membros.', count: typos.length, severity: 'medium', data: typos.map(nome => ({ nome: discOriginalNames.get(nome) || nome })), columns: [{ key: 'nome', label: 'Nome no Discipulado' }] });

        // 8. Ativos sem Telefone
        const semTel = membros.filter(m => m.status === 'Ativo' && (!m.celular_principal_sms || String(m.celular_principal_sms).trim().length < 8));
        newReports.push({ id: 'sem_tel', title: 'Membros Ativos sem Telefone', description: 'Cadastros sem celular dificultam contato e comunicação pastoral.', count: semTel.length, severity: 'low', data: semTel.map(m => ({ nome: m.nome, tipo: m.tipo_cadastro })), columns: [{ key: 'nome', label: 'Nome' }, { key: 'tipo', label: 'Tipo' }] });

        // 9. Ativos sem Email
        const semEmail = membros.filter(m => m.status === 'Ativo' && (!m.email || m.email.trim() === '' || !m.email.includes('@')));
        newReports.push({ id: 'sem_email', title: 'Membros Ativos sem Email', description: 'Cadastros sem e-mail válido limitam comunicação digital e convites.', count: semEmail.length, severity: 'low', data: semEmail.map(m => ({ nome: m.nome, tipo: m.tipo_cadastro })), columns: [{ key: 'nome', label: 'Nome' }, { key: 'tipo', label: 'Tipo' }] });

        // 10. Células Acima da Capacidade
        const grupoCount: Record<string, number> = {};
        membros.forEach(m => { if (m.grupos_caseiros) grupoCount[normalizeStr(m.grupos_caseiros)] = (grupoCount[normalizeStr(m.grupos_caseiros)] || 0) + 1; });
        const superlotadas = celulas.filter(c => {
          const limite = parseFloat(c.limite_de_pessoas) || 0;
          const atual = grupoCount[normalizeStr(c.grupo_caseiro)] || 0;
          return limite > 0 && atual > limite;
        });
        newReports.push({ id: 'superlotada', title: 'Células Acima da Capacidade', description: 'Grupos com mais membros cadastrados do que o limite definido — indicativo de necessidade de multiplicação.', count: superlotadas.length, severity: 'medium', data: superlotadas.map(c => ({ grupo: c.grupo_caseiro, atual: grupoCount[normalizeStr(c.grupo_caseiro)] || 0, limite: c.limite_de_pessoas, setor: c.setor })), columns: [{ key: 'grupo', label: 'Grupo' }, { key: 'atual', label: 'Membros Atuais' }, { key: 'limite', label: 'Limite' }, { key: 'setor', label: 'Setor' }] });

        // 11. PossÃ­veis Duplicatas de Membros
        const nomesList = membros.map(m => normalizeStr(m.nome)).filter(Boolean);
        const dupeGroups: { a: string; b: string }[] = [];
        for (let i = 0; i < nomesList.length; i++) {
          for (let j = i + 1; j < nomesList.length; j++) {
            if (nomesList[i] !== nomesList[j] && similar(nomesList[i], nomesList[j])) {
              dupeGroups.push({ a: membros[i].nome, b: membros[j].nome });
              if (dupeGroups.length >= 50) break;
            }
          }
          if (dupeGroups.length >= 50) break;
        }
        newReports.push({ id: 'duplicatas', title: 'Possíveis Membros Duplicados', description: 'Nomes muito semelhantes que podem representar o mesmo cadastro em duplicidade.', count: dupeGroups.length, severity: 'medium', data: dupeGroups.map((d, i) => ({ num: i + 1, nome_a: d.a, nome_b: d.b })), columns: [{ key: 'num', label: '#' }, { key: 'nome_a', label: 'Cadastro 1' }, { key: 'nome_b', label: 'Cadastro 2' }] });

        setReports(newReports.sort((a, b) => {
          const sev = { high: 3, medium: 2, low: 1 };
          if (sev[b.severity] !== sev[a.severity]) return sev[b.severity] - sev[a.severity];
          return b.count - a.count;
        }));
      } catch (error) {
        console.error('Error computing QA reports:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const totalErrors = useMemo(() => reports.reduce((acc, r) => acc + r.count, 0), [reports]);
  const highCount = useMemo(() => reports.filter(r => r.severity === 'high' && r.count > 0).reduce((a, r) => a + r.count, 0), [reports]);

  const visibleReports = filter === 'all' ? reports : reports.filter(r => r.severity === filter);

  const exportCSV = (report: QAReport) => {
    const headers = report.columns.map(c => c.label).join(';');
    const rows = report.data.map(row => report.columns.map(c => `"${row[c.key] ?? ''}"`).join(';')).join('\n');
    const blob = new Blob([headers + '\n' + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `qa_${report.id}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-7xl mx-auto pb-12">
      <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 text-red-700 text-sm font-semibold mb-3 border border-red-100 shadow-sm">
            <AlertTriangle className="w-4 h-4" /> Quality Assurance (QA)
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Auditoria de Dados</h1>
          <p className="mt-2 text-sm text-gray-500 max-w-2xl">
            Identifique inconsistências, cadastros órfãos e quebras de regras de negócio para manter a saúde do banco de dados.
          </p>
        </div>
        {!isLoading && (
          <div className="flex gap-3">
            <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex items-center gap-3">
              <Activity className="text-red-600 w-6 h-6" />
              <div>
                <p className="text-xs text-red-600 font-medium">Alta Prioridade</p>
                <p className="text-2xl font-bold text-red-700">{highCount}</p>
              </div>
            </div>
            <div className="bg-white border border-gray-200 p-4 rounded-xl flex items-center gap-3">
              <FileWarning className="text-gray-500 w-6 h-6" />
              <div>
                <p className="text-xs text-gray-500 font-medium">Total de Erros</p>
                <p className="text-2xl font-bold text-gray-900">{totalErrors}</p>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Filter Tabs */}
      {!isLoading && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {(['all', 'high', 'medium', 'low'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={clsx('px-4 py-1.5 rounded-full text-sm font-medium border transition-colors',
                filter === f
                  ? f === 'high' ? 'bg-red-600 text-white border-red-600'
                    : f === 'medium' ? 'bg-orange-500 text-white border-orange-500'
                    : f === 'low' ? 'bg-yellow-500 text-white border-yellow-500'
                    : 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              )}>
              {f === 'all' ? 'Todos os relatórios' : `Severidade ${severityLabel[f]}`}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 flex flex-col items-center justify-center min-h-[400px]">
          <Loader2 className="h-10 w-10 animate-spin text-primary-600 mb-4" />
          <p className="text-gray-700 font-semibold text-lg">Analisando base de dados...</p>
          <p className="text-gray-400 text-sm mt-1">Cruzando membros, células e vínculos de discipulado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {visibleReports.map((report) => (
            <div key={report.id} className={clsx(
              'bg-white rounded-xl shadow-sm border transition-all duration-200 overflow-hidden',
              expandedId === report.id ? 'border-primary-200 ring-1 ring-primary-50' : 'border-gray-200 hover:border-gray-300',
              report.count === 0 && 'opacity-60'
            )}>
              <div className="p-5 flex items-center gap-4 cursor-pointer"
                onClick={() => report.count > 0 && setExpandedId(expandedId === report.id ? null : report.id)}>
                <div className={clsx('h-10 w-10 shrink-0 rounded-full flex items-center justify-center border',
                  report.count === 0 ? 'bg-green-50 text-green-600 border-green-200'
                    : report.severity === 'high' ? 'bg-red-50 text-red-600 border-red-200'
                    : report.severity === 'medium' ? 'bg-orange-50 text-orange-600 border-orange-200'
                    : 'bg-yellow-50 text-yellow-600 border-yellow-200'
                )}>
                  {report.count === 0 ? <ShieldCheck className="w-5 h-5" /> : <FileWarning className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-gray-900">{report.title}</h3>
                    <span className={clsx('text-xs px-2 py-0.5 rounded-full font-semibold border',
                      report.severity === 'high' ? 'bg-red-50 text-red-700 border-red-200'
                        : report.severity === 'medium' ? 'bg-orange-50 text-orange-600 border-orange-200'
                        : 'bg-yellow-50 text-yellow-600 border-yellow-200'
                    )}>
                      {severityLabel[report.severity]}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{report.description}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {report.count > 0 && (
                    <button onClick={e => { e.stopPropagation(); exportCSV(report); }}
                      className="hidden sm:flex items-center gap-1 text-xs text-gray-500 border border-gray-200 px-2 py-1 rounded-lg hover:bg-gray-50 transition-colors">
                      <Download className="w-3 h-3" /> CSV
                    </button>
                  )}
                  <span className={clsx('px-3 py-1 text-sm font-bold rounded-full',
                    report.count === 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-800'
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

              {expandedId === report.id && report.count > 0 && (
                <div className="border-t border-gray-100 bg-gray-50/50 p-5">
                  <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          {report.columns.map((col, idx) => (
                            <th key={col.key} className={clsx('py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider', idx === 0 ? 'pl-6 pr-3' : 'px-3')}>
                              {col.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {report.data.slice(0, 100).map((row, i) => (
                          <tr key={i} className="hover:bg-gray-50/50">
                            {report.columns.map((col, idx) => (
                              <td key={col.key} className={clsx('whitespace-nowrap py-2 text-sm text-gray-700', idx === 0 ? 'pl-6 pr-3 font-medium text-gray-900' : 'px-3')}>
                                {col.key === 'nome' && row[col.key] ? (
                                  <Link to={`/crm/${encodeURIComponent(row[col.key])}`} className="text-primary-600 hover:text-primary-800 hover:underline">
                                    {row[col.key]}
                                  </Link>
                                ) : (row[col.key] ?? '-')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {report.data.length > 100 && (
                      <div className="p-3 text-center text-sm text-gray-500 border-t border-gray-100">
                        Exibindo 100 de {report.data.length} registros. Exporte o CSV para ver todos.
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
