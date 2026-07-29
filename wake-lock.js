'use strict';

(() => {
  let wakeLock = null;

  async function keepScreenAwake() {
    if (!('wakeLock' in navigator)) return;
    if (document.visibilityState !== 'visible' || wakeLock) return;

    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => {
        wakeLock = null;
      });
    } catch (error) {
      wakeLock = null;
      console.warn('Ecranul nu a putut fi menținut aprins momentan:', error);
    }
  }

  document.addEventListener('DOMContentLoaded', keepScreenAwake);

  // Unele telefoane permit activarea numai după prima atingere în aplicație.
  document.addEventListener('pointerdown', () => {
    if (!wakeLock) keepScreenAwake();
  }, { passive: true });

  // Android eliberează automat blocarea când aplicația trece în fundal;
  // o cerem din nou imediat ce utilizatorul revine în SALA FIT.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') keepScreenAwake();
  });
})();
