// Tab System

const tabs = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('.panel');

function activateTab(panelId) {
  tabs.forEach(t => {
    const active = t.dataset.panel === panelId;
    t.classList.toggle('tab--active', active);
    t.setAttribute('aria-selected', String(active));
    t.tabIndex = active ? 0 : -1;
  });
  panels.forEach(p => {
    const active = p.id === `panel-${panelId}`;
    p.classList.toggle('panel--active', active);
    if (active) p.removeAttribute('hidden');
    else p.setAttribute('hidden', '');
  });
  // Persist active tab
  sessionStorage.setItem('devtools-tab', panelId);
}

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    activateTab(tab.dataset.panel);
    history.replaceState(null, '', `#${tab.dataset.panel}`);
  });

  // Keyboard navigation: arrow keys cycle tabs
  tab.addEventListener('keydown', (e) => {
    const tabList = [...tabs];
    const idx = tabList.indexOf(tab);
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      tabList[(idx + 1) % tabList.length].focus();
      tabList[(idx + 1) % tabList.length].click();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      tabList[(idx - 1 + tabList.length) % tabList.length].focus();
      tabList[(idx - 1 + tabList.length) % tabList.length].click();
    } else if (e.key === 'Home') {
      e.preventDefault();
      tabList[0].focus();
      tabList[0].click();
    } else if (e.key === 'End') {
      e.preventDefault();
      tabList[tabList.length - 1].focus();
      tabList[tabList.length - 1].click();
    }
  });
});

// Nav links that target specific tools
document.querySelectorAll('.nav-tool-link').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    activateTab(link.dataset.tab);
    history.replaceState(null, '', `#${link.dataset.tab}`);
    document.getElementById('tools').scrollIntoView({ behavior: 'smooth' });
  });
});

// Restore tab from URL hash, sessionStorage fallback, else 'json'
(function restoreTab() {
  const validIds = new Set([...panels].map(p => p.id.replace('panel-', '')));

  function tabFromHash() {
    const hash = window.location.hash.slice(1);
    return validIds.has(hash) ? hash : null;
  }

  function activate(id) {
    activateTab(id);
    history.replaceState(null, '', `#${id}`);
  }

  const initial = tabFromHash()
    || sessionStorage.getItem('devtools-tab')
    || 'json';
  activate(validIds.has(initial) ? initial : 'json');

  window.addEventListener('popstate', () => {
    const id = tabFromHash() || 'json';
    activateTab(id);
  });

  // hashchange fires when the user manually edits the address bar hash;
  // popstate does not always fire in that case. Guard against double-activation
  // (browsers may fire both) by checking if the resolved tab actually changed.
  window.addEventListener('hashchange', () => {
    const id = tabFromHash() || 'json';
    if (sessionStorage.getItem('devtools-tab') !== id) {
      activateTab(id);
      history.replaceState(null, '', `#${id}`);
    }
  });
})();
