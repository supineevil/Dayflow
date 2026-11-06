/**
 * Tells the background worker that this side panel is open (and in which window) so the edge tab on web pages can flip
 * its arrow, and lets that tab close the panel. The connection ends by itself when the panel closes; if the worker is
 * restarted meanwhile, reconnect.
 */
export const PANEL_PORT = 'dayflow-panel';

export function announcePanelOpen() {
  if (typeof chrome === 'undefined' || !chrome.runtime?.connect || !chrome.windows) return;
  const connect = async () => {
    const win = await chrome.windows.getCurrent();
    if (win.id === undefined) return;
    const port = chrome.runtime.connect({ name: PANEL_PORT });
    port.postMessage({ type: 'hello', windowId: win.id });
    port.onMessage.addListener((msg: unknown) => {
      if ((msg as { type?: string } | null)?.type === 'close') window.close();
    });
    port.onDisconnect.addListener(() => setTimeout(() => void connect().catch(() => undefined), 1000));
  };
  void connect().catch(() => undefined);
}
