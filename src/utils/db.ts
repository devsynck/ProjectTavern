// High-Fidelity IndexedDB Manifestation for Tavern Soul-Anchoring
// Neutralizing the 'localStorage' Quota Fracture for high-fidelity visual archives.

const DB_NAME = "tavern-nexus";
const DB_VERSION = 3;
const STORES = ["sessions", "chats", "library", "travelers", "settings", "blueprints", "banished"] as const;

export type StoreName = (typeof STORES)[number];

class TavernDB {
  private db: IDBDatabase | null = null;

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e: any) => {
        const db = e.target.result;
        STORES.forEach(store => {
          if (!db.objectStoreNames.contains(store)) {
            db.createObjectStore(store);
          }
        });
      };

      request.onsuccess = (e: any) => {
        this.db = e.target.result;
        resolve(this.db!);
      };

      request.onerror = (e) => reject(e);
    });
  }

  async get<T>(store: StoreName, key: string): Promise<T | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(store, "readonly");
      const request = transaction.objectStore(store).get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async set(store: StoreName, key: string, value: any): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(store, "readwrite");
      const request = transaction.objectStore(store).put(value, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getAll<T>(store: StoreName): Promise<T[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(store, "readonly");
      const request = transaction.objectStore(store).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async delete(store: StoreName, key: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(store, "readwrite");
      const request = transaction.objectStore(store).delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

export const tavernDB = new TavernDB();
