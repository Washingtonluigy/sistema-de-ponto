import { useState, useEffect } from 'react';
import { Download, FileText, Calendar, TrendingUp } from 'lucide-react';
import { supabase, Profile, TimeEntry, OvertimeHours } from '../../lib/supabase';
import * as XLSX from 'xlsx';

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
        .gte('clock_in', startDate.toISOString())
        .lte('clock_in', endDate.toISOString());

      const { data: overtime } = await supabase
        .from('overtime_hours')
        .select('*')
        .eq('month', selectedMonth)
        .eq('year', selectedYear);

      const calcHours = (clockIn: string, clockOut: string): number => {
        const start = new Date(clockIn).getTime();
        const end = new Date(clockOut).getTime();
        return Math.max(0, (end - start) / (1000 * 60 * 60));
      };

      const employeeReports: EmployeeReport[] = (profiles || []).map((profile) => {
        const employeeEntries = (entries || []).filter((e) => e.user_id === profile.id);
        const completedEntries = employeeEntries.filter(e => e.clock_out);
        const workHours = profile.work_hours || 8;
        const overtimeLimit = profile.overtime_limit || 30;

        const normalDays = new Map<string, number>();
        let sundayHoursTotal = 0;
        let totalHours = 0;

        completedEntries.forEach(entry => {
          const hours = calcHours(entry.clock_in, entry.clock_out!);
          totalHours += hours;
          const dateKey = new Date(entry.clock_in).toLocaleDateString('pt-BR');

          if (new Date(entry.clock_in).getDay() === 0) {
            sundayHoursTotal += hours;
          } else {
            normalDays.set(dateKey, (normalDays.get(dateKey) || 0) + hours);
          }
        });

        const normalHoursTotal = Array.from(normalDays.values()).reduce((sum, h) => sum + h, 0);
        const expectedNormalHours = normalDays.size * workHours;
        const normalOvertime = Math.max(0, normalHoursTotal - expectedNormalHours);
        const totalExtraHours = normalOvertime + sundayHoursTotal;

        return {
          profile,
          totalHours,
          overtimeHours: Math.min(totalExtraHours, overtimeLimit),
          hourBank: Math.max(0, totalExtraHours - overtimeLimit),
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

  const calcHoursFromTimestamps = (clockIn: string, clockOut: string): number => {
    const start = new Date(clockIn).getTime();
    const end = new Date(clockOut).getTime();
    return Math.max(0, (end - start) / (1000 * 60 * 60));
  };

  const isDomingo = (clockIn: string): boolean => {
    return new Date(clockIn).getDay() === 0;
  };

  const exportToExcel = (data: EmployeeReport[]) => {
    const workbook = XLSX.utils.book_new();

    const resumoData = data.map((r) => {
      const workHours = r.profile.work_hours || 8;
      const completedEntries = r.entries.filter(e => e.clock_out);

      const normalDays = new Map<string, number>();
      let sundayHoursTotal = 0;
      let totalHoursRecalc = 0;

      completedEntries.forEach(entry => {
        const hours = calcHoursFromTimestamps(entry.clock_in, entry.clock_out!);
        totalHoursRecalc += hours;
        const dateKey = new Date(entry.clock_in).toLocaleDateString('pt-BR');

        if (isDomingo(entry.clock_in)) {
          sundayHoursTotal += hours;
        } else {
          normalDays.set(dateKey, (normalDays.get(dateKey) || 0) + hours);
        }
      });

      const normalDaysCount = normalDays.size;
      const normalHoursTotal = Array.from(normalDays.values()).reduce((sum, h) => sum + h, 0);
      const expectedNormalHours = normalDaysCount * workHours;
      const normalOvertime = Math.max(0, normalHoursTotal - expectedNormalHours);
      const totalExtraHours = normalOvertime + sundayHoursTotal;

      const sundayDays = new Set(
        completedEntries
          .filter(e => isDomingo(e.clock_in))
          .map(e => new Date(e.clock_in).toLocaleDateString('pt-BR'))
      ).size;
      const totalDias = normalDaysCount + sundayDays;
      const totalEntradas = r.entries.filter(e => e.clock_in).length;
      const totalSaidas = completedEntries.length;

      const overtimeLimit = r.profile.overtime_limit || 30;
      const overtimePaid = Math.min(totalExtraHours, overtimeLimit);
      const hourBankAccumulated = Math.max(0, totalExtraHours - overtimeLimit);

      return {
        'Nome': r.profile.full_name,
        'Função': r.profile.job_position || '-',
        'Dias Trabalhados': totalDias,
        'Dias Normais (Seg-Sáb)': normalDaysCount,
        'Domingos Trabalhados': sundayDays,
        'Total Entradas': totalEntradas,
        'Total Saídas': totalSaidas,
        'Horas Esperadas (Seg-Sáb)': Number(expectedNormalHours.toFixed(2)),
        'Total Horas Trabalhadas': Number(totalHoursRecalc.toFixed(2)),
        'Horas Normais (Seg-Sáb)': Number(normalHoursTotal.toFixed(2)),
        'Horas Domingo (100%)': Number(sundayHoursTotal.toFixed(2)),
        'Extras Seg-Sáb': Number(normalOvertime.toFixed(2)),
        'Total Horas Extras': Number(totalExtraHours.toFixed(2)),
        'Horas Extras Pagas': Number(overtimePaid.toFixed(2)),
        'Banco de Horas': Number(hourBankAccumulated.toFixed(2)),
      };
    });

    const wsResumo = XLSX.utils.json_to_sheet(resumoData);

    wsResumo['!cols'] = [
      { wch: 30 },
      { wch: 20 },
      { wch: 18 },
      { wch: 22 },
      { wch: 22 },
      { wch: 15 },
      { wch: 15 },
      { wch: 24 },
      { wch: 22 },
      { wch: 22 },
      { wch: 22 },
      { wch: 18 },
      { wch: 20 },
      { wch: 20 },
      { wch: 18 },
    ];

    wsResumo['!autofilter'] = { ref: `A1:O${resumoData.length + 1}` };

    XLSX.utils.book_append_sheet(workbook, wsResumo, 'Resumo Geral');

    const detalhamentoData: any[] = [];
    data.forEach((r) => {
      const workHours = r.profile.work_hours || 8;
      const completedEntries = r.entries.filter(e => e.clock_out);

      const entriesByDay = new Map<string, TimeEntry[]>();
      completedEntries.forEach(entry => {
        const dateKey = new Date(entry.clock_in).toLocaleDateString('pt-BR');
        if (!entriesByDay.has(dateKey)) {
          entriesByDay.set(dateKey, []);
        }
        entriesByDay.get(dateKey)!.push(entry);
      });

      entriesByDay.forEach((dayEntries) => {
        const sunday = isDomingo(dayEntries[0].clock_in);
        const totalHoursDay = dayEntries.reduce((sum, e) => {
          return sum + calcHoursFromTimestamps(e.clock_in, e.clock_out!);
        }, 0);

        let extraHoursDay: number;
        let tipo: string;
        if (sunday) {
          extraHoursDay = totalHoursDay;
          tipo = 'Domingo (100%)';
        } else {
          extraHoursDay = Math.max(0, totalHoursDay - workHours);
          tipo = extraHoursDay > 0 ? 'Extra' : 'Normal';
        }

        dayEntries
          .sort((a, b) => new Date(a.clock_in).getTime() - new Date(b.clock_in).getTime())
          .forEach((entry) => {
            const clockInDate = new Date(entry.clock_in);
            const clockOutDate = new Date(entry.clock_out!);
            const entryHours = calcHoursFromTimestamps(entry.clock_in, entry.clock_out!);

            const saidaDateStr = clockOutDate.toLocaleDateString('pt-BR');
            const entradaDateStr = clockInDate.toLocaleDateString('pt-BR');
            const cruzaDia = saidaDateStr !== entradaDateStr;
            const saidaDisplay = cruzaDia
              ? `${clockOutDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} (${saidaDateStr})`
              : clockOutDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

            detalhamentoData.push({
              'Nome': r.profile.full_name,
              'Função': r.profile.job_position || '-',
              'Data': entradaDateStr,
              'Dia da Semana': clockInDate.toLocaleDateString('pt-BR', { weekday: 'long' }),
              'Entrada': clockInDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
              'Saída': saidaDisplay,
              'Horas da Sessão': Number(entryHours.toFixed(2)),
              'Total Horas do Dia': Number(totalHoursDay.toFixed(2)),
              'Hora Extra?': (sunday || extraHoursDay > 0) ? 'Sim' : 'Não',
              'Horas Extras do Dia': Number(extraHoursDay.toFixed(2)),
              'Tipo': cruzaDia ? 'Saída no dia seguinte' :
                      sunday ? 'Domingo (100%)' :
                      entry.overtime_type === 'after_hours' ? 'Após Expediente' :
                      entry.overtime_type === 'weekend' ? 'Fim de Semana' :
                      entry.overtime_type === 'holiday' ? 'Feriado' :
                      tipo,
            });
          });
      });
    });

    const wsDetalhamento = XLSX.utils.json_to_sheet(detalhamentoData);

    wsDetalhamento['!cols'] = [
      { wch: 30 },
      { wch: 20 },
      { wch: 12 },
      { wch: 18 },
      { wch: 10 },
      { wch: 10 },
      { wch: 18 },
      { wch: 18 },
      { wch: 12 },
      { wch: 18 },
      { wch: 20 },
    ];

    wsDetalhamento['!autofilter'] = { ref: `A1:K${detalhamentoData.length + 1}` };

    XLSX.utils.book_append_sheet(workbook, wsDetalhamento, 'Detalhamento Completo');

    const fileName = selectedEmployee === 'all'
      ? `Relatorio_Completo_${selectedMonth.toString().padStart(2, '0')}_${selectedYear}.xlsx`
      : `Relatorio_${data[0]?.profile.full_name.replace(/\s/g, '_')}_${selectedMonth.toString().padStart(2, '0')}_${selectedYear}.xlsx`;

    XLSX.writeFile(workbook, fileName);
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
