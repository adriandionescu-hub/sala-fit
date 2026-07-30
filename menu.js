'use strict';

(() => {
  document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.querySelector('#menuToggle');
    const panel = document.querySelector('#menuPanel');
    if (!toggle || !panel) return;

    const closeMenu = () => {
      panel.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
      toggle.textContent = 'MENU ☰';
    };

    const openMenu = () => {
      panel.hidden = false;
      toggle.setAttribute('aria-expanded', 'true');
      toggle.textContent = 'ÎNCHIDE MENIUL ×';
      panel.querySelector('button')?.focus({ preventScroll: true });
    };

    toggle.addEventListener('click', () => {
      if (panel.hidden) openMenu();
      else closeMenu();
    });

    panel.querySelectorAll('button').forEach(button => {
      button.addEventListener('click', () => setTimeout(closeMenu, 0));
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !panel.hidden) {
        closeMenu();
        toggle.focus();
      }
    });
  });
})();
