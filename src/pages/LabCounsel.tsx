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
  estado_civil?: string;
  esposo_a?: string;
  e_dizimista?: string;
  nascimento?: string | null;
  setor_eclesiastico?: string | null;
  setor_residencial?: string | null;
}

interface Disciple {
  member: Member;
  apostolicName: string;
  role: string;
  desc: string;
  counsel: string;
}

// Age calculator helper relative to system base date 2026-05-30
const getAge = (birthdayStr: string | null | undefined): number | null => {
  if (!birthdayStr) return null;
  try {
    const birthDate = new Date(birthdayStr);
    const currentDate = new Date('2026-05-30');
    let age = currentDate.getFullYear() - birthDate.getFullYear();
    const m = currentDate.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && currentDate.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  } catch (_) {
    return null;
  }
};

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
  const [selectedGift, setSelectedGift] = useState<number>(0);
  const [letterFocus, setLetterFocus] = useState<'unity' | 'mission' | 'love'>('unity');
  const [isLetterSigned, setIsLetterSigned] = useState(false);
  const [isSending70, setIsSending70] = useState(false);
  const [missionProgress, setMissionProgress] = useState(0);
  const [showPaulCriteria, setShowPaulCriteria] = useState(false);

  useEffect(() => {
    supabase
      .from('membros')
      .select('id, nome, tipo_de_pessoa, grupos_caseiros, status, sexo, bairro, data_de_vinculo, data_de_cadastro, estado_civil, esposo_a, e_dizimista, nascimento, setor_eclesiastico, setor_residencial')
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
    
    // Sort and prioritize real leaders/officers
    const getRoleScore = (m: Member) => {
      const role = (m.tipo_de_pessoa || '').toUpperCase();
      if (role === 'APÓSTOLO') return 5;
      if (role === 'PRESBÍTERO') return 4;
      if (role === 'DIÁCONO') return 3;
      if (role === 'LÍDER') return 2;
      return 1;
    };

    // Filter active officers/leaders
    let officers = activeMembers.filter(m => 
      ['APÓSTOLO', 'PRESBÍTERO', 'DIÁCONO', 'LÍDER'].includes((m.tipo_de_pessoa || '').toUpperCase())
    );

    // Pad with regular active members if we have fewer than 12 officers
    if (officers.length < 12) {
      const regularActive = activeMembers.filter(m => 
        !['APÓSTOLO', 'PRESBÍTERO', 'DIÁCONO', 'LÍDER'].includes((m.tipo_de_pessoa || '').toUpperCase())
      );
      // Deterministic secondary sort so order is stable
      regularActive.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
      officers = [...officers, ...regularActive];
    }

    // Sort by role priority: APÓSTOLO > PRESBÍTERO > DIÁCONO > LÍDER
    officers.sort((a, b) => {
      const scoreA = getRoleScore(a);
      const scoreB = getRoleScore(b);
      if (scoreA !== scoreB) return scoreB - scoreA;
      // Secondary sort alphabetically to remain deterministic
      return (a.nome || '').localeCompare(b.nome || '');
    });

    // Take the top 12
    const selectedMembers = officers.slice(0, 12);

    const availableProfiles = [
      { key: 'pedro', name: 'Pedro (Simão)', role: 'Ação Ousada & Liderança da Frente' },
      { key: 'joao', name: 'João', role: 'Guardião do Amor & Cuidado Profundo' },
      { key: 'tiago', name: 'Tiago', role: 'Coluna de Justiça & Zelo Doutrinário' },
      { key: 'andre', name: 'André', role: 'Conector Silencioso de Pessoas' },
      { key: 'filipe', name: 'Filipe', role: 'Planejador Pragmático & Racional' },
      { key: 'bartolomeu', name: 'Bartolomeu (Natanael)', role: 'O Homem de Caráter Íntegro' },
      { key: 'mateus', name: 'Mateus (Levi)', role: 'Organizador de Sistemas & Finanças' },
      { key: 'tome', name: 'Tomé', role: 'O Questionador Reflexivo' },
      { key: 'tiago_alfeu', name: 'Tiago (Filho de Alfeu)', role: 'O Pacificador Silencioso' },
      { key: 'simao_zelote', name: 'Simão (O Zelote)', role: 'Ativista Para Todos & Missionário' },
      { key: 'judas_tadeu', name: 'Judas Tadeu', role: 'O Questionador Espiritual' },
      { key: 'matias', name: 'Matias', role: 'O Cooperador Fiel Substituto' }
    ];

    const assignedDisciples: Disciple[] = [];
    const remainingProfiles = [...availableProfiles];

    for (const m of selectedMembers) {
      const age = getAge(m.nascimento);
      const role = (m.tipo_de_pessoa || '').toUpperCase();
      const isMarried = m.estado_civil === 'Casado' || !!m.esposo_a;
      const isTither = m.e_dizimista === 'Sim';
      const hasGC = !!m.grupos_caseiros;

      // Calculate scores for each remaining profile to match dynamically
      let bestProfileIdx = 0;
      let highestScore = -999;

      remainingProfiles.forEach((prof, idx) => {
        let score = 0;
        
        if (prof.key === 'pedro') {
          if (role === 'APÓSTOLO') score += 15;
          if (role === 'PRESBÍTERO') score += 8;
          if (role === 'LÍDER' && hasGC) score += 5;
        }
        if (prof.key === 'joao') {
          if (m.sexo === 'Feminino') score += 6;
          if (age && age < 35) score += 5;
        }
        if (prof.key === 'tiago') {
          if (role === 'PRESBÍTERO') score += 10;
          if (age && age > 45) score += 5;
        }
        if (prof.key === 'andre') {
          if (role === 'LÍDER' || role === 'DIÁCONO') score += 5;
          if (!hasGC) score += 4;
        }
        if (prof.key === 'filipe') {
          if (isTither) score += 4;
          if (role === 'DIÁCONO') score += 3;
        }
        if (prof.key === 'bartolomeu') {
          if (age && age > 50) score += 8;
          if (isMarried) score += 3;
        }
        if (prof.key === 'mateus') {
          if (isTither) score += 12;
          if (role === 'DIÁCONO') score += 4;
        }
        if (prof.key === 'tome') {
          if (m.estado_civil === 'Solteiro') score += 5;
          if (age && age < 30) score += 3;
        }
        if (prof.key === 'tiago_alfeu') {
          if (role === 'DIÁCONO') score += 8;
          if (!isTither) score += 2;
        }
        if (prof.key === 'simao_zelote') {
          if (m.estado_civil === 'Solteiro') score += 8;
          if (role === 'LÍDER') score += 3;
        }
        if (prof.key === 'judas_tadeu') {
          if (role === 'LÍDER') score += 4;
        }
        if (prof.key === 'matias') {
          if (role === 'MEMBRO') score += 10;
          if (role === 'DIÁCONO') score += 4;
        }

        // Add a deterministic name hash factor to avoid ties and maintain stability
        let hash = 0;
        const name = m.nome || '';
        for (let i = 0; i < name.length; i++) {
          hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        score += (Math.abs(hash + prof.key.charCodeAt(0)) % 100) / 100;

        if (score > highestScore) {
          highestScore = score;
          bestProfileIdx = idx;
        }
      });

      // Splice the best profile out
      const chosenProfile = remainingProfiles.splice(bestProfileIdx, 1)[0];

      // Construct dynamic descriptions & counsels based on database facts
      const firstName = m.nome.split(' ')[0];
      const genderSuffix = m.sexo === 'Feminino' ? 'a' : 'o';
      const spouseText = isMarried ? (m.esposo_a ? `junto com ${m.esposo_a}` : 'junto com seu cônjuge') : '';
      const gcText = m.grupos_caseiros ? `no GC ${m.grupos_caseiros}` : 'na congregação';
      const bairroText = m.bairro ? `em ${m.bairro}` : '';

      let description = '';
      let counsel = '';

      if (chosenProfile.key === 'pedro') {
        description = `Identificado como Pedro na BSB Church. Uma liderança enérgica e impetuosa, de ação rápida, pronta para assumir a frente dos desafios e defender o corpo.`;
        counsel = `"Diego, incentive ${firstName} a canalizar seu ímpeto natural para liderar e pastorear as minhas ovelhas ${gcText} com paciência. ${firstName} tem uma chama de liderança ousada, mas ensine-${genderSuffix} que a verdadeira rocha é firmada na humildade. ${isMarried ? `Que caminhe firme ${spouseText}, protegendo o seu lar.` : 'Que sua entrega seja pura perante mim.'} Diga-lhe: não olhe para o vento ou para as ondas ${bairroText}, mas mantenha os olhos em Mim."`;
      } else if (chosenProfile.key === 'joao') {
        description = `Identificado como João. Guardião do cuidado relacional e da intimidade de comunhão, focado na lealdade e no amor profundo aos irmãos.`;
        counsel = `"Diego, apoie-se em ${firstName} para manter o coração da igreja focado no amor genuíno. ${firstName} tem a sensibilidade dos discípulos mais íntimos. Que ${genderSuffix} cuide com ternura de cada alma ${gcText}, sendo um canal de cura e acolhimento ${bairroText}. ${isMarried ? `Que seu casamento ${spouseText} seja um testemunho vivo de amor sacrificial.` : 'Que sua vida seja preenchida pelo meu amor no secreto.'} Lembre-o de que quem não ama, não conhece a Deus."`;
      } else if (chosenProfile.key === 'tiago') {
        description = `Identificado como Tiago. Um pilar forte de oração, ordem espiritual e zelo pela sã doutrina. Exige retidão doutrinária e moral.`;
        counsel = `"Diego, utilize a firmeza e seriedade de ${firstName} para consolidar as colunas da nossa fé ${gcText}. ${firstName} possui um zelo profundo pela retidão e pela sã doutrina. Exorte-${genderSuffix} a sustentar a igreja em intercessão ardente ${bairroText}. ${isMarried ? `Seu lar, edificado com ${m.esposo_a || 'sua família'}, é a base de sua autoridade espiritual.` : ''} Lembre-${genderSuffix} de que a fé sem obras é morta e a justiça sem amor é vazia."`;
      } else if (chosenProfile.key === 'andre') {
        description = `Identificado como André. Aquele que atua nos bastidores trazendo as pessoas individualmente para Jesus, com grande espírito acolhedor.`;
        counsel = `"Diego, dê total espaço para o ministério discreto de ${firstName}. Enquanto alguns pregam para multidões, ${firstName} traz as pessoas individualmente pelos braços no secreto ${bairroText}. ${genderSuffix.toUpperCase()} é a chave de acolhida ${gcText}, notando os esquecidos que ninguém mais vê. ${isMarried ? `Que ${spouseText} seja um porto seguro para novos convertidos.` : ''} Lembre-${genderSuffix} que no meu Reino, os últimos serão os primeiros."`;
      } else if (chosenProfile.key === 'filipe') {
        description = `Identificado como Filipe. O administrador prático que calcula custos, analisa logística e busca a viabilidade racional dos passos da igreja.`;
        counsel = `"Diego, não despreze as análises e o realismo de ${firstName}. ${genderSuffix.toUpperCase()} ajuda a igreja a estruturar com inteligência os custos e passos ${bairroText}. Mas desafie-o constantemente a ver além dos relatórios ${gcText}. Lembre-o de que cinco pães e dois peixes em minhas mãos alimentam milhares. ${isMarried ? `Junto com ${spouseText}, multipliquei seus recursos para transbordar.` : ''} Ensine-${genderSuffix} a andar por fé, e não por vista."`;
      } else if (chosenProfile.key === 'bartolomeu') {
        description = `Identificado como Bartolomeu (Natanael). Um servo de integridade exemplar, cuja conduta reta inspira confiança e serve de consolo para o rebanho.`;
        counsel = `"Diego, honre a sinceridade pura e sem fingimento de ${firstName}. ${firstName} é ${genderSuffix === 'o' ? 'um homem' : 'uma mulher'} de caráter irrepreensível, que medita na minha Palavra sob a figueira ${bairroText} longe dos holofotes. Use a integridade de${genderSuffix} para guiar e aconselhar ${gcText}. ${isMarried ? `A aliança com ${m.esposo_a || 'sua família'} reflete essa integridade.` : ''} Pessoas assim blindam a minha noiva contra a hipocrisia."`;
      } else if (chosenProfile.key === 'mateus') {
        description = `Identificado como Mateus. Organizador de sistemas e finanças, focado em prestação de contas, dízimos fiéis e integridade material.`;
        counsel = `"Diego, canalize a mente organizada e o talento para processos de ${firstName} para abençoar a estrutura ${gcText}. O que antes o mundo podia ver como apenas números, eu redimi para ser um registro fiel da minha Graça ${bairroText}. ${isMarried ? `Que ${spouseText} governe com ordem e generosidade.` : ''} Diga-lhe que sua fidelidade nos dízimos e na mordomia inspira a toda a congregação a confiar no meu sustento."`;
      } else if (chosenProfile.key === 'tome') {
        description = `Identificado como Tomé. O questionador sincero e analítico que busca verdades profundas e não se contenta com respostas superficiais.`;
        counsel = `"Diego, acolha as reflexões profundas de ${firstName} sem julgá-las. Suas dúvidas honestas e busca por bases sólidas ${bairroText} trazem respostas firmes que ajudam ${gcText}. Quando ${firstName} experimenta a minha presença, seu compromisso é radical e inabalável. ${isMarried ? `Que ao lado de ${m.esposo_a || 'seu cônjuge'}, encontre descanso na fé compartilhada.` : ''} Fortaleça-${genderSuffix} a tocar em minhas marcas e proclamar: Senhor meu e Deus meu!"`;
      } else if (chosenProfile.key === 'tiago_alfeu') {
        description = `Identificado como Tiago (filho de Alfeu). Representante do trabalho fiel e silencioso nos bastidores cotidianos, construindo a igreja no secreto.`;
        counsel = `"Diego, valorize a fidelidade silenciosa de ${firstName}. Embora ${genderSuffix} raramente apareça nos holofotes, o serviço diário de${genderSuffix} ${bairroText} é o cimento espiritual que mantém as paredes do ${gcText} unidas. ${isMarried ? `Sua casa, edificada com ${spouseText}, é um altar de paz.` : ''} Lembre-${genderSuffix} de que o Pai que vê o que é feito em segredo, recompensará de forma abundante."`;
      } else if (chosenProfile.key === 'simao_zelote') {
        description = `Identificado como Simão o Zelote. Cheio de zelo missionário e energia, excelente para mover o povo em causas de evangelismo ativo e socorro social.`;
        counsel = `"Diego, canalize a energia vibrante e apaixonada de ${firstName} para a grande colheita em Brasília. ${firstName} tem o encargo de levar o Reino para fora das quatro paredes, mobilizando o ${gcText} para acolher os necessitados ${bairroText}. ${isMarried ? `Que com ${spouseText}, corram a corrida missionária sem hesitar.` : 'Que sua solteirice seja canal de foco radical na minha obra.'} Desperte nele o amor pelos marginalizados."`;
      } else if (chosenProfile.key === 'judas_tadeu') {
        description = `Identificado como Judas Tadeu. Foco na comunhão do Espírito, adoração profunda e na revelação da glória de Deus no secreto.`;
        counsel = `"Diego, incentive ${firstName} a guiar as pessoas na comunhão íntima e devoção sincera. ${firstName} ajuda o ${gcText} a não cair no ativismo vazio, guardando o fogo da oração no altar do coração ${bairroText}. ${isMarried ? `Sua devoção em família, ao lado de ${m.esposo_a || 'seu cônjuge'}, responde ao mover do meu Espírito.` : ''} Que ${genderSuffix} incentive cada membro a buscar a intimidade divina."`;
      } else {
        description = `Identificado como Matias. Aquele que serve fielmente por muito tempo com maturidade, pronto para assumir novas e grandes responsabilidades.`;
        counsel = `"Diego, honre a caminhada de ${firstName}, que esteve conosco servindo fielmente no anonimato ${bairroText}. Quando surgir uma lacuna ou desafio no ${gcText}, confie nele. ${firstName} está pronto porque seu coração sempre esteve na minha obra, não em cargos. ${isMarried ? `Que ${spouseText} continue sendo canal de serviço humilde e frutuoso.` : ''} A unção dele vem da constância nas pequenas coisas."`;
      }

      assignedDisciples.push({
        member: m,
        apostolicName: chosenProfile.name,
        role: chosenProfile.role,
        desc: description,
        counsel
      });
    }

    return assignedDisciples;
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

    const distribution = categories.map(cat => ({ 
      ...cat, 
      count: 0, 
      members: [] as { member: Member; justification: string }[] 
    }));

    activeMembers.forEach((m) => {
      const role = (m.tipo_de_pessoa || '').toUpperCase();
      const name = m.nome || '';
      
      // Deterministic hash based on name characters
      let hash = 0;
      for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
      }
      const absHash = Math.abs(hash);

      let giftIndex = 0;
      let justification = '';

      if (role === 'APÓSTOLO') {
        giftIndex = 5; // Liderança / Governo
        justification = `Liderança apostólica na BSB Church. Chamado a guiar o corpo de anciãos e a congregação com sabedoria, visão pioneira e autoridade espiritual.`;
      } else if (role === 'PRESBÍTERO') {
        giftIndex = (absHash % 2 === 0) ? 2 : 5; // Ensino or Liderança
        if (giftIndex === 2) {
          justification = `Identificado como Presbítero com forte encargo de Ensino. Chamado a pastorear a congregação através da sã doutrina e instrução fiel da Bíblia.`;
        } else {
          justification = `Identificado como Presbítero com o encargo de Governo. Vocacionado a presidir, organizar e conduzir a comunidade local com diligência.`;
        }
      } else if (role === 'DIÁCONO') {
        giftIndex = 1; // Serviço / Ministério
        justification = `Ordenado como Diácono na congregação. Vocação de suporte prático, socorro aos necessitados e serviço sacrificial na casa de Deus.`;
      } else if (role === 'LÍDER') {
        const leaderGifts = [5, 2, 3]; // Liderança, Ensino, Encorajamento
        giftIndex = leaderGifts[absHash % leaderGifts.length];
        if (giftIndex === 5) {
          justification = `Líder de GC ativo. Chamado a governar e guiar as ovelhas do seu lar de comunhão com proteção, amor e ordem eclesiástica.`;
        } else if (giftIndex === 2) {
          justification = `Líder focado em consolidação doutrinária. Capacidade de explicar e discipular os membros na verdade do Evangelho de Cristo.`;
        } else {
          justification = `Líder com coração pastoral e acolhedor, vocacionado para motivar a fé, aconselhar nos momentos de dor e erguer os cansados.`;
        }
      } else {
        // Regular members (MEMBRO, AGREGADO, etc.) - NEVER Liderança/Governo to preserve realism
        const isTither = m.e_dizimista === 'Sim';
        const hasGC = !!m.grupos_caseiros;
        
        // Allowed: Profecia (0), Serviço (1), Ensino (2), Encorajamento (3), Contribuição (4), Misericórdia (6)
        if (isTither && (absHash % 3 === 0)) {
          giftIndex = 4; // Contribuição
          justification = `Fidelidade e desprendimento material demonstrados na BSB. Vocacionado para prosperar e cooperar com generosidade alegre na expansão do Reino.`;
        } else if (!hasGC && m.estado_civil && m.estado_civil.includes('Solteiro')) {
          // "Solteiro pouco englobado" -> Misericórdia (6), Serviço (1) or Encorajamento (3)
          const restricted = [6, 1, 3];
          giftIndex = restricted[absHash % restricted.length];
          if (giftIndex === 6) {
            justification = `Identificado para a Misericórdia silenciosa. Vocacionado para a empatia pura e consolo aos aflitos no um-a-um.`;
          } else if (giftIndex === 3) {
            justification = `Vocacionado ao encorajamento fraternal cotidiano, abençoando outros com escuta acolhedora e palavras de ânimo.`;
          } else {
            justification = `Vocação prática e cooperação nos bastidores do Reino, servindo com dedicação e coração de servo voluntário.`;
          }
        } else {
          // General distribution across 0, 1, 2, 3, 4, 6
          const allowedGifts = [0, 1, 2, 3, 4, 6];
          giftIndex = allowedGifts[absHash % allowedGifts.length];
          if (giftIndex === 0) {
            justification = `Zelo e convicção na sã doutrina. Vocação para exortar e consolar através da proclamação fiel da Palavra no GC ${m.grupos_caseiros || 'Geral'}.`;
          } else if (giftIndex === 1) {
            justification = `Prontidão prática e serviço voluntário no GC ${m.grupos_caseiros || 'Geral'}. Edifica a igreja através do suporte diário nos bastidores.`;
          } else if (giftIndex === 2) {
            justification = `Estudioso e dedicado às Escrituras no GC ${m.grupos_caseiros || 'Geral'}. Chamado a instruir os irmãos no conhecimento da Verdade.`;
          } else if (giftIndex === 3) {
            justification = `Coração pastoral de acolhimento e escuta no GC ${m.grupos_caseiros || 'Geral'}. Vocação para encorajar a fé prática dos irmãos.`;
          } else if (giftIndex === 4) {
            justification = `Generosidade ativa e espírito de cooperação, auxiliando prontamente nas demandas e assistência social da igreja.`;
          } else {
            justification = `Sensibilidade e compaixão provadas no GC ${m.grupos_caseiros || 'Geral'}. Chamado a confortar doentes, fracos e necessitados com amor.`;
          }
        }
      }

      distribution[giftIndex].count++;
      distribution[giftIndex].members.push({ member: m, justification });
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

  // Dynamic stats calculated from real Supabase data for the Jerusalem Council Dashboard
  const stats = useMemo(() => {
    // 1. Harvest in Ceilândia/Samambaia (Paul)
    const ceilandiaSamambaiaMembers = activeMembers.filter(m => {
      const b = (m.bairro || '').toLowerCase();
      return b.includes('ceilândia') || b.includes('ceilandia') || b.includes('samambaia');
    });
    const ceilandiaMembersCount = ceilandiaSamambaiaMembers.length;
    
    // GCs in Ceilândia/Samambaia (calculated by distinct GCs of members living there)
    const ceilandiaGCsCount = new Set(
      ceilandiaSamambaiaMembers.map(m => m.grupos_caseiros).filter(Boolean)
    ).size;

    // 2. Kids under 8 in Central Sector (Jesus)
    const centralChildren = activeMembers.filter(m => {
      const isCentral = (m.setor_eclesiastico || '').toLowerCase().includes('central') || 
                        (m.setor_residencial || '').toLowerCase().includes('central');
      if (!isCentral) return false;
      if (!m.nascimento) return false;
      const age = getAge(m.nascimento);
      return age !== null && age < 8;
    });
    const centralChildrenCount = centralChildren.length;

    const totalChildrenCount = activeMembers.filter(m => {
      if (!m.nascimento) return false;
      const age = getAge(m.nascimento);
      return age !== null && age < 8;
    }).length;

    // 3. Mismatched Members Relocation (Paul)
    const mismatchedMembers = activeMembers.filter(m => {
      const ecl = (m.setor_eclesiastico || '').trim().toUpperCase();
      const res = (m.setor_residencial || '').trim().toUpperCase();
      return ecl && res && ecl !== res;
    });
    const mismatchesCount = mismatchedMembers.length;

    // 4. Leaders Ratio & Potential Leaders (Jesus)
    const totalActiveCount = activeMembers.length;
    const leaders = activeMembers.filter(m => 
      ['APÓSTOLO', 'PRESBÍTERO', 'DIÁCONO', 'LÍDER'].includes((m.tipo_de_pessoa || '').toUpperCase())
    );
    const leadersCount = leaders.length;
    const membersPerLeader = leadersCount > 0 ? (totalActiveCount / leadersCount).toFixed(1) : '0';

    // Potential leaders: dizimista = 'Sim', status = 'ATIVO', NOT currently a leader/officer
    const potentialLeadersList = activeMembers.filter(m => {
      const isOfficer = ['APÓSTOLO', 'PRESBÍTERO', 'DIÁCONO', 'LÍDER'].includes((m.tipo_de_pessoa || '').toUpperCase());
      return !isOfficer && m.e_dizimista === 'Sim';
    })
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
    .slice(0, 3);

    return {
      ceilandiaMembersCount,
      ceilandiaGCsCount,
      centralChildrenCount,
      totalChildrenCount,
      mismatchesCount,
      mismatchedMembers: mismatchedMembers.slice(0, 5),
      totalActiveCount,
      leadersCount,
      membersPerLeader,
      potentialLeadersList
    };
  }, [activeMembers]);

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
                        <div className="flex flex-wrap gap-2 mt-1.5">
                          {theTwelve[selectedDisciple].member.nascimento && (
                            <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md border border-slate-200">
                              🎂 {getAge(theTwelve[selectedDisciple].member.nascimento)} anos
                            </span>
                          )}
                          {theTwelve[selectedDisciple].member.estado_civil && (
                            <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md border border-slate-200">
                              💍 {theTwelve[selectedDisciple].member.estado_civil}
                            </span>
                          )}
                          <span className={clsx(
                            "text-[10px] font-bold px-2 py-0.5 rounded-md border",
                            theTwelve[selectedDisciple].member.e_dizimista === 'Sim' 
                              ? "bg-emerald-50 text-emerald-700 border-emerald-250" 
                              : "bg-slate-100 text-slate-500 border-slate-200"
                          )}>
                            🪙 {theTwelve[selectedDisciple].member.e_dizimista === 'Sim' ? 'Fiel Provedor' : 'Cooperador'}
                          </span>
                          {theTwelve[selectedDisciple].member.bairro && (
                            <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md border border-slate-200">
                              📍 {theTwelve[selectedDisciple].member.bairro}
                            </span>
                          )}
                        </div>
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
              {spiritualGifts.map((gift, idx) => {
                const Icon = gift.icon;
                const isSelected = selectedGift === idx;
                return (
                  <div 
                    key={gift.name}
                    onClick={() => setSelectedGift(idx)}
                    className={clsx(
                      "flex flex-col justify-between p-4 rounded-xl border cursor-pointer hover:shadow-md transition-all h-[240px]",
                      isSelected 
                        ? "border-amber-500 bg-amber-50/20 ring-1 ring-amber-100" 
                        : "border-slate-100 bg-slate-50/10 hover:border-slate-200"
                    )}
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
                      
                      {gift.members.length > 0 && (
                        <div className="text-[9px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded truncate max-w-[70px]">
                          {gift.members[0].member.nome.split(' ')[0]}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Selected Gift Member List Details */}
            {selectedGift !== null && (
              <div className="mt-6 pt-6 border-t border-slate-100 animate-in fade-in duration-300">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
                  <div>
                    <h3 className="text-sm font-black text-slate-950 uppercase tracking-wider flex items-center gap-2">
                      👑 Membros Vocacionados: {spiritualGifts[selectedGift].name}
                    </h3>
                    <p className="text-xs text-slate-400">
                      Exibindo {Math.min(15, spiritualGifts[selectedGift].members.length)} de {spiritualGifts[selectedGift].count} membros ativos classificados dinamicamente.
                    </p>
                  </div>
                  <span className="text-[10px] font-black uppercase text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full self-start md:self-center">
                    {spiritualGifts[selectedGift].biblicalRef} · {spiritualGifts[selectedGift].description}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-h-[320px] overflow-y-auto pr-2 scrollbar-thin">
                  {spiritualGifts[selectedGift].members.slice(0, 15).map(({ member, justification }) => {
                    const initials = member.nome.split(' ').map(n => n[0]).slice(0, 2).join('');
                    return (
                      <div key={member.id} className="flex gap-3 p-3.5 rounded-2xl border border-slate-100 bg-slate-50/20 hover:border-slate-200 hover:shadow-sm transition-all">
                        <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-black text-xs shrink-0 shadow-inner">
                          {initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-black text-slate-900 truncate">{member.nome}</p>
                            <span className="text-[8px] font-black uppercase bg-slate-100 text-slate-500 px-1.5 py-0.2 rounded border">
                              {member.tipo_de_pessoa}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5 font-medium leading-tight">
                            GC: <strong className="text-slate-650">{member.grupos_caseiros || 'Geral'}</strong> · Bairro: <strong className="text-slate-650">{member.bairro || 'Não inf.'}</strong>
                          </p>
                          <p className="text-[9.5px] text-slate-500 italic mt-2 leading-relaxed border-l-2 border-slate-200 pl-2">
                            "{justification}"
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
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

      {/* Concílio de Jerusalém - Painel Estratégico Apostólico */}
      <section className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white relative overflow-hidden mt-12 shadow-xl shadow-amber-500/5">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-violet-600 rounded-full blur-3xl pointer-events-none" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5 mb-6">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 bg-amber-500/10 text-amber-300 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-amber-500/20">
              <Scroll className="w-3.5 h-3.5" /> DIRETRIZES ESTRUTURAIS DO BANCO DO CONCÍLIO
            </div>
            <h2 className="text-xl font-extrabold tracking-tight">O Concílio de Jerusalém — Análise Eclesiástica</h2>
            <p className="text-xs text-slate-400">Uma convergência teológica e estratégica baseada nas Escrituras e nos dados atuais de {stats.totalActiveCount} membros.</p>
          </div>
          
          <div className="flex gap-4 shrink-0 text-slate-400 text-xs">
            <div className="flex flex-col items-end">
              <span className="font-extrabold text-[10px] text-slate-500 uppercase">Membros Ativos</span>
              <span className="font-black text-white text-base">{stats.totalActiveCount}</span>
            </div>
            <div className="flex flex-col items-end border-l border-slate-800 pl-4">
              <span className="font-extrabold text-[10px] text-slate-500 uppercase">Líderes Ativos</span>
              <span className="font-black text-white text-base">{stats.leadersCount}</span>
            </div>
            <div className="flex flex-col items-end border-l border-slate-800 pl-4">
              <span className="font-extrabold text-[10px] text-slate-500 uppercase">Proporção de Cuidado</span>
              <span className="font-black text-amber-400 text-base">1:{stats.membersPerLeader}</span>
            </div>
          </div>
        </div>

        <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1: Colheita em Ceilândia/Samambaia */}
          <div className="bg-slate-950/60 border border-slate-850 p-5 rounded-2xl flex flex-col justify-between hover:border-slate-850/80 transition-all hover:scale-[1.01] duration-300">
            <div className="space-y-3">
              <div className="flex justify-between items-start">
                <span className="text-[9px] font-black uppercase tracking-wider bg-violet-500/10 text-violet-300 border border-violet-500/20 px-2 py-0.5 rounded">
                  Exortação de Paulo
                </span>
                <span className="text-xs text-slate-500 font-bold">Atos 16:9</span>
              </div>
              <h3 className="text-sm font-black text-slate-100 flex items-center gap-1.5">
                🌍 Colheita em Ceilândia & Samambaia
              </h3>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Identificamos <strong className="text-white">{stats.ceilandiaMembersCount} membros ativos</strong> residindo em Ceilândia ou Samambaia, porém apenas <strong className="text-white">{stats.ceilandiaGCsCount} GCs</strong> operando nessas localidades.
              </p>
            </div>
            
            <div className="mt-4 pt-3 border-t border-slate-900 space-y-2">
              <p className="text-[10.5px] text-violet-300 italic leading-snug">
                "Diego, o clamor da Macedônia ecoa dessas regiões! A densidade de vidas ali demanda a plantação urgente de novos grupos nos lares locais. Não deixe as ovelhas viajarem longas distâncias para ter comunhão."
              </p>
            </div>
          </div>

          {/* Card 2: GC Kids no Setor Central */}
          <div className="bg-slate-950/60 border border-slate-850 p-5 rounded-2xl flex flex-col justify-between hover:border-slate-850/80 transition-all hover:scale-[1.01] duration-300">
            <div className="space-y-3">
              <div className="flex justify-between items-start">
                <span className="text-[9px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2 py-0.5 rounded">
                  Diretriz de Jesus
                </span>
                <span className="text-xs text-slate-500 font-bold">Mateus 19:14</span>
              </div>
              <h3 className="text-sm font-black text-slate-100 flex items-center gap-1.5">
                👶 GC Kids Setor Central
              </h3>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Das <strong className="text-white">{stats.totalChildrenCount} crianças sob 8 anos</strong> na igreja, exatamente <strong className="text-white">{stats.centralChildrenCount} menores</strong> estão concentrados no Setor Central.
              </p>
            </div>
            
            <div className="mt-4 pt-3 border-t border-slate-900 space-y-2">
              <p className="text-[10.5px] text-amber-300 italic leading-snug">
                "Diego, os pequeninos no Setor Central clamam pelo pão da Vida adequado à sua idade! É urgente organizar um departamento sólido de GC Kids local para acolher e consolidar essas famílias."
              </p>
            </div>
          </div>

          {/* Card 3: Ajuste de Caminhada Territorial */}
          <div className="bg-slate-950/60 border border-slate-850 p-5 rounded-2xl flex flex-col justify-between hover:border-slate-850/80 transition-all hover:scale-[1.01] duration-300">
            <div className="space-y-3">
              <div className="flex justify-between items-start">
                <span className="text-[9px] font-black uppercase tracking-wider bg-violet-500/10 text-violet-300 border border-violet-500/20 px-2 py-0.5 rounded">
                  Exortação de Paulo
                </span>
                <span className="text-xs text-slate-500 font-bold">1 Cor 14:40</span>
              </div>
              <h3 className="text-sm font-black text-slate-100 flex items-center gap-1.5">
                📍 Alinhamento Territorial
              </h3>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Existem <strong className="text-white">{stats.mismatchesCount} membros</strong> frequentando GCs em setores eclesiásticos diferentes da sua região de residência (e.g. residindo no Sul mas em GCs no Centro).
              </p>
            </div>
            
            <div className="mt-4 pt-3 border-t border-slate-900 space-y-2">
              <p className="text-[10.5px] text-violet-300 italic leading-snug">
                "A ordem e a decência pedem cuidado territorial! Exorte esses irmãos a se vincularem aos GCs locais do seu bairro. A comunhão prospera quando a igreja serve no mesmo lugar."
              </p>
            </div>
          </div>

          {/* Card 4: Proporção de Obreiros & Novos Líderes */}
          <div className="bg-slate-950/60 border border-slate-850 p-5 rounded-2xl flex flex-col justify-between hover:border-slate-850/80 transition-all hover:scale-[1.01] duration-300">
            <div className="space-y-3">
              <div className="flex justify-between items-start">
                <span className="text-[9px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2 py-0.5 rounded">
                  Diretriz de Jesus
                </span>
                <span className="text-xs text-slate-500 font-bold">Mateus 9:37</span>
              </div>
              <h3 className="text-sm font-black text-slate-100 flex items-center gap-1.5">
                🔥 Formar Novos Líderes
              </h3>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Com 1 líder para {stats.membersPerLeader} membros, vejo fidelidade e generosidade no secreto nestes dizimistas prontos para cooperar na liderança:
              </p>
            </div>
            
            <div className="mt-3 pt-2.5 border-t border-slate-900 space-y-2">
              {stats.potentialLeadersList.length > 0 ? (
                <div className="space-y-1.5">
                  <div className="flex flex-col gap-1">
                    {stats.potentialLeadersList.map((m) => (
                      <div key={m.id} className="text-[10px] font-bold text-slate-200 bg-slate-900/80 px-2.5 py-1 rounded border border-slate-850 flex justify-between items-center">
                        <span className="truncate pr-1">{m.nome.split(' ')[0]} {m.nome.split(' ')[1] || ''}</span>
                        <span className="text-amber-400 text-[8px] uppercase tracking-wider font-extrabold shrink-0">{m.bairro || 'Membro'}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[9px] text-amber-350 italic mt-0.5 leading-snug">
                    "Diego, convoque estes a darem um passo de fé na liderança. Quem é fiel nas pequenas coisas será honrado!"
                  </p>
                </div>
              ) : (
                <p className="text-[10.5px] text-amber-300 italic leading-snug">
                  "A colheita é farta, mas os ceifeiros são poucos. Clamai ao Senhor da colheita para que envie trabalhadores."
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

    </div>
  );
};
