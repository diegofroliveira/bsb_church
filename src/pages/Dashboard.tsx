import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Filter,
  Home,
  Layers,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import clsx from 'clsx';

type DashboardMember = {
  id?: number | string;
  nome?: string;
  name?: string;
  status?: string;
  tipo_cadastro?: string;
  tipo_de_pessoa?: string;
  nascimento?: string;
  data_de_cadastro?: string;
  grupos_caseiros?: string;
  setores?: string;
  sexo?: string;
  sex?: string;
  localidades?: string;
  localidade?: string;
  participa_visita_localidade?: string;
  [key: string]: unknown;
};

type DashboardGroup = {
  grupo_caseiro?: string;
  setor?: string;
  lider?: string;
  coordenador?: string;
  anfitriao?: string;
  auxiliar?: string;
  status?: string;
  [key: string]: unknown;
};

type DiscipleshipRecord = {
  discipulador?: string;
  mestre?: string;
  discipulo?: string;
  status?: string;
  grupos_caseiros?: string;
  [key: string]: unknown;
};

type FilterState = {
  gender: string;
  ageCategory: string;
  group: string;
  discipulador: string;
};

type ModalState =
  | {
      type: 'group' | 'sector' | 'discipulador';
      title: string;
    }
  | null;

type EnrichedMember = DashboardMember & {
  displayName: string;
  groupName: string;
  gender: string;
  age: number;
  ageCategory: string;
  setor: string;
  discipulador: string;
  isDiscipulador: boolean;
  isLocalMember: boolean;
};

type GroupSummary = {
  nome: string;
  lider: string;
  setor: string;
  membros: number;
  raw: DashboardGroup;
};

type SectorSummary = {
  nome: string;
  grupos: number;
  membros: number;
};

type DiscipuladorSummary = {
  nome: string;
  discipulos: number;
  grupos: number;
};

type ModalColumn = {
  label: string;
  align?: 'left' | 'center' | 'right';
};

type ModalRow = {
  key: string;
  cells: Array<{
    value: React.ReactNode;
    align?: 'left' | 'center' | 'right';
    nowrap?: boolean;
    mono?: boolean;
  }>;
};

type ModalContent = {
  title: string;
  subtitle: string;
  emptyText: string;
  columns: ModalColumn[];
  rows: ModalRow[];
};

const AGE_BANDS = [
  { label: '0-11', min: 0, max: 11 },
  { label: '12-17', min: 12, max: 17 },
  { label: '18-29', min: 18, max: 29 },
  { label: '30-44', min: 30, max: 44 },
  { label: '45-59', min: 45, max: 59 },
  { label: '60+', min: 60, max: Number.POSITIVE_INFINITY },
] as const;

const AGE_CATEGORY_LABELS = ['Todas', 'Criança', 'Adolescente', 'Jovem', 'Adulto', 'Idoso', 'Indefinida'];
const PIE_COLORS = ['#2563eb', '#14b8a6', '#f59e0b', '#8b5cf6', '#ef4444', '#94a3b8'];

const numberFormatter = new Intl.NumberFormat('pt-BR');

const normalizeText = (value: unknown) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');

const compareText = (left: string, right: string) =>
  left.localeCompare(right, 'pt-BR', { sensitivity: 'base' });

const parseDate = (value: unknown) => {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [day, month, year] = raw.split('/').map(Number);
    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const normalized = raw.includes(' ') ? raw.replace(' ', 'T') : raw;
  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  const shortDate = raw.split(' ')[0];
  const fallback = new Date(shortDate);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
};

const getAge = (value: unknown) => {
  const birthDate = parseDate(value);
  if (!birthDate) return -1;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const hasNotHadBirthdayYet =
    today.getMonth() < birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate());

  if (hasNotHadBirthdayYet) {
    age -= 1;
  }

  return age >= 0 ? age : -1;
};

const getAgeCategory = (age: number) => {
  if (age < 0) return 'Indefinida';
  if (age < 12) return 'Criança';
  if (age < 18) return 'Adolescente';
  if (age < 30) return 'Jovem';
  if (age < 60) return 'Adulto';
  return 'Idoso';
};

const getAgeBand = (age: number) => {
  if (age < 0) return null;
  return AGE_BANDS.find((band) => age >= band.min && age <= band.max)?.label ?? null;
};

