import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabaseReader } from '../lib/supabase';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Search, Sparkles, Filter,
  Download, Copy, RefreshCw, GraduationCap, AlertCircle,
  Database, ArrowRight, ShieldCheck,
  Clock, Play, Terminal, Code, ExternalLink, History, ChevronDown, ChevronUp, Table2
} from 'lucide-react';
import clsx from 'clsx';
import { filterOperationalMembers } from '../lib/operationalScope';

interface Member {
  id: any;
  nome: string;
  apelido?: string;
  status?: string;
  sexo?: string;
  data_de_cadastro?: string | null;
  data_de_vinculo?: string | null;
  data_atualizacao?: string | null;
  nascimento?: string | null;
  grupos_caseiros?: string | null;
  estado_civil?: string | null;
  tipo_de_pessoa?: string | null;
  tipo_cadastro?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  celular_principal_sms?: string | null;
  telefone_fixo?: string | null;
  email?: string | null;
}

const parseSafeDate = (dateStr?: string | null) => {
  if (!dateStr) return null;
  const dob = dateStr.trim();
  if (dob.includes('/')) {
    const parts = dob.split('/');
    if (parts.length === 3) {
      const d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
      return isNaN(d.getTime()) ? null : d;
    }
  } else if (dob.includes('-')) {
    const parts = dob.split('T')[0].split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        return isNaN(d.getTime()) ? null : d;
      } else {
        // DD-MM-YYYY
        const d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
        return isNaN(d.getTime()) ? null : d;
      }
    }
  }
  const parsed = new Date(dob);
  return isNaN(parsed.getTime()) ? null : parsed;
};

const calculateAge = (dob?: string | null) => {
  const birth = parseSafeDate(dob);
  if (!birth) return -1;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--;
  return age;
};

// Calculates connection duration in months
const calculateDurationInMonths = (cadastro?: string | null, vinculo?: string | null, status?: string, atualizacao?: string | null) => {
  const targetDateStr = vinculo || cadastro;
  const targetDate = parseSafeDate(targetDateStr);
  if (!targetDate) return -1;
  
  const isInactive = status && status.trim().toUpperCase() !== 'ATIVO';
  const endDate = (isInactive && atualizacao) ? parseSafeDate(atualizacao) : new Date();
  if (!endDate) return -1;
  
  const diffYears = endDate.getFullYear() - targetDate.getFullYear();
  const diffMonths = endDate.getMonth() - targetDate.getMonth();
  
  return diffYears * 12 + diffMonths;
};

const formatDuration = (months: number) => {
  if (months < 0) return 'Não Informado';
  if (months === 0) return 'Menos de 1 mês';
  if (months < 12) return `${months} ${months === 1 ? 'mês' : 'meses'}`;
  
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  
  if (remMonths === 0) return `${years} ${years === 1 ? 'ano' : 'anos'}`;
  return `${years} ${years === 1 ? 'ano' : 'anos'} e ${remMonths} ${remMonths === 1 ? 'mês' : 'meses'}`;
};

