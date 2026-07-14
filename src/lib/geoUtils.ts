// BSB Church Geographic & Text Normalization Utilities

export const regionCoordinates: Record<string, [number, number]> = {
  'VICENTE PIRES': [-15.805, -47.965],
  'ARNIQUEIRA': [-15.855, -48.015],
  'SAMAMBAIA': [-15.885, -48.085],
  'AGUAS CLARAS': [-15.842, -48.025],
  'TAGUATINGA': [-15.815, -48.065],
  'SOBRADINHO': [-15.655, -47.795],
  'GUARA': [-15.825, -47.985],
  'CEILANDIA': [-15.822, -48.115],
  'SUDOESTE': [-15.795, -47.925],
  'ASA SUL': [-15.812, -47.902],
  'ASA NORTE': [-15.762, -47.882],
  'RECANTO-ENTORNO': [-15.905, -48.075],
  'RECANTO DAS EMAS': [-15.905, -48.075],
  'RIACHO FUNDO': [-15.872, -48.012],
  'NUCLEO BANDEIRANTE': [-15.862, -47.962],
  'LAGO NORTE': [-15.735, -47.865],
  'NOROESTE': [-15.768, -47.935],
  'JARDIM BOTANICO': [-15.888, -47.835],
};

// Haversine formula to compute distance between two coordinates in km
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): string | null => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const d = R * c;
  return d.toFixed(2);
};

export const calculateAge = (dob: string | null): number => {
  if (!dob) return -1;
  let parts = dob.includes('/') ? dob.split('/') : dob.split('-');
  const birth = dob.includes('/') ? new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])) : new Date(dob);
  if (isNaN(birth.getTime())) return -1;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--;
  return age;
};

export const normalizeName = (name: string | null | undefined): string => {
  if (!name) return '';
  return name.trim().toUpperCase().replace(/\s+/g, ' ');
};

export const normalizePhone = (phone: string | null | undefined): string => {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
};

export const normalizeAddress = (addr: string | null | undefined): string => {
  if (!addr) return '';
  return addr.trim().toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9]/g, '');
};

export const getAdministrativeRegion = (bairro: string | null | undefined): string => {
  if (!bairro) return 'NÃO INFORMADO';
  const norm = bairro.trim().toUpperCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  if (norm.includes('NUCLEO BANDEIRANTE') || norm.includes('NB')) return 'NÚCLEO BANDEIRANTE';
  if (norm.includes('VICENTE PIRES') || norm.includes('JOQUEI')) return 'VICENTE PIRES';
  if (norm.includes('TAGUATINGA') || norm.includes('TAGUA')) return 'TAGUATINGA';
  if (norm.includes('ARNIQUEIRA')) return 'ARNIQUEIRA';
  if (norm.includes('AGUAS CLARAS') || norm.includes('AREAL')) return 'ÁGUAS CLARAS';
  if (norm.includes('GUARA') || norm.includes('LUCIO COSTA')) return 'GUARÁ';
  if (norm.includes('ASA SUL')) return 'ASA SUL';
  if (norm.includes('ASA NORTE') || norm.includes('HABITACOES INDIVIDUAIS NORTE')) return 'ASA NORTE';
  if (norm.includes('CEILANDIA')) return 'CEILÂNDIA';
  if (norm.includes('SAMAMBAIA')) return 'SAMAMBAIA';
  if (norm.includes('RECANTO DAS EMAS') || norm.includes('RECANTO') || norm.includes('ENTORNO')) return 'RECANTO-ENTORNO';
  if (norm.includes('SOBRADINHO')) return 'SOBRADINHO';
  if (norm.includes('RIACHO FUNDO')) return 'RIACHO FUNDO';
  if (norm.includes('GAMA')) return 'GAMA';
  if (norm.includes('SANTA MARIA')) return 'SANTA MARIA';
  if (norm.includes('LAGO NORTE') || norm.includes('SHIN')) return 'LAGO NORTE';
  if (norm.includes('NOROESTE')) return 'NOROESTE';
  if (norm.includes('JARDIM BOTANICO') || norm.includes('MANGUEIRAL')) return 'JARDIM BOTÂNICO';
  
  return bairro.trim();
};

