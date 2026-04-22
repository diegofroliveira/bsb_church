import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, PieChart, Pie, Cell
} from 'recharts';
import { Users, UserPlus, Home, TrendingUp, Loader2 } from 'lucide-react';
import clsx from 'clsx';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalMembros: 0,
    membrosAtivos: 0,
    totalVisitantes: 0,
    totalCelulas: 0,
    arrecadacaoMes: 0,
  });

  const [charts, setCharts] = useState({
    growth: [] as any[],
    demographics: [] as any[],
    finance: [] as any[],
    groups: [] as any[],
  });
  
  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      try {
        // 1. Fetch Membros Stats
        const { count: totalMembros } = await supabase
          .from('membros')
          .select('*', { count: 'exact', head: true });

        const { count: ativos } = await supabase
          .from('membros')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'Ativo');

        const { count: visitantes } = await supabase
          .from('membros')
          .select('*', { count: 'exact', head: true })
          .eq('tipo_cadastro', 'Visitante');

        // 2. Fetch Celulas
        const { count: totalCelulas } = await supabase
          .from('celulas')
          .select('*', { count: 'exact', head: true });

        // 3. Fetch Financeiro (Recent)
        // Note: For a real dashboard we'd use aggregations or sum in DB
        // Here we'll fetch last 1000 and calculate for demo, or sum via select
        const { data: finData } = await supabase
          .from('financeiro')
          .select('tipo, valor, data')
          .order('data', { ascending: false })
          .limit(2000);

        let sumEntradas = 0;
        let sumSaidas = 0;
        
        // Simple calculation for the current/latest data
        finData?.forEach(item => {
          const val = parseFloat(item.valor.replace(',', '.')) || 0;
          if (item.tipo.toLowerCase().includes('entrada') || item.tipo.toLowerCase().includes('receita')) {
            sumEntradas += val;
          } else {
            sumSaidas += val;
          }
        });

        // 4. Group data for Charts (Mocking the structure but using real totals where possible)
        setStats({
          totalMembros: totalMembros || 0,
          membrosAtivos: ativos || 0,
          totalVisitantes: visitantes || 0,
          totalCelulas: totalCelulas || 0,
          arrecadacaoMes: sumEntradas,
        });

        // Demo Charts using real totals
        setCharts({
          growth: [
            { name: 'Jan', membros: (totalMembros || 0) * 0.8, visitantes: (visitantes || 0) * 0.5 },
            { name: 'Fev', membros: (totalMembros || 0) * 0.85, visitantes: (visitantes || 0) * 0.7 },
            { name: 'Mar', membros: (totalMembros || 0) * 0.9, visitantes: (visitantes || 0) * 0.8 },
            { name: 'Abr', membros: totalMembros || 0, visitantes: visitantes || 0 },
          ],
          demographics: [
            { name: 'Crianças', value: Math.round((totalMembros || 0) * 0.15), fill: '#3b82f6' },
            { name: 'Jovens', value: Math.round((totalMembros || 0) * 0.25), fill: '#10b981' },
            { name: 'Adultos', value: Math.round((totalMembros || 0) * 0.45), fill: '#f59e0b' },
            { name: 'Idosos', value: Math.round((totalMembros || 0) * 0.15), fill: '#6366f1' },
          ],
          finance: [
            { date: 'Semana 1', entradas: sumEntradas * 0.2, saidas: sumSaidas * 0.15 },
            { date: 'Semana 2', entradas: sumEntradas * 0.3, saidas: sumSaidas * 0.25 },
            { date: 'Semana 3', entradas: sumEntradas * 0.25, saidas: sumSaidas * 0.4 },
            { date: 'Semana 4', entradas: sumEntradas * 0.25, saidas: sumSaidas * 0.2 },
          ],
          groups: [
             { nome: 'GC Centro', lider: 'João', membros: 12, checkins: 10 },
             { nome: 'GC Alvorada', lider: 'Maria', membros: 15, checkins: 12 },
             { nome: 'GC Morada', lider: 'Pedro', membros: 8, checkins: 8 },
          ]
        });

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const isPastorOrAdmin = ['pastor', 'admin'].includes(user?.role || '');

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
          Bem-vindo de volta, <span className="font-semibold text-primary-600 ml-1">{user?.name}</span>. Aqui está o resumo atualizado da sua congregação.
        </p>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Total de Membros', value: stats.totalMembros, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Membros Ativos', value: stats.membrosAtivos, sub: 'Na base', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Visitantes', value: stats.totalVisitantes, icon: UserPlus, color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: 'Grupos Caseiros', value: stats.totalCelulas, icon: Home, color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div key={idx} className="relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow group">
              <div className="flex items-center gap-4">
                <div className={clsx("flex h-12 w-12 items-center justify-center rounded-xl transition-transform group-hover:scale-110", kpi.bg)}>
                  <Icon className={clsx("h-6 w-6", kpi.color)} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">{kpi.label}</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
                    {kpi.sub && <span className="text-xs text-gray-400">{kpi.sub}</span>}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
          <div className="pb-4 mb-4 border-b border-gray-100">
            <h3 className="text-lg font-semibold leading-6 text-gray-900">Evolução da Base</h3>
            <p className="mt-1 text-sm text-gray-500">Membros e Visitantes atuais</p>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={charts.growth} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorMembros" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '14px' }}/>
                <Area type="monotone" dataKey="membros" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorMembros)" name="Membros" />
                <Area type="monotone" dataKey="visitantes" stroke="#f59e0b" strokeWidth={3} fillOpacity={0.1} name="Visitantes" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 flex flex-col">
          <div className="pb-4 mb-4 border-b border-gray-100 backdrop-blur-sm">
            <h3 className="text-lg font-semibold leading-6 text-gray-900">Demografia</h3>
            <p className="mt-1 text-sm text-gray-500">Distribuição Estimada</p>
          </div>
          <div className="flex-1 flex flex-col justify-center items-center relative">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={charts.demographics}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {charts.demographics.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-12">
               <span className="text-3xl font-bold text-gray-900">{stats.totalMembros}</span>
               <span className="text-xs text-gray-500">Total</span>
            </div>
          </div>
        </div>
      </div>

      {isPastorOrAdmin && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 mt-6">
           <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
             <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-100">
                <div>
                  <h3 className="text-lg font-semibold leading-6 text-gray-900">Snapshot Financeiro</h3>
                  <p className="mt-1 text-sm text-gray-500">Últimos Lançamentos</p>
                </div>
                <div className="bg-green-50 text-green-700 px-3 py-1 rounded-full text-sm font-semibold border border-green-100">
                   {formatCurrency(stats.arrecadacaoMes)}
                </div>
             </div>
             <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={charts.finance} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                    <Tooltip formatter={(value) => formatCurrency(value as number)} />
                    <Legend />
                    <Bar dataKey="entradas" fill="#10b981" name="Entradas" radius={[4, 4, 0, 0]} barSize={20} />
                    <Bar dataKey="saidas" fill="#ef4444" name="Saídas" radius={[4, 4, 0, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
             </div>
           </div>

           <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 flex flex-col">
              <div className="pb-4 mb-4 border-b border-gray-100">
                <h3 className="text-lg font-semibold leading-6 text-gray-900">Grupos Caseiros</h3>
                <p className="mt-1 text-sm text-gray-500">Visão Geral</p>
              </div>
              <div className="overflow-hidden flex-1 flex flex-col">
                 <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50/50">
                      <tr>
                        <th scope="col" className="py-3 pl-4 pr-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Grupo</th>
                        <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Líder</th>
                        <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Membros</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {charts.groups.map((group, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                           <td className="whitespace-nowrap py-3 pl-4 pr-3 text-sm font-medium text-gray-900">{group.nome}</td>
                           <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-500">{group.lider}</td>
                           <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-900 text-right font-medium">{group.membros}</td>
                        </tr>
                      ))}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
