import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Lock, Mail, ArrowRight, ArrowLeft, CheckCircle } from 'lucide-react';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Forgot Password state
  const [isReset, setIsReset] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

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

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/reset-password',
      });
      if (error) throw error;
      setResetSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Erro ao enviar link de recuperação.');
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
          <div className="w-28 h-28 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-500/30 mb-4">
            <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-20 h-20 text-white">
              {/* Estrela Guia */}
              <path d="M32 4 L33.5 10 L39 11.5 L33.5 13 L32 19 L30.5 13 L25 11.5 L30.5 10 Z" fill="currentColor" stroke="none" />
              
              {/* Figura Central (Jesus) */}
              <circle cx="32" cy="28" r="4" /> {/* Cabeça */}
              <path d="M32 32 L32 52" /> {/* Corpo */}
              <path d="M32 36 C24 36 18 42 16 46" /> {/* Braço Esquerdo Aberto */}
              <path d="M32 36 C40 36 46 42 48 46" /> {/* Braço Direito Aberto */}
              <path d="M28 32 Q32 30 36 32" strokeWidth="1" /> {/* Detalhe Manto */}

              {/* Círculo de Pessoas (Multidão) */}
              {/* Topo / Laterais */}
              <circle cx="20" cy="22" r="2.5" /> <path d="M17 28 Q20 26 23 28" />
              <circle cx="44" cy="22" r="2.5" /> <path d="M41 28 Q44 26 47 28" />
              
              {/* Meio */}
              <circle cx="14" cy="36" r="2" /> <path d="M12 42 Q14 40 16 42" />
              <circle cx="50" cy="36" r="2" /> <path d="M48 42 Q50 40 52 42" />
              
              {/* Base (Crianças e Adultos) */}
              <circle cx="18" cy="50" r="2.2" /> <path d="M15 56 Q18 54 21 56" />
              <circle cx="46" cy="50" r="2.2" /> <path d="M43 56 Q46 54 49 56" />
              <circle cx="26" cy="58" r="1.8" /> <path d="M24 62 Q26 61 28 62" />
              <circle cx="38" cy="58" r="1.8" /> <path d="M36 62 Q38 61 40 62" />
              
              {/* Pequenos pontos de brilho extras */}
              <circle cx="32" cy="32" r="15" strokeDasharray="2 6" opacity="0.3" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Igreja<span className="text-primary-600">Pro</span></h2>
          <p className="text-gray-500 mt-2 text-sm text-center">
            {isReset ? 'Recupere seu acesso ao painel.' : 'Entre para acessar as análises e métricas.'}
          </p>
        </div>

        {error && (
          <div className="p-3 mb-4 rounded-lg bg-red-50 text-red-600 text-sm border border-red-100 flex flex-col gap-1">
             <span className="font-semibold text-red-700">Atenção</span>
             {error}
          </div>
        )}

        {isReset ? (
          resetSuccess ? (
            <div className="text-center space-y-4 animate-in zoom-in-50 duration-500">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">E-mail Enviado!</h3>
              <p className="text-sm text-gray-500">
                Enviamos um link de redefinição de senha para <strong>{email}</strong>. Por favor, verifique sua caixa de entrada.
              </p>
              <button 
                onClick={() => { setIsReset(false); setResetSuccess(false); }}
                className="mt-4 text-sm font-semibold text-primary-600 hover:text-primary-700 flex items-center justify-center gap-1 mx-auto"
              >
                <ArrowLeft className="w-4 h-4" /> Voltar para o Login
              </button>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-6">
              <div>
                <label className="block text-sm font-medium leading-6 text-gray-900 mb-2">Seu E-mail</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full rounded-xl border-0 py-3 pl-10 pr-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6 bg-white/50 transition-all"
                    placeholder="exemplo@igreja.com"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-primary-500 px-4 py-3.5 text-sm font-semibold text-white shadow-md hover:from-primary-500 hover:to-primary-400 disabled:opacity-70 transition-all"
              >
                {loading ? 'Enviando...' : 'Enviar Link de Recuperação'}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>

              <button 
                type="button"
                onClick={() => setIsReset(false)}
                className="w-full text-sm font-semibold text-gray-500 hover:text-gray-700 flex items-center justify-center gap-1 mt-2"
              >
                <ArrowLeft className="w-4 h-4" /> Voltar para o Login
              </button>
            </form>
          )
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
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
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium leading-6 text-gray-900">Senha</label>
                <button 
                  type="button" 
                  onClick={() => setIsReset(true)}
                  className="text-xs font-semibold text-primary-600 hover:text-primary-500"
                >
                  Esqueceu a senha?
                </button>
              </div>
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
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-primary-500 px-4 py-3.5 text-sm font-semibold text-white shadow-md hover:from-primary-500 hover:to-primary-400 focus-visible:outline-primary-600 disabled:opacity-70 transition-all active:scale-[0.98]"
            >
              {loading ? 'Entrando...' : 'Entrar'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        )}

        <div className="mt-8 border-t border-gray-100 pt-6">
          <p className="text-xs text-gray-500 text-center mb-4 text-balance">
            Use seu email e senha cadastrados no sistema para acessar.
          </p>
        </div>
      </div>
    </div>
  );
};
