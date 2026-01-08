import { useState, useEffect } from 'react';
import { Minus, Clock, Calendar, X, History } from 'lucide-react';
import { supabase, Profile } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface OvertimeData {
  overtime_hours: number;
  hour_bank: number;
}

interface HourBankAdjustment {
  id: string;
  user_id: string;
  admin_id: string;
  adjustment_type: 'hours' | 'days';
  hours_deducted: number;
  reason: string;
  created_at: string;
  profiles: {
    full_name: string;
  };
}

export default function HourBankDeduction() {
  const { profile } = useAuth();
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [adjustmentType, setAdjustmentType] = useState<'hours' | 'days'>('hours');
  const [amount, setAmount] = useState<number>(0);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [currentHourBank, setCurrentHourBank] = useState<number>(0);
  const [adjustmentHistory, setAdjustmentHistory] = useState<HourBankAdjustment[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    loadEmployees();
    if (showHistory) {
      loadAdjustmentHistory();
    }
  }, [showHistory]);

  useEffect(() => {
    if (selectedEmployee) {
      loadEmployeeHourBank(selectedEmployee);
    }
  }, [selectedEmployee]);

  const loadEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'employee')
        .order('full_name', { ascending: true });

      if (error) throw error;
      setEmployees(data || []);
    } catch (err: any) {
      console.error('Error loading employees:', err);
    }
  };

  const loadEmployeeHourBank = async (userId: string) => {
    try {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      const { data, error } = await supabase
        .from('overtime_hours')
        .select('overtime_hours, hour_bank')
        .eq('user_id', userId)
        .eq('month', month)
        .eq('year', year)
        .maybeSingle();

      if (error) throw error;
      setCurrentHourBank(data?.hour_bank || 0);
    } catch (err: any) {
      console.error('Error loading hour bank:', err);
      setCurrentHourBank(0);
    }
  };

  const loadAdjustmentHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('hour_bank_adjustments')
        .select(`
          *,
          profiles:user_id(full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setAdjustmentHistory(data || []);
    } catch (err: any) {
      console.error('Error loading adjustment history:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      if (!selectedEmployee) {
        throw new Error('Selecione um colaborador');
      }

      if (amount <= 0) {
        throw new Error('A quantidade deve ser maior que zero');
      }

      const hoursToDeduct = adjustmentType === 'days' ? amount * 24 : amount;

      if (hoursToDeduct > currentHourBank) {
        throw new Error(`Banco de horas insuficiente. Disponível: ${currentHourBank.toFixed(2)}h`);
      }

      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      const { data: currentData } = await supabase
        .from('overtime_hours')
        .select('hour_bank')
        .eq('user_id', selectedEmployee)
        .eq('month', month)
        .eq('year', year)
        .maybeSingle();

      const newHourBank = (currentData?.hour_bank || 0) - hoursToDeduct;

      const { error: updateError } = await supabase
        .from('overtime_hours')
        .update({ hour_bank: newHourBank })
        .eq('user_id', selectedEmployee)
        .eq('month', month)
        .eq('year', year);

      if (updateError) throw updateError;

      const { error: adjustmentError } = await supabase
        .from('hour_bank_adjustments')
        .insert({
          user_id: selectedEmployee,
          admin_id: profile?.id,
          adjustment_type: adjustmentType,
          hours_deducted: hoursToDeduct,
          reason: reason || 'Folga concedida',
        });

      if (adjustmentError) throw adjustmentError;

      setSuccess(true);
      setSelectedEmployee('');
      setAmount(0);
      setReason('');
      setCurrentHourBank(0);

      setTimeout(() => setSuccess(false), 5000);
    } catch (err: any) {
      setError(err.message || 'Erro ao processar baixa');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Baixa de Banco de Horas</h2>
          <p className="text-gray-600">Conceda folgas e gerencie o banco de horas dos colaboradores</p>
        </div>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
        >
          <History className="w-5 h-5" />
          <span>{showHistory ? 'Ocultar' : 'Ver'} Histórico</span>
        </button>
      </div>

      {showHistory && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Histórico de Baixas</h3>
          {adjustmentHistory.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Nenhuma baixa registrada</p>
          ) : (
            <div className="space-y-3">
              {adjustmentHistory.map((adj) => (
                <div key={adj.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-gray-800">{adj.profiles.full_name}</p>
                    <span className="text-sm text-gray-500">
                      {new Date(adj.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  <div className="flex items-center space-x-4 text-sm">
                    <span className="text-gray-600">
                      <span className="font-medium text-red-600">-{adj.hours_deducted.toFixed(2)}h</span>
                      {adj.adjustment_type === 'days' && ` (${(adj.hours_deducted / 24).toFixed(1)} dias)`}
                    </span>
                    {adj.reason && (
                      <span className="text-gray-500 italic">{adj.reason}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-lg p-8 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Selecionar Colaborador *
            </label>
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition"
              required
            >
              <option value="">Escolha um colaborador</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name} - {emp.job_position || 'Colaborador'}
                </option>
              ))}
            </select>
          </div>

          {selectedEmployee && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center space-x-2 text-blue-800">
                <Clock className="w-5 h-5" />
                <span className="font-semibold">
                  Banco de Horas Atual: {currentHourBank.toFixed(2)}h
                </span>
              </div>
              {currentHourBank > 0 && (
                <p className="text-sm text-blue-600 mt-1">
                  Equivalente a {(currentHourBank / 24).toFixed(1)} dias
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo de Baixa *
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setAdjustmentType('hours')}
                className={`p-4 rounded-lg border-2 transition ${
                  adjustmentType === 'hours'
                    ? 'border-amber-500 bg-amber-50'
                    : 'border-gray-300 bg-white hover:border-amber-300'
                }`}
              >
                <Clock className={`w-8 h-8 mx-auto mb-2 ${
                  adjustmentType === 'hours' ? 'text-amber-600' : 'text-gray-400'
                }`} />
                <p className="font-semibold text-gray-800">Por Horas</p>
                <p className="text-xs text-gray-600">Descontar quantidade exata de horas</p>
              </button>

              <button
                type="button"
                onClick={() => setAdjustmentType('days')}
                className={`p-4 rounded-lg border-2 transition ${
                  adjustmentType === 'days'
                    ? 'border-amber-500 bg-amber-50'
                    : 'border-gray-300 bg-white hover:border-amber-300'
                }`}
              >
                <Calendar className={`w-8 h-8 mx-auto mb-2 ${
                  adjustmentType === 'days' ? 'text-amber-600' : 'text-gray-400'
                }`} />
                <p className="font-semibold text-gray-800">Por Dias</p>
                <p className="text-xs text-gray-600">Cada dia = 24 horas</p>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quantidade {adjustmentType === 'hours' ? 'de Horas' : 'de Dias'} *
            </label>
            <input
              type="number"
              value={amount || ''}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition"
              placeholder={adjustmentType === 'hours' ? '8.0' : '1'}
              step={adjustmentType === 'hours' ? '0.5' : '0.5'}
              min="0.5"
              required
            />
            {amount > 0 && (
              <p className="text-sm text-gray-600 mt-1">
                {adjustmentType === 'hours'
                  ? `= ${amount}h serão descontadas`
                  : `= ${amount * 24}h serão descontadas (${amount} dias)`
                }
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Motivo (opcional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition resize-none"
              placeholder="Ex: Folga por banco de horas"
              rows={3}
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm flex items-center justify-between">
              <span>{error}</span>
              <button onClick={() => setError('')} className="text-red-800 hover:text-red-900">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {success && (
            <div className="bg-green-50 text-green-600 px-4 py-3 rounded-lg text-sm flex items-center justify-between">
              <span>Baixa de banco de horas realizada com sucesso!</span>
              <button onClick={() => setSuccess(false)} className="text-green-800 hover:text-green-900">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !selectedEmployee || amount <= 0}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white py-3 rounded-lg font-semibold hover:from-amber-600 hover:to-orange-700 transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            <Minus className="w-5 h-5" />
            <span>{loading ? 'Processando...' : 'Realizar Baixa'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