const getDisplayName = (member: DashboardMember) => String(member.nome || member.name || 'Sem nome').trim();

const getGender = (member: DashboardMember) => String(member.sexo || member.sex || 'Não informado').trim() || 'Não informado';

const getDiscipuladorName = (record: DiscipleshipRecord) =>
  String(record.discipulador || record.mestre || '').trim();

const isVisitante = (member: DashboardMember) => {
  const tipoPessoa = normalizeText(member.tipo_de_pessoa);
  const tipoCadastro = normalizeText(member.tipo_cadastro);
  return tipoPessoa === 'visitante' || tipoCadastro === 'visitante';
};

const isLocalidadeMember = (member: DashboardMember) => {
  const participation = normalizeText(member.participa_visita_localidade);
  if (participation) {
    return participation !== 'sim';
  }

  const localidade = normalizeText(member.localidades || member.localidade);
  return !localidade || localidade.includes('bsb') || localidade.includes('brasilia');
};

const getAlignmentClass = (align: 'left' | 'center' | 'right' = 'left') => {
  if (align === 'center') return 'text-center';
  if (align === 'right') return 'text-right';
  return 'text-left';
};

const formatTooltipNumber = (value: unknown, useAbsolute = false) => {
  const numericValue = Number(value ?? 0);
  if (!Number.isFinite(numericValue)) {
    return numberFormatter.format(0);
  }

  return numberFormatter.format(useAbsolute ? Math.abs(numericValue) : numericValue);
};

