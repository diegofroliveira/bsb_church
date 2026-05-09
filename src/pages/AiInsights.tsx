import React, { useState, useEffect } from 'react';
import { Sparkles, RefreshCw, AlertCircle, Eye, EyeOff, ShieldAlert, BookOpen, Heart, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface Insight {
  id: string;
  type: 'growth' | 'location' | 'alert' | 'pastoral';
  title: string;
  description: string;
  impact: string;
  actionLabel?: string;
}

export const AiInsights: React.FC = () => {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('church_gemini_api_key') || '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [cells, setCells] = useState<any[]>([]);
  const [customAiLoading, setCustomAiLoading] = useState(false);

  const generateHeuristicInsights = (membros: any[], celulas: any[]) => {
    const dynamicInsights: Insight[] = [];

    // 1. Oportunidades Reais de Multiplicação
    celulas.forEach(cell => {
      // Cruzando membros vinculados ao GC
      const membersInCell = membros.filter(m => 
        m.grupos_caseiros && 
        cell.grupo_caseiro && 
        m.grupos_caseiros.toLowerCase().includes(cell.grupo_caseiro.toLowerCase())
      ).length;

      if (membersInCell >= 10) {
        dynamicInsights.push({
          id: `cell-mult-${cell.id}`,
          type: 'growth',
          title: `Multiplicação Saudável: ${cell.grupo_caseiro}`,
          description: `O Grupo liderado por ${cell.lider || 'Líder'} alcançou ${membersInCell} membros ativos. É o momento ideal para treinar ${cell.auxiliar || 'um auxiliar'} visando a expansão do Corpo de Cristo.`,
          impact: 'Gera novos espaços de acolhimento e maturidade espiritual.',
          actionLabel: 'Iniciar Transição'
        });
      }
    });

    // 2. Cobertura Territorial e Alcance Missionário
    const neighborhoods: Record<string, any[]> = {};
    membros.forEach(m => {
      const b = m.bairro || m.address || m.endereco;
      if (b) {
        const place = b.toLowerCase().split(',')[0].trim();
        if (!neighborhoods[place]) neighborhoods[place] = [];
        neighborhoods[place].push(m);
      }
    });

    Object.entries(neighborhoods).forEach(([place, people]) => {
      if (people.length >= 5) {
        // Verifica se já existe célula cadastrada no bairro
        const hasCell = celulas.some(c => (c.bairro || c.grupo_caseiro || '').toLowerCase().includes(place));
        if (!hasCell) {
          const capitalized = place.charAt(0).toUpperCase() + place.slice(1);
          dynamicInsights.push({
            id: `loc-suggest-${place}`,
            type: 'location',
            title: `Nova Célula Estratégica: ${capitalized}`,
            description: `Mapeamos ${people.length} irmãos residentes na região de ${capitalized} que não possuem um GC local. Recomenda-se abrir uma frente de oração.`,
            impact: 'Fortalece a comunhão comunitária e evangelismo de proximidade.',
            actionLabel: 'Planejar Abertura'
          });
        }
      }
    });

    // 3. Trilhas de Discipulado e Consolidação
    const missingPhone = membros.filter(m => !m.telefone || m.telefone.trim() === '').length;
    if (missingPhone > 0) {
      dynamicInsights.push({
        id: 'pastoral-phone',
        type: 'alert',
        title: 'Atualização de Contatos Pastorais',
        description: `Detectamos ${missingPhone} membros sem telefone válido no sistema. O pastoreio ativo requer pontes seguras de comunicação.`,
        impact: 'Reduz o índice de afastamento e falhas de comunicação.',
        actionLabel: 'Ver Cadastros'
      });
    }

    // Se nenhum insight foi gerado
    if (dynamicInsights.length === 0) {
      dynamicInsights.push({
        id: 'standard-welcome',
        type: 'pastoral',
        title: 'Manutenção do Discipulado 1 a 1',
        description: 'Parabéns pela dedicação ao ensino das Escrituras! Continue incentivando as duplas de discipulado.',
        impact: 'Consolidação contínua da Palavra de Cristo.'
      });
    }

    setInsights(dynamicInsights);
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const { data: mData } = await supabase.from('membros').select('*');
      const { data: cData } = await supabase.from('celulas').select('*');
      if (mData) setMembers(mData);
      if (cData) setCells(cData);

      generateHeuristicInsights(mData || [], cData || []);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const generateGeminiInsights = async () => {
    if (!apiKey.trim()) return;
    setCustomAiLoading(true);
    try {
      localStorage.setItem('church_gemini_api_key', apiKey.trim());
      
      const genAI = new GoogleGenerativeAI(apiKey.trim());
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const statsPrompt = `
        Você é um Pastor e Especialista em Crescimento de Igrejas (Igreja do Corpo de Cristo).
        Com base nos seguintes dados estatísticos da congregação:
        - Total de Membros Cadastrados: ${members.length}
        - Total de Grupos de Crescimento/Células: ${cells.length}
        - Células Cadastradas: ${cells.map(c => c.grupo_caseiro).join(', ')}

        Gere 4 oportunidades estratégicas focadas no crescimento espiritual, multiplicação e consolidação com base na Palavra de Cristo.
        Retorne estritamente um JSON no formato de array compatível com o seguinte tipo:
        interface Insight {
          id: string;
          type: 'growth' | 'location' | 'alert' | 'pastoral';
          title: string;
          description: string;
          impact: string;
          actionLabel?: string;
        }
        Não inclua markdown \`\`\`json ou texto introdutório. Apenas o array JSON.
      `;

      const response = await model.generateContent(statsPrompt);
      const rawText = response.response.text();
      
      // Limpar possíveis blocos markdown que o modelo insira
      const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      if (Array.isArray(parsed)) {
        setInsights(parsed);
      }
    } catch (error) {
      console.error('Gemini error:', error);
      alert('Erro ao consultar o Gemini Flash. Verifique sua chave de API.');
    } finally {
      setCustomAiLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getTypeStyle = (type: string) => {
    switch (type) {
      case 'growth': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'location': return 'bg-blue-50 text-blue-600 border-blue-100';
      case 'alert': return 'bg-red-50 text-red-600 border-red-100';
      default: return 'bg-purple-50 text-purple-600 border-purple-100';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-amber-500" /> Insights de Pastoreio IA
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Estratégias para expansão do Reino de Deus e cuidado integral do rebanho.
          </p>
        </div>
        
        {/* API KEY Input */}
        <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-xl border border-gray-200">
          <button onClick={() => setShowApiKey(!showApiKey)} className="p-2 text-gray-400 hover:text-gray-600">
            {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
          <input
            type={showApiKey ? 'text' : 'password'}
            placeholder="Chave API Gemini"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="bg-transparent border-none text-xs focus:outline-none w-48 text-gray-700"
          />
          <button
            onClick={generateGeminiInsights}
            disabled={!apiKey || customAiLoading}
            className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 flex items-center gap-1 transition-all"
          >
            {customAiLoading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <TrendingUp className="h-3 w-3" />}
            Ativar Gemini Flash
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(n => (
            <div key={n} className="h-44 bg-gray-100 animate-pulse rounded-2xl"></div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {insights.map((insight) => (
            <div
              key={insight.id}
              className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${getTypeStyle(insight.type)}`}>
                    {insight.type === 'growth' && 'Crescimento'}
                    {insight.type === 'location' && 'Missão Territorial'}
                    {insight.type === 'alert' && 'Atenção Pastoral'}
                    {insight.type === 'pastoral' && 'Cuidado'}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
                  {insight.type === 'growth' && <TrendingUp className="h-5 w-5 text-amber-500" />}
                  {insight.type === 'location' && <BookOpen className="h-5 w-5 text-blue-500" />}
                  {insight.type === 'alert' && <ShieldAlert className="h-5 w-5 text-red-500" />}
                  {insight.type === 'pastoral' && <Heart className="h-5 w-5 text-purple-500" />}
                  {insight.title}
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed mb-4">{insight.description}</p>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
                <div className="flex items-start gap-2 max-w-[70%]">
                  <AlertCircle className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
                  <span className="text-xs text-gray-500 italic">{insight.impact}</span>
                </div>
                {insight.actionLabel && (
                  <button className="px-3 py-2 bg-gray-50 hover:bg-primary-50 text-primary-600 hover:text-primary-700 font-semibold text-xs rounded-lg transition-colors border border-gray-100">
                    {insight.actionLabel}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
