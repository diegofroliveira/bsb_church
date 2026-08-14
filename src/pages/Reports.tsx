import React, { useEffect, useState, useMemo } from 'react';
import { supabaseReader } from '../lib/supabase';
import { Filter, Download, Loader2, Search, FileText, ArrowUpDown, ChevronUp, ChevronDown, Home, ShieldAlert, Users, Heart, Plus, X, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import * as XLSX from 'xlsx';
import { filterOperationalMembers } from '../lib/operationalScope';
import { matchesPopulationMode, type PopulationMode } from '../lib/populationScope';
import { PopulationFlags } from '../components/PopulationFlags';

const normalizeStr = (s: string | null | undefined): string => {
  if (!s) return '';
  return s.trim().replace(/\s+/g, ' ').toUpperCase();
};

const invertParentesco = (parentesco: string, relativeGender: string | null | undefined): string => {
  const p = parentesco.trim();
  if (p === 'Mãe' || p === 'Pai') return 'Filho(a)';
  if (p === 'Filho(a)') return relativeGender === 'Feminino' ? 'Mãe' : 'Pai';
  if (p === 'Sogro(a)') return 'Genro / Nora';
  if (p === 'Genro / Nora') return 'Sogro(a)';
  if (p === 'Tio(a)') return 'Sobrinho(a)';
  if (p === 'Sobrinho(a)') return 'Tio(a)';
  return p;
};

const MultiSelect: React.FC<{
  label: string;
  options: any[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
}> = ({ label, options, selected, onChange, placeholder = "Todos" }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-2 px-3 text-sm border border-gray-200 rounded-lg bg-white cursor-pointer flex items-center justify-between min-h-[38px] group hover:border-primary-300 transition-colors"
      >
        <span className="truncate max-w-[180px] text-gray-700">
          {selected.length === 0 ? placeholder : (
            selected.length === 1 ? selected[0] : `${selected.length} selecionados`
          )}
        </span>
        <Filter className={clsx("h-3 w-3 transition-colors", isOpen ? "text-primary-500" : "text-gray-400 group-hover:text-primary-400")} />
      </div>
      
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto p-2 space-y-1 animate-in fade-in zoom-in-95 duration-200">
             <div className="flex items-center justify-between px-2 py-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Opções</span>
                <button 
                  onClick={(e) => { e.stopPropagation(); onChange([]); }}
                  className="text-[10px] font-bold text-primary-600 uppercase hover:underline"
                >
                  Limpar
                </button>
             </div>
             <div className="border-t border-gray-100 my-1" />
             {options.map(opt => {
               const val = String(opt);
               return (
                 <label key={val} className="flex items-center gap-2 px-2 py-1.5 hover:bg-primary-50 rounded-lg cursor-pointer group transition-colors">
                    <input 
                      type="checkbox" 
                      checked={selected.includes(val)}
                      onChange={(e) => {
                        e.stopPropagation();
                        if (selected.includes(val)) onChange(selected.filter(s => s !== val));
                        else onChange([...selected, val]);
                      }}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-3.5 w-3.5"
                    />
                    <span className={clsx("text-xs transition-colors", selected.includes(val) ? "text-primary-700 font-semibold" : "text-gray-600 group-hover:text-primary-600")}>
                      {val}
                    </span>
                 </label>
               );
             })}
          </div>
        </>
      )}
    </div>
  );
};

