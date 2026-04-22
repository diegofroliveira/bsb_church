import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Church, Lock, Mail, ArrowRight } from 'lucide-react';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary-50 via-gray-50 to-white relative overflow-hidden">
      
      {/* Background Decorations */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary-200/50 blur-3xl opacity-50"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-300/30 blur-3xl opacity-50"></div>

      <div className="w-full max-w-md p-8 bg-white/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/40 z-10 mx-4">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-500/30 mb-4">
            <Church className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Igreja<span className="text-primary-600">Pro</span></h2>
          <p className="text-gray-500 mt-2 text-sm text-center">Entre para acessar as análises e métricas.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm border border-red-100 flex flex-col gap-1">
               <span className="font-semibold text-red-700">Erro no Login</span>
               {error}
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium leading-6 text-gray-900 mb-2">Email</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full rounded-xl border-0 py-3 pl-10 pr-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6 bg-white/50 transition-all"
                placeholder="seuemail@igreja.com"
                required
              />
            </div>
          </div>

          <div>
             <label className="block text-sm font-medium leading-6 text-gray-900 mb-2">Senha</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full rounded-xl border-0 py-3 pl-10 pr-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6 bg-white/50 transition-all"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-primary-500 px-4 py-3.5 text-sm font-semibold text-white shadow-md hover:from-primary-500 hover:to-primary-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 disabled:opacity-70 transition-all active:scale-[0.98]"
          >
            {loading ? 'Entrando...' : 'Entrar'}
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        <div className="mt-8 border-t border-gray-100 pt-6">
          <p className="text-xs text-gray-500 text-center mb-4 text-balance">
            Use seu email e senha cadastrados no Supabase para acessar.
          </p>
        </div>
      </div>
    </div>
  );
};
