import { supabase } from './supabase';

interface TimeEntry {
  clock_in: string;
  clock_out: string | null;
  total_hours: number | null;
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
    return { overtime: 0, hourBank: 0 };
  }

  const entriesByDay = new Map<string, TimeEntry[]>();

  entries.forEach((entry) => {
    const dateKey = new Date(entry.clock_in).toLocaleDateString('pt-BR');
    if (!entriesByDay.has(dateKey)) {
      entriesByDay.set(dateKey, []);
    }
    entriesByDay.get(dateKey)!.push(entry);
  });

  const daysWorked = entriesByDay.size;
  const totalHoursWorked = entries.reduce((sum, e) => sum + (e.total_hours || 0), 0);

  const expectedHours = daysWorked * workHours;
  const totalExtraHours = Math.max(0, totalHoursWorked - expectedHours);

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
