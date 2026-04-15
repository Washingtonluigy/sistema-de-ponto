import { useState, useEffect } from 'react';
import { Clock, Plus, CreditCard as Edit2, Trash2, ChevronDown, ChevronRight, AlertCircle, Calendar, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import Modal from '../Modal';
import SuccessToast from '../SuccessToast';

type Employee = {
  id: string;
  full_name: string;
  job_position: string | null;
  work_hours: number;
};

type TimeEntry = {
  id: string;
  user_id: string;
  clock_in: string;
  clock_out: string | null;
  notes: string | null;
  worked_hours: number;
  is_manual?: boolean;
};

type DayGroup = {
  dateKey: string;
  dateDisplay: string;
  weekday: string;
  entries: TimeEntry[];
  totalHours: number;
};

type EmployeeStats = {
  employee: Employee;
  totalHours: number;
  totalDays: number;
  expanded: boolean;
  dayGroups: DayGroup[];
  loadingDetails: boolean;
};

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

function calcHours(clockIn: string, clockOut: string): number {
  const start = new Date(clockIn).getTime();
  const end = new Date(clockOut).getTime();
  return Math.max(0, (end - start) / (1000 * 60 * 60));
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}

function getWeekday(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { weekday: 'long' });
}

function toLocalDatetimeValue(iso: string): string {
  const d = new Date(iso);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${mins}`;
}

export default function WorkedHoursManagement() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [employeeStats, setEmployeeStats] = useState<EmployeeStats[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [targetEmployee, setTargetEmployee] = useState<Employee | null>(null);
  const [targetEntry, setTargetEntry] = useState<TimeEntry | null>(null);

  const [addDate, setAddDate] = useState('');
  const [addClockIn, setAddClockIn] = useState('08:00');
  const [addClockOut, setAddClockOut] = useState('17:00');
  const [addNotes, setAddNotes] = useState('');

  const [editClockIn, setEditClockIn] = useState('');
  const [editClockOut, setEditClockOut] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    loadEmployees();
  }, [selectedMonth, selectedYear]);

  const loadEmployees = async () => {
    setLoading(true);
    try {
      const startDate = new Date(selectedYear, selectedMonth - 1, 1);
      const endDate = new Date(selectedYear, selectedMonth, 0, 23, 59, 59);

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, job_position, work_hours')
        .eq('role', 'employee')
        .order('full_name');

      const { data: entries } = await supabase
        .from('time_entries')
        .select('id, user_id, clock_in, clock_out, notes, worked_hours')
        .gte('clock_in', startDate.toISOString())
        .lte('clock_in', endDate.toISOString());

      const stats: EmployeeStats[] = (profiles || []).map((p) => {
        const empEntries = (entries || []).filter(e => e.user_id === p.id && e.clock_out);
        const totalHours = empEntries.reduce((sum, e) => sum + calcHours(e.clock_in, e.clock_out!), 0);
        const uniqueDays = new Set(empEntries.map(e => formatDate(e.clock_in))).size;

        return {
          employee: { ...p, work_hours: p.work_hours || 8 },
          totalHours,
          totalDays: uniqueDays,
          expanded: false,
          dayGroups: [],
          loadingDetails: false,
        };
      });

      setEmployeeStats(stats);
    } catch (error) {
      console.error('Erro ao carregar colaboradores:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleEmployee = async (index: number) => {
    const stat = employeeStats[index];

    if (stat.expanded) {
      setEmployeeStats(prev => prev.map((s, i) => i === index ? { ...s, expanded: false } : s));
      return;
    }

    setEmployeeStats(prev => prev.map((s, i) => i === index ? { ...s, expanded: true, loadingDetails: true } : s));

    try {
      const startDate = new Date(selectedYear, selectedMonth - 1, 1);
      const endDate = new Date(selectedYear, selectedMonth, 0, 23, 59, 59);

      const { data: entries } = await supabase
        .from('time_entries')
        .select('id, user_id, clock_in, clock_out, notes, worked_hours')
        .eq('user_id', stat.employee.id)
        .gte('clock_in', startDate.toISOString())
        .lte('clock_in', endDate.toISOString())
        .order('clock_in', { ascending: true });

      const grouped = new Map<string, TimeEntry[]>();
      (entries || []).forEach(e => {
        const key = formatDate(e.clock_in);
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(e);
      });

      const dayGroups: DayGroup[] = Array.from(grouped.entries()).map(([dateKey, dayEntries]) => ({
        dateKey,
        dateDisplay: dateKey,
        weekday: getWeekday(dayEntries[0].clock_in),
        entries: dayEntries,
        totalHours: dayEntries.filter(e => e.clock_out).reduce((sum, e) => sum + calcHours(e.clock_in, e.clock_out!), 0),
      })).sort((a, b) => {
        const [da, ma, ya] = a.dateKey.split('/').map(Number);
        const [db, mb, yb] = b.dateKey.split('/').map(Number);
        return new Date(ya, ma - 1, da).getTime() - new Date(yb, mb - 1, db).getTime();
      });

      setEmployeeStats(prev => prev.map((s, i) => i === index ? { ...s, dayGroups, loadingDetails: false } : s));
    } catch (error) {
      console.error('Erro ao carregar detalhes:', error);
      setEmployeeStats(prev => prev.map((s, i) => i === index ? { ...s, loadingDetails: false } : s));
    }
  };

  const openAddModal = (employee: Employee) => {
    setTargetEmployee(employee);
    const today = new Date();
    setAddDate(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`);
    setAddClockIn('08:00');
    setAddClockOut('17:00');
    setAddNotes('');
    setShowAddModal(true);
  };

  const openEditModal = (entry: TimeEntry) => {
    setTargetEntry(entry);
    setEditClockIn(toLocalDatetimeValue(entry.clock_in));
    setEditClockOut(entry.clock_out ? toLocalDatetimeValue(entry.clock_out) : '');
    setEditNotes(entry.notes || '');
    setShowEditModal(true);
  };

  const openDeleteConfirm = (entry: TimeEntry) => {
    setTargetEntry(entry);
    setShowDeleteConfirm(true);
  };

  const handleAdd = async () => {
    if (!targetEmployee || !addDate || !addClockIn || !addClockOut) return;
    setSaving(true);
    try {
      const clockInISO = new Date(`${addDate}T${addClockIn}:00`).toISOString();
      const clockOutISO = new Date(`${addDate}T${addClockOut}:00`).toISOString();
      const hours = calcHours(clockInISO, clockOutISO);

      const { error } = await supabase.from('time_entries').insert({
        user_id: targetEmployee.id,
        clock_in: clockInISO,
        clock_out: clockOutISO,
        worked_hours: hours,
        total_hours: hours,
        notes: addNotes || 'Lançamento manual pelo administrador',
        is_overtime: false,
      });

      if (error) throw error;

      setShowAddModal(false);
      await loadEmployees();
      await refreshExpandedEmployee(targetEmployee.id);
      setSuccessMessage('Registro de ponto adicionado com sucesso!');
      setShowSuccessToast(true);
    } catch (error) {
      console.error('Erro ao adicionar registro:', error);
      alert('Erro ao adicionar registro');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!targetEntry || !editClockIn) return;
    setSaving(true);
    try {
      const clockInISO = new Date(editClockIn).toISOString();
      const clockOutISO = editClockOut ? new Date(editClockOut).toISOString() : null;
      const hours = clockOutISO ? calcHours(clockInISO, clockOutISO) : 0;

      const { error } = await supabase
        .from('time_entries')
        .update({
          clock_in: clockInISO,
          clock_out: clockOutISO,
          worked_hours: hours,
          total_hours: hours,
          notes: editNotes || null,
        })
        .eq('id', targetEntry.id);

      if (error) throw error;

      setShowEditModal(false);
      const empIndex = employeeStats.findIndex(s => s.dayGroups.some(d => d.entries.some(e => e.id === targetEntry.id)));
      if (empIndex >= 0) await refreshExpandedEmployee(employeeStats[empIndex].employee.id);
      await loadEmployees();
      setSuccessMessage('Registro atualizado com sucesso!');
      setShowSuccessToast(true);
    } catch (error) {
      console.error('Erro ao editar registro:', error);
      alert('Erro ao editar registro');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!targetEntry) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('time_entries').delete().eq('id', targetEntry.id);
      if (error) throw error;

      setShowDeleteConfirm(false);
      const empIndex = employeeStats.findIndex(s => s.dayGroups.some(d => d.entries.some(e => e.id === targetEntry.id)));
      if (empIndex >= 0) await refreshExpandedEmployee(employeeStats[empIndex].employee.id);
      await loadEmployees();
      setSuccessMessage('Registro removido com sucesso!');
      setShowSuccessToast(true);
    } catch (error) {
      console.error('Erro ao remover registro:', error);
      alert('Erro ao remover registro');
    } finally {
      setSaving(false);
    }
  };

  const refreshExpandedEmployee = async (userId: string) => {
    const index = employeeStats.findIndex(s => s.employee.id === userId);
    if (index < 0) return;

    const startDate = new Date(selectedYear, selectedMonth - 1, 1);
    const endDate = new Date(selectedYear, selectedMonth, 0, 23, 59, 59);

    const { data: entries } = await supabase
      .from('time_entries')
      .select('id, user_id, clock_in, clock_out, notes, worked_hours')
      .eq('user_id', userId)
      .gte('clock_in', startDate.toISOString())
      .lte('clock_in', endDate.toISOString())
      .order('clock_in', { ascending: true });

    const grouped = new Map<string, TimeEntry[]>();
    (entries || []).forEach(e => {
      const key = formatDate(e.clock_in);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(e);
    });

    const dayGroups: DayGroup[] = Array.from(grouped.entries()).map(([dateKey, dayEntries]) => ({
      dateKey,
      dateDisplay: dateKey,
      weekday: getWeekday(dayEntries[0].clock_in),
      entries: dayEntries,
      totalHours: dayEntries.filter(e => e.clock_out).reduce((sum, e) => sum + calcHours(e.clock_in, e.clock_out!), 0),
    })).sort((a, b) => {
      const [da, ma, ya] = a.dateKey.split('/').map(Number);
      const [db, mb, yb] = b.dateKey.split('/').map(Number);
      return new Date(ya, ma - 1, da).getTime() - new Date(yb, mb - 1, db).getTime();
    });

    setEmployeeStats(prev => prev.map((s, i) => i === index ? { ...s, dayGroups } : s));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
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
          <div className="p-3 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl text-white">
            <Calendar className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900">Gerenciar Horas Trabalhadas</h2>
            <p className="text-sm text-gray-600">Adicione ou corrija registros de ponto dos colaboradores</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              {MONTHS.map((month, index) => (
                <option key={index + 1} value={index + 1}>{month}</option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              {[2024, 2025, 2026, 2027].map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 mb-6">
          <div className="flex gap-2">
            <AlertCircle className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-teal-900 font-medium">Sobre esta funcionalidade</p>
              <p className="text-xs text-teal-700 mt-1">
                Aqui voce gerencia as horas normais trabalhadas. Adicione registros esquecidos, corrija horarios ou remova lancamentos incorretos.
                Todas as alteracoes refletem automaticamente nos relatorios.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {employeeStats.map((stat, index) => (
            <div key={stat.employee.id} className="border border-gray-200 rounded-xl overflow-hidden">
              <div
                className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50 transition"
                onClick={() => toggleEmployee(index)}
              >
                <div className="p-2 bg-teal-100 rounded-lg text-teal-700">
                  <User className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{stat.employee.full_name}</p>
                  <p className="text-xs text-gray-500">{stat.employee.job_position || 'Sem cargo'}</p>
                </div>
                <div className="text-center px-4">
                  <p className="text-lg font-bold text-teal-700">{stat.totalHours.toFixed(1)}h</p>
                  <p className="text-xs text-gray-500">{stat.totalDays} dias</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); openAddModal(stat.employee); }}
                  className="p-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition flex items-center gap-1"
                  title="Adicionar registro"
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-xs font-medium hidden sm:inline">Adicionar</span>
                </button>
                <div className="text-gray-400">
                  {stat.expanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                </div>
              </div>

              {stat.expanded && (
                <div className="border-t border-gray-200 bg-gray-50">
                  {stat.loadingDetails ? (
                    <div className="flex items-center justify-center p-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
                    </div>
                  ) : stat.dayGroups.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      <Clock className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                      <p>Nenhum registro encontrado neste mes.</p>
                      <p className="text-sm mt-1">Clique em "Adicionar" para inserir um registro manual.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200">
                      {stat.dayGroups.map((day) => (
                        <div key={day.dateKey} className="p-4">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-2 h-2 rounded-full bg-teal-500"></div>
                            <span className="font-semibold text-gray-800">{day.dateDisplay}</span>
                            <span className="text-xs text-gray-500 capitalize">{day.weekday}</span>
                            <span className="ml-auto text-sm font-medium text-teal-700">{day.totalHours.toFixed(1)}h total</span>
                          </div>
                          <div className="space-y-2 ml-5">
                            {day.entries.map((entry) => (
                              <div key={entry.id} className="flex items-center gap-3 bg-white rounded-lg px-4 py-3 shadow-sm">
                                <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-gray-800">
                                      Entrada: {formatTime(entry.clock_in)}
                                    </span>
                                    {entry.clock_out && (
                                      <>
                                        <span className="text-gray-400">→</span>
                                        <span className="text-sm font-medium text-gray-800">
                                          Saida: {formatTime(entry.clock_out)}
                                        </span>
                                        <span className="text-xs text-teal-600 font-semibold bg-teal-50 px-2 py-0.5 rounded">
                                          {calcHours(entry.clock_in, entry.clock_out).toFixed(1)}h
                                        </span>
                                      </>
                                    )}
                                    {!entry.clock_out && (
                                      <span className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded">Em andamento</span>
                                    )}
                                  </div>
                                  {entry.notes && (
                                    <p className="text-xs text-gray-500 mt-0.5">{entry.notes}</p>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => openEditModal(entry)}
                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                    title="Editar registro"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => openDeleteConfirm(entry)}
                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition"
                                    title="Remover registro"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {showAddModal && targetEmployee && (
        <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)}>
          <div className="p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-1">Adicionar Registro de Ponto</h3>
            <p className="text-sm text-gray-500 mb-5">{targetEmployee.full_name}</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
                <input
                  type="date"
                  value={addDate}
                  onChange={(e) => setAddDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Horario de Entrada</label>
                  <input
                    type="time"
                    value={addClockIn}
                    onChange={(e) => setAddClockIn(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Horario de Saida</label>
                  <input
                    type="time"
                    value={addClockOut}
                    onChange={(e) => setAddClockOut(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
              </div>
              {addDate && addClockIn && addClockOut && (
                <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 text-sm text-teal-800">
                  Total a registrar: <strong>{calcHours(new Date(`${addDate}T${addClockIn}:00`).toISOString(), new Date(`${addDate}T${addClockOut}:00`).toISOString()).toFixed(1)}h</strong>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observacao (opcional)</label>
                <input
                  type="text"
                  value={addNotes}
                  onChange={(e) => setAddNotes(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Ex: Colaborador esqueceu de bater o ponto"
                />
              </div>
              <button
                onClick={handleAdd}
                disabled={saving || !addDate || !addClockIn || !addClockOut}
                className="w-full px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-lg font-semibold hover:from-teal-600 hover:to-cyan-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Salvando...' : 'Confirmar Registro'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showEditModal && targetEntry && (
        <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)}>
          <div className="p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-5">Editar Registro de Ponto</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data e Hora de Entrada</label>
                <input
                  type="datetime-local"
                  value={editClockIn}
                  onChange={(e) => setEditClockIn(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data e Hora de Saida</label>
                <input
                  type="datetime-local"
                  value={editClockOut}
                  onChange={(e) => setEditClockOut(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              {editClockIn && editClockOut && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                  Total apos edicao: <strong>{calcHours(new Date(editClockIn).toISOString(), new Date(editClockOut).toISOString()).toFixed(1)}h</strong>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observacao</label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Observacao sobre a edicao..."
                />
              </div>
              <button
                onClick={handleEdit}
                disabled={saving || !editClockIn}
                className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Salvando...' : 'Salvar Alteracoes'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showDeleteConfirm && targetEntry && (
        <Modal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)}>
          <div className="p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-3">Remover Registro</h3>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-5">
              <p className="text-sm text-red-800">
                Voce esta prestes a remover o registro de <strong>{formatDate(targetEntry.clock_in)}</strong> ({formatTime(targetEntry.clock_in)}{targetEntry.clock_out ? ` - ${formatTime(targetEntry.clock_out)}` : ''}).
                Esta acao nao pode ser desfeita.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={saving}
                className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition disabled:opacity-50"
              >
                {saving ? 'Removendo...' : 'Confirmar Remocao'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      <SuccessToast
        isOpen={showSuccessToast}
        onClose={() => setShowSuccessToast(false)}
        message={successMessage}
      />
    </div>
  );
}
