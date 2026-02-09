const DB_NAME = 'PontoDigitalDB';
const DB_VERSION = 1;
const STORE_NAME = 'pendingTimeEntries';

export type PendingTimeEntry = {
  id: string;
  user_id: string;
  clock_in: string;
  clock_out?: string;
  location_lat: number;
  location_lng: number;
  selfie_url: string;
  is_overtime: boolean;
  overtime_type: string | null;
  notes?: string | null;
  total_hours?: number;
  type: 'clock_in' | 'clock_out';
  timestamp: number;
};

class OfflineStorage {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    if (this.db) {
      return Promise.resolve();
    }

    if (!window.indexedDB) {
      console.error('[STORAGE] IndexedDB não disponível');
      return Promise.reject(new Error('IndexedDB não suportado'));
    }

    return new Promise((resolve, reject) => {
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
          console.error('[STORAGE] Erro ao abrir DB:', request.error);
          reject(request.error || new Error('Erro ao abrir banco de dados'));
        };

        request.onsuccess = () => {
          this.db = request.result;
          console.log('[STORAGE] Banco de dados aberto com sucesso');
          resolve();
        };

        request.onupgradeneeded = (event) => {
          console.log('[STORAGE] Atualizando banco de dados...');
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            console.log('[STORAGE] Object store criado');
          }
        };

        request.onblocked = () => {
          console.warn('[STORAGE] Banco de dados bloqueado');
          reject(new Error('Banco de dados bloqueado. Feche outras abas deste app.'));
        };
      } catch (error) {
        console.error('[STORAGE] Exceção ao abrir DB:', error);
        reject(error);
      }
    });
  }

  async addPendingEntry(entry: PendingTimeEntry): Promise<void> {
    try {
      if (!this.db) await this.init();

      return new Promise((resolve, reject) => {
        try {
          const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
          const store = transaction.objectStore(STORE_NAME);
          const request = store.add(entry);

          request.onsuccess = () => {
            console.log('[STORAGE] Entrada adicionada:', entry.id);
            resolve();
          };
          request.onerror = () => {
            console.error('[STORAGE] Erro ao adicionar entrada:', request.error);
            reject(request.error);
          };

          transaction.onerror = () => {
            console.error('[STORAGE] Erro na transação:', transaction.error);
            reject(transaction.error);
          };
        } catch (error) {
          console.error('[STORAGE] Exceção ao adicionar entrada:', error);
          reject(error);
        }
      });
    } catch (error) {
      console.error('[STORAGE] Erro ao inicializar DB:', error);
      throw error;
    }
  }

  async getPendingEntries(): Promise<PendingTimeEntry[]> {
    try {
      if (!this.db) await this.init();

      return new Promise((resolve, reject) => {
        try {
          const transaction = this.db!.transaction([STORE_NAME], 'readonly');
          const store = transaction.objectStore(STORE_NAME);
          const request = store.getAll();

          request.onsuccess = () => {
            console.log('[STORAGE] Entradas recuperadas:', request.result.length);
            resolve(request.result);
          };
          request.onerror = () => {
            console.error('[STORAGE] Erro ao recuperar entradas:', request.error);
            reject(request.error);
          };
        } catch (error) {
          console.error('[STORAGE] Exceção ao recuperar entradas:', error);
          reject(error);
        }
      });
    } catch (error) {
      console.error('[STORAGE] Erro ao inicializar DB para leitura:', error);
      return [];
    }
  }

  async removePendingEntry(id: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clearAllPendingEntries(): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  clearAll = this.clearAllPendingEntries;
}

export const offlineStorage = new OfflineStorage();
