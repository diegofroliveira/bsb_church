export const MOCK_CHART_DATA = {
  growth: [
    { name: 'Jan', membros: 120, visitantes: 40 },
    { name: 'Fev', membros: 132, visitantes: 45 },
    { name: 'Mar', membros: 145, visitantes: 30 },
    { name: 'Abr', membros: 160, visitantes: 50 },
    { name: 'Mai', membros: 175, visitantes: 65 },
    { name: 'Jun', membros: 190, visitantes: 80 },
  ],
  demographics: [
    { name: 'Crianças', value: 45, fill: '#3b82f6' }, // primary-500
    { name: 'Jovens', value: 80, fill: '#60a5fa' },
    { name: 'Adultos', value: 150, fill: '#1d4ed8' },
    { name: 'Idosos', value: 30, fill: '#93c5fd' },
  ],
  finance: [
    { date: 'Semana 1', entradas: 4500, saidas: 2000 },
    { date: 'Semana 2', entradas: 5200, saidas: 1500 },
    { date: 'Semana 3', entradas: 3800, saidas: 3000 },
    { date: 'Semana 4', entradas: 6100, saidas: 1200 },
  ],
  groups: [
    { nome: 'GC Centro', lider: 'João', membros: 12, checkins: 10 },
    { nome: 'GC Sul', lider: 'Marcos', membros: 15, checkins: 14 },
    { nome: 'GC Norte', lider: 'Pedro', membros: 8, checkins: 6 },
    { nome: 'GC Leste', lider: 'Ana', membros: 20, checkins: 18 },
  ]
};

export const MOCK_KPIS = {
  totalMembros: 190,
  membrosAtivos: 175,
  totalVisitantes: 310,
  totalCelulas: 12,
  arrecadacaoMes: 19600,
};