const buildGroupRoleLookup = (group?: DashboardGroup | null) => {
  const rolesByPerson: Record<string, string[]> = {};

  const addRole = (name: unknown, role: string) => {
    const key = normalizeText(name);
    if (!key) return;
    if (!rolesByPerson[key]) {
      rolesByPerson[key] = [];
    }
    if (!rolesByPerson[key].includes(role)) {
      rolesByPerson[key].push(role);
    }
  };

  addRole(group?.lider, 'Líder');
  addRole(group?.auxiliar, 'Auxiliar');
  addRole(group?.anfitriao, 'Anfitrião');
  addRole(group?.coordenador, 'Coordenador');

  return rolesByPerson;
};

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [members, setMembers] = useState<DashboardMember[]>([]);
  const [cellGroups, setCellGroups] = useState<DashboardGroup[]>([]);
  const [discipleshipRecords, setDiscipleshipRecords] = useState<DiscipleshipRecord[]>([]);
  const [filters, setFilters] = useState<FilterState>({
    gender: 'Todos',
    ageCategory: 'Todas',
    group: 'Todos',
    discipulador: 'Todos',
  });
  const [modalState, setModalState] = useState<ModalState>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const [membersResponse, cellGroupsResponse, discipleshipResponse] = await Promise.all([
          supabase.from('membros').select('*', { count: 'exact' }).limit(10000),
          supabase.from('celulas').select('*'),
          supabase.from('discipulado').select('*').limit(10000),
        ]);

        if (membersResponse.error) throw membersResponse.error;
        if (cellGroupsResponse.error) throw cellGroupsResponse.error;
        if (discipleshipResponse.error) throw discipleshipResponse.error;

        setMembers((membersResponse.data as DashboardMember[]) || []);
        setCellGroups((cellGroupsResponse.data as DashboardGroup[]) || []);
        setDiscipleshipRecords((discipleshipResponse.data as DiscipleshipRecord[]) || []);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        setLoadError('Nao foi possivel carregar os dados do dashboard agora.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const discipuladorByDisciple = useMemo(() => {
    const lookup: Record<string, string> = {};

    discipleshipRecords.forEach((record) => {
      const discipleKey = normalizeText(record.discipulo);
      const discipulador = getDiscipuladorName(record);
      if (discipleKey && discipulador && !lookup[discipleKey]) {
        lookup[discipleKey] = discipulador;
      }
    });

    return lookup;
  }, [discipleshipRecords]);

  const discipuladorNameSet = useMemo(() => {
    const uniqueNames = new Set<string>();

    discipleshipRecords.forEach((record) => {
      const discipulador = getDiscipuladorName(record);
      const normalized = normalizeText(discipulador);
      if (normalized) {
        uniqueNames.add(normalized);
      }
    });

    return uniqueNames;
  }, [discipleshipRecords]);

  const activeCellGroups = useMemo(
    () =>
      cellGroups.filter(
        (group) => group.grupo_caseiro && normalizeText(group.status) !== 'inativo',
      ),
    [cellGroups],
  );

  const groupByName = useMemo(() => {
    const lookup: Record<string, DashboardGroup> = {};

    activeCellGroups.forEach((group) => {
      const key = normalizeText(group.grupo_caseiro);
      if (key && !lookup[key]) {
        lookup[key] = group;
      }
    });

    return lookup;
  }, [activeCellGroups]);

  const enrichedMembers = useMemo<EnrichedMember[]>(() => {
    return members.map((member) => {
      const displayName = getDisplayName(member);
      const groupName = String(member.grupos_caseiros || '').trim();
      const linkedGroup = groupByName[normalizeText(groupName)];
      const age = getAge(member.nascimento);

      return {
        ...member,
        displayName,
        groupName,
        gender: getGender(member),
        age,
        ageCategory: getAgeCategory(age),
        setor: String(member.setores || linkedGroup?.setor || 'Sem setor').trim() || 'Sem setor',
        discipulador: discipuladorByDisciple[normalizeText(displayName)] || 'Sem discipulador',
        isDiscipulador: discipuladorNameSet.has(normalizeText(displayName)),
        isLocalMember: isLocalidadeMember(member),
      };
    });
  }, [members, groupByName, discipuladorByDisciple, discipuladorNameSet]);

  const uniqueGenders = useMemo(
    () =>
      Array.from(
        new Set(
          enrichedMembers
            .map((member) => member.gender)
            .filter((value) => value && value !== 'Não informado'),
        ),
      ).sort(compareText),
    [enrichedMembers],
  );

  const uniqueGroups = useMemo(
    () =>
      Array.from(new Set(enrichedMembers.map((member) => member.groupName).filter(Boolean))).sort(compareText),
    [enrichedMembers],
  );

  const uniqueDiscipuladores = useMemo(
    () =>
      Array.from(
        new Set(
          enrichedMembers
            .map((member) => member.discipulador)
            .filter((value) => value && value !== 'Sem discipulador'),
        ),
      ).sort(compareText),
    [enrichedMembers],
  );

  const filteredMembers = useMemo(() => {
    return enrichedMembers.filter((member) => {
      if (filters.gender !== 'Todos' && member.gender !== filters.gender) return false;
      if (filters.ageCategory !== 'Todas' && member.ageCategory !== filters.ageCategory) return false;
      if (filters.group !== 'Todos' && member.groupName !== filters.group) return false;
      if (filters.discipulador !== 'Todos' && member.discipulador !== filters.discipulador) return false;
      return true;
    });
  }, [enrichedMembers, filters]);

  const groupsList = useMemo<GroupSummary[]>(() => {
    const memberCountByGroup: Record<string, number> = {};

    filteredMembers.forEach((member) => {
      const key = normalizeText(member.groupName);
      if (!key) return;
      memberCountByGroup[key] = (memberCountByGroup[key] || 0) + 1;
    });

    return activeCellGroups
      .map((group) => {
        const key = normalizeText(group.grupo_caseiro);
        const membersCount = key ? memberCountByGroup[key] || 0 : 0;

        return {
          nome: String(group.grupo_caseiro || 'Sem grupo'),
          lider: String(group.lider || 'Sem líder'),
          setor: String(group.setor || 'Sem setor'),
          membros: membersCount,
          raw: group,
        };
      })
      .filter((group) => group.membros > 0)
      .sort((left, right) => right.membros - left.membros || compareText(left.nome, right.nome));
  }, [activeCellGroups, filteredMembers]);

  const sectorsList = useMemo<SectorSummary[]>(() => {
    const totalsBySector: Record<string, SectorSummary> = {};

    groupsList.forEach((group) => {
      const sectorName = group.setor || 'Sem setor';
      const sectorKey = normalizeText(sectorName);

      if (!totalsBySector[sectorKey]) {
        totalsBySector[sectorKey] = {
          nome: sectorName,
          grupos: 0,
          membros: 0,
        };
      }

      totalsBySector[sectorKey].grupos += 1;
      totalsBySector[sectorKey].membros += group.membros;
    });

    return Object.values(totalsBySector).sort(
      (left, right) => right.membros - left.membros || compareText(left.nome, right.nome),
    );
  }, [groupsList]);

  const discipuladoresList = useMemo<DiscipuladorSummary[]>(() => {
    const totalsByDiscipulador: Record<string, { nome: string; discipulos: number; grupos: Set<string> }> = {};

    filteredMembers.forEach((member) => {
      if (member.discipulador === 'Sem discipulador') return;

      const key = normalizeText(member.discipulador);
      if (!totalsByDiscipulador[key]) {
        totalsByDiscipulador[key] = {
          nome: member.discipulador,
          discipulos: 0,
          grupos: new Set<string>(),
        };
      }

      totalsByDiscipulador[key].discipulos += 1;
      if (member.groupName) {
        totalsByDiscipulador[key].grupos.add(member.groupName);
      }
    });

    return Object.values(totalsByDiscipulador)
      .map((item) => ({
        nome: item.nome,
        discipulos: item.discipulos,
        grupos: item.grupos.size,
      }))
      .sort((left, right) => right.discipulos - left.discipulos || compareText(left.nome, right.nome));
  }, [filteredMembers]);

  const stats = useMemo(
    () => ({
      totalCadastros: filteredMembers.length,
      membrosAtivos: filteredMembers.filter((member) => normalizeText(member.status) === 'ativo').length,
      totalVisitantes: filteredMembers.filter(isVisitante).length,
      totalGruposCaseiros: groupsList.length,
      totalDiscipuladores: discipuladoresList.length,
      totalMembrosLocalidade: filteredMembers.filter((member) => member.isLocalMember).length,
    }),
    [filteredMembers, groupsList.length, discipuladoresList.length],
  );

  const growthData = useMemo(() => {
    const monthlyTotals: Record<
      string,
      { label: string; sortKey: number; cadastros: number; visitantes: number }
    > = {};

    filteredMembers.forEach((member) => {
      const registrationDate = parseDate(member.data_de_cadastro);
      if (!registrationDate) return;

      const monthIndex = registrationDate.getMonth() + 1;
      const key = `${registrationDate.getFullYear()}-${String(monthIndex).padStart(2, '0')}`;

      if (!monthlyTotals[key]) {
        monthlyTotals[key] = {
          label: registrationDate.toLocaleDateString('pt-BR', {
            month: 'short',
            year: '2-digit',
          }),
          sortKey: registrationDate.getFullYear() * 100 + monthIndex,
          cadastros: 0,
          visitantes: 0,
        };
      }

      monthlyTotals[key].cadastros += 1;
      if (isVisitante(member)) {
        monthlyTotals[key].visitantes += 1;
      }
    });

    const sorted = Object.values(monthlyTotals).sort((left, right) => left.sortKey - right.sortKey);

    if (sorted.length === 0) {
      return [
        {
          name: 'Base atual',
          cadastros: stats.totalCadastros,
          visitantes: stats.totalVisitantes,
        },
      ];
    }

    let accumulatedCadastros = 0;
    let accumulatedVisitantes = 0;

    return sorted.slice(-12).map((item) => {
      accumulatedCadastros += item.cadastros;
      accumulatedVisitantes += item.visitantes;

      return {
        name: item.label.replace('.', ''),
        cadastros: accumulatedCadastros,
        visitantes: accumulatedVisitantes,
      };
    });
  }, [filteredMembers, stats.totalCadastros, stats.totalVisitantes]);

  const demographicData = useMemo(() => {
    const totals = {
      Criança: 0,
      Adolescente: 0,
      Jovem: 0,
      Adulto: 0,
      Idoso: 0,
      Indefinida: 0,
    };

    filteredMembers.forEach((member) => {
      totals[member.ageCategory as keyof typeof totals] += 1;
    });

    return Object.entries(totals)
      .filter(([, value]) => value > 0)
      .map(([name, value], index) => ({
        name,
        value,
        fill: PIE_COLORS[index % PIE_COLORS.length],
      }));
  }, [filteredMembers]);

  const agePyramidData = useMemo(() => {
    const totalsByBand = AGE_BANDS.map((band) => ({
      name: band.label,
      masculino: 0,
      feminino: 0,
    }));

    filteredMembers.forEach((member) => {
      const bandLabel = getAgeBand(member.age);
      if (!bandLabel) return;

      const bucket = totalsByBand.find((band) => band.name === bandLabel);
      if (!bucket) return;

      const normalizedGender = normalizeText(member.gender);
      if (normalizedGender === 'masculino') bucket.masculino -= 1;
      if (normalizedGender === 'feminino') bucket.feminino += 1;
    });

    return totalsByBand;
  }, [filteredMembers]);

  const modalContent = useMemo<ModalContent | null>(() => {
    if (!modalState) return null;

    if (modalState.type === 'group') {
      const selectedGroup = groupByName[normalizeText(modalState.title)];
      const roleLookup = buildGroupRoleLookup(selectedGroup);
      const groupMembers = filteredMembers
        .filter((member) => normalizeText(member.groupName) === normalizeText(modalState.title))
        .sort((left, right) => compareText(left.displayName, right.displayName));

      return {
        title: modalState.title,
        subtitle: `${groupMembers.length} cadastro(s) listados`,
        emptyText: `Nenhum cadastro encontrado para o grupo caseiro ${modalState.title}.`,
        columns: [
          { label: 'Nome' },
          { label: 'Sexo' },
          { label: 'Idade', align: 'center' },
          { label: 'Função' },
          { label: 'É discipulador?', align: 'center' },
        ],
        rows: groupMembers.map((member) => ({
          key: String(member.id || `${member.displayName}-${member.groupName}`),
          cells: [
            { value: member.displayName },
            { value: member.gender },
            { value: member.age >= 0 ? `${member.age} anos` : '-', align: 'center' },
            {
              value:
                roleLookup[normalizeText(member.displayName)]?.join(', ') || 'Participante',
            },
            {
              value: member.isDiscipulador ? 'Sim' : 'Não',
              align: 'center',
            },
          ],
        })),
      };
    }

    if (modalState.type === 'sector') {
      const sectorGroups = groupsList.filter(
        (group) => normalizeText(group.setor) === normalizeText(modalState.title),
      );

      return {
        title: modalState.title,
        subtitle: `${sectorGroups.length} grupo(s) caseiro(s) listados`,
        emptyText: `Nenhum grupo caseiro encontrado para o setor ${modalState.title}.`,
        columns: [
          { label: 'Grupo Caseiro' },
          { label: 'Líder' },
          { label: 'Membros', align: 'center' },
          { label: 'Detalhar', align: 'right' },
        ],
        rows: sectorGroups.map((group) => ({
          key: group.nome,
          cells: [
            { value: group.nome },
            { value: group.lider },
            { value: numberFormatter.format(group.membros), align: 'center' },
            {
              value: (
                <button
                  onClick={() => setModalState({ type: 'group', title: group.nome })}
                  className="text-primary-600 font-medium hover:underline text-xs"
                >
                  Ver grupo
                </button>
              ),
              align: 'right',
            },
          ],
        })),
      };
    }

    const relatedMembers = filteredMembers
      .filter((member) => normalizeText(member.discipulador) === normalizeText(modalState.title))
      .sort((left, right) => compareText(left.displayName, right.displayName));

    return {
      title: modalState.title,
      subtitle: `${relatedMembers.length} discípulo(s) encontrados`,
      emptyText: `Nenhum discípulo encontrado para ${modalState.title}.`,
      columns: [
        { label: 'Nome' },
        { label: 'Sexo' },
        { label: 'Idade', align: 'center' },
        { label: 'Grupo Caseiro' },
        { label: 'Status', align: 'center' },
      ],
      rows: relatedMembers.map((member) => ({
        key: String(member.id || member.displayName),
        cells: [
          { value: member.displayName },
          { value: member.gender },
          { value: member.age >= 0 ? `${member.age} anos` : '-', align: 'center' },
          { value: member.groupName || 'Sem grupo' },
          { value: String(member.status || 'Sem status'), align: 'center' },
        ],
      })),
    };
  }, [modalState, filteredMembers, groupsList, groupByName]);

  const isPastorOrAdmin = ['pastor', 'admin'].includes(user?.role || '');
  const hasActiveFilters = Object.values(filters).some((value) => !['Todos', 'Todas'].includes(value));

  const kpis = [
    {
      label: 'Total de Cadastros',
      value: stats.totalCadastros,
      icon: Users,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Membros Ativos',
      value: stats.membrosAtivos,
      sub: 'Status: Ativo',
      icon: TrendingUp,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: 'Visitantes',
      value: stats.totalVisitantes,
      icon: UserPlus,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
    },
    {
      label: 'Grupos Caseiros',
      value: stats.totalGruposCaseiros,
      icon: Home,
      color: 'text-violet-600',
      bg: 'bg-violet-50',
    },
    {
      label: 'Discipuladores',
      value: stats.totalDiscipuladores,
      icon: UserCheck,
      color: 'text-teal-600',
      bg: 'bg-teal-50',
    },
    {
      label: 'Membros da Localidade',
      value: stats.totalMembrosLocalidade,
      sub: 'Brasília e entorno',
      icon: MapPin,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
    },
  ];

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Visão Geral</h1>
        <p className="mt-2 flex items-baseline text-sm text-gray-500">
          Bem-vindo de volta,
          <span className="font-semibold text-primary-600 ml-1">{user?.name}</span>.
          <span className="ml-1">Dados reais extraídos do Supabase.</span>
        </p>
      </header>

      {loadError && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-700">
          {loadError}
        </div>
      )}

      <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Filter className="h-4 w-4 text-primary-500" />
              Filtros rápidos da dashboard
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Use sexo, faixa etária, grupo caseiro e discipulador para cruzar a base sem sair desta visão.
            </p>
          </div>

          <button
            onClick={() =>
              setFilters({
                gender: 'Todos',
                ageCategory: 'Todas',
                group: 'Todos',
                discipulador: 'Todos',
              })
            }
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Limpar filtros
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
              Sexo
            </label>
            <select
              value={filters.gender}
              onChange={(event) =>
                setFilters((current) => ({ ...current, gender: event.target.value }))
              }
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
            >
              <option value="Todos">Todos</option>
              {uniqueGenders.map((gender) => (
                <option key={gender} value={gender}>
                  {gender}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
              Faixa etária
            </label>
            <select
              value={filters.ageCategory}
              onChange={(event) =>
                setFilters((current) => ({ ...current, ageCategory: event.target.value }))
              }
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
            >
              {AGE_CATEGORY_LABELS.map((ageCategory) => (
                <option key={ageCategory} value={ageCategory}>
                  {ageCategory}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
              Grupo caseiro
            </label>
            <select
              value={filters.group}
              onChange={(event) =>
                setFilters((current) => ({ ...current, group: event.target.value }))
              }
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
            >
              <option value="Todos">Todos</option>
              {uniqueGroups.map((group) => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
              Discipulador
            </label>
            <select
              value={filters.discipulador}
              onChange={(event) =>
                setFilters((current) => ({ ...current, discipulador: event.target.value }))
              }
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
            >
              <option value="Todos">Todos</option>
              {uniqueDiscipuladores.map((discipulador) => (
                <option key={discipulador} value={discipulador}>
                  {discipulador}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-6">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow group"
            >
              <div className="flex items-center gap-4">
                <div
                  className={clsx(
                    'flex h-12 w-12 items-center justify-center rounded-xl transition-transform group-hover:scale-110',
                    kpi.bg,
                  )}
                >
                  <Icon className={clsx('h-6 w-6', kpi.color)} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">{kpi.label}</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-2xl font-bold text-gray-900">
                      {numberFormatter.format(kpi.value)}
                    </p>
                    {kpi.sub && <span className="text-xs text-gray-400">{kpi.sub}</span>}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-4">
        <div className="xl:col-span-2 rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
          <div className="pb-4 mb-4 border-b border-gray-100">
            <h3 className="text-lg font-semibold leading-6 text-gray-900">Evolução da Base</h3>
            <p className="mt-1 text-sm text-gray-500">
              Cadastros acumulados por data de cadastro considerando os filtros aplicados.
            </p>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={growthData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCadastros" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorVisitantes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                  allowDecimals={false}
                />
                <Tooltip
                  formatter={(value) => formatTooltipNumber(value)}
                  contentStyle={{
                    borderRadius: '12px',
                    border: 'none',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '16px' }} />
                <Area
                  type="monotone"
                  dataKey="cadastros"
                  stroke="#2563eb"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorCadastros)"
                  name="Cadastros"
                />
                <Area
                  type="monotone"
                  dataKey="visitantes"
                  stroke="#f59e0b"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorVisitantes)"
                  name="Visitantes"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 flex flex-col">
          <div className="pb-4 mb-4 border-b border-gray-100">
            <h3 className="text-lg font-semibold leading-6 text-gray-900">Demografia</h3>
          </div>
          {demographicData.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-500">
              Nenhum dado disponível com os filtros atuais.
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-center items-center relative">
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={demographicData}
                      cx="50%"
                      cy="50%"
                      innerRadius={58}
                      outerRadius={82}
                      paddingAngle={4}
                      dataKey="value"
                      stroke="none"
                    >
                      {demographicData.map((entry, index) => (
                        <Cell key={`demography-${entry.name}-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatTooltipNumber(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-12">
                <span className="text-3xl font-bold text-gray-900">
                  {numberFormatter.format(stats.totalCadastros)}
                </span>
                <span className="text-xs uppercase tracking-wide text-gray-400">Cadastros</span>
              </div>
              <div className="grid grid-cols-2 gap-2 w-full mt-4">
                {demographicData.map((item) => (
                  <div key={item.name} className="flex items-center gap-1.5">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: item.fill }}
                    />
                    <span className="text-[10px] font-medium text-gray-600 truncate">
                      {item.name} ({numberFormatter.format(item.value)})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 flex flex-col">
          <div className="pb-4 mb-4 border-b border-gray-100">
            <h3 className="text-lg font-semibold leading-6 text-gray-900">
              Pirâmide Etária por Sexo
            </h3>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={agePyramidData}
                layout="vertical"
                margin={{ top: 8, right: 12, left: 8, bottom: 0 }}
                barCategoryGap="18%"
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                <XAxis
                  type="number"
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => numberFormatter.format(Math.abs(Number(value)))}
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                  width={48}
                />
                <ReferenceLine x={0} stroke="#d1d5db" />
                <Tooltip
                  formatter={(value) => formatTooltipNumber(value, true)}
                  contentStyle={{
                    borderRadius: '12px',
                    border: 'none',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '12px' }} />
                <Bar dataKey="masculino" stackId="sexo" fill="#2563eb" name="Masculino" />
                <Bar dataKey="feminino" stackId="sexo" fill="#f97316" name="Feminino" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {isPastorOrAdmin && (
        <div className="grid grid-cols-1 gap-6 mt-6">
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 flex flex-col">
            <div className="pb-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold leading-6 text-gray-900 flex items-center gap-2">
                <Home className="h-5 w-5 text-primary-500" />
                Grupos Caseiros Ativos
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Detalhe de membros por grupo caseiro, com função e indicação de discipulador.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 mt-4">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="py-3 pl-4 pr-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Grupo Caseiro
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Líder
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Membros
                    </th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ação
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {groupsList.slice(0, 10).map((group) => (
                    <tr key={group.nome} className="hover:bg-gray-50/50 transition-colors">
                      <td className="whitespace-nowrap py-3 pl-4 pr-3 text-sm font-medium text-gray-900">
                        {group.nome}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-500">
                        {group.lider}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-sm text-center font-bold text-gray-700">
                        <span className="bg-primary-50 text-primary-700 py-1 px-3 rounded-full">
                          {numberFormatter.format(group.membros)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-sm text-right">
                        <button
                          onClick={() => setModalState({ type: 'group', title: group.nome })}
                          className="text-primary-600 font-medium hover:underline text-xs outline-none"
                        >
                          Ver detalhes
                        </button>
                      </td>
                    </tr>
                  ))}

                  {groupsList.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-10 text-center text-sm text-gray-500">
                        Nenhum grupo caseiro encontrado para os filtros atuais.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 flex flex-col">
              <div className="pb-4 border-b border-gray-100">
                <h3 className="text-lg font-semibold leading-6 text-gray-900 flex items-center gap-2">
                  <Layers className="h-5 w-5 text-indigo-500" />
                  Setores
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Consolidação de grupos caseiros e membros por setor.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 mt-4">
                  <thead className="bg-gray-50/50">
                    <tr>
                      <th className="py-3 pl-4 pr-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Setor
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        GCs
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Membros
                      </th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ação
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {sectorsList.map((sector) => (
                      <tr key={sector.nome} className="hover:bg-gray-50/50">
                        <td className="whitespace-nowrap py-3 pl-4 pr-3 text-sm font-medium text-gray-900">
                          {sector.nome}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm text-center">
                          <span className="bg-gray-100 text-gray-600 py-1 px-2 rounded-md font-bold">
                            {numberFormatter.format(sector.grupos)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm text-center">
                          <span className="bg-indigo-50 text-indigo-700 py-1 px-2 rounded-md font-bold">
                            {numberFormatter.format(sector.membros)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm text-right">
                          <button
                            onClick={() => setModalState({ type: 'sector', title: sector.nome })}
                            className="text-indigo-600 font-medium hover:underline text-xs"
                          >
                            Acessar
                          </button>
                        </td>
                      </tr>
                    ))}

                    {sectorsList.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-10 text-center text-sm text-gray-500">
                          Nenhum setor encontrado para os filtros atuais.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 flex flex-col">
              <div className="pb-4 border-b border-gray-100">
                <h3 className="text-lg font-semibold leading-6 text-gray-900 flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-emerald-500" />
                  Discipuladores
                </h3>
                <p className="mt-1 text-sm text-gray-500">Discipuladores cadastrados</p>
              </div>

              <div className="overflow-x-auto max-h-[300px]">
                <table className="min-w-full divide-y divide-gray-200 mt-4">
                  <thead className="bg-gray-50/50 sticky top-0">
                    <tr>
                      <th className="py-3 pl-4 pr-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Discipulador
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Discípulos
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        GCs
                      </th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ação
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {discipuladoresList.slice(0, 15).map((discipulador) => (
                      <tr key={discipulador.nome} className="hover:bg-gray-50/50">
                        <td className="whitespace-nowrap py-3 pl-4 pr-3 text-sm font-medium text-gray-900">
                          {discipulador.nome}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm text-center">
                          <span className="bg-emerald-50 text-emerald-600 py-1 px-2 rounded-md font-bold">
                            {numberFormatter.format(discipulador.discipulos)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm text-center">
                          <span className="bg-teal-50 text-teal-700 py-1 px-2 rounded-md font-bold">
                            {numberFormatter.format(discipulador.grupos)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm text-right">
                          <button
                            onClick={() =>
                              setModalState({
                                type: 'discipulador',
                                title: discipulador.nome,
                              })
                            }
                            className="text-emerald-600 font-medium hover:underline text-xs"
                          >
                            Ver discípulos
                          </button>
                        </td>
                      </tr>
                    ))}

                    {discipuladoresList.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-10 text-center text-sm text-gray-500">
                          Nenhum discipulador encontrado para os filtros atuais.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalState && modalContent && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div
            className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => setModalState(null)}
          />
          <div className="relative flex w-full max-w-5xl flex-col bg-white rounded-2xl shadow-2xl overflow-hidden m-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{modalContent.title}</h3>
                <p className="text-xs text-gray-500 mt-1">{modalContent.subtitle}</p>
              </div>
              <button
                onClick={() => setModalState(null)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-0 overflow-y-auto max-h-[70vh]">
              {modalContent.rows.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center">
                  <Search className="h-10 w-10 text-gray-300 mb-3" />
                  <p className="text-gray-500 text-sm">{modalContent.emptyText}</p>
                  {hasActiveFilters && (
                    <p className="mt-2 text-xs text-gray-400">
                      Tente limpar os filtros para ampliar a visualização.
                    </p>
                  )}
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="bg-white sticky top-0">
                    <tr>
                      {modalContent.columns.map((column) => (
                        <th
                          key={column.label}
                          className={clsx(
                            'py-3 px-4 text-xs font-medium text-gray-400 uppercase',
                            getAlignmentClass(column.align),
                          )}
                        >
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {modalContent.rows.map((row) => (
                      <tr key={row.key} className="hover:bg-gray-50/50">
                        {row.cells.map((cell, index) => (
                          <td
                            key={`${row.key}-${index}`}
                            className={clsx(
                              'px-4 py-3 text-sm text-gray-600',
                              getAlignmentClass(cell.align),
                              cell.nowrap ? 'whitespace-nowrap' : '',
                              cell.mono ? 'font-mono text-xs' : '',
                              index === 0 ? 'font-medium text-gray-900' : '',
                            )}
                          >
                            {cell.value}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
