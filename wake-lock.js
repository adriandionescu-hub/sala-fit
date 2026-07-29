'use strict';

(() => {
  const STORAGE_KEY = 'fitKeepAwake';
  let wakeLock = null;
  let enabled = localStorage.getItem(STORAGE_KEY) !== '0';
  let lastError = '';

  const supported = 'wakeLock' in navigator;

  function button() {
    return document.querySelector('#keepAwake');
  }

  function updateButton() {
    const el = button();
    if (!el) return;

    el.classList.toggle('on', Boolean(enabled && wakeLock));
    el.classList.toggle('wait', Boolean(enabled && !wakeLock));

    if (!supported) {
      el.textContent = '⚠️ ECRAN: NESUPORTAT';
      el.title = 'Browserul nu permite menținerea automată a ecranului aprins.';
      el.disabled = true;
      return;
    }

    el.disabled = false;
    if (!enabled) {
      el.textContent = '🌙 ECRAN NORMAL';
      el.title = 'Apasă pentru a ține ecranul aprins în timpul antrenamentului.';
    } else if (wakeLock) {
      el.textContent = '☀️ ECRAN APRINS';
      el.title = 'Ecranul rămâne aprins cât timp SALA FIT este deschisă în prim-plan.';
    } else {
      el.textContent = '☀️ ECRAN APRINS · ATINGE';
      el.title = lastError || 'Atinge butonul pentru activare.';
    }
  }

  async function acquireWakeLock() {
    if (!supported || !enabled || document.visibilityState !== 'visible' || wakeLock) {
      updateButton();
      return;
    }

    try {
      lastError = '';
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => {
        wakeLock = null;
        updateButton();
      });
      updateButton();
    } catch (error) {
      wakeLock = null;
      lastError = 'Telefonul cere o atingere în aplicație pentru activare.';
      console.warn('Screen Wake Lock nu a putut fi activat:', error);
      updateButton();
    }
  }

  async function releaseWakeLock() {
    if (!wakeLock) {
      updateButton();
      return;
    }

    try {
      await wakeLock.release();
    } catch (error) {
      console.warn('Screen Wake Lock nu a putut fi eliberat:', error);
    } finally {
      wakeLock = null;
      updateButton();
    }
  }

  async function toggleWakeLock() {
    enabled = !enabled;
    localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');

    if (enabled) {
      await acquireWakeLock();
    } else {
      await releaseWakeLock();
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const el = button();
    if (!el) return;

    el.addEventListener('click', toggleWakeLock);
    updateButton();

    if (enabled) acquireWakeLock();
  });

  document.addEventListener('pointerdown', () => {
    if (enabled && !wakeLock) acquireWakeLock();
  }, { passive: true });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && enabled) {
      acquireWakeLock();
    }
  });
})();
