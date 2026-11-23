import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Erro inesperado na interface.',
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Erro capturado pelo ErrorBoundary:', error, errorInfo);
  }

  handleReload = () => {
    try {
      sessionStorage.removeItem('igrejapro_chunk_reload');
    } catch (_) {}
    window.location.reload();
  };

  handleClearCacheAndReload = () => {
    try {
      localStorage.removeItem('church_dynamic_roles');
      sessionStorage.clear();
    } catch (_) {}
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-gray-100 text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600 font-black text-xl">
              !
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Reconectando o Painel</h2>
              <p className="mt-1 text-xs text-gray-500 leading-relaxed">
                A conexão do celular oscilou ou uma nova atualização foi publicada. Toque abaixo para recarregar.
              </p>
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-700 transition-colors"
              >
                Recarregar Aplicativo
              </button>
              <button
                type="button"
                onClick={this.handleClearCacheAndReload}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Limpar Cache Local e Abrir Início
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
