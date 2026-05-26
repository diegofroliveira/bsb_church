import React from 'react';
import { Clock, UserPlus, MapPin, CalendarCheck } from 'lucide-react';

export const LabVisits: React.FC = () => {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-gray-900 via-slate-800 to-gray-900 p-8 text-white">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-teal-400 rounded-full translate-x-1/2 -translate-y-1/2 blur-3xl" />
        </div>
        <div className="relative">
          <div className="inline-flex items-center gap-2 bg-white/10 text-teal-300 px-3 py-1 rounded-full text-xs font-bold mb-4 border border-white/10">
            <Clock className="h-3 w-3" /> LAB · EM DESENVOLVIMENTO
          </div>
          <h1 className="text-4xl font-black tracking-tight mb-2">
            Gestão de<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-300 to-cyan-400">Visitas</span>
          </h1>
          <p className="text-gray-400 max-w-xl text-sm leading-relaxed">
            Acompanhe visitantes, registre contatos, gerencie o processo de integração e mapeie a jornada de cada visita até se tornar membro ativo.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          {
            icon: UserPlus,
            title: 'Cadastro de Visitantes',
            desc: 'Registre dados de contato e data da visita de forma rápida e simples.',
            color: 'text-teal-600',
            bg: 'bg-teal-50',
          },
          {
            icon: MapPin,
            title: 'Triagem por GC',
            desc: 'Direcione o visitante para o GC mais próximo da sua localidade automaticamente.',
            color: 'text-blue-600',
            bg: 'bg-blue-50',
          },
          {
            icon: CalendarCheck,
            title: 'Follow-up',
            desc: 'Acompanhe o retorno, registre visitas pastorais e marque o status de integração.',
            color: 'text-violet-600',
            bg: 'bg-violet-50',
          },
        ].map(card => (
          <div key={card.title} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 opacity-60">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${card.bg}`}>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </div>
            <h3 className="font-bold text-gray-900 mb-1">{card.title}</h3>
            <p className="text-sm text-gray-500">{card.desc}</p>
          </div>
        ))}
      </div>

      <div className="bg-gray-100 rounded-2xl p-10 flex flex-col items-center justify-center text-center border-2 border-dashed border-gray-200">
        <Clock className="h-14 w-14 text-gray-300 mb-4" />
        <p className="text-gray-400 font-semibold">Módulo em construção</p>
        <p className="text-gray-400 text-sm mt-1">Fale com Diego para definir os próximos passos desse módulo.</p>
      </div>
    </div>
  );
};