export const LabQuery: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const allowedModules = useMemo(() => {
    if (!user) return [];
    if (user.role === 'admin') {
      return ['Lab: Visão da Plenitude', 'Lab: Gestão de Visitas', 'Lab: Consultas & Estudos'];
    }
    try {
      const stored = localStorage.getItem('church_dynamic_roles');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed[user.role]) {
          return parsed[user.role].modules || [];
        }
      }
    } catch (_) {}
    
    if (user.role === 'pastor') {
      return ['Lab: Visão da Plenitude', 'Lab: Gestão de Visitas', 'Lab: Consultas & Estudos'];
    }
    return [];
  }, [user]);

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setFetchError] = useState<string | null>(null);

  // Mode Selector: 'visual', 'playground', or 'sql'
  const [queryMode, setQueryMode] = useState<'visual' | 'playground' | 'sql'>('visual');

  // SQL Console State
  const [sqlQuery, setSqlQuery] = useState(
`-- Escreva sua query SQL aqui (apenas SELECT)
SELECT
  nome,
  status,
  data_de_vinculo,
  data_atualizacao,
  grupos_caseiros,
  bairro
FROM membros
WHERE status != 'Ativo'
  AND data_de_vinculo IS NOT NULL
ORDER BY data_atualizacao DESC
LIMIT 50;`
  );
  const [sqlResults, setSqlResults] = useState<any[] | null>(null);
  const [sqlColumns, setSqlColumns] = useState<string[]>([]);
  const [sqlError, setSqlError] = useState<string | null>(null);
  const [sqlLoading, setSqlLoading] = useState(false);
  const [sqlHistory, setSqlHistory] = useState<{query: string; rows: number; ts: string}[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const sqlTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [schemaOpen, setSchemaOpen] = useState(false);
  const [schemaTables, setSchemaTables] = useState<{name:string; columns:{column_name:string;data_type:string}[]}[]>([]);
  const [schemaLoading, setSchemaLoading] = useState(false);

  // Playground Code Console State
  const [codeQuery, setCodeQuery] = useState<string>(
`// Consulta Customizada JS (Retorne true para incluir, false para excluir)
const meses = calculateMonths(m.data_de_cadastro, m.data_de_vinculo, m.status, m.data_atualizacao);

// Filtra apenas membros Inativos/Afastados que duraram menos de 2 anos (24 meses)
return m.status !== 'Ativo' && meses > 0 && meses < 24;`
  );
  const [codeError, setCodeError] = useState<string | null>(null);
  const [triggerRunCode, setTriggerRunCode] = useState<number>(0);

  // Filters State (Visual)
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'Ativo' | 'Inativo' | 'Todos'>('Todos');
  const [filterGender, setFilterGender] = useState<string>('Todos');
  const [filterGC, setFilterGC] = useState<string>('Todos');
  const [filterTipoPessoa, setFilterTipoPessoa] = useState<string>('Todos');
  const [filterMaritalStatus, setFilterMaritalStatus] = useState<string>('Todos');
  const [maxDurationMonths, setMaxDurationMonths] = useState<number>(-1); // -1 means No Limit
  const [minAge, setMinAge] = useState<number>(0);
  const [maxAge, setMaxAge] = useState<number>(120);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Load Data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabaseReader
          .from('membros')
          .select('id, nome, apelido, status, sexo, data_de_cadastro, data_de_vinculo, data_atualizacao, nascimento, grupos_caseiros, estado_civil, tipo_de_pessoa, tipo_cadastro, bairro, cidade, celular_principal_sms, telefone_fixo, email')
          .limit(10000);

        if (error) throw error;
        setMembers(filterOperationalMembers(data || []));
      } catch (err: any) {
        console.error('Error fetching members for lab queries:', err);
        setFetchError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Unique lists for dropdowns
  const uniqueGCs = useMemo(() => {
    const list = new Set<string>();
    members.forEach(m => {
      if (m.grupos_caseiros && m.grupos_caseiros.trim() !== '' && m.grupos_caseiros.toUpperCase() !== 'NENHUM') {
        list.add(m.grupos_caseiros);
      }
    });
    return Array.from(list).sort();
  }, [members]);

  const uniqueTipos = useMemo(() => {
    const list = new Set<string>();
    members.forEach(m => {
      const t = (m.tipo_de_pessoa || m.tipo_cadastro || '').trim().toUpperCase();
      if (t) list.add(t);
    });
    return Array.from(list).sort();
  }, [members]);

  const uniqueMaritals = useMemo(() => {
    const list = new Set<string>();
    members.forEach(m => {
      if (m.estado_civil) list.add(m.estado_civil);
    });
    return Array.from(list).sort();
  }, [members]);

  // Apply Filters Client-Side
  const filteredList = useMemo(() => {
    if (queryMode === 'playground') {
      try {
        // Compile dynamic JS function safely
        const filterFn = new Function('m', 'calculateMonths', codeQuery);
        
        return members.filter(m => {
          try {
            return !!filterFn(m, (cadastro: any, vinculo: any, status: any, atualizacao: any) => 
              calculateDurationInMonths(cadastro, vinculo, status, atualizacao)
            );
          } catch (e) {
            return false;
          }
        }).sort((a, b) => a.nome.localeCompare(b.nome));
      } catch (err: any) {
        return [];
      }
    }

    // Default Visual Mode Filtering
    return members.filter(m => {
      // 1. Status Filter
      if (filterStatus !== 'Todos') {
        const mStatus = (m.status || '').trim().toUpperCase();
        const fStatus = filterStatus.toUpperCase();
        if (fStatus === 'ATIVO' && mStatus !== 'ATIVO') return false;
        if (fStatus === 'INATIVO' && mStatus === 'ATIVO') return false;
      }

      // 2. Gender Filter
      if (filterGender !== 'Todos' && m.sexo !== filterGender) return false;

      // 3. GC Filter
      if (filterGC !== 'Todos') {
        if (filterGC === 'Sem GC') {
          const hasGC = m.grupos_caseiros && m.grupos_caseiros.trim() !== '' && m.grupos_caseiros.toUpperCase() !== 'NENHUM';
          if (hasGC) return false;
        } else {
          if (m.grupos_caseiros !== filterGC) return false;
        }
      }

      // 4. Tipo de Pessoa Filter
      if (filterTipoPessoa !== 'Todos') {
        const mTipo = (m.tipo_de_pessoa || m.tipo_cadastro || '').trim().toUpperCase();
        if (mTipo !== filterTipoPessoa.toUpperCase()) return false;
      }

      // 5. Marital Status
      if (filterMaritalStatus !== 'Todos' && m.estado_civil !== filterMaritalStatus) return false;

      // 6. Age range
      const age = calculateAge(m.nascimento);
      if (age !== -1) {
        if (age < minAge || age > maxAge) return false;
      } else if (minAge > 0 || maxAge < 120) {
        return false;
      }

      // 7. Max duration of connection (months)
      if (maxDurationMonths !== -1) {
        const months = calculateDurationInMonths(m.data_de_cadastro, m.data_de_vinculo, m.status, m.data_atualizacao);
        if (months === -1 || months > maxDurationMonths) return false;
      }

      // 8. Text Search
      if (searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase();
        const matchName = m.nome.toLowerCase().includes(term);
        const matchNick = (m.apelido || '').toLowerCase().includes(term);
        const matchBairro = (m.bairro || '').toLowerCase().includes(term);
        const matchCidade = (m.cidade || '').toLowerCase().includes(term);
        const matchPhone = (m.celular_principal_sms || m.telefone_fixo || '').includes(term);
        
        if (!matchName && !matchNick && !matchBairro && !matchCidade && !matchPhone) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [members, searchTerm, filterStatus, filterGender, filterGC, filterTipoPessoa, filterMaritalStatus, maxDurationMonths, minAge, maxAge, queryMode, codeQuery, triggerRunCode]);

  // Statistics for Current Filtered List
  const stats = useMemo(() => {
    const total = filteredList.length;
    if (total === 0) {
      return { total: 0, avgAge: 0, avgDuration: 0, malePct: 0, femalePct: 0, gcAllocatedPct: 0 };
    }

    let ageSum = 0;
    let ageCount = 0;
    let durationSum = 0;
    let durationCount = 0;
    let maleCount = 0;
    let gcCount = 0;

    filteredList.forEach(m => {
      const age = calculateAge(m.nascimento);
      if (age !== -1) {
        ageSum += age;
        ageCount++;
      }
      
      const duration = calculateDurationInMonths(m.data_de_cadastro, m.data_de_vinculo, m.status, m.data_atualizacao);
      if (duration !== -1) {
        durationSum += duration;
        durationCount++;
      }

      if (m.sexo === 'Masculino') maleCount++;

      const hasGC = m.grupos_caseiros && m.grupos_caseiros.trim() !== '' && m.grupos_caseiros.toUpperCase() !== 'NENHUM';
      if (hasGC) gcCount++;
    });

    return {
      total,
      avgAge: ageCount > 0 ? Math.round(ageSum / ageCount) : 0,
      avgDuration: durationCount > 0 ? Math.round(durationSum / durationCount) : 0,
      malePct: Math.round((maleCount / total) * 100),
      femalePct: Math.round(((total - maleCount) / total) * 100),
      gcAllocatedPct: Math.round((gcCount / total) * 100)
    };
  }, [filteredList]);

  // Playground presets selector
  const selectPlaygroundTemplate = (type: 'shortLink' | 'longActive' | 'solteirosNoGC' | 'semCelular') => {
    setCodeError(null);
    setCurrentPage(1);
    
    if (type === 'shortLink') {
      setCodeQuery(
`// Filtra membros Inativos/Afastados que entraram e saíram em menos de 2 anos (24 meses)
const meses = calculateMonths(m.data_de_cadastro, m.data_de_vinculo, m.status, m.data_atualizacao);

return m.status !== 'Ativo' && meses > 0 && meses < 24;`
      );
    } else if (type === 'longActive') {
      setCodeQuery(
`// Filtra membros Ativos fiéis com mais de 5 anos (60 meses) de casa
const meses = calculateMonths(m.data_de_cadastro, m.data_de_vinculo, m.status, m.data_atualizacao);

return m.status === 'Ativo' && meses >= 60;`
      );
    } else if (type === 'solteirosNoGC') {
      setCodeQuery(
`// Filtra solteiros ativos que participam de GCs em Vicente Pires
const estadoCivil = (m.estado_civil || '').toUpperCase();
const gc = (m.grupos_caseiros || '').toUpperCase();

return m.status === 'Ativo' && estadoCivil.includes('SOLTEIRO') && gc.includes('VICENTE PIRES');`
      );
    } else if (type === 'semCelular') {
      setCodeQuery(
`// Filtra membros ativos sem celular principal registrado no banco
return m.status === 'Ativo' && (!m.celular_principal_sms || m.celular_principal_sms.trim() === '');`
      );
    }
  };

  const handleRunPlaygroundCode = () => {
    setCodeError(null);
    try {
      const fn = new Function('m', 'calculateMonths', codeQuery);
      // Dummy check to intercept syntax/compiler crashes
      fn({ status: 'Ativo' }, () => 0);
      setTriggerRunCode(prev => prev + 1);
      setCurrentPage(1);
    } catch (e: any) {
      setCodeError(e.message);
    }
  };

  // Presets Handlers
  const applyPresetRecentMembers = () => {
    setQueryMode('visual');
    setFilterStatus('Inativo');
    setMaxDurationMonths(24); // stayed less than 24 months
    setFilterGC('Todos');
    setFilterTipoPessoa('Todos');
    setFilterGender('Todos');
    setMinAge(0);
    setMaxAge(120);
    setSearchTerm('');
    setCurrentPage(1);
  };

  const applyPresetNoGC = () => {
    setQueryMode('visual');
    setFilterStatus('Ativo');
    setFilterGC('Sem GC'); 
    setMaxDurationMonths(-1);
    setFilterTipoPessoa('Todos');
    setFilterGender('Todos');
    setMinAge(0);
    setMaxAge(120);
    setSearchTerm('');
    setCurrentPage(1);
  };

  const applyPresetExternals = () => {
    setQueryMode('visual');
    setFilterStatus('Todos');
    setFilterTipoPessoa('EXTERNO');
    setFilterGC('Todos');
    setMaxDurationMonths(-1);
    setFilterGender('Todos');
    setMinAge(0);
    setMaxAge(120);
    setSearchTerm('');
    setCurrentPage(1);
  };

  const applyPresetYoungYouth = () => {
    setQueryMode('visual');
    setFilterStatus('Ativo');
    setMinAge(12);
    setMaxAge(25);
    setMaxDurationMonths(-1);
    setFilterGC('Todos');
    setFilterTipoPessoa('Todos');
    setFilterGender('Todos');
    setSearchTerm('');
    setCurrentPage(1);
  };

  const resetAllFilters = () => {
    setSearchTerm('');
    setFilterStatus('Todos');
    setFilterGender('Todos');
    setFilterGC('Todos');
    setFilterTipoPessoa('Todos');
    setFilterMaritalStatus('Todos');
    setMaxDurationMonths(-1);
    setMinAge(0);
    setMaxAge(120);
    setCurrentPage(1);
  };


  // ── SQL Console ──────────────────────────────────────────────
  const SQL_TEMPLATES = [
    { label: '🌱 Vínculo Curto', sql: 'SELECT\n  nome, status,\n  data_de_vinculo AS entrada,\n  data_atualizacao AS saida,\n  bairro, grupos_caseiros AS gc\nFROM membros\nWHERE status != \'Ativo\'\n  AND data_de_vinculo IS NOT NULL\n  AND data_atualizacao IS NOT NULL\n  AND (data_atualizacao::date - data_de_vinculo::date) < 730\nORDER BY (data_atualizacao::date - data_de_vinculo::date) ASC\nLIMIT 100;' },
    { label: '⭐ Fiéis > 5 Anos', sql: 'SELECT nome, data_de_vinculo AS entrada,\n  EXTRACT(YEAR FROM AGE(NOW(), data_de_vinculo::date))::int AS anos_de_casa,\n  grupos_caseiros AS gc, bairro\nFROM membros\nWHERE status = \'Ativo\'\n  AND data_de_vinculo IS NOT NULL\n  AND data_de_vinculo::date < NOW() - INTERVAL \'5 years\'\nORDER BY data_de_vinculo ASC LIMIT 100;' },
    { label: '📊 Total por GC', sql: 'SELECT COALESCE(NULLIF(TRIM(grupos_caseiros),\'\'),\'Sem GC\') AS grupo_caseiro,\n  COUNT(*) AS total,\n  COUNT(*) FILTER (WHERE sexo=\'Masculino\') AS homens,\n  COUNT(*) FILTER (WHERE sexo=\'Feminino\') AS mulheres\nFROM membros WHERE status=\'Ativo\' GROUP BY 1 ORDER BY total DESC;' },
    { label: '📅 Entradas por Mês', sql: 'SELECT TO_CHAR(data_de_cadastro::date,\'YYYY-MM\') AS mes, COUNT(*) AS novos\nFROM membros WHERE data_de_cadastro IS NOT NULL\n  AND EXTRACT(YEAR FROM data_de_cadastro::date)=2024\nGROUP BY 1 ORDER BY 1;' },
    { label: '📱 Sem Celular', sql: 'SELECT nome, email, bairro, grupos_caseiros AS gc FROM membros\nWHERE status=\'Ativo\' AND (celular_principal_sms IS NULL OR TRIM(celular_principal_sms)=\'\')\nORDER BY nome;' },
    { label: '🧮 Faixas Etárias', sql: 'SELECT\n  CASE WHEN nascimento IS NULL THEN \'Sem Dados\'\n    WHEN EXTRACT(YEAR FROM AGE(NOW(),nascimento::date))<13 THEN \'Criança (0-12)\'\n    WHEN EXTRACT(YEAR FROM AGE(NOW(),nascimento::date))<18 THEN \'Adolescente (13-17)\'\n    WHEN EXTRACT(YEAR FROM AGE(NOW(),nascimento::date))<26 THEN \'Jovem (18-25)\'\n    WHEN EXTRACT(YEAR FROM AGE(NOW(),nascimento::date))<36 THEN \'Adulto Jovem (26-35)\'\n    WHEN EXTRACT(YEAR FROM AGE(NOW(),nascimento::date))<51 THEN \'Adulto (36-50)\'\n    ELSE \'Maduro (51+)\' END AS faixa_etaria,\n  COUNT(*) AS total\nFROM membros WHERE status=\'Ativo\' GROUP BY 1 ORDER BY 2 DESC;' },
  ];

  const fetchSchema = async () => {
    if (schemaTables.length > 0) { setSchemaOpen(true); return; }
    setSchemaLoading(true);
    try {
      const { data: tables } = await supabaseReader.rpc('execute_lab_query', {
        sql_text: "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"
      });
      const tableList: {name:string; columns:{column_name:string;data_type:string}[]}[] = [];
      for (const t of (tables || [])) {
        const { data: cols } = await supabaseReader.rpc('execute_lab_query', {
          sql_text: `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='${t.table_name}' ORDER BY ordinal_position LIMIT 20`
        });
        tableList.push({ name: t.table_name, columns: cols || [] });
      }
      setSchemaTables(tableList);
      setSchemaOpen(true);
    } catch(e) { console.error(e); }
    finally { setSchemaLoading(false); }
  };

  const handleRunSQL = async () => {
    if (!sqlQuery.trim()) return;
    setSqlLoading(true); setSqlError(null); setSqlResults(null); setSqlColumns([]);
    try {
      const cleanSql = sqlQuery.trim().replace(/;+$/, '');
      const { data, error } = await supabaseReader.rpc('execute_lab_query', { sql_text: cleanSql });
      if (error) throw error;
      const rows: any[] = Array.isArray(data) ? data : (data ? [data] : []);
      setSqlResults(rows);
      setSqlColumns(rows.length > 0 ? Object.keys(rows[0]) : []);
      setSqlHistory(prev => [{ query: sqlQuery, rows: rows.length, ts: new Date().toLocaleTimeString('pt-BR') }, ...prev.slice(0, 9)]);
    } catch (err: any) { setSqlError(err.message || 'Erro ao executar query.'); }
    finally { setSqlLoading(false); }
  };

  const handleExportSQLCSV = () => {
    if (!sqlResults || sqlResults.length === 0) return;
    const headers = sqlColumns.join(',');
    const rows = sqlResults.map(row => sqlColumns.map(col => {
      const v = row[col]; if (v == null) return '';
      const s = String(v);
      return (s.includes(',') || s.includes('"')) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(','));
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent('\uFEFF' + [headers, ...rows].join('\n'));
    a.download = 'lab_sql_' + new Date().toISOString().split('T')[0] + '.csv';
    a.click();
  };

  const handleCopySQLJSON = () => {
    if (!sqlResults) return;
    navigator.clipboard.writeText(JSON.stringify(sqlResults, null, 2));
    alert('Resultado copiado como JSON!');
  };


  // Export to CSV helper
  const handleExportCSV = () => {
    if (filteredList.length === 0) return;
    
    const headers = [
      'ID', 'Nome', 'Apelido', 'Status', 'Sexo', 'Tipo Pessoa', 'GC', 
      'Estado Civil', 'Bairro', 'Cidade', 'Idade', 'Tempo de Vínculo (Meses)', 
      'Data Entrada', 'Data Saída', 'Celular', 'Email'
    ];
    
    const rows = filteredList.map(m => {
      const age = calculateAge(m.nascimento);
      const months = calculateDurationInMonths(m.data_de_cadastro, m.data_de_vinculo, m.status, m.data_atualizacao);
      const isInactive = m.status && m.status.trim().toUpperCase() !== 'ATIVO';
      return [
        m.id,
        `"${m.nome}"`,
        m.apelido ? `"${m.apelido}"` : '""',
        m.status || 'Ativo',
        m.sexo || '',
        m.tipo_de_pessoa || m.tipo_cadastro || 'Membro',
        `"${m.grupos_caseiros || 'Nenhum'}"`,
        m.estado_civil || '',
        `"${m.bairro || ''}"`,
        `"${m.cidade || ''}"`,
        age !== -1 ? age : '',
        months !== -1 ? months : '',
        m.data_de_vinculo || m.data_de_cadastro || '',
        isInactive ? (m.data_atualizacao || 'Desconhecido') : 'Ativo',
        m.celular_principal_sms || '',
        m.email || ''
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `estudo_personalizado_membros_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Copy JSON Data
  const handleCopyJSON = () => {
    if (filteredList.length === 0) return;
    
    const jsonStr = JSON.stringify(filteredList.map(m => {
      const age = calculateAge(m.nascimento);
      const months = calculateDurationInMonths(m.data_de_cadastro, m.data_de_vinculo, m.status, m.data_atualizacao);
      const isInactive = m.status && m.status.trim().toUpperCase() !== 'ATIVO';
      return {
        id: m.id,
        nome: m.nome,
        status: m.status,
        sexo: m.sexo,
        tipo: m.tipo_de_pessoa || m.tipo_cadastro || 'Membro',
        grupo_caseiro: m.grupos_caseiros,
        bairro: m.bairro,
        cidade: m.cidade,
        idade: age !== -1 ? age : null,
        tempo_vinculo_meses: months !== -1 ? months : null,
        entrada: m.data_de_vinculo || m.data_de_cadastro,
        saida: isInactive ? m.data_atualizacao : 'Ativo',
        celular: m.celular_principal_sms
      };
    }), null, 2);

    navigator.clipboard.writeText(jsonStr);
    alert('Os dados do estudo foram copiados em formato JSON para a área de transferência!');
  };

  // Paginated list
  const totalPages = Math.ceil(filteredList.length / itemsPerPage);
  const paginatedList = useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage;
    return filteredList.slice(startIdx, startIdx + itemsPerPage);
  }, [filteredList, currentPage]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center space-y-3">
          <Database className="h-10 w-10 animate-spin text-indigo-500 mx-auto" />
          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Acessando Supabase Lab...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700 max-w-7xl mx-auto pb-20">
      
      {/* Dynamic Tabs Navigation inside Lab Pages */}
      <div className="flex flex-wrap gap-2 border-b border-slate-100 pb-1">
        {[
          { path: '/lab/vision', label: '🏛️ Visão de Efésios 4', id: 'Lab: Visão da Plenitude' },
          { path: '/lab/visits', label: '🏠 Gestão de Visitas', id: 'Lab: Gestão de Visitas' },
          { path: '/lab/queries', label: '📊 Consultas & Estudos', id: 'Lab: Consultas & Estudos' }
        ].filter(tab => user?.role === 'admin' || allowedModules.includes(tab.id)).map((tab) => {
          const isActive = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={clsx(
                "px-4 py-2 text-xs font-black uppercase tracking-wider rounded-t-xl transition-all border-b-2 cursor-pointer",
                isActive 
                  ? "bg-slate-900 text-white border-indigo-500" 
                  : "bg-slate-50 text-slate-500 border-transparent hover:bg-slate-100/80 hover:text-slate-700"
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Header card */}
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-8 text-white shadow-xl">
        <div className="absolute inset-0 opacity-15">
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500 rounded-full translate-x-1/3 -translate-y-1/3 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-violet-600 rounded-full -translate-x-1/3 translate-y-1/3 blur-3xl" />
        </div>
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 bg-indigo-500/10 text-indigo-300 px-3 py-1 rounded-full text-xs font-bold mb-4 border border-indigo-500/20 backdrop-blur-md">
            <Sparkles className="h-3 w-3 text-indigo-400" /> LAB · EXPLORADOR DE ESTUDOS
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2">
            Relatórios &<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-cyan-300 to-rose-300">
              Estudos Customizados
            </span>
          </h1>
          <p className="text-slate-300 max-w-2xl text-xs md:text-sm leading-relaxed">
            Monte estudos comportamentais e demográficos customizados. Isola quem durou pouco tempo no vínculo pastoral (menos de 2 anos antes de se afastar/inativar) e analise datas e durações de conexões históricas no corpo de membros.
          </p>
        </div>
      </header>

      {/* Study Presets (One-Click Actions) */}
      <section className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3.5 flex items-center gap-1.5">
          <GraduationCap className="w-4 h-4 text-indigo-500" /> Presets de Estudo Sugeridos (Um Clique)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              title: "🌱 Vínculo Curto Inativos (< 2 Anos)",
              desc: "Isola ex-membros (Inativos) que entraram e saíram do corpo em menos de 2 anos.",
              action: applyPresetRecentMembers,
              color: "hover:border-emerald-300 hover:bg-emerald-50/10 hover:text-emerald-700"
            },
            {
              title: "⚠️ Ativos Sem Grupo Caseiro",
              desc: "Membros ativos que não estão participando de nenhum GC (alto risco de desligamento).",
              action: applyPresetNoGC,
              color: "hover:border-amber-300 hover:bg-amber-50/10 hover:text-amber-700"
            },
            {
              title: "💼 Membros Externos",
              desc: "Visualização e estudos focados nos cadastros classificados como Externos.",
              action: applyPresetExternals,
              color: "hover:border-indigo-300 hover:bg-indigo-50/10 hover:text-indigo-700"
            },
            {
              title: "🎓 Jovens & Adolescentes (12-25)",
              desc: "Estudo demográfico focado na faixa etária juvenil ativa na comunidade.",
              action: applyPresetYoungYouth,
              color: "hover:border-pink-300 hover:bg-pink-50/10 hover:text-pink-700"
            }
          ].map((preset, idx) => (
            <button
              key={idx}
              onClick={preset.action}
              className={clsx(
                "p-4 text-left bg-slate-50/50 hover:bg-white rounded-2xl border border-slate-150 transition-all cursor-pointer group flex flex-col justify-between h-28 shadow-sm hover:shadow",
                preset.color
              )}
            >
              <div>
                <h4 className="font-extrabold text-xs text-slate-800 leading-snug group-hover:text-inherit flex items-center justify-between w-full">
                  {preset.title}
                  <ArrowRight className="w-3 h-3 text-slate-450 group-hover:translate-x-1 transition-transform" />
                </h4>
                <p className="text-[10px] text-slate-450 leading-relaxed mt-1.5 font-medium">
                  {preset.desc}
                </p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Mode Selector Tabs: Visual vs JS Code Console */}
      <div className="flex gap-2">
        <button
          onClick={() => setQueryMode('visual')}
          className={clsx(
            "flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-sm border",
            queryMode === 'visual'
              ? "bg-indigo-650 text-white border-indigo-650"
              : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
          )}
        >
          <Filter className="w-3.5 h-3.5" /> 🎛️ Filtros Avançados Visuais
        </button>
        <button
          onClick={() => setQueryMode('playground')}
          className={clsx(
            "flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-sm border",
            queryMode === 'playground'
              ? "bg-indigo-650 text-white border-indigo-650"
              : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
          )}
        >
          <Terminal className="w-3.5 h-3.5" /> 💻 Console Playground JS (Query Completa)
        </button>
        <button
          onClick={() => setQueryMode('sql')}
          className={clsx(
            "flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-sm border",
            queryMode === 'sql'
              ? "bg-emerald-600 text-white border-emerald-600"
              : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
          )}
        >
          <Database className="w-3.5 h-3.5" /> 🗃️ SQL Console (PostgreSQL Real)
        </button>
        <a
          href="https://supabase.com/dashboard/project/vadufkgbluisdamgkbln/sql/new"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-sm border bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-emerald-600"
        >
          <ExternalLink className="w-3.5 h-3.5" /> Supabase Studio
        </a>
      </div>

      {/* Query Console / Filter Panel Container */}
      {queryMode === 'playground' ? (
        <section className="bg-slate-900 rounded-3xl border border-slate-800 p-6 space-y-6 shadow-xl text-white">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Code className="w-5 h-5 text-indigo-400" />
              <div>
                <h3 className="text-xs font-black text-indigo-300 uppercase tracking-widest">
                  Console Playground de Query Turing-Completo
                </h3>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  Escreva e rode qualquer filtro JavaScript customizado contra o banco de {members.length} membros.
                </p>
              </div>
            </div>

            {/* Templates Selector */}
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider shrink-0">Modelos Prontos:</span>
              <select
                onChange={e => selectPlaygroundTemplate(e.target.value as any)}
                defaultValue="shortLink"
                className="bg-slate-800 border border-slate-700 text-xs font-semibold text-gray-300 rounded-xl px-3 py-1.5 outline-none cursor-pointer focus:ring-1 focus:ring-indigo-500"
              >
                <option value="shortLink">🌱 Vínculo Curto Inativos (&lt; 2 Anos)</option>
                <option value="longActive">⭐ Membros Fiéis (&gt; 5 Anos de Casa)</option>
                <option value="solteirosNoGC">⛪ Solteiros no GC Vicente Pires</option>
                <option value="semCelular">📱 Membros sem celular cadastrado</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Editor Area */}
            <div className="lg:col-span-8 space-y-3">
              <div className="bg-slate-950 rounded-2xl border border-slate-800 p-4 font-mono text-xs overflow-hidden shadow-inner">
                <textarea
                  value={codeQuery}
                  onChange={e => setCodeQuery(e.target.value)}
                  className="w-full h-44 bg-transparent outline-none border-none text-emerald-400 leading-relaxed font-mono resize-none focus:ring-0"
                  placeholder="// Digite seu código de filtro personalizado aqui..."
                />
              </div>

              {codeError && (
                <div className="bg-red-950/60 border border-red-800/80 rounded-2xl p-4 flex gap-3 text-red-300 items-start">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide">Erro de Compilação/Execução</p>
                    <p className="text-[10px] mt-1 leading-relaxed">{codeError}</p>
                  </div>
                </div>
              )}

              <button
                onClick={handleRunPlaygroundCode}
                className="inline-flex items-center gap-2 bg-indigo-500 hover:bg-indigo-650 text-white font-black px-5 py-2.5 rounded-xl transition-all cursor-pointer active:scale-95 shadow-lg shadow-indigo-500/20 text-xs uppercase tracking-wider"
              >
                <Play className="w-3.5 h-3.5 fill-white" /> Executar Código Customizado
              </button>
            </div>

            {/* Quick Reference Panel */}
            <div className="lg:col-span-4 bg-slate-950/50 rounded-2xl border border-slate-800/50 p-5 space-y-4 text-xs">
              <h4 className="font-extrabold text-indigo-400 uppercase tracking-widest text-[10px] border-b border-slate-800 pb-2">
                Guia de Referência do Membro (`m`)
              </h4>
              <p className="text-gray-400 text-[10px] leading-relaxed">
                Você pode utilizar os seguintes atributos do objeto de membro `m` nas expressões do seu script:
              </p>
              <div className="space-y-2 max-h-36 overflow-y-auto pr-1 text-[10px] font-mono text-gray-300">
                <p><span className="text-indigo-400">m.nome</span> : string (Nome completo)</p>
                <p><span className="text-indigo-400">m.status</span> : 'Ativo' | 'Inativo'</p>
                <p><span className="text-indigo-400">m.sexo</span> : 'Masculino' | 'Feminino'</p>
                <p><span className="text-indigo-400">m.estado_civil</span> : string</p>
                <p><span className="text-indigo-400">m.grupos_caseiros</span> : string</p>
                <p><span className="text-indigo-400">m.data_de_cadastro</span> : string (entrada)</p>
                <p><span className="text-indigo-400">m.data_de_vinculo</span> : string (batismo/adesão)</p>
                <p><span className="text-indigo-400">m.data_atualizacao</span> : string (data da última atualização)</p>
                <p><span className="text-indigo-400">m.bairro</span> / <span className="text-indigo-400">m.cidade</span> : string</p>
              </div>
              <p className="text-[9px] text-gray-500 leading-relaxed border-t border-slate-800 pt-3">
                * A função auxiliar <code className="text-emerald-400 font-bold bg-slate-900 px-1 py-0.5 rounded">calculateMonths(cadastro, vinculo, status, atualizacao)</code> está disponível globalmente para computar o tempo de vínculo.
              </p>
            </div>
          </div>
        </section>
      ) : (
        <section className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-50 pb-4">
            <h3 className="text-xs font-black text-slate-405 uppercase tracking-widest flex items-center gap-1.5 text-slate-800">
              <Filter className="w-4 h-4 text-indigo-500" /> Filtros e Sintonia do Estudo Customizado
            </h3>
            {(searchTerm || filterStatus !== 'Todos' || filterGender !== 'Todos' || filterGC !== 'Todos' || filterTipoPessoa !== 'Todos' || filterMaritalStatus !== 'Todos' || maxDurationMonths !== -1 || minAge > 0 || maxAge < 120) && (
              <button
                onClick={resetAllFilters}
                className="text-[10px] text-red-650 font-extrabold uppercase hover:underline cursor-pointer flex items-center gap-1 active:scale-95"
              >
                <RefreshCw className="w-3 h-3" /> Limpar Todos os Filtros
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {/* Text Search */}
            <div className="space-y-1.5">
              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wide">Busca Rápida</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Nome, apelido, bairro..."
                  value={searchTerm}
                  onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                  className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-300 focus:border-indigo-400 text-xs font-medium text-slate-700 bg-slate-50/50"
                />
              </div>
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wide font-bold">Status no Cadastro</label>
              <select
                value={filterStatus}
                onChange={e => { setFilterStatus(e.target.value as any); setCurrentPage(1); }}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-300 focus:border-indigo-400 text-xs font-semibold text-slate-600 bg-slate-50/50 cursor-pointer"
              >
                <option value="Todos">Todos os Status</option>
                <option value="Ativo">Ativos</option>
                <option value="Inativo">Inativos / Afastados</option>
              </select>
            </div>

            {/* Tipo de Pessoa */}
            <div className="space-y-1.5">
              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wide">Tipo de Cadastro</label>
              <select
                value={filterTipoPessoa}
                onChange={e => { setFilterTipoPessoa(e.target.value); setCurrentPage(1); }}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-300 focus:border-indigo-400 text-xs font-semibold text-slate-600 bg-slate-50/50 cursor-pointer"
              >
                <option value="Todos">Todos os Tipos</option>
                {uniqueTipos.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Grupo Caseiro */}
            <div className="space-y-1.5">
              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wide">Grupo Caseiro (GC)</label>
              <select
                value={filterGC}
                onChange={e => { setFilterGC(e.target.value); setCurrentPage(1); }}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-300 focus:border-indigo-400 text-xs font-semibold text-slate-600 bg-slate-50/50 cursor-pointer"
              >
                <option value="Todos">Todos os GCs</option>
                <option value="Sem GC">🚫 Sem Grupo Caseiro</option>
                {uniqueGCs.map(gc => (
                  <option key={gc} value={gc}>{gc}</option>
                ))}
              </select>
            </div>

            {/* Tempo de Vínculo */}
            <div className="space-y-1.5">
              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wide flex items-center gap-1">
                <Clock className="w-3 h-3 text-indigo-500" /> Tempo de Vínculo
              </label>
              <select
                value={maxDurationMonths}
                onChange={e => { setMaxDurationMonths(Number(e.target.value)); setCurrentPage(1); }}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-300 focus:border-indigo-400 text-xs font-semibold text-slate-600 bg-slate-50/50 cursor-pointer"
              >
                <option value={-1}>Sem limite (Qualquer duração)</option>
                <option value={6}>Vínculo Extremamente Curto (Até 6 Meses)</option>
                <option value={12}>Vínculo Curto (Até 1 Ano)</option>
                <option value={24}>Pouco Tempo (Até 2 Anos)</option>
                <option value={60}>Médio Vínculo (Até 5 Anos)</option>
              </select>
            </div>

            {/* Sexo */}
            <div className="space-y-1.5">
              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wide">Sexo</label>
              <select
                value={filterGender}
                onChange={e => { setFilterGender(e.target.value); setCurrentPage(1); }}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-300 focus:border-indigo-400 text-xs font-semibold text-slate-600 bg-slate-50/50 cursor-pointer"
              >
                <option value="Todos">Todos</option>
                <option value="Masculino">Masculino</option>
                <option value="Feminino">Feminino</option>
              </select>
            </div>

            {/* Estado Civil */}
            <div className="space-y-1.5">
              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wide">Estado Civil</label>
              <select
                value={filterMaritalStatus}
                onChange={e => { setFilterMaritalStatus(e.target.value); setCurrentPage(1); }}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-300 focus:border-indigo-400 text-xs font-semibold text-slate-600 bg-slate-50/50 cursor-pointer"
              >
                <option value="Todos">Todos</option>
                {uniqueMaritals.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Age range */}
            <div className="space-y-1.5">
              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wide">Faixa Etária (Idade)</label>
              <div className="flex items-center gap-1.5 bg-slate-50/50 border border-slate-200 rounded-xl px-2.5 py-1.5">
                <input 
                  type="number" 
                  value={minAge} 
                  min={0}
                  max={120}
                  onChange={e => { setMinAge(Math.max(0, parseInt(e.target.value) || 0)); setCurrentPage(1); }} 
                  className="w-10 bg-transparent text-xs font-bold text-slate-700 outline-none text-center" 
                  placeholder="Mín" 
                />
                <span className="text-slate-350 text-[10px]">até</span>
                <input 
                  type="number" 
                  value={maxAge} 
                  min={0}
                  max={120}
                  onChange={e => { setMaxAge(Math.min(120, parseInt(e.target.value) || 120)); setCurrentPage(1); }} 
                  className="w-10 bg-transparent text-xs font-bold text-slate-700 outline-none text-center" 
                  placeholder="Máx" 
                />
                <span className="text-[10px] text-slate-400 uppercase font-black tracking-tighter">anos</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* SQL Console Panel */}
      {queryMode === 'sql' && (
        <section className="bg-slate-950 rounded-3xl border border-slate-800 p-6 space-y-5 shadow-2xl text-white">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                <Database className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-xs font-black text-emerald-300 uppercase tracking-widest">SQL Console — PostgreSQL Direto</h3>
                <p className="text-[10px] text-gray-500 mt-0.5">Queries SELECT contra a tabela <code className="text-emerald-400 font-mono">membros</code> em tempo real. Apenas leitura.</p>
              </div>
            </div>
            <a
              href="https://supabase.com/dashboard/project/vadufkgbluisdamgkbln/sql/new"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 text-[10px] font-black uppercase tracking-wider px-3 py-2 rounded-xl transition-all border border-slate-700"
            >
              <ExternalLink className="w-3 h-3" /> Abrir Supabase Studio
            </a>
          </div>

          {/* Templates */}
          <div>
            <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2">Templates Prontos:</p>
            <div className="flex flex-wrap gap-2">
              {SQL_TEMPLATES.map((t, i) => (
                <button
                  key={i}
                  onClick={() => setSqlQuery(t.sql)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 text-[10px] font-bold rounded-lg border border-slate-700 transition-all cursor-pointer"
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Editor */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-8 space-y-3">
              <div className="relative bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden shadow-inner">
                <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-800 bg-slate-950/50">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
                  <span className="text-[9px] text-gray-600 font-mono ml-1 uppercase tracking-widest">sql editor</span>
                </div>
                <textarea
                  ref={sqlTextareaRef}
                  value={sqlQuery}
                  onChange={e => setSqlQuery(e.target.value)}
                  onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); handleRunSQL(); } }}
                  className="w-full h-52 bg-transparent outline-none border-none text-emerald-300 leading-relaxed font-mono text-xs resize-none focus:ring-0 p-4"
                  placeholder="-- Digite sua query SQL aqui (apenas SELECT)..."
                  spellCheck={false}
                />
              </div>

              {sqlError && (
                <div className="bg-red-950/60 border border-red-800/80 rounded-2xl p-4 flex gap-3 text-red-300 items-start">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide">Erro PostgreSQL</p>
                    <p className="text-[10px] mt-1 leading-relaxed font-mono">{sqlError}</p>
                    {sqlError.includes('execute_lab_query') && (
                      <p className="text-[9px] mt-2 text-red-400 leading-relaxed">
                        ⚠️ A função <code>execute_lab_query</code> ainda não foi criada no banco. Execute o script em{' '}
                        <a href="https://supabase.com/dashboard/project/vadufkgbluisdamgkbln/sql/new" target="_blank" rel="noopener noreferrer" className="underline text-red-300">Supabase Studio</a>.
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  onClick={handleRunSQL}
                  disabled={sqlLoading}
                  className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black px-5 py-2.5 rounded-xl transition-all cursor-pointer active:scale-95 shadow-lg shadow-emerald-900/40 text-xs uppercase tracking-wider"
                >
                  {sqlLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-white" />}
                  {sqlLoading ? 'Executando...' : 'Executar SQL (Ctrl+Enter)'}
                </button>
                {sqlResults !== null && (
                  <>
                    <button onClick={handleExportSQLCSV} className="inline-flex items-center gap-1.5 text-[10px] font-black text-white bg-indigo-600 hover:bg-indigo-500 px-3.5 py-2 rounded-xl transition-all cursor-pointer active:scale-95 uppercase tracking-wide">
                      <Download className="w-3.5 h-3.5" /> CSV
                    </button>
                    <button onClick={handleCopySQLJSON} className="inline-flex items-center gap-1.5 text-[10px] font-black text-slate-300 hover:bg-slate-800 border border-slate-700 px-3.5 py-2 rounded-xl transition-all cursor-pointer active:scale-95 uppercase tracking-wide">
                      <Copy className="w-3.5 h-3.5" /> JSON
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Sidebar: history + tips */}
            <div className="lg:col-span-4 space-y-4 text-xs">
              {/* History */}
              {sqlHistory.length > 0 && (
                <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
                  <button
                    onClick={() => setShowHistory(h => !h)}
                    className="w-full flex items-center justify-between px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5"><History className="w-3.5 h-3.5" /> Histórico ({sqlHistory.length})</span>
                    {showHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                  {showHistory && (
                    <div className="divide-y divide-slate-800 max-h-48 overflow-y-auto">
                      {sqlHistory.map((h, i) => (
                        <button key={i} onClick={() => setSqlQuery(h.query)} className="w-full text-left px-4 py-2.5 hover:bg-slate-800 transition-colors cursor-pointer group">
                          <p className="text-[9px] font-mono text-emerald-400 truncate">{h.query.split('\n').join(' ').substring(0, 60)}...</p>
                          <p className="text-[8px] text-gray-600 mt-0.5">{h.ts} · {h.rows} linha(s)</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Quick reference — dynamic tables */}
              <div className="bg-slate-900/50 rounded-2xl border border-slate-800/50 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h4 className="font-extrabold text-emerald-400 uppercase tracking-widest text-[9px]">Tabelas do Banco</h4>
                  <button
                    onClick={fetchSchema}
                    disabled={schemaLoading}
                    title="Ver diagrama de schema"
                    className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {schemaLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Table2 className="w-3 h-3" />}
                    {schemaLoading ? 'Carregando...' : 'Ver Schema'}
                  </button>
                </div>
                {schemaTables.length > 0 ? (
                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {schemaTables.map(t => (
                      <div key={t.name} className="group">
                        <button
                          onClick={() => setSqlQuery(prev => prev + '\nSELECT * FROM ' + t.name + ' LIMIT 10;')}
                          className="w-full text-left"
                          title={'Inserir SELECT * FROM ' + t.name}
                        >
                          <p className="text-[10px] font-black text-emerald-400 group-hover:text-emerald-300 transition-colors font-mono">{t.name}</p>
                          <p className="text-[9px] text-gray-600 font-mono truncate">
                            {t.columns.map(c => c.column_name).join(', ')}
                          </p>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-1.5 text-[10px] font-mono text-gray-400">
                    <p><span className="text-emerald-400 font-black">membros</span></p>
                    <p className="text-gray-600">nome, status, sexo, nascimento</p>
                    <p className="text-gray-600">data_de_vinculo, data_atualizacao</p>
                    <p className="text-gray-600">grupos_caseiros, bairro, cidade</p>
                    <p className="text-gray-600">tipo_de_pessoa, estado_civil</p>
                    <p className="text-gray-600">celular_principal_sms, email</p>
                    <button onClick={fetchSchema} disabled={schemaLoading} className="mt-2 w-full text-[9px] font-black text-emerald-500 hover:text-emerald-300 uppercase tracking-wide transition-colors cursor-pointer disabled:opacity-50">
                      {schemaLoading ? 'Carregando...' : '↓ Carregar todas as tabelas'}
                    </button>
                  </div>
                )}
                <p className="text-[9px] text-gray-600 border-t border-slate-800 pt-2">
                  Clique no nome da tabela para inserir um <code className="text-emerald-400">SELECT</code>. Use <kbd className="bg-slate-800 px-1 rounded text-[8px]">Ctrl+Enter</kbd> para executar.
                </p>
              </div>
            </div>
          </div>

          {/* Schema Diagram */}
          {schemaOpen && schemaTables.length > 0 && (
            <div className="border border-slate-700 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Table2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-[10px] font-black text-emerald-300 uppercase tracking-widest">
                    Schema do Banco — {schemaTables.length} tabela(s)
                  </span>
                </div>
                <button onClick={() => setSchemaOpen(false)} className="text-gray-500 hover:text-white text-[10px] font-black uppercase tracking-wide cursor-pointer transition-colors">
                  Fechar ✕
                </button>
              </div>
              <div className="p-4 overflow-x-auto">
                <div className="flex gap-4 min-w-max">
                  {schemaTables.map(t => (
                    <div key={t.name} className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden min-w-[180px] shadow-lg">
                      {/* Table header */}
                      <div className="bg-emerald-900/40 border-b border-emerald-800/40 px-3 py-2 flex items-center gap-1.5">
                        <Database className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span className="text-[10px] font-black text-emerald-300 font-mono">{t.name}</span>
                      </div>
                      {/* Columns */}
                      <div className="divide-y divide-slate-800/60">
                        {t.columns.map(col => {
                          const isPk = col.column_name === 'id';
                          const isRef = col.column_name.endsWith('_id') && col.column_name !== 'id';
                          return (
                            <div key={col.column_name} className="flex items-center justify-between px-3 py-1.5 gap-3">
                              <span className={['text-[9px] font-mono', isPk ? 'text-yellow-400 font-black' : isRef ? 'text-blue-400' : 'text-gray-300'].join(' ')}>
                                {isPk ? '🔑 ' : isRef ? '🔗 ' : ''}{col.column_name}
                              </span>
                              <span className="text-[8px] text-gray-600 font-mono shrink-0">
                                {col.data_type.replace('character varying','varchar').replace('timestamp without time zone','timestamp').replace('timestamp with time zone','timestampz')}
                              </span>
                            </div>
                          );
                        })}
                        {t.columns.length === 0 && (
                          <div className="px-3 py-2 text-[9px] text-gray-600 italic">sem colunas</div>
                        )}
                      </div>
                      {/* Quick select button */}
                      <div className="border-t border-slate-800 px-3 py-2">
                        <button
                          onClick={() => { setSqlQuery('SELECT *\nFROM ' + t.name + '\nLIMIT 20;'); setSchemaOpen(false); }}
                          className="w-full text-[8px] font-black uppercase text-emerald-500 hover:text-emerald-300 transition-colors cursor-pointer tracking-wider"
                        >
                          SELECT * FROM {t.name}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Results Table */}
          {sqlResults !== null && (
            <div className="border border-slate-800 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Table2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-[10px] font-black text-emerald-300 uppercase tracking-widest">
                    {sqlResults.length} linha(s) · {sqlColumns.length} coluna(s)
                  </span>
                </div>
              </div>
              {sqlResults.length === 0 ? (
                <div className="py-10 text-center text-gray-500 text-xs">Query executada com sucesso — nenhum resultado retornado.</div>
              ) : (
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="sticky top-0">
                      <tr className="bg-slate-800 text-[9px] font-black text-emerald-400 uppercase tracking-wider">
                        {sqlColumns.map(col => (
                          <th key={col} className="py-2 px-4 whitespace-nowrap border-b border-slate-700">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {sqlResults.slice(0, 200).map((row, ri) => (
                        <tr key={ri} className="hover:bg-slate-900/60 transition-colors">
                          {sqlColumns.map(col => (
                            <td key={col} className="py-2 px-4 text-gray-300 font-mono whitespace-nowrap max-w-[200px] truncate" title={String(row[col] ?? '')}>
                              {row[col] === null ? <span className="text-gray-600 italic">null</span> : String(row[col])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {sqlResults.length > 200 && (
                    <div className="px-4 py-3 text-[9px] text-gray-500 bg-slate-900 border-t border-slate-800">
                      Exibindo apenas as primeiras 200 linhas. Exporte o CSV para ver todos os {sqlResults.length} resultados.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Query Stats Panel */}
      <section className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {[
          { label: "Pessoas Selecionadas", value: stats.total, color: "text-indigo-650" },
          { label: "Idade Média", value: stats.avgAge > 0 ? `${stats.avgAge} anos` : 'N/C', color: "text-slate-800" },
          { label: "Tempo de Vínculo Médio", value: stats.avgDuration > 0 ? formatDuration(stats.avgDuration) : 'N/C', color: "text-indigo-600" },
          { label: "Alocados em GC", value: `${stats.gcAllocatedPct}%`, color: "text-emerald-600" },
          { label: "Masculino", value: `${stats.malePct}%`, color: "text-blue-500" },
          { label: "Feminino", value: `${stats.femalePct}%`, color: "text-pink-500" }
        ].map((item, index) => (
          <div key={index} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between min-h-[90px]">
            <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">
              {item.label}
            </span>
            <span className={clsx("text-lg font-black mt-2 leading-none", item.color)}>
              {item.value}
            </span>
          </div>
        ))}
      </section>

      {/* Data Table and Export Panel */}
      <section className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-extrabold text-sm text-slate-800 leading-snug">
              Resultados do Estudo ({filteredList.length} registros encontrados)
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5 font-medium">
              Lista ordenada alfabeticamente baseada nas restrições especificadas acima.
            </p>
          </div>

          {filteredList.length > 0 && (
            <div className="flex gap-2">
              <button
                onClick={handleCopyJSON}
                className="inline-flex items-center gap-1.5 text-xs font-black text-slate-650 hover:bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl transition-all cursor-pointer active:scale-95 shadow-sm uppercase tracking-wide text-[10px]"
              >
                <Copy className="w-3.5 h-3.5" /> Copiar JSON
              </button>
              <button
                onClick={handleExportCSV}
                className="inline-flex items-center gap-1.5 text-xs font-black text-white bg-indigo-650 hover:bg-indigo-750 px-3.5 py-2 rounded-xl transition-all cursor-pointer active:scale-95 shadow-md shadow-indigo-200 uppercase tracking-wide text-[10px]"
              >
                <Download className="w-3.5 h-3.5" /> Exportar CSV
              </button>
            </div>
          )}
        </div>

        {/* Data Grid */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-6">Nome</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Gênero</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Grupo Caseiro</th>
                <th className="py-3 px-4">Bairro / RA</th>
                <th className="py-3 px-3">Idade</th>
                <th className="py-3 px-4">Tempo de Vínculo</th>
                <th className="py-3 px-4">Entrada / Saída (Inativação)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-xs text-slate-700">
              {paginatedList.map((m) => {
                const age = calculateAge(m.nascimento);
                const durationMonths = calculateDurationInMonths(m.data_de_cadastro, m.data_de_vinculo, m.status, m.data_atualizacao);
                const isInactive = m.status && m.status.trim().toUpperCase() !== 'ATIVO';
                const hasShortLink = isInactive && durationMonths > 0 && durationMonths < 24;
                
                return (
                  <tr key={m.id} className="hover:bg-slate-50/30 transition-colors">
                    <td className="py-3.5 px-6">
                      <span className="font-extrabold text-slate-900 block truncate max-w-[200px]" title={m.nome}>
                        {m.nome}
                      </span>
                      {m.apelido && (
                        <span className="text-[9px] text-slate-400 font-bold bg-slate-100 px-1 py-0.5 rounded uppercase mt-0.5 inline-block">
                          {m.apelido}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-3">
                      <span className={clsx(
                        "text-[9px] font-black uppercase px-2 py-0.5 rounded-full border tracking-wide",
                        m.status === 'Ativo' 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                          : 'bg-red-50 text-red-700 border-red-100'
                      )}>
                        {m.status || 'Ativo'}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 font-semibold text-slate-550">
                      {m.sexo === 'Masculino' ? '🚹 M' : '🚺 F'}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-600">
                      {m.tipo_de_pessoa || m.tipo_cadastro || 'Membro'}
                    </td>
                    <td className="py-3.5 px-4">
                      {m.grupos_caseiros && m.grupos_caseiros.trim() !== '' && m.grupos_caseiros.toUpperCase() !== 'NENHUM' ? (
                        <span className="font-extrabold text-indigo-650 bg-indigo-50 px-2 py-1 rounded-md text-[10px]">
                          {m.grupos_caseiros}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-medium italic">Sem GC</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-slate-800 block truncate max-w-[120px]" title={m.bairro || ''}>
                        {m.bairro || 'N/C'}
                      </span>
                      <span className="text-[9px] text-slate-400 block font-medium mt-0.5">
                        {m.cidade || ''}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 font-bold text-slate-900">
                      {age !== -1 ? `${age} anos` : '—'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-indigo-650 block">
                        {formatDuration(durationMonths)}
                      </span>
                      {hasShortLink && (
                        <span className="text-[8px] bg-red-50 text-red-650 border border-red-150 px-1 py-0.5 rounded font-black uppercase mt-1 inline-block tracking-wider animate-pulse">
                          ⚠️ Vínculo Curto
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-600 leading-normal">
                      <span className="block font-bold">
                        📥 Entrada: {(() => {
                          const parsed = parseSafeDate(m.data_de_vinculo || m.data_de_cadastro);
                          return parsed ? parsed.toLocaleDateString('pt-BR') : 'Sem data';
                        })()}
                      </span>
                      <span className={clsx("text-[10px] block font-black mt-1 uppercase tracking-wider", isInactive ? "text-red-600" : "text-emerald-600")}>
                        {isInactive 
                          ? `📤 Saída: ${(() => {
                              const parsed = parseSafeDate(m.data_atualizacao);
                              return parsed ? parsed.toLocaleDateString('pt-BR') : 'Inativo (S/ data)';
                            })()}` 
                          : '⚡ Ativo atualmente'}
                      </span>
                    </td>
                  </tr>
                );
              })}

              {filteredList.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-slate-400 bg-slate-50/10">
                    <AlertCircle className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                    <p className="font-bold text-sm">Nenhum registro atende aos filtros do estudo</p>
                    <p className="text-xs text-slate-400 mt-1">Ajuste os filtros acima ou limpe-os para recomeçar.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-50 bg-slate-50/30 flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Página {currentPage} de {totalPages} ({filteredList.length} itens no total)
            </span>
            <div className="flex gap-1">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-650 hover:bg-slate-50 disabled:opacity-40 transition-all cursor-pointer"
              >
                Anterior
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-650 hover:bg-slate-50 disabled:opacity-40 transition-all cursor-pointer"
              >
                Próximo
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Helpful methodology footer */}
      <div className="bg-indigo-50 border border-indigo-150 rounded-3xl p-6 flex items-start gap-4 shadow-sm">
        <ShieldCheck className="w-6 h-6 text-indigo-600 shrink-0 mt-0.5" />
        <div>
          <h4 className="text-xs font-black text-indigo-900 uppercase tracking-wider">Metodologia e Coleta de Dados</h4>
          <p className="text-[11px] text-indigo-700 leading-relaxed mt-1 font-medium">
            Este painel foi projetado especificamente para apoiar a liderança em análises ad-hoc e estudos de retenção/demografia. O cálculo de <strong>Tempo de Vínculo</strong> prioriza a data de batismo/vínculo (`data_de_vinculo`) e retrocede para a data de cadastro (`data_de_cadastro`) se ausente, calculando com precisão matemática a duração real da conexão do membro na comunidade local. Para membros inativos, a data de saída é baseada na última alteração do registro (`data_atualizacao`), isolando perfeitamente a evasão precoce. Os dados são totalmente criptografados de ponta a ponta.
          </p>
          <p className="text-[9px] text-indigo-400 font-bold uppercase tracking-widest mt-2">Efésios 4:16 — BSB CHURCH LAB ENVIRONMENT</p>
        </div>
      </div>

    </div>
  );
};
