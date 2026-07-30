'use strict';

(() => {
  const MENU_VERSION = '1.3.11';

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
    };

    toggle.addEventListener('click', event => {
      event.stopPropagation();
      if (panel.hidden) openMenu();
      else closeMenu();
    });

    panel.addEventListener('click', event => event.stopPropagation());

    panel.querySelectorAll('button').forEach(button => {
      button.addEventListener('click', () => setTimeout(closeMenu, 0));
    });

    document.addEventListener('click', () => {
      if (!panel.hidden) closeMenu();
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !panel.hidden) {
        closeMenu();
        toggle.focus();
      }
    });

    localStorage.setItem('fitAppVersion', MENU_VERSION);
    const version = document.querySelector('#version');
    if (version) version.textContent = `Versiunea ${MENU_VERSION}`;
  });
})();