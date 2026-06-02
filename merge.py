import re

with open('src/pages/LabVision.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Add Network, GitMerge to imports
code = re.sub(r'ChevronDown, TrendingUp, Info', 'ChevronDown, TrendingUp, Info, Network, GitMerge', code)

# 2. Replace IdealCell and formIdealCells
ideal_cells_new = '''interface CellMember {
  member: Member;
  ministry: MinistryKey;
}

interface IdealCell {
  index: number;
  score: number;
  coverage: number;
  lideranca: CellMember[];
  ligamentos: CellMember[];
  corpo: CellMember[];
}

function formIdealCells(pool: Member[], targetSize = 12): IdealCell[] {
  const shuffled = [...pool].sort((a, b) => {
    const ma = assignMin(a)[0];
    const mb = assignMin(b)[0];
    return MIN_KEYS.indexOf(ma) - MIN_KEYS.indexOf(mb);
  });

  const numCells = Math.ceil(pool.length / targetSize);
  if (numCells === 0) return [];

  const cells: IdealCell[] = Array.from({ length: numCells }, (_, i) => ({
    index: i + 1, score: 0, coverage: 0, lideranca: [], ligamentos: [], corpo: []
  }));

  shuffled.forEach((m, i) => {
    const cell = cells[i % numCells];
    const min = assignMin(m)[0];
    const tipo = normalizeType(m.tipo_de_pessoa);
    
    if ((tipo === 'LÍDER' || tipo === 'PASTOR') && cell.lideranca.length < 3) {
      cell.lideranca.push({ member: m, ministry: min });
    } else if ((tipo === 'DIÁCONO' || cell.ligamentos.length < 3) && cell.ligamentos.length < 4 && cell.lideranca.length > 0) {
      cell.ligamentos.push({ member: m, ministry: min });
    } else {
      cell.corpo.push({ member: m, ministry: min });
    }
  });

  cells.forEach(c => {
    if (c.lideranca.length === 0 && c.ligamentos.length > 0) c.lideranca.push(c.ligamentos.shift()!);
    const allMins = new Set([...c.lideranca, ...c.ligamentos, ...c.corpo].map(m => m.ministry));
    c.coverage = allMins.size;
    c.score = Math.round((c.coverage / 5) * 100);
  });

  return cells;
}'''

code = re.sub(
    r'interface IdealCell \{.*?return cells;\n\}',
    ideal_cells_new,
    code,
    flags=re.DOTALL
)

# 3. Replace state, fetch, bodyPool
hook_new = '''export const LabVision: React.FC = () => {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCell, setExpandedCell] = useState<number | null>(null);
  const [hoveredMin, setHoveredMin] = useState<MinistryKey | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('membros')
      .select('id, nome, tipo_de_pessoa, grupos_caseiros, status, sexo')
      .limit(10000)
      .then(({ data, error }) => { 
        if (error) setFetchError(error.message);
        setMembers(data || []); 
        setLoading(false); 
      });
  }, []);

  const bodyPool = useMemo(() =>
    members.filter(m => {
      if (!m.status || m.status.trim().toLowerCase() !== 'ativo') return false;
      const tipo = normalizeType(m.tipo_de_pessoa);
      if (!VALID_TIPOS.includes(tipo)) return false;
      if (m.nome && m.nome.toUpperCase().includes('VINCI')) return false;
      return true;
    }), [members]);'''

code = re.sub(
    r'export const LabVision: React\.FC = \(\) => \{.*?\}\), \[members\]\);',
    hook_new,
    code,
    flags=re.DOTALL
)

# 4. Inject renderCellMember inside the hook (before const localPresbytery)
render_member = '''
  const renderCellMember = (cm: CellMember) => {
    const minConfig = MIN[cm.ministry];
    const Icon = minConfig.Icon;
    const isLider = normalizeType(cm.member.tipo_de_pessoa) === 'LÍDER' || normalizeType(cm.member.tipo_de_pessoa) === 'PASTOR';
    const shortName = cm.member.nome ? cm.member.nome.split(' ')[0] : 'Desconhecido';
    return (
      <div key={cm.member.id} className={clsx('flex flex-col items-center p-2 rounded-xl border relative group transition-all', minConfig.bg, minConfig.border, 'bg-white shadow-sm hover:shadow-md')}>
        <div className={clsx('absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center border-2 border-white bg-gradient-to-br shadow-sm', minConfig.gradient)}>
          <Icon className="w-2.5 h-2.5 text-white" />
        </div>
        {isLider && (
          <div className="absolute -top-2 -left-2 w-5 h-5 rounded-full bg-gray-900 flex items-center justify-center border-2 border-white shadow-sm" title="Cargo Liderança">
            <Star className="w-2.5 h-2.5 text-amber-400" />
          </div>
        )}
        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-1 text-gray-500 font-black text-sm uppercase border border-gray-200">
          {shortName.substring(0, 2)}
        </div>
        <p className="text-[10px] font-black text-gray-900 w-full text-center truncate px-1">{shortName}</p>
        <p className={clsx('text-[8px] font-bold uppercase tracking-widest mt-0.5', minConfig.text)}>{minConfig.label}</p>
      </div>
    );
  };
'''
code = code.replace('const localPresbytery = useMemo(', render_member + '\\n  const localPresbytery = useMemo(')

# 5. Replace Section 5 with Havruta UI
section_5_new = '''<section>
        <div className="flex items-center gap-3 mb-1">
          <span className="w-7 h-7 rounded-full bg-gray-900 text-white text-xs font-black flex items-center justify-center shrink-0">5</span>
          <h2 className="text-xl font-black text-gray-900">Células ideais — Visão Indonésia (Havruta)</h2>
        </div>
        <p className="text-sm text-gray-400 ml-10 mb-5">
          Partindo do zero, com grupos de ~12 pessoas. Cada célula não tem apenas um líder, mas um Micro-Presbitério, apoiado por Juntas e Ligamentos, exercendo os 5 dons no Corpo.
        </p>

        {fetchError && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl ml-10 mb-5">
            <p className="font-bold">Erro ao carregar dados:</p>
            <p className="text-sm font-mono mt-1">{fetchError}</p>
          </div>
        )}

        <div className="grid grid-cols-3 md:grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Células Formadas', value: idealCells.length },
            { label: 'Cobertura 5/5', value: idealCells.filter(c => c.score === 100).length },
            { label: 'Pessoas Distribuídas', value: nonPresb.length },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-2xl font-black text-gray-900">{s.value}</p>
              <p className="text-[10px] text-gray-500 mt-1 uppercase font-bold tracking-wide">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          {idealCells.map(cell => {
            const isExpanded = expandedCell === cell.index;
            return (
              <div key={cell.index} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-all">
                <button
                  className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedCell(isExpanded ? null : cell.index)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center font-black text-lg">
                      {cell.index}
                    </div>
                    <div className="text-left">
                      <p className="font-black text-gray-900">Micro Célula {cell.index}</p>
                      <p className="text-xs text-gray-400 font-medium">
                        {cell.lideranca.length + cell.ligamentos.length + cell.corpo.length} membros · {cell.coverage}/5 Dons Presentes
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="hidden md:flex gap-1">
                      {MIN_KEYS.map(key => {
                        const hasIt = [...cell.lideranca, ...cell.ligamentos, ...cell.corpo].some(m => m.ministry === key);
                        const mc = MIN[key];
                        return (
                          <div key={key} title={mc.label}
                            className={clsx('w-6 h-6 rounded-md flex items-center justify-center text-[10px]',
                              hasIt ? g-gradient-to-br  text-white : 'bg-gray-100 text-gray-300 opacity-50')}>
                            {mc.emoji}
                          </div>
                        );
                      })}
                    </div>
                    {isExpanded ? <ChevronDown className="h-5 w-5 text-gray-400" /> : <ChevronRight className="h-5 w-5 text-gray-400" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-100 bg-[#FAFAFA] p-6">
                    <div className="mb-6 relative">
                      <div className="absolute -left-2 top-0 bottom-0 w-1 bg-violet-500 rounded-full" />
                      <h3 className="text-xs font-black text-violet-700 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Crown className="w-4 h-4" /> Liderança / Micro-Presbitério
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                        {cell.lideranca.map(renderCellMember)}
                      </div>
                    </div>

                    <div className="mb-6 relative">
                      <div className="absolute -left-2 top-0 bottom-0 w-1 bg-amber-500 rounded-full" />
                      <h3 className="text-xs font-black text-amber-700 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <GitMerge className="w-4 h-4" /> Juntas e Ligamentos
                      </h3>
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                        {cell.ligamentos.map(renderCellMember)}
                      </div>
                    </div>

                    <div className="relative">
                      <div className="absolute -left-2 top-0 bottom-0 w-1 bg-blue-500 rounded-full" />
                      <h3 className="text-xs font-black text-blue-700 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Users className="w-4 h-4" /> Membros do Corpo
                      </h3>
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-3">
                        {cell.corpo.map(renderCellMember)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>'''

# Match everything from <section> to the end of the section that contains "Células ideais"
code = re.sub(r'<section>\s*<div className="flex items-center gap-3 mb-1">\s*<span.*?<h2>Células ideais — como Eddy Leo as formaria</h2>.*?</section>', section_5_new, code, flags=re.DOTALL)

with open('src/pages/LabVision.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Merged successfully!")
