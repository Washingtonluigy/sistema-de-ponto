import { useState, useEffect } from 'react';
import { Clock, Plus, Minus, DollarSign, History, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import Modal from '../Modal';

type Employee = {
  id: string;
  full_name: string;
  overtime_hours: number;
  hour_bank_hours: number;
  adjustments: number;
  payments: number;
  bank_adjustments: number;
};

type AdjustmentHistory = {
  id: string;
  hours: number;
  reason: string;
  month: number;
  year: number;
  created_at: string;
  admin_name: string;
};

type PaymentHistory = {
  id: string;
  hours_paid: number;
  payment_date: string;
  month: number;
  year: number;
  notes: string;
  created_at: string;
  admin_name: string;
};

type BankAdjustmentHistory = {
  id: string;
  hours_deducted: number;
  adjustment_type: string;
  reason: string;
  month: number;
  year: number;
  created_at: string;
  admin_name: string;
};

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export default function OvertimeManagement() {
  const { profile } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'adjustment' | 'payment' | 'bank' | 'history'>('adjustment');

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const [adjustmentHours, setAdjustmentHours] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [adjustmentMonth, setAdjustmentMonth] = useState(now.getMonth() + 1);
  const [adjustmentYear, setAdjustmentYear] = useState(now.getFullYear());

  const [paymentHours, setPaymentHours] = useState('');
  const [paymentDate, setPaymentDate] = useState(now.toISOString().split('T')[0]);
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentMonth, setPaymentMonth] = useState(now.getMonth() + 1);
  const [paymentYear, setPaymentYear] = useState(now.getFullYear());

  const [bankHours, setBankHours] = useState('');
  const [bankType, setBankType] = useState<'hours' | 'days'>('hours');
  const [bankReason, setBankReason] = useState('');
  const [bankMonth, setBankMonth] = useState(now.getMonth() + 1);
  const [bankYear, setBankYear] = useState(now.getFullYear());

  const [adjustmentHistory, setAdjustmentHistory] = useState<AdjustmentHistory[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);
  const [bankHistory, setBankHistory] = useState<BankAdjustmentHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    loadEmployees();
  }, [selectedMonth, selectedYear]);

  const loadEmployees = async () => {
    try {
      setLoading(true);

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'employee')
        .order('full_name');

      if (profilesError) throw profilesError;

      const employeeData = await Promise.all(
        (profiles || []).map(async (p) => {
          const stats = await calculateEmployeeStats(p.id, selectedMonth, selectedYear);
          return {
            id: p.id,
            full_name: p.full_name,
            ...stats
          };
        })
      );

      setEmployees(employeeData);
    } catch (error) {
      console.error('Erro ao carregar colaboradores:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateEmployeeStats = async (userId: string, month: number, year: number) => {
    try {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      const { data: entries } = await supabase
        .from('time_entries')
        .select('worked_hours, overtime_hours, overtime_added_to_bank')
        .eq('user_id', userId)
        .gte('clock_in', startDate.toISOString())
        .lte('clock_in', endDate.toISOString());

      const { data: adjustments } = await supabase
        .from('overtime_adjustments')
        .select('hours')
        .eq('user_id', userId)
        .eq('month', month)
        .eq('year', year);

      const { data: payments } = await supabase
        .from('overtime_payments')
        .select('hours_paid')
        .eq('user_id', userId)
        .eq('month', month)
        .eq('year', year);

      const { data: bankAdjustments } = await supabase
        .from('hour_bank_adjustments')
        .select('hours_deducted')
        .eq('user_id', userId)
        .eq('month', month)
        .eq('year', year);

      const baseOvertime = entries?.reduce((sum, e) => {
        return sum + (e.overtime_added_to_bank ? 0 : e.overtime_hours || 0);
      }, 0) || 0;

      const totalAdjustments = adjustments?.reduce((sum, a) => sum + a.hours, 0) || 0;
      const totalPayments = payments?.reduce((sum, p) => sum + p.hours_paid, 0) || 0;

      const hourBank = entries?.reduce((sum, e) => {
        return sum + (e.overtime_added_to_bank ? e.overtime_hours || 0 : 0);
      }, 0) || 0;

      const totalBankAdjustments = bankAdjustments?.reduce((sum, a) => sum + a.hours_deducted, 0) || 0;

      return {
        overtime_hours: baseOvertime + totalAdjustments - totalPayments,
        hour_bank_hours: hourBank - totalBankAdjustments,
        adjustments: totalAdjustments,
        payments: totalPayments,
        bank_adjustments: totalBankAdjustments
      };
    } catch (error) {
      console.error('Erro ao calcular estatísticas:', error);
      return {
        overtime_hours: 0,
        hour_bank_hours: 0,
        adjustments: 0,
        payments: 0,
        bank_adjustments: 0
      };
    }
  };

  const openModal = (employee: Employee, type: 'adjustment' | 'payment' | 'bank' | 'history') => {
    setSelectedEmployee(employee);
    setModalType(type);
    setShowModal(true);

    if (type === 'history') {
      loadHistory(employee.id);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedEmployee(null);
    setAdjustmentHours('');
    setAdjustmentReason('');
    setPaymentHours('');
    setPaymentNotes('');
    setBankHours('');
    setBankReason('');
  };

  const loadHistory = async (userId: string) => {
    try {
      setHistoryLoading(true);

      const { data: adjData } = await supabase
        .from('overtime_adjustments')
        .select(`
          id,
          hours,
          reason,
          month,
          year,
          created_at,
          admin:admin_id(full_name)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      const { data: payData } = await supabase
        .from('overtime_payments')
        .select(`
          id,
          hours_paid,
          payment_date,
          month,
          year,
          notes,
          created_at,
          admin:admin_id(full_name)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      const { data: bankData } = await supabase
        .from('hour_bank_adjustments')
        .select(`
          id,
          hours_deducted,
          adjustment_type,
          reason,
          month,
          year,
          created_at,
          admin:admin_id(full_name)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      setAdjustmentHistory(adjData?.map(a => ({
        ...a,
        admin_name: (a.admin as any)?.full_name || 'Admin'
      })) || []);

      setPaymentHistory(payData?.map(p => ({
        ...p,
        admin_name: (p.admin as any)?.full_name || 'Admin'
      })) || []);

      setBankHistory(bankData?.map(b => ({
        ...b,
        admin_name: (b.admin as any)?.full_name || 'Admin'
      })) || []);

    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleAdjustment = async () => {
    if (!selectedEmployee || !adjustmentHours || !adjustmentReason) return;

    try {
      const { error } = await supabase
        .from('overtime_adjustments')
        .insert({
          user_id: selectedEmployee.id,
          admin_id: profile?.id,
          hours: parseFloat(adjustmentHours),
          reason: adjustmentReason,
          month: adjustmentMonth,
          year: adjustmentYear
        });

      if (error) throw error;

      closeModal();
      await loadEmployees();
      alert('Ajuste registrado com sucesso!');
    } catch (error) {
      console.error('Erro ao adicionar ajuste:', error);
      alert('Erro ao adicionar ajuste');
    }
  };

  const handlePayment = async () => {
    if (!selectedEmployee || !paymentHours) return;

    try {
      const { error } = await supabase
        .from('overtime_payments')
        .insert({
          user_id: selectedEmployee.id,
          admin_id: profile?.id,
          hours_paid: parseFloat(paymentHours),
          payment_date: paymentDate,
          notes: paymentNotes,
          month: paymentMonth,
          year: paymentYear
        });

      if (error) throw error;

      closeModal();
      await loadEmployees();
      alert('Pagamento registrado com sucesso!');
    } catch (error) {
      console.error('Erro ao registrar pagamento:', error);
      alert('Erro ao registrar pagamento');
    }
  };

  const handleBankAdjustment = async () => {
    if (!selectedEmployee || !bankHours || !bankReason) return;

    try {
      const hoursToDeduct = bankType === 'days'
        ? parseFloat(bankHours) * 8
        : parseFloat(bankHours);

      const { error } = await supabase
        .from('hour_bank_adjustments')
        .insert({
          user_id: selectedEmployee.id,
          admin_id: profile?.id,
          adjustment_type: bankType,
          hours_deducted: hoursToDeduct,
          reason: bankReason,
          month: bankMonth,
          year: bankYear
        });

      if (error) throw error;

      closeModal();
      await loadEmployees();
      alert('Ajuste de banco de horas registrado com sucesso!');
    } catch (error) {
      console.error('Erro ao ajustar banco de horas:', error);
      alert('Erro ao ajustar banco de horas');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando colaboradores...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl text-white">
            <Clock className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900">Gerenciar Horas Extras</h2>
            <p className="text-sm text-gray-600">Ajustes manuais e pagamentos</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            >
              {MONTHS.map((month, index) => (
                <option key={index + 1} value={index + 1}>
                  {month}
                </option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            >
              {[2024, 2025, 2026, 2027].map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex gap-2">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-blue-900 font-medium">Sobre os ajustes</p>
              <p className="text-xs text-blue-700 mt-1">
                Ajustes positivos adicionam horas extras. Ajustes negativos removem horas.
                Pagamentos deduzem das horas extras. Ajustes de banco de horas descontam do banco.
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Colaborador</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-700">Horas Extras</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-700">Banco de Horas</th>
                <th className="text-center py-3 px-4 font-semibold text-gray-700">Ações</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <tr key={employee.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-4 px-4">
                    <div className="font-medium text-gray-900">{employee.full_name}</div>
                    <div className="text-xs text-gray-500">
                      Ajustes: {employee.adjustments.toFixed(1)}h | Pagos: {employee.payments.toFixed(1)}h
                    </div>
                  </td>
                  <td className="text-center py-4 px-4">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      employee.overtime_hours > 0
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {employee.overtime_hours.toFixed(1)}h
                    </span>
                  </td>
                  <td className="text-center py-4 px-4">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      employee.hour_bank_hours > 0
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {employee.hour_bank_hours.toFixed(1)}h
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => openModal(employee, 'adjustment')}
                        className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition"
                        title="Ajustar horas extras"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openModal(employee, 'payment')}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition"
                        title="Registrar pagamento"
                      >
                        <DollarSign className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openModal(employee, 'bank')}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        title="Ajustar banco de horas"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openModal(employee, 'history')}
                        className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition"
                        title="Ver histórico"
                      >
                        <History className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && selectedEmployee && (
        <Modal isOpen={showModal} onClose={closeModal}>
          <div className="p-6">
            {modalType === 'adjustment' && (
              <>
                <h3 className="text-xl font-bold text-gray-900 mb-4">
                  Ajustar Horas Extras - {selectedEmployee.full_name}
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Mês
                      </label>
                      <select
                        value={adjustmentMonth}
                        onChange={(e) => setAdjustmentMonth(parseInt(e.target.value))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      >
                        {MONTHS.map((month, index) => (
                          <option key={index + 1} value={index + 1}>
                            {month}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Ano
                      </label>
                      <select
                        value={adjustmentYear}
                        onChange={(e) => setAdjustmentYear(parseInt(e.target.value))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      >
                        {[2024, 2025, 2026, 2027].map(year => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Horas (positivo adiciona, negativo remove)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={adjustmentHours}
                      onChange={(e) => setAdjustmentHours(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      placeholder="Ex: 5 ou -3"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Motivo
                    </label>
                    <textarea
                      value={adjustmentReason}
                      onChange={(e) => setAdjustmentReason(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      rows={3}
                      placeholder="Descreva o motivo do ajuste..."
                    />
                  </div>
                  <button
                    onClick={handleAdjustment}
                    disabled={!adjustmentHours || !adjustmentReason}
                    className="w-full px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg font-semibold hover:from-amber-600 hover:to-orange-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Confirmar Ajuste
                  </button>
                </div>
              </>
            )}

            {modalType === 'payment' && (
              <>
                <h3 className="text-xl font-bold text-gray-900 mb-4">
                  Registrar Pagamento - {selectedEmployee.full_name}
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Mês
                      </label>
                      <select
                        value={paymentMonth}
                        onChange={(e) => setPaymentMonth(parseInt(e.target.value))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      >
                        {MONTHS.map((month, index) => (
                          <option key={index + 1} value={index + 1}>
                            {month}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Ano
                      </label>
                      <select
                        value={paymentYear}
                        onChange={(e) => setPaymentYear(parseInt(e.target.value))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      >
                        {[2024, 2025, 2026, 2027].map(year => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Horas Pagas
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={paymentHours}
                      onChange={(e) => setPaymentHours(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="Ex: 10"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Data do Pagamento
                    </label>
                    <input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Observações
                    </label>
                    <textarea
                      value={paymentNotes}
                      onChange={(e) => setPaymentNotes(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      rows={3}
                      placeholder="Observações sobre o pagamento..."
                    />
                  </div>
                  <button
                    onClick={handlePayment}
                    disabled={!paymentHours}
                    className="w-full px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg font-semibold hover:from-green-600 hover:to-emerald-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Confirmar Pagamento
                  </button>
                </div>
              </>
            )}

            {modalType === 'bank' && (
              <>
                <h3 className="text-xl font-bold text-gray-900 mb-4">
                  Ajustar Banco de Horas - {selectedEmployee.full_name}
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Mês
                      </label>
                      <select
                        value={bankMonth}
                        onChange={(e) => setBankMonth(parseInt(e.target.value))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        {MONTHS.map((month, index) => (
                          <option key={index + 1} value={index + 1}>
                            {month}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Ano
                      </label>
                      <select
                        value={bankYear}
                        onChange={(e) => setBankYear(parseInt(e.target.value))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        {[2024, 2025, 2026, 2027].map(year => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tipo de Ajuste
                    </label>
                    <select
                      value={bankType}
                      onChange={(e) => setBankType(e.target.value as 'hours' | 'days')}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="hours">Horas</option>
                      <option value="days">Dias (8h cada)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Quantidade a Descontar
                    </label>
                    <input
                      type="number"
                      step={bankType === 'days' ? '0.5' : '1'}
                      min="0"
                      value={bankHours}
                      onChange={(e) => setBankHours(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder={bankType === 'days' ? 'Ex: 1 (8 horas)' : 'Ex: 8'}
                    />
                    {bankType === 'days' && bankHours && (
                      <p className="text-xs text-gray-500 mt-1">
                        = {(parseFloat(bankHours) * 8).toFixed(1)} horas
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Motivo
                    </label>
                    <textarea
                      value={bankReason}
                      onChange={(e) => setBankReason(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={3}
                      placeholder="Descreva o motivo do ajuste..."
                    />
                  </div>
                  <button
                    onClick={handleBankAdjustment}
                    disabled={!bankHours || !bankReason}
                    className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-cyan-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Confirmar Ajuste
                  </button>
                </div>
              </>
            )}

            {modalType === 'history' && (
              <>
                <h3 className="text-xl font-bold text-gray-900 mb-4">
                  Histórico - {selectedEmployee.full_name}
                </h3>
                {historyLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600 mx-auto"></div>
                    <p className="mt-2 text-gray-600">Carregando histórico...</p>
                  </div>
                ) : (
                  <div className="space-y-6 max-h-96 overflow-y-auto">
                    {adjustmentHistory.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-2">Ajustes de Horas Extras</h4>
                        <div className="space-y-2">
                          {adjustmentHistory.map((adj) => (
                            <div key={adj.id} className="bg-amber-50 p-3 rounded-lg">
                              <div className="flex justify-between items-start mb-1">
                                <span className={`font-semibold ${adj.hours > 0 ? 'text-green-700' : 'text-red-700'}`}>
                                  {adj.hours > 0 ? '+' : ''}{adj.hours}h
                                </span>
                                <span className="text-xs text-gray-500">
                                  {MONTHS[adj.month - 1]}/{adj.year}
                                </span>
                              </div>
                              <p className="text-sm text-gray-700">{adj.reason}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                Por: {adj.admin_name} em {new Date(adj.created_at).toLocaleString('pt-BR')}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {paymentHistory.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-2">Pagamentos</h4>
                        <div className="space-y-2">
                          {paymentHistory.map((pay) => (
                            <div key={pay.id} className="bg-green-50 p-3 rounded-lg">
                              <div className="flex justify-between items-start mb-1">
                                <span className="font-semibold text-green-700">{pay.hours_paid}h pagas</span>
                                <span className="text-xs text-gray-500">
                                  {MONTHS[pay.month - 1]}/{pay.year}
                                </span>
                              </div>
                              {pay.notes && <p className="text-sm text-gray-700">{pay.notes}</p>}
                              <p className="text-xs text-gray-500 mt-1">
                                Por: {pay.admin_name} em {new Date(pay.payment_date).toLocaleDateString('pt-BR')}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {bankHistory.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-2">Ajustes de Banco de Horas</h4>
                        <div className="space-y-2">
                          {bankHistory.map((bank) => (
                            <div key={bank.id} className="bg-blue-50 p-3 rounded-lg">
                              <div className="flex justify-between items-start mb-1">
                                <span className="font-semibold text-blue-700">
                                  -{bank.hours_deducted}h ({bank.adjustment_type === 'days' ? `${bank.hours_deducted / 8} dias` : 'horas'})
                                </span>
                                <span className="text-xs text-gray-500">
                                  {MONTHS[bank.month - 1]}/{bank.year}
                                </span>
                              </div>
                              <p className="text-sm text-gray-700">{bank.reason}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                Por: {bank.admin_name} em {new Date(bank.created_at).toLocaleString('pt-BR')}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {adjustmentHistory.length === 0 && paymentHistory.length === 0 && bankHistory.length === 0 && (
                      <p className="text-center text-gray-500 py-8">Nenhum histórico encontrado</p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