export const getGCRegion = (gcName: string): string => {
  const norm = gcName.trim().toUpperCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  if (norm.includes('GUARA') && (norm.includes('NUCLEO BANDEIRANTE') || norm.includes('NB'))) return 'GUARÁ-NB';
  if (norm.includes('NUCLEO BANDEIRANTE') || norm.includes('NB')) return 'NÚCLEO BANDEIRANTE';
  if (norm.includes('VICENTE PIRES') || norm.includes('JOQUEI')) return 'VICENTE PIRES';
  if (norm.includes('TAGUATINGA') || norm.includes('TAGUA')) return 'TAGUATINGA';
  if (norm.includes('ARNIQUEIRA')) return 'ARNIQUEIRA';
  if (norm.includes('AGUAS CLARAS') || norm.includes('AREAL')) return 'ÁGUAS CLARAS';
  if (norm.includes('GUARA')) return 'GUARÁ';
  if (norm.includes('ASA SUL')) return 'ASA SUL';
  if (norm.includes('ASA NORTE')) return 'ASA NORTE';
  if (norm.includes('CEILANDIA')) return 'CEILÂNDIA';
  if (norm.includes('SAMAMBAIA')) return 'SAMAMBAIA';
  if (norm.includes('RECANTO DAS EMAS') || norm.includes('RECANTO') || norm.includes('ENTORNO')) return 'RECANTO-ENTORNO';
  if (norm.includes('SOBRADINHO')) return 'SOBRADINHO';
  if (norm.includes('RIACHO FUNDO')) return 'RIACHO FUNDO';
  if (norm.includes('GAMA')) return 'GAMA';
  if (norm.includes('SANTA MARIA')) return 'SANTA MARIA';
  if (norm.includes('LAGO NORTE')) return 'LAGO NORTE';
  if (norm.includes('NOROESTE')) return 'NOROESTE';
  if (norm.includes('JARDIM BOTANICO')) return 'JARDIM BOTÂNICO';
  
  return 'OUTRO';
};

const normalizeRegion = (value: string): string => value
  .trim()
  .toUpperCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

// These are accepted ministry/coverage equivalences, not territorial errors.
const VALID_COVERAGE_PAIRS = new Set([
  'AGUAS CLARAS|ARNIQUEIRA',
  'GUARA|GUARA-NB',
  'GUARA-NB|NUCLEO BANDEIRANTE',
  'GAMA|RECANTO-ENTORNO',
  'RECANTO-ENTORNO|SAMAMBAIA',
  'RECANTO-ENTORNO|SANTA MARIA'
]);

export const isOperationallyAligned = (residenceRegion: string, gcRegion: string): boolean => {
  const residence = normalizeRegion(residenceRegion);
  const group = normalizeRegion(gcRegion);
  if (!residence || !group || residence === 'NAO INFORMADO' || group === 'OUTRO') return false;
  if (residence === group) return true;
  return VALID_COVERAGE_PAIRS.has([residence, group].sort().join('|'));
};

export const getFallbackRegion = (memberRA: string): string => {
  const fallbackRules: Record<string, string> = {
    'LAGO NORTE': 'ASA NORTE',
    'NOROESTE': 'ASA NORTE',
    'ITAPOÃ': 'ASA NORTE',
    'ITAPOA': 'ASA NORTE',
    'SUDOESTE': 'ASA SUL',
    'CRUZEIRO': 'SUDOESTE',
    'PARANOÁ': 'ASA NORTE',
    'PARANOA': 'ASA NORTE',
    'SOBRADINHO': 'ASA NORTE',
    'PLANALTINA': 'SOBRADINHO',
    'GAMA': 'RECANTO-ENTORNO',
    'SANTA MARIA': 'GAMA',
  };
  return fallbackRules[memberRA] || '';
};

