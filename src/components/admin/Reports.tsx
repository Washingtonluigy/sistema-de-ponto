import { useState, useEffect } from 'react';
import { Download, FileText, Calendar, TrendingUp } from 'lucide-react';
import { supabase, Profile, TimeEntry, OvertimeHours } from '../../lib/supabase';

type EmployeeReport = {
  profile: Profile;
  totalHours: number;
  overtimeHours: number;
  hourBank: number;
  entries: TimeEntry[];
};

export default function Reports() {
  const [reports, setReports] = useState<EmployeeReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');

  useEffect(() => {
    loadReports();
  }, [selectedMonth, selectedYear]);

  const loadReports = async () => {
    setLoading(true);
    try {
      const startDate = new Date(selectedYear, selectedMonth - 1, 1);
      const endDate = new Date(selectedYear, selectedMonth, 0, 23, 59, 59);

      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'employee');

      const { data: entries } = await supabase
        .from('time_entries')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      const { data: overtime } = await supabase
        .from('overtime_hours')
        .select('*')
        .eq('month', selectedMonth)
        .eq('year', selectedYear);

      const employeeReports: EmployeeReport[] = (profiles || []).map((profile) => {
        const employeeEntries = (entries || []).filter((e) => e.user_id === profile.id);
        const totalHours = employeeEntries.reduce((sum, e) => sum + Number(e.total_hours), 0);
        const expectedHours = profile.work_hours * 22;
        const extraHours = Math.max(0, totalHours - expectedHours);
        const overtimeData = overtime?.find((o) => o.user_id === profile.id);

        return {
          profile,
          totalHours,
          overtimeHours: overtimeData?.overtime_hours || Math.min(extraHours, 30),
          hourBank: overtimeData?.hour_bank || Math.max(0, extraHours - 30),
          entries: employeeEntries,
        };
      });

      setReports(employeeReports);
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = (data: EmployeeReport[]) => {
    const csvContent = [
      ['Nome', 'Função', 'Total Horas', 'Horas Extras (até 30h)', 'Banco de Horas (>30h)'],
      ...data.map((r) => [
        r.profile.full_name,
        r.profile.job_position || '-',
        r.totalHours.toFixed(2),
        r.overtimeHours.toFixed(2),
        r.hourBank.toFixed(2),
      ]),
    ]
      .map((row) => row.join(','))
      .join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio_${selectedMonth}_${selectedYear}.csv`;
    link.click();
  };

  const exportToTxt = (data: EmployeeReport[]) => {
    const txtContent = [
      `RELATÓRIO DE PONTO - ${selectedMonth}/${selectedYear}`,
      '='.repeat(60),
      '',
      ...data.map((r) =>
        [
          `Nome: ${r.profile.full_name}`,
          `Função: ${r.profile.job_position || '-'}`,
          `Total de Horas: ${r.totalHours.toFixed(2)}h`,
          `Horas Extras (pagas): ${r.overtimeHours.toFixed(2)}h`,
          `Banco de Horas: ${r.hourBank.toFixed(2)}h`,
          '-'.repeat(60),
        ].join('\n')
      ),
    ].join('\n');

    const blob = new Blob([txtContent], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio_${selectedMonth}_${selectedYear}.txt`;
    link.click();
  };

  const filteredReports = selectedEmployee === 'all'
    ? reports
    : reports.filter(r => r.profile.id === selectedEmployee);

  const totalCompanyHours = reports.reduce((sum, r) => sum + r.totalHours, 0);
  const totalOvertimeHours = reports.reduce((sum, r) => sum + r.overtimeHours, 0);
  const totalHourBank = reports.reduce((sum, r) => sum + r.hourBank, 0);

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
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Relatórios</h2>
        <p className="text-gray-600">Acompanhe horas trabalhadas, extras e banco de horas</p>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-amber-600" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-amber-500 outline-none"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(2024, i).toLocaleString('pt-BR', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-amber-500 outline-none"
          >
            {Array.from({ length: 5 }, (_, i) => (
              <option key={i} value={new Date().getFullYear() - i}>
                {new Date().getFullYear() - i}
              </option>
            ))}
          </select>

          <select
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
            className="px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-amber-500 outline-none flex-1 min-w-[200px]"
          >
            <option value="all">Todos os Colaboradores</option>
            {reports.map((r) => (
              <option key={r.profile.id} value={r.profile.id}>
                {r.profile.full_name}
              </option>
            ))}
          </select>

          <div className="flex space-x-2">
            <button
              onClick={() => exportToExcel(filteredReports)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>Excel</span>
            </button>
            <button
              onClick={() => exportToTxt(filteredReports)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center space-x-2"
            >
              <FileText className="w-4 h-4" />
              <span>TXT</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-700 font-medium">Total Horas Empresa</p>
                <p className="text-2xl font-bold text-blue-900">{totalCompanyHours.toFixed(1)}h</p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-amber-700 font-medium">Horas Extras (pagas)</p>
                <p className="text-2xl font-bold text-amber-900">{totalOvertimeHours.toFixed(1)}h</p>
              </div>
              <TrendingUp className="w-8 h-8 text-amber-600" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700 font-medium">Banco de Horas</p>
                <p className="text-2xl font-bold text-green-900">{totalHourBank.toFixed(1)}h</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Colaborador</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Função</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Total Horas</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">H. Extras (pagas)</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Banco de Horas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredReports.map((report) => (
                <tr key={report.profile.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-800">{report.profile.full_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{report.profile.job_position || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-800 text-right font-medium">{report.totalHours.toFixed(2)}h</td>
                  <td className="px-4 py-3 text-sm text-amber-600 text-right font-medium">{report.overtimeHours.toFixed(2)}h</td>
                  <td className="px-4 py-3 text-sm text-green-600 text-right font-medium">{report.hourBank.toFixed(2)}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
