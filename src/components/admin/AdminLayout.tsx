import { useState } from 'react';
import { LayoutDashboard, Users, MapPin, FileText, LogOut, Sun, Menu, X, Camera, Car, Fuel, BarChart3 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import AdminDashboard from './AdminDashboard';
import EmployeeTracking from './EmployeeTracking';
import EmployeeRegistration from './EmployeeRegistration';
import Reports from './Reports';
import PhotoRegistry from './PhotoRegistry';
import VehicleManagement from './VehicleManagement';
import FuelManagement from './FuelManagement';
import FuelReports from './FuelReports';

type MenuItem = 'dashboard' | 'tracking' | 'registration' | 'reports' | 'photos' | 'vehicles' | 'fuel' | 'fuel-reports';

export default function AdminLayout() {
  const [activeMenu, setActiveMenu] = useState<MenuItem>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { signOut, profile } = useAuth();

  const menuItems = [
    { id: 'dashboard' as MenuItem, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'tracking' as MenuItem, label: 'Acompanhar Colaboradores', icon: MapPin },
    { id: 'registration' as MenuItem, label: 'Cadastrar Colaborador', icon: Users },
    { id: 'photos' as MenuItem, label: 'Registro', icon: Camera },
    { id: 'reports' as MenuItem, label: 'Relatórios', icon: FileText },
    { id: 'vehicles' as MenuItem, label: 'Veículos', icon: Car },
    { id: 'fuel' as MenuItem, label: 'Abastecimentos', icon: Fuel },
    { id: 'fuel-reports' as MenuItem, label: 'Relatórios de Combustível', icon: BarChart3 },
  ];

  const renderContent = () => {
    switch (activeMenu) {
      case 'dashboard':
        return <AdminDashboard />;
      case 'tracking':
        return <EmployeeTracking />;
      case 'registration':
        return <EmployeeRegistration />;
      case 'photos':
        return <PhotoRegistry />;
      case 'reports':
        return <Reports />;
      case 'vehicles':
        return <VehicleManagement />;
      case 'fuel':
        return <FuelManagement />;
      case 'fuel-reports':
        return <FuelReports />;
      default:
        return <AdminDashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-3 bg-white rounded-lg shadow-lg text-gray-800"
        >
          {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-white shadow-xl transform transition-transform duration-300 z-40 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-3 rounded-lg">
              <Sun className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Ponto Digital</h1>
              <p className="text-xs text-gray-600">Admin</p>
            </div>
          </div>
        </div>

        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center text-white font-semibold">
              {profile?.full_name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">{profile?.full_name}</p>
              <p className="text-xs text-gray-600">Administrador</p>
            </div>
          </div>
        </div>

        <nav className="p-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveMenu(item.id);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition ${
                  activeMenu === item.id
                    ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium text-sm">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
          <button
            onClick={() => signOut()}
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 transition"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium text-sm">Sair</span>
          </button>
        </div>
      </aside>

      <main className="lg:ml-64 p-4 lg:p-8 pt-20 lg:pt-8">
        {renderContent()}
      </main>
    </div>
  );
}
