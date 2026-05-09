import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ArrowLeft, User, Phone, MapPin, Mail, Calendar, Users, Heart, Wallet, BookOpen, Activity, Loader2 } from 'lucide-react';
import clsx from 'clsx';

interface MemberData {
  id: number;
  nome: string;
  nascimento: string;
  telefone_fixo: string;
  celular_principal_sms: string;
  email: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  estado: string;
  status: string;
  tipo_cadastro: string;
  grupos_caseiros: string;
  data_de_cadastro: string;
}

const calculateAge = (birthDateString: string | null): number | string => {
  if (!birthDateString) return '-';
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

export const MemberProfile: React.FC = () => {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  
  const [member, setMember] = useState<MemberData | null>(null);
  const [discipuladores, setDiscipuladores] = useState<string[]>([]);
  const [discipulos, setDiscipulos] = useState<string[]>([]);
  const [cellInfo, setCellInfo] = useState<any>(null);
  const [finance, setFinance] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!name) return;

    const fetchProfile = async () => {
      setIsLoading(true);
      try {
        const decodedName = decodeURIComponent(name);
        
        // 1. Fetch Member
        const { data: memberData } = await supabase
          .from('membros')
          .select('*')
          .ilike('nome', `%${decodedName}%`)
          .limit(1);

        if (!memberData || memberData.length === 0) {
           setMember(null);
           setIsLoading(false);
           return;
        }

        const m = memberData[0];
        setMember(m);

        const normName = normalizeStr(m.nome);

        // 2. Fetch Discipleship (using client-side filtering if ilike doesn't match exactly due to trailing spaces, but let's fetch roughly and filter)
        const { data: discData } = await supabase
          .from('discipulado')
          .select('*');
          
        if (discData) {
            const myDiscipuladores = discData
                .filter(d => normalizeStr(d.discipulo) === normName)
                .map(d => d.discipulador);
            const myDiscipulos = discData
                .filter(d => normalizeStr(d.discipulador) === normName)
                .map(d => d.discipulo);
                
            setDiscipuladores(myDiscipuladores);
            setDiscipulos(myDiscipulos);
        }

        // 3. Fetch Cell
        if (m.grupos_caseiros) {
            const { data: celData } = await supabase
              .from('celulas')
              .select('*');
            if (celData) {
                const myCell = celData.find(c => normalizeStr(c.grupo_caseiro) === normalizeStr(m.grupos_caseiros));
                setCellInfo(myCell || null);
            }
        }

        // 4. Fetch Finance
        const { data: finData } = await supabase
          .from('financeiro')
          .select('*')
          .ilike('pessoa_lancamento', `%${m.nome.split(' ')[0]}%`)
          .order('data', { ascending: false })
          .limit(100);
          
        if (finData) {
            // Filter more strictly
            const myFin = finData.filter(f => normalizeStr(f.pessoa_lancamento) === normName);
            setFinance(myFin);
        }

      } catch (error) {
        console.error('Error fetching member profile:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [name]);

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!member) {
    return (
      <div className="flex flex-col h-[80vh] items-center justify-center space-y-4">
        <User className="w-16 h-16 text-gray-300" />
        <h2 className="text-xl font-bold text-gray-700">Membro não encontrado</h2>
        <button onClick={() => navigate(-1)} className="text-primary-600 hover:underline">Voltar</button>
      </div>
    );
  }

  const formatCurrency = (val: string) => {
    const num = parseFloat(val.replace(',', '.')) || 0;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
  };

  const telefone = member.celular_principal_sms || member.telefone_fixo || 'Não informado';
  const endereco = [member.logradouro, member.bairro, member.cidade].filter(Boolean).join(', ') || 'Endereço não informado';

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-7xl mx-auto pb-12">
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Header Banner */}
        <div className="h-32 bg-gradient-to-r from-primary-600 to-primary-800"></div>
        
        <div className="px-6 sm:px-10 pb-8">
           <div className="relative flex justify-between items-end -mt-12 mb-6">
              <div className="h-24 w-24 bg-white rounded-2xl p-1 shadow-md">
                 <div className="h-full w-full bg-gray-100 rounded-xl flex items-center justify-center text-gray-400">
                    <User className="w-10 h-10" />
                 </div>
              </div>
              <div className="flex gap-3">
                 <span className={clsx("px-3 py-1 rounded-full text-sm font-bold border", 
                    member.status === 'Ativo' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200')}>
                    {member.status || 'Desconhecido'}
                 </span>
                 <span className="px-3 py-1 rounded-full text-sm font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    {member.tipo_cadastro || 'Membro'}
                 </span>
              </div>
           </div>

           <div>
              <h1 className="text-3xl font-bold text-gray-900">{member.nome}</h1>
              <p className="text-gray-500 mt-1 flex items-center gap-2">
                 <Calendar className="w-4 h-4" /> Cadastrado em {member.data_de_cadastro ? new Date(member.data_de_cadastro).toLocaleDateString('pt-BR') : 'Data desconhecida'}
              </p>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Left Column: Contact & Info */}
         <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
               <h3 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-2">Informações Pessoais</h3>
               
               <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{telefone}</p>
                    <p className="text-xs text-gray-500">Telefone</p>
                  </div>
               </div>
               
               {member.email && (
                 <div className="flex items-start gap-3">
                    <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 break-all">{member.email}</p>
                      <p className="text-xs text-gray-500">E-mail</p>
                    </div>
                 </div>
               )}

               <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{endereco}</p>
                    <p className="text-xs text-gray-500">Endereço</p>
                  </div>
               </div>

               <div className="flex items-start gap-3">
                  <Activity className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{calculateAge(member.nascimento)} anos</p>
                    <p className="text-xs text-gray-500">Idade</p>
                  </div>
               </div>
            </div>
         </div>

         {/* Right Column: Church Life */}
         <div className="lg:col-span-2 space-y-6">
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
               {/* Discipulado Box */}
               <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center gap-2 mb-4">
                     <BookOpen className="w-5 h-5 text-purple-600" />
                     <h3 className="text-lg font-bold text-gray-900">Discipulado</h3>
                  </div>
                  
                  <div className="space-y-4">
                     <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Discipulador (Líder Acima)</p>
                        {discipuladores.length > 0 ? (
                           discipuladores.map((d, i) => (
                             <div key={i} className="text-sm font-medium text-gray-900 bg-purple-50 p-2 rounded-lg border border-purple-100 mb-1">{d}</div>
                           ))
                        ) : (
                           <p className="text-sm text-gray-400 italic">Nenhum discipulador</p>
                        )}
                     </div>
                     <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Discípulos ({discipulos.length})</p>
                        {discipulos.length > 0 ? (
                           <div className="max-h-32 overflow-y-auto space-y-1 pr-2">
                              {discipulos.map((d, i) => (
                                <div key={i} className="text-sm text-gray-700 bg-gray-50 p-2 rounded-lg border border-gray-100">{d}</div>
                              ))}
                           </div>
                        ) : (
                           <p className="text-sm text-gray-400 italic">Nenhum discípulo</p>
                        )}
                     </div>
                  </div>
               </div>

               {/* Celula Box */}
               <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center gap-2 mb-4">
                     <Users className="w-5 h-5 text-blue-600" />
                     <h3 className="text-lg font-bold text-gray-900">Grupo Caseiro</h3>
                  </div>
                  
                  {cellInfo ? (
                     <div className="space-y-3">
                        <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                           <p className="font-bold text-blue-900">{cellInfo.grupo_caseiro}</p>
                           <p className="text-xs text-blue-700 uppercase tracking-wider mt-1">{cellInfo.setor}</p>
                        </div>
                        <div className="text-sm">
                           <span className="text-gray-500">Líder do Grupo:</span>
                           <p className="font-medium text-gray-900">{cellInfo.lider || 'Não informado'}</p>
                        </div>
                        <div className="text-sm">
                           <span className="text-gray-500">Local:</span>
                           <p className="font-medium text-gray-900">{cellInfo.bairro}</p>
                        </div>
                     </div>
                  ) : (
                     <div className="h-full flex flex-col items-center justify-center text-center p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <Heart className="w-8 h-8 text-gray-300 mb-2" />
                        <p className="text-sm font-medium text-gray-500">Não participa de nenhum Grupo Caseiro.</p>
                     </div>
                  )}
               </div>
            </div>

            {/* Financial Summary */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
               <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                     <Wallet className="w-5 h-5 text-green-600" />
                     <h3 className="text-lg font-bold text-gray-900">Histórico Financeiro Recente</h3>
                  </div>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-md">Últimos 5 registros</span>
               </div>
               
               {finance.length > 0 ? (
                 <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead>
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Categoria</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Valor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {finance.slice(0, 5).map((f, i) => (
                          <tr key={i}>
                            <td className="px-3 py-3 text-sm text-gray-500">{new Date(f.data).toLocaleDateString('pt-BR')}</td>
                            <td className="px-3 py-3 text-sm text-gray-900">{f.categoria || f.tipo}</td>
                            <td className="px-3 py-3 text-sm font-medium text-right text-green-600">{formatCurrency(f.valor)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                 </div>
               ) : (
                 <div className="text-center py-6">
                    <p className="text-sm text-gray-500">Nenhum registro financeiro vinculado a este nome.</p>
                 </div>
               )}
            </div>

         </div>
      </div>
    </div>
  );
};
