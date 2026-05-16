const lucide = require('lucide-react');
const icons = ['Brain', 'MapPin', 'TrendingUp', 'AlertTriangle', 'Play', 'RotateCcw', 'Save', 'ArrowRight', 'Search', 'ShieldAlert', 'CheckCircle2', 'Download', 'Filter', 'BookOpen', 'Network', 'Home', 'Users'];
icons.forEach(icon => {
  console.log(`${icon}:`, !!lucide[icon]);
});