export const Reports: React.FC = () => {
  const [members, setMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'members' | 'sectors'>('members');

  // Filters
  const [filterQuery, setFilterQuery] = useState('');
  const [filterType, setFilterType] = useState<string[]>([]);
  const [filterGC, setFilterGC] = useState<string[]>([]);
  const [filterGender, setFilterGender] = useState<string[]>([]);
  const [filterAgeCategory, setFilterAgeCategory] = useState('Todas');
  const [filterState, setFilterState] = useState<string[]>([]);
  const [filterSetor, setFilterSetor] = useState<string[]>([]);
  const [filterSetorEcl, setFilterSetorEcl] = useState<string[]>([]);
  const [filterMestre, setFilterMestre] = useState<string[]>([]);
  const [filterMaritalStatus, setFilterMaritalStatus] = useState<string[]>([]);
  const [filterMinAge, setFilterMinAge] = useState<number>(0);
  const [filterMaxAge, setFilterMaxAge] = useState<number>(120);
  const [filterPersonType, setFilterPersonType] = useState<string[]>([]);
  const [filterStatusPessoa, setFilterStatusPessoa] = useState<string[]>([]);
  const [filterNoChildren, setFilterNoChildren] = useState(false);
  const [filterCellRoles, setFilterCellRoles] = useState<string[]>([]);
  const [filterIsDiscipulador, setFilterIsDiscipulador] = useState(false);
  const [populationMode, setPopulationMode] = useState<PopulationMode>('todos');

  // Manual group builder: each group accumulates members added from whatever filters/search
  // are active at the time, so different criteria (e.g. singles, then their disciplers) can be
  // combined into the same group across multiple add actions.
  type GroupBucket = { id: string; name: string; membersById: Record<string, any> };
  const [groups, setGroups] = useState<GroupBucket[]>([]);
  const [groupSearchTerm, setGroupSearchTerm] = useState<Record<string, string>>({});
  
  const [sortField, setSortField] = useState<string>('nome');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };
  
  const [selectedColumns, setSelectedColumns] = useState<string[]>([
    'nome', 'tipo_cadastro', 'grupos_caseiros', 'cargo_gc', 'setor', 'setor_eclesiastico_display', 'discipulador', 'is_discipulador_display', 'celular_principal_sms', 'email', 'nascimento', 'idade', 'sexo', 'estado_civil'
  ]);

  const columnOptions = [
    { key: 'nome', label: 'Nome' },
    { key: 'tipo_cadastro', label: 'Vínculo' },
    { key: 'grupos_caseiros', label: 'GC' },
    { key: 'cargo_gc', label: 'Cargo no GC' },
    { key: 'setor', label: 'Setor de Residência' },
    { key: 'setor_eclesiastico_display', label: 'Setor do GC' },
    { key: 'discipulador', label: 'Discipulador' },
    { key: 'is_discipulador_display', label: 'É Discipulador' },
    { key: 'celular_principal_sms', label: 'Telefone' },
    { key: 'email', label: 'E-mail' },
    { key: 'nascimento', label: 'Nascimento' },
    { key: 'idade', label: 'Idade' },
    { key: 'sexo', label: 'Sexo' },
    { key: 'estado_civil', label: 'Estado Civil' },
    { key: 'cpf', label: 'CPF' },
    { key: 'bairro', label: 'Bairro' },
    { key: 'cidade', label: 'Cidade' },
    { key: 'uf', label: 'UF' },
    { key: 'status', label: 'Status' },
    { key: 'tipo_de_pessoa', label: 'Tipo de Pessoa' },
    { key: 'status_pessoa', label: 'Status Pessoa' },
    { key: 'titular_nome', label: 'Titular da Família' },
    { key: 'parentesco', label: 'Parentesco com o Titular' },
    { key: 'mesmo_domicilio', label: 'Mesmo Domicílio' }
  ];

  useEffect(() => {
    const fetchAllData = async () => {
      setIsLoading(true);
      try {
        const [membrosRes, celulasRes, discRes] = await Promise.all([
           supabaseReader.from('membros').select('*').limit(10000),
           supabaseReader.from('celulas').select('grupo_caseiro, setor, lider, auxiliar, auxiliar_1, auxiliar_2'),
           supabaseReader.from('discipulado').select('discipulo, discipulador, status')
        ]);
        
        // Paginated loading for pessoas_familiares to bypass the 1000-row Supabase limit
        let familyRelations: any[] = [];
        let fromIndex = 0;
        const pageSize = 1000;
        while (true) {
          const { data, error } = await supabaseReader.from('pessoas_familiares')
            .select('id_pessoa_a, pessoa_a, parentesco, id_pessoa_b, pessoa_b, mesmo_domicilio')
            .range(fromIndex, fromIndex + pageSize - 1);
          
          if (error) {
            console.error('Error fetching relations chunk in Reports:', error);
            break;
          }
          if (!data || data.length === 0) break;
          familyRelations = [...familyRelations, ...data];
          if (data.length < pageSize) break;
          fromIndex += pageSize;
        }
        
        const allMembrosRaw = membrosRes.data || [];
        const excludedTypes = ['APOSTOLO', 'CONTADOR', 'EXTERNO', 'EXTRA LOCAL', 'FUNCIONARIO', 'VISITANTE'];
        const allMembros = allMembrosRaw.filter((m: any) => {
          const status = (m.status || '').trim().toLowerCase();
          if (status !== 'ativo') return false;

          const tipo = (m.tipo_de_pessoa || '')
            .trim()
            .toUpperCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");

          if (excludedTypes.includes(tipo)) return false;

          return true;
        });
        const allCelulas = celulasRes.data || [];
        const allDisc = discRes.data || [];

        // Build mapping dictionaries for O(1) lookups
        const setorMap: Record<string, string> = {};
        const lideresSet = new Set<string>();
        const auxiliaresSet = new Set<string>();

        allCelulas.forEach((c: any) => {
           if (c.grupo_caseiro && c.setor) {
               setorMap[c.grupo_caseiro.toLowerCase()] = c.setor;
           }
           if (c.lider) {
             c.lider.split(',').forEach((l: string) => {
               const cleaned = l.trim().toUpperCase();
               if (cleaned) lideresSet.add(cleaned);
             });
           }
           const auxiliares = [c.auxiliar, c.auxiliar_1, c.auxiliar_2].filter(Boolean).join(',');
           if (auxiliares) {
             auxiliares.split(',').forEach((aux: string) => {
               const cleaned = aux.trim().toUpperCase();
               if (cleaned) auxiliaresSet.add(cleaned);
             });
           }
        });

        const discipuladorMap: Record<string, string> = {};
        const discipuladoresSet = new Set<string>();
        allDisc.forEach((d: any) => {
           if (d.discipulo && d.discipulador) {
               discipuladorMap[d.discipulo.trim().toLowerCase()] = d.discipulador;
           }
           if (d.discipulador) {
               discipuladoresSet.add(d.discipulador.trim().toUpperCase());
           }
        });

        const getNormalizedSectorName = (dbSector: string | null | undefined): string => {
          if (!dbSector) return 'Sem Setor';
          const norm = dbSector.trim().toUpperCase();
          if (norm.includes('NORTE')) return 'Setor Norte';
          if (norm.includes('CENTRAL')) return 'Setor Central';
          if (norm.includes('AGUAS CLARAS') || norm.includes('ÁGUAS CLARAS')) return 'Setor Águas Claras';
          if (norm.includes('SUL')) return 'Setor Sul';
          return 'Sem Setor';
        };

        // Replicate DSU clustering to identify family titulars and relationship mappings
        const memberById = new Map<string, any>();
        const cleanName = (name: string | null | undefined): string => {
          if (!name) return '';
          return name.replace(/['"]/g, '').trim().toUpperCase().replace(/\s+/g, ' ');
        };

        allMembros.forEach(m => {
          memberById.set(m.id.toString(), m);
        });

        const parentDSU = new Map<string, string>();
        const find = (i: string): string => {
          let root = i;
          while (parentDSU.get(root) !== undefined) {
            root = parentDSU.get(root)!;
          }
          let curr = i;
          while (curr !== root) {
            let nxt = parentDSU.get(curr)!;
            parentDSU.set(curr, root);
            curr = nxt;
          }
          return root;
        };
        
        const union = (i: string, j: string) => {
          const rootI = find(i);
          const rootJ = find(j);
          if (rootI !== rootJ) {
            parentDSU.set(rootI, rootJ);
          }
        };

        familyRelations.forEach((rel: any) => {
          const mesmoDomicilio = rel.mesmo_domicilio || '';
          if (mesmoDomicilio.toUpperCase().trim() === 'SIM') {
            const idAStr = rel.id_pessoa_a?.toString();
            const idBStr = rel.id_pessoa_b?.toString();
            if (idAStr && idBStr && memberById.has(idAStr) && memberById.has(idBStr)) {
              union(idAStr, idBStr);
            }
          }
        });

        // Collect components
        const components: Record<string, string[]> = {};
        allMembros.forEach(m => {
          const idStr = m.id.toString();
          const root = find(idStr);
          if (!components[root]) components[root] = [];
          components[root].push(idStr);
        });

        // Determine Head of Family for each component
        const headByRoot = new Map<string, any>();
        const memberIdsByRoot = new Map<string, string[]>();

        Object.entries(components).forEach(([rootId, mIds]) => {
          const familyMembers = mIds.map(id => memberById.get(id)!);
          
          let head = familyMembers[0];
          const marriedMale = familyMembers.find(m => 
            m.sexo === 'Masculino' && 
            m.estado_civil && 
            m.estado_civil.toUpperCase().includes('CASADO')
          );
          if (marriedMale) {
            head = marriedMale;
          } else {
            const parent = familyMembers.find(m => {
              const normName = cleanName(m.nome);
              return familyMembers.some(c => 
                cleanName(c.pai) === normName || 
                cleanName(c.mae) === normName
              );
            });
            if (parent) {
              head = parent;
            } else {
              let oldest = head;
              let oldestAge = -1;
              familyMembers.forEach(m => {
                const dob = m.nascimento || m.data_nascimento || m.birth_date;
                let age = -1;
                if (dob) {
                  let parts = dob.includes('/') ? dob.split('/') : dob.split('-');
                  const birth = dob.includes('/') ? new Date(Number(parts[2]), Number(parts[1])-1, Number(parts[0])) : new Date(dob);
                  if (!isNaN(birth.getTime())) {
                    const now = new Date();
                    age = now.getFullYear() - birth.getFullYear();
                    if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--;
                  }
                }
                if (age > oldestAge) {
                  oldestAge = age;
                  oldest = m;
                }
              });
              head = oldest;
            }
          }
          headByRoot.set(rootId, head);
          memberIdsByRoot.set(rootId, mIds);
        });

        // Enrich members with relational data
        const enrichedMembers = allMembros.map((m: any) => {
            const nomeUpper = (m.nome || m.name || '').trim().toUpperCase();
            const nomeLower = (m.nome || m.name || '').trim().toLowerCase();
            const gcLower = (m.grupos_caseiros || '').trim().toLowerCase();
            
            const isLider = lideresSet.has(nomeUpper);
            const isAuxiliar = auxiliaresSet.has(nomeUpper) && !isLider;
            const isDiscipulador = discipuladoresSet.has(nomeUpper);
            const cargoGc = isLider ? 'Líder' : (isAuxiliar ? 'Auxiliar de Liderança' : 'Membro Comum');

            // Ecclesiastical Sector: database column with GC mapping fallback
            const rawEcl = m.setor_eclesiastico || setorMap[gcLower] || 'Sem Setor';
            const setorEcl = getNormalizedSectorName(rawEcl);
            
            // Resident Sector: database column with in-memory fallback (simulated via Prover sectors or empty)
            const rawRes = m.setor_residencial || m.setor_residencial_calculado || '';
            const setorRes = rawRes ? getNormalizedSectorName(rawRes) : (setorMap[gcLower] ? getNormalizedSectorName(setorMap[gcLower]) : 'Sem Setor');
            
            // Family details
            const root = find(m.id.toString());
            const head = headByRoot.get(root);
            const mIds = memberIdsByRoot.get(root) || [];
            
            let titularNome = '-';
            let titularId = '-';
            let parentesco = '-';
            let mesmoDomicilio = '-';

            if (head) {
              titularNome = head.nome;
              titularId = head.id.toString();
              
              if (m.id === head.id) {
                parentesco = 'Titular';
                mesmoDomicilio = 'Sim';
              } else {
                const rel = familyRelations.find((r: any) => 
                  (r.id_pessoa_a === m.id && r.id_pessoa_b === head.id) ||
                  (r.id_pessoa_b === m.id && r.id_pessoa_a === head.id)
                );
                if (rel) {
                  const isB = rel.id_pessoa_b === m.id;
                  parentesco = isB ? (rel.parentesco || 'Familiar') : invertParentesco(rel.parentesco || 'Familiar', m.sexo);
                  mesmoDomicilio = rel.mesmo_domicilio || 'Não';
                } else {
                  const fallbackRel = familyRelations.find((r: any) => 
                    (r.id_pessoa_a === m.id && mIds.includes(r.id_pessoa_b.toString())) ||
                    (r.id_pessoa_b === m.id && mIds.includes(r.id_pessoa_a.toString()))
                  );
                  if (fallbackRel) {
                    const isB = fallbackRel.id_pessoa_b === m.id;
                    parentesco = isB ? (fallbackRel.parentesco || 'Familiar') : invertParentesco(fallbackRel.parentesco || 'Familiar', m.sexo);
                    mesmoDomicilio = fallbackRel.mesmo_domicilio || 'Não';
                  } else {
                    parentesco = 'Familiar';
                    mesmoDomicilio = 'Não';
                  }
                }
              }
            }

            return {
                ...m,
                setor: setorRes, // default filter and display represents residence
                setor_eclesiastico_display: setorEcl,
                setor_residencial_display: setorRes,
                discipulador: discipuladorMap[nomeLower] || 'Sem Discipulador',
                titular_nome: titularNome,
                titular_id: titularId,
                parentesco: parentesco,
                mesmo_domicilio: mesmoDomicilio,
                isLider,
                isAuxiliar,
                isDiscipulador,
                cargo_gc: cargoGc,
                is_discipulador_display: isDiscipulador ? 'Sim' : 'Não'
            };
        });

        setMembers(filterOperationalMembers(enrichedMembers));
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAllData();
  }, []);


  // Compute Unique List of Filter Options
  const uniqueTypes = useMemo(() => Array.from(new Set(members.map(m => m.tipo_cadastro).filter(Boolean))).sort(), [members]);
  const uniqueGCs = useMemo(() => Array.from(new Set(members.map(m => m.grupos_caseiros).filter(Boolean))).sort(), [members]);
  const uniqueGenders = useMemo(() => Array.from(new Set(members.map(m => m.sexo || m.sex).filter(Boolean))).sort(), [members]);
  const uniqueStates = useMemo(() => Array.from(new Set(members.map(m => m.uf || m.estado).filter(Boolean))).sort(), [members]);
  const uniqueSetores = useMemo(() => Array.from(new Set(members.map(m => m.setor).filter(s => s !== 'Sem Setor'))).sort(), [members]);
  const uniqueSetoresEcl = useMemo(() => Array.from(new Set(members.map(m => m.setor_eclesiastico_display).filter(s => s !== 'Sem Setor'))).sort(), [members]);
  const uniqueMestres = useMemo(() => Array.from(new Set(members.map(m => m.discipulador).filter(d => d !== 'Sem Discipulador'))).sort(), [members]);
  const uniqueMaritalStatuses = useMemo(() => Array.from(new Set(members.map(m => m.estado_civil).filter(Boolean))).sort(), [members]);
  const uniquePersonTypes = useMemo(() => Array.from(new Set(members.map(m => m.tipo_de_pessoa).filter(Boolean))).sort(), [members]);
  const uniqueStatusPessoas = useMemo(() => Array.from(new Set(members.map(m => m.status_pessoa || m.status).filter(Boolean))).sort(), [members]);
  
  const allParentsNames = useMemo(() => {
    const names = new Set<string>();
    members.forEach(m => {
      if (m.pai) names.add(normalizeStr(m.pai));
      if (m.mae) names.add(normalizeStr(m.mae));
    });
    return names;
  }, [members]);

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

  const getAgeCategory = (age: number) => {
    if (age < 0) return 'Indefinida';
    if (age < 12) return 'Criança';
    if (age < 18) return 'Adolescente';
    if (age < 30) return 'Jovem';
    if (age < 60) return 'Adulto';
    return 'Idoso';
  };


  const filteredMembers = useMemo(() => {
    return members.filter(m => {
      if (!matchesPopulationMode(m, populationMode)) return false;
      if (filterQuery) {
        const queryLower = filterQuery.toLowerCase();
        const nome = (m.nome || m.name || '').toLowerCase();
        if (!nome.includes(queryLower)) return false;
      }
      if (filterType.length > 0 && !filterType.includes(m.tipo_cadastro)) return false;
      if (filterGC.length > 0 && !filterGC.includes(m.grupos_caseiros)) return false;
      if (filterSetor.length > 0 && !filterSetor.includes(m.setor)) return false;
      if (filterSetorEcl.length > 0 && !filterSetorEcl.includes(m.setor_eclesiastico_display)) return false;
      if (filterMestre.length > 0 && !filterMestre.includes(m.discipulador)) return false;
      
      const gender = m.sexo || m.sex || '';
      if (filterGender.length > 0 && !filterGender.includes(gender)) return false;
      
      const state = m.uf || m.estado || '';
      if (filterState.length > 0 && !filterState.includes(state)) return false;
      
      const age = calculateAge(m.nascimento || m.data_nascimento || m.birth_date);
      if (filterAgeCategory !== 'Todas' && getAgeCategory(age) !== filterAgeCategory) return false;
      if (age < filterMinAge || age > filterMaxAge) return false;
      
      if (filterMaritalStatus.length > 0 && !filterMaritalStatus.includes(m.estado_civil)) return false;
      if (filterPersonType.length > 0 && !filterPersonType.includes(m.tipo_de_pessoa)) return false;
      
      const status = m.status_pessoa || m.status || '';
      if (filterStatusPessoa.length > 0 && !filterStatusPessoa.includes(status)) return false;
      
      if (filterNoChildren) {
        const nomeNorm = normalizeStr(m.nome);
        if (allParentsNames.has(nomeNorm)) return false;
      }

      // Cargo no GC Filter
      if (filterCellRoles.length > 0 && !filterCellRoles.includes(m.cargo_gc)) return false;

      // É Discipulador Filter
      if (filterIsDiscipulador && !m.isDiscipulador) return false;
      
      return true;
    }).sort((a, b) => {
      let valA: any = '';
      let valB: any = '';
  
      if (sortField === 'nome') {
        valA = a.nome || a.name || '';
        valB = b.nome || b.name || '';
      } else if (sortField === 'idade') {
        valA = calculateAge(a.nascimento || a.data_nascimento || a.birth_date);
        valB = calculateAge(b.nascimento || b.data_nascimento || b.birth_date);
      } else if (sortField === 'grupos_caseiros') {
        valA = a.grupos_caseiros || '';
        valB = b.grupos_caseiros || '';
      } else if (sortField === 'discipulador') {
        valA = a.discipulador || '';
        valB = b.discipulador || '';
      } else {
        valA = a[sortField] || '';
        valB = b[sortField] || '';
      }
  
      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [members, populationMode, filterQuery, filterType, filterGC, filterGender, filterAgeCategory, filterMinAge, filterMaxAge, filterMaritalStatus, filterState, filterSetor, filterSetorEcl, filterMestre, filterPersonType, filterStatusPessoa, filterNoChildren, filterCellRoles, filterIsDiscipulador, allParentsNames, sortField, sortDirection]);

  // Real-time mini dashboard calculations
  const chartsData = useMemo(() => {
    const total = filteredMembers.length;
    
    // 1. Sectors
    const sectors: Record<string, number> = {
      'Setor Norte': 0,
      'Setor Central': 0,
      'Setor Águas Claras': 0,
      'Setor Sul': 0,
      'Sem Setor': 0
    };
    
    // 2. Age categories
    const ages = {
      'Criança (0-11)': 0,
      'Adolescente (12-17)': 0,
      'Jovem (18-29)': 0,
      'Adulto (30-59)': 0,
      'Idoso (60+)': 0,
      'Indefinida': 0
    };

    // 3. Gender
    let male = 0;
    let female = 0;
    let unknownGender = 0;

    // 4. Vínculo (Cadastro)
    let membro = 0;
    let visitante = 0;

    filteredMembers.forEach(m => {
      // Sector
      const s = m.setor || 'Sem Setor';
      if (s in sectors) sectors[s]++;
      else sectors['Sem Setor']++;

      // Age category
      const age = calculateAge(m.nascimento || m.data_nascimento || m.birth_date);
      if (age < 0) ages['Indefinida']++;
      else if (age < 12) ages['Criança (0-11)']++;
      else if (age < 18) ages['Adolescente (12-17)']++;
      else if (age < 30) ages['Jovem (18-29)']++;
      else if (age < 60) ages['Adulto (30-59)']++;
      else ages['Idoso (60+)']++;

      // Gender
      const g = (m.sexo || '').trim().toUpperCase();
      if (g.startsWith('M')) male++;
      else if (g.startsWith('F')) female++;
      else unknownGender++;

      // Vínculo
      const t = (m.tipo_cadastro || '').trim().toUpperCase();
      if (t === 'VISITANTE') visitante++;
      else membro++;
    });

    return {
      total,
      sectors: Object.entries(sectors).map(([name, count]) => ({
        name,
        count,
        pct: total > 0 ? Math.round((count / total) * 100) : 0
      })).sort((a, b) => b.count - a.count),
      ages: Object.entries(ages).map(([name, count]) => ({
        name,
        count,
        pct: total > 0 ? Math.round((count / total) * 100) : 0
      })),
      gender: {
        male,
        malePct: total > 0 ? Math.round((male / total) * 100) : 0,
        female,
        femalePct: total > 0 ? Math.round((female / total) * 100) : 0,
        unknown: unknownGender,
        unknownPct: total > 0 ? Math.round((unknownGender / total) * 100) : 0
      },
      vinculo: {
        membro,
        membroPct: total > 0 ? Math.round((membro / total) * 100) : 0,
        visitante,
        visitantePct: total > 0 ? Math.round((visitante / total) * 100) : 0
      }
    };
  }, [filteredMembers]);

  // Sector census and mismatch comparative calculations
  const sectorStats = useMemo(() => {
    const list = members;
    const sectors = ['Setor Norte', 'Setor Central', 'Setor Águas Claras', 'Setor Sul', 'Sem Setor'];
    
    // Initialize stats
    const stats: Record<string, {
      total: number;
      gcTotal: number;
      members: number;
      visitors: number;
      children: number; // 0-11
      teens: number; // 12-17
      youth: number; // 18-29
      adults: number; // 30-59
      seniors: number; // 60+
      discipled: number;
      mismatched: number;
      mismatchedList: any[];
    }> = {};

    sectors.forEach(s => {
      stats[s] = {
        total: 0,
        gcTotal: 0,
        members: 0,
        visitors: 0,
        children: 0,
        teens: 0,
        youth: 0,
        adults: 0,
        seniors: 0,
        discipled: 0,
        mismatched: 0,
        mismatchedList: []
      };
    });

    list.forEach(m => {
      // 1. Residential Sector
      const sector = m.setor || 'Sem Setor';
      const current = stats[sector] || stats['Sem Setor'];
      current.total++;

      // 2. Ecclesiastical Sector (GC)
      const eclSector = m.setor_eclesiastico_display || 'Sem Setor';
      const currentEcl = stats[eclSector] || stats['Sem Setor'];
      currentEcl.gcTotal++;

      // Vínculo
      const t = (m.tipo_cadastro || '').trim().toUpperCase();
      if (t === 'VISITANTE') current.visitors++;
      else current.members++;

      // Age category
      const age = calculateAge(m.nascimento || m.data_nascimento || m.birth_date);
      if (age >= 0) {
        if (age < 12) current.children++;
        else if (age < 18) current.teens++;
        else if (age < 30) current.youth++;
        else if (age < 60) current.adults++;
        else current.seniors++;
      }

      // Discipleship
      if (m.discipulador && m.discipulador !== 'Sem Discipulador') {
        current.discipled++;
      }

      // Mismatch
      const resSector = m.setor;
      if (resSector && eclSector && resSector !== 'Sem Setor' && eclSector !== 'Sem Setor' && resSector !== eclSector) {
        current.mismatched++;
        current.mismatchedList.push(m);
      }
    });

    return stats;
  }, [members]);

  const allMismatchedList = useMemo(() => {
    const list: any[] = [];
    const sectors = ['Setor Norte', 'Setor Central', 'Setor Águas Claras', 'Setor Sul', 'Sem Setor'];
    sectors.forEach(s => {
      const stats = sectorStats[s];
      if (stats && stats.mismatchedList) {
        list.push(...stats.mismatchedList);
      }
    });
    return list.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  }, [sectorStats]);

  const handleExportMismatchesExcel = () => {
    const allMismatches: any[] = [];
    const sectors = ['Setor Norte', 'Setor Central', 'Setor Águas Claras', 'Setor Sul', 'Sem Setor'];
    
    sectors.forEach(s => {
      const stats = sectorStats[s];
      if (stats && stats.mismatchedList) {
        stats.mismatchedList.forEach(m => {
          allMismatches.push({
            'Nome': m.nome || '-',
            'Vínculo': m.tipo_cadastro || '-',
            'Setor de Residência': m.setor || '-',
            'Bairro': m.bairro || '-',
            'Grupo Caseiro': m.grupos_caseiros || '-',
            'Setor do GC (Eclesiástico)': m.setor_eclesiastico_display || '-',
            'Discipulador': m.discipulador || '-'
          });
        });
      }
    });

    if (allMismatches.length === 0) return;

    const worksheet = XLSX.utils.json_to_sheet(allMismatches);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Setores Distintos");
    XLSX.writeFile(workbook, `setores_distintos_${new Date().getTime()}.xlsx`);
  };

  const addFilteredToGroup = (groupId: string) => {
    setGroups(prev => prev.map(g => {
      if (g.id !== groupId) return g;
      
      const isDefaultName = g.name.startsWith('Grupo ') && /^\d+$/.test(g.name.replace('Grupo ', '').trim());
      const hasNoMembersYet = Object.keys(g.membersById).length === 0;
      let name = g.name;
      if (isDefaultName || hasNoMembersYet) {
        name = generateGroupNameFromFilters(prev.length);
      }
      
      const membersById = { ...g.membersById };
      filteredMembers.forEach(m => { membersById[String(m.id)] = m; });
      return { ...g, name, membersById };
    }));
  };

  // Resolves the discipulador names of whoever is already in the group into their own member
  // records (matched by name against the full roster) and adds those disciplers to the same
  // group. Since it only looks at disciplers of members already present, narrowing the group
  // first (e.g. by age) automatically narrows which disciplers get pulled in.
  const getGroupDisciplerNames = (g: GroupBucket): Set<string> => {
    const names = new Set<string>();
    Object.values(g.membersById).forEach((m: any) => {
      const d = (m.discipulador || '').trim();
      if (d && d !== 'Sem Discipulador') names.add(normalizeStr(d));
    });
    return names;
  };

  const countNewDisciplersForGroup = (g: GroupBucket): number => {
    const names = getGroupDisciplerNames(g);
    if (names.size === 0) return 0;
    return members.filter(m => names.has(normalizeStr(m.nome)) && !g.membersById[String(m.id)]).length;
  };

  const addDisciplersToGroup = (groupId: string) => {
    setGroups(prev => prev.map(g => {
      if (g.id !== groupId) return g;
      const names = getGroupDisciplerNames(g);
      if (names.size === 0) return g;
      const membersById = { ...g.membersById };
      members.forEach(m => {
        if (names.has(normalizeStr(m.nome))) membersById[String(m.id)] = m;
      });
      return { ...g, membersById };
    }));
  };

  const addMemberToGroup = (groupId: string, member: any) => {
    setGroups(prev => prev.map(g => g.id === groupId
      ? { ...g, membersById: { ...g.membersById, [String(member.id)]: member } }
      : g));
  };

  const removeMemberFromGroup = (groupId: string, memberId: string) => {
    setGroups(prev => prev.map(g => {
      if (g.id !== groupId) return g;
      const membersById = { ...g.membersById };
      delete membersById[memberId];
      return { ...g, membersById };
    }));
  };

  const clearGroup = (groupId: string) => {
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, membersById: {} } : g));
  };

  const generateGroupNameFromFilters = (currentGroupsLength: number) => {
    const parts: string[] = [];
    if (filterQuery) parts.push(`Busca: ${filterQuery}`);
    if (filterType.length > 0) parts.push(filterType.join('/'));
    if (filterAgeCategory !== 'Todas') parts.push(filterAgeCategory);
    if (filterGender.length > 0) parts.push(filterGender.join('/'));
    if (filterSetor.length > 0) parts.push(filterSetor.join('/'));
    if (filterSetorEcl.length > 0) parts.push(`Setor GC: ${filterSetorEcl.join('/')}`);
    if (filterGC.length > 0) parts.push(filterGC.join('/'));
    if (filterMestre.length > 0) parts.push(`Disc: ${filterMestre.join('/')}`);
    if (filterCellRoles.length > 0) parts.push(filterCellRoles.join('/'));
    if (filterMinAge > 0 || filterMaxAge < 120) parts.push(`Idade ${filterMinAge}-${filterMaxAge}`);
    if (filterIsDiscipulador) parts.push('Discipuladores');
    
    if (parts.length === 0) {
      return `Grupo ${currentGroupsLength + 1}`;
    }
    
    const name = parts.join(' - ');
    return name.length > 50 ? name.substring(0, 47) + '...' : name;
  };

  const addGroup = () => {
    const name = generateGroupNameFromFilters(groups.length);
    setGroups(prev => [...prev, { id: `g${Date.now()}`, name, membersById: {} }]);
  };

  const removeGroup = (groupId: string) => {
    setGroups(prev => prev.filter(g => g.id !== groupId));
    setGroupSearchTerm(prev => { const next = { ...prev }; delete next[groupId]; return next; });
  };

  const renameGroup = (groupId: string, name: string) => {
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, name } : g));
  };

  const handleExportGroups = () => {
    const nonEmptyGroups = groups.filter(g => Object.keys(g.membersById).length > 0);
    if (nonEmptyGroups.length === 0) return;
    const workbook = XLSX.utils.book_new();
    nonEmptyGroups.forEach(g => {
      const rows = Object.values(g.membersById)
        .sort((a: any, b: any) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'))
        .map((m: any) => ({
          'Nome': m.nome || '-',
          'Idade': calculateAge(m.nascimento || m.data_nascimento || m.birth_date),
          'Sexo': m.sexo || '-',
          'Estado Civil': m.estado_civil || '-',
          'Discipulador': m.discipulador || '-',
          'Telefone': m.celular_principal_sms || m.celular || '-',
          'GC': m.grupos_caseiros || '-',
        }));
      const worksheet = XLSX.utils.json_to_sheet(rows);
      
      let sheetName = (g.name || 'Grupo')
        .replace(/[\\*?:/[\]]/g, '') // remove illegal characters
        .trim();
      if (!sheetName) sheetName = 'Grupo';
      sheetName = sheetName.substring(0, 30);
      
      let finalName = sheetName;
      let counter = 1;
      while (workbook.SheetNames.includes(finalName)) {
        finalName = `${sheetName.substring(0, 25)} (${counter})`;
        counter++;
      }
      
      XLSX.utils.book_append_sheet(workbook, worksheet, finalName);
    });
    XLSX.writeFile(workbook, `divisao_grupos_${new Date().getTime()}.xlsx`);
  };

  const handleExportExcel = () => {
    if (filteredMembers.length === 0) return;
    
    const data = filteredMembers.map(item => {
      const row: any = {};
      selectedColumns.forEach(key => {
        const label = columnOptions.find(o => o.key === key)?.label || key;
        let val = item[key];
        if (key === 'idade') val = calculateAge(item.nascimento || item.data_nascimento || item.birth_date);
        row[label] = val || '-';
      });
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Relatório");
    XLSX.writeFile(workbook, `relatorio_igrejapro_${new Date().getTime()}.xlsx`);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <FileText className="h-8 w-8 text-primary-600" />
            Relatórios e Central
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Filtre cruzamentos de dados e exporte planilhas analíticas rapidamente.
          </p>
        </div>
        {activeTab === 'members' && (
          <button
            onClick={handleExportExcel}
            disabled={isLoading || filteredMembers.length === 0}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors disabled:opacity-50"
          >
            <Download className="h-4 w-4" /> Exportar Planilha ({filteredMembers.length})
          </button>
        )}
      </header>

      {/* Modern Tabs Navigation */}
      <div className="flex border-b border-gray-150 bg-white px-6 rounded-2xl shadow-sm border border-gray-100/50 py-1">
        <button
          onClick={() => setActiveTab('members')}
          className={clsx(
            "py-3 px-6 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer focus:outline-none",
            activeTab === 'members'
              ? "border-primary-600 text-primary-700 font-black"
              : "border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-200"
          )}
        >
          <FileText className="h-4 w-4" />
          Central de Membros
        </button>
        <button
          onClick={() => setActiveTab('sectors')}
          className={clsx(
            "py-3 px-6 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer focus:outline-none",
            activeTab === 'sectors'
              ? "border-primary-600 text-primary-700 font-black"
              : "border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-200"
          )}
        >
          <Home className="h-4 w-4 text-teal-500" />
          Comparativo de Setores
        </button>
      </div>

      {activeTab === 'members' ? (
        <>

      {/* Filter Surface */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-6">
        <div className="flex md:items-center justify-between border-b border-gray-100 pb-4">
          <div className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary-500" /> Painel de Filtros Avançados
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-4">
          <PopulationFlags value={populationMode} onChange={setPopulationMode} className="md:col-span-3 xl:col-span-4 border-b border-gray-100 pb-3" />
          <div className="xl:col-span-1">
             <label className="block text-xs font-medium text-gray-500 mb-1">Buscar por Nome</label>
             <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                   type="text" value={filterQuery} onChange={e => setFilterQuery(e.target.value)}
                   className="pl-9 pr-3 py-2 w-full text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                   placeholder="Ex: João da Silva..."
                />
             </div>
          </div>
          
          <div className="xl:col-span-1">
             <MultiSelect label="Tipo / Vínculo" options={uniqueTypes} selected={filterType} onChange={setFilterType} />
          </div>

          <div className="xl:col-span-1">
             <label className="block text-xs font-medium text-gray-500 mb-1">Faixa Etária</label>
             <select value={filterAgeCategory} onChange={e => setFilterAgeCategory(e.target.value)} className="w-full py-2 px-3 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none">
                 {['Todas', 'Criança', 'Adolescente', 'Jovem', 'Adulto', 'Idoso', 'Indefinida'].map(t => <option key={t} value={t}>{t}</option>)}
             </select>
          </div>

          <div className="xl:col-span-1">
             <MultiSelect label="Sexo / Gênero" options={uniqueGenders} selected={filterGender} onChange={setFilterGender} />
          </div>

          <div className="xl:col-span-1">
             <MultiSelect label="Setor de Residência" options={uniqueSetores} selected={filterSetor} onChange={setFilterSetor} />
          </div>

          <div className="xl:col-span-1">
             <MultiSelect label="Setor do GC" options={uniqueSetoresEcl} selected={filterSetorEcl} onChange={setFilterSetorEcl} />
          </div>

          <div className="xl:col-span-1">
             <MultiSelect label="Grupo Caseiro" options={uniqueGCs} selected={filterGC} onChange={setFilterGC} />
          </div>

          <div className="xl:col-span-1">
             <MultiSelect label="UF / Estado" options={uniqueStates} selected={filterState} onChange={setFilterState} />
          </div>

          <div className="xl:col-span-1">
             <MultiSelect label="Discipulador" options={uniqueMestres} selected={filterMestre} onChange={setFilterMestre} />
          </div>

          <div className="xl:col-span-1">
             <MultiSelect label="Estado Civil" options={uniqueMaritalStatuses} selected={filterMaritalStatus} onChange={setFilterMaritalStatus} />
          </div>

          <div className="xl:col-span-1">
             <MultiSelect label="Status Pessoa" options={uniqueStatusPessoas} selected={filterStatusPessoa} onChange={setFilterStatusPessoa} />
          </div>

          <div className="xl:col-span-1">
             <MultiSelect label="Tipo de Pessoa" options={uniquePersonTypes} selected={filterPersonType} onChange={setFilterPersonType} />
          </div>

          <div className="xl:col-span-1">
             <MultiSelect label="Cargo no GC" options={['Líder', 'Auxiliar de Liderança', 'Membro Comum']} selected={filterCellRoles} onChange={setFilterCellRoles} />
          </div>

          <div className="xl:col-span-1">
             <label className="block text-xs font-medium text-gray-500 mb-1">Idade (Min / Max)</label>
             <div className="flex items-center gap-2">
                <input type="number" value={filterMinAge} onChange={e => setFilterMinAge(parseInt(e.target.value) || 0)} className="w-full py-2 px-3 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" placeholder="Min" />
                <span className="text-gray-400">/</span>
                <input type="number" value={filterMaxAge} onChange={e => setFilterMaxAge(parseInt(e.target.value) || 120)} className="w-full py-2 px-3 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none" placeholder="Max" />
             </div>
          </div>

          <div className="xl:col-span-1 flex items-end pb-1">
             <label className="flex items-center gap-2 cursor-pointer group p-2 rounded-lg hover:bg-gray-50 transition-colors border border-dashed border-gray-200 w-full h-[38px]">
                <input 
                  type="checkbox" 
                  checked={filterNoChildren}
                  onChange={e => setFilterNoChildren(e.target.checked)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 shrink-0"
                />
                <span className="text-xs font-bold text-gray-700 truncate">Apenas sem filhos (Est.)</span>
             </label>
          </div>

          <div className="xl:col-span-1 flex items-end pb-1">
             <label className="flex items-center gap-2 cursor-pointer group p-2 rounded-lg hover:bg-gray-50 transition-colors border border-dashed border-gray-200 w-full h-[38px]">
                <input 
                  type="checkbox" 
                  checked={filterIsDiscipulador}
                  onChange={e => setFilterIsDiscipulador(e.target.checked)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 shrink-0"
                />
                <span className="text-xs font-bold text-gray-700 truncate">Apenas Discipuladores</span>
             </label>
          </div>

        </div>

        {/* Quick group-assign bar: add the current filter result to a group without scrolling down */}
        <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
          <span className="text-xs font-bold text-gray-500 flex items-center gap-1.5 shrink-0">
            <Users className="h-3.5 w-3.5 text-primary-500" /> Adicionar {filteredMembers.length} filtrados ao grupo:
          </span>
          {groups.map(g => (
            <button
              key={g.id}
              onClick={() => addFilteredToGroup(g.id)}
              disabled={filteredMembers.length === 0}
              className="flex items-center gap-1.5 bg-primary-50 hover:bg-primary-100 disabled:opacity-40 text-primary-700 px-3 py-1.5 rounded-full text-xs font-bold transition-colors"
            >
              <Plus className="h-3 w-3" /> {g.name} ({Object.keys(g.membersById).length})
            </button>
          ))}
          <button
            onClick={addGroup}
            className="flex items-center gap-1.5 bg-white border border-dashed border-gray-300 hover:border-primary-300 text-gray-500 hover:text-primary-600 px-3 py-1.5 rounded-full text-xs font-bold transition-colors"
          >
            <Plus className="h-3 w-3" /> Novo Grupo
          </button>
        </div>
      </div>

      {/* Real-time Small Charts / Stats Grid */}
      {filteredMembers.length > 0 && (
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in zoom-in-95 duration-500">
          {/* Card 1: Setores */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Distribuição por Setores</h3>
              <div className="space-y-2.5">
                {chartsData.sectors.map(s => (
                  <div key={s.name} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold text-gray-700">
                      <span className="truncate">{s.name}</span>
                      <span>{s.count} <span className="text-[10px] text-gray-405">({s.pct}%)</span></span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-indigo-500 h-full rounded-full transition-all duration-500" style={{ width: `${s.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Card 2: Faixas Etárias */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Faixas Etárias</h3>
              <div className="space-y-2.5">
                {chartsData.ages.filter(a => a.count > 0 || a.name !== 'Indefinida').map(a => (
                  <div key={a.name} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold text-gray-700">
                      <span>{a.name}</span>
                      <span>{a.count} <span className="text-[10px] text-gray-405">({a.pct}%)</span></span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-teal-500 h-full rounded-full transition-all duration-500" style={{ width: `${a.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Card 3: Gênero & Vínculo */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between space-y-6">
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Distribuição por Gênero</h3>
              <div className="space-y-3">
                {/* Masculino */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-gray-700">
                    <span className="flex items-center gap-1">👨 Masculino</span>
                    <span>{chartsData.gender.male} <span className="text-[10px] text-gray-405">({chartsData.gender.malePct}%)</span></span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-blue-500 h-full rounded-full transition-all duration-500" style={{ width: `${chartsData.gender.malePct}%` }} />
                  </div>
                </div>

                {/* Feminino */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-gray-700">
                    <span className="flex items-center gap-1">👩 Feminino</span>
                    <span>{chartsData.gender.female} <span className="text-[10px] text-gray-455">({chartsData.gender.femalePct}%)</span></span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-pink-500 h-full rounded-full transition-all duration-500" style={{ width: `${chartsData.gender.femalePct}%` }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Vínculo de Cadastro</h3>
              <div className="space-y-3">
                {/* Membro */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-gray-700">
                    <span>Membros</span>
                    <span>{chartsData.vinculo.membro} <span className="text-[10px] text-gray-405">({chartsData.vinculo.membroPct}%)</span></span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${chartsData.vinculo.membroPct}%` }} />
                  </div>
                </div>

                {/* Visitante */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-gray-700">
                    <span>Visitantes</span>
                    <span>{chartsData.vinculo.visitante} <span className="text-[10px] text-gray-405">({chartsData.vinculo.visitantePct}%)</span></span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-orange-500 h-full rounded-full transition-all duration-500" style={{ width: `${chartsData.vinculo.visitantePct}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Manual Group Builder */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
          <div>
            <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
              <Users className="h-4 w-4 text-primary-500" /> Montar Grupos
            </h3>
            <p className="text-[11px] text-gray-400 mt-0.5 max-w-xl">
              Ajuste os filtros acima e adicione ao grupo desejado (atalho rápido logo abaixo do painel de filtros, ou os botões aqui embaixo). Repita quantas vezes precisar, inclusive com outros filtros, para complementar o mesmo grupo. Use "Discipuladores deste grupo" para puxar automaticamente quem disciple as pessoas já adicionadas — ex.: filtre só até 42 anos, adicione ao grupo, depois clique nesse botão: só entram os discipuladores de quem está no grupo. Também dá para adicionar uma pessoa específica pelo nome.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={addGroup}
              className="flex items-center gap-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Novo Grupo
            </button>
            <button
              onClick={handleExportGroups}
              className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-colors"
            >
              <Download className="h-3.5 w-3.5" /> Exportar Grupos
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {groups.map(g => {
            const memberList = Object.values(g.membersById).sort((a: any, b: any) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
            const term = groupSearchTerm[g.id] || '';
            const searchResults = term.trim().length >= 2
              ? members.filter(m => normalizeStr(m.nome).includes(normalizeStr(term)) && !g.membersById[String(m.id)]).slice(0, 6)
              : [];

            return (
              <div key={g.id} className="p-4 rounded-2xl border border-gray-100 bg-gray-50/50 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <input
                    value={g.name}
                    onChange={e => renameGroup(g.id, e.target.value)}
                    className="text-sm font-bold text-gray-800 bg-transparent border-b border-transparent hover:border-gray-200 focus:border-primary-400 outline-none min-w-0 flex-1"
                  />
                  <span className="text-xs font-black text-primary-700 bg-primary-50 px-2 py-0.5 rounded-full shrink-0">{memberList.length} pessoas</span>
                  {groups.length > 1 && (
                    <button onClick={() => removeGroup(g.id)} className="text-gray-300 hover:text-red-500 transition-colors shrink-0" title="Remover grupo">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => addFilteredToGroup(g.id)}
                    disabled={filteredMembers.length === 0}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-40 text-white px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add filtrados ({filteredMembers.length})
                  </button>
                  <button
                    onClick={() => clearGroup(g.id)}
                    disabled={memberList.length === 0}
                    className="text-[11px] font-bold text-gray-400 hover:text-red-500 disabled:opacity-30 transition-colors px-2 shrink-0"
                  >
                    Limpar
                  </button>
                </div>

                <button
                  onClick={() => addDisciplersToGroup(g.id)}
                  disabled={countNewDisciplersForGroup(g) === 0}
                  className="flex items-center justify-center gap-1.5 bg-white border border-emerald-200 hover:bg-emerald-50 disabled:opacity-40 disabled:hover:bg-white text-emerald-700 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors"
                  title="Busca e adiciona quem já disciple as pessoas deste grupo, mesmo que não passem pelos filtros atuais"
                >
                  <Plus className="h-3.5 w-3.5" /> Discipuladores deste grupo ({countNewDisciplersForGroup(g)})
                </button>

                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <input
                    type="text"
                    value={term}
                    onChange={e => setGroupSearchTerm(prev => ({ ...prev, [g.id]: e.target.value }))}
                    placeholder="Adicionar pessoa pelo nome..."
                    className="w-full pl-8 pr-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                  {searchResults.length > 0 && (
                    <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                      {searchResults.map(m => (
                        <button
                          key={m.id}
                          onClick={() => { addMemberToGroup(g.id, m); setGroupSearchTerm(prev => ({ ...prev, [g.id]: '' })); }}
                          className="w-full text-left px-3 py-1.5 text-xs hover:bg-primary-50 flex items-center justify-between gap-2"
                        >
                          <span className="truncate">{m.nome}</span>
                          <span className="text-[10px] text-gray-400 truncate shrink-0 ml-2">{m.discipulador}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                  {memberList.length === 0 ? (
                    <p className="text-[11px] text-gray-400 italic py-2 text-center">Nenhuma pessoa neste grupo ainda.</p>
                  ) : memberList.map((m: any) => (
                    <div key={m.id} className="flex items-center justify-between gap-2 text-[11px] text-gray-600 bg-white rounded-lg px-2 py-1 border border-gray-100">
                      <div className="min-w-0">
                        <span className="block truncate font-medium text-gray-800">{m.nome}</span>
                        <span className="block truncate text-[10px] text-gray-400">{m.discipulador}</span>
                      </div>
                      <button onClick={() => removeMemberFromGroup(g.id, String(m.id))} className="text-gray-300 hover:text-red-500 shrink-0">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-gray-50/50 px-6 py-3 border-b border-gray-100 flex items-center justify-between">
           <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
             <Filter className="h-4 w-4 text-primary-500" /> Configurar Exportação
           </h3>
           <div className="flex gap-4">
              <button onClick={() => setSelectedColumns(columnOptions.map(o => o.key))} className="text-[10px] font-bold text-primary-600 uppercase hover:underline">Selecionar Tudo</button>
              <button onClick={() => setSelectedColumns(['nome'])} className="text-[10px] font-bold text-gray-400 uppercase hover:underline">Limpar</button>
           </div>
        </div>
        <div className="p-6">
           <p className="text-xs text-gray-500 mb-4 italic">Selecione abaixo as colunas que deseja incluir no arquivo final (XLSX/CSV). Deixe marcado apenas o que for essencial para a secretaria.</p>
           <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {columnOptions.map(opt => (
                <label key={opt.key} className="flex items-center gap-2 cursor-pointer group">
                   <input 
                     type="checkbox" 
                     checked={selectedColumns.includes(opt.key)}
                     onChange={(e) => {
                       if (e.target.checked) setSelectedColumns([...selectedColumns, opt.key]);
                       else setSelectedColumns(selectedColumns.filter(c => c !== opt.key));
                     }}
                     className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
                   />
                   <span className={clsx("text-xs font-medium transition-colors", selectedColumns.includes(opt.key) ? "text-gray-900" : "text-gray-400 group-hover:text-gray-600")}>
                     {opt.label}
                   </span>
                </label>
              ))}
           </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-h-[400px] flex flex-col relative">
        {isLoading ? (
           <div className="flex-1 flex flex-col items-center justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600 mb-4" />
           </div>
        ) : filteredMembers.length === 0 ? (
           <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
              <div className="h-12 w-12 rounded-full bg-gray-50 flex items-center justify-center mb-4"><Search className="h-6 w-6 text-gray-400" /></div>
              <h3 className="text-lg font-medium text-gray-900">Nenhum membro encontrado</h3>
              <p className="text-gray-500 mt-1 max-w-sm">Os filtros aplicados não retornaram nenhum registro.</p>
           </div>
        ) : (
           <>
            <div className="bg-gray-50/50 px-6 py-3 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-gray-500 font-medium">
              <span className="flex items-center gap-1.5 text-gray-700">
                🔍 Encontrados: <strong className="text-gray-900 font-bold">{filteredMembers.length}</strong> {filteredMembers.length === 1 ? 'membro' : 'membros'}
                {filteredMembers.length > 100 && (
                  <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-100 px-1.5 py-0.5 rounded font-black uppercase shrink-0">
                    Exibindo os primeiros 100
                  </span>
                )}
              </span>
              <span>
                Use os filtros avançados ou a busca para refinar o resultado.
              </span>
            </div>

            <div className="overflow-x-auto flex-1">
               <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50/80 sticky top-0 backdrop-blur-sm z-10">
                    <tr>
                      <th className="py-4 pl-6 pr-2 text-left text-xs font-bold text-gray-400 uppercase w-12">#</th>
                      <th className="py-4 pl-2 pr-3 text-left text-xs font-bold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 transition-colors group" onClick={() => toggleSort('nome')}><div className="flex items-center gap-1">Nome {sortField === 'nome' ? (sortDirection === 'asc' ? <ChevronUp className="h-3 w-3 text-primary-500" /> : <ChevronDown className="h-3 w-3 text-primary-500" />) : <ArrowUpDown className="h-3 w-3 text-gray-300 opacity-0 group-hover:opacity-100" />}</div></th>
                      <th className="px-3 py-4 text-left text-xs font-bold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 transition-colors group" onClick={() => toggleSort('idade')}><div className="flex items-center gap-1">Perfil / Idade {sortField === 'idade' ? (sortDirection === 'asc' ? <ChevronUp className="h-3 w-3 text-primary-500" /> : <ChevronDown className="h-3 w-3 text-primary-500" />) : <ArrowUpDown className="h-3 w-3 text-gray-300 opacity-0 group-hover:opacity-100" />}</div></th>
                      <th className="px-3 py-4 text-left text-xs font-bold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 transition-colors group" onClick={() => toggleSort('grupos_caseiros')}><div className="flex items-center gap-1">GC / Setor {sortField === 'grupos_caseiros' ? (sortDirection === 'asc' ? <ChevronUp className="h-3 w-3 text-primary-500" /> : <ChevronDown className="h-3 w-3 text-primary-500" />) : <ArrowUpDown className="h-3 w-3 text-gray-300 opacity-0 group-hover:opacity-100" />}</div></th>
                      <th className="px-3 py-4 text-left text-xs font-bold text-gray-600 uppercase cursor-pointer hover:bg-gray-100 transition-colors group" onClick={() => toggleSort('discipulador')}><div className="flex items-center gap-1">Discipulador {sortField === 'discipulador' ? (sortDirection === 'asc' ? <ChevronUp className="h-3 w-3 text-primary-500" /> : <ChevronDown className="h-3 w-3 text-primary-500" />) : <ArrowUpDown className="h-3 w-3 text-gray-300 opacity-0 group-hover:opacity-100" />}</div></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {filteredMembers.slice(0, 100).map((m, idx) => {
                      const age = calculateAge(m.nascimento || m.data_nascimento || m.birth_date);
                      
                      return (
                        <tr key={m.id || idx} className="hover:bg-gray-50/50">
                           <td className="whitespace-nowrap py-4 pl-6 pr-2 text-xs font-bold text-gray-400 w-12 text-left">
                              {idx + 1}
                           </td>
                           <td className="whitespace-nowrap py-4 pl-2 pr-3">
                              <div className="flex items-center gap-3">
                                 <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-xs shrink-0">
                                    {(m.nome || m.name || '?')[0].toUpperCase()}
                                 </div>
                                 <div className="flex flex-col min-w-0">
                                    <span className="text-sm font-medium text-gray-900 truncate max-w-[200px]">{m.nome}</span>
                                    <span className="text-xs text-gray-500">{m.status || 'Ativo'}</span>
                                 </div>
                              </div>
                           </td>
                          <td className="whitespace-nowrap px-3 py-4">
                             <div className="flex flex-col min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={clsx("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium", 
                                     m.tipo_cadastro === 'Visitante' ? 'bg-orange-50 text-orange-700' : 'bg-blue-50 text-blue-700'
                                  )}>{m.tipo_cadastro || 'Membro'}</span>
                                  {m.isDiscipulador && (
                                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-250">
                                      Discipulador
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs text-gray-500 mt-1">{age > 0 ? `${age} anos` : '-'} - {m.sexo||''}</span>
                             </div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-4">
                             <div className="flex flex-col min-w-0 max-w-[180px]">
                                <span className="text-sm text-gray-900 truncate font-medium">{m.grupos_caseiros || 'Sem Grupo'}</span>
                                {m.cargo_gc !== 'Membro Comum' && (
                                  <span className={clsx(
                                    "inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold mt-0.5 w-fit",
                                    m.cargo_gc === 'Líder' ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-blue-50 text-blue-750 border border-blue-200"
                                  )}>
                                    {m.cargo_gc}
                                  </span>
                                )}
                                <div className="flex flex-col gap-0.5 mt-1 shrink-0">
                                  <span className="text-[10px] text-indigo-600 font-semibold truncate">Res.: {m.setor}</span>
                                  <span className="text-[10px] text-teal-600 font-semibold truncate">GC: {m.setor_eclesiastico_display}</span>
                                </div>
                             </div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-4">
                             <span className="text-sm font-medium text-emerald-600 truncate max-w-[150px] inline-block">{m.discipulador}</span>
                           </td>
                        </tr>
                      );
                    })}
                  </tbody>
               </table>
            </div>
           </>
         )}
      </div>
      </>
      ) : (
        <div className="space-y-6 animate-in fade-in duration-500">
          {/* Top Info Banner */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-900 via-slate-800 to-indigo-950 p-8 text-white shadow-xl">
            <div className="absolute inset-0 opacity-15">
              <div className="absolute top-0 right-0 w-96 h-96 bg-teal-400 rounded-full translate-x-1/3 -translate-y-1/3 blur-3xl" />
              <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-500 rounded-full -translate-x-1/3 translate-y-1/3 blur-3xl" />
            </div>
            <div className="relative z-10">
              <span className="block text-[8px] font-black text-teal-300 uppercase tracking-widest leading-none mb-1">
                PASTORAL & GEOGRAFIA
              </span>
              <h2 className="text-2xl md:text-3xl font-extrabold mb-2">Censo & Comparativo de Setores</h2>
              <p className="text-slate-350 text-xs leading-relaxed max-w-2xl">
                Compare a distribuição demográfica dos setores da igreja. Analise a participação intersetorial (membros residindo em um setor mas participando de GC de outro) e otimize o cuidado pastoral de forma direcionada.
              </p>
            </div>
          </div>

          {/* Sectors dashboard grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Card 1: Comparativo Populacional */}
            <div className="bg-white p-6 rounded-2xl border border-gray-150 shadow-sm flex flex-col justify-between">
              <div>
                <div className="border-b border-gray-100 pb-3 mb-4">
                  <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                    <Users className="h-4 w-4 text-indigo-500" />
                    População Residente vs Frequência de GCs
                  </h3>
                  <p className="text-[10px] text-gray-400 mt-0.5">Compara quantos membros residem no setor versus quantos participam de GCs localizados nele.</p>
                </div>

                <div className="space-y-5">
                  {['Setor Norte', 'Setor Central', 'Setor Águas Claras', 'Setor Sul'].map(sName => {
                    const stat = sectorStats[sName] || { total: 0, gcTotal: 0 };
                    const maxVal = Math.max(...['Setor Norte', 'Setor Central', 'Setor Águas Claras', 'Setor Sul'].map(x => Math.max(sectorStats[x]?.total || 0, sectorStats[x]?.gcTotal || 0)));
                    const pctRes = maxVal > 0 ? (stat.total / maxVal) * 100 : 0;
                    const pctGc = maxVal > 0 ? (stat.gcTotal / maxVal) * 100 : 0;

                    return (
                      <div key={sName} className="space-y-2 p-3.5 bg-gray-50/50 rounded-2xl border border-gray-100/50">
                        <span className="text-xs font-bold text-gray-800 block">{sName}</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[11px]">
                          {/* Residem */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-gray-500 font-semibold">
                              <span>Residem aqui:</span>
                              <span className="font-extrabold text-indigo-600">{stat.total}</span>
                            </div>
                            <div className="w-full bg-slate-200/50 h-2 rounded-full overflow-hidden">
                              <div className="bg-indigo-500 h-full rounded-full transition-all duration-500" style={{ width: `${pctRes}%` }} />
                            </div>
                          </div>
                          {/* GC */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-gray-500 font-semibold">
                              <span>Participam do GC local:</span>
                              <span className="font-extrabold text-teal-600">{stat.gcTotal}</span>
                            </div>
                            <div className="w-full bg-slate-200/50 h-2 rounded-full overflow-hidden">
                              <div className="bg-teal-500 h-full rounded-full transition-all duration-500" style={{ width: `${pctGc}%` }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Card 2: Faixas Etárias e Foco em Crianças (0-17 anos) */}
            <div className="bg-white p-6 rounded-2xl border border-gray-150 shadow-sm flex flex-col justify-between">
              <div>
                <div className="border-b border-gray-100 pb-3 mb-4">
                  <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                    <Heart className="h-4.5 w-4.5 text-teal-500" />
                    Nova Geração por Setor (0 a 17 anos)
                  </h3>
                  <p className="text-[10px] text-gray-400 mt-0.5">Identifique a concentração de crianças e adolescentes residentes em cada região.</p>
                </div>

                <div className="space-y-5">
                  {['Setor Norte', 'Setor Central', 'Setor Águas Claras', 'Setor Sul'].map(sName => {
                    const stat = sectorStats[sName] || { children: 0, teens: 0, total: 0 };
                    const totalKidCohort = stat.children + stat.teens;
                    const kidPct = stat.total > 0 ? Math.round((totalKidCohort / stat.total) * 100) : 0;
                    
                    const maxCohort = Math.max(...['Setor Norte', 'Setor Central', 'Setor Águas Claras', 'Setor Sul'].map(x => (sectorStats[x]?.children || 0) + (sectorStats[x]?.teens || 0)));
                    const barWeightPct = maxCohort > 0 ? (totalKidCohort / maxCohort) * 100 : 0;

                    const childPctOfCohort = totalKidCohort > 0 ? Math.round((stat.children / totalKidCohort) * 100) : 0;
                    const teenPctOfCohort = totalKidCohort > 0 ? Math.round((stat.teens / totalKidCohort) * 100) : 0;

                    return (
                      <div key={sName} className="space-y-2 p-1">
                        <div className="flex justify-between items-center text-xs font-semibold text-gray-800">
                          <span>{sName}</span>
                          <span className="text-[10px] text-teal-700 font-extrabold bg-teal-50 border border-teal-100 px-2.5 py-0.5 rounded-full">
                            {totalKidCohort} Kids/Adolescentes ({kidPct}%)
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex">
                          <div className="bg-sky-400 h-full transition-all duration-500" style={{ width: `${barWeightPct * (childPctOfCohort/100)}%` }} title={`Crianças: ${stat.children}`} />
                          <div className="bg-indigo-400 h-full transition-all duration-500 border-l border-white/20" style={{ width: `${barWeightPct * (teenPctOfCohort/100)}%` }} title={`Adolescentes: ${stat.teens}`} />
                        </div>
                        <div className="flex gap-4 text-[9px] text-gray-400 font-bold justify-end">
                          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-sky-400 block" /> Crianças: {stat.children}</span>
                          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-indigo-400 block" /> Adolescentes: {stat.teens}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100 bg-teal-50/20 p-3.5 rounded-2xl border border-teal-100/50 text-[11px] text-teal-850 flex items-start gap-2.5">
                <span className="text-sm shrink-0">💡</span>
                <p className="leading-relaxed font-medium text-teal-800">
                  <strong>Setor Estratégico para Kids:</strong> Águas Claras e Região concentra a maior densidade infanto-juvenil ativa da igreja. Otimize a grade de professores e salas do Ministério Infantil com base nestes números.
                </p>
              </div>
            </div>

          </div>

          {/* Card 3: Participação Intersetorial (Residência vs GC) */}
          <div className="bg-white p-6 rounded-2xl border border-gray-150 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4 mb-4">
              <div>
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <ShieldAlert className="h-4.5 w-4.5 text-amber-500" />
                  Membros em Setores Distintos (Residência vs GC)
                </h3>
                <p className="text-[10px] text-gray-400 mt-0.5">Representa membros que residem em um setor geográfico, mas participam ativamente de GCs vinculados a outro setor.</p>
              </div>
              <button
                onClick={handleExportMismatchesExcel}
                className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-black shadow-sm transition-colors cursor-pointer shrink-0"
              >
                <Download className="h-3.5 w-3.5" /> Exportar Planilha ({allMismatchedList.length})
              </button>
            </div>

            {/* Mismatches per sector grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {['Setor Norte', 'Setor Central', 'Setor Águas Claras', 'Setor Sul'].map(sName => {
                const count = sectorStats[sName]?.mismatched || 0;
                return (
                  <div key={sName} className="p-4 rounded-2xl border border-amber-100 bg-amber-50/20 text-center">
                    <span className="block text-[9px] font-black text-gray-400 uppercase tracking-wider">{sName}</span>
                    <span className="text-xl font-black text-amber-700 block mt-1">{count}</span>
                    <span className="text-[9px] text-amber-600 font-bold block">participações distintas</span>
                  </div>
                );
              })}
            </div>

            {/* Mismatches List Table */}
            <div>
              <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                🔎 Lista de Membros em Setores Distintos (Primeiros 100)
              </h4>
              <div className="overflow-x-auto rounded-2xl border border-gray-250 max-h-80 overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200 text-xs">
                  <thead className="bg-gray-50/80 sticky top-0 backdrop-blur-sm z-10 font-bold text-gray-600 uppercase">
                    <tr>
                      <th className="py-2.5 pl-4 pr-2 text-left w-12">#</th>
                      <th className="py-2.5 px-3 text-left">Nome</th>
                      <th className="py-2.5 px-3 text-left">Setor Residência</th>
                      <th className="py-2.5 px-3 text-left">Setor do GC</th>
                      <th className="py-2.5 px-3 text-left">Grupo Caseiro</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-150 bg-white">
                    {allMismatchedList.slice(0, 100).map((m, idx) => (
                      <tr key={m.id || idx} className="hover:bg-amber-50/[0.04]">
                        <td className="py-2.5 pl-4 pr-2 font-bold text-gray-400">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-semibold text-gray-800">{m.nome}</td>
                        <td className="py-2.5 px-3 text-indigo-600 font-semibold">{m.setor}</td>
                        <td className="py-2.5 px-3 text-teal-650 font-semibold">{m.setor_eclesiastico_display}</td>
                        <td className="py-2.5 px-3 text-gray-500 font-medium">{m.grupos_caseiros || 'Sem GC'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
