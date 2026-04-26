import React, { useState, useEffect, useRef } from 'react';
import { Brain, Send, Bot, User, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: Date;
}

export const AiConsultant: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'bot',
      text: 'Olá! Sou a Inteligência do IgrejaPro. Como posso ajudar com os dados da congregação hoje?',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [members, setMembers] = useState<any[]>([]);
  const [cells, setCells] = useState<any[]>([]);
  const [lastContext, setLastContext] = useState<{
    type: 'place' | 'missing-phone' | 'members' | 'cells';
    placeName?: string;
    filteredMembers?: any[];
  } | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: mData } = await supabase.from('membros').select('*');
        const { data: cData } = await supabase.from('celulas').select('*');
        if (mData) setMembers(mData);
        if (cData) setCells(cData);
      } catch (err) {
        console.error('Error loading AI database:', err);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const processQueryLocal = (query: string): string => {
    const q = query.toLowerCase();
    
    // Suporte ao contexto anterior (Listagem)
    if (q.includes('listar') || q.includes('lista') || q.includes('quem sao') || q.includes('quem são') || q.includes('quais sao') || q.includes('quais são') || q.includes('pode listá-los') || q.includes('pode listalos')) {
      if (lastContext) {
        if (lastContext.type === 'place' && lastContext.filteredMembers) {
          const names = lastContext.filteredMembers.map(m => m.nome || m.name).filter(Boolean).join(', ');
          return `Aqui está a lista completa de pessoas em ${lastContext.placeName}: \n\n${names}`;
        }
        if (lastContext.type === 'missing-phone' && lastContext.filteredMembers) {
          const names = lastContext.filteredMembers.map(m => m.nome || m.name).filter(Boolean).join(', ');
          return `Os membros sem telefone cadastrado são: \n\n${names}`;
        }
      } else {
        return `Não tenho certeza sobre o que você deseja listar. Tente fazer a pergunta inicial primeiro (Ex: Quantos moram em Vicente Pires?)`;
      }
    }

    // Suporte ao contexto anterior (Tabela)
    if (q.includes('tabela') || q.includes('quadro') || q.includes('tabelar') || q.includes('grade')) {
      if (lastContext && lastContext.filteredMembers) {
        let table = "| Nome | Bairro | Cidade |\n| :--- | :--- | :--- |\n";
        lastContext.filteredMembers.forEach(m => {
          const b = m.bairro || m.address || m.endereco || '-';
          table += `| ${m.nome || m.name || '-'} | ${b} | ${m.cidade || '-'} |\n`;
        });
        return `Com certeza! Aqui estão os dados organizados em tabela:\n\n${table}`;
      } else {
        return `Não localizei registros anteriores para criar uma tabela. Faça uma pergunta sobre uma localidade ou filtro primeiro!`;
      }
    }

    // 1. INTENT: Membros / Cadastros
    if (
      q.includes('membros') || 
      q.includes('quantos membros') || 
      q.includes('total de membros') ||
      q.includes('cadastros') ||
      q.includes('quantas pessoas') ||
      q.includes('qmts') ||
      q.includes('quantos tem')
    ) {
      if (q.includes('telefone') || q.includes('sem telefone')) {
        const missing = members.filter(m => !m.telefone || m.telefone.trim() === '');
        setLastContext({ type: 'missing-phone', filteredMembers: missing });
        return `Existem ${missing.length} registros de membros sem o número de telefone informado na base de dados.`;
      }

      const active = members.filter(m => (m.status || m.tipo_cadastro) !== 'Inativo');
      setLastContext({ type: 'members', filteredMembers: active });
      return `Atualmente, a igreja conta com um total de ${members.length} pessoas/cadastros no sistema, sendo ${active.length} considerados membros ativos.`;
    }
    
    if (q.includes('gc') || q.includes('celula') || q.includes('célula') || q.includes('grupos caseiros')) {
      setLastContext({ type: 'cells' });
      return `Temos ${cells.length} Grupos de Crescimento (GCs/Células) ativos e mapeados nas localidades.`;
    }

    const places = ['arniqueira', 'águas claras', 'aguas claras', 'taguatinga', 'ceilândia', 'ceilandia', 'guará', 'guara', 'vicente pires'];
    const matchedPlace = places.find(p => q.includes(p));
    if (matchedPlace) {
      const filtered = members.filter(m => {
        const addr = (m.endereco || m.address || '').toLowerCase();
        const city = (m.cidade || m.city || '').toLowerCase();
        const neigh = (m.bairro || '').toLowerCase();
        return addr.includes(matchedPlace) || city.includes(matchedPlace) || neigh.includes(matchedPlace);
      });
      if (filtered.length === 0) {
        setLastContext(null);
        return `Não localizei nenhum membro explicitamente vinculado à região de ${matchedPlace} nos dados de endereços.`;
      }
      setLastContext({ type: 'place', placeName: matchedPlace, filteredMembers: filtered });
      const names = filtered.map(m => m.nome || m.name).filter(Boolean).slice(0, 10).join(', ');
      return `Encontrei ${filtered.length} pessoas morando ou mapeadas para ${matchedPlace}. Exemplos: ${names}${filtered.length > 10 ? '...' : ''}`;
    }

    if (q.includes('aniversário') || q.includes('aniversariantes')) {
      return `Os aniversariantes da semana podem ser filtrados no módulo principal de Relatórios ou através das métricas do Dashboard!`;
    }

    if (q.includes('líder') || q.includes('lider')) {
      const leaders = Array.from(new Set(cells.map(c => c.lider || c.leader).filter(Boolean)));
      if (leaders.length > 0) {
        return `Os líderes responsáveis à frente das células são: ${leaders.join(', ')}.`;
      }
    }

    return `Entendido. Verifiquei na base que possuímos ${members.length} pessoas cadastradas e ${cells.length} GCs. Tente ser mais específico, pergunte por exemplo sobre 'sem telefone' ou filtre por 'Arniqueira'.`;
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    const apiKey = localStorage.getItem('church_gemini_api_key');

    if (apiKey && apiKey.trim() !== '') {
      try {
        const genAI = new GoogleGenerativeAI(apiKey.trim());
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `
          Você é o "Consultor IA" do IgrejaPro, um Pastor Auxiliar focado no cuidado do Corpo de Cristo.
          Considere o banco de dados atual da igreja:
          - Total de pessoas cadastradas: ${members.length}
          - Total de GCs/Células: ${cells.length}
          
          Responda com empatia, conhecimento bíblico prático e dados exatos à seguinte pergunta do usuário: "${userMsg.text}".
          Evite jargões excessivamente técnicos.
        `;

        const result = await model.generateContent(prompt);
        const botResponse = result.response.text();

        const botMsg: Message = {
          id: (Date.now() + 1).toString(),
          sender: 'bot',
          text: botResponse,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, botMsg]);
      } catch (error) {
        console.error('Error invoking Gemini:', error);
        // Fallback to local heuristic
        const fallback = processQueryLocal(userMsg.text);
        setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), sender: 'bot', text: `(Modo Local) ${fallback}`, timestamp: new Date() }]);
      } finally {
        setIsTyping(false);
      }
    } else {
      // Sem chave - Modo Local Heurístico
      setTimeout(() => {
        const botResponse = processQueryLocal(userMsg.text);
        const botMsg: Message = {
          id: (Date.now() + 1).toString(),
          sender: 'bot',
          text: botResponse,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, botMsg]);
        setIsTyping(false);
      }, 1000);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] bg-gray-50 rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-50 text-primary-600 rounded-xl">
            <Brain className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">IA</h1>
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-amber-500" /> Alimentado por inteligência avançada
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/50">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-3 max-w-[80%] ${msg.sender === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
          >
            <div className={`p-2 rounded-xl shrink-0 ${msg.sender === 'bot' ? 'bg-primary-100 text-primary-600' : 'bg-gray-200 text-gray-700'}`}>
              {msg.sender === 'bot' ? <Bot className="h-5 w-5" /> : <User className="h-5 w-5" />}
            </div>
            <div className={`p-4 rounded-2xl shadow-sm ${msg.sender === 'bot' ? 'bg-white text-gray-800 border border-gray-100' : 'bg-primary-600 text-white'}`}>
              {(() => {
                const text = msg.text;
                if (text.includes('|') && text.includes('\n|')) {
                  const lines = text.split('\n').filter(line => line.trim().startsWith('|'));
                  if (lines.length >= 3) {
                    const headerLine = lines[0];
                    const dataLines = lines.slice(2); // Pula separador | --- |
                    const headers = headerLine.split('|').map(h => h.trim()).filter(Boolean);
                    const rows = dataLines.map(line => line.split('|').map(cell => cell.trim()).filter(Boolean)).filter(r => r.length > 0);

                    return (
                      <div className="overflow-x-auto my-2">
                        <table className="min-w-full divide-y divide-gray-200 text-xs border border-gray-100 rounded-lg">
                          <thead className="bg-gray-50">
                            <tr>
                              {headers.map((h, i) => <th key={i} className="px-3 py-2 text-left font-bold text-gray-700">{h}</th>)}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 bg-white">
                            {rows.map((row, i) => (
                              <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                                {row.map((cell, j) => <td key={j} className="px-3 py-2 text-gray-600">{cell}</td>)}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  }
                }
                return <p className="text-sm leading-relaxed whitespace-pre-line">{msg.text}</p>;
              })()}
              <span className={`text-[10px] block mt-1 ${msg.sender === 'bot' ? 'text-gray-400' : 'text-primary-200'}`}>
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex items-start gap-3 max-w-[80%]">
            <div className="p-2 rounded-xl bg-primary-100 text-primary-600 shrink-0">
              <Bot className="h-5 w-5" />
            </div>
            <div className="bg-white text-gray-500 p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-2">
              <span className="w-2 h-2 bg-primary-600 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
              <span className="w-2 h-2 bg-primary-600 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
              <span className="w-2 h-2 bg-primary-600 rounded-full animate-bounce"></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Footer / Input */}
      <div className="bg-white p-4 border-t border-gray-100 flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Pergunte algo (Ex: Quem mora em Vicente Pires?)"
          className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary-500 focus:bg-white transition-all"
        />
        <button
          onClick={handleSend}
          className="p-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl shadow-md transition-colors shadow-primary-500/20"
        >
          <Send className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};
