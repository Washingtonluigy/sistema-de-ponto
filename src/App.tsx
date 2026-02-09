import { Component, ReactNode } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import AdminLayout from './components/admin/AdminLayout';
import EmployeeLayout from './components/employee/EmployeeLayout';
import InstallPrompt from './components/InstallPrompt';

class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    console.error('[ErrorBoundary] Erro capturado:', error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('[ErrorBoundary] Detalhes do erro:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Ops! Algo deu errado
            </h1>
            <p className="text-gray-600 mb-4">
              O aplicativo encontrou um erro. Tente recarregar a página.
            </p>
            {this.state.error && (
              <div className="mb-6 text-left bg-red-50 p-4 rounded-lg">
                <p className="text-xs font-mono text-red-800 break-words">
                  {this.state.error.toString()}
                </p>
                {this.state.error.stack && (
                  <details className="mt-2">
                    <summary className="text-xs text-red-600 cursor-pointer">
                      Stack trace
                    </summary>
                    <pre className="mt-2 text-xs text-red-600 overflow-auto max-h-40">
                      {this.state.error.stack}
                    </pre>
                  </details>
                )}
              </div>
            )}
            <button
              onClick={() => window.location.reload()}
              className="w-full px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg font-semibold hover:from-amber-600 hover:to-orange-600 transition shadow-lg"
            >
              Recarregar Página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function AppContent() {
  const { user, profile, loading } = useAuth();

  console.log('[APP] Estado:', {
    hasUser: !!user,
    hasProfile: !!profile,
    role: profile?.role,
    loading
  });

  if (loading) {
    console.log('[APP] Estado: Carregando...');
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-amber-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    console.log('[APP] Mostrando tela de login');
    return <Login />;
  }

  try {
    if (profile.role === 'admin') {
      console.log('[APP] Renderizando AdminLayout');
      return (
        <ErrorBoundary>
          <AdminLayout />
        </ErrorBoundary>
      );
    }

    console.log('[APP] Renderizando EmployeeLayout');
    return (
      <ErrorBoundary>
        <EmployeeLayout />
      </ErrorBoundary>
    );
  } catch (error) {
    console.error('[APP] Erro ao renderizar layout:', error);
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Erro ao Carregar</h1>
          <p className="text-gray-600 mb-6">Não foi possível carregar a interface. Tente novamente.</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg font-semibold hover:from-amber-600 hover:to-orange-600 transition shadow-lg"
          >
            Recarregar
          </button>
        </div>
      </div>
    );
  }
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
        <InstallPrompt />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
