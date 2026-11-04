// Runs synchronously before first paint so dark mode doesn't flash.
// Extension pages forbid inline scripts, hence a separate file.
(function () {
  try {
    var t = localStorage.getItem('dayflow-theme') || 'system';
    var dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
  } catch (e) {
    /* storage unavailable: fall back to light */
  }
})();
