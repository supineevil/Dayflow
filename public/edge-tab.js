// Dayflow edge tab: a slim handle on the right edge of web pages. One click opens the side panel.
// Draws only the handle; it never reads or changes anything on the page. Plain script (content scripts
// can't be modules), so it can't import the app's code and reads the preference straight from storage.
(function () {
  if (window.top !== window || document.getElementById('dayflow-edge-tab-host')) return;

  var PREFS_KEY = 'dayflow:prefs';
  var host = null;
  var arrow = null;
  var button = null;
  var panelOpen = false;

  function build() {
    host = document.createElement('div');
    host.id = 'dayflow-edge-tab-host';
    host.style.cssText = 'all:initial;position:fixed;top:42%;right:0;z-index:2147483647;';
    var root = host.attachShadow({ mode: 'closed' });

    var style = document.createElement('style');
    style.textContent =
      'button{all:unset;box-sizing:border-box;display:flex;align-items:center;justify-content:flex-start;' +
      'width:36px;height:64px;padding-left:3px;margin-right:-20px;border-radius:10px 0 0 10px;cursor:pointer;' +
      'background:#5b5bd6;color:#fff;box-shadow:-1px 1px 6px rgba(0,0,0,.25);opacity:.9;' +
      'transition:margin-right .15s ease,opacity .15s ease}' +
      'button:hover,button:focus-visible{margin-right:0;opacity:1}' +
      'button:focus-visible{outline:2px solid #fff;outline-offset:-4px}' +
      'svg{width:14px;height:14px;flex:none}';
    root.appendChild(style);

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Open Dayflow side panel');
    btn.title = 'Open Dayflow';

    // Built with createElementNS (not innerHTML) so pages that require Trusted Types don't block it.
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2.5');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    var path = document.createElementNS(ns, 'path');
    path.setAttribute('d', 'M15 18l-6-6 6-6');
    svg.appendChild(path);
    btn.appendChild(svg);
    arrow = path;
    button = btn;
    paint();

    btn.addEventListener('click', function () {
      try {
        chrome.runtime.sendMessage({ type: 'dayflow:toggle-panel' });
      } catch (e) {
        // The extension was reloaded or removed; this page's copy of the script is orphaned.
        remove();
      }
    });
    root.appendChild(btn);
  }

  // The arrow points left to pull the panel out, and right to push it back in.
  function paint() {
    if (!arrow || !button) return;
    arrow.setAttribute('d', panelOpen ? 'M9 18l6-6-6-6' : 'M15 18l-6-6 6-6');
    button.setAttribute('aria-label', panelOpen ? 'Close Dayflow side panel' : 'Open Dayflow side panel');
    button.title = panelOpen ? 'Close Dayflow' : 'Open Dayflow';
  }

  function setOpen(open) {
    panelOpen = !!open;
    paint();
  }

  function show() {
    if (!host) build();
    if (!host.isConnected) (document.body || document.documentElement).appendChild(host);
  }

  function remove() {
    if (host && host.isConnected) host.remove();
  }

  function apply(prefs) {
    if (prefs && prefs.edgeTabEnabled === false) remove();
    else show();
  }

  try {
    chrome.storage.local.get(PREFS_KEY, function (r) {
      apply(r && r[PREFS_KEY]);
    });
    chrome.runtime.sendMessage({ type: 'dayflow:panel-state-query' }, function (r) {
      if (chrome.runtime.lastError) return;
      setOpen(r && r.open);
    });
    chrome.runtime.onMessage.addListener(function (msg) {
      if (msg && msg.type === 'dayflow:panel-state') setOpen(msg.open);
    });
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area === 'local' && changes[PREFS_KEY]) apply(changes[PREFS_KEY].newValue);
    });
  } catch (e) {
    /* extension context gone: do nothing */
  }
})();
