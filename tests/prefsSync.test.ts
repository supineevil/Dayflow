import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** A stand-in for chrome.storage.local that, like Chrome, tells every page (including the writer) about each change. */
function installFakeChrome() {
  const data: Record<string, unknown> = {};
  const listeners = new Set<(c: Record<string, { newValue?: unknown; oldValue?: unknown }>, area: string) => void>();
  (globalThis as { chrome?: unknown }).chrome = {
    storage: {
      local: {
        get: async (key: string) => ({ [key]: data[key] }),
        set: async (obj: Record<string, unknown>) => {
          const changes: Record<string, { newValue: unknown; oldValue: unknown }> = {};
          for (const [k, v] of Object.entries(obj)) {
            changes[k] = { newValue: structuredClone(v), oldValue: data[k] };
            data[k] = structuredClone(v);
          }
          setTimeout(() => listeners.forEach((l) => l(changes, 'local')), 0);
        },
      },
      onChanged: { addListener: (l: never) => listeners.add(l), removeListener: (l: never) => listeners.delete(l) },
    },
  };
  return data;
}

/** Loads a fresh copy of the store module, as a separate extension page would. */
async function openPage() {
  vi.resetModules();
  const { prefsStore } = await import('../src/core/storage/prefsStore');
  await prefsStore.ready;
  return prefsStore;
}

const settle = () => new Promise((r) => setTimeout(r, 20));

describe('working hours across pages', () => {
  beforeEach(() => void installFakeChrome());
  afterEach(() => void delete (globalThis as { chrome?: unknown }).chrome);

  it('a change in one page reaches the other', async () => {
    const panel = await openPage();
    const options = await openPage();
    options.update((p) => ({ ...p, workingHours: { start: '10:00', end: '19:00' } }));
    await settle();
    expect(panel.get().workingHours).toEqual({ start: '10:00', end: '19:00' });
  });

  it('a page opened later starts from the saved hours', async () => {
    const first = await openPage();
    first.update((p) => ({ ...p, workingHours: { start: '07:00', end: '15:00' } }));
    await settle();
    const later = await openPage();
    expect(later.get().workingHours).toEqual({ start: '07:00', end: '15:00' });
  });

  it('several quick edits end on the last one in both pages', async () => {
    const panel = await openPage();
    const options = await openPage();
    for (const start of ['08:00', '08:30', '09:00', '09:30', '10:00']) {
      options.update((p) => ({ ...p, workingHours: { ...p.workingHours, start } }));
    }
    await settle();
    expect(options.get().workingHours.start).toBe('10:00');
    expect(panel.get().workingHours.start).toBe('10:00');
  });
});
