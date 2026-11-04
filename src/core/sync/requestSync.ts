/** Asks the background worker to sync. Resolves when that sync has finished. */
export async function requestSync(): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
  await chrome.runtime.sendMessage({ type: 'dayflow:sync' });
}
