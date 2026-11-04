import { kvGet, kvSet, kvSubscribe } from './kv';

export interface Store<T> {
  get(): T;
  update(fn: (prev: T) => T): void;
  subscribe(listener: () => void): () => void;
  isLoaded(): boolean;
  ready: Promise<void>;
}

/**
 * A persisted, observable value. It starts at `defaults`, hydrates from
 * storage, and stays in sync across extension pages (popup, side panel, options).
 * `hydrate` receives whatever was stored (possibly from an older version).
 */
export function createStore<T extends object>(
  key: string,
  defaults: T,
  hydrate: (stored: Partial<T>) => T = (stored) => ({ ...defaults, ...stored }),
): Store<T> {
  let value = defaults;
  let loaded = false;
  let dirty = false;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());

  const ready = kvGet<Partial<T>>(key)
    .then((stored) => {
      // A write that happened before hydration finished wins.
      if (stored && !dirty) value = hydrate(stored);
    })
    .catch((err: unknown) => {
      console.error(`Dayflow: failed to load "${key}"`, err);
    })
    .finally(() => {
      loaded = true;
      emit();
    });

  kvSubscribe(key, (next) => {
    const incoming = next ? hydrate(next as Partial<T>) : defaults;
    if (JSON.stringify(incoming) === JSON.stringify(value)) return;
    value = incoming;
    emit();
  });

  return {
    get: () => value,
    isLoaded: () => loaded,
    ready,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    update(fn) {
      value = fn(value);
      dirty = true;
      emit();
      kvSet(key, value).catch((err: unknown) => {
        console.error(`Dayflow: failed to save "${key}"`, err);
      });
    },
  };
}
