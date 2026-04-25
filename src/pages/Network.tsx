import React, { useEffect, useState, useMemo } from 'react';
import { Search, Loader2, ChevronDown, ChevronRight, Network as NetworkIcon, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import clsx from 'clsx';

interface DiscipleshipData {
  discipulador: string;
  discipulo: string;
  status: string;
  data_inicio: string;
}

interface MemberData {
  nome: string;
  tipo_cadastro: string;
}

interface TreeNodeData {
  name: string;
  status: string;
  children: TreeNodeData[];
  totalDescendants: number;
}

const calculateDescendants = (node: TreeNodeData): number => {
  let count = node.children.length;
  for (const child of node.children) {
    count += calculateDescendants(child);
  }
  node.totalDescendants = count;
  return count;
};

const buildTree = (data: DiscipleshipData[], pastores: Set<string>): TreeNodeData[] => {
  const nodeMap = new Map<string, TreeNodeData>();
  const childrenSet = new Set<string>();

  data.forEach(item => {
    if (!nodeMap.has(item.discipulador)) {
      nodeMap.set(item.discipulador, { name: item.discipulador, status: '', children: [], totalDescendants: 0 });
    }
    if (!nodeMap.has(item.discipulo)) {
      nodeMap.set(item.discipulo, { name: item.discipulo, status: item.status, children: [], totalDescendants: 0 });
    }
  });

  data.forEach(item => {
    const parent = nodeMap.get(item.discipulador);
    const child = nodeMap.get(item.discipulo);
    if (parent && child) {
      if (!childrenSet.has(child.name)) {
        parent.children.push(child);
        childrenSet.add(child.name);
      }
    }
  });

  const roots: TreeNodeData[] = [];
  nodeMap.forEach(node => {
    const isRoot = !childrenSet.has(node.name) && node.children.length > 0;
    // Only show as root if they are a pastor/pastora OR if no pastors list available
    const isPastor = pastores.size === 0 || pastores.has(node.name.trim().toUpperCase());
    if (isRoot && isPastor) {
      roots.push(node);
    }
  });

  roots.forEach(calculateDescendants);
  return roots.sort((a, b) => b.totalDescendants - a.totalDescendants);
};

const TreeNode: React.FC<{ node: TreeNodeData; level?: number; searchTerm: string }> = ({ node, level = 0, searchTerm }) => {
  const matchesSearch = searchTerm && node.name.toLowerCase().includes(searchTerm.toLowerCase());
  const hasMatchingDescendant = useMemo(() => {
    if (!searchTerm) return false;
    const check = (n: TreeNodeData): boolean => {
      if (n.name.toLowerCase().includes(searchTerm.toLowerCase())) return true;
      return n.children.some(check);
    };
    return node.children.some(check);
  }, [node, searchTerm]);

  const [isOpen, setIsOpen] = useState(level < 1);

  // Auto expand if search matches descendants
  useEffect(() => {
    if (searchTerm && hasMatchingDescendant) {
      setIsOpen(true);
    } else if (!searchTerm && level >= 1) {
      setIsOpen(false);
    }
  }, [searchTerm, hasMatchingDescendant, level]);

  if (searchTerm && !matchesSearch && !hasMatchingDescendant) {
    return null;
  }

  return (
    <div className="flex flex-col animate-in fade-in zoom-in-95 duration-200">
      <div 
        className={clsx(
          "flex items-center gap-4 p-3 sm:p-4 rounded-xl border bg-white shadow-sm transition-all",
          node.children.length > 0 ? "cursor-pointer hover:shadow-md hover:border-primary-200" : "",
          matchesSearch ? "ring-2 ring-primary-500 border-primary-500 bg-primary-50/10" : "border-gray-200",
          isOpen && node.children.length > 0 ? "border-primary-200 ring-1 ring-primary-50" : ""
        )}
        onClick={() => node.children.length > 0 && setIsOpen(!isOpen)}
      >
        <div className="h-10 w-10 sm:h-12 sm:w-12 shrink-0 rounded-full bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center border border-primary-200">
           <span className="text-primary-700 font-bold text-sm sm:text-base">
             {node.name.substring(0, 2).toUpperCase()}
           </span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm sm:text-base font-bold text-gray-900 truncate" title={node.name}>{node.name}</h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100">
              <Users className="w-3 h-3" />
              {node.children.length} {node.children.length === 1 ? 'direto' : 'diretos'}
            </span>
            {node.totalDescendants > node.children.length && (
              <span className="inline-flex items-center gap-1 text-xs text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full border border-primary-100">
                <NetworkIcon className="w-3 h-3" />
                {node.totalDescendants} na rede
              </span>
            )}
            {node.status && (
              <span className="inline-flex items-center text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                {node.status}
              </span>
            )}
          </div>
        </div>
        {node.children.length > 0 && (
           <div className={clsx("shrink-0 text-gray-400 p-2 rounded-full hover:bg-gray-100 transition-colors", isOpen && "bg-primary-50 text-primary-600")}>
              {isOpen ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
           </div>
        )}
      </div>

      {isOpen && node.children.length > 0 && (
        <div className="ml-5 sm:ml-6 mt-3 sm:mt-4 pl-5 sm:pl-6 border-l-2 border-gray-100 flex flex-col gap-3 sm:gap-4 relative">
          {node.children.map((child, idx) => (
            <div key={`${child.name}-${idx}`} className="relative">
               {/* Horizontal Connector */}
               <div className="absolute -left-5 sm:-left-6 top-8 w-5 sm:w-6 h-[2px] bg-gray-100 rounded-r-full" />
               <TreeNode node={child} level={level + 1} searchTerm={searchTerm} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const Network: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<DiscipleshipData[]>([]);
  const [pastores, setPastores] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        let allowedNames: string[] = [];
        if (user?.assigned_gc) {
          const { data: relatedMembros } = await supabase
            .from('membros')
            .select('nome')
            .ilike('grupos_caseiros', `%${user.assigned_gc}%`);
          
          if (relatedMembros) {
            allowedNames = relatedMembros.map(m => m.nome.trim().toUpperCase());
          }
        }

        const [discRes, membRes] = await Promise.all([
          supabase.from('discipulado').select('*'),
          supabase.from('membros').select('nome, tipo_cadastro').ilike('tipo_cadastro', '%pastor%')
        ]);
        if (discRes.error) throw discRes.error;

        if (user?.assigned_gc) {
          const filteredDisc = (discRes.data || []).filter(d => 
            allowedNames.includes(d.discipulador?.trim().toUpperCase()) || 
            allowedNames.includes(d.discipulo?.trim().toUpperCase())
          );
          setData(filteredDisc);
        } else {
          setData(discRes.data || []);
        }

        // Build set of pastor names (normalized)
        const pastorSet = new Set<string>(
          (membRes.data || []).map((m: MemberData) => m.nome.trim().toUpperCase())
        );
        setPastores(pastorSet);
      } catch (error) {
        console.error('Error fetching discipleship data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [user?.assigned_gc]);

  const tree = useMemo(() => buildTree(data, pastores), [data, pastores]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-5xl mx-auto">
      <header className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-50 text-primary-700 text-sm font-semibold mb-3 border border-primary-100 shadow-sm">
            <NetworkIcon className="w-4 h-4" />
            Visão Sistêmica
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Rede de Discipulado</h1>
          <p className="mt-2 text-sm text-gray-500">
            Acompanhe o organograma e a árvore de vínculos espirituais.
          </p>
        </div>
        
        <div className="relative w-full sm:w-80">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full rounded-xl border-0 py-2.5 pl-10 pr-4 text-gray-900 ring-1 ring-inset ring-gray-200 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm shadow-sm transition-shadow hover:shadow-md"
            placeholder="Buscar líder ou discípulo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </header>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-4 sm:p-8 min-h-[500px] relative overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-10">
            <Loader2 className="h-10 w-10 animate-spin text-primary-600 mb-4" />
            <p className="text-sm text-gray-500 font-medium animate-pulse">Carregando conexões da rede...</p>
          </div>
        )}
        
        {!isLoading && tree.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-20">
             <div className="h-20 w-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                <NetworkIcon className="h-10 w-10 text-gray-400" />
             </div>
             <h3 className="text-lg font-bold text-gray-900">Nenhuma rede encontrada</h3>
             <p className="text-gray-500 mt-1 max-w-sm">Os dados de discipulado ainda não foram preenchidos ou não formam conexões válidas.</p>
          </div>
        )}

        <div className="flex flex-col gap-6">
          {tree.map((rootNode, i) => (
             <div key={`${rootNode.name}-${i}`} className="relative">
                <TreeNode node={rootNode} searchTerm={searchTerm} />
             </div>
          ))}
        </div>
      </div>
    </div>
  );
};
