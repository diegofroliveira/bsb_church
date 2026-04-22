import React, { useEffect, useState } from 'react';
import { Download, Wallet, ArrowUpRight, ArrowDownRight, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export const Finance: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [totals, setTotals] = useState({
    saldo: 0,
    entradas: 0,
    saidas: 0
  });
  const [chartData, setChartData] = useState<any[]>([]);

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  useEffect(() => {
    const fetchFinanceData = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('financeiro')
          .select('tipo, valor, data')
          .order('data', { ascending: false })
          .limit(2000);

        if (error) throw error;

        let sumEntradas = 0;
        let sumSaidas = 0;
        
        // Group by month for chart
        const monthlyMap: Record<string, { name: string, entradas: number, saidas: number }> = {};

        data?.forEach(item => {
          const val = parseFloat(item.valor.replace(',', '.')) || 0;
          const isEntrada = item.tipo.toLowerCase().includes('entrada') || item.tipo.toLowerCase().includes('receita');
          
          if (isEntrada) sumEntradas += val;
          else sumSaidas += val;

          // Chart grouping
          const date = new Date(item.data);
          const monthYear = `${date.getMonth() + 1}/${date.getFullYear()}`;
          if (!monthlyMap[monthYear]) {
            monthlyMap[monthYear] = { name: monthYear, entradas: 0, saidas: 0 };
          }
          if (isEntrada) monthlyMap[monthYear].entradas += val;
          else monthlyMap[monthYear].saidas += val;
        });

        setTotals({
          saldo: sumEntradas - sumSaidas,
          entradas: sumEntradas,
          saidas: sumSaidas
        });

        // Convert map to sorted array
        const sortedChart = Object.values(monthlyMap)
          .reverse() // latest first in processing, so reverse back
          .slice(-6); // last 6 months

        setChartData(sortedChart);

      } catch (error) {
        console.error('Error fetching finance data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFinanceData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
           <h1 className="text-3xl font-bold tracking-tight text-gray-900">Financeiro & Tesouraria</h1>
           <p className="mt-2 text-sm text-gray-500">
             Controle de dízimos, ofertas, despesas e fluxo de caixa real.
           </p>
        </div>
        <button className="flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm text-center">
            <Download className="w-4 h-4"/> Exportar Relatório
        </button>
      </header>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 mb-8">
         <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
               <h3 className="text-sm font-medium text-gray-500">Saldo Consolidado</h3>
               <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Wallet className="w-5 h-5"/></div>
            </div>
            <p className="text-3xl font-bold text-gray-900">{formatCurrency(totals.saldo)}</p>
            <p className="text-sm text-gray-500 mt-2">Total em conta</p>
         </div>
         <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
               <h3 className="text-sm font-medium text-gray-500">Total de Entradas</h3>
               <div className="p-2 bg-green-50 text-green-600 rounded-lg"><ArrowUpRight className="w-5 h-5"/></div>
            </div>
            <p className="text-3xl font-bold text-gray-900">{formatCurrency(totals.entradas)}</p>
            <p className="text-sm text-gray-500 mt-2">Dízimos e Ofertas acumulados</p>
         </div>
         <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
               <h3 className="text-sm font-medium text-gray-500">Total de Saídas</h3>
               <div className="p-2 bg-red-50 text-red-600 rounded-lg"><ArrowDownRight className="w-5 h-5"/></div>
            </div>
            <p className="text-3xl font-bold text-gray-900">{formatCurrency(totals.saidas)}</p>
            <p className="text-sm text-gray-500 mt-2">Despesas e Operações</p>
         </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold leading-6 text-gray-900 mb-6">Fluxo por Período</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
               <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} tickFormatter={(val) => `R$${val/1000}k`} />
                  <Tooltip cursor={{fill: '#f9fafb'}} formatter={(val) => formatCurrency(val as number)} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}/>
                  <Legend />
                  <Bar dataKey="entradas" fill="#10b981" name="Entradas" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="saidas" fill="#ef4444" name="Saídas" radius={[4, 4, 0, 0]} />
               </BarChart>
            </ResponsiveContainer>
          </div>
      </div>
    </div>
  );
};
