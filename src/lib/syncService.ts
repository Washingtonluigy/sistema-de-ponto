import { supabase } from './supabase';
import { offlineStorage, PendingTimeEntry } from './offlineStorage';

class SyncService {
  private isSyncing = false;

  async syncPendingEntries(): Promise<{ success: number; failed: number }> {
    if (this.isSyncing) {
      console.log('Sync already in progress');
      return { success: 0, failed: 0 };
    }

    this.isSyncing = true;
    let successCount = 0;
    let failedCount = 0;

    try {
      const pendingEntries = await offlineStorage.getPendingEntries();

      if (pendingEntries.length === 0) {
        console.log('No pending entries to sync');
        return { success: 0, failed: 0 };
      }

      console.log(`Syncing ${pendingEntries.length} pending entries...`);

      for (const entry of pendingEntries) {
        try {
          if (entry.type === 'clock_in') {
            await this.syncClockIn(entry);
          } else if (entry.type === 'clock_out') {
            await this.syncClockOut(entry);
          }

          await offlineStorage.removePendingEntry(entry.id);
          successCount++;
          console.log(`Synced entry ${entry.id}`);
        } catch (error) {
          console.error(`Failed to sync entry ${entry.id}:`, error);
          failedCount++;
        }
      }

      console.log(`Sync complete: ${successCount} success, ${failedCount} failed`);
    } catch (error) {
      console.error('Error during sync:', error);
    } finally {
      this.isSyncing = false;
    }

    return { success: successCount, failed: failedCount };
  }

  private async syncClockIn(entry: PendingTimeEntry): Promise<void> {
    let selfieUrl = entry.selfie_url;

    if (entry.selfie_url && entry.selfie_url.startsWith('data:image')) {
      const base64Data = entry.selfie_url.split(',')[1];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/jpeg' });

      const fileName = `${entry.user_id}/${Date.now()}.jpg`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('employee-photos')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('employee-photos')
        .getPublicUrl(fileName);

      selfieUrl = publicUrlData.publicUrl;
    }

    const { data: timeEntry, error: entryError } = await supabase
      .from('time_entries')
      .insert({
        user_id: entry.user_id,
        clock_in: entry.clock_in,
        location_lat: entry.location_lat,
        location_lng: entry.location_lng,
        selfie_url: selfieUrl,
        is_overtime: entry.is_overtime,
        overtime_type: entry.overtime_type,
      })
      .select()
      .single();

    if (entryError) throw entryError;

    await supabase.from('active_sessions').upsert({
      user_id: entry.user_id,
      clock_in_time: entry.clock_in,
      current_lat: entry.location_lat,
      current_lng: entry.location_lng,
      last_updated: new Date().toISOString(),
    });
  }

  private async syncClockOut(entry: PendingTimeEntry): Promise<void> {
    const { data: lastEntry } = await supabase
      .from('time_entries')
      .select('*')
      .eq('user_id', entry.user_id)
      .is('clock_out', null)
      .order('clock_in', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!lastEntry) {
      throw new Error('No active entry found for clock out');
    }

    const clockIn = new Date(lastEntry.clock_in);
    const clockOut = new Date(entry.clock_out!);
    const totalHours = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);

    await supabase
      .from('time_entries')
      .update({
        clock_out: entry.clock_out,
        total_hours: totalHours,
      })
      .eq('id', lastEntry.id);

    if (lastEntry.is_overtime || entry.total_hours! > 8) {
      const now = new Date(entry.clock_out!);
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      const { data: overtime } = await supabase
        .from('overtime_hours')
        .select('*')
        .eq('user_id', entry.user_id)
        .eq('month', month)
        .eq('year', year)
        .maybeSingle();

      const hoursToAdd = lastEntry.is_overtime ? totalHours : Math.max(0, totalHours - 8);
      const currentOvertime = overtime?.overtime_hours || 0;
      const currentHourBank = overtime?.hour_bank || 0;
      const newTotalExtra = currentOvertime + currentHourBank + hoursToAdd;

      const newOvertime = Math.min(newTotalExtra, 30);
      const newHourBank = Math.max(0, newTotalExtra - 30);

      await supabase.from('overtime_hours').upsert({
        user_id: entry.user_id,
        month,
        year,
        overtime_hours: newOvertime,
        hour_bank: newHourBank,
        updated_at: new Date().toISOString(),
      });
    }

    await supabase.from('active_sessions').delete().eq('user_id', entry.user_id);
  }

  startAutoSync(): void {
    window.addEventListener('online', () => {
      console.log('Connection restored, starting sync...');
      setTimeout(() => this.syncPendingEntries(), 2000);
    });

    setInterval(() => {
      if (navigator.onLine && !this.isSyncing) {
        this.syncPendingEntries();
      }
    }, 60000);
  }
}

export const syncService = new SyncService();
