import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Sparkles, Shield, Heart, Users, Compass, HelpCircle, 
  Flame, Mail, MessageSquare, AlertCircle, CheckCircle2, 
  Send, MapPin, UserCheck, Scroll, Star, Info
} from 'lucide-react';
import clsx from 'clsx';

// Types
interface Member {
  id: any;
  nome: string;
  tipo_de_pessoa?: string;
  grupos_caseiros?: string;
  status?: string;
  sexo?: string;
  bairro?: string;
  data_de_vinculo?: string | null;
  data_de_cadastro?: string | null;
}

interface Disciple {
  member: Member;
  apostolicName: string;
  role: string;
  description: string;
  counsel: string;
}

interface GiftCategory {
  name: string;
  description: string;
  icon: React.FC<any>;
  color: string;
  glow: string;
  biblicalRef: string;
}

export const LabCounsel: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // Route security & allowed modules
  const allowedModules = useMemo(() => {
    if (!user) return [];
    if (user.role === 'admin') {
      return ['Lab: Visão da Plenitude', 'Lab: Gestão de Visitas', 'Lab: Consultas & Estudos', 'Lab: Conselho Apostólico'];
    }
    try {
      const stored = localStorage.getItem('church_dynamic_roles');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed[user.role]) {
          return parsed[user.role].modules || [];
        }
      }
    } catch (_) {}
    
    if (user.role === 'pastor') {
      return ['Lab: Visão da Plenitude', 'Lab: Gestão de Visitas', 'Lab: Consultas & Estudos', 'Lab: Conselho Apostólico'];
    }
    return [];
  }, [user]);

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  
  // Interactive UI State
  const [counselMode, setCounselMode] = useState<'jesus' | 'paul'>('jesus');
  const [selectedDisciple, setSelectedDisciple] = useState<number | null>(null);
  const [letterFocus, setLetterFocus] = useState<'unity' | 'mission' | 'love'>('unity');
  const [isLetterSigned, setIsLetterSigned] = useState(false);
  const [isSending70, setIsSending70] = useState(false);
  const [missionProgress, setMissionProgress] = useState(0);
  const [showPaulCriteria, setShowPaulCriteria] = useState(false);

  useEffect(() => {
    supabase
      .from('membros')
      .select('id, nome, tipo_de_pessoa, grupos_caseiros, status, sexo, bairro, data_de_vinculo, data_de_cadastro')
      .limit(10000)
      .then(({ data, error }) => { 
        if (error) setFetchError(error.message);
        setMembers(data || []); 
        setLoading(false); 
      });
  }, []);

  const activeMembers = useMemo(() => 
    members.filter(m => m.status && m.status.trim().toUpperCase() === 'ATIVO'), 
    [members]
  );

  const totalGCs = useMemo(() => {
    const gcSet = new Set(activeMembers.map(m => m.grupos_caseiros).filter(Boolean));
    return gcSet.size;
  }, [activeMembers]);

  // Dynamic selection of the "12 Disciples"
  const theTwelve = useMemo<Disciple[]>(() => {
    if (activeMembers.length === 0) return [];
    
    // Prioritize leaders & pastors
    const pool = [...activeMembers].sort((a, b) => {
      const typeA = (a.tipo_de_pessoa || '').toUpperCase();
      const typeB = (b.tipo_de_pessoa || '').toUpperCase();
      
      const scoreA = typeA.includes('PASTOR') ? 3 : typeA.includes('LÍDER') ? 2 : 1;
      const scoreB = typeB.includes('PASTOR') ? 3 : typeB.includes('LÍDER') ? 2 : 1;
      
      return scoreB - scoreA;
    });

    const selectedMembers: Member[] = [];
    const usedGcs = new Set<string>();
    
    // Select 12 with diverse GCs and balanced genders if possible
    for (const m of pool) {
      if (selectedMembers.length >= 12) break;
      const gc = m.grupos_caseiros || '';
      
      if (!gc || !usedGcs.has(gc) || selectedMembers.length < 6) {
        selectedMembers.push(m);
        if (gc) usedGcs.add(gc);
      }
    }
    
    // Fill up to 12 if pool was small
    while (selectedMembers.length < 12 && pool.length > selectedMembers.length) {
      const next = pool.find(p => !selectedMembers.includes(p));
      if (next) selectedMembers.push(next);
      else break;
    }

    const rolesAndCounsel = [
      { apostolicName: 'Pedro (Simão)', role: 'Ação Ousada & Liderança da Frente', desc: 'Impulsivo, mas rocha fundamental. Aquele que fala primeiro e age com paixão.', counsel: '"Diego, incentive-o a canalizar seu ímpeto para pastorear as minhas ovelhas com paciência. A audácia dele abrirá novas portas, mas é a constância que as manterá abertas. Ensine-o a olhar para mim e não para o vento forte."' },
      { apostolicName: 'João', role: 'Guardião do Amor & Cuidado Profundo', desc: 'O discípulo amado. Foco em relacionamentos íntimos e lealdade inabalável.', counsel: '"Diego, apoie-se nele para manter o coração da igreja focado na essência: amar uns aos outros. Suas palavras curarão feridas e lembrarão a congregação de que quem não ama, não conhece a Deus."' },
      { apostolicName: 'Tiago', role: 'Coluna de Justiça & Zelo Doutrinário', desc: 'Pilar forte, obstinado e zeloso pela retidão e oração intercessória.', counsel: '"Diego, utilize sua firmeza para consolidar os fundamentos da fé. Ele lembra a todos de que a fé sem obras é morta. Cuide de seus joelhos de oração, pois eles sustentam o peso da igreja."' },
      { apostolicName: 'André', role: 'Conector Silencioso de Pessoas', desc: 'Aquele que traz outros a Jesus (suo irmão Pedro, o jovem dos pães). Foco no um-a-um.', counsel: '"Diego, dê espaço para o ministério discreto dele. Enquanto Pedro prega para multidões, André traz as pessoas pelos braços no secreto. Ele é a chave para a verdadeira acolhida no um-a-um."' },
      { apostolicName: 'Filipe', role: 'Planejador Pragmático & Racional', desc: 'Focado em números e logística ("Duzentos denários não bastariam"). Precisa ver para crer.', counsel: '"Diego, não despreze suas dúvidas de logística. Ele ajuda a igreja a calcular os custos. Mas desafie-o constantemente a ver o sobrenatural. Lembre-o de que cinco pães e dois peixes em minhas mãos alimentam milhares."' },
      { apostolicName: 'Bartolomeu (Natanael)', role: 'O Homem de Caráter Íntegro', desc: 'Sem falsidade ou hipocrisia. Amante da meditação na palavra (debaixo da figueira).', counsel: '"Diego, honre a sinceridade pura deste discípulo. Ele é um pilar de integridade moral que protege a congregação contra a superficialidade. Promova-o para aconselhar e guiar novos convertidos."' },
      { apostolicName: 'Mateus (Levi)', role: 'Organizador de Sistemas & Finanças', desc: 'Ex-cobrador de impostos. Habilidade com números, processos e documentação escrita.', counsel: '"Diego, use a mente organizada dele para estruturar a administração e as finanças da igreja com máxima transparência. O que o mundo via como ganância, eu redimi para ser um registro fiel da Graça."' },
      { apostolicName: 'Tomé', role: 'O Questionador Reflexivo', desc: 'Melancólico, analítico, busca verdades sólidas. Quer tocar nas feridas para crer.', counsel: '"Diego, acolha as dúvidas dele sem julgamento. Suas perguntas honestas trazem respostas profundas que fortalecem toda a igreja. Quando ele finalmente crê, seu compromisso é radical até a morte."' },
      { apostolicName: 'Tiago (Filho de Alfeu)', role: 'O Pacificador Silencioso', desc: 'Trabalhador dos bastidores, discreto mas fiel na rotina diária.', counsel: '"Diego, valorize a fidelidade silenciosa dele. Embora ele raramente apareça nos holofotes, o serviço diário dele é o cimento que mantém os tijolos da igreja unidos. A recompensa dele no céu é imensa."' },
      { apostolicName: 'Simão (O Zelote)', role: 'Ativista Apaixonado & Missionário', desc: 'Cheio de energia revolucionária, impulsiona causas sociais e evangelismo ativo.', counsel: '"Diego, canalize o fogo político e social dele para a revolução do Reino de Deus. Ele é excelente para mobilizar a igreja para fora das quatro paredes, alcançando os necessitados e marginalizados."' },
      { apostolicName: 'Judas Tadeu', role: 'O Questionador Espiritual', desc: 'Busca compreender as manifestações do Espírito no íntimo e no secreto.', counsel: '"Diego, incentive-o a guiar as pessoas na intimidade espiritual. Ele ajuda a igreja a não se tornar um show externo, mantendo as chamas da revelação íntima e da devoção acesas no altar do coração."' },
      { apostolicName: 'Matias', role: 'O Cooperador Fiel Substituto', desc: 'Aquele que esteve conosco o tempo todo no anonimato, preparado para assumir responsabilidades.', counsel: '"Diego, ele representa aqueles que servem fielmente sem cargos. Quando uma lacuna de liderança aparecer, olhe para ele. Ele está pronto porque seu coração sempre esteve na obra, não no título."' },
    ];

    return selectedMembers.map((m, idx) => ({
      member: m,
      apostolicName: rolesAndCounsel[idx]?.apostolicName || `Discípulo ${idx + 1}`,
      role: rolesAndCounsel[idx]?.role || 'Cooperador do Reino',
      desc: rolesAndCounsel[idx]?.desc || 'Membro dedicado chamado ao serviço.',
      counsel: rolesAndCounsel[idx]?.counsel || '"Diego, cuide desta vida, pois ela é preciosa no meu Reino. Capacite-a para servir com amor."'
    }));
  }, [activeMembers]);

  // Pair up the "70 Missionaries" (35 pairs) dynamically
  const missionaryPairs = useMemo(() => {
    const pairs: { m1: Member; m2: Member; route: string; region: string }[] = [];
    if (activeMembers.length < 2) return [];

    const activeList = [...activeMembers];
    const boys = activeList.filter(m => m.sexo && m.sexo.toUpperCase() === 'MASCULINO');
    const girls = activeList.filter(m => m.sexo && m.sexo.toUpperCase() === 'FEMININO');

    const matchAndPair = (pool: Member[]) => {
      while (pool.length >= 2 && pairs.length < 35) {
        const m1 = pool.shift()!;
        // Find someone from a different GC or neighborhood to pair up for diversity, or just next
        const idx2 = pool.findIndex(m => m.grupos_caseiros !== m1.grupos_caseiros);
        const m2 = pool.splice(idx2 >= 0 ? idx2 : 0, 1)[0];
        
        const region = m1.bairro || m2.bairro || 'Região Metropolitana';
        const route = `Rota de ${m1.nome.split(' ')[0]} & ${m2.nome.split(' ')[0]}`;
        pairs.push({ m1, m2, route, region });
      }
    };

    // Pair boys together and girls together (biblical pattern of same-sex companion teams)
    matchAndPair(boys);
    matchAndPair(girls);
    
    // Remaining fallback
    const remaining = [...boys, ...girls];
    matchAndPair(remaining);

    return pairs;
  }, [activeMembers]);

  // Spiritual Gifts distribution (Deterministic categorization based on member name hashes)
  const spiritualGifts = useMemo(() => {
    const categories: GiftCategory[] = [
      { name: 'Profecia', description: 'Revelar a vontade divina, confrontar com a verdade e consolar.', icon: Flame, color: 'from-orange-500 to-amber-600', glow: 'shadow-orange-500/20 text-orange-600', biblicalRef: 'Rom 12:6' },
      { name: 'Serviço / Ministério', description: 'Trabalho prático, suporte operacional e auxílio nos bastidores.', icon: UserCheck, color: 'from-blue-500 to-indigo-600', glow: 'shadow-blue-500/20 text-blue-600', biblicalRef: 'Rom 12:7' },
      { name: 'Ensino', description: 'Explicar a verdade das Escrituras de forma clara e estruturada.', icon: Scroll, color: 'from-emerald-500 to-teal-600', glow: 'shadow-emerald-500/20 text-emerald-600', biblicalRef: 'Rom 12:7' },
      { name: 'Encorajamento / Exortação', description: 'Motivar a fé, aconselhar e consolar corações aflitos.', icon: MessageSquare, color: 'from-amber-400 to-yellow-600', glow: 'shadow-yellow-500/20 text-yellow-600', biblicalRef: 'Rom 12:8' },
      { name: 'Contribuição / Generosidade', description: 'Financiar o Reino com alegria, desprendimento e visão.', icon: Heart, color: 'from-rose-500 to-red-600', glow: 'shadow-rose-500/20 text-rose-600', biblicalRef: 'Rom 12:8' },
      { name: 'Liderança / Governo', description: 'Dirigir com diligência, guiar pessoas e organizar o corpo.', icon: Compass, color: 'from-violet-500 to-purple-600', glow: 'shadow-violet-500/20 text-violet-600', biblicalRef: 'Rom 12:8' },
      { name: 'Misericórdia', description: 'Empatia profunda, cuidar de doentes, fracos e necessitados.', icon: Star, color: 'from-pink-400 to-rose-500', glow: 'shadow-pink-500/20 text-pink-500', biblicalRef: 'Rom 12:8' },
    ];

    const distribution = categories.map(cat => ({ ...cat, count: 0, members: [] as Member[] }));

    activeMembers.forEach((m, idx) => {
      // Deterministic hash based on name characters
      let hash = 0;
      for (let i = 0; i < m.nome.length; i++) {
        hash = m.nome.charCodeAt(i) + ((hash << 5) - hash);
      }
      const catIdx = Math.abs(hash) % categories.length;
      distribution[catIdx].count++;
      if (distribution[catIdx].members.length < 15) {
        distribution[catIdx].members.push(m);
      }
    });

    return distribution;
  }, [activeMembers]);

  // Interactive 70 mission simulation
  const handleSend70 = () => {
    if (isSending70) return;
    setIsSending70(true);
    setMissionProgress(0);
    
    const interval = setInterval(() => {
      setMissionProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => setIsSending70(false), 2000);
          return 100;
        }
        return prev + 5;
      });
    }, 150);
  };

  // Dynamic Paul's letter text
  const paulLetter = useMemo(() => {
    const activeCount = activeMembers.length;
    const femaleCount = activeMembers.filter(m => m.sexo && m.sexo.toUpperCase() === 'FEMININO').length;
    const maleCount = activeMembers.filter(m => m.sexo && m.sexo.toUpperCase() === 'MASCULINO').length;
    const femalePercentage = activeCount > 0 ? Math.round((femaleCount / activeCount) * 100) : 0;
    
    // Pick three leaders to sign as co-senders
    const leaders = activeMembers.filter(m => {
      const type = (m.tipo_de_pessoa || '').toUpperCase();
      return type.includes('PASTOR') || type.includes('LÍDER');
    }).slice(0, 3).map(m => m.nome.split(' ')[0]).join(', ');

    const coSenders = leaders ? `, junto com ${leaders},` : '';

    if (letterFocus === 'unity') {
      return {
        salutation: `Paulo, apóstolo de Cristo Jesus pela vontade de Deus, aos santos e fiéis em Cristo Jesus que se reúnem em Brasília na congregação da BSB Church. Graça e paz vos sejam dadas da parte de Deus, nosso Pai, e do Senhor Jesus Cristo.`,
        body: `Dou graças ao meu Deus sempre que me lembro de vós, fazendo menção de vossas ${activeCount} almas ativas em minhas orações, sabendo que estais distribuídos em ${totalGCs} igrejas nos lares, as quais são como faróis na escuridão da vossa cidade.

Rogo-vos, irmãos, pelo nome de nosso Senhor Jesus Cristo, que faleis todos uma mesma coisa e que não haja entre vós divisões; antes, sejais inteiramente unidos, em um mesmo sentido e em um mesmo parecer. Ouvi dizer que há murmurações e comparações sobre quem é o maior entre os líderes, ou sobre quais grupos caseiros são mais espirituais. 

Acaso Cristo está dividido? Ou foi Pedro ou Paulo crucificado por vós? Lembrai-vos de que o corpo é um, embora tenha muitos membros, e todos os membros, sendo muitos, constituem um só corpo. As mulheres, que representam expressivos ${femalePercentage}% da vossa congregação, servem com dedicação santa; e os homens andem com dignidade. Que nenhum de vós se glorie na sabedoria humana ou em cargos, pois a nossa glória é a cruz de Cristo.`,
        benediction: `A graça do Senhor Jesus Cristo, e o amor de Deus, e a comunhão do Espírito Santo sejam com todos vós. Saudai-vos uns aos outros com ósculo santo. O meu amor seja com todos vós em Cristo Jesus. Amém.`
      };
    } else if (letterFocus === 'mission') {
      return {
        salutation: `Paulo, prisioneiro de Cristo Jesus, e o irmão Timóteo, ao amado Diego, nosso cooperador, e à igreja de Deus que está em sua casa e em toda a BSB Church. Graça a vós e paz de Deus, nosso Pai.`,
        body: `Não cesso de dar graças por vós, lembrando-me de vós nas minhas orações. Tenho acompanhado o vosso progresso geográfico, espalhado por bairros e localidades. Entretanto, amados, exorto-vos a não ficardes confortáveis dentro dos vossos templos e das vossas belas reuniões de GC. 

Como ouvirão se não houver quem pregue? E como pregarão se não forem enviados? Vejo que tendes uma seara abundante de ${activeCount} vidas, mas os trabalhadores ainda são poucos diante do tamanho do desafio em vosso Planalto Central. 

Ordeno-vos no Senhor: enviai os vossos membros de dois em dois, assim como Jesus instruiu. Que as vossas reuniões nos lares não sejam apenas depósitos de amigos, mas bases de lançamento missionário! Ide aos bairros mais distantes, proclamando que o Reino de Deus está próximo. E que a vossa luz brilhe de tal maneira diante dos homens que eles vejam as vossas boas obras e glorifiquem ao Pai.`,
        benediction: `O Deus de paz, que pelo sangue da aliança eterna tornou a trazer dentre os mortos a nosso Senhor Jesus, vos aperfeiçoe em todo o bem. A graça seja com todos vós. Amém.`
      };
    } else {
      return {
        salutation: `Paulo, servo de Deus e apóstolo de Jesus Cristo, segundo a fé dos eleitos de Deus, aos irmãos amados que compõem a BSB Church. Graça, misericórdia e paz da parte de Deus Pai e de Cristo Jesus, nosso Salvador.`,
        body: `Se eu falasse as línguas dos homens e dos anjos, e se conhecesse todas as métricas e relatórios do Supabase, mas não tivesse amor, seria como o bronze que soa ou como o címbalo que retine. E ainda que distribuísse toda a minha dedicação aos ${totalGCs} grupos caseiros, se não tivesse amor, nada disso me aproveitaria.

O amor é sofredor, é benigno; o amor não é invejoso; o amor não se trata com leviandade, não se ensoberbece. Vejo em vossos relatórios que alguns têm caminhado isolados, e outros têm sido esquecidos no meio das vossas rotinas administrativas. Diego, meu filho na fé, exorta a igreja a focar na misericórdia. 

O amor não busca os seus próprios interesses, não se irrita, não suspeita mal; tudo sofre, tudo crê, tudo espera, tudo suporta. A teologia de vocês é correta, mas se não houver o abraço ao necessitado, a reconciliação familiar e o perdão mútuo, o vosso testemunho se tornará vazio. Permaneçam no amor de Cristo.`,
        benediction: `A graça de nosso Senhor Jesus Cristo seja com o vosso espírito, irmãos. Guardai-vos na caridade que une perfeitamente todas as coisas. Amém.`
      };
    }
  }, [activeMembers, totalGCs, letterFocus]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center space-y-3">
          <Compass className="h-10 w-10 animate-spin text-amber-500 mx-auto" />
          <p className="text-amber-600/80 text-xs font-bold uppercase tracking-wider animate-pulse">Acessando Conselho dos Apóstolos...</p>
        </div>
      </div>
    );
  }

  // Verification if module is allowed
  if (allowedModules.length > 0 && !allowedModules.includes('Lab: Conselho Apostólico') && user?.role !== 'admin') {
    return (
      <div className="p-8 text-center bg-red-50 border border-red-200 rounded-2xl max-w-md mx-auto mt-12">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-red-900 mb-2">Acesso Restrito</h3>
        <p className="text-sm text-red-600 mb-4">Seu perfil de acesso atual não possui permissão para visualizar este módulo de curiosidade do laboratório.</p>
        <button onClick={() => navigate('/')} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-sm font-bold">Voltar ao Dashboard</button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700 max-w-7xl mx-auto pb-20">
      
      {/* Dynamic Tabs Navigation inside Lab Pages */}
      <div className="flex flex-wrap gap-2 border-b border-slate-100 pb-1">
        {[
          { path: '/lab/vision', label: '🏛️ Visão de Efésios 4', id: 'Lab: Visão da Plenitude' },
          { path: '/lab/visits', label: '🏠 Gestão de Visitas', id: 'Lab: Gestão de Visitas' },
          { path: '/lab/queries', label: '📊 Consultas & Estudos', id: 'Lab: Consultas & Estudos' },
          { path: '/lab/counsel', label: '🕊️ Conselho Apostólico', id: 'Lab: Conselho Apostólico' }
        ].filter(tab => user?.role === 'admin' || allowedModules.includes(tab.id)).map((tab) => {
          const isActive = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={clsx(
                "px-4 py-2 text-xs font-black uppercase tracking-wider rounded-t-xl transition-all border-b-2 cursor-pointer",
                isActive 
                  ? "bg-slate-900 text-white border-amber-500" 
                  : "bg-slate-50 text-slate-500 border-transparent hover:bg-slate-100/80 hover:text-slate-700"
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* HEADER CARD */}
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950 p-8 text-white shadow-xl border border-amber-500/10">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500 rounded-full translate-x-1/3 -translate-y-1/3 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-orange-600 rounded-full -translate-x-1/3 translate-y-1/3 blur-3xl" />
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 bg-amber-500/10 text-amber-300 px-3 py-1 rounded-full text-xs font-bold mb-2 border border-amber-500/20 backdrop-blur-md">
              <Sparkles className="h-3 w-3 text-amber-400 animate-spin" style={{ animationDuration: '4s' }} /> LAB MODE · CURIOSIDADE BÍBLICA
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              O Conselho dos Apóstolos
            </h1>
            <p className="text-slate-300 text-sm max-w-2xl">
              E se Jesus e Paulo estivessem diante da nossa congregação? Uma análise reflexiva e puramente teológica estruturada sobre os dados reais da BSB Church.
            </p>
          </div>
          
          <div className="flex bg-slate-900/60 p-1.5 rounded-2xl border border-slate-800/80 shrink-0 self-start md:self-center">
            <button 
              onClick={() => setCounselMode('jesus')}
              className={clsx(
                "px-5 py-2.5 rounded-xl font-extrabold text-xs uppercase tracking-wider transition-all",
                counselMode === 'jesus' ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/10" : "text-slate-400 hover:text-slate-200"
              )}
            >
              A Visão de Jesus
            </button>
            <button 
              onClick={() => setCounselMode('paul')}
              className={clsx(
                "px-5 py-2.5 rounded-xl font-extrabold text-xs uppercase tracking-wider transition-all",
                counselMode === 'paul' ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/10" : "text-slate-400 hover:text-slate-200"
              )}
            >
              A Visão de Paulo
            </button>
          </div>
        </div>
      </header>

      {counselMode === 'jesus' ? (
        /* JESUS MODE SCREEN */
        <div className="space-y-8 animate-in fade-in duration-500">
          
          {/* Section 1: The Twelve Disciples */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-amber-50 rounded-xl text-amber-600"><Users className="h-6 w-6" /></div>
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">Os Doze Escolhidos</h2>
                <p className="text-xs text-slate-500">Jesus selecionando 12 líderes para andar de perto, com base no perfil ativo e representatividade de GCs.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Disciple List */}
              <div className="md:col-span-1 border-r border-slate-100 pr-0 md:pr-6 space-y-2 max-h-[460px] overflow-y-auto">
                {theTwelve.map((disc, idx) => {
                  const isSelected = selectedDisciple === idx;
                  const initials = disc.member.nome.split(' ').map(n => n[0]).slice(0, 2).join('');
                  return (
                    <div 
                      key={disc.member.id}
                      onClick={() => setSelectedDisciple(idx)}
                      className={clsx(
                        "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all",
                        isSelected 
                          ? "border-amber-500 bg-amber-50/20 ring-1 ring-amber-100" 
                          : "border-slate-100 hover:border-slate-200 bg-slate-50/10"
                      )}
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-black text-xs shadow-inner">
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black text-slate-900 leading-tight">{disc.apostolicName}</p>
                        <p className="text-[10px] text-slate-400 truncate">{disc.member.nome}</p>
                        <p className="text-[9px] text-amber-600 font-bold mt-0.5">{disc.role.split(' & ')[0]}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Disciple Detail / Counsel */}
              <div className="md:col-span-2 bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-2xl border border-slate-100 p-6 flex flex-col justify-between min-h-[380px]">
                {selectedDisciple !== null ? (
                  <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <span className="text-[9px] font-black uppercase bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
                          Discípulo Escolhido
                        </span>
                        <h3 className="text-2xl font-black text-slate-950 mt-1">{theTwelve[selectedDisciple].apostolicName}</h3>
                        <p className="text-xs text-slate-400">Representado na BSB por: <strong className="text-slate-700">{theTwelve[selectedDisciple].member.nome}</strong></p>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-slate-400 block">Atribuição Apostólica</span>
                        <span className="text-xs font-black text-amber-600 block">{theTwelve[selectedDisciple].role}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1"><Info className="w-3.5 h-3.5" /> Perfil Espiritual</h4>
                      <p className="text-sm text-slate-600 leading-relaxed bg-white border border-slate-100 rounded-xl p-3.5 shadow-sm">
                        {theTwelve[selectedDisciple].desc}
                      </p>
                    </div>

                    <div className="space-y-2 bg-gradient-to-br from-amber-500/5 to-orange-500/5 border border-amber-500/10 rounded-2xl p-4 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-xl pointer-events-none" />
                      <h4 className="text-xs font-extrabold text-amber-800 uppercase tracking-wider flex items-center gap-1.5"><Heart className="w-3.5 h-3.5 text-amber-600 fill-amber-100" /> O Conselho de Jesus a Diego</h4>
                      <p className="text-sm text-amber-950 italic leading-relaxed font-serif pt-1">
                        {theTwelve[selectedDisciple].counsel}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-3">
                    <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center border border-amber-100 text-amber-600 animate-bounce">
                      <Users className="w-8 h-8" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-lg">Os Doze da BSB Church</h4>
                      <p className="text-xs text-slate-400 max-w-sm mt-1">Selecione um discípulo na lista ao lado para ler o conselho e atribuição de chamado que Jesus confia a esta liderança.</p>
                    </div>
                  </div>
                )}
                
                {selectedDisciple !== null && (
                  <div className="border-t border-slate-200/80 pt-4 mt-6 flex justify-between items-center text-xs text-slate-400 font-semibold">
                    <span>GC de origem: <strong className="text-slate-600">{theTwelve[selectedDisciple].member.grupos_caseiros || 'Geral'}</strong></span>
                    <span>Perfil ativo em BSB Church</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Sending the Seventy Two-by-Two */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-teal-50 rounded-xl text-teal-600"><Compass className="h-6 w-6" /></div>
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-900">O Envio dos 70</h2>
                    <p className="text-xs text-slate-500">Lucas 10:1 — De dois em dois para as vilas.</p>
                  </div>
                </div>
                
                <p className="text-xs text-slate-500 leading-relaxed">
                  Para alcançar a colheita em Brasília, Jesus não envia soldados solitários. Ele organiza duplas de companheirismo missionário baseadas em complementaridade.
                  <br/><br/>
                  Identificamos **{missionaryPairs.length} duplas missionárias** na BSB Church, prontas para serem enviadas às suas respectivas regiões administrativas.
                </p>

                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 space-y-2">
                  <div className="flex justify-between text-xs font-bold text-slate-500">
                    <span>Duplas Prontas</span>
                    <span className="text-teal-600">{missionaryPairs.length} equipes</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold text-slate-500">
                    <span>Membros Enviados</span>
                    <span className="text-teal-600">{missionaryPairs.length * 2} missionários</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100">
                <button 
                  onClick={handleSend70}
                  disabled={isSending70 || missionaryPairs.length === 0}
                  className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white rounded-xl py-3 font-black text-xs uppercase tracking-wider shadow-md hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Send className={clsx("w-4 h-4", isSending70 && "animate-ping")} />
                  {isSending70 ? `Enviando Duplas (${missionProgress}%)` : 'Simular Envio de 2 em 2'}
                </button>
              </div>
            </div>

            <div className="lg:col-span-2 bg-slate-950 rounded-3xl p-6 text-white border border-slate-800 relative overflow-hidden flex flex-col justify-between min-h-[380px]">
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-0 left-0 w-80 h-80 bg-teal-500 rounded-full blur-3xl" />
                <div className="absolute bottom-0 right-0 w-64 h-64 bg-cyan-600 rounded-full blur-3xl" />
              </div>
              
              <div className="relative z-10 flex items-center justify-between border-b border-slate-800/80 pb-4 mb-4">
                <h3 className="font-extrabold text-sm uppercase tracking-wider flex items-center gap-2 text-teal-400">
                  <MapPin className="w-4 h-4 animate-bounce" /> Painel de Despacho Missionário
                </h3>
                <span className="text-[10px] font-black uppercase text-slate-500 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-full">
                  Status: {isSending70 ? 'EM MISSÃO' : 'PRONTO'}
                </span>
              </div>

              {isSending70 ? (
                <div className="relative z-10 flex-1 flex flex-col justify-center items-center text-center p-8 space-y-4">
                  <div className="w-20 h-20 rounded-full bg-teal-500/10 border border-teal-500/30 flex items-center justify-center animate-pulse">
                    <Compass className="w-10 h-10 text-teal-400 animate-spin" style={{ animationDuration: '6s' }} />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-black text-lg text-teal-300">Evangelho nos Lares de Brasília</h4>
                    <p className="text-xs text-slate-400 max-w-sm">"Curai os enfermos que nela houver e dizei-lhes: É chegado a vós o Reino de Deus."</p>
                  </div>
                  <div className="w-full max-w-xs bg-slate-900 rounded-full h-2 border border-slate-800 overflow-hidden">
                    <div className="bg-teal-400 h-full rounded-full transition-all duration-150" style={{ width: `${missionProgress}%` }} />
                  </div>
                </div>
              ) : (
                <div className="relative z-10 flex-1 overflow-y-auto max-h-[300px] divide-y divide-slate-900/50 pr-2">
                  {missionaryPairs.slice(0, 8).map((pair, idx) => (
                    <div key={idx} className="py-3 flex items-center justify-between group hover:bg-slate-900/20 px-2 rounded-xl transition-all">
                      <div className="flex items-center gap-3">
                        <span className="text-[9.5px] font-black text-slate-600 bg-slate-900 border border-slate-850 px-1.5 py-0.5 rounded">
                          #{(idx + 1).toString().padStart(2, '0')}
                        </span>
                        <div>
                          <div className="text-xs font-bold text-slate-200">
                            {pair.m1.nome.split(' ')[0]} & {pair.m2.nome.split(' ')[0]}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate max-w-[200px]">{pair.m1.nome} · {pair.m2.nome}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-extrabold text-teal-400">{pair.region}</div>
                        <div className="text-[9px] text-slate-500">{pair.route}</div>
                      </div>
                    </div>
                  ))}
                  {missionaryPairs.length === 0 && (
                    <div className="h-full flex items-center justify-center text-center text-xs text-slate-500 italic p-12">
                      Carregue os dados do banco para simular o envio missionário.
                    </div>
                  )}
                </div>
              )}
              
              <div className="relative z-10 border-t border-slate-800/80 pt-3 mt-4 text-[10px] text-slate-500 flex justify-between">
                <span>Total de duplas possíveis: {missionaryPairs.length}</span>
                <span>*Os pares foram selecionados por sexo complementar e diversidade de GCs</span>
              </div>
            </div>
          </div>

        </div>
      ) : (
        /* PAUL MODE SCREEN */
        <div className="space-y-8 animate-in fade-in duration-500">
          
          {/* Section 1: Spiritual Gifts in Rom 12 */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-violet-50 rounded-xl text-violet-600"><Flame className="h-6 w-6" /></div>
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">A Distribuição de Dons (Romanos 12)</h2>
                <p className="text-xs text-slate-500">Paulo organizando o corpo de BSB Church com base na diversidade de talentos e carismas espirituais.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
              {spiritualGifts.map((gift) => {
                const Icon = gift.icon;
                return (
                  <div 
                    key={gift.name}
                    className="flex flex-col justify-between p-4 rounded-xl border border-slate-100 hover:border-slate-200 bg-slate-50/10 hover:shadow-md transition-all h-[240px]"
                  >
                    <div className="space-y-2">
                      <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${gift.color} flex items-center justify-center text-white shadow-sm`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-xs font-black text-slate-900 leading-tight">{gift.name}</h3>
                        <span className="text-[9px] font-bold text-slate-400">{gift.biblicalRef}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-tight">{gift.description}</p>
                    </div>
                    
                    <div className="pt-2 border-t border-slate-100 flex items-end justify-between">
                      <div className="text-right">
                        <span className="text-[9px] font-bold text-slate-400 block uppercase">Ativos</span>
                        <span className="text-xl font-black text-slate-800">{gift.count}</span>
                      </div>
                      
                      {/* Popover/Indicator of first member */}
                      {gift.members.length > 0 && (
                        <div className="text-[9px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded truncate max-w-[70px]">
                          {gift.members[0].nome.split(' ')[0]}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: Paul's Custom Epistle to BSB Church */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Control Column */}
            <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col justify-between">
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-amber-50 rounded-xl text-amber-600"><Scroll className="h-6 w-6" /></div>
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-900">Carta de Paulo</h2>
                    <p className="text-xs text-slate-500">Injete dados na epístola apostólica do século I.</p>
                  </div>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed">
                  Selecione o foco da carta que o Apóstolo Paulo escreveria especificamente para as circunstâncias da vossa congregação neste momento.
                </p>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 block">Foco Teológico</label>
                  <button 
                    onClick={() => { setLetterFocus('unity'); setIsLetterSigned(false); }}
                    className={clsx(
                      "w-full text-left p-3 rounded-xl border font-bold text-xs transition-all flex items-center justify-between",
                      letterFocus === 'unity' ? "border-amber-500 bg-amber-50/20 text-amber-900" : "border-slate-100 hover:bg-slate-50 text-slate-600"
                    )}
                  >
                    <span>🛡️ Unidade & Contra Divisões</span>
                    {letterFocus === 'unity' && <CheckCircle2 className="w-4 h-4 text-amber-600" />}
                  </button>
                  <button 
                    onClick={() => { setLetterFocus('mission'); setIsLetterSigned(false); }}
                    className={clsx(
                      "w-full text-left p-3 rounded-xl border font-bold text-xs transition-all flex items-center justify-between",
                      letterFocus === 'mission' ? "border-amber-500 bg-amber-50/20 text-amber-900" : "border-slate-100 hover:bg-slate-50 text-slate-600"
                    )}
                  >
                    <span>🌍 Missão de 2 em 2 & Expansão</span>
                    {letterFocus === 'mission' && <CheckCircle2 className="w-4 h-4 text-amber-600" />}
                  </button>
                  <button 
                    onClick={() => { setLetterFocus('love'); setIsLetterSigned(false); }}
                    className={clsx(
                      "w-full text-left p-3 rounded-xl border font-bold text-xs transition-all flex items-center justify-between",
                      letterFocus === 'love' ? "border-amber-500 bg-amber-50/20 text-amber-900" : "border-slate-100 hover:bg-slate-50 text-slate-600"
                    )}
                  >
                    <span>💖 Amor Verdadeiro & Relações</span>
                    {letterFocus === 'love' && <CheckCircle2 className="w-4 h-4 text-amber-600" />}
                  </button>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 space-y-2">
                <button 
                  onClick={() => setIsLetterSigned(prev => !prev)}
                  className={clsx(
                    "w-full py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all border flex items-center justify-center gap-2",
                    isLetterSigned 
                      ? "bg-slate-100 border-slate-200 text-slate-600" 
                      : "bg-slate-900 border-slate-900 text-white hover:bg-slate-850 shadow-md"
                  )}
                >
                  <Mail className="w-4 h-4" />
                  {isLetterSigned ? 'Remover Selo' : 'Selar Carta com Ósculo'}
                </button>
              </div>
            </div>

            {/* Interactive Papyrus Scroll */}
            <div className="lg:col-span-2 bg-[#FAF6EE] rounded-3xl p-8 border border-[#E9DFCB] shadow-lg text-[#3C3224] relative overflow-hidden flex flex-col justify-between min-h-[460px]">
              {/* Papyrus texture overlay */}
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.4)_0%,rgba(0,0,0,0.05)_100%)] pointer-events-none" />
              
              <div className="relative z-10 border-b border-[#E3D6BC] pb-4 mb-6 flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-black uppercase text-[#88785E] tracking-widest block">EPÍSTOLA APOSTÓLICA</span>
                  <h3 className="font-extrabold text-lg font-serif">Aos Santos de BSB Church</h3>
                </div>
                <div className="text-right">
                  <span className="text-[9px] font-bold text-[#88785E] block">AUTOR</span>
                  <span className="text-xs font-black text-[#5C4D38] block flex items-center gap-1"><Scroll className="w-3.5 h-3.5" /> Paulo Apóstolo</span>
                </div>
              </div>

              <div className="relative z-10 flex-1 font-serif text-sm md:text-base leading-relaxed space-y-4 max-h-[380px] overflow-y-auto pr-2 scrollbar-thin">
                <p className="font-bold border-l-2 border-[#D9C4A0] pl-3 italic text-xs md:text-sm text-[#5C4D38]">
                  {paulLetter.salutation}
                </p>
                <div className="whitespace-pre-line text-xs md:text-sm text-[#4E412E]">
                  {paulLetter.body}
                </div>
                <p className="font-bold border-t border-[#E3D6BC] pt-3 italic text-xs md:text-sm text-[#5C4D38]">
                  {paulLetter.benediction}
                </p>
              </div>

              {isLetterSigned && (
                <div className="relative z-20 mt-6 pt-4 border-t border-[#E3D6BC] flex justify-end animate-in zoom-in-95 duration-300">
                  <div className="w-24 h-24 rounded-full border-4 border-[#C83E2D]/40 flex items-center justify-center text-[#C83E2D] font-serif font-black text-center text-[10px] leading-tight rotate-12 bg-white/40 shadow-inner">
                    SELO APOSTÓLICO
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Leader character assessment list */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-50 rounded-xl text-indigo-650"><UserCheck className="h-6 w-6" /></div>
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">Requisitos de Presbíteros & Diáconos (1 Timóteo 3)</h2>
                  <p className="text-xs text-slate-500">O lembrete de Paulo de que a estrutura e as estatísticas nunca devem preceder o caráter moral.</p>
                </div>
              </div>
              <button 
                onClick={() => setShowPaulCriteria(!showPaulCriteria)}
                className="text-xs font-black uppercase text-indigo-650 hover:text-indigo-800 border border-indigo-100 bg-indigo-50/20 px-3 py-1.5 rounded-xl transition-all"
              >
                {showPaulCriteria ? 'Esconder Lista' : 'Ver Requisitos'}
              </button>
            </div>

            {showPaulCriteria && (
              <div className="mt-6 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-300">
                <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                  <h3 className="font-extrabold text-xs text-indigo-900 uppercase">Qualidades de Caráter Exigidas</h3>
                  <ul className="text-xs text-slate-600 space-y-2 leading-relaxed">
                    <li className="flex items-center gap-2">✅ Irrepreensível, marido de uma só mulher</li>
                    <li className="flex items-center gap-2">✅ Vigilante, sóbrio, honesto, hospitaleiro</li>
                    <li className="flex items-center gap-2">✅ Apto para ensinar (disposição didática)</li>
                    <li className="flex items-center gap-2">✅ Não dado ao vinho, nem espancador, mas moderado</li>
                    <li className="flex items-center gap-2">✅ Que governe bem sua própria casa e crie filhos com respeito</li>
                  </ul>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                  <h3 className="font-extrabold text-xs text-indigo-900 uppercase">O Conselho Teológico de Paulo</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    "Diego, ao analisar os dados da BSB Church e buscar novos deacons ou presbíteros, lembre-se de que o sistema de gerenciamento de perfil e os relatórios de atividade revelam apenas o fazer.
                    <br/><br/>
                    O Espírito Santo adverte que o **ser** (caráter provado sob pressão e docilidade na intimidade de seu lar) deve ser a única bússola para o governo da casa de Deus."
                  </p>
                </div>
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
};
