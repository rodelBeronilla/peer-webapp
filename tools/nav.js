// Hamburger / Mobile Nav

const hamburger = document.getElementById('hamburger');
const navMenu = document.getElementById('navMenu');

// inert on the menu only applies in mobile (hamburger visible).
// On desktop the menu is always visible and must remain interactive.
// inert removes the element from both the AT tree and tab order in one attribute.
const mobileNav = window.matchMedia('(max-width: 640px)');

function setNavOpen(open) {
  hamburger.setAttribute('aria-expanded', String(open));
  if (mobileNav.matches) {
    navMenu.toggleAttribute('inert', !open);
  } else {
    navMenu.removeAttribute('inert');
  }
  navMenu.classList.toggle('is-open', open);
}

// Sync inert when viewport crosses the mobile breakpoint
mobileNav.addEventListener('change', () => {
  if (!mobileNav.matches) {
    navMenu.removeAttribute('inert');
  } else if (hamburger.getAttribute('aria-expanded') !== 'true') {
    navMenu.setAttribute('inert', '');
  }
});

// Initialize: on mobile, menu starts closed
if (mobileNav.matches) {
  navMenu.setAttribute('inert', '');
}

hamburger.addEventListener('click', () => {
  setNavOpen(hamburger.getAttribute('aria-expanded') !== 'true');
});

navMenu.querySelectorAll('.nav__link').forEach(link => {
  link.addEventListener('click', () => setNavOpen(false));
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && navMenu.classList.contains('is-open')) {
    setNavOpen(false);
    hamburger.focus();
  }
});

document.addEventListener('click', (e) => {
  if (navMenu.classList.contains('is-open') &&
      !navMenu.contains(e.target) &&
      !hamburger.contains(e.target)) {
    setNavOpen(false);
  }
});

// Nav search / filter
const navSearch = document.getElementById('navSearch');
const navToolItems = [...document.querySelectorAll('#navMenu .nav-tool-link')].map(a => a.closest('li'));

function applyNavFilter() {
  const query = navSearch.value.trim().toLowerCase();
  const activeTab = sessionStorage.getItem('devtools-tab') || 'json';
  navToolItems.forEach(item => {
    const link = item.querySelector('.nav-tool-link');
    const matches = !query
      || link.textContent.trim().toLowerCase().includes(query)
      || link.dataset.tab.includes(query);
    const isActive = link.dataset.tab === activeTab;
    item.style.display = (matches || isActive) ? '' : 'none';
  });
}

navSearch.addEventListener('input', applyNavFilter);

// Re-apply filter when active tab changes so the active item stays visible
document.addEventListener('click', (e) => {
  if (e.target.matches('.nav-tool-link, .tab')) applyNavFilter();
});

// / focuses search; Escape clears it
document.addEventListener('keydown', (e) => {
  const tag = document.activeElement.tagName;
  const editable = tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement.isContentEditable;
  if (e.key === '/' && !editable) {
    e.preventDefault();
    navSearch.focus();
    navSearch.select();
  }
  if (e.key === 'Escape' && document.activeElement === navSearch) {
    navSearch.value = '';
    applyNavFilter();
    navSearch.blur();
  }
});