export const getSectorByResidence = (
  bairro: string | null | undefined, 
  cidade: string | null | undefined,
  estado: string | null | undefined
): string => {
  const ra = getAdministrativeRegion(bairro);
  const normRA = ra.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const normCidade = (cidade || '').trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const normBairro = (bairro || '').trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const normEstado = (estado || '').trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // 1. Setor Central
  if (
    normBairro.includes('COLONIA AGRICOLA SAMAMBAIA') ||
    normBairro.includes('COL. AGR. SAMAMBAIA') ||
    normRA === 'VICENTE PIRES' ||
    normRA === 'GUARA' ||
    normRA === 'NUCLEO BANDEIRANTE'
  ) {
    return 'Setor Central';
  }

  // 2. Setor Águas Claras
  if (normRA === 'AGUAS CLARAS' || normRA === 'ARNIQUEIRA') {
    return 'Setor Águas Claras';
  }

  // 3. Setor Norte
  if (
    normRA === 'ASA SUL' ||
    normRA === 'ASA NORTE' ||
    normRA === 'NOROESTE' ||
    normRA === 'LAGO NORTE' ||
    normRA === 'SOBRADINHO' ||
    normRA === 'JARDIM BOTANICO' ||
    normBairro.includes('SUDOESTE') ||
    normBairro.includes('CRUZEIRO') ||
    normBairro.includes('OCTOGONAL') ||
    normBairro.includes('ITAPOA') ||
    normBairro.includes('VARJAO') ||
    normBairro.includes('GRANJA DO TORTO') ||
    normBairro.includes('PLANALTINA') ||
    normBairro.includes('TAQUARI')
  ) {
    // Planaltina de Goiás is in Goias (Setor Sul), Planaltina DF is Setor Norte
    const isGoias = normEstado.includes('GO') || normEstado.includes('GOIAS') || normCidade.includes('GOIAS');
    if (normCidade.includes('PLANALTINA') && isGoias) {
      return 'Setor Sul';
    }
    return 'Setor Norte';
  }

  // 4. Setor Sul
  if (
    normRA === 'TAGUATINGA' ||
    normRA === 'SAMAMBAIA' ||
    normRA === 'CEILANDIA' ||
    normRA === 'RECANTO-ENTORNO' ||
    normRA === 'RIACHO FUNDO' ||
    normRA === 'GAMA' ||
    normRA === 'SANTA MARIA' ||
    normBairro.includes('BRAZLANDIA')
  ) {
    return 'Setor Sul';
  }

  // Fallbacks by City Name
  if (normCidade.includes('SOBRADINHO')) return 'Setor Norte';
  if (normCidade.includes('PLANALTINA')) {
    if (normEstado.includes('GO') || normEstado.includes('GOIAS')) return 'Setor Sul';
    return 'Setor Norte';
  }
  if (normCidade.includes('TAGUATINGA') || normCidade.includes('SAMAMBAIA') || normCidade.includes('CEILANDIA') || normCidade.includes('GAMA')) return 'Setor Sul';
  if (normCidade.includes('GUARA') || normCidade.includes('VICENTE PIRES')) return 'Setor Central';
  if (normCidade.includes('AGUAS CLARAS') || normCidade.includes('ARNIQUEIRA')) return 'Setor Águas Claras';

  // Official RIDE / Entorno (33 municipalities)
  const rideCities = [
    'ABADIANIA', 'AGUA FRIA', 'AGUAS LINDAS', 'ALEXANIA', 'ALTO PARAISO', 'ALVORADA DO NORTE',
    'BARRO ALTO', 'CABECEIRAS', 'CAVALCANTE', 'OCIDENTAL', 'COCALZINHO', 'CORUMBA',
    'CRISTALINA', 'FLORES DE GOIAS', 'FORMOSA', 'GOIANESIA', 'LUZIANIA', 'MIMOSO',
    'NIQUELANDIA', 'NOVO GAMA', 'PADRE BERNARDO', 'PIRENOPOLIS', 'PLANALTINA DE GOIAS',
    'DESCOBERTO', 'SAO JOAO', 'SIMOLANDIA', 'VALPARAISO', 'VILA BOA', 'VILA PROPICIO',
    'ARINOS', 'BURITIS', 'CABECEIRA GRANDE', 'UNAI'
  ];
  
  if (
    rideCities.some(city => normCidade.includes(city) || normBairro.includes(city) || normRA.includes(city))
  ) {
    return 'Setor Sul';
  }

  return 'Sem Setor';
};

