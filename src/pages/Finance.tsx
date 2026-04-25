import React, { useEffect, useState, useMemo } from 'react';
import { Download, Wallet, ArrowUpRight, ArrowDownRight, Loader2, Filter, LayoutDashboard } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, ReferenceLine } from 'recharts';
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
          
          // Safety break to prevent infinite loops (max 50k records)
          if (from > 50000) break; 
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

  // Saldos Iniciais (Patrimônio Acumulado) - Dados extraídos do Relatório Prover 25/04/2026
  const INITIAL_BALANCES = {
    investimentos: 295334.30 + 215207.93 + 166192.14, // REF DI + RF LP + BB RENDE FÁCIL
    bancos: 47067.72 + 36081.31 + 1096.08 + 346.39, // BB Contas e Poupanças
    sicoob: -1441.08 - 4660.00 - 1134.99, // Contas Sicoob (Negativas)
    caixa: 11288.74
  };

  const totalReservas = Object.values(INITIAL_BALANCES).reduce((a, b) => a + b, 0);

  const { months, categorias, grupos } = useMemo(() => {
    const mSet = new Set<string>();
    const cSet = new Set<string>();
    const gSet = new Set<string>();

    transactions.forEach(t => {
      const d = parseDate(t.data);
      if (!isNaN(d.getTime())) {
        const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        mSet.add(mKey);
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

  // Financial Computations
  const stats = useMemo(() => {
    let sumEntradasAll = 0;
    let sumSaidasAll = 0;
    let sumEntradasMonth = 0;
    let sumSaidasMonth = 0;

    const targetMonth = selectedMonth || 'Todos';

    transactions.forEach(t => {
      const isEntrada = t.tipo.toLowerCase().includes('entrada') || t.tipo.toLowerCase().includes('receita');
      const val = Math.abs(t.valor);
      
      if (isEntrada) sumEntradasAll += val;
      else sumSaidasAll += val;

      const d = parseDate(t.data);
      const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      
      // Se for 'Todos', somamos tudo. Se for um mês específico, filtramos.
      if (targetMonth === 'Todos' || mKey === targetMonth) {
        if (isEntrada) sumEntradasMonth += val;
        else sumSaidasMonth += val;
      }
    });

    const netFlow = sumEntradasAll - sumSaidasAll;

    return {
      totalEntradas: sumEntradasMonth,
      totalSaidas: sumSaidasMonth,
      saldoMensal: sumEntradasMonth - sumSaidasMonth,
      fullHistoryBalance: totalReservas + netFlow,
      reservas: totalReservas,
      taxaEficiencia: sumEntradasMonth > 0 ? ((sumEntradasMonth - sumSaidasMonth) / sumEntradasMonth) * 100 : 0
    };
  }, [transactions, selectedMonth, totalReservas]);

  const filteredData = useMemo(() => {
    return transactions.filter(t => {
      const d = parseDate(t.data);
      const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const matchMonth = !selectedMonth || selectedMonth === 'Todos' || mStr === selectedMonth;
      const matchCat = selectedCategoria === 'Todas' || t.categoria === selectedCategoria;
      const matchGroup = selectedGrupo === 'Todos' || t.centro_custo === selectedGrupo;
      return matchMonth && matchCat && matchGroup;
    });
  }, [transactions, selectedMonth, selectedCategoria, selectedGrupo]);

  // Compute Totals and Charts based on filtered data
  const { totals, compositionData, topExpenses } = useMemo(() => {
    let sumEntradasFiltered = 0;
    let sumSaidasFiltered = 0;
    
    const monthlyMap: Record<string, { name: string, entradas: number, saidas: number, saldo: number }> = {};
    const categoryExpenseMap: Record<string, number> = {};
    const categoryRevenueMap: Record<string, number> = {};

    // 2. Process Filtered Data & Chart Data
    filteredData.forEach(item => {
      const val = item.valor;
      const isEntrada = item.tipo.toLowerCase().includes('entrada') || item.tipo.toLowerCase().includes('receita');
      
      if (isEntrada) {
        sumEntradasFiltered += val;
        categoryRevenueMap[item.categoria] = (categoryRevenueMap[item.categoria] || 0) + val;
      } else {
        sumSaidasFiltered += val;
        categoryExpenseMap[item.categoria] = (categoryExpenseMap[item.categoria] || 0) + Math.abs(val);
      }

      const date = parseDate(item.data);
      if (!isNaN(date.getTime())) {
        const monthYear = `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
        if (!monthlyMap[monthYear]) {
          monthlyMap[monthYear] = { name: monthYear, entradas: 0, saidas: 0, saldo: 0 };
        }
        if (isEntrada) monthlyMap[monthYear].entradas += val;
        else monthlyMap[monthYear].saidas += Math.abs(val);
      }
    });

    // Revenue Composition
    const compositionData = Object.entries(categoryRevenueMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Top Expenses Radar
    const topExpenses = Object.entries(categoryExpenseMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    return {
      totals: {
        entradas: sumEntradasFiltered,
        saidas: Math.abs(sumSaidasFiltered)
      },
      compositionData,
      topExpenses
    };
  }, [transactions, filteredData]);

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
           <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold uppercase tracking-wider rounded-md border border-blue-200">Tesouraria Central</span>
           </div>
           <h1 className="text-3xl font-bold tracking-tight text-gray-900">Inteligência Financeira</h1>
           <p className="mt-1 text-sm text-gray-500">
             Visão consolidada de caixa, performance operacional e saúde contábil.
           </p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm">
              <Download className="w-4 h-4"/> PDF
          </button>
          <button className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-5 py-2 rounded-xl text-sm font-semibold transition-all shadow-md">
              <Wallet className="w-4 h-4"/> Conciliar
          </button>
        </div>
      </header>

      {/* EXECUTIVE BANKING HEADER */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-8">
         <div className="lg:col-span-2 bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl shadow-xl p-8 text-white relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
               <Wallet className="w-32 h-32 rotate-12" />
            </div>
            <div className="relative z-10">
               <div className="flex items-center gap-2 text-gray-400 text-xs font-bold uppercase tracking-[0.2em] mb-4">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  Patrimônio Consolidado (Real)
               </div>
               <div className="text-5xl font-black tracking-tighter mb-2">
                  {formatCurrency(stats.fullHistoryBalance)}
               </div>
               <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400 uppercase font-bold">Investimentos:</span>
                    <span className="text-sm font-bold text-blue-400">{formatCurrency(stats.reservas)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400 uppercase font-bold">Fluxo Acumulado:</span>
                    <span className={clsx("text-sm font-bold", (stats.fullHistoryBalance - stats.reservas) >= 0 ? "text-green-400" : "text-red-400")}>
                      {formatCurrency(stats.fullHistoryBalance - stats.reservas)}
                    </span>
                  </div>
               </div>
            </div>
         </div>

         <div className="grid grid-cols-1 gap-4">
            <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all">
               <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-gray-400 uppercase">Receitas</span>
                  <div className="p-1.5 bg-green-50 text-green-600 rounded-lg"><ArrowUpRight className="w-4 h-4"/></div>
               </div>
               <div className="text-2xl font-bold text-gray-900">{formatCurrency(totals.entradas)}</div>
               <div className="mt-1 text-[10px] text-gray-400 font-medium italic">Filtro aplicado</div>
            </div>
            <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all">
               <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-gray-400 uppercase">Despesas</span>
                  <div className="p-1.5 bg-red-50 text-red-600 rounded-lg"><ArrowDownRight className="w-4 h-4"/></div>
               </div>
               <div className="text-2xl font-bold text-gray-900">{formatCurrency(totals.saidas)}</div>
               <div className="mt-1 text-[10px] text-gray-400 font-medium italic">Filtro aplicado</div>
            </div>
         </div>

         <div className="bg-primary-600 rounded-3xl shadow-lg p-6 text-white flex flex-col justify-between">
            <div>
               <h3 className="text-sm font-bold opacity-80 mb-1">Taxa de Eficiência</h3>
               <p className="text-xs opacity-60 leading-relaxed">Relação entre arrecadação e custo operacional.</p>
            </div>
            <div className="mt-4">
               <div className="text-4xl font-black">{Math.min(100, Math.round((totals.entradas / (totals.saidas || 1)) * 100))}%</div>
               <div className="w-full bg-white/20 h-2 rounded-full mt-2 overflow-hidden">
                  <div className="bg-white h-full transition-all duration-1000" style={{ width: `${Math.min(100, (totals.entradas / (totals.saidas || 1)) * 100)}%` }} />
               </div>
            </div>
         </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-3 mb-6">
         <div className="flex items-center gap-2 text-gray-400 px-3 border-r border-gray-100 mr-2">
            <Filter className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-widest">Radar</span>
         </div>
         <select 
            value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
            className="flex-1 px-4 py-2 bg-gray-50 border-none rounded-xl text-sm font-semibold focus:ring-2 focus:ring-primary-500 outline-none"
         >
            {months.map(m => <option key={m} value={m}>{m === 'Todos' ? 'Histórico Completo' : m}</option>)}
         </select>

         <select 
            value={selectedCategoria} onChange={(e) => setSelectedCategoria(e.target.value)}
            className="flex-1 px-4 py-2 bg-gray-50 border-none rounded-xl text-sm font-semibold focus:ring-2 focus:ring-primary-500 outline-none"
         >
            {categorias.map(c => <option key={c} value={c}>{c === 'Todas' ? 'Todas Categorias' : c}</option>)}
         </select>

         <select 
            value={selectedGrupo} onChange={(e) => setSelectedGrupo(e.target.value)}
            className="flex-1 px-4 py-2 bg-gray-50 border-none rounded-xl text-sm font-semibold focus:ring-2 focus:ring-primary-500 outline-none"
         >
            {grupos.map(g => <option key={g} value={g}>{g === 'Todos' ? 'Todos os Centros' : g}</option>)}
         </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
         {/* Gráfico 1: Evolução Patrimonial (Area Chart) */}
         <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 lg:col-span-2">
             <div className="flex items-center justify-between mb-8">
                <div>
                   <h3 className="text-lg font-bold text-gray-900">Evolução de Fluxo</h3>
                   <p className="text-xs text-gray-400">Dízimos e Ofertas acumuladas nos últimos 12 meses</p>
                </div>
                <div className="flex gap-4">
                   <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-primary-500" />
                      <span className="text-[10px] font-bold text-gray-400 uppercase">Receitas</span>
                   </div>
                </div>
             </div>
             <div className="h-72 w-full">
               <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={allBarChartData}>
                    <defs>
                      <linearGradient id="colorRec" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} tickFormatter={(val) => `R$${val/1000}k`} />
                    <RechartsTooltip cursor={{stroke: '#3b82f6', strokeWidth: 2}} formatter={(val) => formatCurrency(val as number)} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}/>
                    <Area type="monotone" dataKey="entradas" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorRec)" />
                  </AreaChart>
               </ResponsiveContainer>
             </div>
          </div>

          {/* Gráfico 2: Composição de Receita (Donut Chart) */}
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
              <div className="mb-6">
                 <h3 className="text-lg font-bold text-gray-900">Origem do Recurso</h3>
                 <p className="text-xs text-gray-400">Distribuição por categoria</p>
              </div>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                   <PieChart>
                      <Pie
                        data={compositionData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={8}
                        dataKey="value"
                      >
                        {compositionData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip formatter={(val) => formatCurrency(val as number)} contentStyle={{ borderRadius: '12px', border: 'none' }}/>
                   </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 space-y-2">
                 {compositionData.slice(0, 4).map((entry, index) => (
                    <div key={index} className="flex items-center justify-between text-[10px]">
                       <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{backgroundColor: COLORS[index % COLORS.length]}}></div>
                          <span className="text-gray-500 font-bold uppercase truncate max-w-[100px]">{entry.name}</span>
                       </div>
                       <span className="font-black text-gray-900">{formatCurrency(entry.value)}</span>
                    </div>
                 ))}
              </div>
          </div>

          {/* Radar de Gastos (Barras Horizontais) */}
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 lg:col-span-2">
              <div className="mb-8">
                 <h3 className="text-lg font-bold text-gray-900">Radar de Gastos</h3>
                 <p className="text-xs text-gray-400">As 5 categorias de maior impacto no período</p>
              </div>
              <div className="space-y-6">
                 {topExpenses.map((expense, index) => (
                   <div key={index}>
                      <div className="flex justify-between text-xs font-bold mb-2">
                         <span className="text-gray-600 uppercase tracking-wider">{expense.name}</span>
                         <span className="text-gray-900">{formatCurrency(expense.value)}</span>
                      </div>
                      <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                         <div 
                           className="bg-red-500 h-full rounded-full transition-all duration-1000" 
                           style={{ width: `${(expense.value / (topExpenses[0]?.value || 1)) * 100}%` }} 
                         />
                      </div>
                   </div>
                 ))}
              </div>
          </div>

          {/* Gráfico de Arrecadação Mensal vs Média */}
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 flex flex-col justify-center">
             <div className="mb-4">
                <h3 className="text-sm font-bold text-gray-900">Performance de Arrecadação</h3>
                <p className="text-[10px] text-gray-400">Comparativo mensal vs. média histórica</p>
             </div>
             <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={allBarChartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 8}} />
                      <YAxis hide domain={[0, 'dataMax + 10000']} />
                      <RechartsTooltip cursor={{fill: '#f8fafc'}} formatter={(val) => formatCurrency(val as number)} contentStyle={{ borderRadius: '12px', border: 'none', fontSize: '10px' }}/>
                      <Bar dataKey="entradas" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
                      <ReferenceLine y={allBarChartData.reduce((acc, curr) => acc + curr.entradas, 0) / allBarChartData.length} stroke="#94a3b8" strokeDasharray="3 3" label={{ position: 'right', value: 'Média', fill: '#94a3b8', fontSize: 8 }} />
                   </BarChart>
                </ResponsiveContainer>
             </div>
             <div className="mt-4 pt-4 border-t border-gray-50 flex justify-between items-center">
                <div className="text-center flex-1">
                   <p className="text-[10px] text-gray-400 uppercase font-bold">Média Mensal</p>
                   <p className="text-sm font-black text-primary-600">
                      {formatCurrency(allBarChartData.reduce((acc, curr) => acc + curr.entradas, 0) / allBarChartData.length)}
                   </p>
                </div>
                <div className="w-px h-8 bg-gray-100 mx-4" />
                <div className="text-center flex-1">
                   <p className="text-[10px] text-gray-400 uppercase font-bold">Melhor Mês</p>
                   <p className="text-sm font-black text-green-600">
                      {formatCurrency(Math.max(...allBarChartData.map(d => d.entradas)))}
                   </p>
                </div>
             </div>
          </div>
      </div>
      {/* POSIÇÃO POR CONTA (Espelho Prover) */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 mb-8">
          <div className="flex items-center justify-between mb-6">
             <div>
                <h3 className="text-lg font-bold text-gray-900">Posição por Conta</h3>
                <p className="text-xs text-gray-400">Conciliação direta com os saldos do Sistema Prover</p>
             </div>
             <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <LayoutDashboard className="w-5 h-5" />
             </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
             <div className="p-5 bg-gray-50 rounded-2xl border border-gray-100">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Aplicações e Investimentos</span>
                <div className="text-xl font-black text-gray-900">{formatCurrency(INITIAL_BALANCES.investimentos)}</div>
                <div className="text-[10px] text-blue-600 font-bold mt-1">REF DI / RF LP / BB Rende</div>
             </div>
             <div className="p-5 bg-gray-50 rounded-2xl border border-gray-100">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Banco do Brasil</span>
                <div className="text-xl font-black text-gray-900">{formatCurrency(INITIAL_BALANCES.bancos)}</div>
                <div className="text-[10px] text-green-600 font-bold mt-1">Contas Correntes e Poupança</div>
             </div>
             <div className="p-5 bg-gray-50 rounded-2xl border border-gray-100">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Caixa Geral (Espécie)</span>
                <div className="text-xl font-black text-gray-900">{formatCurrency(INITIAL_BALANCES.caixa)}</div>
                <div className="text-[10px] text-orange-600 font-bold mt-1">Disponibilidade Imediata</div>
             </div>
             <div className="p-5 bg-red-50/30 rounded-2xl border border-red-100">
                <span className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-1 block">Sicoob (Saldo Devedor)</span>
                <div className="text-xl font-black text-red-600">{formatCurrency(INITIAL_BALANCES.sicoob)}</div>
                <div className="text-[10px] text-red-400 font-bold mt-1">Ajustes e Contas Capital</div>
             </div>
          </div>
      </div>

      {/* Extrato Bancário Detalhado */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
         <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-gray-50/30">
            <div>
               <h3 className="text-xl font-bold text-gray-900">Extrato de Auditoria</h3>
               <p className="text-xs text-gray-400">Listagem detalhada de conciliação</p>
            </div>
            <div className="text-right">
               <span className="text-2xl font-black text-gray-900">{filteredData.length}</span>
               <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Lançamentos</p>
            </div>
         </div>
         <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-white">
                <tr>
                  <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.15em]">Data</th>
                  <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.15em]">Histórico / Origem</th>
                  <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.15em]">Categoria</th>
                  <th className="px-8 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-[0.15em]">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredData.slice(0, 50).map((t, i) => {
                  const isEntrada = t.tipo.toLowerCase().includes('entrada') || t.tipo.toLowerCase().includes('receita');
                  return (
                    <tr key={i} className="group hover:bg-gray-50/80 transition-all">
                      <td className="px-8 py-5 whitespace-nowrap text-sm font-medium text-gray-400">
                         {new Date(t.data).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-8 py-5">
                         <div className="font-bold text-gray-900 text-sm">{t.pessoa_lancamento || 'SISTEMA'}</div>
                         <div className="text-xs text-gray-400 truncate max-w-xs">{t.historico}</div>
                      </td>
                      <td className="px-8 py-5 whitespace-nowrap">
                         <span className="bg-white border border-gray-200 text-gray-500 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter shadow-sm group-hover:border-primary-200 group-hover:text-primary-600 transition-colors">
                           {t.categoria}
                         </span>
                      </td>
                      <td className={clsx("px-8 py-5 whitespace-nowrap text-sm font-black text-right tracking-tight", isEntrada ? 'text-green-500' : 'text-red-500')}>
                         {isEntrada ? '+' : '-'} {formatCurrency(Math.abs(t.valor))}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filteredData.length > 50 && (
               <div className="p-8 text-center bg-gray-50/50">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Mostrando os 50 registros mais recentes</p>
               </div>
            )}
         </div>
      </div>
    </div>
  );
};
