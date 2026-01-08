import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import AdminLayout from './components/admin/AdminLayout';
import EmployeeLayout from './components/employee/EmployeeLayout';
import InstallPrompt from './components/InstallPrompt';

function AppContent() {
  const { user, profile, loading } = useAuth();

  if (loading) {
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
    return <Login />;
  }

  if (profile.role === 'admin') {
    return <AdminLayout />;
  }

  return <EmployeeLayout />;
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
      <InstallPrompt />
    </AuthProvider>
  );
}

export default App;
