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
  
  if (norm.includes('VICENTE PIRES') || norm.includes('JOQUEI')) return 'VICENTE PIRES';
  if (norm.includes('TAGUATINGA') || norm.includes('TAGUA')) return 'TAGUATINGA';
  if (norm.includes('ARNIQUEIRA') || norm.includes('AREAL')) return 'ARNIQUEIRA';
  if (norm.includes('AGUAS CLARAS')) return 'ÁGUAS CLARAS';
  if (norm.includes('GUARA') || norm.includes('LUCIO COSTA')) return 'GUARÁ';
  if (norm.includes('ASA SUL')) return 'ASA SUL';
  if (norm.includes('ASA NORTE') || norm.includes('HABITACOES INDIVIDUAIS NORTE')) return 'ASA NORTE';
  if (norm.includes('CEILANDIA')) return 'CEILÂNDIA';
  if (norm.includes('SAMAMBAIA')) return 'SAMAMBAIA';
  if (norm.includes('RECANTO DAS EMAS')) return 'RECANTO DAS EMAS';
  if (norm.includes('SOBRADINHO')) return 'SOBRADINHO';
  if (norm.includes('NUCLEO BANDEIRANTE')) return 'NÚCLEO BANDEIRANTE';
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
  
  if (norm.includes('VICENTE PIRES') || norm.includes('JOQUEI')) return 'VICENTE PIRES';
  if (norm.includes('TAGUATINGA') || norm.includes('TAGUA')) return 'TAGUATINGA';
  if (norm.includes('ARNIQUEIRA') || norm.includes('AREAL')) return 'ARNIQUEIRA';
  if (norm.includes('AGUAS CLARAS')) return 'ÁGUAS CLARAS';
  if (norm.includes('GUARA')) return 'GUARÁ';
  if (norm.includes('ASA SUL')) return 'ASA SUL';
  if (norm.includes('ASA NORTE')) return 'ASA NORTE';
  if (norm.includes('CEILANDIA')) return 'CEILÂNDIA';
  if (norm.includes('SAMAMBAIA')) return 'SAMAMBAIA';
  if (norm.includes('RECANTO DAS EMAS')) return 'RECANTO DAS EMAS';
  if (norm.includes('SOBRADINHO')) return 'SOBRADINHO';
  if (norm.includes('NUCLEO BANDEIRANTE')) return 'NÚCLEO BANDEIRANTE';
  if (norm.includes('RIACHO FUNDO')) return 'RIACHO FUNDO';
  if (norm.includes('GAMA')) return 'GAMA';
  if (norm.includes('SANTA MARIA')) return 'SANTA MARIA';
  if (norm.includes('LAGO NORTE')) return 'LAGO NORTE';
  if (norm.includes('NOROESTE')) return 'NOROESTE';
  if (norm.includes('JARDIM BOTANICO')) return 'JARDIM BOTÂNICO';
  
  return 'OUTRO';
};
