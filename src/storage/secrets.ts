import type { ProviderId } from '@/shared/types';

/**
 * API keys live only in extension contexts:
 * - session: `storage.session`, restricted to trusted contexts and cleared when the browser quits.
 * - persistent: IndexedDB on the extension origin, which content scripts cannot open
 *   (they run with the page's origin). It is NOT encrypted; Settings says so.
 */
const DB_NAME = 'helium-max-secrets';
const STORE = 'keys';

const sessionKey = (id: ProviderId) => `secret:${id}`;

export async function restrictSessionStorage(): Promise<void> {
  await browser.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
}

export async function getApiKey(id: ProviderId): Promise<string | undefined> {
  const session = await browser.storage.session.get(sessionKey(id));
  const value = session[sessionKey(id)];
  if (typeof value === 'string' && value) return value;
  return idbGet(id);
}

export async function setApiKey(
  id: ProviderId,
  key: string,
  storage: 'session' | 'persistent',
): Promise<void> {
  await clearApiKey(id);
  if (!key) return;
  if (storage === 'persistent') await idbSet(id, key);
  else await browser.storage.session.set({ [sessionKey(id)]: key });
}

async function clearApiKey(id: ProviderId): Promise<void> {
  await browser.storage.session.remove(sessionKey(id));
  await idbDelete(id);
}

export async function clearAllSecrets(): Promise<void> {
  const all = await browser.storage.session.get(null);
  await browser.storage.session.remove(Object.keys(all).filter((key) => key.startsWith('secret:')));
  const db = await openDb();
  await tx(db, 'readwrite', (store) => store.clear());
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function tx<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = run(db.transaction(STORE, mode).objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbGet(id: ProviderId): Promise<string | undefined> {
  const value = await tx(await openDb(), 'readonly', (store) => store.get(id));
  return typeof value === 'string' && value ? value : undefined;
}

async function idbSet(id: ProviderId, key: string): Promise<void> {
  await tx(await openDb(), 'readwrite', (store) => store.put(key, id));
}

async function idbDelete(id: ProviderId): Promise<void> {
  await tx(await openDb(), 'readwrite', (store) => store.delete(id));
}
