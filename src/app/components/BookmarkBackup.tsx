import { Download, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { importMerge, importReplace } from '@/core/bookmarks/bookmarkStore';
import { exportBookmarks, parseImport, type BookmarkState } from '@/core/bookmarks/bookmarks';
import { useBookmarks } from '@/app/hooks/useBookmarks';
import { Button } from './ui/Button';

interface Pending {
  fileName: string;
  state: BookmarkState;
  skipped: number;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Export to a JSON file and import it on another device (or restore after reinstalling). */
export function BookmarkBackup() {
  const current = useBookmarks();
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);

  const download = () => {
    const blob = new Blob([exportBookmarks(current)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dayflow-bookmarks-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage({ text: `Exported ${plural(current.bookmarks.length, 'bookmark')} in ${plural(current.sections.length, 'section')}.` });
  };

  const onFile = async (file: File | undefined) => {
    if (fileInput.current) fileInput.current.value = '';
    if (!file) return;
    setConfirmReplace(false);
    const parsed = parseImport(await file.text());
    if (!parsed.ok) {
      setPending(null);
      setMessage({ text: parsed.error, error: true });
      return;
    }
    setMessage(null);
    setPending({ fileName: file.name, state: parsed.state, skipped: parsed.skipped });
  };

  const merge = () => {
    if (!pending) return;
    const r = importMerge(pending.state);
    setMessage({
      text: `Added ${plural(r.addedBookmarks, 'bookmark')} and ${plural(r.addedSections, 'section')}.${r.duplicates > 0 ? ` Skipped ${r.duplicates} already here.` : ''}`,
    });
    setPending(null);
  };

  const replace = () => {
    if (!pending) return;
    importReplace(pending.state);
    setMessage({ text: `Replaced your bookmarks with ${plural(pending.state.bookmarks.length, 'bookmark')}.` });
    setPending(null);
    setConfirmReplace(false);
  };

  return (
    <section aria-label="Backup and transfer" className="space-y-2 rounded-lg border border-border p-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Backup &amp; transfer</h2>
      <p className="text-xs text-subtle">
        Bookmarks stay on this device. To use them on another computer, export a file here and import it there.
      </p>
      <div className="flex gap-2">
        <Button size="sm" onClick={download} disabled={current.bookmarks.length === 0 && current.sections.length === 0}>
          <Download className="size-3.5" /> Export
        </Button>
        <Button size="sm" onClick={() => fileInput.current?.click()}>
          <Upload className="size-3.5" /> Import
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          aria-label="Choose a bookmarks file to import"
          className="hidden"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
      </div>

      {pending && (
        <div className="space-y-2 rounded-md bg-surface-2 p-2 text-xs">
          <p>
            <span className="font-medium">{pending.fileName}</span> has {plural(pending.state.bookmarks.length, 'bookmark')} in{' '}
            {plural(pending.state.sections.length, 'section')}.
            {pending.skipped > 0 && <span className="text-warning"> {plural(pending.skipped, 'entry')} will be skipped (invalid address).</span>}
          </p>
          {confirmReplace ? (
            <>
              <p className="text-danger">This deletes your {plural(current.bookmarks.length, 'current bookmark')} and uses the file instead.</p>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setConfirmReplace(false)}>Back</Button>
                <Button size="sm" onClick={replace}>Yes, replace</Button>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="primary" onClick={merge}>Add to my bookmarks</Button>
              <Button size="sm" onClick={() => setConfirmReplace(true)}>Replace everything</Button>
              <Button size="sm" variant="ghost" onClick={() => setPending(null)}>Cancel</Button>
            </div>
          )}
        </div>
      )}

      {message && (
        <p role={message.error ? 'alert' : 'status'} className={message.error ? 'text-xs text-danger' : 'text-xs text-success'}>
          {message.text}
        </p>
      )}
    </section>
  );
}
