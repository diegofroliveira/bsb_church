import React, { useState, useEffect, useRef } from 'react';
import { Brain, Send, Bot, User, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';

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
      text: 'Olá! Sou o assistente de inteligência do IgrejaPro. Posso responder qualquer dúvida sobre a base de dados da igreja. O que você gostaria de saber hoje?',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [members, setMembers] = useState<any[]>([]);
  const [cells, setCells] = useState<any[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: mData } = await supabase.from('profiles').select('*');
        const { data: cData } = await supabase.from('cells').select('*');
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

  const processQuery = (query: string): string => {
    const q = query.toLowerCase();
    
    if (q.includes('quantos membros') || q.includes('total de membros')) {
      const active = members.filter(m => m.status !== 'Inativo').length;
      return `Atualmente, a igreja conta com um total de ${members.length} registros de membros cadastrados, sendo ${active} considerados membros ativos.`;
    }
    
    if (q.includes('quantos gcs') || q.includes('quantas celulas') || q.includes('total de gcs')) {
      return `Temos ${cells.length} Grupos de Crescimento (GCs) ativos espalhados pelas localidades mapeadas.`;
    }

    if (q.includes('famílias') && q.includes('arniqueira') || q.includes('arniqueira')) {
      const filtered = members.filter(m => m.address && m.address.toLowerCase().includes('arniqueira'));
      if (filtered.length === 0) {
        return `Não localizei nenhum membro que tenha o endereço explicitamente vinculado ao bairro Arniqueira na base atual.`;
      }
      const names = filtered.map(m => m.name).join(', ');
      return `Encontrei ${filtered.length} pessoas morando em Arniqueira: ${names}.`;
    }

    if (q.includes('aniversário') || q.includes('aniversariantes')) {
      return `No momento, os aniversariantes da semana podem ser consultados no módulo de Relatórios ou no painel principal do Dashboard.`;
    }

    if (q.includes('líderes') || q.includes('lideres de gc')) {
      const leaders = Array.from(new Set(cells.map(c => c.leader).filter(Boolean)));
      return `Os líderes cadastrados à frente das células são: ${leaders.join(', ')}.`;
    }

    return `Entendido. Como agente IA da base do IgrejaPro, verifiquei que o sistema possui ${members.length} registros e ${cells.length} GCs. Para responder com máxima precisão a cenários livres mais complexos, as chaves de processamento natural NLP podem ser expandidas através de chaves de API.`;
  };

  const handleSend = () => {
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

    setTimeout(() => {
      const botResponse = processQuery(userMsg.text);
      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: botResponse,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botMsg]);
      setIsTyping(false);
    }, 1500);
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
            <h1 className="text-lg font-bold text-gray-900">Consultor IA</h1>
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-amber-500" /> Alimentado pela base de dados local
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
              <p className="text-sm leading-relaxed whitespace-pre-line">{msg.text}</p>
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
          placeholder="Pergunte algo (Ex: Quantos membros temos? Quem mora em Arniqueira?)"
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
