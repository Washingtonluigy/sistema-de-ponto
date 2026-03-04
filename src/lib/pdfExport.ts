import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Profile, TimeEntry } from './supabase';

type EmployeeReportData = {
  profile: Profile;
  totalHours: number;
  overtimeHours: number;
  hourBank: number;
  entries: TimeEntry[];
};

function decimalToHHMM(decimal: number): string {
  const hours = Math.floor(decimal);
  const minutes = Math.round((decimal - hours) * 60);
  return `${hours}h${minutes.toString().padStart(2, '0')}`;
}

function calcHours(clockIn: string, clockOut: string): number {
  const start = new Date(clockIn).getTime();
  const end = new Date(clockOut).getTime();
  return Math.max(0, (end - start) / (1000 * 60 * 60));
}

function isDomingo(clockIn: string): boolean {
  return new Date(clockIn).getDay() === 0;
}

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export function exportToPdf(
  data: EmployeeReportData[],
  selectedMonth: number,
  selectedYear: number,
  selectedEmployee: string
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const monthName = MONTHS[selectedMonth - 1];

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(`Relatorio de Ponto - ${monthName}/${selectedYear}`, 14, 15);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} as ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, 14, 21);
  doc.setTextColor(0);

  const resumoHead = [
    ['Nome', 'Funcao', 'Dias Trab.', 'Horas Esperadas', 'Total Horas', 'Horas Domingo', 'Total H. Extras', 'H. Extras Pagas', 'Banco de Horas']
  ];

  const resumoBody = data.map((r) => {
    const workHours = r.profile.work_hours || 8;
    const completedEntries = r.entries.filter(e => e.clock_out);

    const normalDays = new Map<string, number>();
    const sundayDaysSet = new Set<string>();
    let sundayHoursTotal = 0;
    let totalHoursRecalc = 0;

    completedEntries.forEach(entry => {
      const hours = calcHours(entry.clock_in, entry.clock_out!);
      totalHoursRecalc += hours;
      const dateKey = new Date(entry.clock_in).toLocaleDateString('pt-BR');

      if (isDomingo(entry.clock_in)) {
        sundayHoursTotal += hours;
        sundayDaysSet.add(dateKey);
      } else {
        normalDays.set(dateKey, (normalDays.get(dateKey) || 0) + hours);
      }
    });

    const totalDias = normalDays.size + sundayDaysSet.size;
    const expectedHours = totalDias * workHours;
    const totalExtraHours = Math.max(0, totalHoursRecalc - expectedHours);
    const overtimeLimit = r.profile.overtime_limit || 30;
    const overtimePaid = Math.min(totalExtraHours, overtimeLimit);
    const hourBankAcc = Math.max(0, totalExtraHours - overtimeLimit);

    return [
      r.profile.full_name,
      r.profile.job_position || '-',
      totalDias.toString(),
      decimalToHHMM(expectedHours),
      decimalToHHMM(totalHoursRecalc),
      decimalToHHMM(sundayHoursTotal),
      decimalToHHMM(totalExtraHours),
      decimalToHHMM(overtimePaid),
      decimalToHHMM(hourBankAcc),
    ];
  });

  autoTable(doc, {
    head: resumoHead,
    body: resumoBody,
    startY: 26,
    theme: 'grid',
    headStyles: {
      fillColor: [245, 158, 11],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 8,
      halign: 'center',
    },
    columnStyles: {
      0: { halign: 'left', cellWidth: 45 },
      1: { halign: 'left', cellWidth: 30 },
    },
    styles: {
      cellPadding: 2,
      lineColor: [200, 200, 200],
      lineWidth: 0.1,
    },
    alternateRowStyles: {
      fillColor: [255, 251, 235],
    },
  });

  doc.addPage('landscape');

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Detalhamento Completo', 14, 15);

  const detBody: string[][] = [];

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
        return sum + calcHours(e.clock_in, e.clock_out!);
      }, 0);

      const extraHoursDay = sunday ? totalHoursDay : Math.max(0, totalHoursDay - workHours);

      dayEntries
        .sort((a, b) => new Date(a.clock_in).getTime() - new Date(b.clock_in).getTime())
        .forEach((entry) => {
          const clockInDate = new Date(entry.clock_in);
          const clockOutDate = new Date(entry.clock_out!);
          const entryHours = calcHours(entry.clock_in, entry.clock_out!);

          const saidaDateStr = clockOutDate.toLocaleDateString('pt-BR');
          const entradaDateStr = clockInDate.toLocaleDateString('pt-BR');
          const cruzaDia = saidaDateStr !== entradaDateStr;
          const saidaDisplay = cruzaDia
            ? `${clockOutDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} (${saidaDateStr})`
            : clockOutDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

          const weekday = clockInDate.toLocaleDateString('pt-BR', { weekday: 'short' });

          detBody.push([
            r.profile.full_name,
            entradaDateStr,
            weekday,
            clockInDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            saidaDisplay,
            decimalToHHMM(entryHours),
            decimalToHHMM(totalHoursDay),
            decimalToHHMM(extraHoursDay),
            sunday ? 'Domingo' : extraHoursDay > 0 ? 'Extra' : 'Normal',
          ]);
        });
    });
  });

  autoTable(doc, {
    head: [['Nome', 'Data', 'Dia', 'Entrada', 'Saida', 'Horas Sessao', 'Total Dia', 'H. Extra Dia', 'Tipo']],
    body: detBody,
    startY: 20,
    theme: 'grid',
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: [255, 255, 255],
      fontSize: 7,
      fontStyle: 'bold',
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 7,
      halign: 'center',
    },
    columnStyles: {
      0: { halign: 'left', cellWidth: 40 },
      1: { cellWidth: 22 },
      2: { cellWidth: 18 },
      3: { cellWidth: 18 },
      4: { cellWidth: 28 },
    },
    styles: {
      cellPadding: 1.5,
      lineColor: [200, 200, 200],
      lineWidth: 0.1,
    },
    alternateRowStyles: {
      fillColor: [239, 246, 255],
    },
  });

  const fileName = selectedEmployee === 'all'
    ? `Relatorio_Completo_${selectedMonth.toString().padStart(2, '0')}_${selectedYear}.pdf`
    : `Relatorio_${data[0]?.profile.full_name.replace(/\s/g, '_')}_${selectedMonth.toString().padStart(2, '0')}_${selectedYear}.pdf`;

  doc.save(fileName);
}
