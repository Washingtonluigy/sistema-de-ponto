import { useEffect, useState } from 'react';
import { Clock, TrendingUp, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

export default function EmployeeStats() {
  const { user } = useAuth();
  const [overtime, setOvertime] = useState<number>(0);
  const [hourBank, setHourBank] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, [user]);

  const loadStats = async () => {
    if (!user) return;

    try {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      const { data } = await supabase
        .from('overtime_hours')
        .select('*')
        .eq('user_id', user.id)
        .eq('month', month)
        .eq('year', year)
        .maybeSingle();

      if (data) {
        setOvertime(data.overtime_hours || 0);
        setHourBank(data.hour_bank || 0);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
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
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Minhas Horas</h2>
        <p className="text-gray-600">Acompanhe suas horas extras e banco de horas</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Horas Extras</p>
                <p className="text-xs text-gray-500">Limite de 30h/mês</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-4xl font-bold text-gray-800">{overtime.toFixed(1)}</p>
                <p className="text-sm text-gray-600">de 30 horas</p>
              </div>
              <TrendingUp className="w-8 h-8 text-amber-600" />
            </div>

            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-gradient-to-r from-amber-500 to-orange-600 h-3 rounded-full transition-all duration-500"
                style={{ width: `${Math.min((overtime / 30) * 100, 100)}%` }}
              ></div>
            </div>

            <p className="text-xs text-gray-600">
              {overtime >= 30
                ? 'Limite atingido! Horas adicionais vão para o banco de horas.'
                : `Restam ${(30 - overtime).toFixed(1)} horas até o limite.`}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Banco de Horas</p>
                <p className="text-xs text-gray-500">Acima de 30h extras</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-4xl font-bold text-gray-800">{hourBank.toFixed(1)}</p>
                <p className="text-sm text-gray-600">horas acumuladas</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>

            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-sm text-green-800 font-medium mb-1">
                Como funciona?
              </p>
              <p className="text-xs text-green-700">
                As primeiras 30h extras são pagas. Horas acima disso são acumuladas no banco
                de horas para você usar como folga.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-6 border border-amber-200">
        <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center">
          <TrendingUp className="w-5 h-5 mr-2 text-amber-600" />
          Resumo do Mês
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-600 mb-1">Total Horas Extras</p>
            <p className="text-2xl font-bold text-gray-800">{overtime.toFixed(1)}h</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Banco de Horas</p>
            <p className="text-2xl font-bold text-gray-800">{hourBank.toFixed(1)}h</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Total Acumulado</p>
            <p className="text-2xl font-bold text-gray-800">{(overtime + hourBank).toFixed(1)}h</p>
          </div>
        </div>
      </div>
    </div>
  );
}
