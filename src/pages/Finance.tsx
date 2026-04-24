import React, { useEffect, useState, useMemo } from 'react';
import { Download, Wallet, ArrowUpRight, ArrowDownRight, Loader2, Filter, PieChart as PieChartIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import clsx from 'clsx';

interface Transaction {
  id: number;
  tipo: string;
  data: string;
  valor: number;
  categoria: string;
  centro_custo: string;
  igreja: string;
  historico: string;
  pessoa_lancamento: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#f472b6', '#fb923c', '#eab308'];

export const Finance: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  
  // Filters
  const [selectedMonth, setSelectedMonth] = useState<string>('Todos');
  const [selectedCategoria, setSelectedCategoria] = useState<string>('Todas');
  const [selectedGrupo, setSelectedGrupo] = useState<string>('Todos');

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const parseDate = (dateStr: string): Date => {
    if (!dateStr) return new Date(0);
    // Handles DD/MM/YYYY format from Prover
    if (dateStr.includes('/')) {
      const [day, month, year] = dateStr.split('/').map(Number);
      return new Date(year, month - 1, day);
    }
    return new Date(dateStr);
  };

  useEffect(() => {
    const fetchFinanceData = async () => {
      setIsLoading(true);
      try {
        // Fetch all records using pagination (Supabase default limit is 1000)
        let allData: any[] = [];
        let from = 0;
        const batchSize = 1000;
        while (true) {
          const { data, error } = await supabase
            .from('financeiro')
            .select('id, tipo, valor, data, categoria, centro_custo, historico, pessoa_lancamento')
            .order('data', { ascending: false })
            .range(from, from + batchSize - 1);
          if (error) throw error;
          if (!data || data.length === 0) break;
          allData = allData.concat(data);
          if (data.length < batchSize) break;
          from += batchSize;
        }

        const mapped: Transaction[] = allData.map(item => ({
          ...item,
          valor: parseFloat((String(item.valor) || '0').replace(',', '.')) || 0,
          categoria: item.categoria || 'Sem Categoria',
          centro_custo: item.centro_custo || 'Geral',
          tipo: item.tipo || 'Desconhecido'
        }));

        setTransactions(mapped);
      } catch (error) {
        console.error('Error fetching finance data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFinanceData();
  }, []);

  // Compute Filter Options
  const { months, categorias, grupos } = useMemo(() => {
    const mSet = new Set<string>();
    const cSet = new Set<string>();
    const gSet = new Set<string>();

    transactions.forEach(t => {
      const d = parseDate(t.data);
      if (!isNaN(d.getTime())) {
        mSet.add(`${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`);
      }
      cSet.add(t.categoria);
      gSet.add(t.centro_custo);
    });

    return {
      months: ['Todos', ...Array.from(mSet).sort().reverse()],
      categorias: ['Todas', ...Array.from(cSet).sort()],
      grupos: ['Todos', ...Array.from(gSet).sort()]
    };
  }, [transactions]);

  // Apply Filters
  const filteredData = useMemo(() => {
    return transactions.filter(t => {
      const d = parseDate(t.data);
      const mStr = `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
      
      const matchMonth = selectedMonth === 'Todos' || mStr === selectedMonth;
      const matchCat = selectedCategoria === 'Todas' || t.categoria === selectedCategoria;
      const matchGroup = selectedGrupo === 'Todos' || t.centro_custo === selectedGrupo;
      
      return matchMonth && matchCat && matchGroup;
    });
  }, [transactions, selectedMonth, selectedCategoria, selectedGrupo]);

  // Compute Totals and Charts based on filtered data
  const { totals, barChartData, pieChartData } = useMemo(() => {
    let sumEntradas = 0;
    let sumSaidas = 0;
    const monthlyMap: Record<string, { name: string, entradas: number, saidas: number }> = {};
    const categoryMap: Record<string, number> = {};

    filteredData.forEach(item => {
      const val = item.valor;
      const isEntrada = item.tipo.toLowerCase().includes('entrada') || item.tipo.toLowerCase().includes('receita');
      
      if (isEntrada) {
        sumEntradas += val;
      } else {
        sumSaidas += val;
        // Group by category for pie chart (only expenses)
        categoryMap[item.categoria] = (categoryMap[item.categoria] || 0) + Math.abs(val);
      }

      // Bar Chart grouping
      const date = parseDate(item.data);
      if (!isNaN(date.getTime())) {
        const monthYear = `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
        if (!monthlyMap[monthYear]) {
          monthlyMap[monthYear] = { name: monthYear, entradas: 0, saidas: 0 };
        }
        if (isEntrada) monthlyMap[monthYear].entradas += val;
        else monthlyMap[monthYear].saidas += Math.abs(val);
      }
    });

    // Bar Chart Array
    const barArr = Object.values(monthlyMap)
      .sort((a, b) => {
         const [mA, yA] = a.name.split('/');
         const [mB, yB] = b.name.split('/');
         return new Date(Number(yA), Number(mA)-1).getTime() - new Date(Number(yB), Number(mB)-1).getTime();
      })
      .slice(-12); // last 12 months

    // Pie Chart Array
    const pieArr = Object.entries(categoryMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10); // Top 10 categories

    return {
      totals: {
        entradas: sumEntradas,
        saidas: Math.abs(sumSaidas)
      },
      barChartData: barArr,
      pieChartData: pieArr
    };
  }, [filteredData]);

  // Gráfico de histórico sempre com todos os dados (sem filtros)
  const allBarChartData = useMemo(() => {
    const monthlyMap: Record<string, { name: string, entradas: number, saidas: number }> = {};
    transactions.forEach(item => {
      const val = item.valor;
      const isEntrada = item.tipo.toLowerCase().includes('entrada') || item.tipo.toLowerCase().includes('receita');
      const date = parseDate(item.data);
      if (isNaN(date.getTime())) return;
      const monthYear = `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
      if (!monthlyMap[monthYear]) monthlyMap[monthYear] = { name: monthYear, entradas: 0, saidas: 0 };
      if (isEntrada) monthlyMap[monthYear].entradas += val;
      else monthlyMap[monthYear].saidas += Math.abs(val);
    });
    return Object.values(monthlyMap)
      .sort((a, b) => {
        const [mA, yA] = a.name.split('/');
        const [mB, yB] = b.name.split('/');
        return new Date(Number(yA), Number(mA)-1).getTime() - new Date(Number(yB), Number(mB)-1).getTime();
      })
      .slice(-12);
  }, [transactions]);

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center flex-col gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary-600" />
        <p className="text-gray-500 font-medium">Sincronizando dados contábeis...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-7xl mx-auto pb-12">
      <header className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
           <h1 className="text-3xl font-bold tracking-tight text-gray-900">Financeiro & Tesouraria</h1>
           <p className="mt-2 text-sm text-gray-500">
             Controle avançado de dízimos, ofertas, despesas por categoria e fluxo de caixa contábil.
           </p>
        </div>
        <button className="flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm text-center">
            <Download className="w-4 h-4"/> Exportar Relatório
        </button>
      </header>

      {/* Histórico Financeiro Real - sem filtros aplicados */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-2">
        <div className="mb-4">
          <h3 className="text-xl font-bold text-gray-900">Histórico Financeiro Real</h3>
          <p className="text-sm text-primary-600 font-medium">Consolidado mensal de Entradas e Saídas</p>
        </div>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={allBarChartData} barGap={8}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} tickFormatter={(v) => `R$${v/1000}k`} />
              <RechartsTooltip cursor={{fill: '#f8fafc'}} formatter={(v) => formatCurrency(v as number)} contentStyle={{borderRadius:'16px', border:'none', boxShadow:'0 10px 15px -3px rgba(0,0,0,0.1)'}} />
              <Legend iconType="circle" wrapperStyle={{paddingTop: '20px'}} />
              <Bar dataKey="entradas" fill="#10b981" radius={[4, 4, 0, 0]} name="Entradas" barSize={30} />
              <Bar dataKey="saidas" fill="#ef4444" radius={[4, 4, 0, 0]} name="Saídas" barSize={30} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-4 mb-6">
         <div className="flex items-center gap-2 text-gray-500 mr-2 shrink-0">
            <Filter className="w-5 h-5" />
            <span className="text-sm font-bold">Filtros:</span>
         </div>
         <select 
            value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-gray-50"
         >
            {months.map(m => <option key={m} value={m}>{m === 'Todos' ? 'Todos os Meses' : m}</option>)}
         </select>

         <select 
            value={selectedCategoria} onChange={(e) => setSelectedCategoria(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-gray-50"
         >
            {categorias.map(c => <option key={c} value={c}>{c === 'Todas' ? 'Todas as Categorias' : c}</option>)}
         </select>

         <select 
            value={selectedGrupo} onChange={(e) => setSelectedGrupo(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-gray-50"
         >
            {grupos.map(g => <option key={g} value={g}>{g === 'Todos' ? 'Todos os Centros de Custo / Grupos' : g}</option>)}
         </select>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 mb-8">
         <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
               <h3 className="text-sm font-medium text-gray-500">Saldo Consolidado (Filtro)</h3>
               <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Wallet className="w-5 h-5"/></div>
            </div>
            <p className={clsx("text-3xl font-bold", totals.entradas - totals.saidas >= 0 ? "text-gray-900" : "text-red-600")}>
               {formatCurrency(totals.entradas - totals.saidas)}
            </p>
         </div>
         <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
               <h3 className="text-sm font-medium text-gray-500">Total de Entradas</h3>
               <div className="p-2 bg-green-50 text-green-600 rounded-lg"><ArrowUpRight className="w-5 h-5"/></div>
            </div>
            <p className="text-3xl font-bold text-gray-900">{formatCurrency(totals.entradas)}</p>
         </div>
         <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
               <h3 className="text-sm font-medium text-gray-500">Total de Saídas</h3>
               <div className="p-2 bg-red-50 text-red-600 rounded-lg"><ArrowDownRight className="w-5 h-5"/></div>
            </div>
            <p className="text-3xl font-bold text-gray-900">{formatCurrency(totals.saidas)}</p>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
         {/* Bar Chart */}
         <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 lg:col-span-2">
             <h3 className="text-lg font-semibold leading-6 text-gray-900 mb-6">Fluxo de Caixa (Evolução)</h3>
             <div className="h-80 w-full">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChartData}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                     <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} dy={10} />
                     <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} tickFormatter={(val) => `R$${val/1000}k`} />
                     <RechartsTooltip cursor={{fill: '#f9fafb'}} formatter={(val) => formatCurrency(val as number)} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}/>
                     <Legend />
                     <Bar dataKey="entradas" fill="#10b981" name="Entradas" radius={[4, 4, 0, 0]} />
                     <Bar dataKey="saidas" fill="#ef4444" name="Saídas" radius={[4, 4, 0, 0]} />
                  </BarChart>
               </ResponsiveContainer>
             </div>
         </div>

         {/* Pie Chart */}
         <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
             <div className="flex items-center gap-2 mb-6">
                <PieChartIcon className="w-5 h-5 text-purple-600" />
                <h3 className="text-lg font-semibold leading-6 text-gray-900">Despesas por Categoria</h3>
             </div>
             {pieChartData.length > 0 ? (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                     <PieChart>
                        <Pie
                          data={pieChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {pieChartData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip formatter={(val) => formatCurrency(val as number)} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}/>
                     </PieChart>
                  </ResponsiveContainer>
                </div>
             ) : (
                <div className="h-64 flex items-center justify-center text-gray-400 text-sm italic">Sem dados de saída no período</div>
             )}
             <div className="mt-4 space-y-2 max-h-32 overflow-y-auto pr-2">
                {pieChartData.map((entry, index) => (
                   <div key={index} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                         <div className="w-3 h-3 rounded-full" style={{backgroundColor: COLORS[index % COLORS.length]}}></div>
                         <span className="text-gray-700 truncate max-w-[120px]" title={entry.name}>{entry.name}</span>
                      </div>
                      <span className="font-medium text-gray-900">{formatCurrency(entry.value)}</span>
                   </div>
                ))}
             </div>
         </div>
      </div>

      {/* Tabela Contábil Detalhada */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
         <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <h3 className="text-lg font-semibold text-gray-900">Extrato Detalhado</h3>
            <span className="text-sm text-gray-500 font-medium">{filteredData.length} registros</span>
         </div>
         <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Data</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Histórico / Pessoa</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Categoria</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">C. Custo / Grupo</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Valor</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {filteredData.slice(0, 50).map((t, i) => {
                  const isEntrada = t.tipo.toLowerCase().includes('entrada') || t.tipo.toLowerCase().includes('receita');
                  return (
                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                         {new Date(t.data).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                         <div className="font-medium">{t.pessoa_lancamento || 'Nao Informado'}</div>
                         <div className="text-xs text-gray-500 line-clamp-1">{t.historico}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                         <span className="bg-gray-100 text-gray-700 px-2.5 py-1 rounded-md text-xs font-medium border border-gray-200">{t.categoria}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{t.centro_custo}</td>
                      <td className={clsx("px-6 py-4 whitespace-nowrap text-sm font-bold text-right", isEntrada ? 'text-green-600' : 'text-red-600')}>
                         {isEntrada ? '+' : '-'} {formatCurrency(Math.abs(t.valor))}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filteredData.length > 50 && (
               <div className="p-4 text-center text-sm text-gray-500 bg-gray-50">
                  Exibindo os últimos 50 registros de {filteredData.length}. Use os filtros acima para refinar ou exporte o relatório.
               </div>
            )}
         </div>
      </div>

    </div>
  );
};
