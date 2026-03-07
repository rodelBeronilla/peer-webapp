// Hamburger / Mobile Nav

const hamburger = document.getElementById('hamburger');
const navMenu = document.getElementById('navMenu');

function setNavOpen(open) {
  hamburger.setAttribute('aria-expanded', String(open));
  navMenu.classList.toggle('is-open', open);
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
