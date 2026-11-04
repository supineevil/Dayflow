/**
 * Thin key-value layer over chrome.storage.local. Falls back to localStorage
 * when running outside an extension (e.g. `vite dev` in a normal tab).
 */
const hasChromeStorage = typeof chrome !== 'undefined' && !!chrome.storage?.local;

export async function kvGet<T>(key: string): Promise<T | undefined> {
  if (hasChromeStorage) {
    const result = await chrome.storage.local.get(key);
    return result[key] as T | undefined;
  }
  const raw = localStorage.getItem(key);
  return raw === null ? undefined : (JSON.parse(raw) as T);
}

export async function kvSet<T>(key: string, value: T): Promise<void> {
  if (hasChromeStorage) {
    await chrome.storage.local.set({ [key]: value });
    return;
  }
  localStorage.setItem(key, JSON.stringify(value));
}

/** Calls `cb` when `key` changes from another page or context. Returns an unsubscribe function. */
export function kvSubscribe(key: string, cb: (value: unknown) => void): () => void {
  if (hasChromeStorage) {
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      const change = changes[key];
      if (area === 'local' && change) cb(change.newValue);
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }
  const listener = (e: StorageEvent) => {
    if (e.key === key) cb(e.newValue === null ? undefined : JSON.parse(e.newValue));
  };
  window.addEventListener('storage', listener);
  return () => window.removeEventListener('storage', listener);
}
