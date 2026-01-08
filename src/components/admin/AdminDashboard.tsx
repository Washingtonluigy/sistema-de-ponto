import { useEffect, useState } from 'react';
import { Users, Clock, Activity, TrendingUp } from 'lucide-react';
import { supabase, ActiveSession, Profile } from '../../lib/supabase';

type DashboardStats = {
  activeUsers: number;
  totalEmployees: number;
  todayEntries: number;
  avgWorkHours: number;
};

type ActiveUserWithProfile = ActiveSession & {
  profile: Profile;
};

type EmployeeHours = {
  employee_id: string;
  full_name: string;
  total_hours: number;
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    activeUsers: 0,
    totalEmployees: 0,
    todayEntries: 0,
    avgWorkHours: 0,
  });
  const [activeUsers, setActiveUsers] = useState<ActiveUserWithProfile[]>([]);
  const [employeeHours, setEmployeeHours] = useState<EmployeeHours[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];

      const [sessionsRes, profilesRes, entriesRes, allEntriesRes] = await Promise.all([
        supabase
          .from('active_sessions')
          .select('*, profile:profiles(*)'),
        supabase
          .from('profiles')
          .select('count', { count: 'exact', head: true })
          .eq('role', 'employee'),
        supabase
          .from('time_entries')
          .select('total_hours')
          .gte('created_at', today),
        supabase
          .from('time_entries')
          .select('user_id, total_hours, profiles!inner(full_name)')
          .not('total_hours', 'is', null)
          .gte('created_at', today),
      ]);

      const activeSessions = sessionsRes.data || [];
      const totalEmployees = profilesRes.count || 0;
      const todayEntries = entriesRes.data?.length || 0;
      const avgHours = entriesRes.data?.reduce((sum, entry) => sum + Number(entry.total_hours), 0) / (todayEntries || 1);

      setStats({
        activeUsers: activeSessions.length,
        totalEmployees,
        todayEntries,
        avgWorkHours: Math.round(avgHours * 10) / 10,
      });

      setActiveUsers(activeSessions as ActiveUserWithProfile[]);

      const hoursMap = new Map<string, { name: string; hours: number }>();
      allEntriesRes.data?.forEach((entry: any) => {
        const current = hoursMap.get(entry.user_id) || { name: entry.profiles.full_name, hours: 0 };
        current.hours += Number(entry.total_hours || 0);
        hoursMap.set(entry.user_id, current);
      });

      const hours = Array.from(hoursMap.entries())
        .map(([id, data]) => ({
          employee_id: id,
          full_name: data.name,
          total_hours: Math.round(data.hours * 10) / 10,
        }))
        .sort((a, b) => b.total_hours - a.total_hours)
        .slice(0, 10);

      setEmployeeHours(hours);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Dashboard</h2>
        <p className="text-gray-600">Visão geral do sistema de ponto</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm font-medium">Usuários Ativos</p>
              <p className="text-3xl font-bold mt-2">{stats.activeUsers}</p>
            </div>
            <Activity className="w-12 h-12 text-green-100 opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-amber-100 text-sm font-medium">Total Colaboradores</p>
              <p className="text-3xl font-bold mt-2">{stats.totalEmployees}</p>
            </div>
            <Users className="w-12 h-12 text-amber-100 opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">Registros Hoje</p>
              <p className="text-3xl font-bold mt-2">{stats.todayEntries}</p>
            </div>
            <Clock className="w-12 h-12 text-blue-100 opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-teal-100 text-sm font-medium">Média Horas Hoje</p>
              <p className="text-3xl font-bold mt-2">{stats.avgWorkHours}h</p>
            </div>
            <TrendingUp className="w-12 h-12 text-teal-100 opacity-80" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Horas Trabalhadas Hoje</h3>
          {employeeHours.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Nenhum registro de horas hoje</p>
          ) : (
            <div className="space-y-3">
              {employeeHours.map((emp) => {
                const maxHours = Math.max(...employeeHours.map(e => e.total_hours));
                const percentage = (emp.total_hours / maxHours) * 100;
                return (
                  <div key={emp.employee_id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-gray-800 text-sm">{emp.full_name}</p>
                      <p className="text-sm font-bold text-amber-600">{emp.total_hours}h</p>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-orange-600 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Colaboradores Ativos Agora</h3>
          {activeUsers.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Nenhum colaborador ativo no momento</p>
          ) : (
            <div className="space-y-3">
              {activeUsers.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center text-white font-semibold">
                      {session.profile?.full_name?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">{session.profile?.full_name}</p>
                      <p className="text-sm text-gray-600">{session.profile?.job_position}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-800">
                      Entrada: {new Date(session.clock_in_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <p className="text-xs text-green-600 flex items-center justify-end mt-1">
                      <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                      Ativo
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
