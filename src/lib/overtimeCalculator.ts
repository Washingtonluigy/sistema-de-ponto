import { supabase } from './supabase';

function calculateHoursFromTimestamps(clockIn: string, clockOut: string): number {
  const start = new Date(clockIn).getTime();
  const end = new Date(clockOut).getTime();
  const hours = (end - start) / (1000 * 60 * 60);
  if (hours < 0) return 0;
  return hours;
}

function isSunday(dateStr: string): boolean {
  return new Date(dateStr).getDay() === 0;
}

export async function recalculateMonthlyOvertime(
  userId: string,
  month: number,
  year: number,
  workHours: number = 8,
  overtimeLimit: number = 30
): Promise<{ overtime: number; hourBank: number }> {
  const { data: entries } = await supabase
    .from('time_entries')
    .select('clock_in, clock_out, total_hours')
    .eq('user_id', userId)
    .gte('clock_in', `${year}-${String(month).padStart(2, '0')}-01`)
    .lt('clock_in', month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`)
    .not('clock_out', 'is', null);

  if (!entries || entries.length === 0) {
    await supabase.from('overtime_hours').upsert({
      user_id: userId,
      month,
      year,
      overtime_hours: 0,
      hour_bank: 0,
      updated_at: new Date().toISOString(),
    });
    return { overtime: 0, hourBank: 0 };
  }

  const normalDays = new Set<string>();
  const sundayDays = new Set<string>();
  let totalHours = 0;

  entries.forEach((entry) => {
    const hours = calculateHoursFromTimestamps(entry.clock_in, entry.clock_out!);
    totalHours += hours;
    const dateKey = new Date(entry.clock_in).toLocaleDateString('pt-BR');

    if (isSunday(entry.clock_in)) {
      sundayDays.add(dateKey);
    } else {
      normalDays.add(dateKey);
    }
  });

  const totalDiasAll = normalDays.size + sundayDays.size;
  const totalExtraHours = Math.max(0, totalHours - (totalDiasAll * workHours));

  const overtimePaid = Math.min(totalExtraHours, overtimeLimit);
  const hourBankAccumulated = Math.max(0, totalExtraHours - overtimeLimit);

  await supabase.from('overtime_hours').upsert({
    user_id: userId,
    month,
    year,
    overtime_hours: overtimePaid,
    hour_bank: hourBankAccumulated,
    updated_at: new Date().toISOString(),
  });

  return {
    overtime: overtimePaid,
    hourBank: hourBankAccumulated,
  };
}
